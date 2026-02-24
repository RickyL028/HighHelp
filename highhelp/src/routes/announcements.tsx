import { Hono } from 'hono'
import { Layout } from '../layout'
import { getUser, renderTags, logAction, formatDate } from '../utils'
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
            <h1 class="text-3xl font-bold mb-6 text-gray-900 dark:text-white">Announcements</h1>
            {user && user.permission_level >= 2 ? (
                <div class="bg-white dark:bg-neutral-800 rounded-xl border border-gray-300 dark:border-neutral-700 shadow-sm mb-8 overflow-hidden">
                    <div class="bg-gray-50/50 dark:bg-neutral-900/50 border-b border-gray-200 dark:border-neutral-700 px-8 py-4">
                        <h3 class="text-lg font-bold text-gray-800 dark:text-neutral-100">Post New Announcement</h3>
                    </div>

                    <div class="p-8">
                        {user.permission_level === -1 ? (
                            <div class="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 p-4 rounded-lg flex items-center gap-3">
                                <svg class="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                                </svg>
                                <p class="text-sm font-medium text-red-700 dark:text-red-400">You are muted and cannot post.</p>
                            </div>
                        ) : (
                            <form action="/announcements" method="post" class="space-y-5">
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label class="block text-sm font-semibold text-gray-700 dark:text-neutral-300 mb-1">Title</label>
                                        <input type="text" name="title" required
                                            class="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                            placeholder="Announcement title e.g. English grade average dropped" />
                                    </div>
                                    <div>
                                        <label class="block text-sm font-semibold text-gray-700 dark:text-neutral-300 mb-1">Subject</label>
                                        <select name="subject"
                                            class="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white cursor-pointer">
                                            {ANNOUNCEMENT_SUBJECTS.filter(s => canPostAnnouncement(user, s)).map(s => <option value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 dark:text-neutral-300 mb-1">Content</label>
                                    <textarea name="content" rows={4} required
                                        class="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none"
                                        placeholder="Write your message here... e.g. The average was 100%, Source: Ricky"></textarea>
                                </div>
                                <div class="flex justify-end border-t border-gray-100 dark:border-neutral-800 pt-4">
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
            <div class="mb-8">
                <h2 class="text-xl font-bold mb-4 text-gray-800 dark:text-neutral-100">Filter by Subject</h2>
                <div class="flex flex-wrap gap-2">

                    {ANNOUNCEMENT_SUBJECTS.map(subject => (
                        <a href={`/announcements?subject=${encodeURIComponent(subject)}`} class={`px-4 py-1.5 rounded-lg shadow-sm text-sm font-medium transition-all ${subjectFilter === subject ? 'bg-blue-600 dark:bg-blue-600 text-white shadow-blue-500/20' : 'bg-white dark:bg-neutral-800 text-gray-700 dark:text-neutral-300 border border-gray-200 dark:border-neutral-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-200 dark:hover:border-blue-800'}`}>
                            {subject}
                        </a>
                    ))}
                </div>
            </div>

            <div class="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <div class="relative w-full md:w-96">
                    <input type="text" id="search-input" placeholder="Search announcements..." class="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" />
                    <svg class="w-5 h-5 text-gray-400 dark:text-neutral-500 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                </div>
                <div class="flex items-center gap-2 bg-white dark:bg-neutral-800 rounded-lg p-1 border border-gray-200 dark:border-neutral-700 shadow-sm">
                    <button id="view-list" class="p-2 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors" title="List View">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
                    </button>
                    <button id="view-grid" class="p-2 rounded text-gray-500 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-700 transition-colors" title="Grid View">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>
                    </button>
                </div>
            </div>

            {/* Grid View Container */}
            <div id="grid-view-container" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredResults?.length === 0 ? (
                    <div class="col-span-full text-center py-12 text-gray-500 dark:text-neutral-400 bg-gray-50 dark:bg-neutral-800/50 rounded-xl border border-dashed border-gray-300 dark:border-neutral-700">
                        No announcements yet.
                    </div>
                ) : (
                    filteredResults.map((a: any) => (
                        <div
                            class={`search-item bg-white dark:bg-neutral-800 rounded-xl border border-gray-300 dark:border-neutral-700 p-4 hover:bg-gray-50 dark:hover:bg-neutral-750 transition-colors group h-full flex flex-col justify-between shadow-sm ${a.is_deleted ? 'border-red-500 bg-red-50 dark:bg-red-900/10' : ''}`}
                            data-search-text={`${a.title} ${a.content} ${a.subject} ${a.first_name || ''} ${a.last_name || ''}`}
                        >
                            <div class="cursor-pointer" onclick={`window.open('/announcements/${a.id}', '_blank')`}>
                                <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-2 leading-snug group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">{a.title}</h2>

                                <div class="flex flex-wrap items-center gap-x-2 text-xs text-gray-500 dark:text-neutral-400 mb-3">
                                    <span class="font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wide">{a.subject}</span>
                                    <span class="text-gray-300 dark:text-neutral-700">•</span>
                                    <span class="local-date" data-timestamp={a.created_at}>{formatDate(a.created_at)}</span>
                                    <span class="text-gray-300 dark:text-neutral-700">•</span>
                                    <span class="flex items-center">
                                        {a.first_name ? `${a.first_name} ${a.last_name}` : 'Unknown'}
                                        <span class="ml-1" dangerouslySetInnerHTML={{ __html: renderTags(a.tags) }}></span>
                                    </span>
                                    {a.is_deleted && <span class="font-bold text-red-600 dark:text-red-400 uppercase ml-2">Deleted</span>}
                                </div>

                                <p class="text-gray-700 dark:text-neutral-300 mb-4 text-sm whitespace-pre-wrap line-clamp-3 leading-relaxed">{a.content}</p>
                            </div>

                            {!a.is_deleted && user && (canModerateSubject(user, a.subject) || user.id === a.author_id) && (
                                <div class="flex justify-end pt-2 border-t border-gray-50 dark:border-neutral-700/50">
                                    <form action={`/announcements/${a.id}/delete`} method="post" class="inline">
                                        <button type="submit" class="text-red-500 dark:text-red-400 text-xs font-bold hover:underline" onclick="return confirm('Are you sure?') text-xs uppercase tracking-wider">DELETE</button>
                                    </form>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* List View Container (Table) */}
            <div id="list-view-container" class="hidden overflow-x-auto bg-white dark:bg-neutral-800 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700">
                <table class="min-w-full divide-y divide-gray-200 dark:divide-neutral-700">
                    <thead class="bg-gray-50 dark:bg-neutral-900/50">
                        <tr>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-wider">Date</th>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-wider">Subject</th>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-wider">Announcement</th>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-wider">Author</th>
                            <th scope="col" class="px-6 py-3 text-right text-xs font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white dark:bg-neutral-800 divide-y divide-gray-200 dark:divide-neutral-700">
                        {filteredResults?.length === 0 ? (
                            <tr>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-neutral-400 text-center" colspan={5}>No announcements yet.</td>
                            </tr>
                        ) : (
                            filteredResults.map((a: any) => (
                                <tr
                                    class={`search-item hover:bg-gray-50 dark:hover:bg-neutral-750 transition-colors ${a.is_deleted ? 'bg-red-50 dark:bg-red-900/10' : ''}`}
                                    data-search-text={`${a.title} ${a.content} ${a.subject} ${a.first_name || ''} ${a.last_name || ''}`}
                                >
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-neutral-400 font-mono local-date" data-timestamp={a.created_at}>
                                        {formatDate(a.created_at)}
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap">
                                        <span class="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wide">{a.subject}</span>
                                    </td>
                                    <td class="px-6 py-4 text-sm text-gray-900 dark:text-neutral-100">
                                        <div class="font-bold">{a.title}</div>
                                        <div class="text-gray-500 dark:text-neutral-400 text-xs truncate max-w-md mt-0.5">{a.content}</div>
                                        {a.is_deleted && <div class="text-red-500 dark:text-red-400 text-xs font-bold uppercase mt-1">Deleted</div>}
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-neutral-400">
                                        {a.first_name ? `${a.first_name} ${a.last_name}` : 'Unknown'}
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        {!a.is_deleted && user && (canModerateSubject(user, a.subject) || user.id === a.author_id) && (
                                            <form action={`/announcements/${a.id}/delete`} method="post" class="inline">
                                                <button type="submit" class="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 transition-colors" onclick="return confirm('Are you sure?')">Delete</button>
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
            <div class="mx-auto max-w-4xl px-4 sm:px-6">
                <div class="mb-4">
                    <a href={`/announcements?subject=${encodeURIComponent(ann.subject)}`} class="text-blue-600 dark:text-blue-400 hover:underline text-sm flex items-center gap-1 font-medium transition-colors">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                        Back to {ann.subject} Announcements
                    </a>
                </div>

                <div class={`bg-white dark:bg-neutral-800 rounded-2xl border border-gray-200 dark:border-neutral-700 overflow-hidden mb-8 shadow-sm ${ann.is_deleted ? 'border-red-500 bg-red-50 dark:bg-red-900/10' : ''}`}>
                    <div class="p-8 border-b border-gray-100 dark:border-neutral-700/50">
                        {ann.is_deleted && <span class="text-xs font-bold text-red-600 dark:text-red-400 uppercase mb-4 block tracking-widest">Deleted</span>}
                        <div class="flex items-center gap-3 mb-6">
                            <span class="bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-400 text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider">{ann.subject}</span>
                            <span class="text-gray-400 dark:text-neutral-500 text-sm font-mono local-date" data-timestamp={ann.created_at} data-format="datetime">| {formatDate(ann.created_at)}</span>
                        </div>
                        <h1 class="text-4xl font-extrabold text-gray-900 dark:text-white mb-8 leading-tight tracking-tight">{ann.title}</h1>
                        <div class="prose dark:prose-invert max-w-none text-gray-800 dark:text-neutral-200 whitespace-pre-wrap leading-relaxed text-lg">
                            {ann.content}
                        </div>
                    </div>
                    <div class="bg-gray-50 dark:bg-neutral-900/50 px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div class="text-sm text-gray-600 dark:text-neutral-400 flex items-center">
                            <span class="font-bold mr-2 text-gray-900 dark:text-neutral-100">Posted by:</span> {ann.first_name ? `${ann.first_name} ${ann.last_name}` : 'Unknown'}
                            <span class="ml-2" dangerouslySetInnerHTML={{ __html: renderTags(ann.tags) }}></span>
                        </div>
                        {!ann.is_deleted && user && (canModerateSubject(user, ann.subject) || user.id === ann.author_id) && (
                            <form action={`/announcements/${ann.id}/delete`} method="post">
                                <button class="text-red-500 dark:text-red-400 font-bold text-sm hover:underline uppercase tracking-wide transition-all" onclick="return confirm('Delete this announcement?')">Delete Post</button>
                            </form>
                        )}
                    </div>
                </div>
            </div>
        </Layout>
    )
})

app.post('/announcements/:id/delete', async (c) => {
    const user = await getUser(c)
    if (!user) return c.redirect('/login')

    const id = Number(c.req.param('id'));


    const ann = await c.env.DB.prepare('SELECT * FROM announcements WHERE id = ?').bind(id).first<any>()

    if (!ann) return c.notFound()


    if (user.id !== ann.author_id && !canModerateSubject(user, ann.subject)) {
        return c.text('You are not authorized to delete this announcement.', 403)
    }


    await c.env.DB.prepare('UPDATE announcements SET is_deleted = 1 WHERE id = ?')
        .bind(id)
        .run()


    await logAction(c.env.DB, user.id, 'DELETE_ANNOUNCEMENT', `Deleted announcement '${ann.title}'`, id, 'announcements')


    return c.redirect('/announcements')
})
export default app
