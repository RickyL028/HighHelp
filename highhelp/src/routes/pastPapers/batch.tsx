import { Hono } from 'hono'
import { Layout } from '../../layout'
import { getUser } from '../../utils'
import { Bindings } from '../../types'

const app = new Hono<{ Bindings: Bindings }>()

app.get('/past-papers/batch/view', async (c) => {
    const user = await getUser(c)
    if (!user) return c.redirect('/login')

    const source = c.req.query('source') || 'paper'
    const paperId = c.req.query('paper_id')
    const mode = c.req.query('mode')
    const subject = c.req.query('subject')

    const filterTopic = c.req.query('topic')
    const filterSchool = c.req.query('school')
    const filterYear = c.req.query('year')
    const filterStatus = c.req.query('status')
    const filterType = c.req.query('type')
    const filterSection = c.req.query('section')
    const filterMarksMin = c.req.query('marks_min')
    const filterMarksMax = c.req.query('marks_max')
    const sort = c.req.query('sort') || 'school_asc'

    let questions: any[] = []
    let headerTitle = 'Questions'
    let backUrl = '/past-papers'

    if (source === 'practice' && subject) {
        let query = `
            SELECT q.*, p.subject, p.school_name, p.academic_year, p.id as paper_id,
                   group_concat(t.name, ', ') as topic_names,
                   ua.response_content as ua_response,
                   ua.selected_option as ua_selected,
                   ua.marks_awarded as ua_marks,
                   ua.is_completed as ua_completed,
                   ua.marker_notes as ua_notes,
                   ua.updated_at as ua_updated
            FROM exam_questions q
            JOIN papers p ON q.paper_id = p.id
            LEFT JOIN question_topics qt ON q.id = qt.question_id
            LEFT JOIN topics t ON qt.topic_id = t.id
            LEFT JOIN user_question_attempts ua ON q.id = ua.question_id AND ua.user_id = ?
            WHERE p.subject = ? AND q.is_deleted = 0
        `
        const params: any[] = [user.id, subject]

        if (filterTopic) {
            query += ` AND EXISTS (SELECT 1 FROM question_topics qt2 WHERE qt2.question_id = q.id AND qt2.topic_id = ?)`
            params.push(filterTopic)
        }
        if (filterSchool) { query += ` AND p.school_name = ?`; params.push(filterSchool) }
        if (filterYear) { query += ` AND p.academic_year = ?`; params.push(filterYear) }
        if (filterType) { query += ` AND q.question_type = ?`; params.push(filterType) }
        if (filterSection) { query += ` AND q.section_label = ?`; params.push(filterSection) }
        if (filterMarksMin) { query += ` AND q.marks >= ?`; params.push(filterMarksMin) }
        if (filterMarksMax) { query += ` AND q.marks <= ?`; params.push(filterMarksMax) }
        if (filterStatus === 'done') { query += ` AND ua.is_completed = 1` }
        else if (filterStatus === 'undone') { query += ` AND (ua.is_completed IS NULL OR ua.is_completed = 0)` }

        query += ` GROUP BY q.id`

        if (sort === 'year_desc') query += ` ORDER BY p.academic_year DESC, q.ordering_index ASC`
        else if (sort === 'year_asc') query += ` ORDER BY p.academic_year ASC, q.ordering_index ASC`
        else query += ` ORDER BY p.school_name ASC, q.ordering_index ASC`

        const res = await c.env.DB.prepare(query).bind(...params).all()
        questions = res.results
        headerTitle = `${subject} Practice Questions`
        backUrl = `/past-papers?subject=${encodeURIComponent(subject)}&tab=practice`

    } else if (source === 'review' && subject) {
        const query = `
            SELECT q.*, p.subject, p.school_name, p.academic_year, p.id as paper_id,
                   group_concat(t.name, ', ') as topic_names,
                   ua.response_content as ua_response,
                   ua.selected_option as ua_selected,
                   ua.marks_awarded as ua_marks,
                   ua.is_completed as ua_completed,
                   ua.marker_notes as ua_notes,
                   ua.updated_at as ua_updated
            FROM exam_questions q
            JOIN papers p ON q.paper_id = p.id
            JOIN user_question_attempts ua ON q.id = ua.question_id AND ua.user_id = ?
            LEFT JOIN question_topics qt ON q.id = qt.question_id
            LEFT JOIN topics t ON qt.topic_id = t.id
            WHERE p.subject = ?
              AND q.is_deleted = 0
              AND (ua.marks_awarded < q.marks OR ua.marks_awarded IS NULL)
            GROUP BY q.id
            ORDER BY ua.created_at DESC
        `
        const res = await c.env.DB.prepare(query).bind(user.id, subject).all()
        questions = res.results
        headerTitle = `${subject} Review Queue`
        backUrl = `/past-papers?subject=${encodeURIComponent(subject)}&tab=review`

    } else if (paperId) {
        const query = `
            SELECT q.*, p.subject, p.school_name, p.academic_year, p.id as paper_id,
                   ua.response_content as ua_response,
                   ua.selected_option as ua_selected,
                   ua.marks_awarded as ua_marks,
                   ua.is_completed as ua_completed,
                   ua.marker_notes as ua_notes,
                   ua.updated_at as ua_updated
            FROM exam_questions q
            JOIN papers p ON q.paper_id = p.id
            LEFT JOIN user_question_attempts ua ON q.id = ua.question_id AND ua.user_id = ?
            WHERE q.paper_id = ? AND q.is_deleted = 0
            ORDER BY q.ordering_index ASC
        `
        const res = await c.env.DB.prepare(query).bind(user.id, paperId).all()
        questions = res.results

        if (questions.length > 0) {
            headerTitle = `${questions[0].school_name} ${questions[0].academic_year}`
        }
        backUrl = `/past-papers/paper/${paperId}`
    } else {
        return c.text('Missing required parameters', 400)
    }

    const completedCount = questions.filter((q: any) => q.ua_completed === 1).length
    const totalCount = questions.length
    const pct = totalCount > 0 ? Math.round(completedCount / totalCount * 100) : 0

    return c.html(
        <Layout title={`Batch Attempt - ${headerTitle}`} user={user} latex={true}>
            <div class="mx-auto max-w-4xl">

                <div class="mb-4 flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <a href={backUrl} class="text-sm font-semibold text-gray-500 hover:text-gray-900 dark:text-neutral-400 dark:hover:text-white">
                            ← Back
                        </a>
                        <span class="text-gray-300 dark:text-neutral-700">|</span>
                        <h1 class="text-lg font-bold text-gray-900 dark:text-neutral-100">
                            {headerTitle}
                        </h1>
                    </div>
                    <span class="text-xs text-gray-500 dark:text-neutral-400">{totalCount} questions</span>
                </div>

                <div class="mb-4 bg-white dark:bg-neutral-800 border dark:border-neutral-700 rounded p-3">
                    <div class="flex justify-between items-center mb-1.5">
                        <span class="text-sm font-medium text-gray-600 dark:text-neutral-400">
                            Progress: <span id="batch-completed">{completedCount}</span>/{totalCount} completed
                        </span>
                        <span id="batch-pct" class="text-sm font-bold text-blue-600 dark:text-blue-400">{pct}%</span>
                    </div>
                    <div class="w-full bg-gray-200 dark:bg-neutral-700 rounded-full h-2 overflow-hidden">
                        <div id="batch-progress-bar" class="bg-blue-600 h-2 rounded-full transition-all" style={`width: ${pct}%`}></div>
                    </div>
                </div>

                <div class="space-y-4 pb-8" id="questions-container">
                    {questions.map((q: any) => {
                        const hasAttempt = q.ua_updated != null
                        const attempt = hasAttempt ? {
                            response_content: q.ua_response,
                            selected_option: q.ua_selected,
                            marks_awarded: q.ua_marks,
                            is_completed: q.ua_completed,
                            marker_notes: q.ua_notes
                        } : null

                        const answerRevealed = !!attempt?.is_completed
                        const hasStimulus = !!(q.stimulus_text || q.stimulus_image_key)

                        return (
                            <div id={`q-${q.id}`} class="bg-white dark:bg-neutral-800 border dark:border-neutral-700 rounded overflow-hidden">
                                <div class="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-neutral-900 border-b dark:border-neutral-700">
                                    <div class="flex items-center gap-3">
                                        <span class="text-sm font-bold text-gray-900 dark:text-white">
                                            {q.school_name && source !== 'paper' ? `${q.school_name} ${q.academic_year} — ` : ''}{q.section_label} Q{q.question_number}
                                        </span>
                                        <span class="text-xs font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 px-1.5 py-0.5 rounded">
                                            {q.marks}m
                                        </span>
                                        {q.question_type === 'multiple_choice' && (
                                            <span class="text-xs font-bold bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400 px-1.5 py-0.5 rounded">MCQ</span>
                                        )}
                                    </div>
                                    <div>
                                        <span id={`q-status-${q.id}`} class={`text-xs font-bold px-2 py-0.5 rounded ${attempt?.is_completed ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20' : hasAttempt ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20' : ''}`}>
                                            {attempt?.is_completed ? '✓ Done' : hasAttempt ? 'Saved' : ''}
                                        </span>
                                    </div>
                                </div>

                                <div class="p-4 space-y-4">
                                    {hasStimulus && (
                                        <div class="bg-slate-50 dark:bg-slate-900/30 p-3 rounded border dark:border-neutral-700">
                                            {q.stimulus_text && (
                                                <div class="text-gray-800 dark:text-neutral-200 whitespace-pre-wrap font-serif italic text-[15px] leading-relaxed">
                                                    {q.stimulus_text}
                                                </div>
                                            )}
                                            {q.stimulus_image_key && (
                                                q.stimulus_image_key.startsWith('pdf_crop:') ? (
                                                    <pdf-crop pdf-url={`/download/papers/${q.paper_id}.pdf`} crop-data={q.stimulus_image_key.replace('pdf_crop:', '')}></pdf-crop>
                                                ) : (
                                                    <img src={`/download/${q.stimulus_image_key}`} class="w-full h-auto object-contain border dark:border-neutral-700 bg-white dark:bg-neutral-900 rounded" />
                                                )
                                            )}
                                        </div>
                                    )}

                                    {q.question_text ? (
                                        <div class="text-gray-900 dark:text-neutral-100 whitespace-pre-wrap font-serif text-lg leading-snug">
                                            {q.question_text}
                                        </div>
                                    ) : q.question_image_key ? (
                                        <img src={`/download/${q.question_image_key}`} class="w-full h-auto object-contain border dark:border-neutral-700 rounded" />
                                    ) : null}

                                    {q.question_type === 'multiple_choice' ? (
                                        <div class="flex gap-2" id={`mcq-${q.id}`}>
                                            {['A', 'B', 'C', 'D'].map(opt => (
                                                <label class="cursor-pointer flex-1">
                                                    <input type="radio" name={`sel-${q.id}`} value={opt} class="peer sr-only" checked={attempt?.selected_option === opt} />
                                                    <div class="text-center py-2 border dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 peer-checked:bg-blue-600 peer-checked:border-blue-600 peer-checked:text-white text-gray-700 dark:text-neutral-300 font-bold transition-none">
                                                        {opt}
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    ) : (
                                        <textarea id={`resp-${q.id}`}
                                            class="w-full min-h-[6rem] p-3 border dark:border-neutral-600 bg-white dark:bg-neutral-900 text-gray-900 dark:text-neutral-100 text-sm focus:ring-1 focus:ring-blue-500 outline-none resize-y rounded"
                                            placeholder="Type your answer here..."
                                        >{attempt?.response_content || ''}</textarea>
                                    )}

                                    <div id={`ans-${q.id}`} style={answerRevealed ? '' : 'display:none'}>
                                        <div class="bg-green-50 dark:bg-green-900/10 p-3 rounded border border-green-200 dark:border-green-800/50 space-y-3">
                                            {q.mc_answer && (
                                                <div class="text-xl font-black text-green-700 dark:text-green-400">{q.mc_answer}</div>
                                            )}
                                            {q.answer_text ? (
                                                <div class="text-green-900 dark:text-green-300 whitespace-pre-wrap text-[15px] font-medium leading-relaxed">
                                                    {q.answer_text}
                                                </div>
                                            ) : q.answer_image_key ? (
                                                <img src={`/download/${q.answer_image_key}`} class="w-full object-contain bg-white dark:bg-neutral-900 rounded border border-green-200 dark:border-green-800/50" />
                                            ) : (
                                                <span class="text-green-600/60 dark:text-green-500/50 italic text-sm">No marking guideline provided.</span>
                                            )}

                                            <div class="pt-2 border-t border-green-200/60 dark:border-green-800/50">
                                                <div class="flex items-center gap-2 mb-2">
                                                    <span class="text-sm font-bold text-gray-700 dark:text-neutral-300">Award Marks:</span>
                                                    <input type="hidden" id={`marks-${q.id}`} value={attempt?.marks_awarded ?? 0} />
                                                    <div class="flex gap-1">
                                                        {Array.from({ length: (Number(q.marks) || 0) + 1 }, (_, m) => (
                                                            <button type="button"
                                                                class={`mk-${q.id} min-w-[2rem] px-2 py-0.5 text-sm font-bold border rounded transition-none ${Number(attempt?.marks_awarded ?? 0) === m ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 dark:bg-neutral-800 border-gray-400 dark:border-neutral-500 text-black dark:text-white hover:bg-gray-200 dark:hover:bg-neutral-700'}`}
                                                                onclick={`document.getElementById('marks-${q.id}').value = ${m}; document.querySelectorAll('.mk-${q.id}').forEach(b => { b.className = 'mk-${q.id} min-w-[2rem] px-2 py-0.5 text-sm font-bold border rounded transition-none bg-gray-50 dark:bg-neutral-800 border-gray-400 dark:border-neutral-500 text-black dark:text-white hover:bg-gray-200 dark:hover:bg-neutral-700'; }); this.className = 'mk-${q.id} min-w-[2rem] px-2 py-0.5 text-sm font-bold border rounded transition-none bg-blue-600 text-white border-blue-600';`}
                                                            >{m}</button>
                                                        ))}
                                                    </div>
                                                </div>
                                                <textarea id={`notes-${q.id}`}
                                                    class="w-full h-10 p-2 border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-sm text-gray-900 dark:text-neutral-100 outline-none focus:ring-1 focus:ring-blue-500 resize-none rounded"
                                                    placeholder="Marker notes (optional)..."
                                                >{attempt?.marker_notes || ''}</textarea>
                                            </div>
                                        </div>
                                    </div>

                                    {!answerRevealed && (
                                        <button type="button" id={`reveal-${q.id}`}
                                            class="w-full py-2 border border-gray-300 dark:border-neutral-600 text-gray-600 dark:text-neutral-300 bg-white dark:bg-neutral-800 hover:bg-gray-50 dark:hover:bg-neutral-700 text-sm font-semibold rounded transition-none"
                                            onclick={`document.getElementById('ans-${q.id}').style.display = 'block'; this.style.display = 'none';`}
                                        >
                                            Check Answer
                                        </button>
                                    )}

                                    <div class="flex justify-end gap-2 pt-2 border-t dark:border-neutral-700">
                                        <button type="button" id={`save-btn-${q.id}`}
                                            onclick={`saveQuestion(${q.id}, '${q.question_type === 'multiple_choice' ? 'mcq' : 'text'}', '${mode || ''}')`}
                                            class="px-4 py-1.5 bg-blue-600 text-white text-sm font-bold rounded hover:bg-blue-700"
                                        >
                                            Save
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            <script dangerouslySetInnerHTML={{ __html: `
                let batchCompleted = ${completedCount};
                const batchTotal = ${totalCount};

                async function saveQuestion(qid, type, mode) {
                    const btn = document.getElementById('save-btn-' + qid);
                    const data = new FormData();
                    data.append('question_id', qid);
                    data.append('mode', mode);

                    if (type === 'mcq') {
                        const selected = document.querySelector('input[name="sel-' + qid + '"]:checked');
                        data.append('selected_option', selected ? selected.value : '');
                        data.append('response_content', '');
                    } else {
                        const resp = document.getElementById('resp-' + qid);
                        data.append('response_content', resp ? resp.value : '');
                    }

                    data.append('marks_awarded', document.getElementById('marks-' + qid)?.value || '0');
                    data.append('marker_notes', document.getElementById('notes-' + qid)?.value || '');

                    btn.disabled = true;
                    btn.textContent = 'Saving...';

                    try {
                        const r = await fetch('/past-papers/batch/save', { method: 'POST', body: data });
                        const d = await r.json();
                        if (d.success) {
                            btn.textContent = '✓ Saved';
                            btn.className = 'px-4 py-1.5 bg-green-600 text-white text-sm font-bold rounded';
                            setTimeout(() => {
                                btn.textContent = 'Save';
                                btn.className = 'px-4 py-1.5 bg-blue-600 text-white text-sm font-bold rounded hover:bg-blue-700';
                                btn.disabled = false;
                            }, 2000);

                            const status = document.getElementById('q-status-' + qid);
                            const wasDone = status.textContent === '✓ Done';
                            if (d.is_completed && !wasDone) batchCompleted++;
                            else if (!d.is_completed && wasDone) batchCompleted--;

                            if (d.is_completed) {
                                status.textContent = '✓ Done';
                                status.className = 'text-xs font-bold px-2 py-0.5 rounded text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20';
                            } else {
                                status.textContent = 'Saved';
                                status.className = 'text-xs font-bold px-2 py-0.5 rounded text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20';
                            }

                            document.getElementById('batch-completed').textContent = batchCompleted;
                            const pct = batchTotal > 0 ? batchCompleted / batchTotal * 100 : 0;
                            document.getElementById('batch-progress-bar').style.width = pct + '%';
                            document.getElementById('batch-pct').textContent = Math.round(pct) + '%';
                        }
                    } catch (e) {
                        btn.textContent = 'Error!';
                        btn.disabled = false;
                    }
                }
            `}} />
        </Layout>
    )
})

app.post('/past-papers/batch/save', async (c) => {
    const user = await getUser(c)
    if (!user) return c.json({ success: false, error: 'Unauthorized' }, 401)

    const body = await c.req.parseBody()
    const qId = parseInt(body['question_id'] as string)
    const marks = parseInt((body['marks_awarded'] as string) || '0')
    const response = (body['response_content'] as string) || ''
    const selected = (body['selected_option'] as string) || null
    const notes = (body['marker_notes'] as string) || ''
    const mode = body['mode'] as string

    const q = await c.env.DB.prepare('SELECT marks FROM exam_questions WHERE id = ?').bind(qId).first<any>()
    if (!q) return c.json({ success: false, error: 'Question not found' }, 404)

    const maxMarks = parseInt(q.marks) || 100
    const isComplete = marks >= maxMarks ? 1 : 0

    if (mode === 'review') {
        await c.env.DB.prepare(`
            INSERT INTO user_review_attempts (user_id, question_id, response_content, selected_option, marks_awarded, is_completed, created_at)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).bind(user.id, qId, response, selected, marks, isComplete).run()
    } else {
        await c.env.DB.prepare(`
            INSERT INTO user_question_attempts (user_id, question_id, response_content, selected_option, marks_awarded, marker_notes, is_completed, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id, question_id) DO UPDATE SET
                response_content = excluded.response_content,
                selected_option = excluded.selected_option,
                marks_awarded = excluded.marks_awarded,
                marker_notes = excluded.marker_notes,
                is_completed = ?,
                updated_at = CURRENT_TIMESTAMP
        `).bind(user.id, qId, response, selected, marks, notes, isComplete, isComplete).run()
    }

    return c.json({ success: true, id: qId, is_completed: isComplete })
})

export default app
