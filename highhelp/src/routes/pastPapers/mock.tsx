
import { Hono } from 'hono'
import { Layout } from '../../layout'
import { getUser } from '../../utils'
import { Bindings } from '../../types'
import { PastPaperTabs } from './tabs'
const app = new Hono<{ Bindings: Bindings }>()


const getPage = (key?: string) => {
    if (key && key.startsWith('pdf_crop:')) {
        const parts = key.split(':');
        
        if (parts.length >= 3) return parts[2].split(',')[0];
    }
    return null;
}

app.get('/mock-exams', async (c) => {
    const user = await getUser(c)
    if (!user) return c.redirect('/login')

    const subject = c.req.query('subject')
    if (!subject) {
        return c.redirect('/past-papers')
    }

    const exams = await c.env.DB.prepare(`
    SELECT m.*,
           count(mq.question_id) as question_count,
           sum(q.marks) as total_marks,
           sum(ua.marks_awarded) as marks_received
    FROM mock_exams m
    LEFT JOIN mock_exam_questions mq ON m.id = mq.mock_exam_id
    LEFT JOIN exam_questions q ON mq.question_id = q.id
    LEFT JOIN user_question_attempts ua ON mq.question_id = ua.question_id AND ua.user_id = m.user_id
    WHERE m.user_id = ? AND m.subject = ?
    GROUP BY m.id
    ORDER BY m.created_at DESC
`).bind(user.id, subject).all()

    return c.html(
        <Layout title={`Mock Exams - ${subject}`} user={user} latex={true}>
            <div class="flex items-center gap-2 text-sm text-gray-500 dark:text-neutral-400 mb-4">
                <a href="/past-papers" class="hover:underline">Past Papers</a>
                <span>/</span>
                <span class="font-bold text-gray-700 dark:text-neutral-300">{subject}</span>
            </div>
            <PastPaperTabs subject={subject} activeTab="exam" />
            <div class="mx-auto space-y-8">

                <div class="flex justify-between items-center">
                    <h1 class="text-3xl font-bold dark:text-white">Mock Exams</h1>
                    <a href={`/past-papers/mock-exams/create?subject=${encodeURIComponent(subject || '')}`} class="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700 shadow-sm transition">
                        + Create New Exam
                    </a>
                </div>

                <div class="grid gap-4">
                    {exams.results.length === 0 ? (
                        <div class="text-center py-12 text-gray-500 dark:text-neutral-400 bg-gray-50 dark:bg-neutral-900/50 rounded-lg border border-dashed border-gray-300 dark:border-neutral-700">
                            You haven't created any mock exams for {subject} yet.
                        </div>
                    ) : (
                        exams.results.map((exam: any) => (
                            <div class="bg-white dark:bg-neutral-800 p-4 rounded-xl border border-gray-300 dark:border-neutral-700 hover:border-blue-500 dark:hover:border-blue-400 transition-all flex justify-between items-center shadow-sm">
                                <div>
                                    <h3 class="font-bold text-lg text-gray-900 dark:text-white">{exam.exam_name || 'Untitled Exam'}</h3>
                                    <div class="text-sm text-gray-500 dark:text-neutral-400 flex gap-3 mt-1">
                                        <span class="capitalize">{exam.created_method} Generated</span>
                                        <span>•</span>
                                        <span>{exam.question_count} Questions</span>
                                        {exam.status === 'completed' && exam.total_marks != null && (
    <>
        <span>•</span>
        <span class="font-semibold">
            {exam.marks_received ?? 0}/{exam.total_marks} Marks
        </span>
    </>
)}
                                        {exam.is_timed ? (
                                            <>
                                                <span>•</span>
                                                <span>{Math.floor((exam.allowed_time_seconds || 0) / 60)} mins limit</span>
                                            </>
                                        ) : null}
                                    </div>
                                    <div class="mt-2">
                                        <span class={`text-xs font-bold uppercase px-2 py-1 rounded ${exam.status === 'completed' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-yellow-100 dark:bg-amber-900/30 text-yellow-700 dark:text-amber-400'
                                            }`}>
                                            {exam.status.replace('_', ' ')}
                                        </span>
                                    </div>
                                </div>
                                <div class="flex gap-2">
                                    {exam.status === 'in_progress' ? (
                                        <a href={`/past-papers/mock-exams/${exam.id}`} class="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-4 py-2 rounded-lg font-bold hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors">
                                            Continue
                                        </a>
                                    ) : (
                                        <a href={`/past-papers/mock-exams/${exam.id}/mark`} class="bg-gray-100 dark:bg-neutral-700 text-gray-700 dark:text-neutral-300 px-4 py-2 rounded-lg font-bold hover:bg-gray-200 dark:hover:bg-neutral-600 transition-colors">
                                            View Results
                                        </a>
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

app.get('/mock-exams/create', async (c) => {
    const user = await getUser(c)
    if (!user) return c.redirect('/login')
    const subject = c.req.query('subject')

    const sections = await c.env.DB.prepare(`
        SELECT DISTINCT q.section_label 
        FROM exam_questions q 
        JOIN papers p ON q.paper_id = p.id 
        WHERE p.subject = ? 
        ORDER BY q.section_label ASC
    `).bind(subject).all()

    const topics = await c.env.DB.prepare('SELECT * FROM topics WHERE subject = ? ORDER BY name ASC').bind(subject).all()

    return c.html(
        <Layout title={`Create Mock Exam - ${subject}`} user={user} latex={true}>
            <div class="max-w-3xl mx-auto">
                <div class="mb-6">
                    <a href={`/past-papers/mock-exams?subject=${encodeURIComponent(subject || '')}`} class="text-gray-500 dark:text-neutral-400 hover:text-gray-700 dark:hover:text-neutral-200 text-sm">
                        ← Back to Mock Exams
                    </a>
                </div>

                <h1 class="text-3xl font-bold mb-8 dark:text-white">Create Mock Exam</h1>

                <div class="space-y-6">
                    <div class="flex border-b border-gray-200 dark:border-neutral-700">
                        <a href={`?subject=${encodeURIComponent(subject || '')}&mode=auto`} class={`px-6 py-3 font-medium border-b-2 transition-colors ${!c.req.query('mode') || c.req.query('mode') === 'auto' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-neutral-500 hover:text-gray-700 dark:hover:text-neutral-300'}`}>Auto Generate</a>
                        <a href={`?subject=${encodeURIComponent(subject || '')}&mode=manual`} class={`px-6 py-3 font-medium border-b-2 transition-colors ${c.req.query('mode') === 'manual' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-neutral-500 hover:text-gray-700 dark:hover:text-neutral-300'}`}>Manual Selection</a>
                    </div>

                    {(!c.req.query('mode') || c.req.query('mode') === 'auto') && (
                        <div>
                            <form action="/past-papers/mock-exams/create-auto" method="post" class="space-y-6 bg-white dark:bg-neutral-800 p-6 rounded-xl border border-gray-200 dark:border-neutral-700 shadow-sm">
                                <input type="hidden" name="subject" value={subject || ''} />

                                <div>
                                    <label class="block font-bold text-gray-700 dark:text-neutral-300 mb-2">Exam Name</label>
                                    <input type="text" name="exam_name" placeholder="e.g. Weekly Practice" class="w-full rounded-md border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500" required />
                                </div>

                                <div>
                                    <label class="block font-bold text-gray-700 dark:text-neutral-300 mb-2">Uncompleted Priority</label>
                                    <p class="text-sm text-gray-500 dark:text-neutral-400 mb-2">We try to find unattempted questions first. If not enough, should we use completed ones?</p>
                                    <label class="flex items-center gap-2">
                                        <input type="checkbox" name="allow_completed" value="1" checked class="rounded text-blue-600 focus:ring-blue-500 dark:bg-neutral-900 dark:border-neutral-600" />
                                        <span class="text-gray-700 dark:text-neutral-300">Allow using completed questions if needed</span>
                                    </label>
                                </div>

                                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div>
                                        <label class="block font-bold text-gray-700 dark:text-neutral-300 mb-2">Topic Filter</label>
                                        <div class="max-h-48 overflow-y-auto border border-gray-300 dark:border-neutral-600 rounded-md p-2 bg-white dark:bg-neutral-900 space-y-1">
                                            {topics.results.length === 0 && <p class="text-sm text-gray-400 dark:text-neutral-500">No topics validation</p>}
                                            {topics.results.map((t: any) => (
                                                <label class="flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-neutral-800 p-1 rounded cursor-pointer transition-colors">
                                                    <input type="checkbox" name="topics" value={t.id} class="rounded text-blue-600 focus:ring-blue-500 dark:bg-neutral-900 dark:border-neutral-600" />
                                                    <span class="text-sm text-gray-700 dark:text-neutral-300">{t.name}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label class="block font-bold text-gray-700 dark:text-neutral-300 mb-2">Year</label>
                                        <input type="number" name="year" placeholder="Any Year" class="w-full rounded-md border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500" />
                                    </div>
                                    <div>
                                        <label class="block font-bold text-gray-700 dark:text-neutral-300 mb-2">Question Type</label>
                                        <select name="type" class="w-full rounded-md border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500">
                                            <option value="">Any Type</option>
                                            <option value="multiple_choice">Multiple Choice</option>
                                            <option value="short_answer">Short Answer</option>
                                            <option value="extended_response">Extended Response</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label class="block font-bold text-gray-700 dark:text-neutral-300 mb-4">Marks per Section</label>
                                    <p class="text-sm text-gray-500 dark:text-neutral-400 mb-4">Enter how many marks you want for each section (approximate).</p>
                                    <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
                                        {sections.results.map((s: any) => (
                                            <div>
                                                <label class="block text-xs font-bold text-gray-500 dark:text-neutral-400 uppercase mb-1">{s.section_label}</label>
                                                <input type="number" name={`marks_${s.section_label}`} placeholder="0" class="w-full rounded-md border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500" />
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label class="block font-bold text-gray-700 dark:text-neutral-300 mb-2">Timer (Optional)</label>
                                    <div class="flex items-center gap-2">
                                        <input type="number" name="timer_minutes" placeholder="Minutes" class="w-32 rounded-md border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500" />
                                        <span class="text-gray-500 dark:text-neutral-400">minutes</span>
                                    </div>
                                </div>

                                <div class="pt-4">
                                    <button class="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 shadow-sm transition">Generate Exam</button>
                                </div>
                            </form>
                        </div>
                    )}

                    {c.req.query('mode') === 'manual' && (
                        <div class="bg-gray-50 dark:bg-neutral-800/50 p-6 rounded-xl border border-gray-200 dark:border-neutral-700 text-center">
                            <p class="text-gray-600 dark:text-neutral-300 mb-4">To create a manual exam, please browse the <strong>Practice Questions</strong> tab and select the questions you want to add.</p>
                            <a href={`/past-papers?subject=${encodeURIComponent(subject || '')}&tab=practice&mode=select`} class="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700 transition shadow-md">
                                Go to Question Selector
                            </a>
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    )
})

app.post('/mock-exams/create-auto', async (c) => {
    const user = await getUser(c)
    if (!user) return c.redirect('/login')

    const body = await c.req.parseBody({ all: true })
    const subject = body['subject'] as string
    const examName = body['exam_name'] as string
    const allowCompleted = body['allow_completed'] === '1'
    const timerMinutes = parseInt(body['timer_minutes'] as string || '0')

    let filterTopics: string[] = []
    const rawTopics = body['topics']
    if (rawTopics) {
        if (Array.isArray(rawTopics)) {
            filterTopics = rawTopics as string[]
        } else {
            filterTopics = [rawTopics as string]
        }
    }
    const filterYear = body['year'] as string
    const filterType = body['type'] as string

    const sections: Record<string, number> = {}
    for (const key in body) {
        if (key.startsWith('marks_')) {
            const section = key.replace('marks_', '')
            const marks = parseInt(body[key] as string)
            if (marks > 0) sections[section] = marks
        }
    }

    if (Object.keys(sections).length === 0) {
        return c.text("Please specify marks for at least one section.", 400)
    }

    let finalQuestions: any[] = []

    const orderedDbSections = await c.env.DB.prepare(`
        SELECT DISTINCT q.section_label 
        FROM exam_questions q 
        JOIN papers p ON q.paper_id = p.id 
        WHERE p.subject = ? 
        ORDER BY q.section_label ASC
    `).bind(subject).all();

    const targetSections = orderedDbSections.results
        .map((s: any) => s.section_label)
        .filter((label: string) => sections[label] !== undefined);

    for (const section of targetSections) {
        const desiredMarks = sections[section];

        let query = `
                SELECT q.*, ua.is_completed
                FROM exam_questions q
                JOIN papers p ON q.paper_id = p.id
                LEFT JOIN user_question_attempts ua ON q.id = ua.question_id AND ua.user_id = ?
                LEFT JOIN question_topics qt ON q.id = qt.question_id
                WHERE p.subject = ? 
                AND q.section_label = ? 
                AND q.is_deleted = 0
                AND q.marks >= 1
                `
        const params: any[] = [user.id, subject, section]

        if (filterTopics.length > 0) {
            const placeholders = filterTopics.map(() => '?').join(', ')
            query += ` AND qt.topic_id IN (${placeholders})`
            params.push(...filterTopics)
        }
        if (filterYear) { query += ` AND p.academic_year = ?`; params.push(filterYear); }
        if (filterType) { query += ` AND q.question_type = ?`; params.push(filterType); }

        query += ` GROUP BY q.id ORDER BY RANDOM()`

        const candidates = await c.env.DB.prepare(query).bind(...params).all<any>()

        
        const groupedCandidates = new Map<string, any[]>();
        
        for (const q of candidates.results) {
            
            const match = q.question_number.match(/^(\d+)/);
            const baseNum = match ? match[1] : q.question_number;
            const groupKey = `${q.paper_id}_${baseNum}`;

            if (!groupedCandidates.has(groupKey)) {
                groupedCandidates.set(groupKey, []);
            }
            groupedCandidates.get(groupKey)!.push(q);
        }

        
        const uncompletedGroups: any[][] = [];
        const completedGroups: any[][] = [];

        for (const group of groupedCandidates.values()) {
            
            group.sort((a, b) => a.question_number.localeCompare(b.question_number, undefined, { numeric: true }));

            const isGroupCompleted = group.every(q => q.is_completed);
            if (isGroupCompleted) {
                completedGroups.push(group);
            } else {
                uncompletedGroups.push(group);
            }
        }

        let currentMarks = 0
        let selectedForSection: any[] = []

        
        const processGroups = (groups: any[][]) => {
            for (const group of groups) {
                if (currentMarks >= desiredMarks) break; 

                let groupMarks = 0;
                for (const q of group) {
                    selectedForSection.push(q);
                    groupMarks += (q.marks || 0);
                }
                
                
                currentMarks += groupMarks;
            }
        }

        
        processGroups(uncompletedGroups);

        
        if (currentMarks < desiredMarks && allowCompleted) {
            processGroups(completedGroups);
        }

        finalQuestions = [...finalQuestions, ...selectedForSection]
    }

    if (finalQuestions.length === 0) return c.text("Could not find enough questions.", 400)

    const examRes = await c.env.DB.prepare(`
                INSERT INTO mock_exams (user_id, subject, exam_name, created_method, allowed_time_seconds, is_timed, status)
                VALUES (?, ?, ?, 'auto', ?, ?, 'in_progress')
                RETURNING id
    `).bind(user.id, subject, examName, timerMinutes * 60, timerMinutes > 0 ? 1 : 0).first<any>()

    if (!examRes) return c.text("Failed to create exam", 500)
    const examId = examRes.id

    const placeholders = finalQuestions.map(() => '(?, ?, ?)').join(', ')
    const values: any[] = []
    finalQuestions.forEach((q: any, index) => {
        values.push(examId, q.id, index)
    })

    await c.env.DB.prepare(`INSERT INTO mock_exam_questions (mock_exam_id, question_id, ordering_index) VALUES ${placeholders}`)
        .bind(...values).run()

    return c.redirect(`/past-papers/mock-exams/${examId}`)
})

app.post('/mock-exams/create-manual', async (c) => {
    const user = await getUser(c)
    if (!user) return c.redirect('/login')

    const body = await c.req.parseBody({ all: true })
    const subject = body['subject'] as string
    const examName = body['exam_name'] as string || 'Custom Exam'
    const timerMinutes = parseInt(body['timer_minutes'] as string || '0')

    let questionIdsRaw = body['question_ids']
    if (!questionIdsRaw) return c.text("No questions selected", 400)

    let questionIds: string[] = []
    if (Array.isArray(questionIdsRaw)) {
        questionIds = (questionIdsRaw as string[]).map(String)
    } else {
        questionIds = [String(questionIdsRaw)]
    }

    questionIds = [...new Set(questionIds)]

    const examRes = await c.env.DB.prepare(`
                INSERT INTO mock_exams (user_id, subject, exam_name, created_method, allowed_time_seconds, is_timed, status)
                VALUES (?, ?, ?, 'manual', ?, ?, 'in_progress')
                RETURNING id
    `).bind(user.id, subject, examName, timerMinutes * 60, timerMinutes > 0 ? 1 : 0).first<any>()

    if (!examRes) return c.text("Failed to create exam", 500)
    const examId = examRes.id

    const placeholders = questionIds.map(() => '(?, ?, ?)').join(', ')
    const values: any[] = []
    questionIds.forEach((qid, index) => {
        values.push(examId, qid, index)
    })

    await c.env.DB.prepare(`INSERT INTO mock_exam_questions (mock_exam_id, question_id, ordering_index) VALUES ${placeholders}`)
        .bind(...values).run()

    return c.redirect(`/past-papers/mock-exams/${examId}`)
})

app.get('/mock-exams/:id', async (c) => {
    const user = await getUser(c)
    if (!user) return c.redirect('/login')
    const examId = c.req.param('id')

    const exam = await c.env.DB.prepare(`SELECT * FROM mock_exams WHERE id = ?`).bind(examId).first<any>()
    if (!exam) return c.notFound()

    const stats = await c.env.DB.prepare(`
        SELECT sum(q.marks) as total_marks 
        FROM mock_exam_questions mq
        JOIN exam_questions q ON mq.question_id = q.id
        WHERE mq.mock_exam_id = ?
    `).bind(examId).first<any>();

    const totalMarks = stats?.total_marks || 0;
    const isOwner = user && user.id === exam.user_id;

    const questions = await c.env.DB.prepare(`
                SELECT q.*, mq.ordering_index, mq.response_content, mq.selected_option, p.school_name, p.academic_year
                FROM mock_exam_questions mq
                JOIN exam_questions q ON mq.question_id = q.id
                JOIN papers p ON q.paper_id = p.id
                WHERE mq.mock_exam_id = ?
                ORDER BY mq.ordering_index ASC
                `).bind(examId).all()

    return c.html(
        <Layout title={`${exam.exam_name}`} user={user} hideFooter latex={true}>
            <div class="fixed top-0 left-0 w-full bg-white dark:bg-neutral-900 shadow-md z-50 px-6 py-3 flex justify-between items-center border-b dark:border-neutral-800 transition-colors">
                <div>
                    <h1 class="font-bold text-lg dark:text-white">{exam.exam_name}</h1>
                    <div class="text-xs text-gray-500 dark:text-neutral-400 flex gap-3">
                        <span>{questions.results.length} Questions</span>
                        <span>•</span>
                        <span>{totalMarks} Marks Total</span>

                        {(exam.status === 'completed' || !isOwner) && (
                            <>
                                <span>•</span>
                                <span>Time Used: {Math.floor((exam.elapsed_time_seconds || 0) / 60)}m {(exam.elapsed_time_seconds || 0) % 60}s</span>
                            </>
                        )}
                    </div>
                </div>

                {isOwner && exam.is_timed && exam.status !== 'completed' && (
                    <div class="font-mono text-xl font-bold text-blue-600 dark:text-blue-400" id="timer-display">
                        00:00:00
                    </div>
                )}

                <div class="flex gap-4">
                    {isOwner && (
                        <button type="submit" form="exam-form" onclick="return confirm('Are you sure you want to finish the exam? Answers will be saved.');" class="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700">
                            Finish Exam
                        </button>
                    )}
                </div>
            </div>

            <form id="exam-form" action={`/past-papers/mock-exams/${examId}/finish`} method="post" class="mt-24 max-w-4xl mx-auto space-y-12 pb-24 px-4">
                {questions.results.map((q: any, i: number) => {
                    
                    const stimPage = getPage(q.stimulus_image_key) || getPage(q.question_image_key);
                    const pdfUrl = `/download/papers/${q.paper_id}.pdf${stimPage ? `#page=${stimPage}` : ''}`;
                    
                    return (
                        <div class="bg-white dark:bg-neutral-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700" id={`q-${q.id}`}>
                            <h3 class="font-bold text-gray-900 dark:text-white text-lg mb-3">Question {i + 1}</h3>
                            
                            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-5 gap-4">
                                <div class="flex flex-wrap items-center gap-3">
                                    <h1 class="text-sm font-bold text-gray-700 dark:text-neutral-500">
                                        {q.school_name} {q.paper_type} {q.academic_year} — {q.section_label} Q{q.question_number}
                                    </h1>
                                    <span class="text-gray-300 dark:text-neutral-600 hidden sm:inline">|</span>
                                    <a href={pdfUrl} target="_blank" class="flex items-center gap-1 px-2 py-1 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/50 rounded hover:bg-red-100 dark:hover:bg-red-900/40 text-xs font-bold transition-colors">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /></svg>
                                        Original PDF {stimPage ? `(p.${stimPage})` : ''}
                                    </a>
                                </div>
                                <div class="text-right shrink-0">
                                    <span class="text-sm font-bold text-gray-500 dark:text-neutral-400">{q.marks} Marks</span>
                                </div>
                            </div>

                            {q.question_text ? (
                                <div class="mb-4 p-6 bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg text-gray-800 dark:text-neutral-200 whitespace-pre-wrap font-serif text-lg leading-relaxed shadow-sm">
                                    {q.question_text}
                                </div>
                            ) : (
                                q.question_image_key && (
                                    <img src={`/download/${q.question_image_key}`} class="max-w-full rounded border border-gray-100 dark:border-neutral-700 mb-4" />
                                )
                            )}

                            {(q.stimulus_text || q.stimulus_image_key) && (
                                <div class="mt-4 p-4 bg-gray-50 dark:bg-neutral-900/50 rounded border border-gray-200 dark:border-neutral-700">
                                    <p class="text-xs font-bold text-gray-500 dark:text-neutral-400 uppercase mb-2">Stimulus</p>
                                    {q.stimulus_text ? (
                                        <div class="text-gray-700 dark:text-neutral-300 italic border-l-4 border-l-blue-400 dark:border-l-blue-600 pl-4 py-2 whitespace-pre-wrap">
                                            {q.stimulus_text}
                                        </div>
                                    ) : q.stimulus_image_key?.startsWith('pdf_crop:') ? (
                                        <pdf-crop pdf-url={`/download/papers/${q.paper_id}.pdf`} crop-data={q.stimulus_image_key.replace('pdf_crop:', '')}></pdf-crop>
                                    ) : (
                                        <img src={`/download/${q.stimulus_image_key}`} class="max-w-full rounded" />
                                    )}
                                </div>
                            )}

                            {/* Response Capture Area */}
                            <div class="mt-6">
                                {q.question_type === 'multiple_choice' ? (
                                    <div class="flex flex-col gap-3">
                                        <label class="font-bold text-gray-700 dark:text-neutral-300">Select an Option:</label>
                                        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                                            {['A', 'B', 'C', 'D'].map(opt => (
                                                <label class="cursor-pointer">
                                                    <input type="radio" name={`option_${q.id}`} value={opt} checked={q.selected_option === opt} class="peer hidden" />
                                                    <div class="p-3 border border-gray-300 dark:border-neutral-700 rounded text-center hover:bg-gray-50 dark:hover:bg-neutral-800 peer-checked:border-blue-500 peer-checked:bg-blue-50 dark:peer-checked:bg-blue-900/30 peer-checked:text-blue-700 dark:peer-checked:text-blue-400 font-bold transition-all">
                                                        {opt}
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        
                                        <textarea name={`response_${q.id}`} placeholder="Type your answer here..." class="w-full h-40 p-4 rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500">{q.response_content || ''}</textarea>
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                })}
            </form>

            {isOwner && exam.is_timed && exam.status !== 'completed' && (
                <script dangerouslySetInnerHTML={{
                    __html: `
                    let elapsed = ${exam.elapsed_time_seconds || 0};
                    let allowed = ${exam.allowed_time_seconds || 0};
                    const display = document.getElementById('timer-display');
                    
                    function formatTime(sec) {
                        const h = Math.floor(sec / 3600).toString().padStart(2, '0');
                        const m = Math.floor((sec % 3600) / 60).toString().padStart(2, '0');
                        const s = (sec % 60).toString().padStart(2, '0');
                        return \`\${h}:\${m}:\${s}\`;
                    }
                    
                    setInterval(() => {
                        elapsed++;
                        if (allowed > 0 && elapsed > allowed) {
                            display.classList.add('text-red-600');
                        }
                        display.innerText = formatTime(elapsed);
                        
                        if (elapsed % 30 === 0) {
                             fetch('/past-papers/mock-exams/${examId}/progress', {
                                method: 'POST',
                                headers: {'Content-Type': 'application/json'},
                                body: JSON.stringify({ elapsed })
                             });
                        }
                    }, 1000);
                 `}} />
            )}
        </Layout>
    )
})

app.post('/mock-exams/:id/finish', async (c) => {
    const user = await getUser(c)
    if (!user) return c.redirect('/login')
    const examId = c.req.param('id')
    const body = await c.req.parseBody()

    const examQuestions = await c.env.DB.prepare(`SELECT question_id FROM mock_exam_questions WHERE mock_exam_id = ?`).bind(examId).all()

    for (const q of examQuestions.results) {
        const response = (body[`response_${q.question_id}`] as string) || null;
        const option = (body[`option_${q.question_id}`] as string) || null;

        await c.env.DB.prepare(`
            UPDATE mock_exam_questions
            SET response_content = ?, selected_option = ?
            WHERE mock_exam_id = ? AND question_id = ?
        `).bind(response, option, examId, q.question_id).run();
    }

    await c.env.DB.prepare(`UPDATE mock_exams SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`)
        .bind(examId, user.id).run()

    return c.redirect(`/past-papers/mock-exams/${examId}/mark`)
})

app.post('/mock-exams/:id/progress', async (c) => {
    const user = await getUser(c)
    if (!user) return c.json({ error: 'Unauthorized' }, 401)
    const examId = c.req.param('id')
    const body = await c.req.json()

    await c.env.DB.prepare(`UPDATE mock_exams SET elapsed_time_seconds = ? WHERE id = ? AND user_id = ?`)
        .bind(body.elapsed, examId, user.id).run()

    return c.json({ success: true })
})

app.get('/mock-exams/:id/mark', async (c) => {
    const user = await getUser(c)
    if (!user) return c.redirect('/login')
    const examId = c.req.param('id')

    const exam = await c.env.DB.prepare(`SELECT * FROM mock_exams WHERE id = ?`).bind(examId).first<any>()
    if (!exam) return c.notFound()

    const isOwner = user && user.id === exam.user_id;

    const stats = await c.env.DB.prepare(`
        SELECT sum(q.marks) as total_marks 
        FROM mock_exam_questions mq
        JOIN exam_questions q ON mq.question_id = q.id
        WHERE mq.mock_exam_id = ?
    `).bind(examId).first<any>();

    const totalMarks = stats?.total_marks || 0;

    const questions = await c.env.DB.prepare(`
                SELECT q.*, mq.ordering_index, mq.response_content, mq.selected_option, p.school_name, p.academic_year,
                ua.marks_awarded as existing_marks, ua.marker_notes, ua.is_completed
                FROM mock_exam_questions mq
                JOIN exam_questions q ON mq.question_id = q.id
                JOIN papers p ON q.paper_id = p.id
                LEFT JOIN user_question_attempts ua ON q.id = ua.question_id AND ua.user_id = ?
                WHERE mq.mock_exam_id = ?
                ORDER BY mq.ordering_index ASC
                `).bind(exam.user_id, examId).all()

    return c.html(
        <Layout title={`Marking - ${exam.exam_name}`} user={user} latex={true}>
            <div class="max-w-5xl mx-auto pb-24 px-4">
                <div class="mb-8 border-b dark:border-neutral-700 pb-4">
                    <h1 class="text-3xl font-bold mb-2 dark:text-white">Marking: {exam.exam_name}</h1>
                    <div class="flex gap-4 text-gray-500 dark:text-neutral-400 text-sm">
                        <span>Total Marks: {totalMarks}</span>
                        <span>Time Used: {Math.floor((exam.elapsed_time_seconds || 0) / 60)}m {(exam.elapsed_time_seconds || 0) % 60}s</span>
                    </div>
                </div>

                <form action={`/past-papers/mock-exams/${examId}/submit-marks`} method="post" class="space-y-12">
                    {questions.results.map((q: any, i: number) => {
                        const stimPage = getPage(q.stimulus_image_key) || getPage(q.question_image_key);
                        const pdfUrl = `/download/papers/${q.paper_id}.pdf${stimPage ? `#page=${stimPage}` : ''}`;
                        

                        return (
                            <div class="bg-white dark:bg-neutral-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700">
                                
                                <h3 class="font-bold text-gray-900 dark:text-white text-lg mb-3">Question {i + 1}</h3>
                                <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
                                    <div class="flex flex-wrap items-center gap-3">
                                        <h1 class="text-sm font-bold text-gray-700 dark:text-neutral-300">
                                            {q.school_name} {q.academic_year} — {q.section_label} Q{q.question_number}
                                        </h1>
                                        <span class="text-gray-300 dark:text-neutral-600 hidden sm:inline">|</span>
                                        <a href={pdfUrl} target="_blank" class="flex items-center gap-1 px-2 py-1 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/50 rounded hover:bg-red-100 dark:hover:bg-red-900/40 text-xs font-bold transition-colors">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /></svg>
                                            Original PDF {stimPage ? `(p.${stimPage})` : ''}
                                        </a>
                                    </div>
                                    <div class="text-right shrink-0">
                                        <span class="text-sm font-bold text-gray-500 dark:text-neutral-400">{q.marks} Marks Max</span>
                                    </div>
                                </div>

                                <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    {/* Left: Question & Student Answer */}
                                    <div class="flex flex-col gap-6">
                                        <div>
                                            <h4 class="font-bold text-sm text-gray-500 dark:text-neutral-400 uppercase mb-2">Question</h4>
                                            {q.question_text ? (
                                                <div class="p-4 bg-gray-50 dark:bg-neutral-900/50 border border-gray-200 dark:border-neutral-700 rounded text-gray-800 dark:text-neutral-200 whitespace-pre-wrap text-sm">
                                                    {q.question_text}
                                                </div>
                                            ) : (
                                                q.question_image_key ? (
                                                    <img src={`/download/${q.question_image_key}`} class="max-w-full rounded border border-gray-100 dark:border-neutral-700" />
                                                ) : <p class="text-red-500 dark:text-red-400 text-sm">Image missing</p>
                                            )}
                                        </div>

                                        <div class="bg-blue-50 dark:bg-blue-900/10 p-4 rounded border border-blue-200 dark:border-blue-800/50">
                                            <h4 class="font-bold text-sm text-blue-800 dark:text-blue-300 uppercase mb-3">Student's Answer</h4>
                                            {q.question_type === 'multiple_choice' ? (
                                                <div class="font-medium text-gray-900 dark:text-gray-100">
                                                    Selected Option: <span class="font-bold bg-white dark:bg-neutral-800 px-3 py-1 border border-gray-300 dark:border-neutral-600 rounded ml-2">{q.selected_option || 'None'}</span>
                                                </div>
                                            ) : (
                                                <div class="whitespace-pre-wrap text-gray-900 dark:text-gray-200 bg-white dark:bg-neutral-800 p-4 border border-gray-200 dark:border-neutral-700 rounded shadow-inner min-h-[100px]">
                                                    {q.response_content || <span class="italic text-gray-500 dark:text-neutral-500">No response provided.</span>}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Right: Answer Key & Marking */}
                                    <div class="flex flex-col gap-6">
                                        <div>
                                            <h4 class="font-bold text-sm text-gray-500 dark:text-neutral-400 uppercase mb-2">Answer / Guidelines</h4>
                                            {q.answer_text ? (
                                                <div class="p-4 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/50 rounded text-green-900 dark:text-green-300 whitespace-pre-wrap text-sm">
                                                    {q.answer_text}
                                                </div>
                                            ) : (
                                                q.answer_image_key ? (
                                                    <img src={`/download/${q.answer_image_key}`} class="max-w-full rounded border border-gray-100 dark:border-neutral-700" />
                                                ) : (
                                                    <div class="bg-gray-50 dark:bg-neutral-900/50 p-4 rounded text-sm text-gray-500 dark:text-neutral-400 italic border border-gray-200 dark:border-neutral-700">No answer key available.</div>
                                                )
                                            )}
                                        </div>

                                        <div class="bg-gray-50 dark:bg-neutral-900/50 p-5 rounded border border-gray-200 dark:border-neutral-700">
                                            <div class="mb-5">
                                                <label class="block font-bold text-gray-800 dark:text-neutral-200 mb-3">Marks Awarded (Max: {q.marks})</label>
                                                <div class="flex flex-wrap gap-2">
                                                    {Array.from({ length: (q.marks || 0) + 1 }, (_, m) => (
                                                        <label class="cursor-pointer">
                                                            <input type="radio" name={`marks_${q.id}`} value={m} checked={q.existing_marks === m} class="peer hidden" />
                                                            <div class="w-10 h-10 rounded border border-gray-300 dark:border-neutral-600 font-bold flex items-center justify-center bg-white dark:bg-neutral-800 text-gray-700 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-700 peer-checked:bg-blue-600 peer-checked:text-white peer-checked:border-blue-600 transition-colors shadow-sm">
                                                                {m}
                                                            </div>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>

                                            <div>
                                                <label class="block font-bold text-gray-800 dark:text-neutral-200 mb-2">Marker's Notes</label>
                                                <textarea name={`notes_${q.id}`} placeholder="Provide feedback or notes here..." class="w-full h-24 p-3 rounded-md border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm">{q.marker_notes || ''}</textarea>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    })}

                    <div class="fixed bottom-0 left-0 w-full bg-white dark:bg-neutral-900 border-t dark:border-neutral-800 p-4 flex justify-between items-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] transition-colors z-50">
                        <div class="text-gray-500 dark:text-neutral-400 text-sm pl-4 hidden sm:block">Don't forget to save your marks! Data gets saved directly to your questions history.</div>
                        <button class="bg-green-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-green-700 shadow-md w-full sm:w-auto transition-colors">
                            Save & Complete Marking
                        </button>
                    </div>
                </form>
            </div>
        </Layout>
    )
})

app.post('/mock-exams/:id/submit-marks', async (c) => {
    const user = await getUser(c)
    if (!user) return c.redirect('/login')
    const examId = c.req.param('id')
    const body = await c.req.parseBody()

    const examQuestions = await c.env.DB.prepare(`
        SELECT mq.question_id, mq.response_content, mq.selected_option 
        FROM mock_exam_questions mq 
        WHERE mq.mock_exam_id = ?
    `).bind(examId).all()

    const stmt = c.env.DB.prepare(`
        INSERT INTO user_question_attempts 
            (user_id, question_id, marks_awarded, marker_notes, response_content, selected_option, is_completed, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id, question_id) DO UPDATE SET
            marks_awarded = excluded.marks_awarded,
            marker_notes = excluded.marker_notes,
            response_content = excluded.response_content,
            selected_option = excluded.selected_option,
            is_completed = 1,
            updated_at = excluded.updated_at
    `)

    for (const q of examQuestions.results) {
        const marksKey = `marks_${q.question_id}`
        const notesKey = `notes_${q.question_id}`
        const marksStr = body[marksKey]
        const notesStr = (body[notesKey] as string) || ''

        if (marksStr && marksStr !== '') {
            const marks = parseInt(marksStr as string)
            await stmt.bind(
                user.id, 
                q.question_id, 
                marks, 
                notesStr, 
                q.response_content || null, 
                q.selected_option || null
            ).run()
        }
    }

    return c.redirect(`/past-papers/mock-exams`)
})

export default app
