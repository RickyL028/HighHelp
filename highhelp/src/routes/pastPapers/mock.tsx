import { Hono } from 'hono'
import { Layout } from '../../layout'
import { getUser } from '../../utils'
import { Bindings } from '../../types'

const app = new Hono<{ Bindings: Bindings }>()

// 1. Dashboard - List User's Mock Exams
app.get('/mock-exams', async (c) => {
    const user = await getUser(c)
    if (!user) return c.redirect('/login')

    const subject = c.req.query('subject') || ''
    const tabs = [
        { id: 'browse', label: 'Browse Papers', href: `/past-papers?subject=${encodeURIComponent(subject)}&tab=browse` },
        { id: 'practice', label: 'Practice Questions', href: `/past-papers?subject=${encodeURIComponent(subject)}&tab=practice` },
        { id: 'exam', label: 'Mock Exam', href: `/past-papers/mock-exams?subject=${encodeURIComponent(subject)}` },
        { id: 'review', label: 'Review', href: `/past-papers?subject=${encodeURIComponent(subject)}&tab=review` },
    ];

    // Fetch user's mock exams
    // Fetch user's mock exams with scores
    // We used a subquery or join to get total gained marks.
    const exams = await c.env.DB.prepare(`
        SELECT m.*, 
               count(mq.question_id) as question_count,
               sum(CASE WHEN q.marks IS NOT NULL THEN q.marks ELSE 0 END) as total_marks_possible,
               sum(mq.marks_awarded) as total_marks_gained
        FROM mock_exams m
        LEFT JOIN mock_exam_questions mq ON m.id = mq.mock_exam_id
        LEFT JOIN exam_questions q ON mq.question_id = q.id
        WHERE m.user_id = ? AND m.subject = ?
        GROUP BY m.id
        ORDER BY m.created_at DESC
    `).bind(user.id, subject).all()

    return c.html(
        <Layout title={`Mock Exams - ${subject}`} user={user}>
            <div class="mx-auto">
                {/* 1. Breadcrumbs */}
                <div class="flex items-center gap-2 text-sm text-gray-500 mb-4">
                    <a href="/past-papers" class="hover:underline">Past Papers</a>
                    <span>/</span>
                    <span class="font-bold text-gray-700">{subject}</span>
                </div>


                {/* 2. Tabs Navigation */}
                <div class="border-b border-gray-200 mb-8">
                    <nav class="-mb-px flex space-x-8">
                        {tabs.map(t => (
                            <a href={t.href}
                                class={`
                                    whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors
                                    ${t.id === 'exam' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                                `}>
                                {t.label}
                            </a>
                        ))}
                    </nav>
                </div>
            </div>
            <div class="mx-auto space-y-8">
                {/* Header */}

                <div class="flex justify-between items-center">
                    <h1 class="text-3xl font-bold">Mock Exams</h1>
                    <a href={`/past-papers/mock-exams/create?subject=${encodeURIComponent(subject || '')}`} class="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700 shadow-sm transition">
                        + Create New Exam
                    </a>
                </div>

                {/* Exam List */}
                <div class="grid gap-4">
                    {exams.results.length === 0 ? (
                        <div class="text-center py-12 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                            You haven't created any mock exams for {subject} yet.
                        </div>
                    ) : (
                        exams.results.map((exam: any) => (
                            <div class="bg-white p-4 rounded border border-gray-300 hover:border-blue-500 transition-colors flex justify-between items-center">
                                <div>
                                    <h3 class="font-bold text-lg text-gray-900">{exam.exam_name || 'Untitled Exam'}</h3>
                                    <div class="text-sm text-gray-500 flex gap-3 mt-1 items-center">
                                        <span class="capitalize">{exam.created_method} Generated</span>
                                        <span>•</span>
                                        <span>{exam.question_count} Questions</span>
                                        {exam.is_timed ? (
                                            <>
                                                <span>•</span>
                                                <span>Limit: {Math.floor((exam.allowed_time_seconds || 0) / 60)}m</span>
                                            </>
                                        ) : null}
                                        {exam.status === 'completed' && (
                                            <>
                                                <span>•</span>
                                                <span class="font-bold text-gray-700">
                                                    Score: {exam.total_marks_gained || 0} / {exam.total_marks_possible || 0}
                                                </span>
                                                <span>•</span>
                                                <span>
                                                    Time: {Math.floor((exam.elapsed_time_seconds || 0) / 60)}m {(exam.elapsed_time_seconds || 0) % 60}s
                                                </span>
                                            </>
                                        )}
                                    </div>
                                    <div class="mt-2">
                                        <span class={`text-xs font-bold uppercase px-2 py-1 rounded ${exam.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                                            }`}>
                                            {exam.status.replace('_', ' ')}
                                        </span>
                                    </div>
                                </div>
                                <div class="flex gap-2">
                                    {exam.status === 'in_progress' ? (
                                        <a href={`/past-papers/mock-exams/${exam.id}`} class="bg-blue-100 text-blue-700 px-4 py-2 rounded font-bold hover:bg-blue-200">
                                            Continue
                                        </a>
                                    ) : (
                                        <div class="flex flex-col gap-2">
                                            <a href={`/past-papers/mock-exams/${exam.id}/mark`} class="bg-gray-100 text-gray-700 px-4 py-2 rounded font-bold hover:bg-gray-200 text-center">
                                                Results
                                            </a>
                                            <form action={`/past-papers/mock-exams/${exam.id}/redo`} method="post" onsubmit="return confirm('Start a fresh copy of this exam?');">
                                                <button class="text-xs text-blue-600 hover:underline w-full text-center">Redo Exam</button>
                                            </form>
                                        </div>
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

// 2. Creation UI
app.get('/mock-exams/create', async (c) => {
    const user = await getUser(c)
    if (!user) return c.redirect('/login')
    const subject = c.req.query('subject') || ''


    // Get distinct sections for simple auto-generation
    const sections = await c.env.DB.prepare(`
        SELECT DISTINCT q.section_label 
        FROM exam_questions q 
        JOIN papers p ON q.paper_id = p.id 
        WHERE p.subject = ? 
        ORDER BY q.section_label ASC
    `).bind(subject).all()

    const topics = await c.env.DB.prepare('SELECT * FROM topics WHERE subject = ? ORDER BY name ASC').bind(subject).all()

    return c.html(


        <Layout title={`Create Mock Exam - ${subject}`} user={user}>


            <div class="max-w-3xl mx-auto">
                <div class="mb-6">
                    <a href={`/past-papers/mock-exams?subject=${encodeURIComponent(subject || '')}`} class="text-gray-500 hover:text-gray-700 text-sm">
                        ← Back to Mock Exams
                    </a>
                </div>

                <h1 class="text-3xl font-bold mb-8">Create Mock Exam</h1>

                <div class="space-y-6">
                    <div class="flex border-b border-gray-200">
                        <a href={`?subject=${encodeURIComponent(subject || '')}&mode=auto`} class={`px-6 py-3 font-medium border-b-2 transition-colors ${!c.req.query('mode') || c.req.query('mode') === 'auto' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'}`}>Auto Generate</a>
                        <a href={`?subject=${encodeURIComponent(subject || '')}&mode=manual`} class={`px-6 py-3 font-medium border-b-2 transition-colors ${c.req.query('mode') === 'manual' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'}`}>Manual Selection</a>
                    </div>

                    {(!c.req.query('mode') || c.req.query('mode') === 'auto') && (
                        <div>
                            <form action="/past-papers/mock-exams/create-auto" method="post" class="space-y-6 bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                                <input type="hidden" name="subject" value={subject || ''} />

                                <div>
                                    <label class="block font-bold text-gray-700 mb-2">Exam Name</label>
                                    <input type="text" name="exam_name" placeholder="e.g. Weekly Practice" class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" required />
                                </div>

                                <div>
                                    <label class="block font-bold text-gray-700 mb-2">Uncompleted Priority</label>
                                    <p class="text-sm text-gray-500 mb-2">We try to find unattempted questions first. If not enough, should we use completed ones?</p>
                                    <label class="flex items-center gap-2">
                                        <input type="checkbox" name="allow_completed" value="1" checked class="rounded text-blue-600 focus:ring-blue-500" />
                                        <span class="text-gray-700">Allow using completed questions if needed</span>
                                    </label>
                                </div>

                                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div>
                                        <label class="block font-bold text-gray-700 mb-2">Topic Filter</label>
                                        <select name="topic" class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
                                            <option value="">All Topics</option>
                                            {topics.results.map((t: any) => <option value={t.id}>{t.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label class="block font-bold text-gray-700 mb-2">Year</label>
                                        <input type="number" name="year" placeholder="Any Year" class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
                                    </div>
                                    <div>
                                        <label class="block font-bold text-gray-700 mb-2">Question Type</label>
                                        <select name="type" class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
                                            <option value="">Any Type</option>
                                            <option value="multiple_choice">Multiple Choice</option>
                                            <option value="short_answer">Short Answer</option>
                                            <option value="extended_response">Extended Response</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label class="block font-bold text-gray-700 mb-4">Marks per Section</label>
                                    <p class="text-sm text-gray-500 mb-4">Enter how many marks you want for each section (approximate).</p>
                                    <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
                                        {sections.results.map((s: any) => (
                                            <div>
                                                <label class="block text-xs font-bold text-gray-500 uppercase mb-1">{s.section_label}</label>
                                                <input type="number" name={`marks_${s.section_label}`} placeholder="0" class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label class="block font-bold text-gray-700 mb-2">Timer (Optional)</label>
                                    <div class="flex items-center gap-2">
                                        <input type="number" name="timer_minutes" placeholder="Minutes" class="w-32 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
                                        <span class="text-gray-500">minutes</span>
                                    </div>
                                </div>

                                <div class="pt-4">
                                    <button class="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 shadow-sm transition">Generate Exam</button>
                                </div>
                            </form>
                        </div>
                    )}

                    {c.req.query('mode') === 'manual' && (
                        <div class="bg-gray-50 p-6 rounded-lg border border-gray-200 text-center">
                            <p class="text-gray-600 mb-4">To create a manual exam, please browse the <strong>Practice Questions</strong> tab and select the questions you want to add.</p>
                            <a href={`/past-papers?subject=${encodeURIComponent(subject || '')}&tab=practice&mode=select`} class="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700 transition">
                                Go to Question Selector
                            </a>
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    )
})

// 3. Handle Auto Creation
app.post('/mock-exams/create-auto', async (c) => {
    const user = await getUser(c)
    if (!user) return c.redirect('/login')

    const body = await c.req.parseBody()
    const subject = body['subject'] as string
    const examName = body['exam_name'] as string
    const allowCompleted = body['allow_completed'] === '1'
    const timerMinutes = parseInt(body['timer_minutes'] as string || '0')

    const filterTopic = body['topic'] as string
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

    // Logic to select questions
    let finalQuestions: any[] = []

    // Fetch valid section order from DB to ensure strict ordering (I, II, III...)
    const orderedDbSections = await c.env.DB.prepare(`
        SELECT DISTINCT q.section_label 
        FROM exam_questions q 
        JOIN papers p ON q.paper_id = p.id 
        WHERE p.subject = ? 
        ORDER BY q.section_label ASC
    `).bind(subject).all();

    // Filter to only included sections
    const targetSections = orderedDbSections.results
        .map((s: any) => s.section_label)
        .filter((label: string) => sections[label] !== undefined);

    // For each section request
    for (const section of targetSections) {
        const desiredMarks = sections[section];

        // Fetch candidates for this section
        // Priority 1: Uncompleted
        // Priority 2: Completed (if allowed)
        // We fetch ALL questions for the section and do logic in JS for simplicity or complex SQL

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

        if (filterTopic) { query += ` AND qt.topic_id = ?`; params.push(filterTopic); }
        if (filterYear) { query += ` AND p.academic_year = ?`; params.push(filterYear); }
        if (filterType) { query += ` AND q.question_type = ?`; params.push(filterType); }

        query += ` GROUP BY q.id ORDER BY RANDOM()`

        const candidates = await c.env.DB.prepare(query).bind(...params).all<any>()

        let currentMarks = 0
        let selectedForSection: any[] = []

        // Filter uncompleted
        const uncompleted = candidates.results.filter((q: any) => !q.is_completed)
        const completed = candidates.results.filter((q: any) => q.is_completed)

        // Fill with uncompleted
        for (const q of uncompleted) {
            if (currentMarks < desiredMarks) {
                // Avoid duplicates (though unlikely with section isolation)
                selectedForSection.push(q)
                currentMarks += (q.marks || 0)
            }
        }

        // If need more and allowed
        if (currentMarks < desiredMarks && allowCompleted) {
            for (const q of completed) {
                if (currentMarks < desiredMarks) {
                    selectedForSection.push(q)
                    currentMarks += (q.marks || 0)
                }
            }
        }

        finalQuestions = [...finalQuestions, ...selectedForSection]
    }

    if (finalQuestions.length === 0) return c.text("Could not find enough questions.", 400) // Improve error handling

    // Create Exam
    const examRes = await c.env.DB.prepare(`
                INSERT INTO mock_exams (user_id, subject, exam_name, created_method, allowed_time_seconds, is_timed, status)
                VALUES (?, ?, ?, 'auto', ?, ?, 'in_progress')
                RETURNING id
    `).bind(user.id, subject, examName, timerMinutes * 60, timerMinutes > 0 ? 1 : 0).first<any>()

    if (!examRes) return c.text("Failed to create exam", 500)
    const examId = examRes.id

    // Insert Questions
    const placeholders = finalQuestions.map(() => '(?, ?, ?)').join(', ')
    const values: any[] = []
    finalQuestions.forEach((q: any, index) => {
        values.push(examId, q.id, index)
    })

    await c.env.DB.prepare(`INSERT INTO mock_exam_questions (mock_exam_id, question_id, ordering_index) VALUES ${placeholders}`)
        .bind(...values).run()

    return c.redirect(`/past-papers/mock-exams/${examId}`)
})

// 4. Handle Manual Creation (Post from Browse)
app.post('/mock-exams/create-manual', async (c) => {
    const user = await getUser(c)
    if (!user) return c.redirect('/login')

    const body = await c.req.parseBody()
    const subject = body['subject'] as string
    const examName = body['exam_name'] as string || 'Custom Exam'
    const timerMinutes = parseInt(body['timer_minutes'] as string || '0')

    // body['questions'] will be an array of strings if multiple check boxes
    // or a single string if one. Hono/middleware usage might need checking.
    // Usually Hono parseBody returns string | string[]

    let questionIdsRaw = body['question_ids']
    if (!questionIdsRaw) return c.text("No questions selected", 400)

    let questionIds: string[] = []
    if (Array.isArray(questionIdsRaw)) {
        questionIds = questionIdsRaw.map(String)
    } else {
        questionIds = [String(questionIdsRaw)]
    }

    // sort unique?
    questionIds = [...new Set(questionIds)]

    // Create Exam
    const examRes = await c.env.DB.prepare(`
                INSERT INTO mock_exams (user_id, subject, exam_name, created_method, allowed_time_seconds, is_timed, status)
                VALUES (?, ?, ?, 'manual', ?, ?, 'in_progress')
                RETURNING id
    `).bind(user.id, subject, examName, timerMinutes * 60, timerMinutes > 0 ? 1 : 0).first<any>()

    if (!examRes) return c.text("Failed to create exam", 500)
    const examId = examRes.id

    // Insert Questions
    // We assume the order they came in is preserved or we just order by index
    const placeholders = questionIds.map(() => '(?, ?, ?)').join(', ')
    const values: any[] = []
    questionIds.forEach((qid, index) => {
        values.push(examId, qid, index)
    })

    await c.env.DB.prepare(`INSERT INTO mock_exam_questions (mock_exam_id, question_id, ordering_index) VALUES ${placeholders}`)
        .bind(...values).run()

    return c.redirect(`/past-papers/mock-exams/${examId}`)
})

// 4b. Redo Exam
app.post('/mock-exams/:id/redo', async (c) => {
    const user = await getUser(c)
    if (!user) return c.redirect('/login')
    const oldExamId = c.req.param('id')

    // 1. Fetch old exam details
    const oldExam = await c.env.DB.prepare('SELECT * FROM mock_exams WHERE id = ? AND user_id = ?').bind(oldExamId, user.id).first<any>()
    if (!oldExam) return c.notFound()

    // 2. Fetch Questions
    const questions = await c.env.DB.prepare('SELECT * FROM mock_exam_questions WHERE mock_exam_id = ? ORDER BY ordering_index ASC').bind(oldExamId).all()

    // 3. Create New Exam
    const newName = oldExam.exam_name.includes('(Redo)') ? oldExam.exam_name : `${oldExam.exam_name} (Redo)`

    const examRes = await c.env.DB.prepare(`
        INSERT INTO mock_exams (user_id, subject, exam_name, created_method, allowed_time_seconds, is_timed, status)
        VALUES (?, ?, ?, ?, ?, ?, 'in_progress')
        RETURNING id
    `).bind(user.id, oldExam.subject, newName, oldExam.created_method, oldExam.allowed_time_seconds, oldExam.is_timed).first<any>()

    if (!examRes) return c.text("Failed to create exam", 500)
    const newExamId = examRes.id

    // 4. Copy Questions
    if (questions.results.length > 0) {
        const placeholders = questions.results.map(() => '(?, ?, ?)').join(', ')
        const values: any[] = []
        questions.results.forEach((q: any) => {
            values.push(newExamId, q.question_id, q.ordering_index)
        })

        await c.env.DB.prepare(`INSERT INTO mock_exam_questions (mock_exam_id, question_id, ordering_index) VALUES ${placeholders}`)
            .bind(...values).run()
    }

    return c.redirect(`/past-papers/mock-exams/${newExamId}`)
})


// 5. Exam Interface
app.get('/mock-exams/:id', async (c) => {
    // ALLOW public view (no login check for viewing, but maybe for taking? User asked to fix 404)
    // We'll just fetch by ID. Only show "Finish" if it's your exam or maybe anyone can if we want?
    // For now, removing the user_id constraint on FETCH.

    const user = await getUser(c)
    const examId = c.req.param('id')

    const exam = await c.env.DB.prepare(`SELECT * FROM mock_exams WHERE id = ?`).bind(examId).first<any>()
    if (!exam) return c.notFound()

    // Calculate Total Marks
    const stats = await c.env.DB.prepare(`
        SELECT sum(q.marks) as total_marks 
        FROM mock_exam_questions mq
        JOIN exam_questions q ON mq.question_id = q.id
        WHERE mq.mock_exam_id = ?
    `).bind(examId).first<any>();

    const totalMarks = stats?.total_marks || 0;

    // Check ownership
    const isOwner = user && user.id === exam.user_id;

    const questions = await c.env.DB.prepare(`
                SELECT q.*, mq.ordering_index, p.school_name, p.academic_year, q.question_number
                FROM mock_exam_questions mq
                JOIN exam_questions q ON mq.question_id = q.id
                JOIN papers p ON q.paper_id = p.id
                WHERE mq.mock_exam_id = ?
                ORDER BY mq.ordering_index ASC
                `).bind(examId).all()

    return c.html(
        <Layout title={`${exam.exam_name}`} user={user} hideFooter>
            {/* hideFooter optional prop to minimize distraction? */}
            <div class="fixed top-0 left-0 w-full bg-white shadow-md z-50 px-6 py-3 flex justify-between items-center border-b">
                <div>
                    <h1 class="font-bold text-lg">{exam.exam_name}</h1>
                    <div class="text-xs text-gray-500 flex gap-3">
                        <span>{questions.results.length} Questions</span>
                        <span>•</span>
                        <span>{totalMarks} Marks Total</span>
                        {/* Always show time used if completed, or current time if running? */}
                        {(exam.status === 'completed' || !isOwner) && (
                            <>
                                <span>•</span>
                                <span>Time Used: {Math.floor((exam.elapsed_time_seconds || 0) / 60)}m {(exam.elapsed_time_seconds || 0) % 60}s</span>
                            </>
                        )}
                    </div>
                </div>

                {isOwner && exam.is_timed && exam.status !== 'completed' && (
                    <div class="font-mono text-xl font-bold text-blue-600" id="timer-display">
                        00:00:00
                    </div>
                )}

                <div class="flex gap-4">
                    {isOwner && (
                        <button type="submit" form="exam-form" class="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700">
                            Finish Exam
                        </button>
                    )}
                </div>
            </div>

            {isOwner ? (
                <form id="exam-form" action={`/past-papers/mock-exams/${examId}/finish`} method="post" class="mt-20 max-w-4xl mx-auto space-y-12 pb-24" onsubmit="document.getElementById('final-time-input').value = elapsed; return confirm('Are you sure you want to finish the exam?');">
                    <input type="hidden" name="final_elapsed" id="final-time-input" value={exam.elapsed_time_seconds || 0} />

                    {questions.results.map((q: any, i: number) => (
                        <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-200" id={`q-${q.id}`}>
                            <div class="flex justify-between items-start mb-4">
                                <h3 class="font-bold text-gray-900 text-lg">Question {i + 1}</h3>
                                <div class="text-right">
                                    <span class="text-sm font-bold text-gray-500">{q.marks} Marks</span>
                                    <div class="text-xs text-gray-400">
                                        {q.school_name} {q.academic_year}
                                        <span class="ml-1 px-1 bg-gray-100 rounded text-gray-500">#{q.question_number}</span>
                                    </div>
                                </div>
                            </div>

                            {q.question_image_key && (
                                <img src={`/download/${q.question_image_key}`} class="max-w-full rounded border border-gray-100 mb-4" />
                            )}

                            {q.stimulus_image_key && (
                                <div class="mt-4 p-4 bg-gray-50 rounded border border-gray-200">
                                    <p class="text-xs font-bold text-gray-500 uppercase mb-2">Stimulus</p>
                                    <img src={`/download/${q.stimulus_image_key}`} class="max-w-full rounded" />
                                </div>
                            )}

                            <div class="mt-6">
                                {q.question_type === 'multiple_choice' ? (
                                    <div class="grid grid-cols-2 gap-4">
                                        {['A', 'B', 'C', 'D'].map(opt => (
                                            <label class="cursor-pointer">
                                                <input type="radio" name={`response_${q.id}`} value={opt} class="peer sr-only" />
                                                <div class="text-center p-4 rounded-lg border-2 border-gray-200 hover:border-blue-400 peer-checked:border-blue-600 peer-checked:bg-blue-50 transition">
                                                    <span class="text-xl font-bold text-gray-700 peer-checked:text-blue-700">{opt}</span>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                ) : (
                                    <textarea name={`response_${q.id}`} placeholder="Type your answer here..." class="w-full h-32 rounded border-gray-300 text-sm focus:border-blue-500"></textarea>
                                )}
                            </div>
                        </div>
                    ))}
                </form>
            ) : (
                <div class="mt-20 max-w-4xl mx-auto space-y-12 pb-24">
                    {/* Read-only view for non-owners/completed if needed, but for now we focus on the taking flow */}
                    {questions.results.map((q: any, i: number) => (
                        // ... Simplified read-only render or just same as above disabled?
                        // For simplicity, just rendering the questions without inputs if not owner
                        <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                            <h3 class="font-bold text-gray-900 text-lg">Question {i + 1}</h3>
                            {/* ... images ... */}
                            {q.question_image_key && <img src={`/download/${q.question_image_key}`} class="max-w-full rounded mb-4" />}
                        </div>
                    ))}
                </div>
            )}

            {/* Timer Script */}
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
                        
                        // Auto-submit if time up
                        if (allowed > 0 && elapsed >= allowed) {
                             document.getElementById('final-time-input').value = elapsed;
                             document.getElementById('exam-form').submit();
                        }

                        // Save every 30 seconds
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

// 6. Finish Exam
app.post('/mock-exams/:id/finish', async (c) => {
    const user = await getUser(c)
    if (!user) return c.redirect('/login')
    const examId = c.req.param('id')
    const body = await c.req.parseBody()
    const finalElapsed = parseInt(body['final_elapsed'] as string || '0')

    // 1. Update Exam Status
    await c.env.DB.prepare(`UPDATE mock_exams SET status = 'completed', completed_at = CURRENT_TIMESTAMP, elapsed_time_seconds = ? WHERE id = ? AND user_id = ?`)
        .bind(finalElapsed > 0 ? finalElapsed : null, examId, user.id).run()

    // 2. Save Answers to MOCK_EXAM_QUESTIONS (Isolated)
    const examQuestions = await c.env.DB.prepare(`
        SELECT q.id, q.question_type 
        FROM mock_exam_questions mq
        JOIN exam_questions q ON mq.question_id = q.id 
        WHERE mq.mock_exam_id = ?
    `).bind(examId).all()

    const stmt = c.env.DB.prepare(`
        UPDATE mock_exam_questions 
        SET response_content = ?, selected_option = ?
        WHERE mock_exam_id = ? AND question_id = ?
    `)

    for (const q of examQuestions.results) {
        const inputName = `response_${q.id}`
        const rawValue = body[inputName] as string

        let responseContent: string | null = null
        let selectedOption: string | null = null

        if (q.question_type === 'multiple_choice') {
            selectedOption = rawValue || null
        } else {
            responseContent = rawValue || ''
        }

        // Save isolated attempt
        await stmt.bind(responseContent, selectedOption, examId, q.id).run()
    }

    return c.redirect(`/past-papers/mock-exams/${examId}/mark`)
})

// 7. Progress Update (API)
app.post('/mock-exams/:id/progress', async (c) => {
    const user = await getUser(c)
    if (!user) return c.json({ error: 'Unauthorized' }, 401)
    const examId = c.req.param('id')
    const body = await c.req.json()

    await c.env.DB.prepare(`UPDATE mock_exams SET elapsed_time_seconds = ? WHERE id = ? AND user_id = ?`)
        .bind(body.elapsed, examId, user.id).run()

    return c.json({ success: true })
})

// 8. Marking Interface
app.get('/mock-exams/:id/mark', async (c) => {
    const user = await getUser(c)
    // if (!user) return c.redirect('/login') 
    const examId = c.req.param('id')

    // Allow viewing by anyone, but fetching user's attempts depends on the exam owner?
    // Actually, 'user_question_attempts' is per user. 
    // If I view someone else's mock exam, do I see MY progress or THEIRS?
    // Usually 'Marking' implies marking the exam attempt. 
    // 'mock_exams' belongs to a user. So we should show the attempts of THAT user (exam.user_id).

    const exam = await c.env.DB.prepare(`SELECT * FROM mock_exams WHERE id = ?`).bind(examId).first<any>()
    if (!exam) return c.notFound()

    const isOwner = user && user.id === exam.user_id;

    // Calculate Stats
    const stats = await c.env.DB.prepare(`
        SELECT sum(q.marks) as total_marks 
        FROM mock_exam_questions mq
        JOIN exam_questions q ON mq.question_id = q.id
        WHERE mq.mock_exam_id = ?
    `).bind(examId).first<any>();

    const totalMarks = stats?.total_marks || 0;

    // Fetch questions AND attempts from MOCK_EXAM_QUESTIONS (Isolated)
    const questions = await c.env.DB.prepare(`
                SELECT q.*, mq.ordering_index, p.school_name, p.academic_year, q.question_number,
                mq.marks_awarded as existing_marks, mq.response_content, mq.selected_option, mq.marker_notes
                FROM mock_exam_questions mq
                JOIN exam_questions q ON mq.question_id = q.id
                JOIN papers p ON q.paper_id = p.id
                WHERE mq.mock_exam_id = ?
                ORDER BY mq.ordering_index ASC
                `).bind(examId).all()

    return c.html(
        <Layout title={`Marking - ${exam.exam_name}`} user={user}>
            <div class="max-w-4xl mx-auto pb-24">
                <div class="mb-8 border-b pb-4">
                    <h1 class="text-3xl font-bold mb-2">Marking: {exam.exam_name}</h1>
                    <div class="flex gap-4 text-gray-500 text-sm">
                        <span>Total Marks: {totalMarks}</span>
                        <span>Time Used: {Math.floor((exam.elapsed_time_seconds || 0) / 60)}m {(exam.elapsed_time_seconds || 0) % 60}s</span>
                    </div>
                </div>

                <form action={`/past-papers/mock-exams/${examId}/submit-marks`} method="post" class="space-y-12">
                    {questions.results.map((q: any, i: number) => (
                        <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-200" key={q.id}>
                            <div class="flex justify-between items-start mb-6">
                                <h3 class="font-bold text-gray-900 text-lg">Question {i + 1}</h3>
                                <div class="text-xs text-gray-400">
                                    {q.school_name} {q.academic_year}
                                    <span class="ml-1 px-1 bg-gray-100 rounded text-gray-500">#{q.question_number}</span>
                                </div>
                            </div>

                            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Left: Question */}
                                <div>
                                    <h4 class="font-bold text-sm text-gray-500 uppercase mb-2">Question & Student Response</h4>
                                    {q.question_image_key ? (
                                        <img src={`/download/${q.question_image_key}`} class="max-w-full rounded border border-gray-100 mb-6" />
                                    ) : <p class="text-red-500 text-sm mb-6">Image missing</p>}

                                    <div class="bg-gray-50 p-4 rounded border border-gray-200">
                                        <h5 class="text-xs font-bold text-gray-400 uppercase mb-2">Student Response</h5>
                                        {q.question_type === 'multiple_choice' ? (
                                            <div class="flex items-center gap-4">
                                                {['A', 'B', 'C', 'D'].map(opt => (
                                                    <div class={`w-10 h-10 rounded-full flex items-center justify-center font-bold border 
                                                    ${q.selected_option === opt
                                                            ? (q.mc_answer === opt ? 'bg-green-100 border-green-500 text-green-700' : 'bg-red-100 border-red-500 text-red-700')
                                                            : (q.mc_answer === opt ? 'bg-green-50 border-green-200 text-green-700 dashed' : 'bg-white border-gray-200 text-gray-400')
                                                        }`}>
                                                        {opt}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div class="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap font-mono bg-white p-3 rounded border border-gray-200">
                                                {q.response_content || <span class="text-gray-400 italic">No response provided.</span>}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Right: Answer & Marking */}
                                <div>
                                    <h4 class="font-bold text-sm text-gray-500 uppercase mb-2">Answer / Guidelines</h4>
                                    {q.answer_image_key ? (
                                        <img src={`/download/${q.answer_image_key}`} class="max-w-full rounded border border-gray-100 mb-6" />
                                    ) : (
                                        <div class="bg-gray-50 p-4 rounded text-sm text-gray-500 mb-6 italic">No answer key available.</div>
                                    )}

                                    <div class="bg-blue-50 p-4 rounded border border-blue-100">
                                        <label class="block font-bold text-blue-900 mb-2">Marks Awarded (Max: {q.marks})</label>
                                        <input type="hidden" name={`marks_${q.id}`} id={`input-marks-${q.id}`} value={q.existing_marks !== null ? q.existing_marks : ''} />

                                        <div class="flex flex-wrap gap-2">
                                            {Array.from({ length: (q.marks || 0) + 1 }, (_, m) => (
                                                <button type="button"
                                                    onclick={`document.getElementById('input-marks-${q.id}').value = ${m}; this.parentElement.querySelectorAll('button').forEach(b => b.classList.remove('bg-blue-600', 'text-white')); this.classList.add('bg-blue-600', 'text-white');`}
                                                    class={`w-8 h-8 rounded border border-blue-300 font-bold flex items-center justify-center hover:bg-blue-100 transition-colors ${q.existing_marks === m ? 'bg-blue-600 text-white' : 'bg-white text-blue-700'}`}>
                                                    {m}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="mt-4">
                                <label class="block font-bold text-gray-700 text-sm mb-2">Marker Notes</label>
                                <textarea name={`notes_${q.id}`} class="w-full h-20 p-2 rounded border border-gray-300 text-sm focus:border-blue-500" placeholder="Feedback...">
                                    {q.marker_notes || ''}
                                </textarea>
                            </div>
                        </div>
                    ))}

                    <div class="fixed bottom-0 left-0 w-full bg-white border-t p-4 flex justify-between items-center shadow-lg">
                        <div class="text-gray-500 text-sm pl-4">Don't forget to save your marks!</div>
                        <button type="submit" class="bg-green-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-green-700 shadow-md mr-4">
                            Save & Complete Marking
                        </button>
                    </div>
                </form>
            </div>
        </Layout>
    );
})

// 9. Submit Marks
app.post('/mock-exams/:id/submit-marks', async (c) => {
    const user = await getUser(c)
    if (!user) return c.redirect('/login')
    const examId = c.req.param('id')
    const body = await c.req.parseBody()

    // Retrieve subject for redirect
    const exam = await c.env.DB.prepare('SELECT subject FROM mock_exams WHERE id = ?').bind(examId).first<any>()
    const subject = exam?.subject || ''

    // For each question in the exam, update MOCK_EXAM_QUESTIONS (Isolated)
    // AND sync to user_question_attempts (Global Practice History) for Review generation
    const examQuestions = await c.env.DB.prepare(`
        SELECT mq.question_id, q.marks as max_marks, mq.response_content, mq.selected_option
        FROM mock_exam_questions mq
        JOIN exam_questions q ON mq.question_id = q.id
        WHERE mq.mock_exam_id = ?
    `).bind(examId).all()

    const stmt = c.env.DB.prepare(`
                UPDATE mock_exam_questions
                SET marks_awarded = ?, marker_notes = ?
                WHERE mock_exam_id = ? AND question_id = ?
                `)

    // Batch execution would be better but simple loop for now
    for (const q of examQuestions.results) {
        const marksKey = `marks_${q.question_id}`
        const marksStr = body[marksKey]

        if (marksStr && marksStr !== '') {
            const marks = parseInt(marksStr as string)
            const notes = body[`notes_${q.question_id}`] as string || '' // Get notes

            await stmt.bind(marks, notes, examId, q.question_id).run()

            // SYNC TO GLOBAL HISTORY for Review System
            // If marks < max_marks, it will show up in Review tab (status: To Review)
            // If marks == max_marks, it counts as Completed.
            const isCompleted = marks === (q.max_marks || 0) ? 1 : 0;

            await c.env.DB.prepare(`
                INSERT INTO user_question_attempts (user_id, question_id, response_content, selected_option, marks_awarded, marker_notes, is_completed, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(user_id, question_id) DO UPDATE SET
                    response_content = excluded.response_content, -- Sync response if available from mock? Mock response might be in mq table.
                    selected_option = excluded.selected_option,
                    marks_awarded = excluded.marks_awarded,
                    marker_notes = excluded.marker_notes,
                    is_completed = excluded.is_completed,
                    updated_at = CURRENT_TIMESTAMP
            `).bind(
                user.id,
                q.question_id,
                q.response_content || '',
                q.selected_option || null,
                marks,
                notes,
                isCompleted
            ).run();
        }
    }

    return c.redirect(`/past-papers/mock-exams?subject=${encodeURIComponent(subject)}`)
})

export default app
