import { Hono } from 'hono'
import { Layout } from '../../layout'
import { getUser, loginRedirect } from '../../utils'
import { subjectLabel } from '../../constants'
import { Bindings } from '../../types'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import {
    BATCH_PAGE_LIMIT,
    buildBatchPracticeQuery,
    buildPracticeCountQuery,
    groupBySection,
    practiceUrlFilters,
    readRawPracticeFilters,
    resolvePracticeFilters
} from './practiceQuery'
import { QuestionMeta, QuestionShell } from './questionShell'
import { parseStimulusCoordinates } from './practiceExport'
import { AnswerInput, WorkingPad, type DrawingFieldProps } from '../../components/DrawingField'
import { attemptDrawingUrls, drawingContextForMode } from './drawingDoc'

const app = new Hono<{ Bindings: Bindings }>()

// `exam_questions.marks` is nullable, so every place that turns a row into a mark ceiling has to
// agree on the fallback. A multiple-choice item is a single answer, so an unmarked MCQ is worth 1
// rather than the essay fallback. Previously the mark buttons and the client-side auto-award used
// `marks || 0`, which offered no buttons and silently scored a correct MCQ as 0, while this figure
// said 100 — so the header total and the marks actually recorded disagreed.
const UNMARKED_MAX_MARKS = 100
const UNMARKED_MCQ_MARKS = 1
const maxMarksOf = (q: { marks?: number | null; question_type?: string | null }) => {
    const parsed = parseInt(String(q.marks ?? ''), 10)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
    return q.question_type === 'multiple_choice' ? UNMARKED_MCQ_MARKS : UNMARKED_MAX_MARKS
}

app.get('/past-papers/batch/view', async (c) => {
    const user = await getUser(c)
    if (!user) return c.redirect(loginRedirect(c))

    const source = c.req.query('source') || 'paper'
    const paperId = c.req.query('paper_id')
    const mode = c.req.query('mode')
    const subject = c.req.query('subject')

    const raw = readRawPracticeFilters(key => c.req.query(key))
    let questions: any[] = []
    let headerTitle = 'Questions'
    let backUrl = '/past-papers'
    let truncated = false

    if (source === 'practice' && subject) {
        const filters = await resolvePracticeFilters(c.env.DB, subject, raw)
        const list = buildBatchPracticeQuery(user.id, subject, filters)
        const count = buildPracticeCountQuery(user.id, subject, filters)
        const [res, countResult] = await c.env.DB.batch([
            c.env.DB.prepare(list.sql).bind(...list.params),
            c.env.DB.prepare(count.sql).bind(...count.params)
        ])
        questions = res.results as any[]
        const matching = Number((countResult.results[0] as { total: number })?.total || 0)
        truncated = matching > questions.length
        headerTitle = `${subjectLabel(subject)} Practice Questions`
        backUrl = `/past-papers?${new URLSearchParams({ subject, tab: 'practice', ...practiceUrlFilters(raw) })}`

    } else if (source === 'review' && subject) {
        const query = `
            SELECT q.*, p.subject, p.school_name, p.academic_year, p.reference_link, p.id as paper_id,
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
        headerTitle = `${subjectLabel(subject)} Review Queue`
        backUrl = `/past-papers?subject=${encodeURIComponent(subject)}&tab=review`

    } else if (paperId) {
        const query = `
            SELECT q.*, p.subject, p.school_name, p.academic_year, p.reference_link, p.id as paper_id,
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

    const totalCount = questions.length

    // Which questions already have a drawing in this context. Read on its own so the shared practice
    // query, whose SQL the tests pin, stays as it is.
    const drawingContext = drawingContextForMode(mode)
    const drawingRows = await c.env.DB.prepare('SELECT question_id, updated_at FROM answer_drawings WHERE user_id = ? AND context = ?')
        .bind(user.id, drawingContext)
        .all<{ question_id: number; updated_at: string }>()
    const drawingVersions = new Map(drawingRows.results.map(row => [Number(row.question_id), row.updated_at]))

    // "Completed" in the database means full marks (`isComplete = marks >= maxMarks`), so counting it
    // as progress only credits questions that were answered perfectly. Progress here is therefore split
    // into the three things a marker actually reports: how much was attempted, how often the attempted
    // work was fully correct, and how much of the available marks that work earned.
    const attemptedQuestions = questions.filter((q: any) => q.ua_updated != null)
    const attemptedCount = attemptedQuestions.length
    const attemptedPossible = attemptedQuestions.reduce((sum: number, q: any) => sum + maxMarksOf(q), 0)
    const attemptedAwarded = attemptedQuestions.reduce((sum: number, q: any) => sum + (Number(q.ua_marks) || 0), 0)
    const fullMarkCount = attemptedQuestions.filter((q: any) => {
        const max = maxMarksOf(q)
        return max > 0 && (Number(q.ua_marks) || 0) >= max
    }).length
    const attemptedPct = totalCount > 0 ? Math.round((attemptedCount / totalCount) * 100) : 0
    const accuracyPct = attemptedCount > 0 ? Math.round((fullMarkCount / attemptedCount) * 100) : 0
    const markPct = attemptedPossible > 0 ? Math.round((attemptedAwarded / attemptedPossible) * 100) : 0

    // Seeded into the client so a save can re-derive the stats without refetching the whole batch.
    // Each entry is a [questionId, [attempted, marksAwarded, maxMarks]] pair, i.e. Map entry shape.
    const initialStats = questions.map((q: any) => [q.id, [q.ua_updated != null ? 1 : 0, Number(q.ua_marks) || 0, maxMarksOf(q)]])

    // The practice list buckets the flat `practiceOrder` result into section blocks, so a batch
    // started from it has to use the same bucketing or the questions arrive in a different order.
    // The review queue and a single paper already arrive in the order they should be worked in.
    const entries = (source === 'practice' ? groupBySection(questions) : [[null, questions]] as [string | null, any[]][])
        .flatMap(([sectionLabel, sectionQuestions]) =>
            sectionQuestions.map((question, index) => ({ sectionLabel: index === 0 ? sectionLabel : null, question }))
        )

    return c.html(
        <Layout title={`Batch Attempt - ${headerTitle}`} user={user} latex={true} drawing={true}>
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
                    <div class="flex items-center gap-2">
                        <span class="text-xs text-gray-500 dark:text-neutral-400">{totalCount} questions</span>
                        {truncated && (
                            <span class="text-xs text-amber-600 dark:text-amber-400">
                                (showing the first {BATCH_PAGE_LIMIT} — narrow your filters to see the rest)
                            </span>
                        )}
                        {totalCount > 0 && (
                            <button type="button" onclick="downloadPdfBatch()" class="text-xs text-emerald-600 dark:text-emerald-400 font-bold hover:underline transition-colors">
                                ↓ PDF
                            </button>
                        )}
                    </div>
                </div>

                <div class="mb-5 pb-4 border-b border-gray-200 dark:border-neutral-800">
                    <div class="flex items-start justify-between gap-4">
                        {/* Grid rather than flex so the three columns share a baseline; every cell has a
                            label, a value and a sub-line, otherwise the shorter cell floats out of line. */}
                        <dl class="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 flex-1">
                            <div>
                                <dt class="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-neutral-500">Attempted</dt>
                                <dd class="text-sm font-bold text-gray-900 dark:text-neutral-100 leading-tight">
                                    <span id="stat-attempted">{attemptedCount}</span><span class="font-medium text-gray-400 dark:text-neutral-600">/{totalCount}</span>
                                </dd>
                                <dd class="text-[11px] text-gray-400 dark:text-neutral-600 leading-tight"><span id="stat-remaining">{totalCount - attemptedCount}</span> remaining</dd>
                            </div>
                            <div>
                                <dt class="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-neutral-500">Accuracy</dt>
                                <dd class="text-sm font-bold text-gray-900 dark:text-neutral-100 leading-tight">
                                    <span id="stat-accuracy">{accuracyPct}</span><span class="font-medium text-gray-400 dark:text-neutral-600">%</span>
                                </dd>
                                <dd class="text-[11px] text-gray-400 dark:text-neutral-600 leading-tight"><span id="stat-full-marks">{fullMarkCount}</span> of <span id="stat-attempted-2">{attemptedCount}</span> full marks</dd>
                            </div>
                            <div>
                                <dt class="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-neutral-500">Marks</dt>
                                <dd class="text-sm font-bold text-gray-900 dark:text-neutral-100 leading-tight">
                                    <span id="stat-awarded">{attemptedAwarded}</span><span class="font-medium text-gray-400 dark:text-neutral-600">/{attemptedPossible}</span>
                                </dd>
                                <dd class="text-[11px] text-gray-400 dark:text-neutral-600 leading-tight"><span id="stat-mark-pct">{markPct}</span>% of attempted</dd>
                            </div>
                        </dl>
                        <span id="batch-pct" class="text-sm font-bold text-blue-600 dark:text-blue-400 shrink-0">{attemptedPct}%</span>
                    </div>
                    <div class="w-full bg-gray-200 dark:bg-neutral-700 rounded-full h-1.5 overflow-hidden mt-3">
                        <div id="batch-progress-bar" class="bg-blue-600 h-1.5 rounded-full transition-all" style={`width: ${attemptedPct}%`}></div>
                    </div>
                </div>

                <div class="pb-8" id="questions-container">
                    {entries.map(({ sectionLabel, question: q }) => {
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
                        const showSource = !!q.school_name && source !== 'paper'
                        // The school and year link out to the paper's reference PDF, but only when one was
                        // actually uploaded — `papers.reference_link` is set on upload and left null
                        // otherwise, so it doubles as the "has a PDF" flag.
                        //
                        // A cropped stimulus records the page it came from inside its `pdf_crop:` key, so
                        // when there is one the link deep-links to that page rather than the top of the
                        // paper, and the page is named so the jump does not look arbitrary.
                        const stimulusPage = parseStimulusCoordinates(q.stimulus_image_key)?.page
                            ?? parseStimulusCoordinates(q.question_image_key)?.page
                            ?? null
                        const sourceLink = showSource && q.reference_link
                            ? {
                                text: `${q.school_name} ${q.academic_year}${stimulusPage ? ` (Page ${stimulusPage})` : ''}`,
                                href: `${String(q.reference_link).split('#')[0]}${stimulusPage ? `#page=${stimulusPage}` : ''}`
                            }
                            : null
                        const questionRef = `${q.section_label} Q${q.question_number}`
                        const sourceLine = sourceLink || !showSource ? questionRef : `${q.school_name} ${q.academic_year} — ${questionRef}`
                        const drawing: DrawingFieldProps = {
                            ...attemptDrawingUrls(Number(q.id), drawingContext),
                            version: drawingVersions.get(Number(q.id)) ?? null,
                            title: `${q.school_name} ${q.academic_year} — ${questionRef}`,
                            questionSource: `#q-${q.id} [data-drawing-question]`
                        }

                        return (
                            <>
                                {sectionLabel !== null && (
                                    <h2 class="text-xl font-bold text-gray-900 dark:text-white mt-10 mb-3 pb-2 border-b border-gray-200 dark:border-neutral-700">{sectionLabel}</h2>
                                )}
                                <QuestionShell
                                    id={`q-${q.id}`}
                                    marks={maxMarksOf(q)}
                                    header={
                                        <QuestionMeta source={sourceLine} sourceLink={sourceLink}>
                                            {q.question_type === 'multiple_choice' && (
                                                <span class="text-[11px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">MCQ</span>
                                            )}
                                            <span id={`q-status-${q.id}`} class={`ml-auto text-xs font-bold px-2 py-0.5 rounded ${attempt?.is_completed ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20' : hasAttempt ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20' : ''}`}>
                                                {attempt?.is_completed ? '✓ Done' : hasAttempt ? 'Saved' : ''}
                                            </span>
                                        </QuestionMeta>
                                    }
                                >
                                    {hasStimulus && (
                                        <div class="bg-gray-50 dark:bg-neutral-900/40 p-3 rounded-lg" data-drawing-question>
                                            {q.stimulus_text && (
                                                <div class="text-gray-700 dark:text-neutral-300 whitespace-pre-wrap font-serif italic text-[15px] leading-relaxed">
                                                    {q.stimulus_text}
                                                </div>
                                            )}
                                            {q.stimulus_image_key && (
                                                q.stimulus_image_key.startsWith('pdf_crop:') ? (
                                                    <pdf-crop pdf-url={`/download/papers/${q.paper_id}.pdf`} crop-data={q.stimulus_image_key.replace('pdf_crop:', '')}></pdf-crop>
                                                ) : (
                                                    <img src={`/download/${q.stimulus_image_key}`} class="w-full h-auto object-contain bg-white dark:bg-neutral-900 rounded" />
                                                )
                                            )}
                                        </div>
                                    )}

                                    {q.question_text ? (
                                        <div class="text-gray-900 dark:text-neutral-100 whitespace-pre-wrap font-serif text-lg leading-snug" data-drawing-question>
                                            {q.question_text}
                                        </div>
                                    ) : q.question_image_key ? (
                                        <img src={`/download/${q.question_image_key}`} class="w-full h-auto object-contain rounded bg-white dark:bg-neutral-900" data-drawing-question />
                                    ) : null}

                                    {q.question_type === 'multiple_choice' ? (
                                        <>
                                            <div class="flex gap-2" id={`mcq-${q.id}`} data-drawing-question>
                                                {['A', 'B', 'C', 'D'].map(opt => (
                                                    <label class="cursor-pointer flex-1">
                                                        <input type="radio" name={`sel-${q.id}`} value={opt} class="peer sr-only" checked={attempt?.selected_option === opt} />
                                                        <div class="text-center py-2 border dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 peer-checked:bg-blue-600 peer-checked:border-blue-600 peer-checked:text-white text-gray-700 dark:text-neutral-300 font-bold transition-none">
                                                            {opt}
                                                        </div>
                                                    </label>
                                                ))}
                                            </div>
                                            <WorkingPad drawing={drawing} activation="tap" />
                                        </>
                                    ) : (
                                        <AnswerInput drawing={drawing} hasText={!!String(attempt?.response_content || '').trim()} activation="tap">
                                            <textarea id={`resp-${q.id}`}
                                                class="w-full min-h-[6rem] p-3 border dark:border-neutral-600 bg-white dark:bg-neutral-900 text-gray-900 dark:text-neutral-100 text-sm focus:ring-1 focus:ring-blue-500 outline-none resize-y rounded"
                                                placeholder="Type your answer here..."
                                            >{attempt?.response_content || ''}</textarea>
                                        </AnswerInput>
                                    )}

                                    <div id={`ans-${q.id}`} style={answerRevealed ? '' : 'display:none'}>
                                        <div class="bg-green-50 dark:bg-green-900/10 p-3 rounded-lg space-y-3">
                                            {q.mc_answer && (
                                                <div class="text-xl font-black text-green-700 dark:text-green-400">{q.mc_answer}</div>
                                            )}
                                            {q.answer_text ? (
                                                <div class="text-green-900 dark:text-green-300 whitespace-pre-wrap text-[15px] font-medium leading-relaxed">
                                                    {q.answer_text}
                                                </div>
                                            ) : q.answer_image_key ? (
                                                <img src={`/download/${q.answer_image_key}`} class="w-full object-contain bg-white dark:bg-neutral-900 rounded" />
                                            ) : (
                                                <span class="text-green-600/60 dark:text-green-500/50 italic text-sm">No marking guideline provided.</span>
                                            )}

                                            <div class="pt-2 border-t border-green-200/60 dark:border-green-800/50">
                                                <div class="flex items-center gap-2 mb-2">
                                                    <span class="text-sm font-bold text-gray-700 dark:text-neutral-300">Award Marks:</span>
                                                    <input type="hidden" id={`marks-${q.id}`} value={attempt?.marks_awarded ?? 0} />
                                                    <div class="flex gap-1">
                                                        {Array.from({ length: maxMarksOf(q) + 1 }, (_, m) => (
                                                            <button type="button"
                                                                class={`mk-${q.id} min-w-[2rem] px-2 py-0.5 text-sm font-bold transition-colors ${Number(attempt?.marks_awarded ?? 0) === m ? 'text-blue-700 dark:text-blue-400 underline' : 'text-gray-600 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-neutral-200 hover:underline'}`}
                                                                onclick={`setMark(${q.id}, ${m}); saveQuestion(${q.id}, ${JSON.stringify(q.question_type === 'multiple_choice' ? 'mcq' : 'text')}, ${JSON.stringify(mode || '')})`}
                                                                >{m}</button>
                                                        ))}
                                                    </div>
                                                </div>
                                                <textarea id={`notes-${q.id}`}
                                                    class="w-full h-10 p-2 border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-sm text-gray-900 dark:text-neutral-100 outline-none focus:ring-1 focus:ring-blue-500 resize-none rounded"
                                                    placeholder="Notes (optional)... [This question will appear in Review tab if you leave an input]"
                                                >{attempt?.marker_notes || ''}</textarea>
                                            </div>
                                        </div>
                                    </div>

                                    {!answerRevealed && (
                                        <button type="button" id={`reveal-${q.id}`}
                                            class="w-full text-gray-600 dark:text-neutral-300 hover:text-blue-600 dark:hover:text-blue-400 text-sm font-semibold hover:underline transition-colors"
                                            onclick={`checkAnswer(${q.id}, ${JSON.stringify(q.question_type === 'multiple_choice' ? 'mcq' : 'text')}, ${JSON.stringify(q.mc_answer || '')}, ${maxMarksOf(q)}, ${JSON.stringify(mode || '')})`}
                                        >
                                            Check Answer
                                        </button>
                                    )}

                                    <div class="flex justify-end">
                                        <button type="button" id={`save-btn-${q.id}`}
                                            onclick={`saveQuestion(${q.id}, ${JSON.stringify(q.question_type === 'multiple_choice' ? 'mcq' : 'text')}, ${JSON.stringify(mode || '')})`}
                                            class="px-4 py-1.5 text-blue-600 dark:text-blue-400 text-sm font-bold hover:underline transition-colors"
                                        >
                                            Save
                                        </button>
                                    </div>
                                </QuestionShell>
                            </>
                        )
                    })}
                </div>

            </div>

            <script dangerouslySetInnerHTML={{ __html: `
                function downloadPdfBatch() {
                    const ids = Array.from(document.querySelectorAll('[id^="q-"]')).map(el => el.id.replace('q-', '')).filter(id => id && !isNaN(+id));
                    if (!ids.length) return;
                    const f = document.createElement('form');
                    f.method = 'POST'; f.action = '/past-papers/batch/export-pdf';
                    ids.forEach(id => { const i = document.createElement('input'); i.type = 'hidden'; i.name = 'question_ids'; i.value = id; f.appendChild(i); });
                    document.body.appendChild(f); f.submit();
                }

                let batchTotal = ${totalCount};
                // qid -> [attempted, marksAwarded, maxMarks], kept in sync from the save response so
                // every stat below is derived from one place rather than tracked as separate counters.
                const batchStats = new Map(${JSON.stringify(initialStats)});

                function renderBatchStats() {
                    let attempted = 0, awarded = 0, possible = 0, full = 0;
                    batchStats.forEach(([isAttempted, marks, max]) => {
                        if (!isAttempted) return;
                        attempted++;
                        awarded += marks;
                        possible += max;
                        if (max > 0 && marks >= max) full++;
                    });
                    const pct = batchTotal > 0 ? attempted / batchTotal * 100 : 0;
                    document.getElementById('stat-attempted').textContent = attempted;
                    document.getElementById('stat-attempted-2').textContent = attempted;
                    document.getElementById('stat-remaining').textContent = batchTotal - attempted;
                    document.getElementById('stat-full-marks').textContent = full;
                    document.getElementById('stat-accuracy').textContent = attempted > 0 ? Math.round(full / attempted * 100) : 0;
                    document.getElementById('stat-awarded').textContent = awarded;
                    document.getElementById('stat-mark-pct').textContent = possible > 0 ? Math.round(awarded / possible * 100) : 0;
                    document.getElementById('batch-progress-bar').style.width = pct + '%';
                    document.getElementById('batch-pct').textContent = Math.round(pct) + '%';
                }

                function setMark(qid, m) {
                    const input = document.getElementById('marks-' + qid);
                    if (input) input.value = m;
                    document.querySelectorAll('.mk-' + qid).forEach(b => {
                        b.className = parseInt(b.textContent) === m
                            ? 'mk-' + qid + ' min-w-[2rem] px-2 py-0.5 text-sm font-bold transition-colors text-blue-700 dark:text-blue-400 underline'
                            : 'mk-' + qid + ' min-w-[2rem] px-2 py-0.5 text-sm font-bold transition-colors text-gray-600 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-neutral-200 hover:underline';
                    });
                }

                async function checkAnswer(qid, type, correct, maxMarks, mode) {
                    const ans = document.getElementById('ans-' + qid);
                    if (ans) ans.style.display = 'block';
                    const btn = document.getElementById('reveal-' + qid);
                    if (btn) btn.style.display = 'none';

                    if (type === 'mcq') {
                        const selected = document.querySelector('input[name="sel-' + qid + '"]:checked');
                        const m = selected && selected.value === correct ? maxMarks : 0;
                        setMark(qid, m);
                        await saveQuestion(qid, 'mcq', mode);
                    }
                }

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
                            btn.className = 'px-4 py-1.5 text-green-600 dark:text-green-400 text-sm font-bold';
                            setTimeout(() => {
                                btn.textContent = 'Save';
                                btn.className = 'px-4 py-1.5 text-blue-600 dark:text-blue-400 text-sm font-bold hover:underline transition-colors';
                                btn.disabled = false;
                            }, 2000);

                            const status = document.getElementById('q-status-' + qid);
                            batchStats.set(Number(qid), [1, d.marks_awarded, d.max_marks]);

                            if (d.is_completed) {
                                status.textContent = '✓ Done';
                                status.className = 'ml-auto text-xs font-bold px-2 py-0.5 rounded text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20';
                            } else {
                                status.textContent = 'Saved';
                                status.className = 'ml-auto text-xs font-bold px-2 py-0.5 rounded text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20';
                            }

                            renderBatchStats();
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
    const response = (body['response_content'] as string) || ''
    const selected = (body['selected_option'] as string) || null
    const notes = (body['marker_notes'] as string) || ''
    const mode = body['mode'] as string

    const q = await c.env.DB.prepare('SELECT marks, question_type, mc_answer FROM exam_questions WHERE id = ?').bind(qId).first<any>()
    if (!q) return c.json({ success: false, error: 'Question not found' }, 404)

    const maxMarks = maxMarksOf(q)
    let marks = parseInt((body['marks_awarded'] as string) || '0')

    if (q.question_type === 'multiple_choice' && selected && q.mc_answer) {
        marks = selected === q.mc_answer ? maxMarks : 0
    }

    const isComplete = marks >= maxMarks ? 1 : 0

    if (mode === 'review') {
        await c.env.DB.prepare(`
            INSERT INTO user_review_attempts (user_id, question_id, response_content, selected_option, marks_awarded, marker_notes, is_completed, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).bind(user.id, qId, response, selected, marks, notes, isComplete).run();
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

    return c.json({ success: true, id: qId, is_completed: isComplete, marks_awarded: marks, max_marks: maxMarks })
})

async function generateExamPdf(questions: any[], bucket: any): Promise<Uint8Array> {
    const doc = await PDFDocument.create()
    const tr = await doc.embedFont(StandardFonts.TimesRoman)
    const trIt = await doc.embedFont(StandardFonts.TimesRomanItalic)
    const trBd = await doc.embedFont(StandardFonts.TimesRomanBold)
    const h = await doc.embedFont(StandardFonts.Helvetica)
    const hBd = await doc.embedFont(StandardFonts.HelveticaBold)

    const PW = 595.28
    const PH = 841.89
    const M = 50
    const CW = PW - 2 * M

    let page = doc.addPage([PW, PH])
    let y = PH - M

    function np() { page = doc.addPage([PW, PH]); y = PH - M }
    function cs(need: number) { if (y - need < M) np() }

    async function ei(key: string) {
        if (!key || key.startsWith('pdf_crop:')) return null
        try {
            const obj = await bucket.get(key)
            if (!obj) return null
            const bytes = await obj.arrayBuffer()
            const arr = new Uint8Array(bytes.slice(0, 4))
            const isPng = arr[0] === 0x89 && arr[1] === 0x50 && arr[2] === 0x4E && arr[3] === 0x47
            const isJpeg = arr[0] === 0xFF && arr[1] === 0xD8
            if (isPng) return await doc.embedPng(bytes)
            if (isJpeg) return await doc.embedJpg(bytes)
            const ct = obj.httpMetadata?.contentType || ''
            if (ct.includes('png') || key.endsWith('.png')) return await doc.embedPng(bytes)
            return await doc.embedJpg(bytes)
        } catch { return null }
    }

    function stripLatex(text: string): string {
        return text
            .replace(/\$\$(.+?)\$\$/gs, '$1')
            .replace(/\\\[(.+?)\\\]/gs, '$1')
            .replace(/\\\((.+?)\\\)/gs, '$1')
            .replace(/\$(.+?)\$/g, '$1')
    }

    function sanitizeText(text: string): string {
        if (!text) return text
        return text
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n')
            .split('')
            .map(ch => {
                const cp = ch.codePointAt(0)!
                if (cp === 0x0A || cp === 0x0D) return ch
                if (cp >= 0x20 && cp <= 0x7E) return ch
                if (cp >= 0xA0 && cp <= 0xFF) return ch
                return ' '
            })
            .join('')
    }

    function dw(text: string, size: number, f: any) {
        if (!text) return
        const clean = sanitizeText(stripLatex(text))
        const paras = clean.split('\n')
        for (const p of paras) {
            const words = p.split(' ')
            let line = ''
            for (const w of words) {
                const t = line ? line + ' ' + w : w
                if (f.widthOfTextAtSize(t, size) > CW && line) {
                    cs(size * 1.4)
                    page.drawText(line, { x: M, y, font: f, size })
                    y -= size * 1.4
                    line = w
                } else {
                    line = t
                }
            }
            if (line) {
                cs(size * 1.4)
                page.drawText(line, { x: M, y, font: f, size })
                y -= size * 1.4
            }
            y -= size * 0.5
        }
    }

    async function di(key: string) {
        const img = await ei(key)
        if (!img) return
        const sc = Math.min(1, CW / img.width)
        const iw = img.width * sc
        const ih = img.height * sc
        cs(ih + 12)
        y -= ih + 12
        page.drawImage(img, { x: M, y, width: iw, height: ih })
    }

    page.drawText(`${questions[0]?.subject || 'Practice'} - Practice Exam`, { x: M, y, font: hBd, size: 16 })
    y -= 28

    for (const q of questions) {
        cs(50)
        page.drawText(`${q.section_label} Q${q.question_number}  (${q.marks} marks)`, { x: M, y, font: hBd, size: 12 })
        y -= 22
        page.drawText(`Source: ${q.school_name} ${q.academic_year} — ${q.section_label}`, { x: M, y, font: h, size: 8, color: rgb(0.5, 0.5, 0.5) })
        y -= 14

        if (q.stimulus_text) { cs(30); dw(q.stimulus_text, 10, trIt) }
        if (q.stimulus_image_key) { cs(30); await di(q.stimulus_image_key) }
        y -= 4

        if (q.question_text) { cs(30); dw(q.question_text, 11, tr) }
        if (q.question_image_key) { cs(30); await di(q.question_image_key) }

        y -= 12
        const nl = (q.marks || 1) * 2
        for (let i = 0; i < nl; i++) {
            cs(18); y -= 18
            page.drawLine({ start: { x: M, y }, end: { x: M + CW, y }, thickness: 0.5, color: rgb(0.75, 0.75, 0.75), dashArray: [3, 4] })
        }
        y -= 14
    }

    np()
    page.drawText('SOLUTIONS', { x: M, y, font: hBd, size: 18 })
    y -= 32

    for (const q of questions) {
        cs(40)
        page.drawText(`${q.section_label} Q${q.question_number}`, { x: M, y, font: hBd, size: 12 })
        y -= 22
        if (q.mc_answer) {
            page.drawText(`Answer: ${q.mc_answer}`, { x: M, y, font: trBd, size: 11 })
            y -= 18
        }
        if (q.answer_text) dw(q.answer_text, 10, tr)
        if (q.answer_image_key) { cs(30); await di(q.answer_image_key) }
        y -= 8
    }

    return await doc.save()
}

app.post('/past-papers/batch/export-pdf', async (c) => {
    const user = await getUser(c)
    if (!user) return c.redirect(loginRedirect(c))

    const body = await c.req.parseBody({ all: true })
    let questionIdsRaw = body['question_ids']
    if (!questionIdsRaw) return c.text('No questions selected', 400)

    let questionIds: string[] = []
    if (Array.isArray(questionIdsRaw)) {
        questionIds = (questionIdsRaw as string[]).map(String)
    } else {
        questionIds = [String(questionIdsRaw)]
    }
    questionIds = [...new Set(questionIds)]

    const placeholders = questionIds.map(() => '?').join(',')
    const questions = await c.env.DB.prepare(`
        SELECT q.*, p.subject, p.school_name, p.academic_year
        FROM exam_questions q
        JOIN papers p ON q.paper_id = p.id
        WHERE q.id IN (${placeholders}) AND q.is_deleted = 0
        ORDER BY q.ordering_index ASC
    `).bind(...questionIds).all()

    if (questions.results.length === 0) return c.text('No questions found', 404)

    const pdfBytes = await generateExamPdf(questions.results, c.env.BUCKET)

    return new Response(pdfBytes, {
        headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'attachment; filename="practice-exam.pdf"'
        }
    })
})

export default app
