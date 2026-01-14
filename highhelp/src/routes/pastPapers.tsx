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
    const tab = c.req.query('tab') || 'browse';

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

    // 2. Subject View
    const canUpload = user && canUploadPastPaper(user, subject);

    // Tabs Config
    const tabs = [
        { id: 'browse', label: 'Browse Papers' },
        { id: 'practice', label: 'Practice Questions' },
        { id: 'exam', label: 'Mock Exam' },
        { id: 'review', label: 'Review' },
    ];

    let content;

    if (tab === 'browse') {
        const papers = await c.env.DB.prepare(`
            SELECT p.*, count(q.id) as question_count, sum(q.marks) as total_marks 
            FROM papers p 
            LEFT JOIN exam_questions q ON p.id = q.paper_id AND q.is_deleted = 0
            WHERE p.subject = ? 
            GROUP BY p.id 
            ORDER BY p.academic_year DESC, p.created_at DESC
        `).bind(subject).all();

        content = (
            <div>
                <div class="flex items-center justify-between mb-6">
                    <h1 class="text-3xl font-bold">{subject}</h1>
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
                </div>

                <div id="grid-view-container" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {papers.results.length === 0 ? (
                        <div class="col-span-full text-center py-12 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                            No papers found for {subject}.
                        </div>
                    ) : (
                        papers.results.map((p: any) => (
                            <a href={`/past-papers/paper/${p.id}`} class="search-item block bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md hover:border-blue-400 transition group h-full flex flex-col justify-between" data-search-text={`${p.school_name} ${p.academic_year} ${subject}`}>
                                <div>
                                    <div class="flex justify-between items-start mb-4">
                                        <div class="bg-blue-50 text-blue-800 text-xs font-bold px-2 py-1 rounded uppercase tracking-wide">{p.academic_year}</div>
                                        {p.is_locked ? <span class="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded border border-gray-200">* Locked</span> : null}
                                    </div>
                                    <h3 class="text-xl font-bold text-gray-900 group-hover:text-blue-700 mb-2">{p.school_name}</h3>
                                    <div class="flex flex-col gap-1">
                                        <p class="text-sm text-gray-500">{p.paper_type || 'Trial Paper'}</p>
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
            </div>
        );

    } else if (tab === 'practice') {
        const page = parseInt(c.req.query('page') || '1');
        const limit = 20;
        const offset = (page - 1) * limit;

        // Filters
        const filterTopic = c.req.query('topic');
        const filterYear = c.req.query('year');
        const filterStatus = c.req.query('status'); // done, undone
        const sort = c.req.query('sort') || 'school_asc';

        let query = `
            SELECT q.*, p.school_name, p.academic_year, 
                   group_concat(t.name, ', ') as topic_names,
                   ua.is_completed, ua.marks_awarded
            FROM exam_questions q
            JOIN papers p ON q.paper_id = p.id
            LEFT JOIN question_topics qt ON q.id = qt.question_id
            LEFT JOIN topics t ON qt.topic_id = t.id
            LEFT JOIN user_question_attempts ua ON q.id = ua.question_id AND ua.user_id = ?
            WHERE p.subject = ? AND q.is_deleted = 0
        `;
        const params: any[] = [user?.id, subject];

        if (filterTopic) {
            query += ` AND qt.topic_id = ?`;
            params.push(filterTopic);
        }
        if (filterYear) {
            query += ` AND p.academic_year = ?`;
            params.push(filterYear);
        }
        if (filterStatus === 'done') {
            query += ` AND ua.is_completed = 1`;
        } else if (filterStatus === 'undone') {
            query += ` AND (ua.is_completed IS NULL OR ua.is_completed = 0)`;
        }

        query += ` GROUP BY q.id`;

        // Sort
        if (sort === 'year_desc') query += ` ORDER BY p.academic_year DESC, q.ordering_index ASC`;
        else if (sort === 'year_asc') query += ` ORDER BY p.academic_year ASC, q.ordering_index ASC`;
        else query += ` ORDER BY p.school_name ASC, q.ordering_index ASC`;

        query += ` LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        const questions = await c.env.DB.prepare(query).bind(...params).all();
        const allTopics = await c.env.DB.prepare('SELECT * FROM topics WHERE subject = ? ORDER BY name ASC').bind(subject).all();


        content = (
            <div>
                <h1 class="text-3xl font-bold mb-6">Practice Questions</h1>

                {/* Filters Bar */}
                <form action="/past-papers" method="get" class="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6 flex flex-wrap gap-4 items-end">
                    <input type="hidden" name="subject" value={subject} />
                    <input type="hidden" name="tab" value="practice" />

                    <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Topic</label>
                        <select name="topic" class="rounded border-gray-300 text-sm w-48">
                            <option value="">All Topics</option>
                            {allTopics.results.map((t: any) => <option value={t.id} selected={filterTopic == t.id}>{t.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Year</label>
                        <input type="number" name="year" value={filterYear} placeholder="Any" class="rounded border-gray-300 text-sm w-24" />
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Status</label>
                        <select name="status" class="rounded border-gray-300 text-sm w-32">
                            <option value="">All</option>
                            <option value="done" selected={filterStatus == 'done'}>Completed</option>
                            <option value="undone" selected={filterStatus == 'undone'}>Unattempted</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Sort</label>
                        <select name="sort" class="rounded border-gray-300 text-sm w-32">
                            <option value="school_asc" selected={sort == 'school_asc'}>School A-Z</option>
                            <option value="year_desc" selected={sort == 'year_desc'}>Year (Newest)</option>
                            <option value="year_asc" selected={sort == 'year_asc'}>Year (Oldest)</option>
                        </select>
                    </div>
                    <button class="bg-blue-600 text-white px-4 py-2 rounded font-bold text-sm">Filter</button>
                    <a href={`/past-papers?subject=${encodeURIComponent(subject)}&tab=practice`} class="text-sm text-gray-500 underline ml-2">Reset</a>
                </form>

                {/* Question List */}
                <div class="space-y-4">
                    {questions.results.length === 0 ? (
                        <div class="text-center py-12 text-gray-500">No questions found matching your filters.</div>
                    ) : (
                        questions.results.map((q: any) => (
                            <div onclick={`window.location.href='/past-papers/attempt/${q.id}?source=practice&topic=${filterTopic || ''}&year=${filterYear || ''}&status=${filterStatus || ''}&sort=${sort}'`} class="block bg-white p-4 rounded-lg border border-gray-200 hover:border-blue-400 hover:shadow-md transition cursor-pointer group">
                                <div class="flex justify-between items-start">
                                    <div>
                                        <div class="flex items-center gap-2 mb-1">
                                            <span class="font-bold text-gray-900 group-hover:text-blue-700">{q.school_name} {q.academic_year}</span>
                                            <span class="text-gray-400 text-sm">| {q.section_label} {q.question_number}</span>
                                            {q.is_completed ? <span class="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded font-bold">Done</span> : null}
                                        </div>
                                        <div class="text-sm text-gray-500">{q.topic_names || 'No topic'}</div>
                                    </div>
                                    <div class="text-right">
                                        <span class="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded font-bold">{q.marks} Marks</span>
                                        {q.marks_awarded != null && (
                                            <div class="text-xs font-bold text-blue-600 mt-1">
                                                My Score: {q.marks_awarded}/{q.marks}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
                {/* Pagination (Simple) */}
                <div class="mt-8 flex justify-center gap-2">
                    {page > 1 && <a href={`/past-papers?subject=${encodeURIComponent(subject)}&tab=practice&page=${page - 1}&topic=${filterTopic || ''}&year=${filterYear || ''}&status=${filterStatus || ''}&sort=${sort}`} class="px-4 py-2 border rounded bg-white hover:bg-gray-50">Previous</a>}
                    <a href={`/past-papers?subject=${encodeURIComponent(subject)}&tab=practice&page=${page + 1}&topic=${filterTopic || ''}&year=${filterYear || ''}&status=${filterStatus || ''}&sort=${sort}`} class="px-4 py-2 border rounded bg-white hover:bg-gray-50">Next</a>
                </div>
            </div>
        )

    } else {
        content = (
            <div class="text-center py-20 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                <h3 class="text-xl font-bold text-gray-400 mb-2">Coming Soon</h3>
                <p class="text-gray-500">{tab === 'exam' ? 'Mock Exam functionality is under development.' : 'Review functionality is under development.'}</p>
            </div>
        )
    }

    return c.html(
        <Layout title={`Past Papers - ${subject}`} user={user}>
            <div class="mx-auto">
                {/* Breadcrumbs */}
                <div class="flex items-center gap-2 text-sm text-gray-500 mb-4">
                    <a href="/past-papers" class="hover:underline">Past Papers</a>
                    <span>/</span>
                    <span class="font-bold text-gray-700">{subject}</span>
                </div>

                {/* Tabs */}
                <div class="border-b border-gray-200 mb-8">
                    <nav class="-mb-px flex space-x-8">
                        {tabs.map(t => (
                            <a href={`/past-papers?subject=${encodeURIComponent(subject)}&tab=${t.id}`}
                                class={`
                                    whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors
                                    ${tab === t.id ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                               `}>
                                {t.label}
                            </a>
                        ))}
                    </nav>
                </div>

                {content}
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
                                        🔓 Unlock Paper
                                    </button>
                                </form>
                            )
                        ) : (
                            canLock && (
                                <>
                                    {incompleteQuestionsCount > 0 ? (
                                        <div class="group relative">
                                            <button disabled class="bg-gray-100 text-gray-400 border border-gray-200 text-sm font-bold px-3 py-2 rounded cursor-not-allowed flex items-center gap-2">
                                                🔒 Lock Paper
                                            </button>
                                            <div class="absolute right-0 top-full mt-2 w-64 bg-gray-800 text-white text-xs p-2 rounded shadow-lg opacity-0 group-hover:opacity-100 transition pointer-events-none z-10">
                                                Cannot lock: {incompleteQuestionsCount} questions have missing fields.
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
                            <summary class="font-bold text-gray-700 cursor-pointer">Topic Management</summary>
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

                {/* Topic Management for Admins */}
                {/* ... existing topic code ... */}

                {/* Batch Form Start */}
                <form action={`/past-papers/paper/${paper.id}/update-batch`} method="post" enctype="multipart/form-data">
                    <div class="space-y-4 pb-24">
                        {qWithNext.map((q: any) => (
                            <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden" id={`q-${q.id}`}>
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
                                                                <option value="multiple_choice" selected={q.question_type === 'multiple_choice'}>Multiple Choice</option>
                                                                <option value="short_answer" selected={q.question_type === 'short_answer'}>Short Answer</option>
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
                            </div>
                        ))}
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
    const qIds = new Set<string>();

    // Identify which questions are being updated based on form keys (e.g., q_123_marks)
    for (const key of Object.keys(body)) {
        if (key.startsWith('q_')) {
            const parts = key.split('_');
            if (parts.length >= 2) {
                qIds.add(parts[1]);
            }
        }
    }

    // Process updates for each question
    for (const qId of qIds) {
        // 1. Update Basic Fields
        await c.env.DB.prepare(`
            UPDATE exam_questions 
            SET question_type = ?, marks = ?, mc_answer = ?, uploader_id = ?
            WHERE id = ?
        `).bind(
            (body[`q_${qId}_question_type`] as string) || null,
            (body[`q_${qId}_marks`] as string) || null,
            (body[`q_${qId}_mc_answer`] as string) || null,
            user.id, // Update attribution to current saver
            qId
        ).run();

        // 2. Handle Images
        for (const type of ['question', 'answer', 'stimulus']) {
            const file = body[`q_${qId}_${type}_image`] as File;
            if (file && file.size > 0 && file.name !== 'undefined') {
                const key = `questions/${Date.now()}-${type}-${Math.random().toString(36).slice(2)}`;
                await c.env.BUCKET.put(key, file);
                await c.env.DB.prepare(`UPDATE exam_questions SET ${type}_image_key = ? WHERE id = ?`).bind(key, qId).run();
            }
        }

        // 3. Handle Topics
        await c.env.DB.prepare('DELETE FROM question_topics WHERE question_id = ?').bind(qId).run();
        // Look for the key with []
        const topicIds = body[`q_${qId}_topic_ids[]`];
        const idsToInsert = Array.isArray(topicIds) ? topicIds : (topicIds ? [topicIds as string] : []);

        if (idsToInsert.length > 0) {
            const placeholders = idsToInsert.map(() => '(?, ?)').join(',');
            const values = [];
            for (const tid of idsToInsert) {
                values.push(qId, tid);
            }
            await c.env.DB.prepare(`INSERT INTO question_topics (question_id, topic_id) VALUES ${placeholders}`).bind(...values).run();
        }
    }

    await logAction(c.env.DB, user.id, 'BATCH_UPDATE_QUESTIONS', `Batch updated ${qIds.size} questions in paper ${paperId}`, parseInt(paperId), 'papers');

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


// Question Attempt View
app.get('/past-papers/attempt/:id', async (c) => {
    const user = await getUser(c)
    if (!user) return c.redirect('/login')

    const qId = c.req.param('id')

    // Fetch Question Details
    const q = await c.env.DB.prepare(`
        SELECT q.*, p.subject, p.school_name, p.academic_year, 
               group_concat(t.name, ', ') as topic_names
        FROM exam_questions q
        JOIN papers p ON q.paper_id = p.id
        LEFT JOIN question_topics qt ON q.id = qt.question_id
        LEFT JOIN topics t ON qt.topic_id = t.id
        WHERE q.id = ?
        GROUP BY q.id
    `).bind(qId).first<any>();

    if (!q) return c.notFound();

    // Fetch existing attempt
    const attempt = await c.env.DB.prepare(`
        SELECT * FROM user_question_attempts 
        WHERE user_id = ? AND question_id = ?
    `).bind(user.id, qId).first<any>();

    // Context Navigation
    const source = c.req.query('source');
    const filterTopic = c.req.query('topic');
    const filterYear = c.req.query('year');
    const filterStatus = c.req.query('status'); // done, undone
    const sort = c.req.query('sort') || 'school_asc';

    let nextId = null;
    let prevId = null;
    const currentParams = `source=${source || ''}&topic=${filterTopic || ''}&year=${filterYear || ''}&status=${filterStatus || ''}&sort=${sort}`;

    if (source === 'practice') {
        // Fetch ALL IDs matching the filters to find current position
        // Ideally we cache this or optimize, but for < ~5000 qs this is usually fast enough in SQLite
        let query = `
            SELECT q.id
            FROM exam_questions q
            JOIN papers p ON q.paper_id = p.id
            LEFT JOIN question_topics qt ON q.id = qt.question_id
            LEFT JOIN user_question_attempts ua ON q.id = ua.question_id AND ua.user_id = ?
            WHERE p.subject = ? AND q.is_deleted = 0
        `;
        const params: any[] = [user.id, q.subject];

        if (filterTopic) { query += ` AND qt.topic_id = ?`; params.push(filterTopic); }
        if (filterYear) { query += ` AND p.academic_year = ?`; params.push(filterYear); }
        if (filterStatus === 'done') { query += ` AND ua.is_completed = 1`; }
        else if (filterStatus === 'undone') { query += ` AND (ua.is_completed IS NULL OR ua.is_completed = 0)`; }

        query += ` GROUP BY q.id`;

        if (sort === 'year_desc') query += ` ORDER BY p.academic_year DESC, q.ordering_index ASC`;
        else if (sort === 'year_asc') query += ` ORDER BY p.academic_year ASC, q.ordering_index ASC`;
        else query += ` ORDER BY p.school_name ASC, q.ordering_index ASC`;

        const allIdsResult = await c.env.DB.prepare(query).bind(...params).all<{ id: number }>();
        const allIds = allIdsResult.results.map(r => r.id);
        const currentIndex = allIds.indexOf(parseInt(qId));

        if (currentIndex !== -1) {
            if (currentIndex > 0) prevId = allIds[currentIndex - 1];
            if (currentIndex < allIds.length - 1) nextId = allIds[currentIndex + 1];
        }

    } else {
        // Default: Next/Prev in same paper
        const neighbors = await c.env.DB.prepare(`
            SELECT id FROM exam_questions 
            WHERE paper_id = ? AND ordering_index > ? AND is_deleted = 0
            ORDER BY ordering_index ASC LIMIT 1
        `).bind(q.paper_id, q.ordering_index).first<any>();

        const prevNeighbors = await c.env.DB.prepare(`
            SELECT id FROM exam_questions 
            WHERE paper_id = ? AND ordering_index < ? AND is_deleted = 0
            ORDER BY ordering_index DESC LIMIT 1
        `).bind(q.paper_id, q.ordering_index).first<any>();

        nextId = neighbors?.id;
        prevId = prevNeighbors?.id;
    }

    return c.html(
        <Layout title={`Question - ${q.subject}`} user={user}>
            <div class="max-w-6xl mx-auto h-[calc(100vh-140px)] flex flex-col">
                {/* Header */}
                <div class="flex items-center justify-between mb-4 shrink-0">
                    <div>
                        <a href={source === 'practice' ? `/past-papers?subject=${encodeURIComponent(q.subject)}&tab=practice&topic=${filterTopic || ''}&year=${filterYear || ''}&status=${filterStatus || ''}&sort=${sort}` : `/past-papers/paper/${q.paper_id}`} class="text-sm text-gray-500 hover:underline">
                            ← Back to {source === 'practice' ? 'Practice' : 'Paper'}
                        </a>
                        <h1 class="text-xl font-bold flex items-center gap-2">
                            {q.school_name} {q.academic_year}
                            <span class="text-gray-400">|</span>
                            {q.section_label} {q.question_number}
                            <span class="text-sm font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded ml-2">{q.marks} Marks</span>
                        </h1>
                        <p class="text-sm text-gray-500">{q.topic_names}</p>
                    </div>
                    <div class="flex gap-2">
                        {prevId ? (
                            <a href={`/past-papers/attempt/${prevId}?${currentParams}`} class="px-3 py-1 bg-white border rounded hover:bg-gray-50">Previous</a>
                        ) : (
                            <button disabled class="px-3 py-1 bg-gray-50 border rounded text-gray-300">Previous</button>
                        )}
                        {nextId ? (
                            <a href={`/past-papers/attempt/${nextId}?${currentParams}`} class="px-3 py-1 bg-blue-600 text-white border border-blue-600 rounded hover:bg-blue-700">Next</a>
                        ) : (
                            <button disabled class="px-3 py-1 bg-gray-50 border rounded text-gray-300">Next</button>
                        )}
                    </div>
                </div>

                {/* Content Split */}
                <div class="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 min-h-0">

                    {/* Left: Question Content */}
                    <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-y-auto p-6">
                        <h3 class="font-bold text-gray-700 mb-4 uppercase text-sm tracking-wide">Question</h3>
                        {q.question_image_key ? (
                            <img src={`/download/${q.question_image_key}`} class="w-full h-auto object-contain" />
                        ) : (
                            <div class="text-gray-400 italic text-center py-12">No question image available</div>
                        )}

                        {q.stimulus_image_key && (
                            <div class="mt-6 border-t pt-6">
                                <h4 class="font-bold text-gray-500 mb-2 text-xs uppercase">Stimulus</h4>
                                <img src={`/download/${q.stimulus_image_key}`} class="w-full h-auto object-contain" />
                            </div>
                        )}
                    </div>

                    {/* Right: Interaction */}
                    <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-y-auto p-6 flex flex-col">
                        <form action={`/past-papers/attempt/${qId}/save?${currentParams}`} method="post" class="flex-1 flex flex-col">

                            {/* State: Check Answer vs Attempting */}
                            <div class="flex-1">
                                <h3 class="font-bold text-gray-700 mb-4 uppercase text-sm tracking-wide">Your Response</h3>

                                {q.question_type === 'multiple_choice' ? (
                                    <div class="grid grid-cols-2 gap-4 mb-6">
                                        {['A', 'B', 'C', 'D'].map(opt => (
                                            <label class="cursor-pointer">
                                                <input type="radio" name="selected_option" value={opt} class="peer sr-only" checked={attempt?.selected_option === opt} />
                                                <div class="text-center p-4 rounded-lg border-2 border-gray-200 hover:border-blue-400 peer-checked:border-blue-600 peer-checked:bg-blue-50 transition">
                                                    <span class="text-xl font-bold text-gray-700 peer-checked:text-blue-700">{opt}</span>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                ) : (
                                    <textarea name="response_content" class="w-full h-64 p-4 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none font-mono text-sm" placeholder="Type your answer here...">{attempt?.response_content || ''}</textarea>
                                )}

                                {/* Marking Section (Revealed on Check or always visible? "User can then check their response") */}
                                <div id="marking-section" class="mt-8 border-t border-gray-100 pt-6">
                                    <details open={!!attempt?.is_completed}>
                                        <summary class="font-bold text-blue-600 cursor-pointer mb-4 select-none group">
                                            <span class="group-open:hidden">▶ Check Answer & Mark</span>
                                            <span class="hidden group-open:inline">▼ Hide Answer</span>
                                        </summary>

                                        <div class="space-y-6 animate-fade-in">
                                            {/* Correct Answer */}
                                            <div class="bg-green-50 rounded-lg p-4 border border-green-100">
                                                <h4 class="font-bold text-green-800 text-sm mb-2">Correct Answer / Guidelines</h4>
                                                {q.mc_answer && <div class="text-xl font-bold text-green-700 mb-2">{q.mc_answer}</div>}
                                                {q.answer_image_key ? (
                                                    <img src={`/download/${q.answer_image_key}`} class="w-full object-contain bg-white rounded border border-green-200" />
                                                ) : <span class="text-gray-500 italic text-sm">No answer image provided.</span>}
                                            </div>

                                            {/* Self Marking UI */}
                                            <div class="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                                <div class="flex items-center justify-between mb-4">
                                                    <label class="font-bold text-gray-700 text-sm">Marks Awarded</label>
                                                    <div class="flex items-center gap-2">
                                                        <button type="button" onclick={`document.querySelector('input[name="marks_awarded"]').value = ${q.marks}`} class="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded font-bold hover:bg-blue-200">Give Max ({q.marks})</button>
                                                    </div>
                                                </div>
                                                <div class="flex items-center gap-2">
                                                    <input type="number" name="marks_awarded" min="0" max={q.marks} value={attempt?.marks_awarded || 0} class="w-20 rounded border-gray-300 font-bold text-center" />
                                                    <span class="text-gray-500 font-bold">/ {q.marks}</span>
                                                </div>

                                                <label class="block font-bold text-gray-700 text-sm mt-4 mb-2">My Marker Notes</label>
                                                <textarea name="marker_notes" class="w-full h-24 p-2 rounded border border-gray-300 text-sm" placeholder="Notes for future review...">{attempt?.marker_notes || ''}</textarea>
                                            </div>
                                        </div>
                                    </details>
                                </div>
                            </div>

                            {/* Actions */}
                            <div class="mt-6 flex justify-between items-center pt-4 border-t sticky bottom-0 bg-white">
                                <span class="text-xs text-gray-400">
                                    {attempt?.is_completed ? `Completed on ${new Date(attempt.completed_at).toLocaleDateString()}` : 'Not completed yet'}
                                </span>
                                <button type="submit" class="bg-blue-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-700 shadow-sm transition">
                                    Save & Mark Complete
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </Layout>
    );
})

// Save Attempt
app.post('/past-papers/attempt/:id/save', async (c) => {
    const user = await getUser(c)
    if (!user) return c.redirect('/login')
    const qId = c.req.param('id')
    const body = await c.req.parseBody()

    const marks = parseInt((body['marks_awarded'] as string) || '0');
    const response = (body['response_content'] as string) || '';
    const selected = (body['selected_option'] as string) || null;
    const notes = (body['marker_notes'] as string) || '';

    // Upsert Attempt
    await c.env.DB.prepare(`
        INSERT INTO user_question_attempts (user_id, question_id, response_content, selected_option, marks_awarded, marker_notes, is_completed, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id, question_id) DO UPDATE SET
            response_content = excluded.response_content,
            selected_option = excluded.selected_option,
            marks_awarded = excluded.marks_awarded,
            marker_notes = excluded.marker_notes,
            is_completed = 1,
            updated_at = CURRENT_TIMESTAMP
    `).bind(user.id, qId, response, selected, marks, notes).run();

    // Preserve Navigation Context
    const source = c.req.query('source');
    const filterTopic = c.req.query('topic');
    const filterYear = c.req.query('year');
    const filterStatus = c.req.query('status'); // done, undone
    const sort = c.req.query('sort') || 'school_asc';
    const params = `source=${source || ''}&topic=${filterTopic || ''}&year=${filterYear || ''}&status=${filterStatus || ''}&sort=${sort}`;

    return c.redirect(`/past-papers/attempt/${qId}?${params}`);
});

export default app