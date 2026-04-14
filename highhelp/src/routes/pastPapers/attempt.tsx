import { Hono } from 'hono'
import { Layout } from '../../layout'
import { getUser, formatDate } from '../../utils'
import { Bindings } from '../../types'

const app = new Hono<{ Bindings: Bindings }>()

app.get('/past-papers/attempt/:id', async (c) => {
    const user = await getUser(c)
    if (!user) return c.redirect('/login')

    const qId = c.req.param('id')

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

    let attempt = null;
    let originalAttempt = null;
    const mode = c.req.query('mode');

    if (user) {
        if (mode === 'review') {
            originalAttempt = await c.env.DB.prepare(`
                SELECT * FROM user_question_attempts 
                WHERE user_id = ? AND question_id = ?
            `).bind(user.id, qId).first<any>();

            attempt = await c.env.DB.prepare(`
                SELECT * FROM user_review_attempts 
                WHERE user_id = ? AND question_id = ?
                ORDER BY created_at DESC LIMIT 1
            `).bind(user.id, qId).first<any>();
        } else {
            attempt = await c.env.DB.prepare(`
                SELECT * FROM user_question_attempts 
                WHERE user_id = ? AND question_id = ?
            `).bind(user.id, qId).first<any>();
        }
    }

    const source = c.req.query('source');
    const filterTopic = c.req.query('topic');
    const filterYear = c.req.query('year');
    const filterStatus = c.req.query('status');
    const filterType = c.req.query('type');
    const filterSection = c.req.query('section');
    const filterMarksMin = c.req.query('marks_min');
    const filterMarksMax = c.req.query('marks_max');
    const sort = c.req.query('sort') || 'school_asc';

    let nextId = null;
    let prevId = null;

    const currentParams = `source=${source || ''}&mode=${mode || ''}&topic=${filterTopic || ''}&year=${filterYear || ''}&status=${filterStatus || ''}&sort=${sort}&type=${filterType || ''}&section=${filterSection || ''}&marks_min=${filterMarksMin || ''}&marks_max=${filterMarksMax || ''}`;

    if (source === 'practice') {
        let query = `
            SELECT q.id
            FROM exam_questions q
            JOIN papers p ON q.paper_id = p.id
            LEFT JOIN question_topics qt ON q.id = qt.question_id
            LEFT JOIN user_question_attempts ua ON q.id = ua.question_id AND ua.user_id = ?
            WHERE p.subject = ? AND q.is_deleted = 0
        `;

        const params: any[] = [user?.id || null, q.subject];

        if (filterTopic) { query += ` AND qt.topic_id = ?`; params.push(filterTopic); }
        if (filterYear) { query += ` AND p.academic_year = ?`; params.push(filterYear); }
        if (filterType) { query += ` AND q.question_type = ?`; params.push(filterType); }
        if (filterSection) { query += ` AND q.section_label = ?`; params.push(filterSection); }
        if (filterMarksMin) { query += ` AND q.marks >= ?`; params.push(filterMarksMin); }
        if (filterMarksMax) { query += ` AND q.marks <= ?`; params.push(filterMarksMax); }

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

    } else if (source === 'review') {
        const query = `
            SELECT q.id
            FROM exam_questions q
            JOIN papers p ON q.paper_id = p.id
            JOIN user_question_attempts ua ON q.id = ua.question_id AND ua.user_id = ?
            WHERE p.subject = ?
              AND q.is_deleted = 0
              AND (ua.marks_awarded < q.marks OR ua.marks_awarded IS NULL)
            GROUP BY q.id
            ORDER BY ua.created_at DESC
        `;
        const allIdsResult = await c.env.DB.prepare(query).bind(user?.id, q.subject).all<{ id: number }>();
        const allIds = allIdsResult.results.map(r => r.id);
        const currentIndex = allIds.indexOf(parseInt(qId));

        if (currentIndex !== -1) {
            if (currentIndex > 0) prevId = allIds[currentIndex - 1];
            if (currentIndex < allIds.length - 1) nextId = allIds[currentIndex + 1];
        }

    } else {
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

    const completedDate = attempt?.updated_at ? formatDate(attempt.updated_at) : '';
    const answerRevealed = !!attempt?.is_completed;
    const hasStimulus = !!(q.stimulus_text || q.stimulus_image_key);

    return c.html(
        <Layout title={`Question - ${q.subject}`} user={user} latex={true}>
            <div class="w-full h-[calc(100vh-3.5rem)] flex flex-col p-2 max-w-[120rem] mx-auto">

                {/* Header: Removed border-b */}
                <div class="flex items-center justify-between pb-2 mb-2 shrink-0">
                    <div class="flex items-center gap-3 overflow-hidden">
                        <a href={
                            source === 'practice' ? `/past-papers?subject=${encodeURIComponent(q.subject)}&tab=practice&${currentParams}` :
                                source === 'review' ? `/past-papers?subject=${encodeURIComponent(q.subject)}&tab=review` :
                                    `/past-papers/paper/${q.paper_id}`
                        } class="text-sm font-semibold text-gray-500 hover:text-gray-900 dark:text-neutral-400 dark:hover:text-white shrink-0">
                            ← Back
                        </a>
                        <span class="text-gray-300 dark:text-neutral-700">|</span>
                        <h1 class="text-sm font-bold text-gray-900 dark:text-neutral-100 truncate">
                            {q.school_name} {q.academic_year} — {q.section_label} Q{q.question_number}
                        </h1>
                        <span class="text-xs font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 px-1.5 py-0.5 rounded shrink-0">
                            {q.marks} Marks
                        </span>
                    </div>
                    <div class="flex gap-1 shrink-0 ml-2">
                        {prevId ? (
                            <a href={`/past-papers/attempt/${prevId}?${currentParams}`} class="px-2 py-1 bg-white dark:bg-neutral-800 border dark:border-neutral-700 rounded hover:bg-gray-50 dark:hover:bg-neutral-700 text-sm font-medium">Prev</a>
                        ) : (
                            <button disabled class="px-2 py-1 bg-gray-50 dark:bg-neutral-900 border dark:border-neutral-800 rounded text-gray-400 text-sm opacity-50 cursor-not-allowed">Prev</button>
                        )}
                        {nextId ? (
                            <a href={`/past-papers/attempt/${nextId}?${currentParams}`} class="px-2 py-1 bg-white dark:bg-neutral-800 border dark:border-neutral-700 rounded hover:bg-gray-50 dark:hover:bg-neutral-700 text-sm font-medium">Next</a>
                        ) : (
                            <button disabled class="px-2 py-1 bg-gray-50 dark:bg-neutral-900 border dark:border-neutral-800 rounded text-gray-400 text-sm opacity-50 cursor-not-allowed">Next</button>
                        )}
                    </div>
                </div>

                {/* Main Form: Removed border, dark:border-neutral-700, rounded, shadow-sm */}
                <form action={`/past-papers/attempt/${qId}/save?${currentParams}`} method="post" class="flex-1 min-h-0 flex flex-col lg:flex-row bg-white dark:bg-neutral-900 overflow-hidden">
                    <input type="hidden" name="next_id" value={nextId || ''} />
                    <input type="hidden" name="max_marks" value={q.marks} />

                    {/* Left Pane: Removed border-b and lg:border-r */}
                    {hasStimulus && (
                        <div class="w-full lg:w-1/2 flex flex-col bg-slate-50/50 dark:bg-slate-900/30 overflow-y-auto">
                            <div class="p-4">
                                {q.stimulus_text && (
                                    <div class="text-gray-800 dark:text-neutral-200 whitespace-pre-wrap font-serif italic mb-4 text-[15px] leading-relaxed">
                                        {q.stimulus_text}
                                    </div>
                                )}
                                {q.stimulus_image_key && (
                                    q.stimulus_image_key.startsWith('pdf_crop:') ? (
                                        <pdf-crop pdf-url={`/download/papers/${q.paper_id}.pdf`} crop-data={q.stimulus_image_key.replace('pdf_crop:', '')}></pdf-crop>
                                    ) : (
                                        <img src={`/download/${q.stimulus_image_key}`} class="w-full h-auto object-contain border dark:border-neutral-700 bg-white dark:bg-neutral-900 rounded-sm" />
                                    )
                                )}
                            </div>
                        </div>
                    )}

                    {/* Right Pane */}
                    <div class={`w-full ${hasStimulus ? 'lg:w-1/2' : ''} flex flex-col min-h-0 overflow-y-auto`}>

                        {/* Review Mode Banner: Removed border-b */}
                        {mode === 'review' && originalAttempt && (
                            <div class="flex items-center gap-3 bg-amber-50 dark:bg-amber-900/20 px-4 py-2 text-xs shrink-0">
                                <span class="font-bold text-amber-800 dark:text-amber-500 uppercase tracking-wide">Prior Review</span>
                                <span class="bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-300 px-1.5 py-0.5 rounded font-bold">
                                    {originalAttempt.marks_awarded || 0} / {q.marks}
                                </span>
                            </div>
                        )}

                        {/* Question Content: Removed border-b */}
                        <div class="p-4 bg-white dark:bg-neutral-900 shrink-0">
                            {q.question_text ? (
                                <div class="text-gray-900 dark:text-neutral-100 whitespace-pre-wrap font-serif text-lg leading-snug">
                                    {q.question_text}
                                </div>
                            ) : q.question_image_key ? (
                                <img src={`/download/${q.question_image_key}`} class="w-full h-auto object-contain" />
                            ) : null}
                        </div>

                        {/* Response Input: Removed border-b */}
                        <div class="p-4 bg-gray-50/50 dark:bg-neutral-800/30 shrink-0">
                            {q.question_type === 'multiple_choice' ? (
                                <div class="flex gap-2">
                                    {['A', 'B', 'C', 'D'].map(opt => (
                                        <label class="cursor-pointer flex-1">
                                            <input type="radio" name="selected_option" value={opt} class="peer sr-only" checked={attempt?.selected_option === opt} />
                                            <div class="text-center py-2 border dark:border-neutral-600 rounded-sm bg-white dark:bg-neutral-800 peer-checked:bg-blue-600 peer-checked:border-blue-600 peer-checked:text-white text-gray-700 dark:text-neutral-300 font-bold transition-none">
                                                {opt}
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            ) : (
                                <textarea
                                    name="response_content"
                                    class="w-full min-h-[12rem] p-3 border dark:border-neutral-600 bg-white dark:bg-neutral-900 text-gray-900 dark:text-neutral-100 text-sm focus:ring-1 focus:ring-blue-500 outline-none resize-y rounded-sm"
                                    placeholder="Type your answer here..."
                                >{attempt?.response_content || ''}</textarea>
                            )}

                            {!answerRevealed && (
                                <button
                                    id="reveal-btn-wrap"
                                    type="button"
                                    onclick="
                                    document.getElementById('reveal-btn-wrap').style.display = 'none';
                                    document.getElementById('answer-section').style.display = 'block';
                                "
                                    class="mt-3 w-full py-2 border border-gray-300 dark:border-neutral-600 text-gray-600 dark:text-neutral-300 bg-white dark:bg-neutral-800 hover:bg-gray-50 dark:hover:bg-neutral-700 text-sm font-semibold rounded-sm transition-none"
                                >
                                    Check Answer
                                </button>
                            )}
                        </div>

                        {/* Answer Section */}
                        <div id="answer-section" style={answerRevealed ? '' : 'display:none'} class="p-4 bg-green-50/30 dark:bg-green-900/10 flex-1 flex flex-col gap-4">
                            <div>
                                {q.mc_answer && (
                                    <div class="text-xl font-black text-green-700 dark:text-green-400 mb-2">{q.mc_answer}</div>
                                )}
                                {q.answer_text ? (
                                    <div class="text-green-900 dark:text-green-300 whitespace-pre-wrap text-[15px] font-medium leading-relaxed">
                                        {q.answer_text}
                                    </div>
                                ) : q.answer_image_key ? (
                                    <img src={`/download/${q.answer_image_key}`} class="w-full object-contain bg-white dark:bg-neutral-900 rounded-sm border border-green-200 dark:border-green-800/50" />
                                ) : (
                                    <span class="text-green-600/60 dark:text-green-500/50 italic text-sm">No marking guideline provided.</span>
                                )}
                            </div>


                            {/* Self-Marking Control Group */}
                            <div class="mt-auto pt-4 border-t border-green-200/60 dark:border-green-800/50">
                                <div class="flex items-center flex-wrap gap-2 mb-3">
                                    <span class="text-sm font-bold text-gray-700 dark:text-neutral-300 mr-2">Award Marks:</span>
                                    <input type="hidden" name="marks_awarded" id="marks_awarded_input" value={attempt?.marks_awarded ?? 0} />

                                    <div class="flex flex-wrap gap-1">
                                        {Array.from({ length: (Number(q.marks) || 0) + 1 }, (_, m) => {
                                            const isActive = Number(attempt?.marks_awarded ?? 0) === m;
                                            return (
                                                <button
                                                    type="button"
                                                    data-mark={m}
                                                    data-active={isActive ? "true" : "false"}
                                                    onclick={`
                document.getElementById('marks_awarded_input').value = ${m};
                document.querySelectorAll('.mark-btn').forEach(b => b.setAttribute('data-active', 'false'));
                this.setAttribute('data-active', 'true');
            `}
                                                    class="mark-btn min-w-[2.25rem] px-2 py-1 text-sm font-bold border rounded-sm transition-none
                data-[active=true]:bg-blue-600 data-[active=true]:text-white data-[active=true]:border-blue-600
                data-[active=false]:bg-gray-50 data-[active=false]:dark:bg-neutral-800
                data-[active=false]:border-gray-400 data-[active=false]:dark:border-neutral-500
                data-[active=false]:text-black data-[active=false]:dark:text-white
                data-[active=false]:hover:bg-gray-200 data-[active=false]:dark:hover:bg-neutral-700"
                                                >
                                                    {m}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <button
                                        type="button"
                                        onclick={`const val = ${q.marks}; document.getElementById('marks_awarded_input').value = val; document.querySelectorAll('.mark-btn').forEach(b => b.classList.remove('bg-blue-600', 'text-white', 'border-blue-600')); const maxBtn = Array.from(document.querySelectorAll('.mark-btn')).find(b => b.getAttribute('data-mark') == val); if(maxBtn) maxBtn.classList.add('bg-blue-600', 'text-white', 'border-blue-600');`}
                                        class="ml-auto px-2.5 py-1 text-xs font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-sm hover:bg-blue-200 dark:hover:bg-blue-900/60"
                                    >
                                        MAX ({q.marks})
                                    </button>
                                </div>

                                <textarea
                                    name="marker_notes"
                                    class="w-full h-12 p-2 border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-sm text-gray-900 dark:text-neutral-100 outline-none focus:ring-1 focus:ring-blue-500 resize-none rounded-sm"
                                    placeholder="Marker notes (optional)..."
                                >{attempt?.marker_notes || ''}</textarea>
                            </div>
                        </div>

                        {/* Sticky Action Footer - Fixed spacing and visibility */}
                        <div class="p-3 bg-gray-100 dark:bg-neutral-900/80 border-t dark:border-neutral-700 flex justify-end items-center gap-4 shrink-0">
                            <div class="text-xs text-gray-500 dark:text-neutral-400 font-medium">
                                {attempt?.is_completed ? (
                                    <span class="flex items-center gap-2">
                                        ✓ Done {completedDate}
                                        <button type="submit" name="action" value="undone" class="text-red-600 dark:text-red-400 hover:underline ml-1">Revert</button>
                                    </span>
                                ) : 'Pending'}
                            </div>
                            <div class="flex gap-2">
                                <button type="submit" name="action" value="save" class="px-4 py-1.5 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-600 text-gray-700 dark:text-neutral-200 text-sm font-bold rounded-sm hover:bg-gray-50 dark:hover:bg-neutral-700">
                                    Save
                                </button>
                                <button type="submit" name="action" value="complete" class="px-4 py-1.5 bg-blue-600 text-white text-sm font-bold rounded-sm hover:bg-blue-700">
                                    Save & Next
                                </button>
                            </div>
                        </div>
                    </div>
                </form>
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
    const action = body['action'];
    const nextId = body['next_id'];

    let completedValue = 1;
    if (action === 'undone') completedValue = 0;

    const mode = c.req.query('mode');

    if (mode === 'review') {
        await c.env.DB.prepare(`
            INSERT INTO user_review_attempts (user_id, question_id, response_content, selected_option, marks_awarded, is_completed, created_at)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).bind(user.id, qId, response, selected, marks, (marks === parseInt(body['max_marks'] as string || '100') || action === 'complete') ? 1 : 0).run();
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
        `).bind(user.id, qId, response, selected, marks, notes, completedValue, completedValue).run();
    }

    const source = c.req.query('source');
    const filterTopic = c.req.query('topic');
    const filterYear = c.req.query('year');
    const filterStatus = c.req.query('status');
    const filterType = c.req.query('type');
    const filterSection = c.req.query('section');
    const filterMarksMin = c.req.query('marks_min');
    const filterMarksMax = c.req.query('marks_max');
    const sort = c.req.query('sort') || 'school_asc';

    const params = `source=${source || ''}&mode=${mode || ''}&topic=${filterTopic || ''}&year=${filterYear || ''}&status=${filterStatus || ''}&sort=${sort}&type=${filterType || ''}&section=${filterSection || ''}&marks_min=${filterMarksMin || ''}&marks_max=${filterMarksMax || ''}`;

    if (action === 'complete' && nextId) {
        return c.redirect(`/past-papers/attempt/${nextId}?${params}`);
    }

    return c.redirect(`/past-papers/attempt/${qId}?${params}`);
});

export default app