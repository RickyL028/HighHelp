import { Hono } from 'hono'
import { Layout } from '../layout'
import { getUser, renderTags, logAction } from '../utils'
import { canUploadPastPaper, canCreateTopic, canModerateSubject, canViewDeleted } from '../permissions'
import { SubjectSelector } from '../components/SubjectSelector'
import { Bindings } from '../types'

const app = new Hono<{ Bindings: Bindings }>()

// Helper to generate paper name
function generatePaperName(school: string, year: number) {
    return `${school} ${year} HSC Trial`; // simplified default format
}

app.get('/past-papers', async (c) => {
    const user = await getUser(c)
    const subject = c.req.query('subject')

    // 1. Landing Page -> Subject Selector
    if (!subject) {
        // Fetch recent papers globally
        const recentPapers = await c.env.DB.prepare(`
            SELECT p.*, count(q.id) as question_count 
            FROM papers p 
            LEFT JOIN exam_questions q ON p.id = q.paper_id 
            GROUP BY p.id 
            ORDER BY p.created_at DESC 
            LIMIT 5
        `).all();

        return c.html(
            <Layout title="Past Papers" user={user}>
                <div class="mx-auto space-y-12">
                    <section>
                        <h1 class="text-3xl font-bold mb-6">Past Paper Bank</h1>
                        <p class="text-gray-600 mb-8">Select a subject to browse structured past papers.</p>
                        <SubjectSelector baseUrl="/past-papers" type="standard" />
                    </section>
                </div>
            </Layout>
        )
    }

    // 2. Subject View -> List Papers
    const papers = await c.env.DB.prepare('SELECT * FROM papers WHERE subject = ? ORDER BY academic_year DESC, created_at DESC').bind(subject).all();
    const canUpload = user && canUploadPastPaper(user, subject);

    return c.html(
        <Layout title={`Past Papers - ${subject}`} user={user}>
            <div class="mx-auto">
                <div class="flex items-center justify-between mb-6">
                    <div>
                        <div class="flex items-center gap-2 text-sm text-gray-500 mb-1">
                            <a href="/past-papers" class="hover:underline">Past Papers</a>
                            <span>/</span>
                        </div>
                        <h1 class="text-3xl font-bold">{subject}</h1>
                    </div>
                    {canUpload && (
                        <a href={`/past-papers/create?subject=${encodeURIComponent(subject)}`} class="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700 shadow-sm transition">
                            + Add New Paper
                        </a>
                    )}
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {papers.results.length === 0 ? (
                        <div class="col-span-full text-center py-12 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                            No papers found for {subject}.
                        </div>
                    ) : (
                        papers.results.map((p: any) => (
                            <a href={`/past-papers/paper/${p.id}`} class="block bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md hover:border-blue-400 transition group">
                                <div class="flex justify-between items-start mb-4">
                                    <div class="bg-blue-50 text-blue-800 text-xs font-bold px-2 py-1 rounded uppercase tracking-wide">
                                        {p.academic_year}
                                    </div>
                                </div>
                                <h3 class="text-xl font-bold text-gray-900 group-hover:text-blue-700 mb-2">
                                    {p.school_name}
                                </h3>
                                <p class="text-sm text-gray-500">
                                    Trial Paper
                                </p>
                            </a>
                        ))
                    )}
                </div>
            </div>
        </Layout>
    )
})

// Create Paper Form
app.get('/past-papers/create', async (c) => {
    const user = await getUser(c)
    const subject = c.req.query('subject')
    if (!subject || !user || !canUploadPastPaper(user, subject)) return c.redirect('/past-papers')

    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: currentYear - 1990 + 1 }, (_, i) => currentYear - i);

    return c.html(
        <Layout title={`Add Paper - ${subject}`} user={user}>
            <div class="max-w-2xl mx-auto">
                <div class="mb-6">
                    <a href={`/past-papers?subject=${encodeURIComponent(subject)}`} class="text-sm text-gray-500 hover:underline">← Back to {subject}</a>
                    <h1 class="text-2xl font-bold mt-2">Add New Past Paper</h1>
                </div>

                <form action="/past-papers/create" method="post" class="bg-white p-8 rounded-xl shadow-sm border border-gray-200 space-y-6">
                    <input type="hidden" name="subject" value={subject} />

                    <div>
                        <label class="block text-sm font-bold text-gray-700 mb-1">School Name</label>
                        <input type="text" name="school_name" required placeholder="e.g. Sydney Boys High School" class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-bold text-gray-700 mb-1">Year</label>
                            <select name="academic_year" class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
                                {years.map(y => <option value={y}>{y}</option>)}
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-bold text-gray-700 mb-1">Reference Link (Optional)</label>
                            <input type="url" name="reference_link" placeholder="https://..." class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
                        </div>
                    </div>

                    <div class="border-t border-gray-100 pt-6">
                        <h3 class="text-lg font-bold mb-4">Structure</h3>
                        <p class="text-sm text-gray-500 mb-4">Define the structure to auto-generate placeholder questions.</p>

                        <div id="segments-container" class="space-y-4">
                            {/* Default Segment 1 */}
                            <div class="grid grid-cols-12 gap-4 items-end bg-gray-50 p-4 rounded-lg">
                                <div class="col-span-4">
                                    <label class="block text-xs font-bold text-gray-500 uppercase">Section</label>
                                    <input type="text" name="segments[0][section]" value="I" placeholder="I, II, III" class="w-full mt-1 rounded border-gray-300 text-sm" />
                                </div>
                                <div class="col-span-4">
                                    <label class="block text-xs font-bold text-gray-500 uppercase">Segment (Optional)</label>
                                    <input type="text" name="segments[0][label]" value="A" placeholder="A, B, C" class="w-full mt-1 rounded border-gray-300 text-sm" />
                                </div>
                                <div class="col-span-4">
                                    <label class="block text-xs font-bold text-gray-500 uppercase"># Questions</label>
                                    <input type="number" name="segments[0][count]" value="10" min="1" class="w-full mt-1 rounded border-gray-300 text-sm" />
                                </div>
                            </div>
                        </div>

                        <button type="button" id="add-segment-btn" class="mt-4 text-sm text-blue-600 font-bold hover:underline">+ Add Another Segment</button>
                    </div>

                    <div class="pt-4">
                        <button type="submit" class="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition">Create Paper & Placeholders</button>
                    </div>
                </form>

                <script dangerouslySetInnerHTML={{
                    __html: `
                    let segmentCount = 1;
                    document.getElementById('add-segment-btn').addEventListener('click', () => {
                        const div = document.createElement('div');
                        div.className = 'grid grid-cols-12 gap-4 items-end bg-gray-50 p-4 rounded-lg';
                        div.innerHTML = \`
                            <div class="col-span-4">
                                <label class="block text-xs font-bold text-gray-500 uppercase">Section</label>
                                <input type="text" name="segments[\${segmentCount}][section]" placeholder="I, II" class="w-full mt-1 rounded border-gray-300 text-sm" />
                            </div>
                            <div class="col-span-4">
                                <label class="block text-xs font-bold text-gray-500 uppercase">Segment</label>
                                <input type="text" name="segments[\${segmentCount}][label]" placeholder="A, B" class="w-full mt-1 rounded border-gray-300 text-sm" />
                            </div>
                            <div class="col-span-4">
                                <label class="block text-xs font-bold text-gray-500 uppercase"># Questions</label>
                                <input type="number" name="segments[\${segmentCount}][count]" value="5" min="1" class="w-full mt-1 rounded border-gray-300 text-sm" />
                            </div>
                        \`;
                        document.getElementById('segments-container').appendChild(div);
                        segmentCount++;
                    });
                `}} />
            </div>
        </Layout>
    )
})

// Process Create Paper
app.post('/past-papers/create', async (c) => {
    const user = await getUser(c)
    const body = await c.req.parseBody()
    const subject = body['subject'] as string

    if (!user || !canUploadPastPaper(user, subject)) return c.redirect('/past-papers')

    const school = body['school_name'] as string;
    const year = parseInt(body['academic_year'] as string);
    const link = body['reference_link'] as string;

    // Insert Paper
    const paperRes = await c.env.DB.prepare('INSERT INTO papers (subject, school_name, academic_year, reference_link) VALUES (?, ?, ?, ?) RETURNING id')
        .bind(subject, school, year, link)
        .first<{ id: number }>(); // FIX: Added type generic to first()

    // FIX: Handle possible null result
    if (!paperRes) {
        return c.text('Failed to create paper', 500);
    }

    const paperId = paperRes.id;

    // Process placeholders
    const statements = [];

    for (let i = 0; i < 20; i++) {
        // FIX: Cast body values to string, as they are string | File
        const section = body[`segments[${i}][section]`] as string;
        const label = body[`segments[${i}][label]`] as string;
        const count = parseInt((body[`segments[${i}][count]`] as string) || '0');

        if (section && count > 0) {
            // Create questions
            for (let q = 1; q <= count; q++) {
                const qNum = label ? `${label}${q}` : `${q}`;
                const fullLabel = label ? `${section} ${label}${q}` : `${section} ${q}`;

                statements.push(
                    c.env.DB.prepare(`
                        INSERT INTO exam_questions 
                        (paper_id, section_label, segment_label, question_number, question_full_label, uploader_id)
                        VALUES (?, ?, ?, ?, ?, ?)
                    `).bind(paperId, section, label || null, qNum, fullLabel, user.id)
                );
            }
        }
    }

    if (statements.length > 0) {
        await c.env.DB.batch(statements);
    }

    await logAction(c.env.DB, user.id, 'CREATE_PAPER', `Created paper ${school} ${year}`, paperId as number, 'papers');

    return c.redirect(`/past-papers/paper/${paperId}`);
});

// View Paper
app.get('/past-papers/paper/:id', async (c) => {
    const user = await getUser(c)
    const paperId = c.req.param('id')

    // Fetch paper
    // FIX: Typed as <any> to prevent 'unknown' errors in template literals below
    const paper = await c.env.DB.prepare('SELECT * FROM papers WHERE id = ?').bind(paperId).first<any>();
    if (!paper) return c.notFound();

    // Fetch questions + topics
    const questions = await c.env.DB.prepare(`
        SELECT q.*, group_concat(t.name, ', ') as topic_names, group_concat(t.id, ',') as topic_ids
        FROM exam_questions q
        LEFT JOIN question_topics qt ON q.id = qt.question_id
        LEFT JOIN topics t ON qt.topic_id = t.id
        WHERE q.paper_id = ? AND q.is_deleted = 0
        GROUP BY q.id
        ORDER BY q.id ASC
    `).bind(paperId).all();

    // Fetch all topics for dropdown
    const allTopics = await c.env.DB.prepare('SELECT * FROM topics WHERE subject = ? ORDER BY name ASC').bind(paper.subject).all();

    const canEdit = user && canUploadPastPaper(user, paper.subject);

    return c.html(
        <Layout title={`${paper.school_name} ${paper.academic_year}`} user={user}>
            <div class="mx-auto max-w-5xl">
                <div class="mb-6 flex justify-between items-start">
                    <div>
                        <div class="flex items-center gap-2 text-sm text-gray-500 mb-1">
                            <a href="/past-papers" class="hover:underline">Papers</a>
                            <span>/</span>
                            {/* FIX: paper.subject is now typed via first<any> */}
                            <a href={`/past-papers?subject=${encodeURIComponent(paper.subject)}`} class="hover:underline">{paper.subject}</a>
                            <span>/</span>
                        </div>
                        <h1 class="text-3xl font-bold">{paper.school_name} {paper.academic_year}</h1>
                        {paper.reference_link && <a href={paper.reference_link} target="_blank" class="text-blue-600 hover:underline text-sm">View Reference PDF ↗</a>}
                    </div>
                </div>

                <div class="space-y-4">
                    {questions.results.map((q: any) => (
                        <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden" id={`q-${q.id}`}>
                            {/* Header / Summary Mode */}
                            <div class="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition" onclick={`toggleEdit(${q.id})`}>
                                <div class="flex items-center gap-4">
                                    <span class="font-mono text-gray-500 font-bold w-16 text-right">{q.section_label} {q.question_number}</span>

                                    <div class="flex flex-col">
                                        <div class="flex items-center gap-2">
                                            {q.question_type === 'multiple_choice' && <span class="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded font-bold">MC</span>}
                                            {q.marks && <span class="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded font-bold">{q.marks}m</span>}
                                        </div>
                                        {q.topic_names ? (
                                            <span class="text-sm font-medium text-blue-800">{q.topic_names}</span>
                                        ) : (
                                            <span class="text-sm text-gray-400 italic">No topics tagged</span>
                                        )}
                                    </div>
                                </div>

                                <div class="flex items-center gap-4">
                                    {q.question_image_key ? <span class="text-green-600 text-xs font-bold">✓ Has Image</span> : <span class="text-red-400 text-xs">No Image</span>}
                                    <span class="text-gray-400">▼</span>
                                </div>
                            </div>

                            {/* Edit / Detail Mode (Hidden by default) */}
                            <div id={`detail-${q.id}`} class="hidden border-t border-gray-100 bg-gray-50 p-6">
                                {canEdit ? (
                                    <form action={`/past-papers/question/${q.id}/update`} method="post" enctype="multipart/form-data" class="space-y-6">
                                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {/* Left Column: Metadata */}
                                            <div class="space-y-4">
                                                <div>
                                                    <label class="block text-xs font-bold text-gray-500 uppercase">Topics</label>
                                                    {/* FIX: size attribute expects number in JSX */}
                                                    <select name="topic_ids" multiple size={4} class="w-full mt-1 rounded border-gray-300 text-sm">
                                                        {allTopics.results.map((t: any) => (
                                                            <option value={t.id} selected={q.topic_ids?.split(',').includes(String(t.id))}>{t.name}</option>
                                                        ))}
                                                    </select>
                                                    <p class="text-xs text-gray-400 mt-1">Cmd/Ctrl+Click to select multiple</p>
                                                </div>

                                                <div class="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <label class="block text-xs font-bold text-gray-500 uppercase">Type</label>
                                                        <select name="question_type" class="w-full mt-1 rounded border-gray-300 text-sm">
                                                            <option value="multiple_choice" selected={q.question_type === 'multiple_choice'}>Multiple Choice</option>
                                                            <option value="short_answer" selected={q.question_type === 'short_answer'}>Short Answer</option>
                                                            <option value="extended_response" selected={q.question_type === 'extended_response'}>Extended Response</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label class="block text-xs font-bold text-gray-500 uppercase">Marks</label>
                                                        <input type="number" name="marks" value={q.marks} class="w-full mt-1 rounded border-gray-300 text-sm" />
                                                    </div>
                                                    {q.question_type === 'multiple_choice' && (
                                                        <div>
                                                            <label class="block text-xs font-bold text-gray-500 uppercase">Correct Answer</label>
                                                            <select name="mc_answer" class="w-full mt-1 rounded border-gray-300 text-sm">
                                                                {['A', 'B', 'C', 'D'].map(opt => (
                                                                    <option value={opt} selected={q.mc_answer === opt}>{opt}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    )}
                                                </div>
                                                <button type="submit" class="bg-blue-600 text-white text-sm font-bold px-4 py-2 rounded shadow hover:bg-blue-700">Save Changes</button>
                                            </div>

                                            {/* Right Column: Images */}
                                            <div class="space-y-4">
                                                {['question', 'answer', 'stimulus'].map(type => (
                                                    <div class="bg-white p-3 rounded border border-gray-200">
                                                        <div class="flex justify-between items-center mb-2">
                                                            <label class="text-xs font-bold text-gray-500 uppercase">{type} Image</label>
                                                            <button type="button" onclick={`pasteImage('file-${type}-${q.id}', '${type}-preview-${q.id}')`} class="text-xs bg-gray-100 px-2 py-1 rounded hover:bg-gray-200 text-blue-600 font-bold">📋 Paste</button>
                                                        </div>

                                                        {q[`${type}_image_key`] && (
                                                            <img src={`/download/${q[`${type}_image_key`]}`} class="max-h-32 object-contain mb-2 border rounded" />
                                                        )}

                                                        <input type="file" name={`${type}_image`} id={`file-${type}-${q.id}`} accept="image/*" class="block w-full text-xs text-gray-500" />
                                                        <img id={`${type}-preview-${q.id}`} class="max-h-32 object-contain mt-2 hidden border rounded bg-gray-50" />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </form>
                                ) : (
                                    <div class="flex gap-4">
                                        {q.question_image_key && <img src={`/download/${q.question_image_key}`} class="max-w-md border rounded" />}
                                        {q.answer_image_key && <img src={`/download/${q.answer_image_key}`} class="max-w-md border rounded border-green-200" />}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <script dangerouslySetInnerHTML={{
                __html: `
                function toggleEdit(id) {
                    const el = document.getElementById('detail-' + id);
                    el.classList.toggle('hidden');
                }

                async function pasteImage(inputId, previewId) {
                    try {
                        const items = await navigator.clipboard.read();
                        for (const item of items) {
                            if (item.types.some(type => type.startsWith('image/'))) {
                                const blob = await item.getType(item.types.find(type => type.startsWith('image/')));
                                const file = new File([blob], "pasted.png", { type: blob.type });
                                
                                const dataTransfer = new DataTransfer();
                                dataTransfer.items.add(file);
                                document.getElementById(inputId).files = dataTransfer.files;
                                
                                const preview = document.getElementById(previewId);
                                preview.src = URL.createObjectURL(blob);
                                preview.classList.remove('hidden');
                                return;
                            }
                        }
                        alert("No image in clipboard");
                    } catch (e) {
                         alert("Paste failed: " + e.message);
                    }
                }
            `}} />
        </Layout>
    );
})

// Update Question
app.post('/past-papers/question/:id/update', async (c) => {
    const user = await getUser(c)
    const qId = c.req.param('id')

    // Fetch question to check permissions
    // FIX: Added generic <any>
    const q = await c.env.DB.prepare('SELECT q.*, p.subject FROM exam_questions q JOIN papers p ON q.paper_id = p.id WHERE q.id = ?').bind(qId).first<any>();
    if (!q) return c.notFound();
    if (!user || !canUploadPastPaper(user, q.subject)) return c.text('Unauthorized', 403);

    const body = await c.req.parseBody();

    // Logic to handle updates
    // 1. Update basic fields
    // FIX: Cast body values to string (or null) to satisfy bind() type requirements
    await c.env.DB.prepare(`
        UPDATE exam_questions 
        SET question_type = ?, marks = ?, mc_answer = ?
        WHERE id = ?
    `).bind(
        (body['question_type'] as string) || null,
        (body['marks'] as string) || null,
        (body['mc_answer'] as string) || null,
        qId
    ).run();

    // 2. Handle Images
    for (const type of ['question', 'answer', 'stimulus']) {
        const file = body[`${type}_image`] as File;
        if (file && file.size > 0 && file.name !== 'undefined') {
            const key = `questions/${Date.now()}-${type}-${Math.random().toString(36).slice(2)}`;
            await c.env.BUCKET.put(key, file);
            await c.env.DB.prepare(`UPDATE exam_questions SET ${type}_image_key = ? WHERE id = ?`).bind(key, qId).run();
        }
    }

    // 3. Handle Topics (Delete all and re-insert)
    await c.env.DB.prepare('DELETE FROM question_topics WHERE question_id = ?').bind(qId).run();

    // FIX: cast topic_ids to unknown first or handle array vs string
    const topicIds = body['topic_ids'];
    // topic_ids can be string (one) or array (multiple)
    const idsToInsert = Array.isArray(topicIds) ? topicIds : (topicIds ? [topicIds] : []);

    if (idsToInsert.length > 0) {
        const placeholders = idsToInsert.map(() => '(?, ?)').join(',');
        const values = [];
        for (const tid of idsToInsert) {
            values.push(qId, tid);
        }
        await c.env.DB.prepare(`INSERT INTO question_topics (question_id, topic_id) VALUES ${placeholders}`).bind(...values).run();
    }

    return c.redirect(`/past-papers/paper/${q.paper_id}#q-${qId}`);
});

export default app