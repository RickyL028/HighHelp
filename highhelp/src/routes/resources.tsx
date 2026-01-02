import { Hono } from 'hono'
import { Layout } from '../layout'
import { getUser, renderTags } from '../utils'
import { SubjectSelector } from '../components/SubjectSelector'
import { Bindings } from '../types'

const app = new Hono<{ Bindings: Bindings }>()

app.get('/resources', async (c) => {
    const user = await getUser(c)
    const subject = c.req.query('subject')

    // 1. Landing Page (No Subject) -> Show Recent Resources + Subject Selector at Bottom
    if (!subject) {
        // Fetch recent resources globally
        const { results: recentResources } = await c.env.DB.prepare(`
            SELECT r.*, u.first_name, u.last_name, u.tags 
            FROM resources r 
            LEFT JOIN users u ON r.uploader_id = u.id 
            ORDER BY r.created_at DESC 
            LIMIT 5
        `).all()

        return c.html(
            <Layout title="Resources" user={user}>
                <div class="max-w-4xl mx-auto space-y-12">

                    {/* Recent Resources Section */}
                    <section>
                        <h1 class="text-3xl font-bold mb-6">Recent Resources</h1>
                        <div class="space-y-4">
                            {recentResources?.length === 0 ? (
                                <p class="text-gray-500 italic">No resources uploaded recently.</p>
                            ) : (
                                recentResources?.map((r: any) => (
                                    <div class="bg-white p-4 rounded shadow-sm border border-gray-200 border-l-4 border-l-green-500 flex justify-between items-start">
                                        <div class="flex-grow">
                                            <div class="flex items-center gap-2 mb-1">
                                                <span class="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full font-medium">{r.subject}</span>
                                                <span class="text-xs text-gray-500">• {new Date(r.created_at).toLocaleDateString()}</span>
                                            </div>
                                            <h2 class="text-lg font-bold text-gray-900">{r.title}</h2>
                                            <p class="text-xs text-gray-500 flex items-center mt-1">
                                                By {r.first_name ? `${r.first_name} ${r.last_name}` : 'Unknown'}
                                                <span class="ml-2" dangerouslySetInnerHTML={{ __html: renderTags(r.tags) }}></span>
                                            </p>
                                        </div>
                                        <a href={`/download/${r.file_key}`} target="_blank" class="bg-blue-50 text-blue-700 px-3 py-1.5 rounded hover:bg-blue-100 text-sm font-medium whitespace-nowrap ml-4">
                                            Download
                                        </a>
                                    </div>
                                ))
                            )}
                        </div>
                    </section>

                    <hr class="border-gray-200" />

                    {/* Subject Selector at Bottom */}
                    <section>
                        <h2 class="text-xl font-bold mb-4">Browse by Subject</h2>
                        <SubjectSelector baseUrl="/resources" type="standard" />
                    </section>
                </div>
            </Layout>
        )
    }

    // 2. Subject Page -> Unchanged Logic
    const { results } = await c.env.DB.prepare(`
        SELECT r.*, u.first_name, u.last_name, u.tags 
        FROM resources r 
        LEFT JOIN users u ON r.uploader_id = u.id 
        WHERE r.subject = ? 
        ORDER BY r.created_at DESC
    `).bind(subject).all()

    return c.html(
        <Layout title={`Resources - ${subject}`} user={user}>
            <div class="flex items-center justify-between mb-6">
                <h1 class="text-3xl font-bold">{subject} Resources</h1>
                <a href="/resources" class="text-blue-600 hover:underline">← All Subjects</a>
            </div>

            {user ? (
                <div class="bg-gray-50 p-6 rounded-lg border border-gray-200 mb-8">
                    <h3 class="text-lg font-bold mb-4">Upload Resource</h3>
                    <form action="/resources" method="post" enctype="multipart/form-data" class="space-y-4">
                        <input type="hidden" name="subject" value={subject} />
                        <div>
                            <label class="block text-sm font-medium text-gray-700">Title</label>
                            <input type="text" name="title" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700">Description</label>
                            <textarea name="description" rows={2} class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"></textarea>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700">File</label>
                            <input
                                type="file"
                                name="file"
                                required
                                class="mt-1 block w-full text-sm text-gray-500"
                                accept="*"
                                onchange="if(this.files[0].size > 26214400){ alert('File is too big! Max size is 25MB.'); this.value = ''; }"
                            />
                            <p class="text-xs text-gray-500 mt-1">Maximum file size: 25 MB</p>
                        </div>
                        <button type="submit" class="bg-primary text-white px-4 py-2 rounded hover:bg-blue-700">Upload Resource</button>
                    </form>
                </div>
            ) : (
                <div class="bg-blue-50 p-4 rounded mb-8 text-center text-blue-800">
                    <a href="/login" class="font-bold underline">Log in</a> to upload resources.
                </div>
            )}

            <div class="space-y-4">
                {results?.length === 0 ? (
                    <p class="text-gray-500">No resources uploaded for this subject yet.</p>
                ) : (
                    results.map((r: any) => (
                        <div class="bg-white p-4 rounded shadow border-l-4 border-green-500 flex justify-between items-start">
                            <div class="flex-grow">
                                <h2 class="text-xl font-bold">{r.title}</h2>
                                <p class="text-xs text-gray-500 mb-1 flex items-center">
                                    Uploaded by {r.first_name ? `${r.first_name} ${r.last_name}` : 'Unknown'}
                                    <span class="ml-2" dangerouslySetInnerHTML={{ __html: renderTags(r.tags) }}></span>
                                    <span class="ml-1">on {new Date(r.created_at).toLocaleDateString()}</span>
                                </p>
                                <p class="text-gray-600 mb-2">{r.description}</p>
                            </div>
                            <a href={`/download/${r.file_key}`} target="_blank" class="bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200 text-sm ml-4 whitespace-nowrap">Download</a>
                        </div>
                    ))
                )}
            </div>
        </Layout>
    )
})

app.post('/resources', async (c) => {
    try {
        const user = await getUser(c)
        if (!user) return c.redirect('/login')

        const body = await c.req.parseBody()
        const title = body['title'] as string
        const description = body['description'] as string
        const subject = body['subject'] as string
        const file = body['file'] as File
        const MAX_SIZE = 25 * 1024 * 1024
        if (file && file.size > MAX_SIZE) {
            return c.text("File too large. Maximum size is 25MB.", 400)
        }

        if (title && file && subject) {
            const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
            const fileKey = `resources/${Date.now()}-${safeName}`
            await c.env.BUCKET.put(fileKey, file)
            await c.env.DB.prepare('INSERT INTO resources (title, description, file_key, subject, uploader_id, type) VALUES (?, ?, ?, ?, ?, ?)')
                .bind(title, description, fileKey, subject, user.id, 'resource')
                .run()
        }
        return c.redirect(`/resources?subject=${encodeURIComponent(subject)}`)
    } catch (e: any) {
        return c.text(`Upload Failed: ${e.message}`, 500)
    }
})

app.get('/download/*', async (c) => {
    try {
        const path = c.req.path;
        const prefix = '/download/';
        if (!path.startsWith(prefix)) return c.text('Invalid path', 400);
        const key = path.slice(prefix.length);
        const object = await c.env.BUCKET.get(key);
        if (!object) return c.text('File not found', 404);
        return new Response(object.body, {
            headers: {
                'etag': object.httpEtag,
                'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
            }
        })
    } catch (e: any) {
        return c.text(`Download Failed: ${e.message}`, 500);
    }
})

export default app
