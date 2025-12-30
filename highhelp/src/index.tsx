import { Hono } from 'hono'
import { setCookie, getCookie, deleteCookie } from 'hono/cookie'
import { Layout } from './layout'
import { SUBJECTS, ANNOUNCEMENT_SUBJECTS } from './constants'

const app = new Hono<{ Bindings: Env & { PORTAL_API_CLIENT_ID: string; PORTAL_API_CLIENT_SECRET: string; APP_REDIRECT_URI: string } }>()

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

// --- AUTHENTICATION ROUTES ---

app.get('/api/auth/login', (c) => {
    const clientId = c.env.PORTAL_API_CLIENT_ID;
    const redirectUri = c.env.APP_REDIRECT_URI;

    if (!clientId || !redirectUri) {
        return c.text('Configuration Error: Missing Client ID or Redirect URI', 500);
    }

    // Generate random state
    const state = Math.random().toString(36).substring(7);
    setCookie(c, 'oauth_state', state, {
        path: '/',
        httpOnly: true,
        secure: !c.req.url.includes('localhost'),
        maxAge: 300, // 5 minutes
        sameSite: 'Lax'
    });

    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'all-ro',
        state: state
    });

    return c.redirect(`https://student.sbhs.net.au/api/authorize?${params.toString()}`);
})

app.get('/api/auth/callback', async (c) => {
    const error = c.req.query('error');
    if (error) return c.text(`Auth Error: ${error}`, 400);

    const code = c.req.query('code');
    const state = c.req.query('state');
    const savedState = getCookie(c, 'oauth_state');

    // Verify state to prevent CSRF
    if (!code || !state || state !== savedState) {
        return c.text('Invalid State or Missing Code. Please try logging in again.', 400);
    }

    // Exchange code for token
    const clientId = c.env.PORTAL_API_CLIENT_ID;
    const clientSecret = c.env.PORTAL_API_CLIENT_SECRET;
    const redirectUri = c.env.APP_REDIRECT_URI;

    if (!clientSecret) {
        return c.text('Configuration Error: Missing Client Secret. Please add PORTAL_API_CLIENT_SECRET to .dev.vars or secrets.', 500);
    }

    try {
        const tokenResponse = await fetch('https://student.sbhs.net.au/api/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code: code,
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: redirectUri
            })
        });

        const tokenData: any = await tokenResponse.json();

        if (!tokenData.access_token) {
            return c.text('Failed to retrieve access token: ' + JSON.stringify(tokenData), 400);
        }

        const accessToken = tokenData.access_token;

        // Get User Info
        const userResponse = await fetch('https://student.sbhs.net.au/api/details/userinfo.json', {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        const userData: any = await userResponse.json();

        if (!userData.studentId) {
            return c.text('Failed to retrieve user info: ' + JSON.stringify(userData), 400);
        }

        // Check/Upsert User in DB
        let user = await c.env.DB.prepare('SELECT * FROM users WHERE student_id = ?').bind(userData.studentId).first();

        if (!user) {
            // Create new user
            const result = await c.env.DB.prepare(`
                INSERT INTO users (student_id, first_name, last_name, email, role, permission_level)
                VALUES (?, ?, ?, ?, 'student', 0)
                RETURNING *
            `).bind(
                userData.studentId,
                userData.givenName,
                userData.surname,
                userData.email
            ).first();
            user = result;
        }

        if (!user) return c.text('Database Error: Failed to create user', 500);

        // Set Session Cookie
        const isLocal = c.req.url.includes('localhost');
        setCookie(c, 'user_id', String(user.id), {
            path: '/',
            httpOnly: true,
            secure: !isLocal,
            maxAge: 60 * 60 * 24 * 7, // 1 week
            sameSite: 'Lax'
        });

        return c.redirect('/');

    } catch (e: any) {
        return c.text(`Authentication Failed: ${e.message}`, 500);
    }
})

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
                    <h2 class="text-2xl font-bold mb-6 text-gray-800">Student Portal Login</h2>
                    <p class="text-gray-600 mb-6 text-center">Log in with your school credentials.</p>
                    <a href="/api/auth/login" class="w-3/4 bg-blue-600 text-white font-bold py-3 rounded text-center hover:bg-blue-700 transition shadow-md flex items-center justify-center gap-2">
                        <span>Log In with Student Portal</span>
                    </a>
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

// --- PAST PAPERS ROUTES ---

app.get('/past-papers', async (c) => {
    const user = await getUser(c)
    const subject = c.req.query('subject')
    const topicIdStr = c.req.query('topic_id')

    // 1. No Subject Selected -> Show Subject Selector
    if (!subject) {
        return c.html(
            <Layout title="Past Papers" user={user}>
                <div class="max-w-4xl mx-auto">
                    <h1 class="text-3xl font-bold mb-2">Past Paper Bank</h1>
                    <p class="mb-8 text-gray-600">Select a subject to access past papers.</p>
                    <SubjectSelector baseUrl="/past-papers" type="standard" />
                </div>
            </Layout>
        )
    }

    // 2. Subject Selected -> Show Topics AND Upload Form
    if (subject && !topicIdStr) {

        const { results: topics } = await c.env.DB.prepare('SELECT * FROM topics WHERE subject = ? ORDER BY name ASC').bind(subject).all()

        const canUpload = user && user.permission_level >= 3;

        return c.html(
            <Layout title={`Past Papers - ${subject}`} user={user}>
                <div class="max-w-4xl mx-auto">
                    <div class="flex items-center justify-between mb-6">
                        <div>
                            <h1 class="text-3xl font-bold">{subject}</h1>
                            <p class="text-gray-600">Select a topic to view questions.</p>
                        </div>
                        <a href="/past-papers" class="text-blue-600 hover:underline">← All Subjects</a>
                    </div>

                    {/* Centralized Upload Form (Only for Permission Level >= 3) */}
                    {canUpload ? (
                        <div class="bg-gray-50 p-6 rounded-lg border border-gray-200 mb-8 mx-auto shadow-sm">
                            <h3 class="text-lg font-bold mb-4 flex items-center gap-2">
                                <span class="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">+</span>
                                Add New Question to Bank
                            </h3>

                            <form action="/past-papers/questions" method="post" enctype="multipart/form-data" class="space-y-4" id="uploadForm">
                                <input type="hidden" name="subject" value={subject} />

                                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Topic Selection */}
                                    <div class="col-span-1">
                                        <label class="block text-sm font-medium text-gray-700">Topic</label>
                                        <div class="flex gap-2 mt-1">
                                            <select name="topic_id" required class="block w-full rounded-md border-gray-300 shadow-sm p-2 border">
                                                <option value="" disabled selected>Select a Topic</option>
                                                {topics?.map((t: any) => <option value={t.id}>{t.name}</option>)}
                                            </select>
                                            {/* Quick Add Topic Button that toggles a modal or simple prompt could go here, keeping it simple for now */}
                                        </div>
                                    </div>

                                    {/* Paper Tag */}
                                    <div class="col-span-1">
                                        <label class="block text-sm font-medium text-gray-700">Paper Name</label>
                                        <input type="text" name="paper_tag" id="paperTagInput" placeholder="e.g. Sydney Boys 2023 Trial" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border" />
                                        <p class="text-xs text-gray-500 mt-1">Saved for next upload automatically.</p>
                                    </div>
                                </div>

                                <div class="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-white rounded border border-gray-200">
                                    {/* Question Image */}
                                    <div>
                                        <label class="block text-sm font-medium text-gray-700 mb-2">Question Image (Required)</label>
                                        <div class="flex flex-col gap-2">
                                            <input type="file" name="question_image" id="qInput" required accept="image/*" class="block w-full text-sm text-gray-500" />
                                            <button type="button" onclick="pasteImage('qInput')" class="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200 text-left w-fit">
                                                📋 Paste from Clipboard
                                            </button>
                                            <div id="qPreview" class="hidden mt-2 border border-gray-200 rounded p-1">
                                                <p class="text-xs text-gray-400 mb-1">Preview:</p>
                                                <img src="" class="max-h-32 object-contain" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Answer Image */}
                                    <div>
                                        <label class="block text-sm font-medium text-gray-700 mb-2">Answer Image (Optional)</label>
                                        <div class="flex flex-col gap-2">
                                            <input type="file" name="answer_image" id="aInput" accept="image/*" class="block w-full text-sm text-gray-500" />
                                            <button type="button" onclick="pasteImage('aInput')" class="text-sm bg-green-100 text-green-700 px-3 py-1 rounded hover:bg-green-200 text-left w-fit">
                                                📋 Paste from Clipboard
                                            </button>
                                            <div id="aPreview" class="hidden mt-2 border border-gray-200 rounded p-1">
                                                <p class="text-xs text-gray-400 mb-1">Preview:</p>
                                                <img src="" class="max-h-32 object-contain" />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <button type="submit" class="w-full bg-blue-800 text-white font-bold py-3 rounded hover:bg-blue-900 transition shadow-md">
                                    Upload Question
                                </button>
                            </form>

                            {/* Inline Script for Clipboard & Persistence */}
                            <script dangerouslySetInnerHTML={{
                                __html: `
                                // Persistence for Paper Tag
                                const tagInput = document.getElementById('paperTagInput');
                                if (localStorage.getItem('last_paper_tag')) {
                                    tagInput.value = localStorage.getItem('last_paper_tag');
                                }
                                tagInput.addEventListener('change', (e) => {
                                    localStorage.setItem('last_paper_tag', e.target.value);
                                });

                                // Paste Functionality
                                async function pasteImage(inputId) {
                                    try {
                                        const items = await navigator.clipboard.read();
                                        for (const item of items) {
                                            if (item.types.some(type => type.startsWith('image/'))) {
                                                const blob = await item.getType(item.types.find(type => type.startsWith('image/')));
                                                const file = new File([blob], "pasted_image.png", { type: blob.type });
                                                
                                                // Create a DataTransfer to set the file input
                                                const dataTransfer = new DataTransfer();
                                                dataTransfer.items.add(file);
                                                
                                                const input = document.getElementById(inputId);
                                                input.files = dataTransfer.files;
                                                
                                                // Show Preview
                                                const previewDiv = document.getElementById(inputId === 'qInput' ? 'qPreview' : 'aPreview');
                                                const previewImg = previewDiv.querySelector('img');
                                                previewImg.src = URL.createObjectURL(blob);
                                                previewDiv.classList.remove('hidden');

                                                return; // Only paste one image
                                            }
                                        }
                                        alert("No image found in clipboard!");
                                    } catch (err) {
                                        console.error(err);
                                        alert("Failed to paste image: " + err.message);
                                    }
                                }
                            ` }} />
                        </div>
                    ) : null}

                    {/* Quick Topic Creator (Perm 3+) */}
                    {canUpload ? (
                        <div class="mb-8 p-4 bg-white border border-gray-200 rounded-lg">
                            <form action="/past-papers/topics" method="post" class="flex gap-2 items-center">
                                <span class="text-sm font-bold text-gray-600 uppercase">New Topic:</span>
                                <input type="hidden" name="subject" value={subject} />
                                <input type="text" name="name" required placeholder="Topic Name" class="rounded-md border-gray-300 shadow-sm p-1 border text-sm" />
                                <button type="submit" class="bg-gray-600 text-white px-3 py-1 rounded text-sm hover:bg-gray-700">Add</button>
                            </form>
                        </div>
                    ) : null}

                    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {topics?.length === 0 ? (
                            <div class="col-span-full text-center py-12 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                                No topics found.
                            </div>
                        ) : (
                            topics.map((topic: any) => (
                                <a href={`/past-papers?subject=${encodeURIComponent(subject)}&topic_id=${topic.id}`} class="block bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md hover:border-blue-400 transition group">
                                    <h3 class="text-lg font-bold text-gray-800 group-hover:text-blue-700">{topic.name}</h3>
                                    <span class="text-xs text-gray-500">View Questions →</span>
                                </a>
                            ))
                        )}
                    </div>
                </div>
            </Layout>
        )
    }

    // 3. Topic Selected -> Show Questions
    const topicId = parseInt(topicIdStr || '0')
    const topic = await c.env.DB.prepare('SELECT * FROM topics WHERE id = ?').bind(topicId).first()

    if (!topic) return c.text('Topic not found', 404)

    const { results: questions } = await c.env.DB.prepare(`
        SELECT q.*, u.first_name, u.last_name 
        FROM questions q 
        LEFT JOIN users u ON q.uploader_id = u.id 
        WHERE q.topic_id = ? 
        ORDER BY q.created_at DESC
    `).bind(topicId).all()

    return c.html(
        <Layout title={`${topic.name} - ${subject}`} user={user}>
            <div class="max-w-4xl mx-auto">
                <div class="mb-6">
                    <div class="flex items-center gap-2 text-sm text-gray-500 mb-2">
                        <a href="/past-papers" class="hover:underline">Subjects</a>
                        <span>/</span>
                        <a href={`/past-papers?subject=${encodeURIComponent(subject)}`} class="hover:underline">{subject}</a>
                        <span>/</span>
                        <span class="font-medium text-gray-900">{topic.name}</span>
                    </div>
                    <h1 class="text-3xl font-bold">{topic.name}</h1>
                </div>

                {/* Question List */}
                <div class="space-y-8">
                    {questions?.length === 0 ? (
                        <p class="text-gray-500 text-center py-10">No questions in this topic yet.</p>
                    ) : (
                        questions.map((q: any) => (
                            <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                <div class="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center bg-blue-50/50">
                                    <div class="flex items-center gap-3">
                                        <span class="text-xs font-mono text-gray-500">#{q.id}</span>
                                        {q.paper_tag && (
                                            <span class="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full font-medium border border-blue-200">
                                                {q.paper_tag}
                                            </span>
                                        )}
                                    </div>
                                    <span class="text-xs text-gray-400">By {q.first_name}</span>
                                </div>
                                <div class="p-6">
                                    <div class="mb-6">
                                        <h4 class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Question</h4>
                                        <img src={`/download/${q.question_image_key}`} alt="Question" class="max-w-full h-auto rounded border border-gray-200 shadow-sm" loading="lazy" />
                                    </div>

                                    {q.answer_image_key ? (
                                        <details class="group">
                                            <summary class="cursor-pointer text-sm font-medium text-blue-600 hover:text-blue-800 flex items-center gap-2 select-none">
                                                <span>▶ Show Answer</span>
                                            </summary>
                                            <div class="mt-4 pt-4 border-t border-dashed border-gray-200">
                                                <h4 class="text-xs font-bold text-green-600 uppercase tracking-widest mb-2">Answer</h4>
                                                <img src={`/download/${q.answer_image_key}`} alt="Answer" class="max-w-full h-auto rounded border border-green-200 ring-2 ring-green-50 shadow-sm" loading="lazy" />
                                            </div>
                                        </details>
                                    ) : (
                                        <p class="text-sm text-gray-400 italic">No answer provided.</p>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </Layout>
    )
})

app.post('/past-papers/topics', async (c) => {
    const user = await getUser(c)
    if (!user || user.permission_level < 3) return c.text("Unauthorized", 401)

    const body = await c.req.parseBody()
    const subject = body['subject'] as string
    const name = body['name'] as string

    if (subject && name) {
        try {
            await c.env.DB.prepare('INSERT INTO topics (subject, name) VALUES (?, ?)').bind(subject, name).run()
        } catch (e) {
            console.error('Topic creation failed', e)
        }
    }
    return c.redirect(`/past-papers?subject=${encodeURIComponent(subject)}`)
})

app.post('/past-papers/questions', async (c) => {
    const user = await getUser(c)
    if (!user || user.permission_level < 3) return c.text("Unauthorized", 401)

    try {
        const body = await c.req.parseBody()
        const subject = body['subject'] as string
        const topicId = body['topic_id'] as string
        const paperTag = body['paper_tag'] as string || null
        const qImage = body['question_image'] as File
        const aImage = body['answer_image'] as File // Optional

        if (!qImage || !subject || !topicId) return c.text('Missing required fields', 400)

        // Upload Question Image
        const qKey = `questions/${Date.now()}-q-${Math.random().toString(36).slice(2)}`
        await c.env.BUCKET.put(qKey, qImage)

        // Upload Answer Image (if exists)
        let aKey = null
        if (aImage && aImage.size > 0 && aImage.name !== 'undefined') {
            aKey = `questions/${Date.now()}-a-${Math.random().toString(36).slice(2)}`
            await c.env.BUCKET.put(aKey, aImage)
        }

        await c.env.DB.prepare('INSERT INTO questions (topic_id, question_image_key, answer_image_key, uploader_id, paper_tag) VALUES (?, ?, ?, ?, ?)')
            .bind(topicId, qKey, aKey, user.id, paperTag)
            .run()

        // Redirect back to the Subject page to facilitate rapid uploading (or maybe topic page? User said "efficiency" which implies uploading multiple. Staying on subject page where form is might be better, but user might want to see it. 
        // User said: "when uploading user select".
        // Let's redirect to Topic page so they can verify, OR redirect to Subject page so they can do another one? 
        // The form is on the Subject page now. So redirecting to Subject page makes sense for "Rapid Batch Upload".
        return c.redirect(`/past-papers?subject=${encodeURIComponent(subject)}`)
    } catch (e: any) {
        return c.text(`Upload Failed: ${e.message}`, 500)
    }
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