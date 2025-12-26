import { Hono } from 'hono'
import { Layout } from './layout'
import { SUBJECTS, ANNOUNCEMENT_SUBJECTS } from './constants'

const app = new Hono<{ Bindings: Env }>()

app.get('/', (c) => {
    return c.html(
        <Layout title="Home">
            <div class="text-center py-20">
                <h1 class="text-4xl font-bold text-primary mb-4">Welcome to HighHelp</h1>
                <p class="text-xl text-gray-600 mb-8">The student-led platform for high school graduates.</p>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-left">
                    <div class="bg-white p-6 rounded-lg shadow-md border-t-4 border-primary">
                        <h2 class="text-xl font-bold mb-2">Resource Sharing</h2>
                        <p>Share and access high-quality notes from top students.</p>
                    </div>
                    <div class="bg-white p-6 rounded-lg shadow-md border-t-4 border-secondary">
                        <h2 class="text-xl font-bold mb-2">Past Papers</h2>
                        <p>Access a comprehensive bank of past exam papers.</p>
                    </div>
                    <div class="bg-white p-6 rounded-lg shadow-md border-t-4 border-primary">
                        <h2 class="text-xl font-bold mb-2">Q&A Forum</h2>
                        <p>Ask questions and get answers from the community.</p>
                    </div>
                </div>
            </div>
        </Layout>
    )
})

const SubjectList = (props: { baseUrl: string }) => (
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {SUBJECTS.map((subject) => (
            <a href={`${props.baseUrl}?subject=${encodeURIComponent(subject)}`} class="block bg-white p-4 rounded shadow hover:bg-blue-50 transition">
                {subject}
            </a>
        ))}
    </div>
)

app.get('/resources', async (c) => {
    const subject = c.req.query('subject')

    if (!subject) {
        return c.html(
            <Layout title="Resources">
                <h1 class="text-3xl font-bold mb-6">Resource Sharing</h1>
                <p class="mb-6">Select a subject to view or upload notes.</p>
                <SubjectList baseUrl="/resources" />
            </Layout>
        )
    }

    const { results } = await c.env.DB.prepare('SELECT * FROM resources WHERE subject = ? ORDER BY created_at DESC').bind(subject).all()

    return c.html(
        <Layout title={`Resources - ${subject}`}>
            <div class="flex items-center justify-between mb-6">
                <h1 class="text-3xl font-bold">{subject} Resources</h1>
                <a href="/resources" class="text-blue-600 hover:underline">← Back to Subjects</a>
            </div>

            {/* Upload Form */}
            <div class="bg-gray-50 p-6 rounded-lg border border-gray-200 mb-8">
                <h3 class="text-lg font-bold mb-4">Upload Resource (Test User)</h3>
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
                        <input type="file" name="file" required class="mt-1 block w-full text-sm text-gray-500" />
                    </div>
                    <button type="submit" class="bg-primary text-white px-4 py-2 rounded hover:bg-blue-700">Upload Resource</button>
                </form>
            </div>

            {/* Resource List */}
            <div class="space-y-4">
                {results?.length === 0 ? (
                    <p class="text-gray-500">No resources uploaded for this subject yet.</p>
                ) : (
                    results.map((r: any) => (
                        <div class="bg-white p-4 rounded shadow border-l-4 border-green-500 flex justify-between items-start">
                            <div>
                                <h2 class="text-xl font-bold">{r.title}</h2>
                                <p class="text-gray-600 mb-2">{r.description}</p>
                                <span class="text-xs text-gray-400 block">{new Date(r.created_at).toLocaleDateString()}</span>
                            </div>
                            <a href={`/download/${r.file_key}`} target="_blank" class="bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200 text-sm">Download</a>
                        </div>
                    ))
                )}
            </div>
        </Layout>
    )
})

app.post('/resources', async (c) => {
    try {
        const body = await c.req.parseBody()
        const title = body['title'] as string
        const description = body['description'] as string
        const subject = body['subject'] as string
        const file = body['file'] as File

        console.log('Upload Request:', { title, subject, fileName: file?.name, fileSize: file?.size })

        if (title && file && subject) {
            // Sanitize filename to avoid weird URL issues, though R2 handles most chars.
            // Using a simple timestamp prefix.
            const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
            const fileKey = `resources/${Date.now()}-${safeName}`

            console.log('Putting to R2:', fileKey)
            await c.env.BUCKET.put(fileKey, file)

            console.log('Inserting into DB')
            // Using hardcoded uploader_id = 1 (Ricky)
            await c.env.DB.prepare('INSERT INTO resources (title, description, file_key, subject, uploader_id, type) VALUES (?, ?, ?, ?, 1, ?)')
                .bind(title, description, fileKey, subject, 'resource')
                .run()
            console.log('Upload successful')
        }
        return c.redirect(`/resources?subject=${encodeURIComponent(subject)}`)
    } catch (e: any) {
        console.error('Upload Error:', e)
        return c.text(`Upload Failed: ${e.message}`, 500)
    }
})

app.get('/download/*', async (c) => {
    try {
        // Extract key from the full path. Path starts with /download/
        const path = c.req.path;
        console.log('Download path:', path);
        const prefix = '/download/';
        if (!path.startsWith(prefix)) return c.text('Invalid path', 400);

        const key = path.slice(prefix.length);
        console.log('Fetching key from R2:', key);

        const object = await c.env.BUCKET.get(key);
        if (!object) {
            console.error('File not found in R2:', key);
            return c.text('File not found', 404);
        }

        return new Response(object.body, {
            headers: {
                'etag': object.httpEtag,
                'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
            }
        })
    } catch (e: any) {
        console.error('Download Error:', e);
        return c.text(`Download Failed: ${e.message}`, 500);
    }
})

app.get('/announcements', async (c) => {
    const { results } = await c.env.DB.prepare('SELECT * FROM announcements ORDER BY created_at DESC').all()
    const subjectFilter = c.req.query('subject')

    // Filter results in code if needed, or better, via SQL directly:
    // For simplicity with "General" + others, let's just show all or filter if param exists.
    let filteredResults = results;
    if (subjectFilter) {
        filteredResults = results?.filter((r: any) => r.subject === subjectFilter)
    }

    return c.html(
        <Layout title="Announcements">
            <h1 class="text-3xl font-bold mb-6">Announcements</h1>

            {/* Creation Form */}
            <div class="bg-gray-50 p-6 rounded-lg border border-gray-200 mb-8">
                <h3 class="text-lg font-bold mb-4">Post New Announcement (Test User)</h3>
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

            <div class="mb-4">
                <h2 class="text-xl font-bold mb-2">Filter by Subject</h2>
                <div class="flex flex-wrap gap-2">
                    <a href="/announcements" class={`px-3 py-1 rounded shadow text-sm ${!subjectFilter ? 'bg-blue-600 text-white' : 'bg-white hover:bg-blue-50'}`}>All</a>
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
                            <p class="text-sm text-blue-600 mb-2">{a.subject}</p>
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
    const body = await c.req.parseBody()
    const title = body['title'] as string
    const subject = body['subject'] as string
    const content = body['content'] as string

    if (title && content) {
        await c.env.DB.prepare('INSERT INTO announcements (title, content, subject) VALUES (?, ?, ?)')
            .bind(title, content, subject || 'General')
            .run()
    }
    return c.redirect('/announcements')
})

app.get('/past-papers', (c) => {
    return c.html(
        <Layout title="Past Papers">
            <h1 class="text-3xl font-bold mb-6">Past Paper Bank</h1>
            <p class="mb-6">Select a subject to access past papers.</p>
            <SubjectList baseUrl="/past-papers" />
        </Layout>
    )
})

app.get('/forum', (c) => {
    return c.html(
        <Layout title="Q&A Forum">
            <h1 class="text-3xl font-bold mb-6">Q&A Forum</h1>
            <p class="mb-6">Select a subject to view the forum.</p>
            <SubjectList baseUrl="/forum" />
        </Layout>
    )
})

app.get('/essays', (c) => {
    return c.html(
        <Layout title="Essay Exchange">
            <h1 class="text-3xl font-bold mb-6">Essay Exchange</h1>
            <p class="mb-6">Select a subject to swap essays.</p>
            <SubjectList baseUrl="/essays" />
        </Layout>
    )
})


export default app
