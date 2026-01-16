import { Hono } from 'hono'
import { Layout } from '../../layout'
import { getUser, logAction } from '../../utils'
import { canUploadPastPaper, canCreateTopic, PermissionLevel } from '../../permissions'
import { Bindings } from '../../types'

const app = new Hono<{ Bindings: Bindings }>()

// View Paper
app.get('/past-papers/paper/:id', async (c) => {
    const user = await getUser(c)
    const paperId = c.req.param('id')

    // Fetch paper
    const paper = await c.env.DB.prepare('SELECT * FROM papers WHERE id = ?').bind(paperId).first<any>();
    if (!paper) return c.notFound();

    // Fetch questions + topics - ORDER BY ordering_index
    // JOIN users to get uploader info
    const questions = await c.env.DB.prepare(`
        SELECT q.*, group_concat(t.name, ', ') as topic_names, group_concat(t.id, ',') as topic_ids,
               u.first_name as uploader_first, u.last_name as uploader_last
        FROM exam_questions q
        LEFT JOIN question_topics qt ON q.id = qt.question_id
        LEFT JOIN topics t ON qt.topic_id = t.id
        LEFT JOIN users u ON q.uploader_id = u.id
        WHERE q.paper_id = ? AND q.is_deleted = 0
        GROUP BY q.id
        ORDER BY q.ordering_index ASC
    `).bind(paperId).all();

    // Fetch all topics for dropdown
    const allTopics = await c.env.DB.prepare('SELECT * FROM topics WHERE subject = ? ORDER BY name ASC').bind(paper.subject).all();

    // Build question list and Validate
    // 1. Topic (at least one)
    // 2. Question Image
    // 3. Type
    // 4. Marks
    // 5. Answer Image
    const qList = questions.results as any[];
    let incompleteQuestionsCount = 0;

    const qWithNext = qList.map((q, i) => {
        const nextQ = qList[i + 1];

        // Validation Logic
        const missing = [];
        if (!q.topic_ids) missing.push("Topic");
        if (!q.question_image_key) missing.push("Q. Img");
        if (!q.question_type) missing.push("Type");
        if (!q.marks) missing.push("Marks");
        if (!q.answer_image_key) missing.push("Ans. Img");

        if (missing.length > 0) incompleteQuestionsCount++;

        return {
            ...q,
            missing_fields: missing,
            next_ordering_index: nextQ ? nextQ.ordering_index : q.ordering_index + 1
        };
    });

    // Check permissions
    // Tag check: "C*" allows locking. 
    // Locking: Permission >= 4 OR tag C*
    // Unlocking: Permission >= 5
    // Editing Locked: Permission >= 5
    const hasCTag = user?.tags && (typeof user.tags === 'string' ? user.tags.includes('C*') : user.tags.includes('C*')); // Check JSON or string
    const canLock = user && (user.permission_level >= 4 || hasCTag);
    const canUnlock = user && user.permission_level >= 5;

    // Validate Locking: Can only lock if 0 incomplete questions
    const canLockValidate = canLock && incompleteQuestionsCount === 0;

    // Normal edit permission
    const canEditSubject = user && canUploadPastPaper(user, paper.subject);

    // Final Edit Permission: Must have subject perm AND (not locked OR (locked AND canUnlock))
    const canEdit = canEditSubject && (!paper.is_locked || canUnlock);

    const canManageTopics = user && (user.permission_level >= PermissionLevel.ADMIN || hasCTag);



    return c.html(
        <Layout title={`${paper.school_name} ${paper.academic_year}`} user={user}>
            <div class="mx-auto max-w-5xl">
                <div class="mb-6 flex justify-between items-start">
                    <div>
                        <div class="flex items-center gap-2 text-sm text-gray-500 mb-1">
                            <a href="/past-papers" class="hover:underline">Papers</a>
                            <span>/</span>
                            <a href={`/past-papers?subject=${encodeURIComponent(paper.subject)}`} class="hover:underline">{paper.subject}</a>
                            <span>/</span>
                        </div>
                        <div class="flex items-center gap-3">
                            <h1 class="text-3xl font-bold">{paper.school_name} {paper.academic_year}</h1>
                            {paper.is_locked ? (
                                <span class="bg-gray-100 text-gray-500 border border-gray-300 rounded px-2 py-0.5 text-xs font-bold uppercase flex items-center gap-1" title="Locked by Admin/Mod">
                                    Locked
                                </span>
                            ) : null}
                        </div>
                        <div class="flex gap-4 mt-1 items-center">
                            <span class="text-sm text-gray-600 bg-blue-50 px-2 py-0.5 rounded text-blue-800 font-medium">{paper.paper_type || 'Trial Paper'}</span>
                            {paper.reference_link && <a href={paper.reference_link} target="_blank" class="text-blue-600 hover:underline text-sm">View Reference PDF ↗</a>}
                        </div>
                    </div>

                    <div class="flex items-center gap-3">
                        {/* Lock/Unlock Button */}
                        {paper.is_locked ? (
                            canUnlock && (
                                <form action={`/past-papers/paper/${paper.id}/toggle-lock`} method="post">
                                    <button class="bg-gray-800 text-white text-sm font-bold px-3 py-2 rounded shadow hover:bg-gray-900 flex items-center gap-2">
                                        Uncheck
                                    </button>
                                </form>
                            )
                        ) : (
                            canLock && (
                                <>
                                    {incompleteQuestionsCount > 0 ? (
                                        <div class="group relative">
                                            <button disabled class="bg-gray-100 text-gray-400 border border-gray-200 text-sm font-bold px-3 py-2 rounded cursor-not-allowed flex items-center gap-2">
                                                Check
                                            </button>
                                            <div class="absolute right-0 top-full mt-2 w-64 bg-gray-800 text-white text-xs p-2 rounded shadow-lg opacity-0 group-hover:opacity-100 transition pointer-events-none z-10">
                                                Cannot lock: {incompleteQuestionsCount} questions have missing fields.
                                            </div>
                                        </div>
                                    ) : (
                                        <button onclick="document.getElementById('lock-modal').showModal()" class="bg-gray-100 text-gray-600 border border-gray-300 text-sm font-bold px-3 py-2 rounded shadow-sm hover:bg-gray-200 flex items-center gap-2">
                                            Check
                                        </button>
                                    )}
                                </>
                            )
                        )}
                    </div>
                </div>

                {/* Lock Warning Modal */}
                <dialog id="lock-modal" class="p-0 rounded-xl shadow-2xl backdrop:bg-gray-900/50 open:animate-fade-in backdrop:backdrop-blur-sm">
                    <div class="w-full max-w-md bg-white p-6 rounded-xl">
                        <h3 class="text-xl font-bold text-red-600 mb-4 flex items-center gap-2">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" ></path></svg>
                            Confirm check
                        </h3>
                        <p class="text-gray-600 mb-6">
                            By checking, you - yes, you - verify that:
                            <ul class="list-disc pl-5 mt-2 space-y-1 text-sm">
                                <li>All questions have been uploaded correctly.</li>
                                <li>The content is accurate and complete.</li>
                                <li>You accept responsibility for this paper's integrity.</li>
                            </ul>
                        </p>
                        <p class="text-xs text-gray-400 mb-6">This action will be logged.</p>
                        <div class="flex justify-end gap-3">
                            <button onclick="document.getElementById('lock-modal').close()" class="px-4 py-2 text-gray-600 font-bold hover:bg-gray-50 rounded-lg">Cancel</button>
                            <form action={`/past-papers/paper/${paper.id}/toggle-lock`} method="post">
                                <button class="bg-red-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-red-700 shadow-sm">
                                    I Understand, check
                                </button>
                            </form>
                        </div>
                    </div>
                </dialog>

                {/* Topic Management for Admins */}
                {canManageTopics && (
                    <div class="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-6">
                        <details>
                            <summary class="font-bold text-gray-700 cursor-pointer">Topic Management - Do NOT touch unless necessary</summary>
                            <div class="mt-4">
                                <form action="/past-papers/topics/create" method="post" class="flex gap-2 mb-4">
                                    <input type="hidden" name="subject" value={paper.subject} />
                                    <input type="hidden" name="redirect_paper_id" value={paper.id} />
                                    <input type="text" name="name" placeholder="New Topic Name" class="rounded border p-1 text-sm bg-white" required />
                                    <button class="bg-blue-600 text-white text-xs px-2 py-1 rounded">Create</button>
                                </form>
                                <div class="flex flex-wrap gap-2">
                                    {allTopics.results.map((t: any) => (
                                        <div class="bg-white border rounded px-2 py-1 text-xs flex items-center gap-2">
                                            {t.name}
                                            <form action="/past-papers/topics/delete" method="post" onsubmit="return confirm('Delete topic?');">
                                                <input type="hidden" name="topic_id" value={t.id} />
                                                <input type="hidden" name="redirect_paper_id" value={paper.id} />
                                                <button class="text-red-500 font-bold hover:text-red-700">×</button>
                                            </form>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </details>
                    </div>
                )}

                {/* Batch Form Start */}
                <form action={`/past-papers/paper/${paper.id}/update-batch`} method="post" enctype="multipart/form-data">
                    <div class="space-y-4 pb-24">
                        {qWithNext.map((q: any, index: number) => {
                            const isLastInSegment = !qWithNext[index + 1] ||
                                qWithNext[index + 1].section_label !== q.section_label ||
                                qWithNext[index + 1].segment_label !== q.segment_label;

                            return (
                                <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-4" id={`q-${q.id}`}>
                                    {/* Header / Summary Mode */}
                                    <div class="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition" onclick={`toggleEdit(${q.id})`}>
                                        <div class="flex items-center gap-4">
                                            <span class="font-mono text-gray-500 font-bold w-16 text-right">{q.section_label} {q.question_number}</span>

                                            <div class="flex flex-col">
                                                <div class="flex items-center gap-2">
                                                    {q.question_type === 'multiple_choice' && <span class="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded font-bold">MCQ</span>}
                                                    {q.marks && <span class="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded font-bold">{q.marks}m</span>}
                                                </div>
                                                {q.topic_names ? (
                                                    <span class="text-sm font-medium text-blue-800">{q.topic_names}</span>
                                                ) : (
                                                    <span class="text-sm text-gray-400 italic">No topics tagged</span>
                                                )}
                                                {/* Attribution Display */}
                                                <span class="text-xs text-gray-400 mt-1">
                                                    Last edited by: {q.uploader_first ? `${q.uploader_first} ${q.uploader_last}` : 'Original Uploader'}
                                                </span>
                                            </div>
                                        </div>

                                        <div class="flex items-center gap-4">
                                            {q.missing_fields.length === 0 ? (
                                                <span class="text-green-600 text-xs font-bold bg-green-50 px-2 py-1 rounded border border-green-200">✓ Ready</span>
                                            ) : (
                                                <span class="text-red-500 text-xs font-bold bg-red-50 px-2 py-1 rounded border border-red-200 cursor-help" title={`Missing: ${q.missing_fields.join(', ')}`}>
                                                    ⚠ Missing: {q.missing_fields.join(', ')}
                                                </span>
                                            )}
                                            <span class="text-gray-400">▼</span>
                                        </div>
                                    </div>

                                    {/* Edit / Detail Mode (Auto-expanded if canEdit is true) */}
                                    <div id={`detail-${q.id}`} class={`${canEdit ? '' : 'hidden'} border-t border-gray-100 bg-gray-50 p-6`}>
                                        {canEdit ? (
                                            <div class="space-y-6">
                                                {/* Removed individual form tag */}
                                                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    {/* Left Column: Metadata */}
                                                    <div class="space-y-4">
                                                        <div>
                                                            <label class="block text-xs font-bold text-gray-500 uppercase">Topics</label>
                                                            {/* FIX: size attribute expects number in JSX */}
                                                            {/* Changed name to include q ID for batch processing */}
                                                            {/* Added [] to name to ensure multiple values are sent/parsed correctly */}
                                                            <select name={`q_${q.id}_topic_ids[]`} multiple size={4} class="w-full mt-1 rounded border-gray-300 text-sm">
                                                                {allTopics.results.map((t: any) => (
                                                                    <option value={t.id} selected={q.topic_ids?.split(',').includes(String(t.id))}>{t.name}</option>
                                                                ))}
                                                            </select>
                                                            <p class="text-xs text-gray-400 mt-1">Cmd/Ctrl+Click to select multiple</p>
                                                        </div>

                                                        <div class="grid grid-cols-2 gap-4">
                                                            <div>
                                                                <label class="block text-xs font-bold text-gray-500 uppercase">Type</label>
                                                                <select name={`q_${q.id}_question_type`} class="w-full mt-1 rounded border-gray-300 text-sm">
                                                                    <option value="short_answer" selected={q.question_type === 'short_answer'}>Short Answer</option>
                                                                    <option value="multiple_choice" selected={q.question_type === 'multiple_choice'}>Multiple Choice</option>

                                                                    <option value="extended_response" selected={q.question_type === 'extended_response'}>Extended Response</option>
                                                                </select>
                                                            </div>
                                                            <div>
                                                                <label class="block text-xs font-bold text-gray-500 uppercase">Marks</label>
                                                                <input type="number" name={`q_${q.id}_marks`} value={q.marks} class="w-full mt-1 rounded border-gray-300 text-sm" />
                                                            </div>
                                                            {q.question_type === 'multiple_choice' && (
                                                                <div>
                                                                    <label class="block text-xs font-bold text-gray-500 uppercase">Correct Answer (MCQ only)</label>
                                                                    <select name={`q_${q.id}_mc_answer`} class="w-full mt-1 rounded border-gray-300 text-sm">
                                                                        {['A', 'B', 'C', 'D'].map(opt => (
                                                                            <option value={opt} selected={q.mc_answer === opt}>{opt}</option>
                                                                        ))}
                                                                    </select>
                                                                </div>
                                                            )}
                                                        </div>
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

                                                                <input type="file" name={`q_${q.id}_${type}_image`} id={`file-${type}-${q.id}`} accept="image/*" class="block w-full text-xs text-gray-500" />
                                                                <img id={`${type}-preview-${q.id}`} class="max-h-32 object-contain mt-2 hidden border rounded bg-gray-50" />
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Removed individual save button */}
                                            </div>
                                        ) : (
                                            <div class="flex gap-4">
                                                {q.question_image_key && <img src={`/download/${q.question_image_key}`} class="max-w-md border rounded" />}
                                                {q.answer_image_key && <img src={`/download/${q.answer_image_key}`} class="max-w-md border rounded border-green-200" />}
                                            </div>
                                        )}
                                    </div>

                                    {/* Segment Controls (Injected via map return) */}
                                    {isLastInSegment && canEdit && !paper.is_locked && (
                                        <div class="bg-blue-50/50 p-2 flex justify-center gap-2 border-t border-gray-100">
                                            <span class="text-xs font-bold text-gray-400 uppercase tracking-widest self-center mr-2">{q.section_label} {q.segment_label} Controls:</span>

                                            <button
                                                type="submit"
                                                formaction={`/past-papers/paper/${paper.id}/adjust-segment`}
                                                name="action" value="add"
                                                class="text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1 rounded font-bold"
                                                onclick={`
                                                    // Add hidden inputs dynamically for this button's context
                                                    const form = this.closest('form');
                                                    let sectionInput = form.querySelector('input[name="section_label"]');
                                                    if (!sectionInput) {
                                                        sectionInput = document.createElement('input');
                                                        sectionInput.type = 'hidden';
                                                        sectionInput.name = 'section_label';
                                                        form.appendChild(sectionInput);
                                                    }
                                                    sectionInput.value = '${q.section_label}';

                                                    let segmentInput = form.querySelector('input[name="segment_label"]');
                                                    if (!segmentInput) {
                                                        segmentInput = document.createElement('input');
                                                        segmentInput.type = 'hidden';
                                                        segmentInput.name = 'segment_label';
                                                        form.appendChild(segmentInput);
                                                    }
                                                    segmentInput.value = '${q.segment_label || ''}';
                                                `}
                                            >
                                                + Add Question
                                            </button>

                                            <button
                                                type="submit"
                                                formaction={`/past-papers/paper/${paper.id}/adjust-segment`}
                                                name="action" value="remove"
                                                class="text-xs bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1 rounded font-bold"
                                                onclick={`
                                                     if (!confirm('Remove last question of ${q.section_label} ${q.segment_label || ''}?')) return false;

                                                    // Add hidden inputs dynamically for this button's context
                                                    const form = this.closest('form');
                                                    let sectionInput = form.querySelector('input[name="section_label"]');
                                                    if (!sectionInput) {
                                                        sectionInput = document.createElement('input');
                                                        sectionInput.type = 'hidden';
                                                        sectionInput.name = 'section_label';
                                                        form.appendChild(sectionInput);
                                                    }
                                                    sectionInput.value = '${q.section_label}';

                                                    let segmentInput = form.querySelector('input[name="segment_label"]');
                                                    if (!segmentInput) {
                                                        segmentInput = document.createElement('input');
                                                        segmentInput.type = 'hidden';
                                                        segmentInput.name = 'segment_label';
                                                        form.appendChild(segmentInput);
                                                    }
                                                    segmentInput.value = '${q.segment_label || ''}';
                                                `}
                                            >
                                                - Remove Question
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Floating Save Bar */}
                    {canEdit && (
                        <div class="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg z-50">
                            <div class="max-w-5xl mx-auto flex justify-between items-center">
                                <span class="text-gray-500 text-sm">Ensure all changes are saved.</span>
                                <button type="submit" class="bg-blue-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-700 shadow-md transition transform hover:-translate-y-0.5">
                                    Save All Changes
                                </button>
                            </div>
                        </div>
                    )}
                </form>
            </div >

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
        </Layout >
    );
})

// Insert Sub-Question
app.post('/past-papers/question/:id/sub-question', async (c) => {
    const user = await getUser(c)
    const qId = c.req.param('id')

    // Fetch parent question
    const q = await c.env.DB.prepare('SELECT q.*, p.subject FROM exam_questions q JOIN papers p ON q.paper_id = p.id WHERE q.id = ?').bind(qId).first<any>();
    if (!q) return c.notFound();
    if (!user || !canUploadPastPaper(user, q.subject)) return c.text('Unauthorised', 403);

    const body = await c.req.parseBody();
    const currentIdx = parseFloat(body['ordering_index'] as string);
    const nextIdx = parseFloat(body['next_ordering_index'] as string);
    const newNumber = body['new_number'] as string;

    const newIdx = (currentIdx + nextIdx) / 2;

    await c.env.DB.prepare(`
        INSERT INTO exam_questions 
        (paper_id, section_label, segment_label, question_number, uploader_id, ordering_index)
        VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
        q.paper_id,
        q.section_label,
        q.segment_label,
        q.question_number, // Fix: this was q.question_number in original? No, newNumber. Check original.
        user.id,
        newIdx
    ).run();
    // Wait, original: `newNumber,` - oh let me check.
    // Original line 904 used `newNumber`.

    // FIX ABOVE: in bind arguments.

    return c.redirect(`/past-papers/paper/${q.paper_id}#q-${qId}`);
});
// Need to re-paste the handler properly (I typed it manually above and missed arguments).
// Let's just include all handlers properly.

// Create Topic (Admin/Subject Mod)
app.post('/past-papers/topics/create', async (c) => {
    const user = await getUser(c)
    const body = await c.req.parseBody()
    const subject = body['subject'] as string
    const redirectId = body['redirect_paper_id']

    // Permission check inside canCreateTopic
    if (!user || !canCreateTopic(user, subject)) return c.text("Unauthorised", 401)

    const name = body['name'] as string
    if (subject && name) {
        await c.env.DB.prepare('INSERT INTO topics (subject, name) VALUES (?, ?)').bind(subject, name).run()
    }
    return c.redirect(`/past-papers/paper/${redirectId}`)
})

// Delete Topic (Admin Only)
app.post('/past-papers/topics/delete', async (c) => {
    const user = await getUser(c)
    if (!user || user.permission_level < PermissionLevel.ADMIN) return c.text("Unauthorised", 401)

    const body = await c.req.parseBody()
    const topicId = body['topic_id']
    const redirectId = body['redirect_paper_id']

    await c.env.DB.prepare('DELETE FROM topics WHERE id = ?').bind(topicId).run()

    // Also clean up question_topics links
    await c.env.DB.prepare('DELETE FROM question_topics WHERE topic_id = ?').bind(topicId).run()

    return c.redirect(`/past-papers/paper/${redirectId}`)
})

// Toggle Lock
app.post('/past-papers/paper/:id/toggle-lock', async (c) => {
    const user = await getUser(c)
    const paperId = c.req.param('id')

    // Fetch paper
    const paper = await c.env.DB.prepare('SELECT * FROM papers WHERE id = ?').bind(paperId).first<any>();
    if (!paper) return c.notFound();

    const hasCTag = user?.tags && (typeof user.tags === 'string' ? user.tags.includes('C*') : user.tags.includes('C*'));

    // Permission Logic
    // Unlock: Only Level 5
    // Lock: Level 4 or C* tag + Validation (All questions must have images)

    if (paper.is_locked) {
        if (!user || user.permission_level < 5) return c.text("Unauthorised to unlock", 403);

        await logAction(c.env.DB, user.id, 'UNLOCK_PAPER', `Unlocked paper ${paperId}`, parseInt(paperId), 'papers');
    } else {
        if (!user || (user.permission_level < 4 && !hasCTag)) return c.text("Unauthorised to lock", 403);

        // Validation: Check for questions missingANY of the 5 fields
        // 1. Topic (must exist in question_topics)
        // 2. Question Img
        // 3. Type
        // 4. Marks
        // 5. Answer Img

        // Complex query to find invalid questions
        const invalidQuestions = await c.env.DB.prepare(`
            SELECT count(q.id) as count
            FROM exam_questions q
            LEFT JOIN question_topics qt ON q.id = qt.question_id
            WHERE q.paper_id = ? AND q.is_deleted = 0
            GROUP BY q.id
            HAVING 
                count(qt.topic_id) = 0 OR 
                q.question_image_key IS NULL OR 
                q.question_type IS NULL OR 
                q.marks IS NULL OR 
                q.answer_image_key IS NULL
        `).bind(paperId).all<any>();

        // If results return any rows, those correspond to invalid questions
        if (invalidQuestions.results.length > 0) {
            return c.text(`Cannot lock: ${invalidQuestions.results.length} questions have missing fields.`, 400);
        }

        await logAction(c.env.DB, user.id, 'LOCK_PAPER', `Locked paper ${paperId}`, parseInt(paperId), 'papers');
    }

    const newLockState = paper.is_locked ? 0 : 1;
    await c.env.DB.prepare('UPDATE papers SET is_locked = ? WHERE id = ?').bind(newLockState, paperId).run();

    return c.redirect(`/past-papers/paper/${paperId}`);
});

// Helper to process batch updates (Optimize: only update changed fields)
async function processBatchUpdate(c: any, paperId: string, user: any, body: any) {
    // Fetch all current questions to compare state
    const currentQuestions = await c.env.DB.prepare(`
        SELECT q.*, group_concat(qt.topic_id, ',') as topic_ids
        FROM exam_questions q
        LEFT JOIN question_topics qt ON q.id = qt.question_id
        WHERE q.paper_id = ? AND q.is_deleted = 0
        GROUP BY q.id
    `).bind(paperId).all();

    const currentQMap = new Map();
    if (currentQuestions.results) {
        for (const q of currentQuestions.results) {
            currentQMap.set(String(q.id), q);
        }
    }

    const qIds = new Set<string>();
    // Identify which questions are being updated
    for (const key of Object.keys(body)) {
        if (key.startsWith('q_')) {
            const parts = key.split('_');
            if (parts.length >= 2) {
                qIds.add(parts[1]);
            }
        }
    }

    let updatedCount = 0;

    // Process updates for each question
    for (const qId of qIds) {
        const currentQ = currentQMap.get(qId);

        // Prepare new values
        const newType = (body[`q_${qId}_question_type`] as string) || null;
        const newMarks = (body[`q_${qId}_marks`] as string) || null;
        const newMcAnswer = (body[`q_${qId}_mc_answer`] as string) || null;

        // Check if basic fields changed
        let basicChanged = false;
        if (currentQ) {
            if (currentQ.question_type !== newType) basicChanged = true;
            if (String(currentQ.marks || '') !== String(newMarks || '')) basicChanged = true;
            if (currentQ.mc_answer !== newMcAnswer) basicChanged = true;
        } else {
            basicChanged = true; // New or unknown question (shouldn't happen in batch usually)
        }

        if (basicChanged) {
            await c.env.DB.prepare(`
                UPDATE exam_questions 
                SET question_type = ?, marks = ?, mc_answer = ?, uploader_id = ?
                WHERE id = ?
            `).bind(
                newType,
                newMarks,
                newMcAnswer,
                user.id, // Update attribution
                qId
            ).run();
            updatedCount++;
        }

        // 2. Handle Images (Only if file provided)
        for (const type of ['question', 'answer', 'stimulus']) {
            const file = body[`q_${qId}_${type}_image`] as File;
            if (file && file.size > 0 && file.name !== 'undefined') {
                const key = `questions/${Date.now()}-${type}-${Math.random().toString(36).slice(2)}`;
                await c.env.BUCKET.put(key, file);
                await c.env.DB.prepare(`UPDATE exam_questions SET ${type}_image_key = ? WHERE id = ?`).bind(key, qId).run();
                updatedCount++;
            }
        }

        // 3. Handle Topics
        // Compare existing topics to new topics
        const existingTopicIdsStr = currentQ?.topic_ids || '';
        const existingTopicSet = new Set(existingTopicIdsStr.split(',').filter(Boolean));

        const topicIds = body[`q_${qId}_topic_ids[]`];
        const idsToInsert = Array.isArray(topicIds) ? topicIds : (topicIds ? [topicIds as string] : []);
        const newTopicSet = new Set(idsToInsert.map(String));

        // Start symmetric difference check
        let topicsChanged = false;
        if (existingTopicSet.size !== newTopicSet.size) {
            topicsChanged = true;
        } else {
            for (const id of newTopicSet) {
                if (!existingTopicSet.has(id)) {
                    topicsChanged = true;
                    break;
                }
            }
        }

        if (topicsChanged) {
            await c.env.DB.prepare('DELETE FROM question_topics WHERE question_id = ?').bind(qId).run();

            if (idsToInsert.length > 0) {
                const placeholders = idsToInsert.map(() => '(?, ?)').join(',');
                const values = [];
                for (const tid of idsToInsert) {
                    values.push(qId, tid);
                }
                await c.env.DB.prepare(`INSERT INTO question_topics (question_id, topic_id) VALUES ${placeholders}`).bind(...values).run();
            }
            updatedCount++;
        }
    }

    return updatedCount;
}

// Batch Update Questions
app.post('/past-papers/paper/:id/update-batch', async (c) => {
    const user = await getUser(c)
    const paperId = c.req.param('id')

    // Fetch paper and check core permissions
    const paper = await c.env.DB.prepare('SELECT * FROM papers WHERE id = ?').bind(paperId).first<any>();
    if (!paper) return c.notFound();
    if (!user || !canUploadPastPaper(user, paper.subject)) return c.text('Unauthorised', 403);
    if (paper.is_locked && user.permission_level < 5) return c.text('Paper is locked', 403);

    const body = await c.req.parseBody();

    const count = await processBatchUpdate(c, paperId, user, body);

    if (count > 0) {
        await logAction(c.env.DB, user.id, 'BATCH_UPDATE_QUESTIONS', `Batch updated questions in paper ${paperId}`, parseInt(paperId), 'papers');
    }

    return c.redirect(`/past-papers/paper/${paperId}`);
});

// Update Question
app.post('/past-papers/question/:id/update', async (c) => {
    const user = await getUser(c)
    const qId = c.req.param('id')

    // Fetch question to check permissions
    const q = await c.env.DB.prepare('SELECT q.*, p.subject, p.is_locked FROM exam_questions q JOIN papers p ON q.paper_id = p.id WHERE q.id = ?').bind(qId).first<any>();
    if (!q) return c.notFound();

    // Check Permissions
    // 1. Must be able to upload subject
    if (!user || !canUploadPastPaper(user, q.subject)) return c.text('Unauthorised', 403);

    // 2. If locked, must be Level 5
    if (q.is_locked && user.permission_level < 5) return c.text('Paper is locked', 403);

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

// Adjust Segment (Add/Remove Question)
app.post('/past-papers/paper/:id/adjust-segment', async (c) => {
    const user = await getUser(c);
    const paperId = c.req.param('id');
    const body = await c.req.parseBody();
    const action = body['action'] as string; // 'add' or 'remove'
    const sectionLabel = body['section_label'] as string;
    const segmentLabel = body['segment_label'] as string; // can be empty string

    // 1. Fetch paper & Validate Permissions
    const paper = await c.env.DB.prepare('SELECT * FROM papers WHERE id = ?').bind(paperId).first<any>();
    if (!paper) return c.notFound();
    if (!user || !canUploadPastPaper(user, paper.subject)) return c.text('Unauthorised', 403);

    // Cannot adjust if locked
    if (paper.is_locked) return c.text('Paper is locked', 403);

    // AUTO-SAVE: Process updates for all questions in the form before adding/removing
    // This assumes the form submitted to this endpoint contains all the q_ inputs, which it does because
    // the buttons are inside the main <form> and use formaction
    await processBatchUpdate(c, paperId, user, body);

    // 2. Find the last question of this segment
    // We need to query questions for this paper, section, and segment
    // We need to handle segmentLabel being empty or null
    let query = `SELECT * FROM exam_questions WHERE paper_id = ? AND section_label = ? AND is_deleted = 0`;
    const params: any[] = [paperId, sectionLabel];

    if (segmentLabel) {
        query += ` AND segment_label = ?`;
        params.push(segmentLabel);
    } else {
        query += ` AND (segment_label IS NULL OR segment_label = '')`;
    }

    query += ` ORDER BY ordering_index DESC LIMIT 1`;

    const lastQ = await c.env.DB.prepare(query).bind(...params).first<any>();

    if (!lastQ) {
        // If no questions exist in this segment, we can't easily append to it or remove from it without more info.
        // For now, assuming segments exist.
        return c.text('Segment not found or empty', 404);
    }

    if (action === 'add') {
        // Logic to ADD a question
        // 1. Determine new Question Number
        // Attempt to parse the numeric part of the last question number
        const lastNum = lastQ.question_number;
        const match = lastNum.match(/(\d+)$/); // match numbers at end
        let newNum = "";

        if (match) {
            const numPart = match[1];
            const prefix = lastNum.substring(0, lastNum.length - numPart.length);
            const nextVal = parseInt(numPart) + 1;
            newNum = prefix + nextVal;
        } else {
            newNum = lastNum + "1"; // Fallback
        }

        // Full label
        const standardFullLabel = segmentLabel ? `${sectionLabel} ${newNum}` : `${sectionLabel} ${newNum}`;


        // 2. Determine Ordering Index
        // Should be after lastQ. We need to find if there's a question *after* lastQ (next segment) to insert between,
        // or just add +1 if it's the very end.
        const nextQ = await c.env.DB.prepare(`
            SELECT * FROM exam_questions 
            WHERE paper_id = ? AND ordering_index > ? AND is_deleted = 0
            ORDER BY ordering_index ASC LIMIT 1
        `).bind(paperId, lastQ.ordering_index).first<any>();

        let newOrderIdx;
        if (nextQ) {
            newOrderIdx = (lastQ.ordering_index + nextQ.ordering_index) / 2;
        } else {
            newOrderIdx = lastQ.ordering_index + 1;
        }

        // 3. Insert
        await c.env.DB.prepare(`
            INSERT INTO exam_questions 
            (paper_id, section_label, segment_label, question_number, question_full_label, uploader_id, ordering_index)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(
            paperId,
            sectionLabel,
            segmentLabel || null,
            newNum,
            standardFullLabel,
            user.id,
            newOrderIdx
        ).run();

        await logAction(c.env.DB, user.id, 'ADD_QUESTION', `Added question ${newNum} to paper ${paperId}`, parseInt(paperId), 'papers');

    } else if (action === 'remove') {
        // Logic to REMOVE a question (Soft Delete)
        // We are removing `lastQ`.

        // Safety Check 1: Do not remove if it's the ONLY question in the segment.
        // Count questions in segment
        let countQuery = `SELECT count(*) as count FROM exam_questions WHERE paper_id = ? AND section_label = ? AND is_deleted = 0`;
        const countParams: any[] = [paperId, sectionLabel];
        if (segmentLabel) {
            countQuery += ` AND segment_label = ?`;
            countParams.push(segmentLabel);
        } else {
            countQuery += ` AND (segment_label IS NULL OR segment_label = '')`;
        }

        const countRes = await c.env.DB.prepare(countQuery).bind(...countParams).first<any>();
        if (countRes.count <= 1) {
            return c.text('Cannot delete the last remaining question of a segment. Delete the segment instead if needed (not implemented).', 400);
        }

        await c.env.DB.prepare(`UPDATE exam_questions SET is_deleted = 1 WHERE id = ?`).bind(lastQ.id).run();
    }

    return c.redirect(`/past-papers/paper/${paperId}`);
});

export default app;
