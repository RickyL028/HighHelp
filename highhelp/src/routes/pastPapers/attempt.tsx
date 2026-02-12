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

    // Fetch existing attempt ONLY if logged in
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
    const filterStatus = c.req.query('status'); // done, undone
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

    return c.html(
        <Layout title={`Question - ${q.subject}`} user={user}>
            <div class="max-w-6xl mx-auto h-[calc(100vh-140px)] flex flex-col">
                {/* Header */}
                <div class="flex items-center justify-between mb-4 shrink-0">
                    <div>
                        <a href={
                            source === 'practice' ? `/past-papers?subject=${encodeURIComponent(q.subject)}&tab=practice&${currentParams}` :
                                source === 'review' ? `/past-papers?subject=${encodeURIComponent(q.subject)}&tab=review` :
                                    `/past-papers/paper/${q.paper_id}`
                        } class="text-sm text-gray-500 hover:underline">
                            ← Back to {source === 'practice' ? 'Practice' : source === 'review' ? 'Review Queue' : 'Paper'}
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
                        {q.question_text ? (
                            <div class="mb-6 bg-white rounded text-gray-800 whitespace-pre-wrap font-serif text-lg leading-relaxed">
                                {q.question_text}
                            </div>
                        ) : (
                            q.question_image_key ? (
                                <img src={`/download/${q.question_image_key}`} class="w-full h-auto object-contain" />
                            ) : (
                                <div class="text-gray-400 italic text-center py-12">No question image available</div>
                            )
                        )}

                        {(q.stimulus_text || q.stimulus_image_key) && (
                            <div class="mt-6 border-t pt-6">
                                <h4 class="font-bold text-gray-500 mb-2 text-xs uppercase">Stimulus</h4>
                                {q.stimulus_text ? (
                                    <div class="text-gray-700 italic border-l-4 border-l-blue-400 pl-4 py-2 whitespace-pre-wrap">
                                        {q.stimulus_text}
                                    </div>
                                ) : (
                                    <img src={`/download/${q.stimulus_image_key}`} class="w-full h-auto object-contain" />
                                )}
                            </div>
                        )}
                    </div>

                    {/* Right: Interaction */}
                    <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-y-auto p-6 flex flex-col">
                        <form action={`/past-papers/attempt/${qId}/save?${currentParams}`} method="post" class="flex-1 flex flex-col">


                            {mode === 'review' && originalAttempt && (
                                <div class="mb-6 bg-amber-50 rounded-lg p-4 border border-amber-200">
                                    <h3 class="font-bold text-amber-800 text-sm mb-2 uppercase tracking-wide flex items-center gap-2">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                        Previous Attempt Context
                                    </h3>
                                    <div class="space-y-3">
                                        <div>
                                            <div class="text-xs text-amber-600 font-bold mb-1">Previous Score</div>
                                            <span class="bg-white px-2 py-1 rounded border border-amber-200 text-amber-800 font-bold text-sm">
                                                {originalAttempt.marks_awarded || 0} / {q.marks} Marks
                                            </span>
                                        </div>
                                        {originalAttempt.marker_notes && (
                                            <div>
                                                <div class="text-xs text-amber-600 font-bold mb-1">Your previous notes</div>
                                                <div class="bg-white p-2 rounded border border-amber-200 text-sm text-gray-600 italic">
                                                    "{originalAttempt.marker_notes}"
                                                </div>
                                            </div>
                                        )}

                                    </div>
                                </div>
                            )}

                            <input type="hidden" name="next_id" value={nextId || ''} />


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

                                {/* Marking Section */}
                                <div id="marking-section" class="mt-8 border-t border-gray-100 pt-6">
                                    <details open={!!attempt?.is_completed}>
                                        <summary class="font-bold text-blue-600 cursor-pointer mb-4 select-none group">
                                            <span class="group-open:hidden">Check Answer & Mark</span>
                                            <span class="hidden group-open:inline">Hide Answer</span>
                                        </summary>

                                        <div class="space-y-6 animate-fade-in">
                                            {/* Correct Answer */}
                                            <div class="bg-green-50 rounded-lg p-4 border border-green-100">
                                                <h4 class="font-bold text-green-800 text-sm mb-2">Correct Answer / Guidelines</h4>
                                                {q.mc_answer && <div class="text-xl font-bold text-green-700 mb-2">{q.mc_answer}</div>}
                                                {q.answer_text ? (
                                                    <div class="p-4 bg-white border border-green-200 rounded text-green-900 whitespace-pre-wrap text-sm">
                                                        {q.answer_text}
                                                    </div>
                                                ) : (
                                                    q.answer_image_key ? (
                                                        <img src={`/download/${q.answer_image_key}`} class="w-full object-contain bg-white rounded border border-green-200" />
                                                    ) : <span class="text-gray-500 italic text-sm">No answer image provided.</span>
                                                )}
                                            </div>

                                            {/* Self Marking UI */}
                                            <div class="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                                <div class="flex items-center justify-between mb-4">
                                                    <label class="font-bold text-gray-700 text-sm">Marks Awarded</label>
                                                    <div class="flex items-center gap-2">
                                                        <button type="button" onclick={`document.getElementById('marks_awarded_input').value = ${q.marks}; const btns = this.closest('.bg-gray-50').querySelectorAll('.w-8.h-8'); btns.forEach(b => b.classList.remove('bg-blue-600', 'text-white')); const maxBtn = Array.from(btns).find(b => b.textContent.trim() == '${q.marks}'); if(maxBtn) maxBtn.classList.add('bg-blue-600', 'text-white');`} class="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded font-bold hover:bg-blue-200">Give Max ({q.marks})</button>
                                                    </div>
                                                </div>
                                                <div class="flex items-center gap-2">
                                                    <input type="hidden" name="marks_awarded" id="marks_awarded_input" value={attempt?.marks_awarded || 0} />
                                                    <input type="hidden" name="max_marks" value={q.marks} />
                                                    <div class="flex flex-wrap gap-2">
                                                        {Array.from({ length: (q.marks || 0) + 1 }, (_, m) => (
                                                            <button type="button"
                                                                onclick={`document.getElementById('marks_awarded_input').value = ${m}; this.parentElement.querySelectorAll('button').forEach(b => b.classList.remove('bg-blue-600', 'text-white')); this.classList.add('bg-blue-600', 'text-white');`}
                                                                class={`w-8 h-8 rounded border border-blue-300 font-bold flex items-center justify-center hover:bg-blue-100 transition-colors ${(attempt?.marks_awarded || 0) == m ? 'bg-blue-600 text-white' : 'bg-white text-blue-700'}`}>
                                                                {m}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                <label class="block font-bold text-gray-700 text-sm mt-4 mb-2">My Marker Notes</label>
                                                <textarea name="marker_notes" class="w-full h-24 p-2 rounded border border-gray-300 text-sm" placeholder="Notes for future review...">{attempt?.marker_notes || ''}</textarea>
                                            </div>
                                        </div>
                                    </details>
                                </div>
                            </div>

                            {/* Actions */}
                            {user ? (
                                <div class="mt-6 flex justify-between items-center pt-4 border-t sticky bottom-0 bg-white">
                                    <span class="text-xs text-gray-400">
                                        {attempt?.is_completed ? (
                                            <div class="flex items-center gap-2">
                                                <span>Completed on {completedDate}</span>
                                                <button type="submit" name="action" value="undone" class="text-red-500 hover:underline">Mark Undone</button>
                                            </div>
                                        ) : 'Not completed yet'}
                                    </span>
                                    <div class="flex gap-2">
                                        <button type="submit" name="action" value="save" class="bg-gray-100 text-gray-700 font-bold py-2 px-6 rounded-lg hover:bg-gray-200 transition">
                                            Save
                                        </button>
                                        <button type="submit" name="action" value="complete" class="bg-blue-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-700 shadow-sm transition">
                                            Save & Mark Complete
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div class="mt-6 pt-4 border-t text-center text-sm text-gray-500">
                                    <a href="/login" class="text-blue-600 hover:underline font-bold">Log in</a> to save your progress.
                                </div>
                            )}
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

    // Preserve Navigation Context
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