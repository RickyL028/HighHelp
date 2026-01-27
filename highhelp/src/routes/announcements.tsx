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
                <div class="bg-white rounded border border-gray-300 shadow-none mb-8 overflow-hidden">
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

            <div class="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <div class="relative w-full md:w-96">
                    <input type="text" id="search-input" placeholder="Search announcements..." class="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" />
                    <svg class="w-5 h-5 text-gray-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                </div>
                <div class="flex items-center gap-2 bg-white rounded-lg p-1 border border-gray-200 shadow-sm">
                    <button id="view-list" class="p-2 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors" title="List View">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
                    </button>
                    <button id="view-grid" class="p-2 rounded text-gray-500 hover:bg-gray-50 transition-colors" title="Grid View">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>
                    </button>
                </div>
            </div>

            {/* Grid View Container */}
            <div id="grid-view-container" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredResults?.length === 0 ? (
                    <div class="col-span-full text-center py-12 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                        No announcements yet.
                    </div>
                ) : (
                    filteredResults.map((a: any) => (
                        <div
                            class={`search-item bg-white rounded border border-gray-300 p-4 hover:bg-gray-50 transition-colors group h-full flex flex-col justify-between ${a.is_deleted ? 'border-red-500 bg-red-50' : ''}`}
                            data-search-text={`${a.title} ${a.content} ${a.subject} ${a.first_name || ''} ${a.last_name || ''}`}
                        >
                            <div class="cursor-pointer" onclick={`window.open('/announcements/${a.id}', '_blank')`}>
                                <h2 class="text-lg font-bold text-gray-900 mb-1 leading-snug group-hover:text-blue-700 transition-colors">{a.title}</h2>

                                <div class="flex flex-wrap items-center gap-x-2 text-xs text-gray-500 mb-2">
                                    <span class="font-bold text-blue-700 uppercase tracking-wide">{a.subject}</span>
                                    <span class="text-gray-300">•</span>
                                    <span class="local-date" data-timestamp={a.created_at}>{new Date(a.created_at).toLocaleDateString()}</span>
                                    <span class="text-gray-300">•</span>
                                    <span class="flex items-center">
                                        {a.first_name ? `${a.first_name} ${a.last_name}` : 'Unknown'}
                                        <span class="ml-1" dangerouslySetInnerHTML={{ __html: renderTags(a.tags) }}></span>
                                    </span>
                                    {a.is_deleted && <span class="font-bold text-red-600 uppercase ml-2">Deleted</span>}
                                </div>

                                <p class="text-gray-700 mb-3 text-sm whitespace-pre-wrap line-clamp-3">{a.content}</p>
                            </div>

                            {!a.is_deleted && user && (canModerateSubject(user, a.subject) || user.id === a.author_id) && (
                                <div class="flex justify-end">
                                    <form action={`/announcements/${a.id}/delete`} method="post" class="inline">
                                        <button type="submit" class="text-red-500 text-xs font-bold hover:underline" onclick="return confirm('Are you sure?')">DELETE</button>
                                    </form>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* List View Container (Table) */}
            <div id="list-view-container" class="hidden overflow-x-auto bg-white rounded-lg shadow border border-gray-200">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Announcement</th>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Author</th>
                            <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        {filteredResults?.length === 0 ? (
                            <tr>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center" colspan={5}>No announcements yet.</td>
                            </tr>
                        ) : (
                            filteredResults.map((a: any) => (
                                <tr
                                    class={`search-item hover:bg-gray-50 transition-colors ${a.is_deleted ? 'bg-red-50' : ''}`}
                                    data-search-text={`${a.title} ${a.content} ${a.subject} ${a.first_name || ''} ${a.last_name || ''}`}
                                >
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 local-date" data-timestamp={a.created_at}>
                                        {new Date(a.created_at).toLocaleDateString()}
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap">
                                        <span class="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-bold uppercase">{a.subject}</span>
                                    </td>
                                    <td class="px-6 py-4 text-sm text-gray-900">
                                        <div class="font-bold">{a.title}</div>
                                        <div class="text-gray-500 text-xs truncate max-w-md">{a.content}</div>
                                        {a.is_deleted && <div class="text-red-500 text-xs font-bold uppercase mt-1">Deleted</div>}
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {a.first_name ? `${a.first_name} ${a.last_name}` : 'Unknown'}
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        {!a.is_deleted && user && (canModerateSubject(user, a.subject) || user.id === a.author_id) && (
                                            <form action={`/announcements/${a.id}/delete`} method="post" class="inline">
                                                <button type="submit" class="text-red-600 hover:text-red-900" onclick="return confirm('Are you sure?')">Delete</button>
                                            </form>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
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



// 6. Single Announcement View (New)
app.get('/announcements/:id', async (c) => {
    const user = await getUser(c)
    const id = c.req.param('id')

    const ann = await c.env.DB.prepare(`
        SELECT a.*, u.first_name, u.last_name, u.tags 
        FROM announcements a 
        LEFT JOIN users u ON a.author_id = u.id 
        WHERE a.id = ?
    `).bind(id).first<any>();

    if (!ann) return c.notFound();
    if (ann.is_deleted && (!user || !canViewDeleted(user))) return c.notFound();

    return c.html(
        <Layout title={ann.title} user={user}>
            <div class="mx-auto max-w-4xl">
                <div class="mb-4">
                    <a href={`/announcements?subject=${encodeURIComponent(ann.subject)}`} class="text-blue-600 hover:underline text-sm">← Back to {ann.subject} Announcements</a>
                </div>

                <div class={`bg-white rounded border border-gray-300 overflow-hidden mb-8 ${ann.is_deleted ? 'border-red-500 bg-red-50' : ''}`}>
                    <div class="p-8 border-b border-gray-100">
                        {ann.is_deleted && <span class="text-xs font-bold text-red-600 uppercase mb-2 block">Deleted</span>}
                        <div class="flex items-center gap-2 mb-4">
                            <span class="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">{ann.subject}</span>
                            <span class="text-gray-400 text-sm local-date" data-timestamp={ann.created_at} data-format="datetime">| {new Date(ann.created_at).toLocaleString()}</span>
                        </div>
                        <h1 class="text-3xl font-bold text-gray-900 mb-6 leading-tight">{ann.title}</h1>
                        <div class="prose max-w-none text-gray-800 whitespace-pre-wrap leading-relaxed">
                            {ann.content}
                        </div>
                    </div>
                    <div class="bg-gray-50 px-8 py-4 flex items-center justify-between">
                        <div class="text-sm text-gray-600 flex items-center">
                            <span class="font-bold mr-1">Posted by:</span> {ann.first_name ? `${ann.first_name} ${ann.last_name}` : 'Unknown'}
                            <span class="ml-2" dangerouslySetInnerHTML={{ __html: renderTags(ann.tags) }}></span>
                        </div>
                        {!ann.is_deleted && user && (canModerateSubject(user, ann.subject) || user.id === ann.author_id) && (
                            <form action={`/announcements/${ann.id}/delete`} method="post">
                                <button class="text-red-500 font-bold text-sm hover:underline" onclick="return confirm('Delete this announcement?')">Delete Post</button>
                            </form>
                        )}
                    </div>
                </div>
            </div>
        </Layout>
    )
})
// Add this to handle the delete action
app.post('/announcements/:id/delete', async (c) => {
    const user = await getUser(c)
    if (!user) return c.redirect('/login')

    const id = Number(c.req.param('id'));

    // 1. Fetch announcement to check existence and permissions
    const ann = await c.env.DB.prepare('SELECT * FROM announcements WHERE id = ?').bind(id).first<any>()

    if (!ann) return c.notFound()

    // 2. Verify Permissions (Must be author OR have moderation rights)
    if (user.id !== ann.author_id && !canModerateSubject(user, ann.subject)) {
        return c.text('You are not authorized to delete this announcement.', 403)
    }

    // 3. Perform Soft Delete (set is_deleted = 1)
    await c.env.DB.prepare('UPDATE announcements SET is_deleted = 1 WHERE id = ?')
        .bind(id)
        .run()

    // 4. Log the action
    await logAction(c.env.DB, user.id, 'DELETE_ANNOUNCEMENT', `Deleted announcement '${ann.title}'`, id, 'announcements')

    // 5. Redirect back to list
    return c.redirect('/announcements')
})
export default app
