import { Hono } from 'hono'
import { Layout } from '../layout'
import { getUser, renderTags, logAction } from '../utils'
import { canUploadPastPaper, canCreateTopic, canModerateSubject, canViewDeleted, PermissionLevel } from '../permissions'
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
    // JOIN with exam_questions to get counts and sum of marks
    const papers = await c.env.DB.prepare(`
        SELECT p.*, count(q.id) as question_count, sum(q.marks) as total_marks 
        FROM papers p 
        LEFT JOIN exam_questions q ON p.id = q.paper_id AND q.is_deleted = 0
        WHERE p.subject = ? 
        GROUP BY p.id 
        ORDER BY p.academic_year DESC, p.created_at DESC
    `).bind(subject).all();

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

                <div class="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                    <div class="relative w-full md:w-96">
                        <input type="text" id="search-input" placeholder="Search papers..." class="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" />
                        <svg class="w-5 h-5 text-gray-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                    </div>
                    <div class="flex items-center gap-2 bg-white rounded-lg p-1 border border-gray-200 shadow-sm">
                        <button id="view-list" class="p-2 rounded text-gray-500 hover:bg-gray-50 transition-colors" title="List View">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
                        </button>
                        <button id="view-grid" class="p-2 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors" title="Grid View">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>
                        </button>
                    </div>
                </div>

                {/* Grid View Container */}
                {/* Grid View Container */}
                <div id="grid-view-container" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {papers.results.length === 0 ? (
                        <div class="col-span-full text-center py-12 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                            No papers found for {subject}.
                        </div>
                    ) : (
                        papers.results.map((p: any) => (
                            <a
                                href={`/past-papers/paper/${p.id}`}
                                class="search-item block bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md hover:border-blue-400 transition group h-full flex flex-col justify-between"
                                data-search-text={`${p.school_name} ${p.academic_year} ${subject}`}
                            >
                                <div>
                                    <div class="flex justify-between items-start mb-4">
                                        <div class="bg-blue-50 text-blue-800 text-xs font-bold px-2 py-1 rounded uppercase tracking-wide">
                                            {p.academic_year}
                                        </div>
                                        {p.is_locked ? (
                                            <span class="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded border border-gray-200">* Locked</span>
                                        ) : null}
                                    </div>
                                    <h3 class="text-xl font-bold text-gray-900 group-hover:text-blue-700 mb-2">
                                        {p.school_name}
                                    </h3>
                                    <div class="flex flex-col gap-1">
                                        <p class="text-sm text-gray-500">
                                            {p.paper_type || 'Trial Paper'}
                                        </p>
                                        <div class="flex items-center gap-3 text-xs text-gray-400 font-medium">
                                            <span> {p.question_count || 0} Questions</span>
                                            <span> {p.total_marks || 0} Marks</span>
                                        </div>
                                    </div>
                                </div>
                            </a>
                        ))
                    )}
                </div>

                {/* List View Container (Table) */}
                {/* List View Container (Table) */}
                <div id="list-view-container" class="hidden overflow-x-auto bg-white rounded-lg shadow border border-gray-200">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Year</th>
                                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">School</th>
                                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                                <th scope="col" class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Total Q, M</th>
                                <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                            {papers.results.length === 0 ? (
                                <tr>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center" colspan={5}>No papers found.</td>
                                </tr>
                            ) : (
                                papers.results.map((p: any) => (
                                    <tr
                                        class="search-item hover:bg-gray-50 transition-colors cursor-pointer"
                                        data-search-text={`${p.school_name} ${p.academic_year} ${subject}`}
                                        onclick={`window.location.href='/past-papers/paper/${p.id}'`}
                                    >
                                        <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-blue-700">
                                            {p.academic_year}
                                        </td>
                                        <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                                            {p.school_name}
                                            {p.is_locked ? <span class="ml-2 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded border">*</span> : null}
                                        </td>
                                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {p.paper_type || 'Trial Paper'}
                                        </td>
                                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                                            <span class="mr-3" title="Questions">Q {p.question_count || 0}</span>
                                            <span title="Marks">M/{p.total_marks || 0}</span>
                                        </td>
                                        <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-blue-600 hover:text-blue-900">
                                            View
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
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
                        <input type="text" name="school_name" list="nsw-schools" required placeholder="Select or type school..." class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
                        <datalist id="nsw-schools">
                            <option value="Sydney Boys High School" />
                            <option value="Sydney Girls High School" />
                            <option value="North Sydney Boys High School" />
                            <option value="North Sydney Girls High School" />
                            <option value="Sydney Grammar School" />
                            <option value="James Ruse Agricultural High School" />
                            <option value="Baulkham Hills High School" />
                            <option value="Hornsby Girls High School" />
                        </datalist>
                    </div>

                    <div>
                        <label class="block text-sm font-bold text-gray-700 mb-1">Paper Type</label>
                        <select name="paper_type" class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
                            <option value="Trial Paper" selected>Trial Paper</option>
                            <option value="HSC Examination">HSC Examination</option>
                            <option value="Assessment Task">Assessment Task</option>
                            <option value="Independent Trial">Yearly</option>
                            <option value="Half Yearly">Half Yearly</option>

                        </select>
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
    const type = body['paper_type'] as string || 'Trial Paper';

    // Insert Paper
    const paperRes = await c.env.DB.prepare('INSERT INTO papers (subject, school_name, academic_year, reference_link, paper_type) VALUES (?, ?, ?, ?, ?) RETURNING id')
        .bind(subject, school, year, link, type)
        .first<{ id: number }>();

    if (!paperRes) {
        return c.text('Failed to create paper', 500);
    }

    const paperId = paperRes.id;

    // Process placeholders
    const statements = [];
    let globalOrderIndex = 1;

    for (let i = 0; i < 20; i++) {
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
                        (paper_id, section_label, segment_label, question_number, question_full_label, uploader_id, ordering_index)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    `).bind(paperId, section, label || null, qNum, fullLabel, user.id, globalOrderIndex)
                );
                globalOrderIndex++;
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
    const paper = await c.env.DB.prepare('SELECT * FROM papers WHERE id = ?').bind(paperId).first<any>();
    if (!paper) return c.notFound();

    // Fetch questions + topics - ORDER BY ordering_index
    const questions = await c.env.DB.prepare(`
        SELECT q.*, group_concat(t.name, ', ') as topic_names, group_concat(t.id, ',') as topic_ids
        FROM exam_questions q
        LEFT JOIN question_topics qt ON q.id = qt.question_id
        LEFT JOIN topics t ON qt.topic_id = t.id
        WHERE q.paper_id = ? AND q.is_deleted = 0
        GROUP BY q.id
        ORDER BY q.ordering_index ASC
    `).bind(paperId).all();

    // Fetch all topics for dropdown
    const allTopics = await c.env.DB.prepare('SELECT * FROM topics WHERE subject = ? ORDER BY name ASC').bind(paper.subject).all();

    // Check for incomplete questions (missing question image)
    const incompleteQuestions = questions.results.filter((q: any) => !q.question_image_key).length;

    // Check permissions
    // Tag check: "C*" allows locking. 
    // Locking: Permission >= 4 OR tag C*
    // Unlocking: Permission >= 5
    // Editing Locked: Permission >= 5
    const hasCTag = user?.tags && (typeof user.tags === 'string' ? user.tags.includes('C*') : user.tags.includes('C*')); // Check JSON or string
    const canLock = user && (user.permission_level >= 4 || hasCTag);
    const canUnlock = user && user.permission_level >= 5;

    // Validate Locking: Can only lock if 0 incomplete questions
    const canLockValidate = canLock && incompleteQuestions === 0;

    // Normal edit permission
    const canEditSubject = user && canUploadPastPaper(user, paper.subject);

    // Final Edit Permission: Must have subject perm AND (not locked OR (locked AND canUnlock))
    const canEdit = canEditSubject && (!paper.is_locked || canUnlock);

    const canManageTopics = user && user.permission_level >= PermissionLevel.ADMIN;

    // Build question list with next_index for gap calculation
    const qList = questions.results as any[];
    const qWithNext = qList.map((q, i) => {
        const nextQ = qList[i + 1];
        return {
            ...q,
            next_ordering_index: nextQ ? nextQ.ordering_index : q.ordering_index + 1
        };
    });

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
                                        🔓 Unlock Paper
                                    </button>
                                </form>
                            )
                        ) : (
                            canLock && (
                                <>
                                    {incompleteQuestions > 0 ? (
                                        <div class="group relative">
                                            <button disabled class="bg-gray-100 text-gray-400 border border-gray-200 text-sm font-bold px-3 py-2 rounded cursor-not-allowed flex items-center gap-2">
                                                Lock Paper
                                            </button>
                                            <div class="absolute right-0 top-full mt-2 w-64 bg-gray-800 text-white text-xs p-2 rounded shadow-lg opacity-0 group-hover:opacity-100 transition pointer-events-none z-10">
                                                Cannot lock: {incompleteQuestions} questions are missing images.
                                            </div>
                                        </div>
                                    ) : (
                                        <button onclick="document.getElementById('lock-modal').showModal()" class="bg-gray-100 text-gray-600 border border-gray-300 text-sm font-bold px-3 py-2 rounded shadow-sm hover:bg-gray-200 flex items-center gap-2">
                                            Lock Paper
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
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                            Confirm Lock
                        </h3>
                        <p class="text-gray-600 mb-6">
                            You are about to lock this paper. By proceeding, you verify that:
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
                                    I Understand, Lock Paper
                                </button>
                            </form>
                        </div>
                    </div>
                </dialog>

                {/* Topic Management for Admins */}
                {canManageTopics && (
                    <div class="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-6">
                        <details>
                            <summary class="font-bold text-gray-700 cursor-pointer">Topic Management (Admin)</summary>
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

                <div class="space-y-4">
                    {qWithNext.map((q: any) => (
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

                            {/* Edit / Detail Mode (Auto-expanded if canEdit is true) */}
                            <div id={`detail-${q.id}`} class={`${canEdit ? '' : 'hidden'} border-t border-gray-100 bg-gray-50 p-6`}>
                                {canEdit ? (
                                    <div class="space-y-6">
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

                                        {/* Add Sub Question Button */}
                                        <div class="border-t border-gray-200 pt-4 flex justify-end">
                                            <form action={`/past-papers/question/${q.id}/sub-question`} method="post" class="flex gap-2 items-center">
                                                <input type="hidden" name="ordering_index" value={q.ordering_index} />
                                                <input type="hidden" name="next_ordering_index" value={q.next_ordering_index} />
                                                <input type="text" name="new_number" placeholder="e.g. 1.a" class="text-xs border rounded p-1 w-20" required />
                                                <button class="bg-green-600 text-white text-xs px-3 py-1 rounded font-bold hover:bg-green-700">+ Insert Sub-Question</button>
                                            </form>
                                        </div>
                                    </div>
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

// Insert Sub-Question
app.post('/past-papers/question/:id/sub-question', async (c) => {
    const user = await getUser(c)
    const qId = c.req.param('id')

    // Fetch parent question
    const q = await c.env.DB.prepare('SELECT q.*, p.subject FROM exam_questions q JOIN papers p ON q.paper_id = p.id WHERE q.id = ?').bind(qId).first<any>();
    if (!q) return c.notFound();
    if (!user || !canUploadPastPaper(user, q.subject)) return c.text('Unauthorized', 403);

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
        newNumber,
        user.id,
        newIdx
    ).run();

    return c.redirect(`/past-papers/paper/${q.paper_id}#q-${qId}`);
});

// Create Topic (Admin/Subject Mod)
app.post('/past-papers/topics/create', async (c) => {
    const user = await getUser(c)
    const body = await c.req.parseBody()
    const subject = body['subject'] as string
    const redirectId = body['redirect_paper_id']

    // Permission check inside canCreateTopic
    if (!user || !canCreateTopic(user, subject)) return c.text("Unauthorized", 401)

    const name = body['name'] as string
    if (subject && name) {
        await c.env.DB.prepare('INSERT INTO topics (subject, name) VALUES (?, ?)').bind(subject, name).run()
    }
    return c.redirect(`/past-papers/paper/${redirectId}`)
})

// Delete Topic (Admin Only)
app.post('/past-papers/topics/delete', async (c) => {
    const user = await getUser(c)
    if (!user || user.permission_level < PermissionLevel.ADMIN) return c.text("Unauthorized", 401)

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
        if (!user || user.permission_level < 5) return c.text("Unauthorized to unlock", 403);

        await logAction(c.env.DB, user.id, 'UNLOCK_PAPER', `Unlocked paper ${paperId}`, parseInt(paperId), 'papers');
    } else {
        if (!user || (user.permission_level < 4 && !hasCTag)) return c.text("Unauthorized to lock", 403);

        // Validation: Check for questions without images
        const incompleteCount = await c.env.DB.prepare('SELECT count(*) as count FROM exam_questions WHERE paper_id = ? AND question_image_key IS NULL AND is_deleted = 0').bind(paperId).first<any>();
        if (incompleteCount.count > 0) {
            return c.text(`Cannot lock: ${incompleteCount.count} questions are missing images.`, 400);
        }

        await logAction(c.env.DB, user.id, 'LOCK_PAPER', `Locked paper ${paperId}`, parseInt(paperId), 'papers');
    }

    const newLockState = paper.is_locked ? 0 : 1;
    await c.env.DB.prepare('UPDATE papers SET is_locked = ? WHERE id = ?').bind(newLockState, paperId).run();

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
    if (!user || !canUploadPastPaper(user, q.subject)) return c.text('Unauthorized', 403);

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

export default app