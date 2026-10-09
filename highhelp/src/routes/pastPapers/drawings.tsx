import { Hono, type Context } from 'hono'
import { getUser } from '../../utils'
import { Bindings } from '../../types'
import {
    DRAWING_MAX_BYTES,
    checkSvgUpload,
    drawingContextForMode,
    drawingObjectKey,
    mockDrawingContext,
    type DrawingContext
} from './drawingDoc'

type AppContext = Context<{ Bindings: Bindings }>

const app = new Hono<{ Bindings: Bindings }>()

// A drawing is the student's own work but still user-supplied markup. Pages only ever show it through
// <img>, which never runs script; the sandboxing CSP covers someone opening the URL directly.
const SVG_HEADERS = {
    'Content-Type': 'image/svg+xml; charset=utf-8',
    'Content-Security-Policy': "default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox",
    'X-Content-Type-Options': 'nosniff',
    // Revalidated on every view (a cheap 304 via the ETag), so an edit shows up immediately.
    'Cache-Control': 'private, no-cache'
}

const parseId = (raw: string | undefined) => {
    const id = Number(raw)
    return Number.isInteger(id) && id > 0 ? id : null
}

// Reads the body but stops as soon as it passes the limit, so an oversized upload without a
// Content-Length cannot make the worker buffer it all first.
async function readTextWithin(request: Request, limit: number): Promise<string | null> {
    if (!request.body) return ''
    const reader = request.body.getReader()
    const chunks: Uint8Array[] = []
    let total = 0
    for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        total += value.byteLength
        if (total > limit) {
            await reader.cancel()
            return null
        }
        chunks.push(value)
    }
    const bytes = new Uint8Array(total)
    let offset = 0
    for (const chunk of chunks) {
        bytes.set(chunk, offset)
        offset += chunk.byteLength
    }
    return new TextDecoder().decode(bytes)
}

async function serveDrawing(c: AppContext, key: string) {
    // Passing the request headers lets R2 evaluate If-None-Match itself.
    const object = await c.env.BUCKET.get(key, { onlyIf: c.req.raw.headers })
    // "Nothing drawn yet" is the normal first visit, so it is an empty success rather than a 404 that
    // every browser console would flag as a failed request.
    if (!object) return c.body(null, 204, { 'Cache-Control': SVG_HEADERS['Cache-Control'] })
    if (!('body' in object)) {
        return new Response(null, { status: 304, headers: { etag: object.httpEtag, 'Cache-Control': SVG_HEADERS['Cache-Control'] } })
    }
    return new Response(object.body, { headers: { ...SVG_HEADERS, etag: object.httpEtag } })
}

// Notes that a drawing exists (or has changed). Always written after the R2 object: if this fails, the
// drawing is still saved and only the page's hint that there is one is missing.
async function recordDrawing(db: D1Database, userId: number, questionId: number, context: DrawingContext, byteSize: number) {
    const row = await db.prepare(`
        INSERT INTO answer_drawings (user_id, question_id, context, byte_size, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id, question_id, context) DO UPDATE SET
            byte_size = excluded.byte_size,
            updated_at = CURRENT_TIMESTAMP
        RETURNING updated_at
    `).bind(userId, questionId, context, byteSize).first<{ updated_at: string }>()
    return row?.updated_at ?? null
}

// Copies one of a student's drawings to another context, replacing whatever was there. Marking a mock
// exam uses this to carry the handwriting into the practice attempt along with the typed response.
export async function copyDrawing(env: Bindings, userId: number, questionId: number, from: DrawingContext, to: DrawingContext) {
    const object = await env.BUCKET.get(drawingObjectKey(questionId, userId, from))
    if (!object) return false
    const body = await object.arrayBuffer()
    await env.BUCKET.put(drawingObjectKey(questionId, userId, to), body, { httpMetadata: { contentType: 'image/svg+xml' } })
    await recordDrawing(env.DB, userId, questionId, to, body.byteLength)
    return true
}

async function storeDrawing(c: AppContext, questionId: number, userId: number, context: DrawingContext) {
    if (Number(c.req.header('content-length') || 0) > DRAWING_MAX_BYTES) {
        return c.json({ error: 'Drawing is too large' }, 413)
    }
    const svg = await readTextWithin(c.req.raw, DRAWING_MAX_BYTES)
    if (svg === null) return c.json({ error: 'Drawing is too large' }, 413)
    const check = checkSvgUpload(svg)
    if (!check.ok) return c.json({ error: check.reason }, check.status)

    await c.env.BUCKET.put(drawingObjectKey(questionId, userId, context), svg, {
        httpMetadata: { contentType: 'image/svg+xml' }
    })
    const updatedAt = await recordDrawing(c.env.DB, userId, questionId, context, check.byteLength)
    return c.json({ ok: true, updated_at: updatedAt })
}

// The editor sends a delete when everything has been erased, so an empty page leaves nothing behind.
async function removeDrawing(c: AppContext, questionId: number, userId: number, context: DrawingContext) {
    await c.env.BUCKET.delete(drawingObjectKey(questionId, userId, context))
    await c.env.DB.prepare('DELETE FROM answer_drawings WHERE user_id = ? AND question_id = ? AND context = ?')
        .bind(userId, questionId, context)
        .run()
    return c.json({ ok: true, updated_at: null })
}

/* ---- Single-question page and batch view: the viewer's own practice or review drawing ---- */

// The key comes from the session, so these can only ever reach the viewer's own drawing.
async function attemptTarget(c: AppContext) {
    const user = await getUser(c)
    if (!user) return c.json({ error: 'Unauthorized' }, 401)
    const questionId = parseId(c.req.param('id'))
    if (!questionId) return c.json({ error: 'Not found' }, 404)
    return { questionId, userId: user.id as number, context: drawingContextForMode(c.req.query('mode')) }
}

app.get('/past-papers/attempt/:id/drawing.svg', async (c) => {
    const target = await attemptTarget(c)
    if (target instanceof Response) return target
    return serveDrawing(c, drawingObjectKey(target.questionId, target.userId, target.context))
})

app.put('/past-papers/attempt/:id/drawing', async (c) => {
    const target = await attemptTarget(c)
    if (target instanceof Response) return target
    const question = await c.env.DB.prepare('SELECT id FROM exam_questions WHERE id = ?').bind(target.questionId).first()
    if (!question) return c.json({ error: 'Not found' }, 404)
    return storeDrawing(c, target.questionId, target.userId, target.context)
})

app.delete('/past-papers/attempt/:id/drawing', async (c) => {
    const target = await attemptTarget(c)
    if (target instanceof Response) return target
    return removeDrawing(c, target.questionId, target.userId, target.context)
})

/* ---- Mock exams: drawings belong to whoever sat the exam ---- */

// Only the exam's owner can see or change its drawings, and only for questions that are in it. Changes
// stop once the exam is finished, the same point at which its typed responses stop changing.
async function mockTarget(c: AppContext, forWrite: boolean) {
    const user = await getUser(c)
    if (!user) return c.json({ error: 'Unauthorized' }, 401)
    const examId = parseId(c.req.param('examId'))
    const questionId = parseId(c.req.param('qid'))
    if (!examId || !questionId) return c.json({ error: 'Not found' }, 404)

    const [examResult, questionResult] = await c.env.DB.batch([
        c.env.DB.prepare('SELECT user_id, status FROM mock_exams WHERE id = ?').bind(examId),
        c.env.DB.prepare('SELECT 1 AS found FROM mock_exam_questions WHERE mock_exam_id = ? AND question_id = ?').bind(examId, questionId)
    ])
    const exam = examResult.results[0] as { user_id: number; status: string } | undefined
    if (!exam || questionResult.results.length === 0) return c.json({ error: 'Not found' }, 404)
    if (exam.user_id !== user.id) return c.json({ error: 'Forbidden' }, 403)
    if (forWrite && exam.status === 'completed') return c.json({ error: 'This exam has been finished' }, 409)
    return { questionId, userId: user.id as number, context: mockDrawingContext(examId) }
}

app.get('/past-papers/mock-exams/:examId/questions/:qid/drawing.svg', async (c) => {
    const target = await mockTarget(c, false)
    if (target instanceof Response) return target
    return serveDrawing(c, drawingObjectKey(target.questionId, target.userId, target.context))
})

app.put('/past-papers/mock-exams/:examId/questions/:qid/drawing', async (c) => {
    const target = await mockTarget(c, true)
    if (target instanceof Response) return target
    return storeDrawing(c, target.questionId, target.userId, target.context)
})

app.delete('/past-papers/mock-exams/:examId/questions/:qid/drawing', async (c) => {
    const target = await mockTarget(c, true)
    if (target instanceof Response) return target
    return removeDrawing(c, target.questionId, target.userId, target.context)
})

export default app
