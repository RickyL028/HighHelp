import { Hono } from 'hono'
import { Layout } from '../layout'
import { Bindings } from '../types'
import { getUser, formatDate, logAction } from '../utils'
import { PermissionLevel } from '../permissions'

const app = new Hono<{ Bindings: Bindings }>()

const STATUS_LABELS: Record<string, string> = {
    adopted: 'Adopted',
    developing: 'Developing',
    discarded: 'Discarded',
    pending: 'Pending',
}

const STATUS_CLASSES: Record<string, string> = {
    adopted: 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800/50',
    developing: 'bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800/50',
    discarded: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800/50',
    pending: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800/50',
}

const ALL_STATUSES = ['adopted', 'developing', 'discarded', 'pending'] as const

app.get('/feedback', async (c) => {
    const user = await getUser(c)
    const isAdmin = user && Number(user.permission_level) >= PermissionLevel.ADMIN

    const { results: publicFeedback } = await c.env.DB.prepare(`
        SELECT f.*, u.first_name, u.last_name
        FROM feedback f
        LEFT JOIN users u ON f.submitter_id = u.id
        WHERE f.status IN ('adopted', 'developing', 'discarded')
        ORDER BY
            CASE f.status WHEN 'adopted' THEN 1 WHEN 'developing' THEN 2 WHEN 'discarded' THEN 3 END,
            f.updated_at DESC
    `).all()

    let pendingFeedback: any[] = []
    if (user) {
        if (isAdmin) {
            const { results } = await c.env.DB.prepare(`
                SELECT f.*, u.first_name, u.last_name
                FROM feedback f
                LEFT JOIN users u ON f.submitter_id = u.id
                WHERE f.status = 'pending'
                ORDER BY f.created_at DESC
            `).all()
            pendingFeedback = results || []
        } else {
            const { results } = await c.env.DB.prepare(`
                SELECT f.*, u.first_name, u.last_name
                FROM feedback f
                LEFT JOIN users u ON f.submitter_id = u.id
                WHERE f.status = 'pending' AND f.submitter_id = ?
                ORDER BY f.created_at DESC
            `).bind(user.id).all()
            pendingFeedback = results || []
        }
    }

    const adopted = (publicFeedback || []).filter((f: any) => f.status === 'adopted')
    const developing = (publicFeedback || []).filter((f: any) => f.status === 'developing')
    const discarded = (publicFeedback || []).filter((f: any) => f.status === 'discarded')

    const renderCard = (f: any) => {
        const badge = STATUS_CLASSES[f.status] || STATUS_CLASSES.pending
        return (
            <div class="flex items-center gap-3 py-2.5 px-3 border-b border-gray-100 dark:border-neutral-800 last:border-b-0 hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors">

                <div class="flex-1 min-w-0">
                    <span class="font-semibold text-sm text-gray-900 dark:text-white">{f.title}</span>
                    <span class="text-gray-300 dark:text-neutral-600 text-xs mx-2">·</span>
                    <span class="text-xs text-gray-500 dark:text-neutral-400">{f.description}</span>
                </div>

                {isAdmin && (
                    <div class="flex-shrink-0 flex items-center gap-1">
                        {ALL_STATUSES.filter(s => s !== f.status).map(status => (
                            <form action={`/feedback/${f.id}/status`} method="post" class="inline">
                                <input type="hidden" name="status" value={status} />
                                <button type="submit" class={`px-2 py-0.5 rounded text-xs font-bold border transition-opacity hover:opacity-70 ${STATUS_CLASSES[status]}`}>
                                    {STATUS_LABELS[status]}
                                </button>
                            </form>
                        ))}
                        <form action={`/feedback/${f.id}/delete`} method="post" class="inline ml-1">
                            <button type="submit" class="text-red-500 dark:text-red-400 text-xs font-bold hover:underline uppercase tracking-wide" onclick="return confirm('Delete this suggestion?')">
                                Delete
                            </button>
                        </form>
                    </div>
                )}
            </div>
        )
    }

    const renderSection = (title: string, items: any[], emptyMsg: string) => (
        <div class="border-t dark:border-neutral-800 pt-6 mb-6">
            <div class="flex items-center justify-between mb-3">
                <h2 class="text-xl font-bold text-gray-900 dark:text-white">{title}</h2>
                <span class="text-sm text-gray-400 dark:text-neutral-500">{items.length}</span>
            </div>
            {items.length === 0 ? (
                <p class="text-gray-400 dark:text-neutral-500 text-sm italic">{emptyMsg}</p>
            ) : (
                <div class="border border-gray-200 dark:border-neutral-700 rounded overflow-hidden bg-white dark:bg-neutral-800">
                    {items.map((f: any) => renderCard(f))}
                </div>
            )}
        </div>
    )

    return c.html(
        <Layout title="Feedback" user={user}>
            <div class="max-w-3xl mx-auto">
                <div class="flex items-center justify-between mb-6">
                    <h1 class="text-3xl font-bold text-gray-900 dark:text-white">What if...</h1>
                    {user && Number(user.permission_level) >= PermissionLevel.VERIFIED ? (
                        <a href="/feedback/submit" class="bg-[#633200] hover:bg-[#b05800] text-white px-4 py-2 rounded font-bold transition-colors text-sm">
                            + Submit
                        </a>
                    ) : null}
                </div>
                <p class="text-gray-400 dark:text-neutral-400 text-sm">
                    We got too many suggestions from the google form (thank you everybody!!)
                </p>
                <p class="text-gray-400 dark:text-neutral-400 text-sm mb-8">
                    To keep everyone updated, this temporary page will be used to display the progress of those, or any new, suggestions.
                </p>


                {/* Pending — only shown if there's something to show */}
                {pendingFeedback.length > 0 && (
                    <div class="border-t dark:border-neutral-800 pt-6 mb-6">
                        <div class="flex items-center justify-between mb-4">
                            <h2 class="text-xl font-bold text-gray-900 dark:text-white">
                                Pending Review
                                {isAdmin && <span class="ml-2 text-xs text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30 px-2 py-0.5 rounded font-medium normal-case">admin</span>}
                            </h2>
                            <span class="text-sm text-gray-400 dark:text-neutral-500">{pendingFeedback.length}</span>
                        </div>
                        <div class="space-y-3">
                            {pendingFeedback.map((f: any) => renderCard(f))}
                        </div>
                    </div>
                )}

                {renderSection('Adopted', adopted, 'Nothing adopted yet.')}
                {renderSection('Developing', developing, 'Nothing in progress.')}
                {renderSection('Discarded', discarded, 'Nothing discarded.')}

            </div>

        </Layout>

    )
})

// Submit page
app.get('/feedback/submit', async (c) => {
    const user = await getUser(c)
    if (!user) return c.redirect('/login')
    if (Number(user.permission_level) < PermissionLevel.VERIFIED) {
        return c.redirect('/about')
    }

    return c.html(
        <Layout title="Submit Suggestion" user={user}>
            <div class="max-w-2xl mx-auto">
                <a href="/feedback" class="text-blue-600 dark:text-blue-400 hover:underline text-sm mb-6 inline-block">← Back</a>

                <div class="bg-white dark:bg-neutral-800 rounded border border-gray-200 dark:border-neutral-700 p-6">
                    <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-1">Submit a suggestion</h1>


                    <form action="/feedback/submit" method="post" class="space-y-5">
                        <div>
                            <label class="block text-sm font-semibold text-gray-700 dark:text-neutral-300 mb-1">Title</label>
                            <input
                                type="text"
                                name="title"
                                required
                                maxlength={100}

                                class="w-full px-4 py-2 rounded border border-gray-300 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                            />
                        </div>

                        <div>
                            <label class="block text-sm font-semibold text-gray-700 dark:text-neutral-300 mb-1">Details</label>
                            <textarea
                                name="description"
                                required
                                rows={4}
                                maxlength={1000}

                                class="w-full px-4 py-2 rounded border border-gray-300 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none"
                            ></textarea>
                        </div>

                        <div class="flex items-center justify-end gap-4 border-t border-gray-100 dark:border-neutral-800 pt-4">
                            <a href="/feedback" class="text-gray-500 dark:text-neutral-400 hover:text-gray-700 dark:hover:text-neutral-200 text-sm">Cancel</a>
                            <button type="submit" class="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2 rounded transition-colors text-sm">
                                Submit
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </Layout>
    )
})

// Handle submission
app.post('/feedback/submit', async (c) => {
    const user = await getUser(c)
    if (!user) return c.redirect('/login')
    if (Number(user.permission_level) < PermissionLevel.VERIFIED) return c.text('Unauthorised', 403)

    const body = await c.req.parseBody()
    const title = (body['title'] as string || '').trim()
    const description = (body['description'] as string || '').trim()

    if (!title || !description) return c.redirect('/feedback/submit')
    if (title.length > 100 || description.length > 1000) return c.text('Input too long.', 400)

    const res = await c.env.DB.prepare(
        'INSERT INTO feedback (title, description, submitter_id) VALUES (?, ?, ?)'
    ).bind(title, description, user.id).run()

    await logAction(c.env.DB, user.id, 'SUBMIT_FEEDBACK', `"${title}"`, res.meta.last_row_id, 'feedback')

    return c.redirect('/feedback')
})

// Admin: update status
app.post('/feedback/:id/status', async (c) => {
    const user = await getUser(c)
    if (!user || Number(user.permission_level) < PermissionLevel.ADMIN) return c.text('Unauthorised', 403)

    const id = c.req.param('id')
    const body = await c.req.parseBody()
    const newStatus = body['status'] as string

    if (!ALL_STATUSES.includes(newStatus as any)) return c.text('Invalid status', 400)

    const existing = await c.env.DB.prepare('SELECT id FROM feedback WHERE id = ?').bind(id).first()
    if (!existing) return c.notFound()

    await c.env.DB.prepare(
        'UPDATE feedback SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(newStatus, id).run()

    await logAction(c.env.DB, user.id, 'UPDATE_FEEDBACK_STATUS', `${id} → "${newStatus}"`, Number(id), 'feedback')

    return c.redirect('/feedback')
})

// Admin: delete
app.post('/feedback/:id/delete', async (c) => {
    const user = await getUser(c)
    if (!user || Number(user.permission_level) < PermissionLevel.ADMIN) return c.text('Unauthorised', 403)

    const id = c.req.param('id')
    const existing = await c.env.DB.prepare('SELECT id FROM feedback WHERE id = ?').bind(id).first()
    if (!existing) return c.notFound()

    await c.env.DB.prepare('DELETE FROM feedback WHERE id = ?').bind(id).run()
    await logAction(c.env.DB, user.id, 'DELETE_FEEDBACK', `Deleted feedback ${id}`, Number(id), 'feedback')

    return c.redirect('/feedback')
})

export default app
