import { Hono } from 'hono'
import { Layout } from '../../layout'
import { getUser } from '../../utils'
import { canUploadPastPaper } from '../../permissions'
import { SubjectSelector } from '../../components/SubjectSelector'
import { Bindings } from '../../types'

const app = new Hono<{ Bindings: Bindings }>()

app.get('/past-papers', async (c) => {
    const user = await getUser(c)

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
                        <h1 class="text-3xl font-bold mb-6">Past Paper Bank</h1>
                        <p class="text-gray-600 mb-8">Select a subject to browse structured past papers.</p>
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
                            <a href={`/past-papers/paper/${p.id}`} class="search-item block bg-white p-4 rounded border border-gray-300 hover:border-blue-500 transition-colors group h-full flex flex-col justify-between" data-search-text={`${p.school_name} ${p.academic_year} ${subject}`}>
                                <div>
                                    <h3 class="text-lg font-bold text-gray-900 group-hover:text-blue-700 mb-1 leading-snug">{p.school_name}</h3>

                                    <div class="flex flex-wrap items-center gap-x-2 text-xs text-gray-500 mb-2">
                                        <span class="font-bold text-blue-700 uppercase tracking-wide">{p.academic_year}</span>
                                        <span class="text-gray-300">•</span>
                                        <span class="uppercase tracking-wide">{p.paper_type || 'Trial Paper'}</span>
                                        {p.is_locked ? <span class="text-xs font-bold text-gray-500 ml-2">✅ Checked</span> : null}
                                    </div>
                                </div>

                                <div class="flex flex-col gap-1 mt-2">
                                    <div class="flex items-center gap-3 text-xs text-gray-500 font-mono border-t border-gray-100 pt-2">
                                        <span class="flex items-center gap-1">
                                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
                                            {p.question_count || 0} Qs
                                        </span>
                                        <span class="flex items-center gap-1">
                                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                            {p.total_marks || 0} Marks
                                        </span>
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

        
        const filterTopic = c.req.query('topic');
        const filterYear = c.req.query('year');
        const filterStatus = c.req.query('status'); // done, undone
        const filterType = c.req.query('type');
        const filterSection = c.req.query('section');
        const filterMarksMin = c.req.query('marks_min');
        const filterMarksMax = c.req.query('marks_max');
        const sort = c.req.query('sort') || 'school_asc';
        const mode = c.req.query('mode'); 

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
        
        const params: any[] = [user?.id || null, subject];

        if (filterTopic) { query += ` AND qt.topic_id = ?`; params.push(filterTopic); }
        if (filterYear) { query += ` AND p.academic_year = ?`; params.push(filterYear); }
        if (filterType) { query += ` AND q.question_type = ?`; params.push(filterType); }
        if (filterSection) { query += ` AND q.section_label = ?`; params.push(filterSection); }
        if (filterMarksMin) { query += ` AND q.marks >= ?`; params.push(filterMarksMin); }
        if (filterMarksMax) { query += ` AND q.marks <= ?`; params.push(filterMarksMax); }

        if (filterStatus === 'done') {
            query += ` AND ua.is_completed = 1`;
        } else if (filterStatus === 'undone') {
            query += ` AND (ua.is_completed IS NULL OR ua.is_completed = 0)`;
        }

        query += ` GROUP BY q.id`;

        
        if (sort === 'year_desc') query += ` ORDER BY p.academic_year DESC, q.ordering_index ASC`;
        else if (sort === 'year_asc') query += ` ORDER BY p.academic_year ASC, q.ordering_index ASC`;
        else query += ` ORDER BY p.school_name ASC, q.ordering_index ASC`;

        query += ` LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        const questions = await c.env.DB.prepare(query).bind(...params).all();
        const allTopics = await c.env.DB.prepare('SELECT * FROM topics WHERE subject = ? ORDER BY name ASC').bind(subject).all();
        const sections = await c.env.DB.prepare('SELECT DISTINCT section_label FROM exam_questions q JOIN papers p ON q.paper_id = p.id WHERE p.subject = ? ORDER BY section_label ASC').bind(subject).all();


        content = (
            <div>
                <h1 class="text-3xl font-bold mb-6">Practice Questions</h1>

                
                <form action="/past-papers" method="get" class="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6 space-y-4">
                    <input type="hidden" name="subject" value={subject} />
                    <input type="hidden" name="tab" value="practice" />

                    <div class="flex flex-wrap gap-4 items-end">
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
                            <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Section</label>
                            <select name="section" class="rounded border-gray-300 text-sm w-32">
                                <option value="">All</option>
                                {sections.results.map((s: any) => <option value={s.section_label} selected={filterSection == s.section_label}>{s.section_label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Type</label>
                            <select name="type" class="rounded border-gray-300 text-sm w-32">
                                <option value="">All</option>
                                <option value="multiple_choice" selected={filterType == 'multiple_choice'}>Multiple Choice</option>
                                <option value="short_answer" selected={filterType == 'short_answer'}>Short Answer</option>
                                <option value="extended_response" selected={filterType == 'extended_response'}>Extended Response</option>
                            </select>
                        </div>
                    </div>
                    <div class="flex flex-wrap gap-4 items-end border-t pt-4">
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Status</label>
                            <select name="status" class="rounded border-gray-300 text-sm w-32">
                                <option value="">All</option>
                                <option value="done" selected={filterStatus == 'done'}>Completed</option>
                                <option value="undone" selected={filterStatus == 'undone'}>Unattempted</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Marks Range</label>
                            <div class="flex items-center gap-2">
                                <input type="number" name="marks_min" value={filterMarksMin} placeholder="Min" class="rounded border-gray-300 text-sm w-20" />
                                <span class="text-gray-400">-</span>
                                <input type="number" name="marks_max" value={filterMarksMax} placeholder="Max" class="rounded border-gray-300 text-sm w-20" />
                            </div>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Sort</label>
                            <select name="sort" class="rounded border-gray-300 text-sm w-32">
                                <option value="school_asc" selected={sort == 'school_asc'}>School A-Z</option>
                                <option value="year_desc" selected={sort == 'year_desc'}>Year (Newest)</option>
                                <option value="year_asc" selected={sort == 'year_asc'}>Year (Oldest)</option>
                            </select>
                        </div>
                        <div class="flex gap-2">
                            <button class="bg-blue-600 text-white px-4 py-2 rounded font-bold text-sm hover:bg-blue-700">Filter</button>
                            <a href={`/past-papers?subject=${encodeURIComponent(subject)}&tab=practice`} class="px-4 py-2 border rounded text-gray-600 text-sm hover:bg-gray-50">Reset</a>
                        </div>
                    </div>
                </form>



                <div class="space-y-4">
                    {questions.results.length === 0 ? (
                        <div class="text-center py-12 text-gray-500">No questions found matching your filters.</div>
                    ) : (
                        <form action="/past-papers/mock-exams/create-manual" method="post" id="manual-exam-form">
                            <input type="hidden" name="subject" value={subject} />
                            <div class="space-y-4">
                                {questions.results.map((q: any) => {
                                    const params = `source=practice&topic=${filterTopic || ''}&year=${filterYear || ''}&status=${filterStatus || ''}&sort=${sort}&type=${filterType || ''}&section=${filterSection || ''}&marks_min=${filterMarksMin || ''}&marks_max=${filterMarksMax || ''}`;
                                    const isIncomplete = !q.marks || (!q.question_image_key && !q.question_text);

                                    const clickAction = mode === 'select'
                                        ? `const cb = document.querySelector('input[name="question_ids"][value="${q.id}"]'); if(cb) cb.checked = !cb.checked;`
                                        : `window.location.href='/past-papers/attempt/${q.id}?${params}'`;

                                    return (
                                        <div onclick={clickAction}
                                            class={`block p-3 rounded border transition-colors cursor-pointer group 
                                            ${isIncomplete ? 'bg-gray-50 border-gray-200 opacity-75 grayscale' : 'bg-white border-gray-300 hover:border-blue-500 hover:bg-gray-50'}`}>
                                            <div class="flex justify-between items-start">
                                                <div class="flex gap-3">
                                                    {mode === 'select' && (
                                                        <div class="pt-1" onclick="event.stopPropagation()">
                                                            <input type="checkbox" name="question_ids" value={q.id} class="rounded border-gray-300 w-5 h-5 text-blue-600 focus:ring-blue-500" />
                                                        </div>
                                                    )}
                                                    <div>
                                                        <div class="flex items-center gap-2 mb-1">
                                                            <span class={`font-bold text-sm ${isIncomplete ? 'text-gray-500' : 'text-gray-900 group-hover:text-blue-700'}`}>{q.school_name} {q.academic_year}</span>
                                                            <span class="text-gray-400 text-xs font-mono">| {q.section_label} {q.question_number}</span>
                                                            {q.is_completed ? <span class="bg-green-100 text-green-700 text-[10px] px-1.5 py-0.5 rounded border border-green-200 font-bold uppercase">Done</span> : null}
                                                        </div>
                                                        <div class="text-xs text-gray-500 flex gap-2">
                                                            <span class="capitalize">{q.question_type ? q.question_type.replace('_', ' ') : '-'}</span>
                                                            <span class="text-gray-300">•</span>
                                                            <span class="font-medium text-gray-600">{q.topic_names || 'No topic'}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div class="text-right">
                                                    <span class={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase border ${isIncomplete ? 'bg-gray-200 text-gray-500 border-gray-300' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>{q.marks || '?'}m</span>
                                                    {q.marks_awarded != null && (
                                                        <div class="text-[10px] font-bold text-blue-600 mt-1">
                                                            {q.marks_awarded}/{q.marks}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            {mode === 'select' && (
                                <div class="fixed bottom-0 left-0 w-full bg-white border-t p-4 flex justify-between items-center shadow-lg z-50">
                                    <div class="container mx-auto flex justify-between items-center">
                                        <div class="flex gap-4 items-center">
                                            <input type="text" name="exam_name" placeholder="Custom Exam Name" class="rounded border-gray-300 text-sm" />
                                            <div class="flex items-center gap-2">
                                                <input type="number" name="timer_minutes" placeholder="Timer (mins)" class="rounded border-gray-300 text-sm w-24" />
                                            </div>
                                        </div>
                                        <button class="bg-blue-600 text-white px-8 py-2 rounded-lg font-bold hover:bg-blue-700 shadow-md">
                                            Create Exam
                                        </button>
                                    </div>
                                </div>
                            )}
                        </form>
                    )
                    }
                </div>
                
                <div class="mt-8 flex justify-center gap-2">
                    {page > 1 && <a href={`/past-papers?subject=${encodeURIComponent(subject)}&tab=practice&page=${page - 1}&topic=${filterTopic || ''}&year=${filterYear || ''}&status=${filterStatus || ''}&sort=${sort}&type=${filterType || ''}&section=${filterSection || ''}&marks_min=${filterMarksMin || ''}&marks_max=${filterMarksMax || ''}`} class="px-4 py-2 border rounded bg-white hover:bg-gray-50">Previous</a>}
                    <a href={`/past-papers?subject=${encodeURIComponent(subject)}&tab=practice&page=${page + 1}&topic=${filterTopic || ''}&year=${filterYear || ''}&status=${filterStatus || ''}&sort=${sort}&type=${filterType || ''}&section=${filterSection || ''}&marks_min=${filterMarksMin || ''}&marks_max=${filterMarksMax || ''}`} class="px-4 py-2 border rounded bg-white hover:bg-gray-50">Next</a>
                </div>
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
                <h1 class="text-3xl font-bold mb-6">Review Queue</h1>
                <p class="text-gray-600 mb-8">Questions you didn't get full marks on. Review and retry them to master the content.</p>

                <div class="space-y-4">
                    {questions.results.length === 0 ? (
                        <div class="text-center py-12 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                            Great work! You have no questions to review.
                        </div>
                    ) : (
                        questions.results.map((q: any) => {
                            const isReviewCompleted = !!q.review_completed || (q.review_marks != null && q.review_marks === q.marks);
                            const reviewStatus = isReviewCompleted
                                ? <span class="bg-green-100 text-green-700 text-xs px-2 py-1 rounded font-bold uppercase">Review Completed</span>
                                : <span class="bg-amber-100 text-amber-700 text-xs px-2 py-1 rounded font-bold uppercase">To Review</span>;

                            return (
                                <a href={`/past-papers/attempt/${q.id}?mode=review&source=review`} class="block bg-white p-4 rounded border border-gray-300 hover:border-blue-500 hover:bg-gray-50 transition-colors group">
                                    <div class="flex justify-between items-start">
                                        <div class="flex gap-4">
                                            <div>
                                                <div class="flex items-center gap-2 mb-1">
                                                    <span class="font-bold text-sm text-gray-900 group-hover:text-blue-700">{q.school_name} {q.academic_year}</span>
                                                    <span class="text-gray-400 text-xs font-mono">| {q.section_label} {q.question_number}</span>
                                                    {reviewStatus}
                                                </div>
                                                <div class="text-xs text-gray-500 flex gap-2">
                                                    <span class="capitalize">{q.question_type ? q.question_type.replace('_', ' ') : '-'}</span>
                                                    <span class="text-gray-300">•</span>
                                                    <span class="font-medium text-gray-600">{q.topic_names || 'No topic'}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="text-right">
                                            <div class="text-xs text-gray-500 mb-1">Original Score</div>
                                            <span class="text-sm font-bold text-red-600 bg-red-50 px-2 py-1 rounded">
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
                
                <div class="flex items-center gap-2 text-sm text-gray-500 mb-4">
                    <a href="/past-papers" class="hover:underline">Past Papers</a>
                    <span>/</span>
                    <span class="font-bold text-gray-700">{subject}</span>
                </div>

                
                <div class="border-b border-gray-200 mb-8">
                    <nav class="-mb-px flex space-x-8">
                        {tabs.map(t => (
                            <a href={(t as any).href}
                                class={`
                                    whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors
                                    ${(tab === t.id) || (t.id === 'exam' && c.req.path.includes('mock-exams')) ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
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

export default app

