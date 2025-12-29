import { Hono } from 'hono'
import { setCookie, getCookie, deleteCookie } from 'hono/cookie'
import { Layout } from './layout'
import { SUBJECTS, ANNOUNCEMENT_SUBJECTS } from './constants'

const app = new Hono<{ Bindings: Env }>()

// --- CONFIGURATION ---

// Exact mapping of your priority list. 
// Note: Ensure these strings match exactly what is inside your SUBJECTS constant.
const PRIORITY_STANDARD = [
    "English Advanced",
    "Mathematics Advanced",
    "Mathematics Extension 1", // Assuming 'Math Advanced X1' refers to Ext 1
    "Physics",
    "Chemistry",
    "Biology",
    "Economics",
    "Business Studies",
    "Modern History",
    "Geography",
    "Legal Studies",
    "Software Engineering",
    "Engineering Studies"
];

const PRIORITY_ESSAY = [
    "English Advanced",
    "Economics",
    "Business Studies",
    "Modern History",
    "Geography",
    "Legal Studies"
];

// --- HELPER FUNCTIONS ---

async function getUser(c: any) {
    const userId = getCookie(c, 'user_id')
    if (!userId) return null
    return await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first()
}

// New Helper to sort subjects based on the requested priority
const getSortedSubjects = (type: 'standard' | 'essay') => {
    // Cast the priority list to match the type of the elements in SUBJECTS
    const priorityList = (type === 'essay' ? PRIORITY_ESSAY : PRIORITY_STANDARD) as typeof SUBJECTS[number][];

    // Now TypeScript knows 's' is the specific literal type, not just a generic 'string'
    const popular = priorityList.filter(s => SUBJECTS.includes(s));

    const others = SUBJECTS
        .filter(s => !(priorityList as string[]).includes(s))
        .sort((a, b) => a.localeCompare(b));

    return { popular, others };
}

// --- COMPONENTS ---

// Redesigned Subject Selector (Compact Pills)
const SubjectSelector = (props: { baseUrl: string, type: 'standard' | 'essay' }) => {
    const { popular, others } = getSortedSubjects(props.type);

    const Pill = ({ subject }: { subject: string }) => (
        <a
            href={`${props.baseUrl}?subject=${encodeURIComponent(subject)}`}
            class="inline-block bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-full text-sm font-medium hover:bg-blue-600 hover:text-white hover:border-blue-600 transition shadow-sm mb-2 mr-2"
        >
            {subject}
        </a>
    );

    return (
        <div class="space-y-6">
            {/* Priority Subjects */}
            <div>
                <h3 class="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">popular</h3>
                <div class="flex flex-wrap">
                    {popular.map(s => <Pill subject={s} />)}
                </div>
            </div>

            <hr class="border-gray-200" />

            {/* All Other Subjects */}
            <div>
                <h3 class="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">All</h3>
                <div class="flex flex-wrap">
                    {others.map(s => <Pill subject={s} />)}
                </div>
            </div>
        </div>
    )
}

// --- ROUTES ---

app.get('/', async (c) => {
    const user = await getUser(c)
    return c.html(
        <Layout title="Home" user={user}>
            <div class="text-center py-20">
                <h1 class="text-4xl font-bold text-primary mb-4">HighHelp</h1>
                <p class="text-xl text-gray-600 mb-8">Pull Request Testing</p> 
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-left">
                    <a href="/resources" class="bg-white p-6 rounded-lg shadow-md border-t-4 border-primary hover:shadow-lg transition">
                        <h2 class="text-xl font-bold mb-2">Resource Sharing</h2>
                        <p class="text-gray-600">Share and access high-quality notes from top students.</p>
                    </a>
                    <a href="/past-papers" class="bg-white p-6 rounded-lg shadow-md border-t-4 border-secondary hover:shadow-lg transition">
                        <h2 class="text-xl font-bold mb-2">Past Papers</h2>
                        <p class="text-gray-600">Access a comprehensive bank of past exam papers.</p>
                    </a>
                    <a href="/forum" class="bg-white p-6 rounded-lg shadow-md border-t-4 border-primary hover:shadow-lg transition">
                        <h2 class="text-xl font-bold mb-2">Q&A Forum</h2>
                        <p class="text-gray-600">Ask questions and get answers from the community.</p>
                    </a>
                </div>
            </div>
        </Layout>
    )
})

// ... [Login/Logout routes remain unchanged] ...

app.get('/login', (c) => {
    return c.html(
        <Layout title="Login">
            <div class="flex flex-col md:flex-row min-h-[600px]">
                <div class="w-full md:w-1/2 p-8 flex flex-col justify-center border-r border-gray-200">
                    <h2 class="text-2xl font-bold mb-6 text-blue-900">Standard Login</h2>
                    <form action="/login" method="post" class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700">Email Address</label>
                            <input type="email" name="email" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-3 border" placeholder="student@example.com" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700">Password</label>
                            <input type="password" name="password" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-3 border" placeholder="••••••••" />
                        </div>
                        <button type="submit" class="w-full bg-blue-800 text-white font-bold py-3 rounded hover:bg-blue-900 transition">
                            Log In
                        </button>
                    </form>
                </div>
                <div class="w-full md:w-1/2 p-8 flex flex-col justify-center items-center bg-gray-50">
                    <h2 class="text-2xl font-bold mb-6 text-gray-800">School Login</h2>
                    <p class="text-gray-600 mb-6 text-center">Log in with your institution credentials.</p>
                    <button disabled class="w-3/4 bg-gray-300 text-gray-500 font-bold py-3 rounded cursor-not-allowed">
                        Log In via School (Coming Soon)
                    </button>
                </div>
            </div>
        </Layout>
    )
})

app.post('/login', async (c) => {
    const body = await c.req.parseBody()
    const email = body['email'] as string
    const password = body['password'] as string

    const user = await c.env.DB.prepare('SELECT * FROM users WHERE email = ? AND password = ?').bind(email, password).first()

    if (user) {
        const isLocal = c.req.url.includes('localhost');
        setCookie(c, 'user_id', String(user.id), {
            path: '/',
            httpOnly: true,
            secure: !isLocal,
            maxAge: 60 * 60 * 24 * 7,
            sameSite: 'Lax'
        });
        return c.redirect('/')
    } else {
        return c.html(
            <Layout title="Login Error">
                <div class="p-4 bg-red-100 text-red-700 rounded text-center">
                    <p>Invalid email or password.</p>
                    <a href="/login" class="underline mt-2 inline-block">Try Again</a>
                </div>
            </Layout>
        )
    }
})

app.get('/logout', (c) => {
    deleteCookie(c, 'user_id')
    return c.redirect('/')
})

// --- UPDATED SUB-PAGES ---

app.get('/resources', async (c) => {
    const user = await getUser(c)
    const subject = c.req.query('subject')

    if (!subject) {
        return c.html(
            <Layout title="Resources" user={user}>
                <div class="max-w-4xl mx-auto">
                    <h1 class="text-3xl font-bold mb-2">Resource Sharing</h1>
                    <p class="mb-8 text-gray-600">Select a subject to view or upload notes.</p>
                    {/* Using Standard Priority List */}
                    <SubjectSelector baseUrl="/resources" type="standard" />
                </div>
            </Layout>
        )
    }

    const { results } = await c.env.DB.prepare(`
        SELECT r.*, u.first_name, u.last_name 
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

            {/* Upload Form (Unchanged logic, just UI check) */}
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
                                <p class="text-xs text-gray-500 mb-1">Uploaded by {r.first_name ? `${r.first_name} ${r.last_name}` : 'Unknown'} on {new Date(r.created_at).toLocaleDateString()}</p>
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

// ... [Post resources and download routes remain unchanged] ...
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

// Announcements (Unchanged, already used a filter system)
app.get('/announcements', async (c) => {
    const user = await getUser(c)
    const { results } = await c.env.DB.prepare(`
        SELECT a.*, u.first_name, u.last_name 
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
            {/* ... [Rest of announcement creation logic unchanged] ... */}
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
                            <p class="text-sm text-blue-600 mb-1">{a.subject} • Posted by {a.first_name ? `${a.first_name} ${a.last_name}` : 'Unknown'}</p>
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

app.get('/past-papers', async (c) => {
    const user = await getUser(c)
    return c.html(
        <Layout title="Past Papers" user={user}>
            <div class="max-w-4xl mx-auto">
                <h1 class="text-3xl font-bold mb-2">Past Paper Bank</h1>
                <p class="mb-8 text-gray-600">Select a subject to access past papers.</p>
                {/* Using Standard Priority List */}
                <SubjectSelector baseUrl="/past-papers" type="standard" />
            </div>
        </Layout>
    )
})

app.get('/forum', async (c) => {
    const user = await getUser(c)
    return c.html(
        <Layout title="Q&A Forum" user={user}>
            <div class="max-w-4xl mx-auto">
                <h1 class="text-3xl font-bold mb-2">Q&A Forum</h1>
                <p class="mb-8 text-gray-600">Select a subject to view the forum.</p>
                {/* Using Standard Priority List */}
                <SubjectSelector baseUrl="/forum" type="standard" />
            </div>
        </Layout>
    )
})

app.get('/essays', async (c) => {
    const user = await getUser(c)
    return c.html(
        <Layout title="Essay Exchange" user={user}>
            <div class="max-w-4xl mx-auto">
                <h1 class="text-3xl font-bold mb-2">Essay Exchange</h1>
                <p class="mb-8 text-gray-600">Select a subject to swap essays.</p>
                {/* Using ESSAY Priority List */}
                <SubjectSelector baseUrl="/essays" type="essay" />
            </div>
        </Layout>
    )
})

export default app