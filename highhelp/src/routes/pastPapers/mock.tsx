import { Hono } from 'hono'
import { Layout } from '../../layout'
import { getUser } from '../../utils'
import { Bindings } from '../../types'

const app = new Hono<{ Bindings: Bindings }>()


app.get('/mock-exams', async (c) => {
    const user = await getUser(c)
    if (!user) return c.redirect('/login')

    const subject = c.req.query('subject')


    const exams = await c.env.DB.prepare(`
        SELECT m.*, count(mq.question_id) as question_count 
        FROM mock_exams m
        LEFT JOIN mock_exam_questions mq ON m.id = mq.mock_exam_id
        WHERE m.user_id = ? AND m.subject = ?
        GROUP BY m.id
        ORDER BY m.created_at DESC
    `).bind(user.id, subject).all()

    return c.html(
        <Layout title={`Mock Exams - ${subject}`} user={user} latex={true}>
            <div class="mx-auto space-y-8">

                <div class="flex items-center gap-2 text-sm text-gray-500 dark:text-neutral-400 mb-4">
                    <a href="/past-papers" class="hover:underline">Past Papers</a>
                    <span>/</span>
                    <span class="font-bold text-gray-700 dark:text-neutral-300">{subject}</span>
                </div>

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

        let currentMarks = 0
        let selectedForSection: any[] = []


        const uncompleted = candidates.results.filter((q: any) => !q.is_completed)
        const completed = candidates.results.filter((q: any) => q.is_completed)


        for (const q of uncompleted) {
            if (currentMarks < desiredMarks) {

                selectedForSection.push(q)
                currentMarks += (q.marks || 0)
            }
        }


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
                SELECT q.*, mq.ordering_index, p.school_name, p.academic_year
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
                        <form action={`/past-papers/mock-exams/${examId}/finish`} method="post" onsubmit="return confirm('Are you sure you want to finish the exam?');">
                            <button class="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700">Finish Exam</button>
                        </form>
                    )}
                </div>
            </div>

            <div class="mt-20 max-w-4xl mx-auto space-y-12 pb-24">
                {questions.results.map((q: any, i: number) => (
                    <div class="bg-white dark:bg-neutral-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700" id={`q-${q.id}`}>
                        <div class="flex justify-between items-start mb-4">
                            <h3 class="font-bold text-gray-900 dark:text-white text-lg">Question {i + 1}</h3>
                            <div class="text-right">
                                <span class="text-sm font-bold text-gray-500 dark:text-neutral-400">{q.marks} Marks</span>
                                <div class="text-xs text-gray-400 dark:text-neutral-500">{q.school_name} {q.academic_year}</div>
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
                                ) : (
                                    <img src={`/download/${q.stimulus_image_key}`} class="max-w-full rounded" />
                                )}
                            </div>
                        )}

                        <div class="mt-6">
                            <textarea placeholder="Type your answer here (optional notes)..." class="w-full h-32 rounded border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white text-sm focus:border-blue-500"></textarea>
                        </div>
                    </div>
                ))}
            </div>


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
                SELECT q.*, mq.ordering_index, p.school_name, p.academic_year,
                ua.marks_awarded as existing_marks, ua.is_completed
                FROM mock_exam_questions mq
                JOIN exam_questions q ON mq.question_id = q.id
                JOIN papers p ON q.paper_id = p.id
                LEFT JOIN user_question_attempts ua ON q.id = ua.question_id AND ua.user_id = ?
                WHERE mq.mock_exam_id = ?
                ORDER BY mq.ordering_index ASC
                `).bind(exam.user_id, examId).all()

    return c.html(
        <Layout title={`Marking - ${exam.exam_name}`} user={user} latex={true}>
            <div class="max-w-4xl mx-auto pb-24">
                <div class="mb-8 border-b dark:border-neutral-700 pb-4">
                    <h1 class="text-3xl font-bold mb-2 dark:text-white">Marking: {exam.exam_name}</h1>
                    <div class="flex gap-4 text-gray-500 dark:text-neutral-400 text-sm">
                        <span>Total Marks: {totalMarks}</span>
                        <span>Time Used: {Math.floor((exam.elapsed_time_seconds || 0) / 60)}m {(exam.elapsed_time_seconds || 0) % 60}s</span>
                    </div>
                </div>

                <form action={`/past-papers/mock-exams/${examId}/submit-marks`} method="post" class="space-y-12">
                    {questions.results.map((q: any, i: number) => (
                        <div class="bg-white dark:bg-neutral-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-neutral-700">
                            <div class="flex justify-between items-start mb-6">
                                <h3 class="font-bold text-gray-900 dark:text-white text-lg">Question {i + 1}</h3>
                                <div class="text-xs text-gray-500 dark:text-neutral-400">{q.school_name} {q.academic_year}</div>
                            </div>

                            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Left: Question */}
                                <div>
                                    <h4 class="font-bold text-sm text-gray-500 dark:text-neutral-400 uppercase mb-2">Question</h4>
                                    {q.question_text ? (
                                        <div class="p-4 bg-gray-50 dark:bg-neutral-900/50 border border-gray-200 dark:border-neutral-700 rounded text-gray-800 dark:text-neutral-200 whitespace-pre-wrap text-sm mb-4">
                                            {q.question_text}
                                        </div>
                                    ) : (
                                        q.question_image_key ? (
                                            <img src={`/download/${q.question_image_key}`} class="max-w-full rounded border border-gray-100 dark:border-neutral-700" />
                                        ) : <p class="text-red-500 dark:text-red-400 text-sm">Image missing</p>
                                    )}
                                </div>

                                {/* Right: Answer & Marking */}
                                <div>
                                    <h4 class="font-bold text-sm text-gray-500 dark:text-neutral-400 uppercase mb-2">Answer / Guidelines</h4>
                                    {q.answer_text ? (
                                        <div class="p-4 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded text-green-900 dark:text-green-300 whitespace-pre-wrap text-sm mb-6">
                                            {q.answer_text}
                                        </div>
                                    ) : (
                                        q.answer_image_key ? (
                                            <img src={`/download/${q.answer_image_key}`} class="max-w-full rounded border border-gray-100 dark:border-neutral-700 mb-6" />
                                        ) : (
                                            <div class="bg-gray-50 dark:bg-neutral-900/50 p-4 rounded text-sm text-gray-500 dark:text-neutral-400 mb-6 italic">No answer key available.</div>
                                        )
                                    )}

                                    <div class="bg-blue-50 dark:bg-blue-900/10 p-4 rounded border border-blue-100 dark:border-blue-800">
                                        <label class="block font-bold text-blue-900 dark:text-blue-300 mb-2">Marks Awarded (Max: {q.marks})</label>
                                        <input type="hidden" name={`marks_${q.id}`} id={`input-marks-${q.id}`} value={q.existing_marks !== null ? q.existing_marks : ''} />

                                        <div class="flex flex-wrap gap-2">
                                            {Array.from({ length: (q.marks || 0) + 1 }, (_, m) => (
                                                <button type="button"
                                                    onclick={`document.getElementById('input-marks-${q.id}').value = ${m}; this.parentElement.querySelectorAll('button').forEach(b => b.classList.remove('bg-blue-600', 'text-white')); this.classList.add('bg-blue-600', 'text-white');`}
                                                    class={`w-8 h-8 rounded border border-blue-300 dark:border-blue-800 font-bold flex items-center justify-center hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors ${q.existing_marks === m ? 'bg-blue-600 text-white' : 'bg-white dark:bg-neutral-800 text-blue-700 dark:text-blue-400'}`}>
                                                    {m}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}

                    <div class="fixed bottom-0 left-0 w-full bg-white dark:bg-neutral-900 border-t dark:border-neutral-800 p-4 flex justify-between items-center shadow-lg transition-colors">
                        <div class="text-gray-500 dark:text-neutral-400 text-sm pl-4">Don't forget to save your marks!</div>
                        <button class="bg-green-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-green-700 shadow-md mr-4 transition-colors">
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


    const examQuestions = await c.env.DB.prepare(`SELECT question_id FROM mock_exam_questions WHERE mock_exam_id = ?`).bind(examId).all()

    const stmt = c.env.DB.prepare(`
                INSERT INTO user_question_attempts (user_id, question_id, marks_awarded, is_completed, updated_at)
                VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)
                ON CONFLICT(user_id, question_id) DO UPDATE SET
                marks_awarded = excluded.marks_awarded,
                is_completed = 1,
                updated_at = excluded.updated_at
                `)


    for (const q of examQuestions.results) {
        const marksKey = `marks_${q.question_id}`
        const marksStr = body[marksKey]

        if (marksStr && marksStr !== '') {
            const marks = parseInt(marksStr as string)
            await stmt.bind(user.id, q.question_id, marks).run()
        }
    }

    return c.redirect(`/past-papers/mock-exams`)
})

export default app