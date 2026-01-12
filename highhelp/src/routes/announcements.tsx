import { Hono } from 'hono'
import { Layout } from '../layout'
import { getUser, renderTags, logAction } from '../utils'
import { canPostAnnouncement, canViewDeleted, canModerateSubject } from '../permissions'
import { ANNOUNCEMENT_SUBJECTS } from '../constants'
import { Bindings } from '../types'

const app = new Hono<{ Bindings: Bindings }>()

app.get('/announcements', async (c) => {
    const user = await getUser(c)
    const showDeleted = user && canViewDeleted(user);
    const sql = `
        SELECT a.*, u.first_name, u.last_name, u.tags 
        FROM announcements a 
        LEFT JOIN users u ON a.author_id = u.id 
        ${showDeleted ? '' : 'WHERE a.is_deleted = 0'}
        ORDER BY a.created_at DESC
    `;
    const { results } = await c.env.DB.prepare(sql).all()
    const subjectFilter = c.req.query('subject')

    let filteredResults = results;
    if (subjectFilter) {
        filteredResults = results?.filter((r: any) => r.subject === subjectFilter)
    }

    return c.html(
        <Layout title="Announcements" user={user}>
            <h1 class="text-3xl font-bold mb-6">Announcements</h1>
            {user && user.permission_level >= 2 ? (
                <div class="bg-white rounded-xl border border-gray-200 shadow-sm mb-8 overflow-hidden">
                    <div class="bg-gray-50/50 border-b border-gray-200 px-8 py-4">
                        <h3 class="text-lg font-bold text-gray-800">Post New Announcement</h3>
                    </div>

                    <div class="p-8">
                        {user.permission_level === -1 ? (
                            <div class="bg-red-50 border border-red-100 p-4 rounded-lg flex items-center gap-3">
                                <svg class="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                                </svg>
                                <p class="text-sm font-medium text-red-700">You are muted and cannot post.</p>
                            </div>
                        ) : (
                            <form action="/announcements" method="post" class="space-y-5">
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label class="block text-sm font-semibold text-gray-700 mb-1">Title</label>
                                        <input type="text" name="title" required
                                            class="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                            placeholder="Announcement title e.g. English grade average dropped" />
                                    </div>
                                    <div>
                                        <label class="block text-sm font-semibold text-gray-700 mb-1">Subject</label>
                                        <select name="subject"
                                            class="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white cursor-pointer">
                                            {ANNOUNCEMENT_SUBJECTS.filter(s => canPostAnnouncement(user, s)).map(s => <option value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 mb-1">Content</label>
                                    <textarea name="content" rows={4} required
                                        class="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none"
                                        placeholder="Write your message here... e.g. The average was 100%, Source: Ricky"></textarea>
                                </div>
                                <div class="flex justify-end border-t border-gray-100 pt-4">
                                    <button type="submit"
                                        class="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2.5 rounded-lg transition-colors shadow-sm">
                                        Post Announcement
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            ) : (
                <div></div>
            )}
            <div class="mb-4">
                <h2 class="text-xl font-bold mb-2">Filter by Subject</h2>
                <div class="flex flex-wrap gap-2">

                    {ANNOUNCEMENT_SUBJECTS.map(subject => (
                        <a href={`/announcements?subject=${encodeURIComponent(subject)}`} class={`px-3 py-1 rounded shadow text-sm ${subjectFilter === subject ? 'bg-blue-600 text-white' : 'bg-white hover:bg-blue-50'}`}>
                            {subject}
                        </a>
                    ))}
                </div>
            </div>

            <div class="space-y-4">
                {filteredResults?.length === 0 ? (
                    <p class="text-gray-500">No announcements yet.</p>
                ) : (
                    filteredResults.map((a: any) => (
                        <div class={`bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 ${a.is_deleted ? 'border-red-500 bg-red-50' : ''}`}>
                            <div class="flex justify-between items-center mb-3">
                                <div class="flex items-center gap-2">
                                    <span class="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide">{a.subject}</span>
                                    {a.is_deleted && <span class="text-xs font-bold text-red-600 uppercase">Deleted</span>}
                                </div>
                                <span class="text-xs text-gray-400 local-date" data-timestamp={a.created_at}>{new Date(a.created_at).toLocaleDateString()}</span>
                            </div>

                            <h2 class="text-xl font-bold text-gray-800 mb-2">{a.title}</h2>
                            <p class="text-gray-600 leading-relaxed mb-4 whitespace-pre-wrap">{a.content}</p>

                            <div class="border-t border-gray-100 pt-3 flex justify-between items-center text-sm">
                                <span class="text-gray-500 flex items-center">
                                    Posted by {a.first_name ? `${a.first_name} ${a.last_name}` : 'Unknown'}
                                    <span class="ml-2" dangerouslySetInnerHTML={{ __html: renderTags(a.tags) }}></span>
                                </span>
                                {!a.is_deleted && user && (canModerateSubject(user, a.subject) || user.id === a.author_id) && (
                                    <form action={`/announcements/${a.id}/delete`} method="post" class="inline">
                                        <button type="submit" class="text-red-500 text-xs font-bold hover:underline" onclick="return confirm('Are you sure?')">DELETE</button>
                                    </form>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </Layout >
    )
})

app.post('/announcements', async (c) => {
    const user = await getUser(c)
    if (!user) return c.redirect('/login')
    const body = await c.req.parseBody()
    const title = body['title'] as string
    const subject = body['subject'] as string
    const content = body['content'] as string

    if (!canPostAnnouncement(user, subject)) {
        return c.text('You do not have permission to post in this subject.', 403)
    }

    if (title && content) {
        const res = await c.env.DB.prepare('INSERT INTO announcements (title, content, subject, author_id) VALUES (?, ?, ?, ?)')
            .bind(title, content, subject || 'General', user.id)
            .run()

        await logAction(c.env.DB, user.id, 'CREATE_ANNOUNCEMENT', `Created announcement '${title}' in ${subject}`, res.meta.last_row_id, 'announcements');
    }
    return c.redirect('/announcements')
})

app.post('/announcements/:id/delete', async (c) => {
    const user = await getUser(c)
    if (!user) return c.redirect('/login')
    const id = c.req.param('id')

    const ann = await c.env.DB.prepare('SELECT * FROM announcements WHERE id = ?').bind(id).first() as any;
    if (!ann) return c.notFound();

    if (!canModerateSubject(user, ann.subject) && user.id !== ann.author_id) {
        return c.text('Unauthorized', 403);
    }

    await c.env.DB.prepare('UPDATE announcements SET is_deleted = 1 WHERE id = ?').bind(id).run();
    await logAction(c.env.DB, user.id, 'DELETE_ANNOUNCEMENT', `Deleted announcement ${id}`, Number(id), 'announcements');

    return c.redirect('/announcements');
})

export default app
