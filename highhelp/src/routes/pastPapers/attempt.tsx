import { Hono } from 'hono'
import { Layout } from '../../layout'
import { getUser, loginRedirect, formatDate } from '../../utils'
import { subjectLabel } from '../../constants'
import { Bindings } from '../../types'
import {
    buildNavigationPlan,
    buildNeighborQueries,
    buildNeighborWindowQuery,
    readRawPracticeFilters,
    resolvePracticeFilters,
    type NeighborWindowRow
} from './practiceQuery'

const app = new Hono<{ Bindings: Bindings }>()

// How many questions the picker offers around the current one, counted in navigation order.
const PICKER_BEFORE = 9;
const PICKER_AFTER = 10;

// Source line shown when hovering a picker chip, e.g. "SBHS 2024 · Section A Q3 · 4 marks".
const questionSourceLabel = (row: NeighborWindowRow) => {
    const paper = [row.school_name, row.academic_year].filter(Boolean).join(' ');
    const location = [row.section_label, row.question_number ? `Q${row.question_number}` : ''].filter(Boolean).join(' ');
    const marks = Number(row.marks) > 0 ? `${row.marks} mark${Number(row.marks) === 1 ? '' : 's'}` : '';
    return [paper, location, marks].filter(Boolean).join(' · ') || 'Question';
};

// Split MCQ question_text into stem + option texts (options are stored inline, e.g. "(A) Use cost centres")
const parseMcqOptions = (text: string | null): { stem: string; options: Record<string, string> | null } => {
    if (!text) return { stem: '', options: null };
    const opts: Record<string, string> = {};
    const stemLines: string[] = [];
    let seenOption = false;
    for (const line of text.split('\n')) {
        const m = line.match(/^\s*\(?\s*([A-Fa-f])[\).:\]]\s*(.+)$/);
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

app.get('/past-papers/attempt/:id', async (c) => {
    const user = await getUser(c)
    if (!user) return c.redirect(loginRedirect(c))

    const qId = c.req.param('id')
    const mode = c.req.query('mode');

    // OPTIMIZATION 1: Fetch question and user attempts in a single DB round-trip
    const qRow = await c.env.DB.prepare(`
        SELECT q.*, p.subject, p.school_name, p.academic_year, 
               group_concat(t.name, ', ') as topic_names,
               ua.response_content as ua_response,
               ua.selected_option as ua_selected,
               ua.marks_awarded as ua_marks,
               ua.is_completed as ua_completed,
               ua.marker_notes as ua_notes,
               ua.updated_at as ua_updated,
               ua.created_at as ua_created,
               ura.response_content as ura_response,
               ura.selected_option as ura_selected,
               ura.marks_awarded as ura_marks,
               ura.is_completed as ura_completed,
               ura.created_at as ura_updated
        FROM exam_questions q
        JOIN papers p ON q.paper_id = p.id
        LEFT JOIN question_topics qt ON q.id = qt.question_id
        LEFT JOIN topics t ON qt.topic_id = t.id
        LEFT JOIN user_question_attempts ua ON q.id = ua.question_id AND ua.user_id = ?
        LEFT JOIN (
            SELECT * FROM user_review_attempts
            WHERE user_id = ? AND question_id = ?
            ORDER BY created_at DESC LIMIT 1
        ) ura ON q.id = ura.question_id
        WHERE q.id = ?
        GROUP BY q.id
    `).bind(user.id, user.id, qId, qId).first<any>();

    if (!qRow) return c.notFound();


    const q = { ...qRow };
    let attempt = null;
    let originalAttempt = null;
    let stimCoords = null;


    if (q.stimulus_image_key && q.stimulus_image_key.startsWith('pdf_crop:')) {
        try {
            const cropDataJson = q.stimulus_image_key.replace('pdf_crop:', '');
            stimCoords = JSON.parse(cropDataJson);
        } catch (e) {
            console.error("Failed to parse stimulus crop metadata", e);
        }
    }


    const pdfUrl = `/download/papers/${q.paper_id}.pdf${stimCoords?.page ? `#page=${stimCoords.page}` : ''}`;

    if (mode === 'review') {
        originalAttempt = { marks_awarded: qRow.ua_marks };
        if (qRow.ura_updated) {
            attempt = {
                response_content: qRow.ura_response,
                selected_option: qRow.ura_selected,
                marks_awarded: qRow.ura_marks,
                is_completed: qRow.ura_completed,
                updated_at: qRow.ura_updated, // Map to updated_at for UI standardization
                marker_notes: ''
            };
        }
    } else {
        if (qRow.ua_updated) {
            attempt = {
                response_content: qRow.ua_response,
                selected_option: qRow.ua_selected,
                marks_awarded: qRow.ua_marks,
                is_completed: qRow.ua_completed,
                updated_at: qRow.ua_updated,
                marker_notes: qRow.ua_notes
            };
        }
    }

    const source = c.req.query('source');
    const rawFilters = readRawPracticeFilters(key => c.req.query(key));

    const currentParams = new URLSearchParams({
        source: source || '',
        mode: mode || '',
        school: rawFilters.school,
        topic: rawFilters.topic,
        topic_group: rawFilters.topicGroup,
        year: rawFilters.year,
        status: rawFilters.status,
        sort: rawFilters.sort,
        type: rawFilters.type,
        section: rawFilters.section,
        marks_min: rawFilters.marksMin,
        marks_max: rawFilters.marksMax
    }).toString();

    let nextId: number | null = null;
    let prevId: number | null = null;
    let position = 0;
    let total = 0;

    const currentId = parseInt(qId);
    const plan = source === 'practice'
        ? buildNavigationPlan({
            source: 'practice',
            userId: user.id,
            subject: q.subject,
            filters: await resolvePracticeFilters(c.env.DB, q.subject, rawFilters),
            row: qRow
        })
        : source === 'review'
            ? buildNavigationPlan({ source: 'review', userId: user.id, subject: q.subject, questionId: currentId, attemptCreatedAt: qRow.ua_created })
            : buildNavigationPlan({ source: 'paper', userId: user.id, paperId: q.paper_id, row: qRow });

    const neighbor = buildNeighborQueries(plan.base, plan.order, plan.keys, currentId);
    const windowOptions = { reviewAttempts: source === 'review' };
    const beforeWindow = buildNeighborWindowQuery(plan.base, plan.order, plan.keys, 'before', PICKER_BEFORE, windowOptions);
    const afterWindow = buildNeighborWindowQuery(plan.base, plan.order, plan.keys, 'after', PICKER_AFTER, windowOptions);
    const [positionResult, previousResult, nextResult, beforeResult, afterResult] = await c.env.DB.batch([
        c.env.DB.prepare(neighbor.position.sql).bind(...neighbor.position.params),
        c.env.DB.prepare(neighbor.previous.sql).bind(...neighbor.previous.params),
        c.env.DB.prepare(neighbor.next.sql).bind(...neighbor.next.params),
        c.env.DB.prepare(beforeWindow.sql).bind(...beforeWindow.params),
        c.env.DB.prepare(afterWindow.sql).bind(...afterWindow.params)
    ]);

    const stats = positionResult.results[0] as { total: number; before_count: number; found: number } | undefined;
    if (stats && stats.found) {
        total = Number(stats.total) || 0;
        position = Number(stats.before_count) + 1;
    }
    prevId = (previousResult.results[0] as { id: number } | undefined)?.id ?? null;
    nextId = (nextResult.results[0] as { id: number } | undefined)?.id ?? null;

    const completedDate = attempt?.updated_at ? formatDate(attempt.updated_at) : '';
    const answerRevealed = !!attempt?.is_completed;
    const hasStimulus = !!(q.stimulus_text || q.stimulus_image_key);

    // Picker window: the questions either side of this one, already in navigation order, so
    // the bar can label and prefetch them without another round-trip per question.
    const beforeRows = ((beforeResult.results as NeighborWindowRow[]) || []).slice().reverse();
    const afterRows = (afterResult.results as NeighborWindowRow[]) || [];
    const pickerRows: (NeighborWindowRow & { position: number })[] = position > 0
        ? [
            ...beforeRows.map((row, index) => ({ ...row, position: position - beforeRows.length + index })),
            {
                id: currentId,
                school_name: qRow.school_name,
                academic_year: qRow.academic_year,
                section_label: qRow.section_label,
                question_number: qRow.question_number,
                marks: qRow.marks,
                is_completed: answerRevealed ? 1 : 0,
                position
            },
            ...afterRows.map((row, index) => ({ ...row, position: position + 1 + index }))
        ]
        : [];

    // Everything the client needs to mark an answer or restore state after a swap.
    const attemptConfig = {
        id: currentId,
        params: currentParams,
        isMcq: q.question_type === 'multiple_choice',
        correctAnswer: q.mc_answer || '',
        maxMarks: Number(q.marks) || 0,
        prefetch: pickerRows.map(row => row.id).filter(id => id !== currentId)
    };

    const parsed = q.question_type === 'multiple_choice' ? parseMcqOptions(q.question_text) : { stem: q.question_text, options: null };
    const mcqOptions = parsed.options;

    const content = (
        <>
            {/* Question Picker */}
            {pickerRows.length > 1 && (
                <div class="flex items-center gap-2 mb-2 shrink-0">
                    
                    <div id="attempt-picker" class="flex-1 min-w-0 flex items-center gap-1 overflow-x-auto">
                        {pickerRows.map(row => {
                            const isCurrent = row.id === currentId;
                            const source = questionSourceLabel(row);
                            return (
                                <a
                                    href={`/past-papers/attempt/${row.id}?${currentParams}`}
                                    data-attempt-nav
                                    data-question-id={row.id}
                                    data-tip={source}
                                    aria-label={`Question ${row.position} of ${total}: ${source}`}
                                    aria-current={isCurrent ? 'true' : undefined}
                                    class={`shrink-0 w-7 h-7 flex items-center justify-center rounded text-xs font-bold border transition-colors ${
                                        isCurrent
                                            ? 'bg-blue-600 border-blue-600 text-white'
                                            : Number(row.is_completed)
                                                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/60 text-green-700 dark:text-green-400 hover:border-green-400'
                                                : 'bg-white dark:bg-neutral-800 border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-neutral-400 hover:border-blue-400 hover:text-blue-600'
                                    }`}
                                >
                                    {row.position}
                                </a>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Header */}
            <div class="flex items-center justify-between gap-3 mb-2 shrink-0">
                <div class="flex items-center gap-3 overflow-hidden min-w-0">
                    <a href={
                        source === 'practice' ? `/past-papers?subject=${encodeURIComponent(q.subject)}&tab=practice&${currentParams}` :
                            source === 'review' ? `/past-papers?subject=${encodeURIComponent(q.subject)}&tab=review` :
                                `/past-papers/paper/${q.paper_id}`
                    } class="text-sm font-semibold text-gray-500 hover:text-gray-900 dark:text-neutral-400 dark:hover:text-white shrink-0 flex items-center gap-1">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
                        Back
                    </a>
                    <span class="text-gray-300 dark:text-neutral-700 shrink-0">|</span>
                    <h1 class="text-sm font-bold text-gray-900 dark:text-neutral-100 truncate">
                        {q.school_name} {q.academic_year} — {q.section_label} Q{q.question_number}
                    </h1>
                    <a href={pdfUrl} target="_blank" class="hidden md:flex items-center gap-1 text-red-700 dark:text-red-400 text-xs font-bold hover:underline transition-colors shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /></svg>
                        PDF
                    </a>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                    <span class="text-xs text-gray-400 dark:text-neutral-500 font-medium hidden sm:inline">
                        Q{position} of {total}
                    </span>
                    {prevId ? (
                        <a href={`/past-papers/attempt/${prevId}?${currentParams}`} data-attempt-nav class="px-2.5 py-1 rounded border dark:border-neutral-700 text-gray-700 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-800 text-sm font-bold transition-colors">← Prev</a>
                    ) : (
                        <button disabled class="px-2.5 py-1 rounded border dark:border-neutral-700 text-gray-400 dark:text-neutral-600 text-sm font-bold opacity-50 cursor-not-allowed">← Prev</button>
                    )}
                    {nextId ? (
                        <a href={`/past-papers/attempt/${nextId}?${currentParams}`} data-attempt-nav class="px-2.5 py-1 rounded border dark:border-neutral-700 text-gray-700 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-800 text-sm font-bold transition-colors">Next →</a>
                    ) : (
                        <button disabled class="px-2.5 py-1 rounded border dark:border-neutral-700 text-gray-400 dark:text-neutral-600 text-sm font-bold opacity-50 cursor-not-allowed">Next →</button>
                    )}
                </div>
            </div>

            {/* Main Form */}
            <form action={`/past-papers/attempt/${qId}/save?${currentParams}`} method="post" id="attempt-form" class="flex-1 min-h-0 flex flex-col lg:flex-row bg-white dark:bg-neutral-900 overflow-hidden rounded-sm border dark:border-neutral-800">
                <input type="hidden" name="next_id" value={nextId || ''} />
                <input type="hidden" name="max_marks" value={q.marks} />

                {/* Left Pane */}
                {hasStimulus && (
                    <div class="w-full lg:w-1/2 flex flex-col bg-slate-50/50 dark:bg-slate-900/30 overflow-y-auto lg:border-r border-gray-200 dark:border-neutral-800 border-b lg:border-b-0">
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

                    {/* Review Mode Banner */}
                    {mode === 'review' && originalAttempt && (
                        <div class="flex items-center gap-3 bg-amber-50 dark:bg-amber-900/20 px-4 py-2 text-xs shrink-0 border-b border-amber-100 dark:border-amber-900/50">
                            <span class="font-bold text-amber-800 dark:text-amber-500 uppercase tracking-wide">Prior Review</span>
                            <span class="bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-300 px-1.5 py-0.5 rounded font-bold">
                                {originalAttempt.marks_awarded || 0} / {q.marks}
                            </span>
                        </div>
                    )}

                    {/* Question Content */}
                    <div class="relative p-4 pt-6 bg-white dark:bg-neutral-900 shrink-0 border-b dark:border-neutral-800">
                        <span class="absolute top-2 right-3 text-xs font-bold bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-neutral-300 px-2 py-0.5 rounded-full border border-gray-200 dark:border-neutral-700">
                            {q.marks} mark{q.marks === 1 ? '' : 's'}
                        </span>
                        {q.question_text ? (
                            <div class="text-gray-900 dark:text-neutral-100 whitespace-pre-wrap font-serif text-lg leading-snug">
                                {mcqOptions ? parsed.stem : q.question_text}
                            </div>
                        ) : q.question_image_key ? (
                            <img src={`/download/${q.question_image_key}`} class="w-full h-auto object-contain" />
                        ) : null}
                    </div>

                    {/* Response Input */}
                    <div class="p-4 bg-gray-50/50 dark:bg-neutral-800/30 shrink-0 border-b dark:border-neutral-800">
                        {q.question_type === 'multiple_choice' ? (
                            <div class="flex flex-col gap-2">
                                {['A', 'B', 'C', 'D'].map(opt => (
                                    <label class="cursor-pointer flex items-center gap-3 border dark:border-neutral-600 rounded-sm bg-white dark:bg-neutral-800 px-3 py-2.5 has-[:checked]:border-blue-600 has-[:checked]:ring-1 has-[:checked]:ring-blue-600 transition-colors">
                                        <input type="radio" name="selected_option" value={opt} class="peer sr-only" checked={attempt?.selected_option === opt} />
                                        <span class="w-7 h-7 shrink-0 flex items-center justify-center rounded-full border border-gray-300 dark:border-neutral-600 font-bold text-sm text-gray-700 dark:text-neutral-300 peer-checked:bg-blue-600 peer-checked:border-blue-600 peer-checked:text-white transition-colors">{opt}</span>
                                        <span class="text-sm text-gray-800 dark:text-neutral-200">{mcqOptions?.[opt] || ''}</span>
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
                                id="reveal-btn"
                                type="button"
                                class="mt-4 w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-sm text-sm transition-colors"
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
                                                class="mark-btn min-w-[2.25rem] px-2 py-1 text-sm font-bold transition-colors data-[active=true]:text-blue-700 dark:data-[active=true]:text-blue-400 data-[active=false]:text-gray-600 dark:data-[active=false]:text-neutral-400 data-[active=false]:hover:text-gray-900 dark:data-[active=false]:hover:text-neutral-200 data-[active=true]:underline data-[active=false]:hover:underline"
                                            >
                                                {m}
                                            </button>
                                        );
                                    })}
                                </div>

                                <button
                                    type="button"
                                    data-max-btn
                                    class="ml-auto px-2.5 py-1 text-xs font-bold text-blue-700 dark:text-blue-400 hover:underline"
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

                    {/* Sticky Action Footer */}
                    <div class="p-3 bg-gray-100 dark:bg-neutral-900/80 border-t dark:border-neutral-700 flex justify-between items-center gap-4 shrink-0">
                        <div class="text-xs text-gray-500 dark:text-neutral-400 font-medium">
                            {attempt?.is_completed ? (
                                <span class="flex items-center gap-2">
                                    <span class="text-green-600 dark:text-green-400">✓ Completed {completedDate}</span>
                                    <button type="submit" name="action" value="undone" class="text-red-600 dark:text-red-400 hover:underline">Revert</button>
                                </span>
                            ) : (
                                <span class="opacity-70">Select a mark to auto-save & continue</span>
                            )}
                        </div>
                        <div class="flex gap-2">
                            <button type="submit" name="action" value="save" class="px-4 py-1.5 rounded border dark:border-neutral-600 text-gray-700 dark:text-neutral-300 text-sm font-bold hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors">
                                Save
                            </button>
                            <button type="submit" name="action" value="complete" class="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors">
                                Save + Continue
                            </button>
                        </div>
                    </div>
                </div>
            </form>

                {/* Question state for the client, re-read on every fragment swap */}
                <script
                    id="attempt-config"
                    type="application/json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(attemptConfig).replace(/</g, '\\u003c') }}
                />
            </>
    );

    // The fragment is the prefetchable unit: the shell, Tailwind and KaTeX are already loaded,
    // so moving between questions only has to swap the question in.
    if (c.req.query('partial')) return c.html(<>{content}</>);

    return c.html(
        <Layout title={`Question - ${subjectLabel(q.subject)}`} user={user} latex={true}>
            <div class="w-full h-[calc(100vh-3rem)] flex flex-col p-2 max-w-[120rem] mx-auto">
                <div id="attempt-root" class="flex-1 min-h-0 flex flex-col">
                    {content}
                </div>
                <script dangerouslySetInnerHTML={{ __html: ATTEMPT_CLIENT_SCRIPT }} />
            </div>
        </Layout>
    );
})

// Save Attempt
app.post('/past-papers/attempt/:id/save', async (c) => {
    const user = await getUser(c)
    if (!user) return c.redirect(loginRedirect(c))

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
    const filterTopicGroup = c.req.query('topic_group');
    const filterSchool = c.req.query('school');
    const filterYear = c.req.query('year');
    const filterStatus = c.req.query('status');
    const filterType = c.req.query('type');
    const filterSection = c.req.query('section');
    const filterMarksMin = c.req.query('marks_min');
    const filterMarksMax = c.req.query('marks_max');
    const sort = c.req.query('sort') || 'school_asc';

    const params = new URLSearchParams({
        source: source || '',
        mode: mode || '',
        school: filterSchool || '',
        topic: filterTopic || '',
        topic_group: filterTopicGroup || '',
        year: filterYear || '',
        status: filterStatus || '',
        sort,
        type: filterType || '',
        section: filterSection || '',
        marks_min: filterMarksMin || '',
        marks_max: filterMarksMax || ''
    }).toString();

    if (action === 'complete' && nextId) {
        return c.redirect(`/past-papers/attempt/${nextId}?${params}`);
    }

    return c.redirect(`/past-papers/attempt/${qId}?${params}`);
})

// Client layer for the attempt view. It owns three things the server-rendered page cannot:
// a small cache of prefetched question fragments, swapping one into the current question, and
// the question toolbar (picker tooltip, marks and submit handling). Every listener is
// delegated from the stable #attempt-root wrapper, so a swap never leaves stale bindings.
const ATTEMPT_CLIENT_SCRIPT = `
(function() {
    var PREFETCH_CONCURRENCY = 3;
    var root = document.getElementById('attempt-root');
    if (!root) return;

    var cache = {};
    var inflight = {};
    var queue = [];
    var active = 0;
    var state = readConfig(root);

    var tip = document.createElement('div');
    tip.setAttribute('aria-hidden', 'true');
    tip.className = 'fixed z-[100] hidden pointer-events-none max-w-xs rounded-sm bg-gray-900 dark:bg-neutral-100 text-white dark:text-gray-900 text-xs font-medium px-2.5 py-1.5 shadow-lg';
    document.body.appendChild(tip);

    function readConfig(scope) {
        var el = scope.querySelector('#attempt-config');
        if (!el) return null;
        try { return JSON.parse(el.textContent); } catch (e) { return null; }
    }

    function idFromUrl(url) {
        var match = String(url || '').match(/\\/past-papers\\/attempt\\/(\\d+)/);
        return match ? match[1] : null;
    }

    function partialUrl(id) {
        return '/past-papers/attempt/' + id + '?' + (state.params || '') + '&partial=1';
    }

    // Fragments are cached rather than the full documents, so a window of questions costs a
    // fraction of the page weight and a swap needs no second request.
    function loadPartial(id) {
        if (cache[id]) return Promise.resolve(cache[id]);
        if (inflight[id]) return inflight[id];
        inflight[id] = fetch(partialUrl(id), { headers: { 'X-Requested-With': 'highhelp-partial' } })
            .then(function(res) { return res.ok ? res.text() : Promise.reject(new Error('bad status')); })
            .then(function(html) { cache[id] = html; delete inflight[id]; return html; })
            .catch(function() { delete inflight[id]; return null; });
        return inflight[id];
    }

    function pump() {
        while (active < PREFETCH_CONCURRENCY && queue.length) {
            var id = queue.shift();
            active += 1;
            loadPartial(id).then(function() {
                active -= 1;
                pump();
            });
        }
    }

    // Warm the rest of the picker window in navigation order, so the questions either side of
    // the current one are already in the cache by the time they are wanted.
    function prefetch() {
        var connection = navigator.connection;
        if (connection && (connection.saveData || connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g')) return;
        queue = (state.prefetch || []).filter(function(id) { return !cache[id] && !inflight[id]; });
        if (!queue.length) return;
        if (window.requestIdleCallback) window.requestIdleCallback(pump, { timeout: 3000 });
        else setTimeout(pump, 300);
    }

    function hideTip() {
        tip.classList.add('hidden');
    }

    function swap(html, url, push) {
        var holder = document.createElement('div');
        holder.innerHTML = html;
        var next = readConfig(holder);
        if (!next || !holder.querySelector('#attempt-form')) {
            window.location.href = url;
            return;
        }
        root.innerHTML = html;
        state = next;
        if (push) window.history.pushState({ id: next.id }, '', url);
        window.scrollTo(0, 0);
        hideTip();
        // KaTeX and pdf-crop render on first paint, so a swapped question has to be told its
        // new nodes are ready.
        if (window.__highhelpRenderMath) window.__highhelpRenderMath(root);
        prefetch();
    }

    function navigate(url, push) {
        var id = idFromUrl(url);
        if (!id) {
            window.location.href = url;
            return;
        }
        loadPartial(id).then(function(html) {
            if (html) swap(html, url, push);
            else window.location.href = url;
        });
    }

    function setMark(m) {
        var input = document.getElementById('marks_awarded_input');
        if (input) input.value = m;
        root.querySelectorAll('.mark-btn').forEach(function(btn) {
            btn.setAttribute('data-active', String(Number(btn.getAttribute('data-mark')) === m));
        });
    }

    function submitComplete() {
        var form = document.getElementById('attempt-form');
        if (!form) return;
        var hidden = form.querySelector('input[name="action"]');
        if (!hidden) {
            hidden = document.createElement('input');
            hidden.type = 'hidden';
            hidden.name = 'action';
            form.appendChild(hidden);
        }
        hidden.value = 'complete';
        if (form.requestSubmit) form.requestSubmit();
        else form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    }

    function reveal() {
        var btn = document.getElementById('reveal-btn');
        var section = document.getElementById('answer-section');
        if (btn) btn.style.display = 'none';
        if (section) {
            section.style.display = '';
            section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    root.addEventListener('click', function(e) {
        var target = e.target;
        if (!target || !target.closest) return;

        var link = target.closest('a[data-attempt-nav]');
        if (link) {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
            e.preventDefault();
            navigate(link.getAttribute('href'), true);
            return;
        }

        if (target.closest('#reveal-btn')) {
            e.preventDefault();
            if (state.isMcq) {
                var selected = root.querySelector('input[name="selected_option"]:checked');
                var value = selected ? selected.value : '';
                setMark(value && value === state.correctAnswer ? state.maxMarks : 0);
                reveal();
                submitComplete();
            } else {
                reveal();
            }
            return;
        }

        var markBtn = target.closest('.mark-btn');
        if (markBtn) {
            e.preventDefault();
            setMark(Number(markBtn.getAttribute('data-mark')));
            submitComplete();
            return;
        }

        if (target.closest('[data-max-btn]')) {
            e.preventDefault();
            setMark(state.maxMarks);
            submitComplete();
        }
    });

    // Hovering a picker chip explains where that question came from, which the chip itself
    // (a bare position number) has no room for.
    root.addEventListener('mouseover', function(e) {
        var chip = e.target && e.target.closest ? e.target.closest('#attempt-picker [data-tip]') : null;
        if (!chip) {
            hideTip();
            return;
        }
        tip.textContent = chip.getAttribute('data-tip') || '';
        tip.classList.remove('hidden');
        var rect = chip.getBoundingClientRect();
        tip.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - tip.offsetWidth - 8)) + 'px';
        tip.style.top = Math.max(8, rect.top - tip.offsetHeight - 8) + 'px';
    });

    root.addEventListener('mouseleave', hideTip);
    window.addEventListener('scroll', hideTip, { passive: true });

    // Saving posts in the background and follows the redirect as a fragment, so marking a
    // question and continuing no longer reloads the page.
    root.addEventListener('submit', function(e) {
        var form = e.target;
        if (!form || form.id !== 'attempt-form') return;
        e.preventDefault();

        var submitter = e.submitter;
        var data = new FormData(form);
        if (submitter && submitter.name) data.set(submitter.name, submitter.value);
        else {
            var pending = form.querySelector('input[name="action"]');
            if (pending) data.set('action', pending.value);
        }

        form.classList.add('opacity-60', 'pointer-events-none');

        fetch(form.action, { method: 'POST', body: data })
            .then(function(res) {
                if (!res.ok || !res.redirected) throw new Error('save failed');
                return res.url;
            })
            .then(function(url) {
                var id = idFromUrl(url);
                if (!id) {
                    window.location.href = url;
                    return;
                }
                // The question just saved may differ from the prefetched copy, so refetch it.
                delete cache[id];
                navigate(url, true);
            })
            .catch(function() {
                form.classList.remove('opacity-60', 'pointer-events-none');
                var input = document.createElement('input');
                input.type = 'hidden';
                if (submitter && submitter.name) {
                    input.name = submitter.name;
                    input.value = submitter.value;
                } else {
                    input.name = 'action';
                    input.value = 'save';
                }
                form.appendChild(input);
                form.submit();
            });
    });

    window.addEventListener('popstate', function() {
        var id = idFromUrl(window.location.pathname);
        if (!id || !state || String(state.id) === id) return;
        loadPartial(id).then(function(html) {
            if (html) swap(html, window.location.href, false);
            else window.location.reload();
        });
    });

    if (document.readyState === 'complete') prefetch();
    else window.addEventListener('load', prefetch);
})();
`

export default app
