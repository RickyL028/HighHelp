import { Hono } from 'hono'
import { Layout } from '../layout'
import { getUser, renderTags } from '../utils'
import { SubjectSelector } from '../components/SubjectSelector'
import { Bindings } from '../types'

const app = new Hono<{ Bindings: Bindings }>()

app.get('/past-papers', async (c) => {
    const user = await getUser(c)
    const subject = c.req.query('subject')
    const topicIdStr = c.req.query('topic_id')

    // 1. Landing Page (No Subject) -> Show Recent Questions + Subject Selector at Bottom
    if (!subject) {
        // Fetch recent questions globally
        const { results: recentQuestions } = await c.env.DB.prepare(`
            SELECT q.*, t.name as topic_name, t.subject, u.first_name, u.last_name, u.tags 
            FROM questions q 
            LEFT JOIN topics t ON q.topic_id = t.id 
            LEFT JOIN users u ON q.uploader_id = u.id 
            ORDER BY q.created_at DESC 
            LIMIT 5
        `).all()

        return c.html(
            <Layout title="Past Papers" user={user}>
                <div class="max-w-4xl mx-auto space-y-12">

                    {/* Recent Questions Section */}
                    <section>
                        <h1 class="text-3xl font-bold mb-6">Recent Additions</h1>
                        <div class="space-y-4">
                            {recentQuestions?.length === 0 ? (
                                <p class="text-gray-500 italic">No questions added recently.</p>
                            ) : (
                                recentQuestions?.map((q: any) => (
                                    <div class="bg-white p-4 rounded shadow-sm border border-gray-200 border-l-4 border-l-blue-500 overflow-hidden">
                                        <div class="flex justify-between items-start mb-2">
                                            <div class="flex items-center gap-2">
                                                <span class="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full font-medium">{q.subject}</span>
                                                <span class="text-sm font-bold text-gray-700">{q.topic_name}</span>
                                            </div>
                                            <span class="text-xs text-gray-400">{new Date(q.created_at).toLocaleDateString()}</span>
                                        </div>

                                        <div class="flex gap-4">
                                            <div class="w-24 h-24 flex-shrink-0 bg-gray-100 rounded border border-gray-200 overflow-hidden">
                                                <img src={`/download/${q.question_image_key}`} class="w-full h-full object-cover opacity-80" />
                                            </div>
                                            <div class="flex-grow">
                                                <p class="text-sm text-gray-600 mb-2">
                                                    Uploaded by {q.first_name ? `${q.first_name} ${q.last_name}` : 'Unknown'}
                                                    <span class="ml-2" dangerouslySetInnerHTML={{ __html: renderTags(q.tags) }}></span>
                                                </p>
                                                {q.paper_tag && (
                                                    <span class="inline-block bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded border border-gray-200">
                                                        {q.paper_tag}
                                                    </span>
                                                )}
                                                <div class="mt-2">
                                                    <a href={`/past-papers?subject=${encodeURIComponent(q.subject)}&topic_id=${q.topic_id}`} class="text-blue-600 text-sm font-medium hover:underline">
                                                        View Question →
                                                    </a>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </section>

                    <hr class="border-gray-200" />

                    {/* Subject Selector at Bottom */}
                    <section>
                        <h2 class="text-xl font-bold mb-4">Browse by Subject</h2>
                        <SubjectSelector baseUrl="/past-papers" type="standard" />
                    </section>
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
        SELECT q.*, u.first_name, u.last_name, u.tags 
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
                                    <span class="text-xs text-gray-400 flex items-center">
                                        Uploaded by {q.first_name} {q.last_name}
                                        <span class="ml-2" dangerouslySetInnerHTML={{ __html: renderTags(q.tags) }}></span>
                                    </span>
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

        return c.redirect(`/past-papers?subject=${encodeURIComponent(subject)}`)
    } catch (e: any) {
        return c.text(`Upload Failed: ${e.message}`, 500)
    }
})

export default app
