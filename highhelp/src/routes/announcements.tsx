import { Hono } from 'hono'
import { Layout } from '../layout'
import { getUser, renderTags } from '../utils'
import { ANNOUNCEMENT_SUBJECTS } from '../constants'
import { Bindings } from '../types'

const app = new Hono<{ Bindings: Bindings }>()

app.get('/announcements', async (c) => {
    const user = await getUser(c)
    const { results } = await c.env.DB.prepare(`
        SELECT a.*, u.first_name, u.last_name, u.tags 
        FROM announcements a 
        LEFT JOIN users u ON a.author_id = u.id 
        ORDER BY a.created_at DESC
    `).all()
    const subjectFilter = c.req.query('subject')

    let filteredResults = results;
    if (subjectFilter) {
        filteredResults = results?.filter((r: any) => r.subject === subjectFilter)
    }

    return c.html(
        <Layout title="Announcements" user={user}>
            <h1 class="text-3xl font-bold mb-6">Announcements</h1>
            {user ? (
                <div class="bg-gray-50 p-6 rounded-lg border border-gray-200 mb-8">
                    <h3 class="text-lg font-bold mb-4">Post New Announcement</h3>
                    <form action="/announcements" method="post" class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700">Title</label>
                            <input type="text" name="title" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700">Subject</label>
                            <select name="subject" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border">
                                {ANNOUNCEMENT_SUBJECTS.map(s => <option value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700">Content</label>
                            <textarea name="content" rows={3} required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"></textarea>
                        </div>
                        <button type="submit" class="bg-primary text-white px-4 py-2 rounded hover:bg-blue-700">Post Announcement</button>
                    </form>
                </div>
            ) : (
                <div class="bg-blue-50 p-4 rounded mb-8 text-center text-blue-800">
                    <p>Log in to post announcements.</p>
                </div>
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
                        <div class="bg-white p-4 rounded shadow border-l-4 border-blue-500">
                            <h2 class="text-xl font-bold">{a.title}</h2>
                            <p class="text-sm text-blue-600 mb-1 flex items-center">
                                {a.subject} • Posted by {a.first_name ? `${a.first_name} ${a.last_name}` : 'Unknown'}
                                <span class="ml-2" dangerouslySetInnerHTML={{ __html: renderTags(a.tags) }}></span>
                            </p>
                            <p class="mt-2 whitespace-pre-wrap">{a.content}</p>
                            <span class="text-xs text-gray-400 block mt-2">{new Date(a.created_at).toLocaleDateString()}</span>
                        </div>
                    ))
                )}
            </div>
        </Layout>
    )
})

app.post('/announcements', async (c) => {
    const user = await getUser(c)
    if (!user) return c.redirect('/login')
    const body = await c.req.parseBody()
    const title = body['title'] as string
    const subject = body['subject'] as string
    const content = body['content'] as string
    if (title && content) {
        await c.env.DB.prepare('INSERT INTO announcements (title, content, subject, author_id) VALUES (?, ?, ?, ?)')
            .bind(title, content, subject || 'General', user.id)
            .run()
    }
    return c.redirect('/announcements')
})

export default app
