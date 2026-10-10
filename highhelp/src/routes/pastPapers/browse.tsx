import { Hono } from 'hono'
import { Layout } from '../../layout'
import { getUser, loginRedirect, parseTopicHierarchy, topicHierarchyKey } from '../../utils'
import { canUploadPastPaper, PermissionLevel } from '../../permissions'
import { SubjectSelector } from '../../components/SubjectSelector'
import { subjectLabel } from '../../constants'
import { Bindings } from '../../types'
import { PastPaperTabs } from './tabs'
import {
    PRACTICE_PAGE_SIZE,
    RawPracticeFilters,
    UNSORTED_SECTION_LABEL,
    buildPracticeCountQuery,
    buildPracticeExportUrl,
    buildPracticeListQuery,
    buildPracticeRowsUrl,
    buildPracticeSectionTypeQuery,
    buildReviewQueueQuery,
    groupBySection,
    readRawPracticeFilters,
    resolvePracticeFilters
} from './practiceQuery'
import {
    EXPORT_ROW_LIMIT,
    PracticeExportRow,
    buildPracticeExport,
    buildPracticeExportQueries,
    exportFilename
} from './practiceExport'
import { drawingObjectKey, type DrawingContext } from './drawingDoc'
import { renderStatisticsTab } from './stats'
const app = new Hono<{ Bindings: Bindings }>()

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

// "Sydney Boys High School" -> "SBHS"; single-word names are left as-is
const abbreviateSchool = (name: string) => {
    const words = (name || '').trim().split(/\s+/).filter(Boolean);
    if (words.length <= 1) return name;
    return words.map(w => w.charAt(0).toUpperCase()).join('');
};

type PracticeRow = {
    id: number
    paper_id: number
    section_label: string
    segment_label: string | null
    question_number: string
    question_type: string | null
    marks: number | null
    question_text: string | null
    question_image_key: string | null
    ordering_index: number | null
    school_name: string
    academic_year: number
    is_completed: number | null
    marks_awarded: number | null
}

type McqContent = { stem: string; options: Record<string, string> | null }

const groupPracticeRows = (rows: PracticeRow[]) => groupBySection(rows);

const renderPracticeRow = (row: PracticeRow, parsed: McqContent, practiceQueryString: string, mode: string | undefined, hasMcq: boolean) => {
    const attemptUrl = `/past-papers/attempt/${row.id}?${practiceQueryString}`;
    const isIncomplete = !row.marks || (!row.question_image_key && !row.question_text);
    const clickAction = mode === 'select'
        ? `const cb = document.querySelector('input[name="question_ids"][value="${row.id}"]'); if (cb) { cb.checked = !cb.checked; cb.dispatchEvent(new Event('change', { bubbles: true })); }`
        : `window.location.href=${JSON.stringify(attemptUrl)}`;

    return (
        <tr data-question-id={row.id} onclick={clickAction}
            class={`practice-row border-b border-gray-100 dark:border-neutral-800 align-top cursor-pointer transition-colors ${isIncomplete ? 'opacity-60' : 'hover:bg-blue-50 dark:hover:bg-neutral-800/60'}`}>
            {mode === 'select' && (
                <td class="py-2.5 pr-2" onclick="event.stopPropagation()">
                    <input type="checkbox" name="question_ids" value={row.id} class="rounded border-gray-300 w-4 h-4 text-blue-600 focus:ring-blue-500" />
                </td>
            )}
            <td class="py-2.5 pr-3 whitespace-nowrap font-medium text-gray-900 dark:text-white" title={row.school_name}>{abbreviateSchool(row.school_name)}</td>
            <td class="py-2.5 pr-3 whitespace-nowrap text-gray-600 dark:text-neutral-400">{row.academic_year}</td>
            <td class="py-2.5 pr-3 whitespace-nowrap font-mono text-xs text-gray-500 dark:text-neutral-400">
                {row.is_completed ? <span class="text-green-600 dark:text-green-400 mr-1" title="Completed">✓</span> : null}{row.question_number}
            </td>
            <td class="py-2.5 pr-3 max-w-2xl text-gray-800 dark:text-neutral-200 leading-snug">
                {parsed.options || row.question_type === 'multiple_choice' ? (
                    parsed.stem || <span class="italic text-gray-400 dark:text-neutral-500">(see paper image)</span>
                ) : row.question_text ? (
                    <span class="whitespace-pre-wrap">{row.question_text}</span>
                ) : row.question_image_key ? (
                    <a href={attemptUrl} onclick="event.stopPropagation()" class="italic text-blue-600 dark:text-blue-400 hover:underline">[image question]</a>
                ) : (
                    <span class="italic text-gray-400 dark:text-neutral-500">—</span>
                )}
            </td>
            {hasMcq && ['A', 'B', 'C', 'D'].map(label => (
                <td class="py-2.5 pr-3 text-gray-600 dark:text-neutral-300">{parsed.options?.[label] || ''}</td>
            ))}
            <td class="py-2.5 pr-2 text-right font-bold text-gray-700 dark:text-neutral-200">{row.marks || '?'}</td>
        </tr>
    );
};

const renderPracticeSections = (rows: PracticeRow[], practiceQueryString: string, mode: string | undefined, mcqSections?: Set<string>) => {
    if (rows.length === 0) {
        return <div class="text-center py-12 text-gray-500">No questions found matching your filters.</div>;
    }

    return groupPracticeRows(rows).map(([sectionKey, sectionRows]) => {
        const parsedRows = sectionRows.map(row => ({ row, parsed: parseMcqOptions(row.question_text) }));
        const hasMcq = mcqSections
            ? mcqSections.has(sectionKey)
            : parsedRows.some(item => item.row.question_type === 'multiple_choice' || !!item.parsed.options);

        return (
            <section data-practice-section={sectionKey} class="mb-12">
                <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-3 pb-2 border-b border-gray-200 dark:border-neutral-700">{sectionKey}</h2>
                <div class="overflow-x-auto practice-table">
                    <table class="w-full min-w-[760px] text-sm">
                        <thead>
                            <tr class="text-left text-[11px] uppercase tracking-wider text-gray-500 dark:text-neutral-400 border-b-2 border-gray-200 dark:border-neutral-700">
                                {mode === 'select' && <th class="py-2 pr-2 w-8"></th>}
                                <th class="py-2 pr-3 font-bold">Paper</th>
                                <th class="py-2 pr-3 font-bold">Year</th>
                                <th class="py-2 pr-3 font-bold">#</th>
                                <th class="py-2 pr-3 font-bold">Question</th>
                                {hasMcq && ['A', 'B', 'C', 'D'].map(label => (<th class="py-2 pr-3 font-bold min-w-[7rem]">{label}</th>))}
                                <th class="py-2 pr-2 font-bold text-right">Marks</th>
                            </tr>
                        </thead>
                        <tbody>
                            {parsedRows.map(item => renderPracticeRow(item.row, item.parsed, practiceQueryString, mode, hasMcq))}
                        </tbody>
                    </table>
                </div>
            </section>
        );
    });
};

type ReviewRow = {
    id: number
    section_label: string | null
    question_number: string | null
    question_type: string | null
    marks: number | null
    question_text: string | null
    question_image_key: string | null
    school_name: string
    academic_year: number
    original_marks: number | null
    review_marks: number | null
    review_completed: number | null
    original_notes: string | null
    review_notes: string | null
}

const REVIEW_ATTEMPT_URL = (id: number) => `/past-papers/attempt/${id}?mode=review&source=review`

// The review queue is presented as the same section-grouped table as Practice Questions, so a student
// scanning for a question recognises the columns. The marks cell shows the original score that put the
// question in the queue, and adds the review score once one exists — the queue is keyed off the
// original attempt, so hiding it would lose the reason the row is listed at all.
const renderReviewRow = (row: ReviewRow) => {
    const attemptUrl = REVIEW_ATTEMPT_URL(row.id);
    const parsed = parseMcqOptions(row.question_text);
    const max = row.marks;
    const isReviewComplete = !!row.review_completed || (row.review_marks != null && row.review_marks === max);
    const hasReview = row.review_marks != null;
    const notes = row.review_notes || row.original_notes || '';
    const marksTone = (value: number | null) =>
        value != null && max != null && value >= max
            ? 'text-green-600 dark:text-green-400'
            : 'text-red-600 dark:text-red-400';

    return (
        <tr onclick={`window.location.href=${JSON.stringify(attemptUrl)}`}
            class="review-row border-b border-gray-100 dark:border-neutral-800 align-top cursor-pointer transition-colors hover:bg-blue-50 dark:hover:bg-neutral-800/60">
            <td class="py-2.5 pr-3 whitespace-nowrap font-medium text-gray-900 dark:text-white" title={row.school_name}>{abbreviateSchool(row.school_name)}</td>
            <td class="py-2.5 pr-3 whitespace-nowrap text-gray-600 dark:text-neutral-400">{row.academic_year}</td>
            <td class="py-2.5 pr-3 whitespace-nowrap font-mono text-xs text-gray-500 dark:text-neutral-400" title={isReviewComplete ? 'Review completed' : 'To review'}>
                {isReviewComplete && <span class="text-green-600 dark:text-green-400 mr-1">✓</span>}
                {row.question_number || '?'}
            </td>
            <td class="py-2.5 pr-3 text-gray-800 dark:text-neutral-200 leading-snug">
                {parsed.options || row.question_type === 'multiple_choice' ? (
                    parsed.stem || <span class="italic text-gray-400 dark:text-neutral-500">(see paper image)</span>
                ) : row.question_text ? (
                    <span class="whitespace-pre-wrap">{row.question_text}</span>
                ) : row.question_image_key ? (
                    <span class="italic text-blue-600 dark:text-blue-400">[image question]</span>
                ) : (
                    <span class="italic text-gray-400 dark:text-neutral-500">—</span>
                )}
            </td>
            <td class="py-2.5 pr-3 whitespace-nowrap text-right">
                <span class={`font-bold ${marksTone(row.original_marks)}`}>{row.original_marks ?? 0}/{max ?? '?'}</span>
                {hasReview && (
                    <div class="text-[11px] text-gray-500 dark:text-neutral-400">
                        review <span class={`font-bold ${marksTone(row.review_marks)}`}>{row.review_marks}/{max ?? '?'}</span>
                    </div>
                )}
            </td>
            <td class="py-2.5 pr-2 text-sm text-gray-600 dark:text-neutral-300" title={notes}>
                {notes
                    ? <span class="line-clamp-2 whitespace-pre-wrap">{notes}</span>
                    : <span class="italic text-gray-400 dark:text-neutral-500">—</span>}
            </td>
        </tr>
    );
};

const renderReviewSections = (rows: ReviewRow[]) => {
    if (rows.length === 0) {
        return (
            <div class="text-center py-12 text-gray-500 dark:text-neutral-400 bg-gray-50 dark:bg-neutral-800 rounded-lg border border-dashed border-gray-300 dark:border-neutral-700">
                Great work! You have no questions to review.
            </div>
        );
    }

    return groupBySection(rows).map(([sectionKey, sectionRows]) => (
        <section data-review-section={sectionKey} class="mb-12">
            <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-3 pb-2 border-b border-gray-200 dark:border-neutral-700">{sectionKey}</h2>
            <div class="overflow-x-auto review-table">
                {/* table-fixed so the colgroup is authoritative: `max-w` on a <td> is ignored by the
                    auto table layout, which would have let the freed space leak into Paper/Year/#. */}
                <table class="w-full min-w-[960px] table-fixed text-sm">
                    <colgroup>
                        <col class="w-[5%]" />
                        <col class="w-[6%]" />
                        <col class="w-[5%]" />
                        <col class="w-[55%]" />
                        <col class="w-[5%]" />
                        <col class="w-[22%]" />
                    </colgroup>
                    <thead>
                        <tr class="text-left text-[11px] uppercase tracking-wider text-gray-500 dark:text-neutral-400 border-b-2 border-gray-200 dark:border-neutral-700">
                            <th class="py-2 pr-3 font-bold">Paper</th>
                            <th class="py-2 pr-3 font-bold">Year</th>
                            <th class="py-2 pr-3 font-bold">#</th>
                            <th class="py-2 pr-3 font-bold">Question</th>
                            <th class="py-2 pr-3 font-bold text-right">Marks</th>
                            <th class="py-2 pr-2 font-bold">Notes</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sectionRows.map(row => renderReviewRow(row))}
                    </tbody>
                </table>
            </div>
        </section>
    ));
};

const buildPracticeQueryString = (raw: RawPracticeFilters, mode: string | undefined) => {
    const params = new URLSearchParams({ source: 'practice' });
    const values: Record<string, string> = {
        school: raw.school,
        topic: raw.topic,
        topic_group: raw.topicGroup,
        year: raw.year,
        section: raw.section,
        type: raw.type,
        status: raw.status,
        marks_min: raw.marksMin,
        marks_max: raw.marksMax,
        sort: raw.sort,
        q: raw.search
    };
    if (mode) params.set('mode', mode);
    Object.entries(values).forEach(([key, value]) => {
        if (value) params.set(key, value);
    });
    return params.toString();
};

app.get('/past-papers/rows', async (c) => {
    const user = await getUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const subject = subjectLabel(c.req.query('subject') || '');
    if (!subject) return c.json({ error: 'Unknown subject' }, 400);

    const raw = readRawPracticeFilters(key => c.req.query(key));
    const filters = await resolvePracticeFilters(c.env.DB, subject, raw);
    const mode = c.req.query('mode') || undefined;
    const requestedOffset = parseInt(c.req.query('offset') || '0', 10);
    const offset = Number.isFinite(requestedOffset) && requestedOffset > 0 ? requestedOffset : 0;

    const list = buildPracticeListQuery(user.id, subject, filters, PRACTICE_PAGE_SIZE + 1, offset);
    const sectionTypes = buildPracticeSectionTypeQuery(user.id, subject, filters);
    const [listResult, sectionResult] = await c.env.DB.batch([
        c.env.DB.prepare(list.sql).bind(...list.params),
        c.env.DB.prepare(sectionTypes.sql).bind(...sectionTypes.params)
    ]);
    const mcqSections = new Set(
        (sectionResult.results as { section_label: string; has_mcq: number }[])
            .filter(row => row.has_mcq)
            .map(row => (row.section_label || '').trim() || 'Unsorted')
    );
    const rows = (listResult.results as any[]).slice(0, PRACTICE_PAGE_SIZE);
    const html = String(renderPracticeSections(rows as PracticeRow[], buildPracticeQueryString(raw, mode), mode, mcqSections));

    return c.json({
        html,
        hasMore: listResult.results.length > PRACTICE_PAGE_SIZE,
        nextOffset: offset + rows.length
    });
});

app.get('/past-papers/export-json', async (c) => {
    const user = await getUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const subject = c.req.query('subject') || '';
    if (!subject) return c.json({ error: 'Unknown subject' }, 400);

    const raw = readRawPracticeFilters(key => c.req.query(key));
    const filters = await resolvePracticeFilters(c.env.DB, subject, raw);
    // ?q= arrives through the filters (raw.search), like on the list page.
    const { list, count } = buildPracticeExportQueries(user.id, subject, filters);
    const [listResult, countResult] = await c.env.DB.batch([
        c.env.DB.prepare(list.sql).bind(...list.params),
        c.env.DB.prepare(count.sql).bind(...count.params)
    ]);

    const rows = (listResult.results as PracticeExportRow[]) || [];
    const totalMatching = Number((countResult.results[0] as { total: number } | undefined)?.total || 0);
    const exportedAt = new Date().toISOString();
    const payload = buildPracticeExport(subject, rows, { rawFilters: raw, exportedAt, totalMatching });

    return new Response(JSON.stringify(payload, null, 2), {
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Content-Disposition': `attachment; filename="${exportFilename(subject, exportedAt)}"`
        }
    });
});

app.get('/past-papers', async (c) => {
    const user = await getUser(c)
    if (!user) return c.redirect(loginRedirect(c))

    const subject = c.req.query('subject')
    const tab = c.req.query('tab') || 'browse';


    if (!subject) {
        return c.html(
            <Layout title="Past Papers" user={user}>
                <div class="mx-auto space-y-12">
                    <section>
                        <h1 class="text-3xl font-bold mb-6 dark:text-white">Past Paper by Topic</h1>
                        <p class="text-gray-600 dark:text-neutral-400 mb-8">Select a subject.</p>
                        <SubjectSelector baseUrl="/past-papers" type="standard" />
                        <br></br>
                        <br></br>
                        <br></br>
                        <br></br>
                        <br></br>
                        <p class="text-gray-600 dark:text-neutral-400 mb-8">Note: If your subject isn't listed here, it's for one of a few reasons: 1) it's not practical to include, e.g. Geography, where a significant syllabus change means older past papers aren't very valuable; 2) it's not really necessary, e.g. English Extension; or 3) too few people would benefit from it relative to the effort of maintaining it, e.g. language extensions, where the cost of importing and upkeeping papers grows with each addition. That said, if you really want a subject added, feel free to contact me and I'll see what I can do. </p>
                        
                        <p class="text-gray-600 dark:text-neutral-400 mb-8">Also, papers listed during my prelim year (ie: 2U maths + business studies + all Y11 subjects) might be less structured/detailed in terms of syllabus. Please use Mr. Jackson's Bizzy for business studies.</p>
                    </section>
                </div>
            </Layout>
        )
    }


    const canUpload = user && canUploadPastPaper(user, subject);

    let content;

    if (tab === 'browse') {
        const topicCounts = await c.env.DB.prepare(`
            SELECT t.id, t.name, COUNT(DISTINCT q.id) AS question_count,
                   COUNT(DISTINCT CASE WHEN ua.is_completed = 1 THEN q.id END) AS completed_count
            FROM topics t
            JOIN question_topics qt ON qt.topic_id = t.id
            JOIN exam_questions q ON q.id = qt.question_id AND q.is_deleted = 0
            JOIN papers p ON p.id = q.paper_id
            LEFT JOIN user_question_attempts ua ON q.id = ua.question_id AND ua.user_id = ?
            WHERE p.subject = ? AND t.subject = p.subject
            GROUP BY t.id, t.name
            ORDER BY t.name COLLATE NOCASE
        `).bind(user.id, subject).all();

        const topicMap = new Map<string, any>();
        for (const topic of topicCounts.results as any[]) {
            const hierarchy = parseTopicHierarchy(topic.name);
            if (!hierarchy.topic) continue;

            const key = topicHierarchyKey(hierarchy.topic);
            const group = topicMap.get(key) || { name: hierarchy.topic, questionCount: 0, completedCount: 0, topicIds: [], subtopics: [] };
            const questionCount = Number(topic.question_count) || 0;
            const completedCount = Number(topic.completed_count) || 0;
            group.completedCount += completedCount;
            group.topicIds.push(topic.id);
            if (hierarchy.subtopic) group.subtopics.push({ id: topic.id, name: hierarchy.subtopic, questionCount, completedCount });
            topicMap.set(key, group);
        }

        const topicGroups = Array.from(topicMap.values()).sort((a, b) => a.name.localeCompare(b.name));
        for (const group of topicGroups) {
            group.subtopics.sort((a: any, b: any) => a.name.localeCompare(b.name));
        }

        const topicHierarchy = JSON.stringify(topicGroups.flatMap(group => group.topicIds.map((id: number) => ({ topic: group.name, id }))));
        const [papers, topicTotals] = await c.env.DB.batch([
            c.env.DB.prepare(`
                SELECT p.id, p.school_name, p.academic_year, p.paper_type, p.is_locked,
                       count(q.id) as question_count,
                       COALESCE(SUM(CASE WHEN ua.is_completed = 1 THEN 1 ELSE 0 END), 0) as completed_count
                FROM papers p
                LEFT JOIN exam_questions q ON p.id = q.paper_id AND q.is_deleted = 0
                LEFT JOIN user_question_attempts ua ON q.id = ua.question_id AND ua.user_id = ?
                WHERE p.subject = ?
                GROUP BY p.id
                ORDER BY p.school_name ASC, p.academic_year DESC, p.created_at DESC
            `).bind(user.id, subject),
            c.env.DB.prepare(`
                WITH topic_hierarchy AS (
                    SELECT json_extract(value, '$.topic') AS topic,
                           CAST(json_extract(value, '$.id') AS INTEGER) AS topic_id
                    FROM json_each(?)
                )
                SELECT th.topic, COUNT(DISTINCT q.id) AS question_count,
                       COUNT(DISTINCT CASE WHEN ua.is_completed = 1 THEN q.id END) AS completed_count
                FROM topic_hierarchy th
                JOIN question_topics qt ON qt.topic_id = th.topic_id
                JOIN exam_questions q ON q.id = qt.question_id AND q.is_deleted = 0
                JOIN papers p ON p.id = q.paper_id
                JOIN topics t ON t.id = th.topic_id AND t.subject = p.subject
                LEFT JOIN user_question_attempts ua ON q.id = ua.question_id AND ua.user_id = ?
                WHERE p.subject = ?
                GROUP BY th.topic
            `).bind(topicHierarchy, user.id, subject)
        ]);

        // A question tagged with both a topic and one of its subtopics appears twice in the hierarchy
        // join, so the group totals come from this deduped query rather than the per-topic rows.
        const totalsByTopic = new Map(
            (topicTotals.results as any[]).map(row => [
                topicHierarchyKey(row.topic),
                { questionCount: Number(row.question_count) || 0, completedCount: Number(row.completed_count) || 0 }
            ])
        );
        for (const group of topicGroups) {
            const totals = totalsByTopic.get(topicHierarchyKey(group.name));
            group.questionCount = totals?.questionCount || 0;
            group.completedCount = totals?.completedCount || 0;
        }

        // Group papers by school name; each school's papers are already ordered by year DESC
        const schoolMap = new Map<string, any[]>();
        for (const p of papers.results as any[]) {
            const key = (p.school_name || 'Unknown School').trim();
            if (!schoolMap.has(key)) schoolMap.set(key, []);
            schoolMap.get(key)!.push(p);
        }

        const schoolKeys = Array.from(schoolMap.keys()).sort((a, b) => {
            // 1) HSC first
            if (/^hsc$/i.test(a)) return -1;
            if (/^hsc$/i.test(b)) return 1;
            // 2) Sydney Boys High School second
            if (/sydney boys high/i.test(a)) return -1;
            if (/sydney boys high/i.test(b)) return 1;
            // 3) Everything else, ordered by number of papers (descending)
            const countDiff = (schoolMap.get(b)!.length) - (schoolMap.get(a)!.length);
            if (countDiff !== 0) return countDiff;
            return a.localeCompare(b);
        });

        content = (
            <div>
                <div class="flex items-center justify-between mb-6">
                    <h1 class="text-3xl font-bold dark:text-white">{subjectLabel(subject)}</h1>
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

                {papers.results.length === 0 ? (
                    <div class="text-center py-12 text-gray-500 dark:text-neutral-400 bg-gray-50 dark:bg-neutral-800 rounded-lg border border-dashed border-gray-300 dark:border-neutral-700">
                        No papers found for {subjectLabel(subject)}.
                    </div>
                ) : (
                    <div class="space-y-10">
                        {topicGroups.map((group) => (
                            <section key={group.name}>
                                <div class="flex items-center justify-between mb-4">
                                    <h2 class="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                        <a href={`/past-papers?subject=${encodeURIComponent(subject)}&tab=practice&topic_group=${encodeURIComponent(group.name)}`} title="Practice questions from this topic" class="flex items-center gap-2 hover:text-blue-700 dark:hover:text-blue-400 transition-colors">
                                            {group.name}
                                            <svg class="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                                        </a>
                                        <span class="ml-1 text-sm font-medium text-gray-500 dark:text-neutral-400">
                                            {group.questionCount} question{group.questionCount === 1 ? '' : 's'}
                                            {group.completedCount > 1 && (
                                            <>
                                                <span class="text-gray-300 dark:text-neutral-600"> · </span>
                                                <span class="font-bold text-gray-800 dark:text-neutral-200">{group.completedCount}</span> completed
                                            </>
                                        )}
                                        </span>
                                    </h2>
                                </div>
                                {group.subtopics.length > 0 && (
                                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {group.subtopics.map((subtopic: any) => (
                                            <a href={`/past-papers?subject=${encodeURIComponent(subject)}&tab=practice&topic=${encodeURIComponent(String(subtopic.id))}`} class="block bg-white dark:bg-neutral-800 p-4 rounded border border-gray-300 dark:border-neutral-700 hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-neutral-700 transition-colors group">
                                                <h3 class="text-lg font-bold text-gray-900 dark:text-white group-hover:text-blue-700 dark:group-hover:text-blue-400 leading-snug">
                                                    {subtopic.name}
                                                </h3>
                                                <div class="flex items-center justify-between gap-3 mt-3 text-xs text-gray-500 dark:text-neutral-400 font-mono border-t border-gray-100 dark:border-neutral-700 pt-2">
                                                    <span>{subtopic.questionCount} question{subtopic.questionCount === 1 ? '' : 's'}</span>
                                                    {subtopic.completedCount > 1 && (
                                                        <span class="text-gray-700 dark:text-neutral-300">
                                                            <span class="font-bold text-gray-800 dark:text-neutral-200">{subtopic.completedCount}</span> completed
                                                        </span>
                                                    )}
                                                </div>
                                            </a>
                                        ))}
                                    </div>
                                )}
                            </section>
                        ))}

                        {schoolKeys.map((school) => {
                            const schoolPapers = schoolMap.get(school)!;
                            const catTotal = schoolPapers.reduce((s: number, p: any) => s + (Number(p.question_count) || 0), 0);
                            const catCompleted = schoolPapers.reduce((s: number, p: any) => s + (Number(p.completed_count) || 0), 0);

                            return (
                                <section key={school}>
                                    <div class="flex items-center justify-between mb-4">
                                        <h2 class="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                            {school}
                                            <a href={`/past-papers?subject=${encodeURIComponent(subject)}&tab=practice&school=${encodeURIComponent(school)}`} title="Practice questions from this school" class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors shrink-0">
                                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                                            </a>
                                            <span class="ml-1 text-sm font-medium text-gray-500 dark:text-neutral-400">
                                                <span class="font-bold text-gray-800 dark:text-neutral-200">{catCompleted}</span> / {catTotal} done!
                                            </span>
                                        </h2>
                                    </div>
                                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {schoolPapers.map((p: any) => {
                                            const totQ = Number(p.question_count) || 0;
                                            const doneQ = Number(p.completed_count) || 0;
                                            return (
                                                <div class="search-item block bg-white dark:bg-neutral-800 p-4 rounded border border-gray-300 dark:border-neutral-700 hover:border-blue-500 dark:hover:border-blue-400 transition-colors group cursor-pointer" onclick={`window.location.href='/past-papers/paper/${p.id}'`} data-search-text={`${p.school_name} ${p.academic_year} ${subject}`}>
                                                    <h3 class="text-lg font-bold text-gray-900 dark:text-white group-hover:text-blue-700 dark:group-hover:text-blue-400 leading-snug">
                                                        {p.paper_type || 'Trial Paper'}
                                                        {p.is_locked ? <span class="ml-2 text-xs font-bold text-gray-500 dark:text-neutral-400">✅ Checked</span> : null}
                                                    </h3>

                                                    <div class="flex flex-wrap items-center gap-x-2 text-xs text-gray-500 dark:text-neutral-400 mt-1">
                                                        <span class="font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wide">{p.academic_year}</span>
                                                        <span class="text-gray-300 dark:text-neutral-600">•</span>
                                                        <span class="text-gray-600 dark:text-neutral-300">{totQ} Qs</span>
                                                    </div>

                                                    <div class="flex items-center justify-between gap-3 mt-3 text-xs text-gray-500 dark:text-neutral-400 font-mono border-t border-gray-100 dark:border-neutral-700 pt-2">
                                                        <span>
                                                            <span class="font-bold text-gray-800 dark:text-neutral-200">{doneQ}/{totQ}</span> questions
                                                        </span>
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
                                            );
                                        })}
                                    </div>
                                </section>
                            );
                        })}
                    </div>
                )}
            </div>
        );

    } else if (tab === 'practice') {
        const rawFilters = readRawPracticeFilters(key => c.req.query(key));
        const filters = await resolvePracticeFilters(c.env.DB, subject, rawFilters);
        const mode = c.req.query('mode');
        const filterTopic = rawFilters.topic;
        const filterTopicGroup = rawFilters.topicGroup;
        const filterTopicId = filters.topicId;
        const filterTopicLabel = filters.topicLabel;
        const filterSchool = rawFilters.school;
        const filterYear = rawFilters.year;
        const filterStatus = rawFilters.status;
        const filterType = rawFilters.type;
        const filterSection = rawFilters.section;
        const filterMarksMin = rawFilters.marksMin;
        const filterMarksMax = rawFilters.marksMax;
        const sort = rawFilters.sort;
        const search = rawFilters.search;
        const practiceQueryString = buildPracticeQueryString(rawFilters, mode);

        const listQuery = buildPracticeListQuery(user.id, subject, filters, PRACTICE_PAGE_SIZE + 1, 0);
        const countQuery = buildPracticeCountQuery(user.id, subject, filters);
        const sectionTypesQuery = buildPracticeSectionTypeQuery(user.id, subject, filters);
        const [questions, countResult, sectionTypesResult, allTopics, sections, schoolsResult] = await c.env.DB.batch([
            c.env.DB.prepare(listQuery.sql).bind(...listQuery.params),
            c.env.DB.prepare(countQuery.sql).bind(...countQuery.params),
            c.env.DB.prepare(sectionTypesQuery.sql).bind(...sectionTypesQuery.params),
            c.env.DB.prepare('SELECT id, name FROM topics WHERE subject = ? ORDER BY name ASC').bind(subject),
            c.env.DB.prepare('SELECT DISTINCT q.section_label FROM exam_questions q JOIN papers p ON q.paper_id = p.id WHERE p.subject = ? AND q.is_deleted = 0 ORDER BY q.section_label ASC').bind(subject),
            c.env.DB.prepare('SELECT DISTINCT school_name FROM papers WHERE subject = ? ORDER BY school_name ASC').bind(subject)
        ]);

        const mcqSections = new Set(
            (sectionTypesResult.results as { section_label: string; has_mcq: number }[])
                .filter(row => row.has_mcq)
                .map(row => (row.section_label || '').trim() || UNSORTED_SECTION_LABEL)
        );
        const practiceRows = (questions.results as PracticeRow[]).slice(0, PRACTICE_PAGE_SIZE);
        const totalQuestions = Number((countResult.results[0] as { total: number })?.total || 0);
        const hasMore = questions.results.length > PRACTICE_PAGE_SIZE;
        const nextOffset = practiceRows.length;

        content = (
            <div>
                <h1 class="text-3xl font-bold mb-6 dark:text-white">Practice Questions</h1>

                {/* Flat appendable filter bar */}
                <div class="flex flex-wrap items-center gap-x-4 gap-y-2 mb-6 text-sm">
                    <div class="relative w-full md:flex-[2] md:min-w-[16rem] md:max-w-md">
                        <input type="text" id="practice-search" value={search} placeholder="Search all questions…  (⏎ apply)" class="w-full pl-8 pr-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm" />
                        <svg class="w-4 h-4 text-gray-400 absolute left-2.5 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                    </div>

                    {([
                        ['search', search],
                        ['school', filterSchool],
                        ['topic', filterTopicLabel],
                        ['topic group', filterTopicGroup],
                        ['year', filterYear],
                        ['section', filterSection],
                        ['type', filterType && ({ 'multiple_choice': 'MCQ', 'short_answer': 'Short answer', 'extended_response': 'Extended' } as any)[filterType] || filterType],
                        ['status', filterStatus === 'done' ? 'Completed' : filterStatus === 'undone' ? 'Unattempted' : ''],
                        ['marks ≥', filterMarksMin],
                        ['marks ≤', filterMarksMax]
                    ] as Array<[string, string]>).filter(([, v]) => v).map(([k, v]) => {
                        const removeKey = k === 'search' ? 'q' : k === 'topic group' ? 'topic_group' : k.startsWith('marks') ? (k.endsWith('≥') ? 'marks_min' : 'marks_max') : k;
                        const chipUrl = (() => {
                            const p = new URLSearchParams();
                            p.set('subject', subject); p.set('tab', 'practice');
                            if (mode) p.set('mode', mode);
                            const vals: Record<string, string> = {
                                school: filterSchool || '', topic: filterTopic || '', topic_group: filterTopicGroup || '', year: filterYear || '',
                                section: filterSection || '', type: filterType || '', status: filterStatus || '',
                                marks_min: filterMarksMin || '', marks_max: filterMarksMax || '', q: search || ''
                            };
                            delete vals[removeKey];
                            if (sort) p.set('sort', sort);
                            Object.entries(vals).forEach(([kk, vv]) => { if (vv) p.set(kk, vv); });
                            return `/past-papers?${p.toString()}`;
                        })();
                        return (
                            <a href={chipUrl} class="group inline-flex items-center gap-1.5 py-0.5 border-b border-gray-300 dark:border-neutral-600 hover:border-red-400 dark:hover:border-red-500 transition-colors" title="Click to remove this filter">
                                <span class="text-xs text-gray-400 dark:text-neutral-500">{k}:</span>
                                <span class="font-medium text-gray-800 dark:text-neutral-200">{v}</span>
                                <span class="text-gray-300 dark:text-neutral-600 group-hover:text-red-500 transition-colors">✕</span>
                            </a>
                        );
                    })}

                    {/* Append-a-filter control */}
                    <span id="af-wrap" class="hidden items-center gap-3 flex-1 min-w-[16rem] max-w-sm">
                        <select id="af-field" class="bg-transparent border-b border-gray-300 dark:border-neutral-600 focus:outline-none focus:border-blue-500 dark:bg-transparent dark:text-white py-0.5 pr-1 text-sm shrink-0">
                            
                            <option value="topic">topic</option>
                            <option value="school">school</option>
                            <option value="year">year</option>
                            <option value="section">section</option>
                            <option value="type">type</option>
                            <option value="status">status</option>
                            <option value="marks_min">marks min</option>
                            <option value="marks_max">marks max</option>
                        </select>
                        <input id="af-value" list="af-suggestions" autocomplete="off" placeholder="value…"
                            class="bg-transparent border-b border-gray-300 dark:border-neutral-600 focus:outline-none focus:border-blue-500 dark:text-white py-0.5 flex-1 min-w-0 w-full text-sm" />
                        <datalist id="af-suggestions"></datalist>
                        <button type="button" id="af-add" class="text-blue-600 dark:text-blue-400 font-bold hover:underline shrink-0">add</button>
                    </span>
                    <button type="button" id="af-toggle" class="text-blue-600 dark:text-blue-400 font-bold hover:underline">+ filter</button>

                    <span class="flex-grow"></span>

                    <label class="text-xs text-gray-400 dark:text-neutral-500 uppercase tracking-wide hidden sm:flex items-center gap-1.5">
                        <span id="search-count" class="text-gray-500 dark:text-neutral-400">
                            <span id="visible-count">{practiceRows.length}</span>/<span id="total-count">{totalQuestions}</span>
                        </span>
                    </label>

                    <label class="text-xs text-gray-400 dark:text-neutral-500 uppercase tracking-wide flex items-center gap-1.5">
                        Sort
                        <select id="af-sort" class="bg-transparent border-b border-gray-300 dark:border-neutral-600 focus:outline-none focus:border-blue-500 dark:bg-transparent dark:text-white py-0.5 pr-1 text-sm">
                            <option value="year_asc" selected={sort === 'year_asc'}>Year (Oldest first)</option>
                            <option value="year_desc" selected={sort === 'year_desc'}>Year (Newest first)</option>
                            <option value="question_asc" selected={sort === 'question_asc'}>Question # (Lowest first)</option>
                            <option value="question_desc" selected={sort === 'question_desc'}>Question # (Highest first)</option>
                        </select>
                    </label>
                    <a href={`/past-papers?subject=${encodeURIComponent(subject)}&tab=practice${mode ? '&mode=' + mode : ''}`} class="text-gray-500 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-neutral-200 hover:underline">reset</a>
                    <a href={`/past-papers/batch/view?source=practice&subject=${encodeURIComponent(subject)}&school=${encodeURIComponent(filterSchool || '')}&topic=${filterTopicId}&topic_group=${encodeURIComponent(filterTopicGroup || '')}&year=${encodeURIComponent(filterYear || '')}&status=${encodeURIComponent(filterStatus || '')}&sort=${encodeURIComponent(sort)}&type=${encodeURIComponent(filterType || '')}&section=${encodeURIComponent(filterSection || '')}&marks_min=${encodeURIComponent(filterMarksMin || '')}&marks_max=${encodeURIComponent(filterMarksMax || '')}${search ? `&q=${encodeURIComponent(search)}` : ''}`} class="text-emerald-600 dark:text-emerald-400 font-bold hover:underline">Batch Mode</a>
                    <a id="practice-export-json" href={buildPracticeExportUrl(subject, rawFilters)} title={`Download every question matching these filters as JSON, in the AI import format (up to ${EXPORT_ROW_LIMIT} questions)`} class="text-amber-600 dark:text-amber-400 font-bold hover:underline">Export JSON</a>
                </div>

                <script dangerouslySetInnerHTML={{ __html: `
                (function() {
                    var SUGGESTIONS = ${JSON.stringify({
                        school: schoolsResult.results.map((s: any) => s.school_name),
                        topic: allTopics.results.map((t: any) => t.name),
                        section: sections.results.map((s: any) => s.section_label).filter(Boolean),
                        type: ['multiple_choice', 'short_answer', 'extended_response'],
                        status: ['done', 'undone'],
                        year: [],
                        marks_min: [],
                        marks_max: []
                    }).replace(/</g, '\\u003c')};
                    var wrap = document.getElementById('af-wrap');
                    var toggle = document.getElementById('af-toggle');
                    var fieldSel = document.getElementById('af-field');
                    var valInput = document.getElementById('af-value');
                    var addBtn = document.getElementById('af-add');
                    var list = document.getElementById('af-suggestions');
                    var sortSel = document.getElementById('af-sort');
                    if (!wrap) return;

                    function updateSuggestions() {
                        list.innerHTML = '';
                        (SUGGESTIONS[fieldSel.value] || []).forEach(function(v) {
                            var o = document.createElement('option');
                            o.value = v;
                            list.appendChild(o);
                        });
                    }

                    function go() {
                        var p = new URLSearchParams(window.location.search);
                        p.set(fieldSel.value, valInput.value.trim());
                        window.location.href = '/past-papers?' + p.toString();
                    }

                    toggle.addEventListener('click', function() {
                        var isHidden = wrap.classList.toggle('hidden');
                        wrap.classList.toggle('inline-flex', !isHidden);
                        if (!isHidden) { updateSuggestions(); valInput.focus(); }
                        else valInput.value = '';
                    });
                    fieldSel.addEventListener('change', updateSuggestions);
                    addBtn.addEventListener('click', function() { if (valInput.value.trim()) go(); else valInput.focus(); });
                    valInput.addEventListener('keydown', function(e) {
                        if (e.key === 'Enter') { e.preventDefault(); if (valInput.value.trim()) go(); }
                    });

                    sortSel.addEventListener('change', function() {
                        var p = new URLSearchParams(window.location.search);
                        p.set('sort', sortSel.value);
                        window.location.href = '/past-papers?' + p.toString();
                    });
                })();
                `}} />



                {practiceRows.length === 0 ? (
                    <div class="text-center py-12 text-gray-500">No questions found matching your filters.</div>
                ) : (
                    <form action="/past-papers/mock-exams/create-manual" method="post" id="manual-exam-form">
                        <input type="hidden" name="subject" value={subject} />

                        <p class="text-sm text-gray-500 dark:text-neutral-400 mb-8">
                            Showing {practiceRows.length} of {totalQuestions} question{totalQuestions === 1 ? '' : 's'} across {groupPracticeRows(practiceRows).length} loaded section{groupPracticeRows(practiceRows).length === 1 ? '' : 's'}.
                        </p>

                        <div id="practice-sections">{renderPracticeSections(practiceRows, practiceQueryString, mode, mcqSections)}</div>

                        {mode === 'select' && (
                            <div class="fixed bottom-0 left-0 w-full bg-white dark:bg-neutral-900 border-t dark:border-neutral-800 p-4 flex justify-between items-center shadow-lg z-50">
                                <div class="container mx-auto flex justify-between items-center text-gray-900 dark:text-white">
                                    <div class="flex gap-4 items-center">
                                        <input type="text" name="exam_name" placeholder="Custom Exam Name" class="rounded border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm" />
                                        <div class="flex items-center gap-2">
                                            <input type="number" name="timer_minutes" placeholder="Timer (mins)" class="rounded border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm w-24" />
                                        </div>
                                    </div>
                                    <div class="flex gap-4 items-center">
                                        <span class="text-sm text-gray-600 dark:text-neutral-400"><span id="practice-selected-count">0</span> selected</span>
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

                {practiceRows.length > 0 && hasMore && (
                    <div class="flex flex-col items-center gap-2 my-10">
                        <button type="button" id="practice-load-more"
                            data-next-offset={nextOffset}
                            data-url={buildPracticeRowsUrl(subject, rawFilters, mode, 0)}
                            class="px-5 py-2.5 rounded-lg border border-blue-600 dark:border-blue-500 text-blue-600 dark:text-blue-400 font-bold hover:bg-blue-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                            Load 50 more
                        </button>
                        <span class="text-xs text-gray-400 dark:text-neutral-500">Showing {practiceRows.length} of {totalQuestions}</span>
                    </div>
                )}

                <script dangerouslySetInnerHTML={{ __html: `
                (function() {
                    var PAGE_SIZE = ${PRACTICE_PAGE_SIZE};
                    var searchInput = document.getElementById('practice-search');
                    var visibleCountEl = document.getElementById('visible-count');
                    var sections = document.getElementById('practice-sections');
                    var loadMoreBtn = document.getElementById('practice-load-more');
                    var loading = false;

                    // Search runs in SQL across the whole subject (?q=), like the other filters, so the
                    // count, "Load 50 more", Batch Mode and Export all see the same matching set.
                    if (searchInput) {
                        searchInput.addEventListener('keydown', function(e) {
                            if (e.key !== 'Enter') return;
                            e.preventDefault();
                            var p = new URLSearchParams(window.location.search);
                            var term = searchInput.value.trim();
                            if (term) p.set('q', term); else p.delete('q');
                            window.location.href = '/past-papers?' + p.toString();
                        });
                    }

                    function updateVisibleCount() {
                        if (visibleCountEl) visibleCountEl.textContent = document.querySelectorAll('.practice-row').length;
                    }

                    function appendSections(html) {
                        var template = document.createElement('template');
                        template.innerHTML = html;
                        var incoming = template.content.querySelectorAll('[data-practice-section]');
                        var added = [];
                        Array.prototype.forEach.call(incoming, function(newSection) {
                            var key = newSection.getAttribute('data-practice-section');
                            var existing = null;
                            Array.prototype.forEach.call(sections.querySelectorAll('[data-practice-section]'), function(candidate) {
                                if (candidate.getAttribute('data-practice-section') === key) existing = candidate;
                            });
                            if (existing) {
                                var body = existing.querySelector('tbody');
                                Array.prototype.forEach.call(newSection.querySelectorAll('tbody > tr'), function(tr) {
                                    body.appendChild(tr);
                                    added.push(tr);
                                });
                            } else {
                                sections.appendChild(newSection);
                                added.push(newSection);
                            }
                        });
                        // KaTeX only typesets the document once on load, so newly appended
                        // rows keep their raw delimiters until re-rendered here.
                        if (window.__highhelpRenderMath) {
                            added.forEach(function(node) { window.__highhelpRenderMath(node); });
                        }
                    }

                    if (loadMoreBtn && sections) {
                        loadMoreBtn.addEventListener('click', async function() {
                            if (loading) return;
                            loading = true;
                            var originalText = loadMoreBtn.textContent;
                            loadMoreBtn.disabled = true;
                            loadMoreBtn.textContent = 'Loading…';
                            try {
                                var url = new URL(loadMoreBtn.dataset.url, window.location.origin);
                                url.searchParams.set('offset', loadMoreBtn.dataset.nextOffset || '0');
                                var res = await fetch(url.toString(), { headers: { 'Accept': 'application/json' } });
                                if (!res.ok) throw new Error('request failed');
                                var data = await res.json();
                                if (data.html) appendSections(data.html);
                                if (typeof window.highhelpRestorePracticeSelection === 'function') window.highhelpRestorePracticeSelection();
                                updateVisibleCount();
                                if (data.hasMore) {
                                    loadMoreBtn.dataset.nextOffset = String(data.nextOffset);
                                    loadMoreBtn.disabled = false;
                                    loadMoreBtn.textContent = originalText;
                                } else {
                                    loadMoreBtn.remove();
                                }
                            } catch (err) {
                                loadMoreBtn.disabled = false;
                                loadMoreBtn.textContent = originalText;
                                console.error('Failed to load more questions', err);
                            } finally {
                                loading = false;
                            }
                        });
                    }
                })();
                `}} />

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
                                    updateCount();
                                }
                            }

                            function updateCount() {
                                var counter = document.getElementById('practice-selected-count');
                                if (counter) counter.textContent = loadFromLS().size;
                            }

                            function restore() {
                                var ids = loadFromLS();
                                form.querySelectorAll('input[name=question_ids]').forEach(function(cb) {
                                    cb.checked = ids.has(String(cb.value));
                                });
                                updateCount();
                            }

                            window.highhelpRestorePracticeSelection = restore;
                            restore();
                            form.addEventListener('change', persist);

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
        if (!user) return c.redirect(loginRedirect(c))

        const { sql, params } = buildReviewQueueQuery(user.id, subject);
        const questions = await c.env.DB.prepare(sql).bind(...params).all();

        content = (
            <div>
                <div class="flex items-center justify-between mb-6">
                    <h1 class="text-3xl font-bold dark:text-white">Review Queue</h1>
                    <a href={`/past-papers/batch/view?source=review&subject=${encodeURIComponent(subject)}&mode=review`} class="text-emerald-600 dark:text-emerald-400 font-bold text-sm hover:underline">Batch Review</a>
                </div>
                <p class="text-gray-600 dark:text-neutral-400 mb-8">Questions you didn't get full marks on, plus any you left a note on. Review and retry them to master the content.</p>

                {renderReviewSections(questions.results as unknown as ReviewRow[])}
            </div>
        );
    } else if (tab === 'stats') {
        content = await renderStatisticsTab(c.env.DB, user.id, subject, key => c.req.query(key));
    }

    return c.html(
        <Layout title={`Past Papers - ${subjectLabel(subject)}`} user={user} latex={true}>
            <div class="mx-auto">

                <div class="flex items-center gap-2 text-sm text-gray-500 dark:text-neutral-400 mb-4">
                    <a href="/past-papers" class="hover:underline">Past Papers</a>
                    <span class="text-gray-300 dark:text-neutral-600">/</span>
                    <span class="font-bold text-gray-700 dark:text-neutral-200">{subjectLabel(subject)}</span>
                </div>


                <PastPaperTabs subject={subject} activeTab={tab} />

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

    // Handwritten answers live in R2, so their keys have to be read before the rows go.
    const drawings = await c.env.DB.prepare(`SELECT user_id, question_id, context FROM answer_drawings WHERE question_id IN (${subquery})`)
        .bind(paperId)
        .all<{ user_id: number; question_id: number; context: DrawingContext }>();

    await c.env.DB.batch([
        c.env.DB.prepare(`DELETE FROM answer_drawings WHERE question_id IN (${subquery})`).bind(paperId),
        c.env.DB.prepare(`DELETE FROM user_question_attempts WHERE question_id IN (${subquery})`).bind(paperId),
        c.env.DB.prepare(`DELETE FROM user_review_attempts WHERE question_id IN (${subquery})`).bind(paperId),
        c.env.DB.prepare(`DELETE FROM mock_exam_questions WHERE question_id IN (${subquery})`).bind(paperId),
        c.env.DB.prepare(`DELETE FROM question_topics WHERE question_id IN (${subquery})`).bind(paperId),
        c.env.DB.prepare('DELETE FROM exam_questions WHERE paper_id = ?').bind(paperId),
        c.env.DB.prepare('DELETE FROM papers WHERE id = ?').bind(paperId)
    ]);

    // R2 takes at most 1000 keys per delete. Done after the response so a large paper doesn't hold up the redirect.
    const drawingKeys = drawings.results.map(row => drawingObjectKey(row.question_id, row.user_id, row.context));
    if (drawingKeys.length > 0) {
        c.executionCtx.waitUntil((async () => {
            for (let i = 0; i < drawingKeys.length; i += 1000) {
                await c.env.BUCKET.delete(drawingKeys.slice(i, i + 1000));
            }
        })());
    }

    return c.redirect(subject ? `/past-papers?subject=${encodeURIComponent(subject)}&tab=browse` : '/past-papers');
});

export default app

