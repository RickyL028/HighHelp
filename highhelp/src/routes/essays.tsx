import { Hono } from 'hono'
import { Layout } from '../layout'
import { getUser, updatePoints, renderTags } from '../utils'
import { SubjectSelector } from '../components/SubjectSelector'
import { Bindings, User } from '../types'
import { SUBJECTS } from '../constants'

const app = new Hono<{ Bindings: Bindings }>()

// 1. Landing / Subject List
app.get('/essays', async (c) => {
    const user = await getUser(c) as User | null
    const subject = c.req.query('subject')

    // View: Recent Essays (Global)
    if (!subject) {
        const { results: recentEssays } = await c.env.DB.prepare(`
            SELECT e.*, 
            (SELECT COUNT(*) FROM essay_comments c WHERE c.essay_id = e.id) as feedback_count
            FROM essays e 
            ORDER BY e.created_at DESC 
            LIMIT 10
        `).all()

        return c.html(
            <Layout title="Essay Exchange" user={user}>
                <div class="max-w-4xl mx-auto space-y-12">
                    <section>
                        <div class="flex justify-between items-center mb-6">
                            <h1 class="text-3xl font-bold">Essay Exchange</h1>
                            {user ? (
                                <a href="/essays/create" class="bg-blue-600 text-white px-4 py-2 rounded font-bold hover:bg-blue-700 transition shadow-sm">
                                    + Submit Essay
                                </a>
                            ) : null}
                        </div>

                        <div class="space-y-4">
                            {recentEssays?.length === 0 ? (
                                <p class="text-gray-500 italic">No essays submitted yet.</p>
                            ) : (
                                recentEssays?.map((e: any) => (
                                    <div class="bg-white p-4 rounded shadow-sm border border-gray-200 hover:border-blue-400 transition group block">
                                        <div class="flex justify-between items-start">
                                            <div class="flex-grow">
                                                <div class="flex items-center gap-2 mb-1">
                                                    <span class="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full font-medium border border-blue-100">{e.subject}</span>
                                                    <span class="text-xs text-gray-400">• {new Date(e.created_at).toLocaleDateString()}</span>
                                                </div>
                                                <a href={`/essays/view/${e.id}`} class="block">
                                                    <h3 class="text-lg font-bold text-gray-800 group-hover:text-blue-600">{e.title}</h3>
                                                </a>
                                                <p class="text-sm text-gray-600 mt-1 line-clamp-2">By -</p>
                                            </div>
                                            <div class="flex flex-col items-end min-w-[60px]">
                                                <span class="flex items-center gap-1 text-gray-500 text-sm">
                                                    📝 {e.feedback_count}
                                                </span>
                                                {e.full_marks ? (
                                                    <span class="text-xs text-gray-400 mt-1">/{e.full_marks} Marks</span>
                                                ) : null}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </section>

                    <hr class="border-gray-200" />

                    <section>
                        <h2 class="text-xl font-bold mb-4">Browse by Subject</h2>
                        <SubjectSelector baseUrl="/essays" type="essay" />
                    </section>
                </div>
            </Layout>
        )
    }

    // View: Subject Specific
    const { results } = await c.env.DB.prepare(`
        SELECT e.*,
        (SELECT COUNT(*) FROM essay_comments c WHERE c.essay_id = e.id) as feedback_count
        FROM essays e 
        WHERE e.subject = ? 
        ORDER BY e.created_at DESC
    `).bind(subject).all()

    return c.html(
        <Layout title={`${subject} Essays`} user={user}>
            <div class="max-w-4xl mx-auto">
                <div class="flex items-center justify-between mb-6">
                    <div>
                        <h1 class="text-3xl font-bold">{subject} Essays</h1>
                        <a href="/essays" class="text-blue-600 hover:underline text-sm">← All Subjects</a>
                    </div>
                    {user ? (
                        <a href={`/essays/create?subject=${encodeURIComponent(subject)}`} class="bg-blue-600 text-white px-4 py-2 rounded font-bold hover:bg-blue-700 transition shadow-sm">
                            + Submit Essay
                        </a>
                    ) : null}
                </div>

                <div class="space-y-4">
                    {results?.length === 0 ? (
                        <div class="bg-gray-50 p-8 text-center rounded border border-dashed border-gray-300">
                            <p class="text-gray-500 mb-2">No essays in {subject} yet.</p>
                            {user ? (
                                <a href={`/essays/create?subject=${encodeURIComponent(subject)}`} class="text-blue-600 font-medium hover:underline">Submit an essay</a>
                            ) : (
                                <a href="/login" class="text-blue-600 font-medium hover:underline">Log in to participate</a>
                            )}
                        </div>
                    ) : (
                        results.map((e: any) => (
                            <div class="bg-white p-4 rounded shadow-sm border border-gray-200 hover:border-blue-400 transition group">
                                <div class="flex justify-between items-start">
                                    <div class="flex-grow">
                                        <div class="flex items-center gap-2 mb-1">
                                            <span class="text-xs text-gray-400">{new Date(e.created_at).toLocaleDateString()}</span>
                                        </div>
                                        <a href={`/essays/view/${e.id}`} class="block">
                                            <h3 class="text-lg font-bold text-gray-800 group-hover:text-blue-600">{e.title}</h3>
                                        </a>
                                        <p class="text-sm text-gray-600 mt-1">By -</p>
                                    </div>
                                    <div class="flex flex-col items-end min-w-[60px]">
                                        <span class="flex items-center gap-1 text-gray-500 text-sm">
                                            📝 {e.feedback_count}
                                        </span>
                                        {e.full_marks ? (
                                            <span class="text-xs text-gray-400 mt-1">/{e.full_marks} Marks</span>
                                        ) : null}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </Layout>
    )
})

// 2. Submit Essay Page
app.get('/essays/create', async (c) => {
    const user = await getUser(c)
    if (!user) return c.redirect('/login')

    // Check Points
    if (user.points < 0) {
        return c.html(
            <Layout title="Insufficient Points" user={user}>
                <div class="max-w-md mx-auto bg-white p-8 rounded-lg shadow-md border border-gray-200 text-center">
                    <div class="text-yellow-500 text-5xl mb-4">Ooops</div>
                    <h1 class="text-2xl font-bold mb-2 text-gray-900">Insufficient Contribution</h1>
                    <p class="text-gray-600 mb-6">You need a positive contribution to participate in this section. You currently have {user.points || 0} contributions.</p>
                    <p class="text-sm text-gray-500 mb-6">Note the only purpose of this contribution system is to prevent over-dependence. Hence, we did not expect, or hope anyone seeing this prompt. Contribute by uploading resources, answering Q&As, or responding to others </p>
                    <a href="/resources" class="bg-blue-600 text-white px-6 py-2 rounded font-bold hover:bg-blue-700 transition">Go to Resources</a>
                </div>
            </Layout>
        )
    }

    const preselectedSubject = c.req.query('subject') || ""

    return c.html(
        <Layout title="Submit Response" user={user}>
            <div class="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow-md border border-gray-200">
                <h1 class="text-2xl font-bold mb-2 text-gray-900">Submit Response</h1>
                <p class="text-gray-500 mb-6 text-sm">Your submission will be anonymous.</p>

                <form action="/essays" method="post" enctype="multipart/form-data" class="space-y-6">
                    <div>
                        <label class="block text-sm font-bold text-gray-700 mb-1">Title</label>
                        <input type="text" name="title" required placeholder="Your essay's title, or its topic e.g. Macbeth" class="w-full rounded-md border-gray-300 shadow-sm p-3 border focus:ring-blue-500 focus:border-blue-500" />
                    </div>

                    <div>
                        <label class="block text-sm font-bold text-gray-700 mb-1">Subject</label>
                        <select name="subject" required class="w-full rounded-md border-gray-300 shadow-sm p-3 border focus:ring-blue-500 focus:border-blue-500 bg-white">
                            <option value="" disabled selected={!preselectedSubject}>Select a Subject</option>
                            {SUBJECTS.map(s => (
                                <option value={s} selected={s === preselectedSubject}>{s}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label class="block text-sm font-bold text-gray-700 mb-1">Question / Prompt (Required)</label>
                        <textarea name="question" required rows={3} placeholder="What was the question?" class="w-full rounded-md border-gray-300 shadow-sm p-3 border focus:ring-blue-500 focus:border-blue-500"></textarea>
                    </div>

                    <div>
                        <label class="block text-sm font-bold text-gray-700 mb-1">Full Marks</label>
                        <input type="number" name="full_marks" placeholder="e.g. 20" class="w-full rounded-md border-gray-300 shadow-sm p-3 border focus:ring-blue-500 focus:border-blue-500" />
                    </div>

                    <div class="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                        <label class="block text-sm font-bold text-gray-700 mb-2">Essay Content</label>
                        <p class="text-xs text-gray-500 mb-3">You can paste text OR upload a file (PDF/Docx).</p>

                        <div class="mb-4">
                            <label class="block text-xs font-bold text-gray-500 mb-1">Option 1: Paste Text</label>
                            <textarea name="content" rows={6} placeholder="Paste your essay here..." class="w-full rounded-md border-gray-300 shadow-sm p-3 border focus:ring-blue-500 focus:border-blue-500"></textarea>
                        </div>

                        <div>
                            <label class="block text-xs font-bold text-gray-500 mb-1">Option 2: Upload File</label>
                            <input
                                type="file"
                                name="file"
                                class="block w-full text-sm text-gray-500"
                                accept=".pdf,.doc,.docx,.txt"
                                onchange="if(this.files[0].size > 26214400){ alert('File is too big! Max size is 25MB.'); this.value = ''; }"
                            />
                        </div>
                    </div>

                    <div class="flex items-center justify-end gap-4">
                        <a href="/essays" class="text-gray-500 hover:text-gray-700">Cancel</a>
                        <button type="submit" class="bg-blue-600 text-white px-6 py-2 rounded-md font-bold hover:bg-blue-700 transition">
                            Submit (-1 Point)
                        </button>
                    </div>
                </form>
            </div>
        </Layout>
    )
})

// 3. Handle Create Essay
app.post('/essays', async (c) => {
    const user = await getUser(c)
    if (!user) return c.redirect('/login')

    if (user.points < 0) {
        return c.text("Insufficient points", 403)
    }

    try {
        const body = await c.req.parseBody()
        const title = body['title'] as string
        const subject = body['subject'] as string
        const question = body['question'] as string
        const fullMarks = body['full_marks'] ? parseFloat(body['full_marks'] as string) : null
        const content = body['content'] as string || ""
        const file = body['file'] as File

        if (title && subject && question) {
            let fileKey = null;

            // Handle File Upload
            if (file && file.size > 0 && file.name !== 'undefined') {
                const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
                fileKey = `essays/${Date.now()}-${safeName}`
                await c.env.BUCKET.put(fileKey, file)
            }

            // Must have either content or file
            if (!content && !fileKey) {
                return c.text("Please provide either essay text or a file.", 400)
            }

            // Deduct 1 point
            await updatePoints(user.id, -1, c.env.DB);

            // Create Essay
            await c.env.DB.prepare('INSERT INTO essays (title, content, author_id, subject, question, full_marks, file_key) VALUES (?, ?, ?, ?, ?, ?, ?)')
                .bind(title, content, user.id, subject, question, fullMarks, fileKey)
                .run()
        }

        return c.redirect(`/essays?subject=${encodeURIComponent(subject)}`)
    } catch (e: any) {
        return c.text(`Upload Failed: ${e.message}`, 500)
    }
})

// 4. View Essay
app.get('/essays/view/:id', async (c) => {
    const user = await getUser(c)
    const essayId = c.req.param('id')

    // Fetch Essay
    const essay = await c.env.DB.prepare(`
        SELECT * FROM essays WHERE id = ?
    `).bind(essayId).first<any>()

    if (!essay) {
        return c.text('Essay not found', 404)
    }

    // Fetch Feedback
    const { results: comments } = await c.env.DB.prepare(`
        SELECT c.*, u.first_name, u.last_name, u.tags 
        FROM essay_comments c 
        LEFT JOIN users u ON c.author_id = u.id 
        WHERE c.essay_id = ? 
        ORDER BY c.created_at ASC
    `).bind(essayId).all()

    return c.html(
        <Layout title={essay.title} user={user}>
            <div class="max-w-4xl mx-auto">
                <div class="mb-4">
                    <a href={`/essays?subject=${encodeURIComponent(essay.subject)}`} class="text-blue-600 hover:underline text-sm">← Back to {essay.subject}</a>
                </div>

                {/* Essay Container */}
                <div class="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden mb-8">
                    <div class="p-6 border-b border-gray-100">
                        <div class="flex items-center gap-2 mb-2">
                            <span class="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">Essay</span>
                            <span class="text-gray-400 text-sm">| {new Date(essay.created_at).toLocaleString()}</span>
                            {essay.full_marks && (
                                <span class="text-gray-500 text-sm font-medium ml-auto">Full Marks: {essay.full_marks}</span>
                            )}
                        </div>

                        <h1 class="text-3xl font-bold text-gray-900 mb-2">{essay.title}</h1>

                        {essay.question && (
                            <div class="bg-brown-300 border border-brown-100 p-3 rounded mb-6 text-gray-700 italic text-sm">
                                <span class="font-bold text-brown-600 not-italic">Question:</span> {essay.question}
                            </div>
                        )}

                        {/* File Download */}
                        {essay.file_key && (
                            <div class="mb-1">
                                <a href={`/download/${essay.file_key}`} target="_blank" class="inline-flex items-center bg-blue-100 text-blue-800 px-4 py-2 rounded hover:bg-blue-200 transition font-sm">
                                    Download Essay File
                                </a>
                            </div>
                        )}

                        {/* Text Content */}
                        {essay.content && (
                            <div class="p-4 bg-gray-50 rounded border border-gray-200 font-serif whitespace-pre-wrap leading-relaxed">
                                {essay.content}
                            </div>
                        )}
                    </div>

                    <div class="bg-gray-50 px-6 py-3 flex items-center justify-between">
                        <div class="text-sm text-gray-600 flex items-center">
                            <span class="font-bold mr-1">Posted by:</span> -
                        </div>
                    </div>
                </div>

                {/* Feedback Section */}
                <div class="mb-8">
                    <h2 class="text-xl font-bold text-gray-900 mb-4">{comments?.length || 0} Feedback Items</h2>

                    <div class="space-y-4">
                        {comments?.map((comment: any) => (
                            <div class="bg-white p-4 rounded-lg shadow-sm border border-gray-200 relative">
                                <div class="flex justify-between items-start mb-2">
                                    <div class="flex items-center gap-2">
                                        <span class="font-bold text-gray-800">{comment.first_name ? `${comment.first_name} ${comment.last_name}` : 'Unknown'}</span>
                                        <span dangerouslySetInnerHTML={{ __html: renderTags(comment.tags) }}></span>
                                    </div>
                                    <div class="text-right">
                                        <div class="text-xs text-gray-400 mb-1">{new Date(comment.created_at).toLocaleString()}</div>
                                        {comment.grade !== null && (
                                            <span class="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded font-bold border border-blue-200">
                                                Grade: {comment.grade} {essay.full_marks ? `/ ${essay.full_marks}` : ''}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <p class="text-gray-700 whitespace-pre-wrap">{comment.content}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Add Feedback Form */}
                {user ? (
                    <div class="bg-blue-50 p-6 rounded-lg border border-blue-100">
                        <h3 class="text-lg font-bold text-blue-900 mb-2">Respond</h3>

                        <form action="/essays/feedback" method="post">
                            <input type="hidden" name="essay_id" value={essayId} />

                            <div class="mb-4">
                                <label class="block text-sm font-bold text-blue-900 mb-1">Grade</label>
                                <input type="number" step="0.5" name="grade" placeholder={essay.full_marks ? `Out of ${essay.full_marks}` : 'Score'} class="w-32 rounded-md border-blue-200 shadow-sm p-2 border focus:ring-blue-500 focus:border-blue-500" />
                            </div>

                            <textarea name="content" required rows={4} class="w-full rounded-md border-blue-200 shadow-sm p-3 border focus:ring-blue-500 focus:border-blue-500 mb-4" placeholder="Write your feedback here..."></textarea>
                            <div class="text-right">
                                <button type="submit" class="bg-blue-600 text-white px-6 py-2 rounded font-bold hover:bg-blue-700 transition">
                                    Submit Feedback
                                </button>
                            </div>
                        </form>
                    </div>
                ) : (
                    <div class="bg-gray-100 p-6 rounded-lg text-center">
                        <p class="text-gray-600 mb-2">To participate</p>
                        <a href="/login" class="text-blue-600 font-bold hover:underline">Log in</a>
                    </div>
                )}

            </div>
        </Layout>
    )
})

// 5. Handle Feedback
app.post('/essays/feedback', async (c) => {
    const user = await getUser(c)
    if (!user) return c.redirect('/login')

    const body = await c.req.parseBody()
    const essayId = body['essay_id'] as string
    const content = body['content'] as string
    const grade = body['grade'] ? parseFloat(body['grade'] as string) : null

    if (essayId && content) {
        await c.env.DB.prepare('INSERT INTO essay_comments (essay_id, content, author_id, grade) VALUES (?, ?, ?, ?)')
            .bind(essayId, content, user.id, grade)
            .run()

        // Award +1 point for feedback
        await updatePoints(user.id, 1, c.env.DB);
    }

    return c.redirect(`/essays/view/${essayId}`)
})

export default app
