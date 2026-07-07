
import { Hono } from 'hono'
import { Layout } from '../../layout'
import { getUser, logAction } from '../../utils'
import { canUploadPastPaper, canCreateTopic, PermissionLevel } from '../../permissions'
import { Bindings } from '../../types'

const app = new Hono<{ Bindings: Bindings }>()


app.get('/past-papers/paper/:id', async (c) => {
    const user = await getUser(c)
    if (!user) return c.redirect('/login')
    const paperId = c.req.param('id')
    const paper = await c.env.DB.prepare('SELECT * FROM papers WHERE id = ?').bind(paperId).first<any>();
    if (!paper) return c.notFound();


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


    const allTopics = await c.env.DB.prepare('SELECT * FROM topics WHERE subject = ? ORDER BY name ASC').bind(paper.subject).all();


    const qList = questions.results as any[];
    let incompleteQuestionsCount = 0;

    const qWithNext = qList.map((q, i) => {
        const nextQ = qList[i + 1];


        const missing = [];
        if (!q.topic_ids) missing.push("Topic");
        const hasQContent = q.question_image_key || q.question_text;
        if (!hasQContent) missing.push("Q. Content");
        if (!q.question_type) missing.push("Type");
        if (!q.marks) missing.push("Marks");
        const hasAContent = q.answer_image_key || q.answer_text;
        if (!hasAContent) missing.push("Ans. Content");

        if (missing.length > 0) incompleteQuestionsCount++;

        return {
            ...q,
            missing_fields: missing,
            next_ordering_index: nextQ ? nextQ.ordering_index : q.ordering_index + 1
        };
    });

    // Check permissions
    // Locking: Permission >= 4 OR tag C*
    // Unlocking: Permission >= 5

    const hasCTag = user?.tags && (typeof user.tags === 'string' ? user.tags.includes('C*') : user.tags.includes('C*'));
    const canLock = user && (user.permission_level >= 4 || hasCTag);
    const canUnlock = user && user.permission_level >= 5;


    const canLockValidate = canLock && incompleteQuestionsCount === 0;


    const canEditSubject = user && canUploadPastPaper(user, paper.subject);


    const canEdit = canEditSubject && (!paper.is_locked || canUnlock);

    const canManageTopics = user && (user.permission_level >= PermissionLevel.ADMIN || hasCTag);



    return c.html(
        <Layout title={`${paper.school_name} ${paper.academic_year}`} user={user} latex={true}>
            <div class="mx-auto max-w-5xl">
                <div class="mb-6 flex justify-between items-start text-gray-900 dark:text-white">
                    <div>
                        <div class="flex items-center gap-2 text-sm text-gray-500 dark:text-neutral-400 mb-1">
                            <a href="/past-papers" class="hover:underline">Papers</a>
                            <span class="text-gray-300 dark:text-neutral-600">/</span>
                            <a href={`/past-papers?subject=${encodeURIComponent(paper.subject)}`} class="hover:underline">{paper.subject}</a>
                            <span class="text-gray-300 dark:text-neutral-600">/</span>
                        </div>
                        <div class="flex items-center gap-3">
                            <h1 class="text-3xl font-bold dark:text-white">{paper.school_name} {paper.academic_year}</h1>
                            {paper.is_locked ? (
                                <span class="bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-neutral-400 border border-gray-300 dark:border-neutral-700 rounded px-2 py-0.5 text-xs font-bold uppercase flex items-center gap-1" title="Locked by Admin/Mod">
                                    Locked
                                </span>
                            ) : null}
                        </div>
                        <div class="flex gap-4 mt-1 items-center">
                            <span class="text-sm text-gray-600 dark:text-neutral-300 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded text-blue-800 dark:text-blue-400 font-medium">{paper.paper_type || 'Trial Paper'}</span>
                            {paper.reference_link && <a href={paper.reference_link} target="_blank" class="text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium">View Reference PDF ↗</a>}
                        </div>
                    </div>

                    <div class="flex items-center gap-3">
                        <a href={`/past-papers/batch/view?paper_id=${paper.id}`} class="bg-emerald-600 text-white text-sm font-bold px-3 py-2 rounded shadow hover:bg-emerald-700 flex items-center gap-2">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path></svg>
                            Attempt All
                        </a>
                        {canEdit && (
                            <>
                                <button onclick="document.getElementById('upload-pdf-modal').showModal()" class="bg-blue-600 text-white text-sm font-bold px-3 py-2 rounded shadow hover:bg-blue-700 flex items-center gap-2">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                                    Upload PDF
                                </button>

                                <button onclick="document.getElementById('import-modal').showModal()" class="bg-blue-600 text-white text-sm font-bold px-3 py-2 rounded shadow hover:bg-blue-700 flex items-center gap-2">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                                    Import JSON
                                </button>

                                <button onclick="document.getElementById('ai-import-modal').showModal()" class="bg-blue-600 text-white text-sm font-bold px-3 py-2 rounded shadow hover:bg-blue-700 flex items-center gap-2">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                                    AI Import PDF
                                </button>

                                <dialog id="upload-pdf-modal" class="p-0 rounded-xl shadow-2xl backdrop:bg-gray-900/50 open:animate-fade-in backdrop:backdrop-blur-sm">
                                    <div class="w-full max-w-lg bg-white dark:bg-neutral-800 p-6 rounded-xl border border-gray-200 dark:border-neutral-700">
                                        <h3 class="text-xl font-bold text-gray-800 dark:text-white mb-2">Upload Reference PDF</h3>
                                        <p class="text-sm text-gray-500 dark:text-neutral-400 mb-4">
                                            Upload a PDF document to attach to this paper. This enables PDF cropping for stimuli.
                                        </p>

                                        <form action={`/past-papers/paper/${paper.id}/upload-pdf`} method="post" enctype="multipart/form-data">
                                            <div class="border-2 border-dashed border-gray-300 dark:border-neutral-600 rounded-lg p-6 text-center hover:bg-gray-50 dark:hover:bg-neutral-700/50 transition cursor-pointer relative">
                                                <input type="file" name="pdf_file" accept=".pdf,application/pdf" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer" required />
                                                <div class="text-gray-500 dark:text-neutral-400">
                                                    <span class="block text-2xl mb-1">📄</span>
                                                    <span class="font-bold text-sm">Click to select .pdf file</span>
                                                </div>
                                            </div>

                                            <div class="flex justify-end gap-3 mt-6">
                                                <button type="button" onclick="document.getElementById('upload-pdf-modal').close()" class="px-4 py-2 text-gray-600 dark:text-neutral-400 font-bold hover:bg-gray-100 dark:hover:bg-neutral-700 rounded-lg">Cancel</button>
                                                <button class="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700 shadow-sm transition-colors">
                                                    Upload
                                                </button>
                                            </div>
                                        </form>
                                    </div>
                                </dialog>

                                <dialog id="import-modal" class="p-0 rounded-xl shadow-2xl backdrop:bg-gray-900/50 open:animate-fade-in backdrop:backdrop-blur-sm">
                                    <div class="w-full max-w-lg bg-white dark:bg-neutral-800 p-6 rounded-xl border border-gray-200 dark:border-neutral-700">
                                        <h3 class="text-xl font-bold text-gray-800 dark:text-white mb-2">Import Paper from JSON</h3>
                                        <p class="text-sm text-gray-500 dark:text-neutral-400 mb-4">
                                            Upload a .json or .txt file. This will replace ALL existing questions.
                                        </p>

                                        <form action={`/past-papers/paper/${paper.id}/upload-text`} method="post" enctype="multipart/form-data">
                                            <div class="border-2 border-dashed border-gray-300 dark:border-neutral-600 rounded-lg p-6 text-center hover:bg-gray-50 dark:hover:bg-neutral-700/50 transition cursor-pointer relative">
                                                <input type="file" name="text_file" accept=".txt,.json" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer" required />
                                                <div class="text-gray-500 dark:text-neutral-400">
                                                    <span class="block text-2xl mb-1">📄</span>
                                                    <span class="font-bold text-sm">Click to select .json or .txt file</span>
                                                </div>
                                            </div>

                                            <div class="mt-4 bg-gray-50 dark:bg-neutral-900 p-3 rounded text-xs text-gray-500 dark:text-neutral-400 font-mono overflow-x-auto border border-gray-200 dark:border-neutral-800">
                                                Ensure the file contains a valid JSON object with a <code>questions</code> array matching the AI extraction format.
                                            </div>

                                            <div class="flex justify-end gap-3 mt-6">
                                                <button type="button" onclick="document.getElementById('import-modal').close()" class="px-4 py-2 text-gray-600 dark:text-neutral-400 font-bold hover:bg-gray-100 dark:hover:bg-neutral-700 rounded-lg">Cancel</button>
                                                <button class="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700 shadow-sm transition-colors">
                                                    Process & Import
                                                </button>
                                            </div>
                                        </form>
                                    </div>
                                </dialog>

                                <dialog id="ai-import-modal" class="p-0 rounded-xl shadow-2xl backdrop:bg-gray-900/50 open:animate-fade-in backdrop:backdrop-blur-sm">
                                    <div class="w-full max-w-lg bg-white dark:bg-neutral-800 p-6 rounded-xl border border-blue-200 dark:border-blue-800/40">
                                        <h3 class="text-xl font-bold text-blue-700 dark:text-blue-300 mb-2 flex items-center gap-2">
                                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                                            AI Import from PDF
                                        </h3>
                                        <p class="text-sm text-gray-500 dark:text-neutral-400 mb-4">
                                            MUST include solution!
                                        </p>
                                        <p class="text-xs text-red-500 dark:text-red-400 mb-4 font-bold">
                                            ⚠ Warning: This will replace ALL existing questions in this paper.
                                        </p>

                                        <form action={`/past-papers/paper/${paper.id}/ai-import`} method="post" enctype="multipart/form-data" id="ai-view-import-form">
                                            <div class="border-2 border-dashed border-blue-300 dark:border-blue-700 rounded-lg p-6 text-center hover:bg-blue-50 dark:hover:bg-blue-900/20 transition cursor-pointer relative">
                                                <input type="file" name="pdf_file" accept=".pdf,application/pdf" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer" required id="ai-view-pdf-input" />
                                                <div class="text-gray-500 dark:text-neutral-400" id="ai-view-pdf-label">
                                                    <span class="block text-3xl mb-2">📄</span>
                                                    <span class="font-bold text-sm">Click or drag to upload PDF</span>
                                                    <span class="block text-xs mt-1 text-gray-400 dark:text-neutral-500">Supports HSC-format past papers</span>
                                                </div>
                                            </div>

                                            <div class="flex justify-end gap-3 mt-6">
                                                <button type="button" onclick="document.getElementById('ai-import-modal').close()" class="px-4 py-2 text-gray-600 dark:text-neutral-400 font-bold hover:bg-gray-100 dark:hover:bg-neutral-700 rounded-lg">Cancel</button>
                                                <button id="ai-view-submit-btn" class="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700 shadow-sm transition-colors flex items-center gap-2">
                                                    <span id="ai-view-submit-text">AI Import</span>
                                                </button>
                                            </div>
                                        </form>
                                    </div>
                                </dialog>
                            </>
                        )}

                        {paper.is_locked ? (
                            canUnlock && (
                                <form action={`/past-papers/paper/${paper.id}/toggle-lock`} method="post">
                                    <button class="bg-gray-800 dark:bg-neutral-700 text-white text-sm font-bold px-3 py-2 rounded shadow hover:bg-gray-900 dark:hover:bg-neutral-600 flex items-center gap-2 transition-colors">
                                        Uncheck
                                    </button>
                                </form>
                            )
                        ) : (
                            canLock && (
                                <>
                                    {incompleteQuestionsCount > 0 ? (
                                        <div class="group relative">
                                            <button disabled class="bg-gray-100 dark:bg-neutral-800 text-gray-400 dark:text-neutral-600 border border-gray-200 dark:border-neutral-700 text-sm font-bold px-3 py-2 rounded cursor-not-allowed flex items-center gap-2">
                                                Check
                                            </button>
                                            <div class="absolute right-0 top-full mt-2 w-64 bg-gray-800 dark:bg-neutral-700 text-white text-xs p-2 rounded shadow-lg opacity-0 group-hover:opacity-100 transition pointer-events-none z-10">
                                                Cannot lock: {incompleteQuestionsCount} questions have missing fields.
                                            </div>
                                        </div>
                                    ) : (
                                        <button onclick="document.getElementById('lock-modal').showModal()" class="bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-300 border border-gray-300 dark:border-neutral-700 text-sm font-bold px-3 py-2 rounded shadow-sm hover:bg-gray-200 dark:hover:bg-neutral-700 flex items-center gap-2 transition-colors">
                                            Check
                                        </button>
                                    )}
                                </>
                            )
                        )}
                    </div>
                </div>


                <dialog id="lock-modal" class="p-0 rounded-xl shadow-2xl backdrop:bg-gray-900/50 open:animate-fade-in backdrop:backdrop-blur-sm">
                    <div class="w-full max-w-md bg-white dark:bg-neutral-800 p-6 rounded-xl border border-gray-200 dark:border-neutral-700">
                        <h3 class="text-xl font-bold text-red-600 dark:text-red-400 mb-4 flex items-center gap-2">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                            Confirm check
                        </h3>
                        <p class="text-gray-600 dark:text-neutral-400 mb-6">
                            By checking, you - yes, you - verify that:
                            <ul class="list-disc pl-5 mt-2 space-y-1 text-sm">
                                <li>All questions have been uploaded correctly.</li>
                                <li>The content is accurate and complete.</li>
                                <li>You accept responsibility for this paper's integrity.</li>
                            </ul>
                        </p>
                        <p class="text-xs text-gray-400 dark:text-neutral-500 mb-6 font-mono">This action will be logged.</p>
                        <div class="flex justify-end gap-3">
                            <button onclick="document.getElementById('lock-modal').close()" class="px-4 py-2 text-gray-600 dark:text-neutral-400 font-bold hover:bg-gray-50 dark:hover:bg-neutral-700 rounded-lg transition-colors">Cancel</button>
                            <form action={`/past-papers/paper/${paper.id}/toggle-lock`} method="post">
                                <button class="bg-red-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-red-700 shadow-sm transition-colors">
                                    I Understand, check
                                </button>
                            </form>
                        </div>
                    </div>
                </dialog>
                    {/* AI Status Banner */}
{paper.ai_status === 'pending' || paper.ai_status === 'processing' ? (
    <div class="mb-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex items-center gap-4">
        <div class="flex-shrink-0">
            <svg class="w-6 h-6 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
            </svg>
        </div>
        <div class="flex-1">
            <p class="font-bold text-blue-700 dark:text-blue-300 text-sm">
                {paper.ai_status === 'pending' ? 'AI Import Queued' : 'AI Import In Progress'}
            </p>
            <p class="text-blue-600 dark:text-blue-400 text-xs mt-0.5">
                {paper.ai_status === 'pending'
                    ? 'Your PDF is waiting to be processed. This page will refresh automatically.'
                    : 'Gemini is extracting questions from your PDF. This usually takes 30–90 seconds. This page automatically reloads'}
            </p>
        </div>
        <meta http-equiv="refresh" content="6" />
    </div>
) : paper.ai_status === 'done' ? (
    <div class="mb-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-center gap-4">
        <span class="text-2xl">✅</span>
        <div class="flex-1">
            <p class="font-bold text-green-700 dark:text-green-300 text-sm">AI Import Complete</p>
            <p class="text-green-600 dark:text-green-400 text-xs mt-0.5">
                All questions have been extracted and imported successfully.
            </p>
        </div>
        {/* Dismiss by clearing the status */}
        <form action={`/past-papers/paper/${paper.id}/clear-ai-status`} method="post">
            <button class="text-xs text-green-600 dark:text-green-400 hover:underline font-bold">Dismiss</button>
        </form>
    </div>
) : paper.ai_status === 'error' ? (
    <div class="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-4">
        <span class="text-2xl">❌</span>
        <div class="flex-1">
            <p class="font-bold text-red-700 dark:text-red-300 text-sm">AI Import Failed</p>
            <p class="text-red-600 dark:text-red-400 text-xs mt-0.5 font-mono">
                {paper.ai_error || 'An unknown error occurred.'}
            </p>
        </div>
        <form action={`/past-papers/paper/${paper.id}/clear-ai-status`} method="post">
            <button class="text-xs text-red-600 dark:text-red-400 hover:underline font-bold">Dismiss</button>
        </form>
    </div>
) : null}


                {canManageTopics && (
                    <div class="bg-gray-50 dark:bg-neutral-800 p-4 rounded-lg border border-gray-200 dark:border-neutral-700 mb-6">
                        <details class="group">
                            <summary class="font-bold text-gray-700 dark:text-neutral-300 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Topic Management - Do NOT touch unless necessary</summary>
                            <div class="mt-4">
                                <form action="/past-papers/topics/create" method="post" class="flex gap-2 mb-4">
                                    <input type="hidden" name="subject" value={paper.subject} />
                                    <input type="hidden" name="redirect_paper_id" value={paper.id} />
                                    <input type="text" name="name" placeholder="New Topic Name" class="rounded border dark:border-neutral-700 p-1.5 text-sm bg-white dark:bg-neutral-900 dark:text-white" required />
                                    <button class="bg-blue-600 text-white text-xs px-3 py-1 rounded font-bold hover:bg-blue-700 transition-colors">Create</button>
                                </form>
                                <div class="flex flex-wrap gap-2">
                                    {allTopics.results.map((t: any) => (
                                        <div class="bg-white dark:bg-neutral-900 border dark:border-neutral-700 rounded px-2 py-1 text-xs flex items-center gap-2 dark:text-neutral-300">
                                            {t.name}
                                            <form action="/past-papers/topics/delete" method="post" onsubmit="return confirm('Delete topic?');">
                                                <input type="hidden" name="topic_id" value={t.id} />
                                                <input type="hidden" name="redirect_paper_id" value={paper.id} />
                                                <button class="text-red-500 font-bold hover:text-red-700 transition-colors">×</button>
                                            </form>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </details>
                    </div>
                )}


                <form action={`/past-papers/paper/${paper.id}/update-batch`} method="post" enctype="multipart/form-data">
                    <div class="space-y-4 pb-24">
                        {qWithNext.map((q: any, index: number) => {
                            const isLastInSegment = !qWithNext[index + 1] ||
                                qWithNext[index + 1].section_label !== q.section_label ||
                                qWithNext[index + 1].segment_label !== q.segment_label;

                            return (
                                <div class="bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-gray-200 dark:border-neutral-700 overflow-hidden mb-4" id={`q-${q.id}`}>

                                    <div class="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-neutral-700 transition" onclick={`toggleEdit(${q.id})`}>
                                        <div class="flex items-center gap-4">
                                            <span class="font-mono text-gray-500 dark:text-neutral-400 font-bold w-16 text-right">{q.section_label} {q.question_number}</span>

                                            <div class="flex flex-col">
                                                <div class="flex items-center gap-2">
                                                    {q.question_type === 'multiple_choice' && <span class="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs px-2 py-0.5 rounded font-bold">MCQ</span>}
                                                    {q.marks && <span class="bg-gray-100 dark:bg-neutral-700 text-gray-600 dark:text-neutral-300 text-xs px-2 py-0.5 rounded font-bold">{q.marks}m</span>}
                                                </div>
                                                {q.topic_names ? (
                                                    <span class="text-sm font-medium text-blue-800 dark:text-blue-400">{q.topic_names}</span>
                                                ) : (
                                                    <span class="text-sm text-gray-400 dark:text-neutral-500 italic">No topics tagged</span>
                                                )}

                                                <span class="text-xs text-gray-400 mt-1">
                                                    Last edited by: {q.uploader_first ? `${q.uploader_first} ${q.uploader_last}` : 'Original Uploader'}
                                                </span>
                                            </div>
                                        </div>

                                        <div class="flex items-center gap-4">
                                            {q.missing_fields.length === 0 ? (
                                                <span class="text-green-600 dark:text-green-400 text-xs font-bold bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded border border-green-200 dark:border-green-900/40">✓ Ready</span>
                                            ) : (
                                                <span class="text-red-500 dark:text-red-400 text-xs font-bold bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded border border-red-200 dark:border-red-900/40 cursor-help" title={`Missing: ${q.missing_fields.join(', ')}`}>
                                                    ⚠ Missing: {q.missing_fields.join(', ')}
                                                </span>
                                            )}
                                            <span class="text-gray-400 dark:text-neutral-600">▼</span>
                                        </div>
                                    </div>


                                    <div id={`detail-${q.id}`} class={`${canEdit ? '' : 'hidden'} border-t border-gray-100 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900 p-6`}>
                                        {canEdit ? (
                                            <div class="space-y-6">

                                                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">

                                                    <div class="space-y-4">
                                                        <div>
                                                            <label class="block text-xs font-bold text-gray-500 dark:text-neutral-400 uppercase">Topics</label>

                                                            <select name={`q_${q.id}_topic_ids[]`} multiple size={4} class="w-full mt-1 rounded border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm dark:text-white">
                                                                {allTopics.results.map((t: any) => (
                                                                    <option value={t.id} selected={q.topic_ids?.split(',').includes(String(t.id))}>{t.name}</option>
                                                                ))}
                                                            </select>
                                                            <p class="text-xs text-gray-400 dark:text-neutral-500 mt-1">Cmd/Ctrl+Click to select multiple</p>
                                                        </div>

                                                        <div class="grid grid-cols-2 gap-4">
                                                            <div>
                                                                <label class="block text-xs font-bold text-gray-500 dark:text-neutral-400 uppercase">Type</label>
                                                                <select name={`q_${q.id}_question_type`} class="w-full mt-1 rounded border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm dark:text-white">
                                                                    <option value="short_answer" selected={q.question_type === 'short_answer'}>Short Answer</option>
                                                                    <option value="multiple_choice" selected={q.question_type === 'multiple_choice'}>Multiple Choice</option>
                                                                    <option value="extended_response" selected={q.question_type === 'extended_response'}>Extended Response</option>
                                                                </select>
                                                            </div>
                                                            <div>
                                                                <label class="block text-xs font-bold text-gray-500 dark:text-neutral-400 uppercase">Marks</label>
                                                                <input type="number" name={`q_${q.id}_marks`} value={q.marks} class="w-full mt-1 rounded border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm dark:text-white" />
                                                            </div>
                                                            {q.question_type === 'multiple_choice' && (
                                                                <div>
                                                                    <label class="block text-xs font-bold text-gray-500 dark:text-neutral-400 uppercase">Correct Answer (MCQ only)</label>
                                                                    <select name={`q_${q.id}_mc_answer`} class="w-full mt-1 rounded border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm dark:text-white">
                                                                        {['A', 'B', 'C', 'D'].map(opt => (
                                                                            <option value={opt} selected={q.mc_answer === opt}>{opt}</option>
                                                                        ))}
                                                                    </select>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>


                                                    <div class="space-y-4">
                                                        {['question', 'answer', 'stimulus'].map(type => {
                                                            const hasText = !!q[`${type}_text`];
                                                            const hasImage = !!q[`${type}_image_key`];

                                                            const initialMode = hasText ? 'text' : 'image';

                                                            return (
                                                                <div class="bg-white dark:bg-neutral-800 p-3 rounded border border-gray-200 dark:border-neutral-700" id={`container-${type}-${q.id}`}>
                                                                    <div class="flex justify-between items-center mb-2">
                                                                        <label class="text-xs font-bold text-gray-500 dark:text-neutral-400 uppercase">{type} Content</label>
                                                                        <div class="flex gap-2">
                                                                            <button type="button" onclick={`switchMode('${type}', ${q.id}, 'text')`} class={`text-xs px-2 py-1 rounded font-bold transition var-mode-text ${initialMode === 'text' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' : 'bg-gray-100 dark:bg-neutral-700 text-gray-500 dark:text-neutral-400 hover:bg-gray-200 dark:hover:bg-neutral-600'}`}>Text</button>
                                                                            <button type="button" onclick={`switchMode('${type}', ${q.id}, 'image')`} class={`text-xs px-2 py-1 rounded font-bold transition var-mode-image ${initialMode === 'image' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' : 'bg-gray-100 dark:bg-neutral-700 text-gray-500 dark:text-neutral-400 hover:bg-gray-200 dark:hover:bg-neutral-600'}`}>Image</button>
                                                                        </div>
                                                                    </div>

                                                                    {/* Text Mode */}
                                                                    <div id={`mode-${type}-${q.id}-text`} class={`${initialMode === 'text' ? '' : 'hidden'}`}>
                                                                        <textarea
                                                                            name={`q_${q.id}_${type}_text`}
                                                                            rows={3}
                                                                            placeholder={`Enter ${type} text...`}
                                                                            class="w-full text-sm rounded-md border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                                                            oninput={`// Clear image input if typing? logic handled on save`}
                                                                        >{q[`${type}_text`] || ''}</textarea>
                                                                    </div>

                                                                    {/* Image Mode */}
                                                                    <div id={`mode-${type}-${q.id}-image`} class={`${initialMode === 'image' ? '' : 'hidden'}`}>
                                                                        <div class="flex justify-between items-center mb-2">
                                                                            <span class="text-xs text-gray-400 dark:text-neutral-500">Upload or Paste Image</span>
                                                                            <button type="button" onclick={`pasteImage('file-${type}-${q.id}', '${type}-preview-${q.id}')`} class="text-xs bg-gray-100 dark:bg-neutral-700 px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-neutral-600 text-blue-600 dark:text-blue-400 font-bold transition-colors">📋 Paste</button>
                                                                        </div>

                                                                        {q[`${type}_image_key`] && (
                                                                            <img src={`/download/${q[`${type}_image_key`]}`} class="max-h-32 object-contain mb-2 border rounded dark:border-neutral-700" />
                                                                        )}

                                                                        <input type="file" name={`q_${q.id}_${type}_image`} id={`file-${type}-${q.id}`} accept="image/*" class="block w-full text-xs text-gray-500 dark:text-neutral-400" />
                                                                        <img id={`${type}-preview-${q.id}`} class="max-h-32 object-contain mt-2 hidden border rounded bg-gray-50 dark:bg-neutral-900 dark:border-neutral-700" />
                                                                    </div>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                </div>


                                            </div>
                                        ) : (
                                            <div class="flex flex-col gap-4">
                                                {/* Read-Only View of Content */}


                                                <div>
                                                    <span class="text-xs font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-wider block mb-1">Question</span>
                                                    {q.question_text ? (
                                                        <div class="p-4 bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded text-gray-800 dark:text-neutral-200 whitespace-pre-wrap">{q.question_text}</div>
                                                    ) : (
                                                        q.question_image_key && <img src={`/download/${q.question_image_key}`} class="max-w-md border rounded dark:border-neutral-700" />
                                                    )}
                                                </div>

                                                {/* Stimulus */}
                                                {(q.stimulus_text || q.stimulus_image_key) && (
                                                    <div>
                                                        <span class="text-xs font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-wider block mb-1">Stimulus</span>
                                                        {q.stimulus_text ? (
                                                            <div class="p-4 bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded text-gray-700 dark:text-neutral-300 italic border-l-4 border-l-blue-400 dark:border-l-blue-600 whitespace-pre-wrap">{q.stimulus_text}</div>
                                                        ) : q.stimulus_image_key?.startsWith('pdf_crop:') ? (
                                                            <pdf-crop pdf-url={`/download/papers/${paper.id}.pdf`} crop-data={q.stimulus_image_key.replace('pdf_crop:', '')}></pdf-crop>
                                                        ) : (
                                                            <img src={`/download/${q.stimulus_image_key}`} class="max-w-md border rounded dark:border-neutral-700" />
                                                        )}
                                                    </div>
                                                )}

                                                {/* Answer */}
                                                <div>
                                                    <span class="text-xs font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-wider block mb-1">Answer / Marking Criteria</span>
                                                    {q.answer_text ? (
                                                        <div class="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded text-green-900 dark:text-green-300 whitespace-pre-wrap">{q.answer_text}</div>
                                                    ) : (
                                                        q.answer_image_key && <img src={`/download/${q.answer_image_key}`} class="max-w-md border rounded border-green-200 dark:border-green-800" />
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>


                                    {
                                        isLastInSegment && canEdit && !paper.is_locked && (
                                            <div class="bg-blue-50/50 dark:bg-blue-900/10 p-2 flex justify-center gap-2 border-t border-gray-100 dark:border-neutral-700">
                                                <span class="text-xs font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-widest self-center mr-2">{q.section_label} {q.segment_label} Controls:</span>

                                                <button
                                                    type="submit"
                                                    formaction={`/past-papers/paper/${paper.id}/adjust-segment`}
                                                    name="action" value="add"
                                                    class="text-xs bg-blue-100 dark:bg-blue-900/40 hover:bg-blue-200 dark:hover:bg-blue-800 text-blue-700 dark:text-blue-300 px-3 py-1 rounded font-bold transition-colors"
                                                    onclick={`
                                                    
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
                                                    class="text-xs bg-red-100 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-800 text-red-700 dark:text-red-300 px-3 py-1 rounded font-bold transition-colors"
                                                    onclick={`
                                                     if (!confirm('Remove last question of ${q.section_label} ${q.segment_label || ''}?')) return false;

                                                    
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
                                        )
                                    }
                                </div>
                            );
                        })}
                    </div>


                    {canEdit && (
                        <div class="fixed bottom-0 left-0 right-0 bg-white dark:bg-neutral-900 border-t border-gray-200 dark:border-neutral-800 p-4 shadow-lg z-50">
                            <div class="max-w-5xl mx-auto flex justify-between items-center">
                                <span class="text-gray-500 dark:text-neutral-400 text-sm">Ensure all changes are saved.</span>
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

                function switchMode(type, id, mode) {
                    const container = document.getElementById('container-' + type + '-' + id);
                    
                    
                    document.getElementById('mode-' + type + '-' + id + '-text').classList.toggle('hidden', mode !== 'text');
                    document.getElementById('mode-' + type + '-' + id + '-image').classList.toggle('hidden', mode !== 'image');

                    
                    const textBtn = container.querySelector('.var-mode-text');
                    const imgBtn = container.querySelector('.var-mode-image');

                    if (mode === 'text') {
                        textBtn.classList.remove('bg-gray-100', 'text-gray-500');
                        textBtn.classList.add('bg-blue-100', 'text-blue-700');
                        imgBtn.classList.remove('bg-blue-100', 'text-blue-700');
                        imgBtn.classList.add('bg-gray-100', 'text-gray-500');
                        
                        
                    } else {
                        imgBtn.classList.remove('bg-gray-100', 'text-gray-500');
                        imgBtn.classList.add('bg-blue-100', 'text-blue-700');
                        textBtn.classList.remove('bg-blue-100', 'text-blue-700');
                        textBtn.classList.add('bg-gray-100', 'text-gray-500');
                        
                        
                         const textArea = document.querySelector('textarea[name="q_' + id + '_' + type + '_text"]');
                         if(textArea) textArea.value = '';
                    }
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

                // AI Import PDF feedback
                const aiViewInput = document.getElementById('ai-view-pdf-input');
                const aiViewLabel = document.getElementById('ai-view-pdf-label');
                if (aiViewInput) {
                    aiViewInput.addEventListener('change', (e) => {
                        const file = e.target.files[0];
                        if (file) {
                            aiViewLabel.innerHTML = '<span class="block text-3xl mb-2">✅</span><span class="font-bold text-sm text-green-700 dark:text-green-400">' + file.name + '</span><span class="block text-xs mt-1 text-gray-400 dark:text-neutral-500">' + (file.size / 1024 / 1024).toFixed(2) + ' MB</span>';
                        }
                    });
                }
                const aiViewForm = document.getElementById('ai-view-import-form');
                if (aiViewForm) {
                    aiViewForm.addEventListener('submit', () => {
                        const btn = document.getElementById('ai-view-submit-btn');
                        const text = document.getElementById('ai-view-submit-text');
                        btn.disabled = true;
                        btn.classList.add('opacity-60', 'cursor-not-allowed');
                        text.textContent = 'Processing… 30-60s';
                    });
                }
            `}} />
        </Layout >
    );
})
app.post('/past-papers/paper/:id/clear-ai-status', async (c) => {
    const user = await getUser(c)
    const paperId = c.req.param('id')
    if (!user) return c.text('Unauthorised', 403)

    await c.env.DB.prepare("UPDATE papers SET ai_status = NULL, ai_error = NULL WHERE id = ?")
        .bind(paperId).run()

    return c.redirect(`/past-papers/paper/${paperId}`)
})

app.post('/past-papers/question/:id/sub-question', async (c) => {
    const user = await getUser(c)
    const qId = c.req.param('id')


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
        q.question_number,
        user.id,
        newIdx
    ).run();

    return c.redirect(`/past-papers/paper/${q.paper_id}#q-${qId}`);
});

app.post('/past-papers/topics/create', async (c) => {
    const user = await getUser(c)
    const body = await c.req.parseBody()
    const subject = body['subject'] as string
    const redirectId = body['redirect_paper_id']


    if (!user || !canCreateTopic(user, subject)) return c.text("Unauthorised", 401)

    const name = body['name'] as string
    if (subject && name) {
        await c.env.DB.prepare('INSERT INTO topics (subject, name) VALUES (?, ?)').bind(subject, name).run()
    }
    return c.redirect(`/past-papers/paper/${redirectId}`)
})


app.post('/past-papers/topics/delete', async (c) => {
    const user = await getUser(c)
    if (!user || user.permission_level < PermissionLevel.ADMIN) return c.text("Unauthorised", 401)

    const body = await c.req.parseBody()
    const topicId = body['topic_id']
    const redirectId = body['redirect_paper_id']

    await c.env.DB.prepare('DELETE FROM topics WHERE id = ?').bind(topicId).run()


    await c.env.DB.prepare('DELETE FROM question_topics WHERE topic_id = ?').bind(topicId).run()

    return c.redirect(`/past-papers/paper/${redirectId}`)
})


app.post('/past-papers/paper/:id/toggle-lock', async (c) => {
    const user = await getUser(c)
    const paperId = c.req.param('id')


    const paper = await c.env.DB.prepare('SELECT * FROM papers WHERE id = ?').bind(paperId).first<any>();
    if (!paper) return c.notFound();

    const hasCTag = user?.tags && (typeof user.tags === 'string' ? user.tags.includes('C*') : user.tags.includes('C*'));


    if (paper.is_locked) {
        if (!user || user.permission_level < 5) return c.text("Unauthorised to unlock", 403);

        await logAction(c.env.DB, user.id, 'UNLOCK_PAPER', `Unlocked paper ${paperId}`, parseInt(paperId), 'papers');
    } else {
        if (!user || (user.permission_level < 4 && !hasCTag)) return c.text("Unauthorised to lock", 403);


        const invalidQuestions = await c.env.DB.prepare(`
            SELECT count(q.id) as count
            FROM exam_questions q
            LEFT JOIN question_topics qt ON q.id = qt.question_id
            WHERE q.paper_id = ? AND q.is_deleted = 0
            GROUP BY q.id
            HAVING 
                count(qt.topic_id) = 0 OR 
                (q.question_image_key IS NULL AND q.question_text IS NULL) OR 
                q.question_type IS NULL OR 
                q.marks IS NULL OR 
                (q.answer_image_key IS NULL AND q.answer_text IS NULL)
        `).bind(paperId).all<any>();


        if (invalidQuestions.results.length > 0) {
            return c.text(`Cannot lock: ${invalidQuestions.results.length} questions have missing fields.`, 400);
        }

        await logAction(c.env.DB, user.id, 'LOCK_PAPER', `Locked paper ${paperId}`, parseInt(paperId), 'papers');
    }

    const newLockState = paper.is_locked ? 0 : 1;
    await c.env.DB.prepare('UPDATE papers SET is_locked = ? WHERE id = ?').bind(newLockState, paperId).run();

    return c.redirect(`/past-papers/paper/${paperId}`);
});


async function processBatchUpdate(c: any, paperId: string, user: any, body: any) {
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

    for (const key of Object.keys(body)) {
        if (key.startsWith('q_')) {
            const parts = key.split('_');
            if (parts.length >= 2) {
                qIds.add(parts[1]);
            }
        }
    }

    let updatedCount = 0;


    for (const qId of qIds) {
        const currentQ = currentQMap.get(qId);


        const newType = (body[`q_${qId}_question_type`] as string) || null;
        const newMarks = (body[`q_${qId}_marks`] as string) || null;
        const newMcAnswer = (body[`q_${qId}_mc_answer`] as string) || null;


        let newQText = (body[`q_${qId}_question_text`] as string) || null;
        let newAText = (body[`q_${qId}_answer_text`] as string) || null;
        let newSText = (body[`q_${qId}_stimulus_text`] as string) || null;
        if (newQText && newQText.trim() === '') newQText = null;
        if (newAText && newAText.trim() === '') newAText = null;
        if (newSText && newSText.trim() === '') newSText = null;


        let basicChanged = false;


        let newQImageKey = currentQ?.question_image_key;
        let newAImageKey = currentQ?.answer_image_key;
        let newSImageKey = currentQ?.stimulus_image_key;


        let imageUploaded = { question: false, answer: false, stimulus: false };
        for (const type of ['question', 'answer', 'stimulus']) {
            const file = body[`q_${qId}_${type}_image`] as File;
            if (file && file.size > 0 && file.name !== 'undefined') {
                const key = `questions/${Date.now()}-${type}-${Math.random().toString(36).slice(2)}`;
                await c.env.BUCKET.put(key, file);


                if (type === 'question') newQImageKey = key;
                if (type === 'answer') newAImageKey = key;
                if (type === 'stimulus') newSImageKey = key;


                if (type === 'question') newQText = null;
                if (type === 'answer') newAText = null;
                if (type === 'stimulus') newSText = null;

                imageUploaded[type as keyof typeof imageUploaded] = true;
                updatedCount++;
            }
        }


        if (newQText !== null) newQImageKey = null;
        if (newAText !== null) newAImageKey = null;
        if (newSText !== null) newSImageKey = null;

        // update DB
        if (currentQ) {
            if (currentQ.question_type !== newType) basicChanged = true;
            if (String(currentQ.marks || '') !== String(newMarks || '')) basicChanged = true;
            if (currentQ.mc_answer !== newMcAnswer) basicChanged = true;
            if (currentQ.question_text !== newQText) basicChanged = true;
            if (currentQ.answer_text !== newAText) basicChanged = true;
            if (currentQ.stimulus_text !== newSText) basicChanged = true;
            if (currentQ.question_image_key !== newQImageKey) basicChanged = true;
            if (currentQ.answer_image_key !== newAImageKey) basicChanged = true;
            if (currentQ.stimulus_image_key !== newSImageKey) basicChanged = true;
        } else {
            basicChanged = true;
        }

        if (basicChanged) {
            await c.env.DB.prepare(`
                UPDATE exam_questions 
                SET question_type = ?, marks = ?, mc_answer = ?, uploader_id = ?,
                    question_text = ?, answer_text = ?, stimulus_text = ?,
                    question_image_key = ?, answer_image_key = ?, stimulus_image_key = ?
                WHERE id = ?
            `).bind(
                newType,
                newMarks,
                newMcAnswer,
                user.id,
                newQText, newAText, newSText,
                newQImageKey, newAImageKey, newSImageKey,
                qId
            ).run();
            updatedCount++;
        }


        const existingTopicIdsStr = currentQ?.topic_ids || '';
        const existingTopicSet = new Set(existingTopicIdsStr.split(',').filter(Boolean));

        const topicIds = body[`q_${qId}_topic_ids[]`];
        const idsToInsert = Array.isArray(topicIds) ? topicIds : (topicIds ? [topicIds as string] : []);
        const newTopicSet = new Set(idsToInsert.map(String));


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


app.post('/past-papers/paper/:id/update-batch', async (c) => {
    const user = await getUser(c)
    const paperId = c.req.param('id')


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


app.post('/past-papers/question/:id/update', async (c) => {
    const user = await getUser(c)
    const qId = c.req.param('id')


    const q = await c.env.DB.prepare('SELECT q.*, p.subject, p.is_locked FROM exam_questions q JOIN papers p ON q.paper_id = p.id WHERE q.id = ?').bind(qId).first<any>();
    if (!q) return c.notFound();


    if (!user || !canUploadPastPaper(user, q.subject)) return c.text('Unauthorised', 403);


    if (q.is_locked && user.permission_level < 5) return c.text('Paper is locked', 403);

    const body = await c.req.parseBody();


    let qText = (body['question_text'] as string) || null;
    let aText = (body['answer_text'] as string) || null;
    let sText = (body['stimulus_text'] as string) || null;
    if (qText && qText.trim() === '') qText = null;
    if (aText && aText.trim() === '') aText = null;
    if (sText && sText.trim() === '') sText = null;

    let qImgKey = q.question_image_key;
    let aImgKey = q.answer_image_key;
    let sImgKey = q.stimulus_image_key;


    for (const type of ['question', 'answer', 'stimulus']) {
        const file = body[`${type}_image`] as File;
        if (file && file.size > 0 && file.name !== 'undefined') {
            const key = `questions/${Date.now()}-${type}-${Math.random().toString(36).slice(2)}`;
            await c.env.BUCKET.put(key, file);
            if (type === 'question') { qImgKey = key; qText = null; }
            if (type === 'answer') { aImgKey = key; aText = null; }
            if (type === 'stimulus') { sImgKey = key; sText = null; }
        }
    }


    if (qText !== null) qImgKey = null;
    if (aText !== null) aImgKey = null;
    if (sText !== null) sImgKey = null;


    await c.env.DB.prepare(`
        UPDATE exam_questions 
        SET question_type = ?, marks = ?, mc_answer = ?,
            question_text = ?, answer_text = ?, stimulus_text = ?,
            question_image_key = ?, answer_image_key = ?, stimulus_image_key = ?
        WHERE id = ?
    `).bind(
        (body['question_type'] as string) || null,
        (body['marks'] as string) || null,
        (body['mc_answer'] as string) || null,
        qText, aText, sText,
        qImgKey, aImgKey, sImgKey,
        qId
    ).run();


    await c.env.DB.prepare('DELETE FROM question_topics WHERE question_id = ?').bind(qId).run();


    const topicIds = body['topic_ids'];

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


app.post('/past-papers/paper/:id/adjust-segment', async (c) => {
    const user = await getUser(c);
    const paperId = c.req.param('id');
    const body = await c.req.parseBody();
    const action = body['action'] as string;
    const sectionLabel = body['section_label'] as string;
    const segmentLabel = body['segment_label'] as string;


    const paper = await c.env.DB.prepare('SELECT * FROM papers WHERE id = ?').bind(paperId).first<any>();
    if (!paper) return c.notFound();
    if (!user || !canUploadPastPaper(user, paper.subject)) return c.text('Unauthorised', 403);


    if (paper.is_locked) return c.text('Paper is locked', 403);


    await processBatchUpdate(c, paperId, user, body);


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

        return c.text('Segment not found or empty', 404);
    }

    if (action === 'add') {

        const lastNum = lastQ.question_number;
        const match = lastNum.match(/(\d+)$/);
        let newNum = "";

        if (match) {
            const numPart = match[1];
            const prefix = lastNum.substring(0, lastNum.length - numPart.length);
            const nextVal = parseInt(numPart) + 1;
            newNum = prefix + nextVal;
        } else {
            newNum = lastNum + "1";
        }


        const standardFullLabel = segmentLabel ? `${sectionLabel} ${newNum}` : `${sectionLabel} ${newNum}`;


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

app.post('/past-papers/paper/:id/upload-text', async (c) => {
    console.log(`[Import] Attempting JSON import for paper ${c.req.param('id')}`);
    const user = await getUser(c);
    const paperId = c.req.param('id');

    const paper = await c.env.DB.prepare('SELECT * FROM papers WHERE id = ?').bind(paperId).first<any>();
    if (!paper) return c.notFound();
    if (!user || !canUploadPastPaper(user, paper.subject)) return c.text('Unauthorised', 403);
    if (paper.is_locked && user.permission_level < 5) return c.text('Paper is locked', 403);

    const body = await c.req.parseBody();
    const file = body['text_file'];
    if (!(file instanceof File)) return c.text("Invalid file uploaded", 400);

    const rawText = await file.text();
    let parsed: any;
    try {
        let cleaned = rawText.trim()
            .replace(/^```(?:json)?\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim();
        const firstBrace = cleaned.indexOf('{');
        const lastBrace = cleaned.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace >= firstBrace) {
            cleaned = cleaned.slice(firstBrace, lastBrace + 1);
        }
        parsed = JSON.parse(cleaned);
    } catch (e) {
        return c.text("Invalid JSON file uploaded", 400);
    }

    if (!parsed.questions || !Array.isArray(parsed.questions)) {
        return c.text("JSON must contain a 'questions' array", 400);
    }

    const questionsToProcess = parsed.questions;

    const existingQs = await c.env.DB.prepare('SELECT id FROM exam_questions WHERE paper_id = ?').bind(paperId).all<{ id: number }>();
    if (existingQs.results.length > 0) {
        const ids = existingQs.results.map((q: any) => q.id);
        for (const id of ids) {
            await c.env.DB.prepare('DELETE FROM question_topics WHERE question_id = ?').bind(id).run();
        }
    }
    await c.env.DB.prepare('DELETE FROM exam_questions WHERE paper_id = ?').bind(paperId).run();

    const topicRows = await c.env.DB.prepare('SELECT id, name FROM topics WHERE subject = ?').bind(paper.subject).all<{ id: number, name: string }>();
    const topicCache = new Map<string, number>();
    for (const t of topicRows.results) {
        topicCache.set(t.name.toLowerCase().trim(), t.id);
    }

    let insertedCount = 0;
    const stmt = c.env.DB.prepare(`
        INSERT INTO exam_questions 
        (paper_id, section_label, segment_label, question_number, question_full_label, question_type, marks, question_text, mc_answer, answer_text, stimulus_image_key, uploader_id, ordering_index)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING id
    `);

    for (let i = 0; i < questionsToProcess.length; i++) {
        const q = questionsToProcess[i];

        let stimulusKey = null;
        if (q.stimulus_coordinates) {
            stimulusKey = `pdf_crop:${JSON.stringify(q.stimulus_coordinates)}`;
        }

        const insertResult = await stmt.bind(
            paperId,
            q.section_label || 'I',
            q.segment_label || null,
            q.question_number || String(i + 1),
            q.question_full_label || `${q.section_label || 'I'} ${q.question_number || String(i + 1)}`,
            q.question_type || 'short_answer',
            q.marks || null,
            q.question_text || null,
            q.mc_answer || null,
            q.answer_text || null,
            stimulusKey,
            2,
            i + 1
        ).first<{ id: number }>();

        if (insertResult && q.topics && q.topics.length > 0) {
            for (const topicName of q.topics) {
                const key = topicName.toLowerCase().trim();
                let topicId = topicCache.get(key);

                if (!topicId) {
                    const newTopic = await c.env.DB.prepare(
                        'INSERT INTO topics (subject, name) VALUES (?, ?) ON CONFLICT(subject, name) DO UPDATE SET name = name RETURNING id'
                    ).bind(paper.subject, topicName.trim()).first<{ id: number }>();
                    if (newTopic) {
                        topicId = newTopic.id;
                        topicCache.set(key, topicId);
                    }
                }

                if (topicId) {
                    await c.env.DB.prepare(
                        'INSERT OR IGNORE INTO question_topics (question_id, topic_id) VALUES (?, ?)'
                    ).bind(insertResult.id, topicId).run();
                }
            }
        }
        insertedCount++;
    }

    await logAction(c.env.DB, user.id, 'IMPORT_JSON', `Imported ${insertedCount} questions via JSON.`, parseInt(paperId), 'papers');

    return c.redirect(`/past-papers/paper/${paperId}`);
});

app.post('/past-papers/paper/:id/upload-pdf', async (c) => {
    const user = await getUser(c);
    const paperId = c.req.param('id');

    const paper = await c.env.DB.prepare('SELECT * FROM papers WHERE id = ?').bind(paperId).first<any>();
    if (!paper) return c.notFound();
    if (!user || !canUploadPastPaper(user, paper.subject)) return c.text('Unauthorised', 403);
    if (paper.is_locked && user.permission_level < 5) return c.text('Paper is locked', 403);

    const body = await c.req.parseBody();
    const file = body['pdf_file'];
    if (!(file instanceof File)) return c.text("Invalid file uploaded", 400);

    const arrayBuffer = await file.arrayBuffer();
    await c.env.BUCKET.put(`papers/${paperId}.pdf`, arrayBuffer, {
        httpMetadata: { contentType: 'application/pdf' },
    });

    await c.env.DB.prepare('UPDATE papers SET reference_link = ? WHERE id = ?')
        .bind(`/download/papers/${paperId}.pdf`, paperId)
        .run();

    await logAction(c.env.DB, user.id, 'UPLOAD_PAPER_PDF', `Uploaded reference PDF for paper ${paperId}`, parseInt(paperId), 'papers');

    return c.redirect(`/past-papers/paper/${paperId}`);
});

export default app;