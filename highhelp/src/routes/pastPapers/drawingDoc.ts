// Handwritten answers are drawn in js-draw (public/drawing-editor.js) and saved as the SVG it exports.
// These helpers decide where a drawing lives and whether an uploaded SVG is acceptable; the routes in
// drawings.tsx do the R2 and D1 work.

// Pasted photos are embedded in the SVG as data URLs, so the ceiling is set by images rather than ink.
export const DRAWING_MAX_BYTES = 5_000_000

// Which attempt a drawing belongs to: practice, a review re-attempt, or one mock exam.
export type DrawingContext = 'practice' | 'review' | `mock-${number}`

const CONTEXT_PATTERN = /^(practice|review|mock-[1-9]\d*)$/

const isPositiveInteger = (value: number) => Number.isInteger(value) && value > 0

// The single-question page saves into whichever attempt it is showing, so the drawing follows the
// same split: a review re-attempt never overwrites the first attempt's drawing.
export function drawingContextForMode(mode: string | null | undefined): 'practice' | 'review' {
    return mode === 'review' ? 'review' : 'practice'
}

// A mock exam keeps its own drawings, like its own typed responses, until marking copies them to practice.
export function mockDrawingContext(mockExamId: number): DrawingContext {
    if (!isPositiveInteger(mockExamId)) throw new Error(`Invalid mock exam id: ${mockExamId}`)
    return `mock-${mockExamId}`
}

// Always built from the session user, never from anything the client sends, so one student cannot
// address another's drawing. /download/* refuses this prefix for the same reason.
export function drawingObjectKey(questionId: number, userId: number, context: DrawingContext): string {
    if (!isPositiveInteger(questionId) || !isPositiveInteger(userId) || !CONTEXT_PATTERN.test(context)) {
        throw new Error(`Invalid drawing key parts: question ${questionId}, user ${userId}, context ${context}`)
    }
    return `drawings/q${questionId}/u${userId}/${context}.svg`
}

export const DRAWING_KEY_PREFIX = 'drawings/'

export function attemptDrawingUrls(questionId: number, context: 'practice' | 'review') {
    const query = context === 'review' ? '?mode=review' : ''
    return {
        svgUrl: `/past-papers/attempt/${questionId}/drawing.svg${query}`,
        saveUrl: `/past-papers/attempt/${questionId}/drawing${query}`
    }
}

export function mockDrawingUrls(mockExamId: number, questionId: number) {
    const base = `/past-papers/mock-exams/${mockExamId}/questions/${questionId}`
    return { svgUrl: `${base}/drawing.svg`, saveUrl: `${base}/drawing` }
}

// Appends the saved-at stamp so a preview <img> refetches after an edit instead of showing the copy
// the browser already holds.
export function withDrawingVersion(url: string, version: string | number | null | undefined): string {
    if (version == null || version === '') return url
    return `${url}${url.includes('?') ? '&' : '?'}v=${encodeURIComponent(String(version))}`
}

export type SvgUploadCheck = { ok: true; byteLength: number } | { ok: false; status: 400 | 413; reason: string }

// Elements that can run script or pull in another document. js-draw never emits any of them.
const FORBIDDEN_ELEMENTS = new Set(['script', 'foreignobject', 'iframe', 'object', 'embed'])

// Matches one attribute inside a start tag. Values are quoted in js-draw's output, but bare values are
// accepted too so they cannot be used to slip an attribute past the check.
const ATTRIBUTE_PATTERN = /([^\s=/>"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>"']+)))?/g

// Walks the start tags only, honouring quoted attribute values, so the text a student types into a
// text box (which the serializer escapes) is never mistaken for markup.
function* startTags(svg: string): Generator<{ name: string; attributes: string }> {
    let index = 0
    while ((index = svg.indexOf('<', index)) !== -1) {
        const match = /^<([A-Za-z][\w:.-]*)/.exec(svg.slice(index, index + 80))
        if (!match) {
            index += 1
            continue
        }
        let end = index + match[0].length
        let quote: string | null = null
        for (; end < svg.length; end++) {
            const ch = svg[end]
            if (quote) {
                if (ch === quote) quote = null
            } else if (ch === '"' || ch === "'") {
                quote = ch
            } else if (ch === '>') {
                break
            }
        }
        yield { name: match[1].toLowerCase(), attributes: svg.slice(index + match[0].length, end) }
        index = end + 1
    }
}

// Strips whitespace and control characters the way URL parsing does, so "java\tscript:" is caught too.
const normalisedUrl = (value: string) => value.replace(/[\u0000- \u007f]+/g, '').toLowerCase()

// Drawings are only ever shown through <img> (which never runs script) and served with a sandboxing
// CSP, so this is a second line of defence: it rejects anything js-draw would not have produced.
export function checkSvgUpload(svg: string): SvgUploadCheck {
    const byteLength = new TextEncoder().encode(svg).byteLength
    if (byteLength > DRAWING_MAX_BYTES) {
        return { ok: false, status: 413, reason: 'Drawing is too large' }
    }

    const body = svg.trim().replace(/^<\?xml[^>]*\?>\s*/i, '')
    if (!/^<svg[\s>]/i.test(body) || !/<\/svg>$/i.test(body)) {
        return { ok: false, status: 400, reason: 'Not an SVG document' }
    }
    if (/<!(?:doctype|entity)/i.test(body)) {
        return { ok: false, status: 400, reason: 'Document type declarations are not allowed' }
    }

    for (const tag of startTags(body)) {
        if (FORBIDDEN_ELEMENTS.has(tag.name)) {
            return { ok: false, status: 400, reason: `<${tag.name}> is not allowed` }
        }
        for (const [, rawName, doubleQuoted, singleQuoted, bare] of tag.attributes.matchAll(ATTRIBUTE_PATTERN)) {
            const name = rawName.toLowerCase()
            if (name.startsWith('on')) {
                return { ok: false, status: 400, reason: 'Event handler attributes are not allowed' }
            }
            if (name === 'href' || name.endsWith(':href')) {
                const value = normalisedUrl(doubleQuoted ?? singleQuoted ?? bare ?? '')
                // Internal references and embedded images only: no remote fetches, no script URLs.
                if (value && !value.startsWith('#') && !value.startsWith('data:image/')) {
                    return { ok: false, status: 400, reason: 'Links to other documents are not allowed' }
                }
            }
        }
    }

    return { ok: true, byteLength }
}
