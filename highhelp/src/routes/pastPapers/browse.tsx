import { Hono } from 'hono'
import { Layout } from '../../layout'
import { getUser } from '../../utils'
import { canUploadPastPaper, PermissionLevel } from '../../permissions'
import { SubjectSelector } from '../../components/SubjectSelector'
import { Bindings } from '../../types'
import { PastPaperTabs } from './tabs'
const app = new Hono<{ Bindings: Bindings }>()

// Split MCQ question_text into stem + option texts (options are stored inline, e.g. "(A) Use cost centres")
const parseMcqOptions = (text: string | null): { stem: string; options: Record<string, string> | null } => {
    if (!text) return { stem: '', options: null };
    const opts: Record<string, string> = {};
    const stemLines: string[] = [];
    let seenOption = false;
    for (const line of text.split('\n')) {
        const m = line.match(/^\s*\(?\s*([A-Fa-f])[\).:\]]\s+(.*)$/);
        if (m) {
            seenOption = true;
            opts[m[1].toUpperCase()] = m[2].trim();
        } else if (!seenOption) {
            stemLines.push(line);
        }
    }
    if (Object.keys(opts).length < 2) return { stem: text.trim(), options: null };
    return { stem: stemLines.join('\n').trim(), options: opts };
};

app.get('/past-papers', async (c) => {
    const user = await getUser(c)
    if (!user) return c.redirect('/login')

    const subject = c.req.query('subject')
    const tab = c.req.query('tab') || 'browse';


    if (!subject) {

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
                        <h1 class="text-3xl font-bold mb-6 dark:text-white">Past Paper Bank</h1>
                        <p class="text-gray-600 dark:text-neutral-400 mb-8">Select a subject to browse structured past papers.</p>
                        <SubjectSelector baseUrl="/past-papers" type="standard" />
                    </section>
                </div>
            </Layout>
        )
    }


    const canUpload = user && canUploadPastPaper(user, subject);

    // Tabs Config
    const tabs = [
        { id: 'browse', label: 'Browse Papers', href: `/past-papers?subject=${encodeURIComponent(subject)}&tab=browse` },
        { id: 'practice', label: 'Practice Questions', href: `/past-papers?subject=${encodeURIComponent(subject)}&tab=practice` },
        { id: 'exam', label: 'Mock Exam', href: `/past-papers/mock-exams?subject=${encodeURIComponent(subject)}` },
        { id: 'review', label: 'Review', href: `/past-papers?subject=${encodeURIComponent(subject)}&tab=review` },
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
                    <h1 class="text-3xl font-bold dark:text-white">{subject}</h1>
                    {canUpload && (
                        <a href={`/past-papers/create?subject=${encodeURIComponent(subject)}`} class="text-blue-600 dark:text-blue-400 font-bold hover:underline transition-colors">
                            + Add New Paper
                        </a>
                    )}
                </div>

                <div class="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                    <div class="relative w-full md:w-96">
                        <input type="text" id="search-input" placeholder="Search papers..." class="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" />
                        <svg class="w-5 h-5 text-gray-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                    </div>
                </div>

                <div id="grid-view-container" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {papers.results.length === 0 ? (
                        <div class="col-span-full text-center py-12 text-gray-500 dark:text-neutral-400 bg-gray-50 dark:bg-neutral-800 rounded-lg border border-dashed border-gray-300 dark:border-neutral-700">
                            No papers found for {subject}.
                        </div>
                    ) : (
                        papers.results.map((p: any) => (
                            <div class="search-item block bg-white dark:bg-neutral-800 p-4 rounded border border-gray-300 dark:border-neutral-700 hover:border-blue-500 dark:hover:border-blue-400 transition-colors group h-full flex flex-col justify-between cursor-pointer" onclick={`window.location.href='/past-papers/paper/${p.id}'`} data-search-text={`${p.school_name} ${p.academic_year} ${subject}`}>
                                <div>
                                    <h3 class="text-lg font-bold text-gray-900 dark:text-white group-hover:text-blue-700 dark:group-hover:text-blue-400 mb-1 leading-snug">{p.school_name}</h3>

                                    <div class="flex flex-wrap items-center gap-x-2 text-xs text-gray-500 dark:text-neutral-400 mb-2">
                                        <span class="font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wide">{p.academic_year}</span>
                                        <span class="text-gray-300 dark:text-neutral-600">•</span>
                                        <span class="uppercase tracking-wide text-gray-600 dark:text-neutral-300">{p.paper_type || 'Trial Paper'}</span>
                                        {p.is_locked ? <span class="text-xs font-bold text-gray-500 dark:text-neutral-400 ml-2">✅ Checked</span> : null}
                                    </div>
                                </div>

                                <div class="flex flex-col gap-1 mt-2">
                                    <div class="flex items-center justify-between gap-3 text-xs text-gray-500 dark:text-neutral-400 font-mono border-t border-gray-100 dark:border-neutral-700 pt-2">
                                        <div class="flex gap-3">
                                            <span class="flex items-center gap-1">
                                                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
                                                {p.question_count || 0} Qs
                                            </span>
                                            <span class="flex items-center gap-1">
                                                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                                {p.total_marks || 0} Marks
                                            </span>
                                        </div>
                                        {user && user.permission_level >= PermissionLevel.ADMIN && (
                                            <form action={`/past-papers/paper/${p.id}/delete`} method="post" onclick="event.stopPropagation(); return confirm('Are you sure you want to delete this paper and ALL its questions? This action is permanent and cannot be undone.');" class="z-10 relative">
                                                <input type="hidden" name="subject" value={subject} />
                                                <button type="submit" class="text-red-500 dark:text-red-400 font-bold hover:underline transition-colors">
                                                    Delete
                                                </button>
                                            </form>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        );

    } else if (tab === 'practice') {
        const filterTopic = c.req.query('topic');
        const filterSchool = c.req.query('school');
        const filterYear = c.req.query('year');
        const filterStatus = c.req.query('status'); // done, undone
        const filterType = c.req.query('type');
        const filterSection = c.req.query('section');
        const filterMarksMin = c.req.query('marks_min');
        const filterMarksMax = c.req.query('marks_max');
        const sort = c.req.query('sort') || 'school_asc';
        const mode = c.req.query('mode');

        const params: any[] = [user?.id || null, subject];
        let filterSql = '';

        if (filterTopic) { filterSql += ` AND qt.topic_id = ?`; params.push(filterTopic); }
        if (filterSchool) { filterSql += ` AND p.school_name = ?`; params.push(filterSchool); }
        if (filterYear) { filterSql += ` AND p.academic_year = ?`; params.push(filterYear); }
        if (filterType) { filterSql += ` AND q.question_type = ?`; params.push(filterType); }
        if (filterSection) { filterSql += ` AND q.section_label = ?`; params.push(filterSection); }
        if (filterMarksMin) { filterSql += ` AND q.marks >= ?`; params.push(filterMarksMin); }
        if (filterMarksMax) { filterSql += ` AND q.marks <= ?`; params.push(filterMarksMax); }

        if (filterStatus === 'done') {
            filterSql += ` AND ua.is_completed = 1`;
        } else if (filterStatus === 'undone') {
            filterSql += ` AND (ua.is_completed IS NULL OR ua.is_completed = 0)`;
        }

        const baseJoin = `
            FROM exam_questions q
            JOIN papers p ON q.paper_id = p.id
            LEFT JOIN question_topics qt ON q.id = qt.question_id
            LEFT JOIN topics t ON qt.topic_id = t.id
            LEFT JOIN user_question_attempts ua ON q.id = ua.question_id AND ua.user_id = ?
            WHERE p.subject = ? AND q.is_deleted = 0
            ${filterSql}
        `;

        let query = `
            SELECT q.*, p.school_name, p.academic_year, 
                   group_concat(t.name, ', ') as topic_names,
                   ua.is_completed, ua.marks_awarded
            ${baseJoin}
            GROUP BY q.id
        `;

        let countQuery = `
            SELECT COUNT(DISTINCT q.id) as total
            ${baseJoin}
        `;

        if (sort === 'year_desc') query += ` ORDER BY p.academic_year DESC, q.ordering_index ASC`;
        else if (sort === 'year_asc') query += ` ORDER BY p.academic_year ASC, q.ordering_index ASC`;
        else query += ` ORDER BY p.school_name ASC, q.ordering_index ASC`;

        const [questions, countResult, allTopics, sections, schoolsResult] = await c.env.DB.batch([
            c.env.DB.prepare(query).bind(...params),
            c.env.DB.prepare(countQuery).bind(...params),
            c.env.DB.prepare('SELECT * FROM topics WHERE subject = ? ORDER BY name ASC').bind(subject),
            c.env.DB.prepare('SELECT DISTINCT section_label FROM exam_questions q JOIN papers p ON q.paper_id = p.id WHERE p.subject = ? ORDER BY section_label ASC').bind(subject),
            c.env.DB.prepare('SELECT DISTINCT school_name FROM papers WHERE subject = ? ORDER BY school_name ASC').bind(subject)
        ]);

        const totalQuestions = (countResult.results[0] as { total: number })?.total || 0;

        // Group questions by section for the table view
        const sectionsMap = new Map<string, any[]>();
        for (const q of questions.results as any[]) {
            const key = (q.section_label || '').trim() || 'Unsorted';
            if (!sectionsMap.has(key)) sectionsMap.set(key, []);
            sectionsMap.get(key)!.push(q);
        }
        const secNumber = (s: string) => {
            const m = s.match(/\d+/);
            return m ? parseInt(m[0], 10) : NaN;
        };
        const sectionKeys = Array.from(sectionsMap.keys()).sort((a, b) => {
            const na = secNumber(a), nb = secNumber(b);
            if (!isNaN(na) && !isNaN(nb)) return na - nb;
            return a.localeCompare(b);
        });


        content = (
            <div>
                <h1 class="text-3xl font-bold mb-6 dark:text-white">Practice Questions</h1>

                {/* Practice Questions Filters */}
                <form action="/past-papers" method="get" class="bg-white dark:bg-neutral-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-neutral-700 mb-6 space-y-4">
                    <input type="hidden" name="subject" value={subject} />
                    <input type="hidden" name="tab" value="practice" />
                    {mode && <input type="hidden" name="mode" value={mode} />}

                    <div class="flex flex-wrap gap-4 items-end">
                        <div>
                            <label class="block text-xs font-bold text-gray-500 dark:text-neutral-400 uppercase mb-1">School</label>
                            <select name="school" class="rounded border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 dark:text-white text-sm w-48">
                                <option value="">All Schools</option>
                                {schoolsResult.results.map((s: any) => <option value={s.school_name} selected={filterSchool == s.school_name}>{s.school_name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-500 dark:text-neutral-400 uppercase mb-1">Topic</label>
                            <select name="topic" class="rounded border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 dark:text-white text-sm w-48">
                                <option value="">All Topics</option>
                                {allTopics.results.map((t: any) => <option value={t.id} selected={filterTopic == t.id}>{t.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-500 dark:text-neutral-400 uppercase mb-1">Year</label>
                            <input type="number" name="year" value={filterYear} placeholder="Any" class="rounded border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 dark:text-white text-sm w-24" />
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-500 dark:text-neutral-400 uppercase mb-1">Section</label>
                            <select name="section" class="rounded border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 dark:text-white text-sm w-32">
                                <option value="">All</option>
                                {sections.results.map((s: any) => <option value={s.section_label} selected={filterSection == s.section_label}>{s.section_label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-500 dark:text-neutral-400 uppercase mb-1">Type</label>
                            <select name="type" class="rounded border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 dark:text-white text-sm w-32">
                                <option value="">All</option>
                                <option value="multiple_choice" selected={filterType == 'multiple_choice'}>Multiple Choice</option>
                                <option value="short_answer" selected={filterType == 'short_answer'}>Short Answer</option>
                                <option value="extended_response" selected={filterType == 'extended_response'}>Extended Response</option>
                            </select>
                        </div>
                    </div>
                    <div class="flex flex-wrap gap-4 items-end border-t dark:border-neutral-700 pt-4">
                        <div>
                            <label class="block text-xs font-bold text-gray-500 dark:text-neutral-400 uppercase mb-1">Status</label>
                            <select name="status" class="rounded border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 dark:text-white text-sm w-32">
                                <option value="">All</option>
                                <option value="done" selected={filterStatus == 'done'}>Completed</option>
                                <option value="undone" selected={filterStatus == 'undone'}>Unattempted</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-500 dark:text-neutral-400 uppercase mb-1">Marks Range</label>
                            <div class="flex items-center gap-2">
                                <input type="number" name="marks_min" value={filterMarksMin} placeholder="Min" class="rounded border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 dark:text-white text-sm w-20" />
                                <span class="text-gray-400">-</span>
                                <input type="number" name="marks_max" value={filterMarksMax} placeholder="Max" class="rounded border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 dark:text-white text-sm w-20" />
                            </div>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-500 dark:text-neutral-400 uppercase mb-1">Sort</label>
                            <select name="sort" class="rounded border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 dark:text-white text-sm w-32">
                                <option value="school_asc" selected={sort == 'school_asc'}>School A-Z</option>
                                <option value="year_desc" selected={sort == 'year_desc'}>Year (Newest)</option>
                                <option value="year_asc" selected={sort == 'year_asc'}>Year (Oldest)</option>
                            </select>
                        </div>
                        <div class="flex gap-6 items-center">
                            <button class="text-blue-600 dark:text-blue-400 font-bold text-sm hover:underline">Filter</button>
                            <a href={`/past-papers?subject=${encodeURIComponent(subject)}&tab=practice${mode ? '&mode=' + mode : ''}`} class="text-gray-600 dark:text-neutral-400 text-sm hover:text-gray-900 dark:hover:text-neutral-200 hover:underline">Reset</a>
                            <a href={`/past-papers/batch/view?source=practice&subject=${encodeURIComponent(subject)}&school=${filterSchool || ''}&topic=${filterTopic || ''}&year=${filterYear || ''}&status=${filterStatus || ''}&sort=${sort}&type=${filterType || ''}&section=${filterSection || ''}&marks_min=${filterMarksMin || ''}&marks_max=${filterMarksMax || ''}`} class="text-emerald-600 dark:text-emerald-400 font-bold text-sm hover:underline">Batch Mode</a>
                        </div>
                    </div>
                </form>



                {questions.results.length === 0 ? (
                    <div class="text-center py-12 text-gray-500">No questions found matching your filters.</div>
                ) : (
                    <form action="/past-papers/mock-exams/create-manual" method="post" id="manual-exam-form">
                        <input type="hidden" name="subject" value={subject} />

                        <p class="text-sm text-gray-500 dark:text-neutral-400 mb-8">
                            {totalQuestions} question{totalQuestions === 1 ? '' : 's'} across {sectionKeys.length} section{sectionKeys.length === 1 ? '' : 's'}.
                        </p>

                        {sectionKeys.map((secKey) => {
                            const qs = sectionsMap.get(secKey)!;
                            const hasMcq = qs.some((q: any) => q.question_type === 'multiple_choice');

                            return (
                                <section class="mb-12">
                                    <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-3 pb-2 border-b border-gray-200 dark:border-neutral-700">{secKey}</h2>
                                    <div class="overflow-x-auto">
                                        <table class="w-full min-w-[760px] text-sm">
                                            <thead>
                                                <tr class="text-left text-[11px] uppercase tracking-wider text-gray-500 dark:text-neutral-400 border-b-2 border-gray-200 dark:border-neutral-700">
                                                    {mode === 'select' && <th class="py-2 pr-2 w-8"></th>}
                                                    <th class="py-2 pr-3 font-bold">Paper</th>
                                                    <th class="py-2 pr-3 font-bold">Year</th>
                                                    <th class="py-2 pr-3 font-bold">#</th>
                                                    <th class="py-2 pr-3 font-bold">Question</th>
                                                    {hasMcq && ['A', 'B', 'C', 'D'].map(l => (<th class="py-2 pr-3 font-bold min-w-[9rem]">{l}</th>))}
                                                    <th class="py-2 pr-2 font-bold text-right">Marks</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {qs.map((q: any) => {
                                                    const params = `source=practice&school=${filterSchool || ''}&topic=${filterTopic || ''}&year=${filterYear || ''}&status=${filterStatus || ''}&sort=${sort}&type=${filterType || ''}&section=${filterSection || ''}&marks_min=${filterMarksMin || ''}&marks_max=${filterMarksMax || ''}`;
                                                    const isMcq = q.question_type === 'multiple_choice';
                                                    const parsed = isMcq ? parseMcqOptions(q.question_text) : null;
                                                    const isIncomplete = !q.marks || (!q.question_image_key && !q.question_text);

                                                    const clickAction = mode === 'select'
                                                        ? `const cb = document.querySelector('input[name="question_ids"][value="${q.id}"]'); if(cb) cb.checked = !cb.checked;`
                                                        : `window.location.href='/past-papers/attempt/${q.id}?${params}'`;

                                                    return (
                                                        <tr onclick={clickAction}
                                                            class={`border-b border-gray-100 dark:border-neutral-800 align-top cursor-pointer transition-colors
                                                            ${isIncomplete ? 'opacity-60' : 'hover:bg-blue-50 dark:hover:bg-neutral-800/60'}`}>
                                                            {mode === 'select' && (
                                                                <td class="py-2.5 pr-2" onclick="event.stopPropagation()">
                                                                    <input type="checkbox" name="question_ids" value={q.id} class="rounded border-gray-300 w-4 h-4 text-blue-600 focus:ring-blue-500" />
                                                                </td>
                                                            )}
                                                            <td class="py-2.5 pr-3 whitespace-nowrap font-medium text-gray-900 dark:text-white">{q.school_name}</td>
                                                            <td class="py-2.5 pr-3 whitespace-nowrap text-gray-600 dark:text-neutral-400">{q.academic_year}</td>
                                                            <td class="py-2.5 pr-3 whitespace-nowrap font-mono text-xs text-gray-500 dark:text-neutral-400">
                                                                {q.is_completed ? <span class="text-green-600 dark:text-green-400 mr-1" title="Completed">✓</span> : null}{q.question_number}
                                                            </td>
                                                            <td class="py-2.5 pr-3 max-w-md text-gray-800 dark:text-neutral-200 leading-snug">
                                                                {parsed?.options ? (
                                                                    parsed.stem || <span class="italic text-gray-400 dark:text-neutral-500">(see paper image)</span>
                                                                ) : q.question_text ? (
                                                                    <span class="whitespace-pre-wrap">{q.question_text}</span>
                                                                ) : q.question_image_key ? (
                                                                    <a href={`/past-papers/attempt/${q.id}?${params}`} onclick="event.stopPropagation()" class="italic text-blue-600 dark:text-blue-400 hover:underline">[image question]</a>
                                                                ) : (
                                                                    <span class="italic text-gray-400 dark:text-neutral-500">—</span>
                                                                )}
                                                            </td>
                                                            {hasMcq && ['A', 'B', 'C', 'D'].map(l => (
                                                                <td class="py-2.5 pr-3 text-gray-600 dark:text-neutral-300">{(parsed?.options && parsed.options[l]) || ''}</td>
                                                            ))}
                                                            <td class="py-2.5 pr-2 text-right font-bold text-gray-700 dark:text-neutral-200">{q.marks || '?'}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </section>
                            );
                        })}

                        {mode === 'select' && (
                            <div class="fixed bottom-0 left-0 w-full bg-white dark:bg-neutral-900 border-t dark:border-neutral-800 p-4 flex justify-between items-center shadow-lg z-50">
                                <div class="container mx-auto flex justify-between items-center text-gray-900 dark:text-white">
                                    <div class="flex gap-4 items-center">
                                        <input type="text" name="exam_name" placeholder="Custom Exam Name" class="rounded border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm" />
                                        <div class="flex items-center gap-2">
                                            <input type="number" name="timer_minutes" placeholder="Timer (mins)" class="rounded border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm w-24" />
                                        </div>
                                    </div>
                                    <div class="flex gap-4">
                                        <button type="submit" formaction="/past-papers/batch/export-pdf" class="text-emerald-600 dark:text-emerald-400 font-bold hover:underline">
                                            Download PDF
                                        </button>
                                        <button type="submit" class="text-blue-600 dark:text-blue-400 font-bold hover:underline">
                                            Create Exam
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </form>
                )}

                {mode === 'select' && questions.results.length > 0 && (
                    <script dangerouslySetInnerHTML={{ __html: `
                        (function() {
                            var key = 'mockSelect_' + document.querySelector('#manual-exam-form input[name=subject]').value;
                            var form = document.getElementById('manual-exam-form');

                            function saveToLS(ids) {
                                try { localStorage.setItem(key, JSON.stringify(Array.from(ids))); } catch(e) {}
                            }
                            function loadFromLS() {
                                try { var saved = localStorage.getItem(key); return saved ? new Set(JSON.parse(saved)) : new Set(); } catch(e) { return new Set(); }
                            }

                            function restore() {
                                var ids = loadFromLS();
                                form.querySelectorAll('input[name=question_ids]').forEach(function(cb) {
                                    if (ids.has(String(cb.value))) cb.checked = true;
                                });
                            }

                            function persist(e) {
                                if (e.target.matches('input[name=question_ids]')) {
                                    var ids = loadFromLS();
                                    if (e.target.checked) ids.add(String(e.target.value));
                                    else ids.delete(String(e.target.value));
                                    saveToLS(ids);
                                }
                            }

                            function persistToggle(qid, cb) {
                                var ids = loadFromLS();
                                if (cb.checked) ids.add(String(qid));
                                else ids.delete(String(qid));
                                saveToLS(ids);
                            }

                            restore();
                            form.addEventListener('change', persist);

                            document.querySelectorAll('[onclick*="cb.checked = !cb.checked"]').forEach(function(el) {
                                var old = el.onclick;
                                el.onclick = function(e) {
                                    old.call(this, e);
                                    var m = this.getAttribute('onclick').match(/value="(\\d+)"/);
                                    if (m) {
                                        var cb = document.querySelector('input[name=question_ids][value="' + m[1] + '"]');
                                        if (cb) persistToggle(m[1], cb);
                                    }
                                };
                            });

                            form.addEventListener('submit', function() {
                                var ids = loadFromLS();
                                var visible = new Set();
                                form.querySelectorAll('input[name=question_ids]').forEach(function(cb) { visible.add(String(cb.value)); });
                                ids.forEach(function(id) {
                                    if (!visible.has(id)) {
                                        var h = document.createElement('input');
                                        h.type = 'hidden';
                                        h.name = 'question_ids';
                                        h.value = id;
                                        form.appendChild(h);
                                    }
                                });
                            });
                        })();
                    `}} />
                )}
            </div>
        )

    } else if (tab === 'review') {
        if (!user) return c.redirect('/login')

        const query = `
            SELECT q.*, p.school_name, p.academic_year, 
                   group_concat(t.name, ', ') as topic_names,
                   ua.marks_awarded as original_marks,
                   ua.created_at as original_attempt_date,
                   ura.marks_awarded as review_marks,
                   ura.is_completed as review_completed
            FROM exam_questions q
            JOIN papers p ON q.paper_id = p.id
            JOIN user_question_attempts ua ON q.id = ua.question_id AND ua.user_id = ?
            LEFT JOIN user_review_attempts ura ON q.id = ura.question_id AND ura.user_id = ? 
                AND ura.id = (
                    SELECT MAX(id) FROM user_review_attempts WHERE question_id = q.id AND user_id = ?
                )
            LEFT JOIN question_topics qt ON q.id = qt.question_id
            LEFT JOIN topics t ON qt.topic_id = t.id
            WHERE p.subject = ?
              AND q.is_deleted = 0
              AND (ua.marks_awarded < q.marks OR ua.marks_awarded IS NULL)
            GROUP BY q.id
            ORDER BY ua.created_at DESC
        `;

        const questions = await c.env.DB.prepare(query).bind(user?.id, user?.id, user?.id, subject).all();

        content = (
            <div>
                <div class="flex items-center justify-between mb-6">
                    <h1 class="text-3xl font-bold dark:text-white">Review Queue</h1>
                    <a href={`/past-papers/batch/view?source=review&subject=${encodeURIComponent(subject)}&mode=review`} class="text-emerald-600 dark:text-emerald-400 font-bold text-sm hover:underline">Batch Review</a>
                </div>
                <p class="text-gray-600 dark:text-neutral-400 mb-8">Questions you didn't get full marks on. Review and retry them to master the content.</p>

                <div class="space-y-4">
                    {questions.results.length === 0 ? (
                        <div class="text-center py-12 text-gray-500 dark:text-neutral-400 bg-gray-50 dark:bg-neutral-800 rounded-lg border border-dashed border-gray-300 dark:border-neutral-700">
                            Great work! You have no questions to review.
                        </div>
                    ) : (
                        questions.results.map((q: any) => {
                            const isReviewCompleted = !!q.review_completed || (q.review_marks != null && q.review_marks === q.marks);
                            const reviewStatus = isReviewCompleted
                                ? <span class="bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 text-xs px-2 py-1 rounded font-bold uppercase">Review Completed</span>
                                : <span class="bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-xs px-2 py-1 rounded font-bold uppercase">To Review</span>;

                            return (
                                <a href={`/past-papers/attempt/${q.id}?mode=review&source=review`} class="block bg-white dark:bg-neutral-800 p-4 rounded border border-gray-300 dark:border-neutral-700 hover:border-blue-500 dark:hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-neutral-700 transition-colors group">
                                    <div class="flex justify-between items-start">
                                        <div class="flex gap-4">
                                            <div>
                                                <div class="flex items-center gap-2 mb-1">
                                                    <span class="font-bold text-sm text-gray-900 dark:text-white group-hover:text-blue-700 dark:group-hover:text-blue-400">{q.school_name} {q.academic_year}</span>
                                                    <span class="text-gray-400 dark:text-neutral-500 text-xs font-mono">| {q.section_label} {q.question_number}</span>
                                                    {reviewStatus}
                                                </div>
                                                <div class="text-xs text-gray-500 dark:text-neutral-400 flex gap-2">
                                                    <span class="capitalize">{q.question_type ? q.question_type.replace('_', ' ') : '-'}</span>
                                                    <span class="text-gray-300 dark:text-neutral-600">•</span>
                                                    <span class="font-medium text-gray-600 dark:text-neutral-300">{q.topic_names || 'No topic'}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="text-right">
                                            <div class="text-xs text-gray-500 dark:text-neutral-400 mb-1">Original Score</div>
                                            <span class="text-sm font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded">
                                                {q.original_marks || 0}/{q.marks}
                                            </span>
                                        </div>
                                    </div>
                                </a>
                            );
                        })
                    )}
                </div>
            </div>
        );
    }

    return c.html(
        <Layout title={`Past Papers - ${subject}`} user={user}>
            <div class="mx-auto">

                <div class="flex items-center gap-2 text-sm text-gray-500 dark:text-neutral-400 mb-4">
                    <a href="/past-papers" class="hover:underline">Past Papers</a>
                    <span class="text-gray-300 dark:text-neutral-600">/</span>
                    <span class="font-bold text-gray-700 dark:text-neutral-200">{subject}</span>
                </div>


                <div class="border-b border-gray-200 dark:border-neutral-700 mb-8">
                    <nav class="-mb-px flex space-x-8">
                        {tabs.map(t => (
                            <a href={(t as any).href}
                                class={`
                                    whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors
                                    ${(tab === t.id) || (t.id === 'exam' && c.req.path.includes('mock-exams')) ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-neutral-400 hover:text-gray-700 dark:hover:text-neutral-200 hover:border-gray-300 dark:hover:border-neutral-600'}
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

app.post('/past-papers/paper/:id/delete', async (c) => {
    const user = await getUser(c)
    if (!user || user.permission_level < PermissionLevel.ADMIN) {
        return c.text('Unauthorised', 403);
    }

    const paperId = c.req.param('id');
    const body = await c.req.parseBody();
    const subject = body['subject'] as string;

    // Check if the paper exists
    const paper = await c.env.DB.prepare('SELECT * FROM papers WHERE id = ?').bind(paperId).first<any>();
    if (!paper) return c.notFound();

    // Delete all related records securely with batching
    const subquery = 'SELECT id FROM exam_questions WHERE paper_id = ?';

    await c.env.DB.batch([
        c.env.DB.prepare(`DELETE FROM user_question_attempts WHERE question_id IN (${subquery})`).bind(paperId),
        c.env.DB.prepare(`DELETE FROM user_review_attempts WHERE question_id IN (${subquery})`).bind(paperId),
        c.env.DB.prepare(`DELETE FROM mock_exam_questions WHERE question_id IN (${subquery})`).bind(paperId),
        c.env.DB.prepare(`DELETE FROM question_topics WHERE question_id IN (${subquery})`).bind(paperId),
        c.env.DB.prepare('DELETE FROM exam_questions WHERE paper_id = ?').bind(paperId),
        c.env.DB.prepare('DELETE FROM papers WHERE id = ?').bind(paperId)
    ]);

    return c.redirect(subject ? `/past-papers?subject=${encodeURIComponent(subject)}&tab=browse` : '/past-papers');
});

export default app

