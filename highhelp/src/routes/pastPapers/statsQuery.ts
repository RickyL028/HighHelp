import { parseTopicHierarchy, topicHierarchyKey } from '../../utils'
import { reviewQueuePredicate } from './practiceQuery'

// The Statistics tab only reads what the other past-paper tabs already record. As in
// practiceQuery.ts, the SQL builders are pure so the tests can run them against a seeded D1, and
// the summarising helpers below them take plain rows.

export type PaperKind = 'hsc' | 'trial' | 'other'

// A paper is an HSC paper when it was filed as the HSC examination, or under the "HSC" school the
// AI importer suggests for them (the Browse tab lists that school first).
const HSC_PAPER = `(p.paper_type = 'HSC Examination' OR LOWER(TRIM(p.school_name)) = 'hsc')`

const PAPER_KIND = `CASE
    WHEN ${HSC_PAPER} THEN 'hsc'
    WHEN COALESCE(p.paper_type, 'Trial Paper') = 'Trial Paper' THEN 'trial'
    ELSE 'other'
END`

// "Attempted" means an attempt row exists. `is_completed` can't be used: the attempt page sets it
// on any save, but batch mode only sets it for full marks, so it would drop every part-marked batch
// answer and inflate accuracy. The batch view's own header counts attempts the same way.
const ATTEMPTED = 'ua.question_id IS NOT NULL'

// The mark ceiling a question is scored against. An unmarked multiple-choice item is worth 1, the
// fallback batch mode uses; any other unmarked question has no ceiling, so it is left out of accuracy.
const MAX_MARKS = `(CASE WHEN q.marks > 0 THEN q.marks WHEN q.question_type = 'multiple_choice' THEN 1 END)`

const SCORED = `${ATTEMPTED} AND ${MAX_MARKS} IS NOT NULL`

// Self-marking is clamped to the ceiling, so a question re-weighted after it was marked can't push
// accuracy past 100%.
const EARNED = `MAX(0, MIN(COALESCE(ua.marks_awarded, 0), ${MAX_MARKS}))`

const PERSONAL_COLUMNS = `
    COUNT(*) AS questions,
    COUNT(ua.question_id) AS attempted,
    SUM(CASE WHEN ${SCORED} THEN ${MAX_MARKS} ELSE 0 END) AS marks_attempted,
    SUM(CASE WHEN ${SCORED} THEN ${EARNED} ELSE 0 END) AS marks_earned
`

// Topic names carry their own hierarchy ("Calculus 1.2 Differentiation" is a subtopic of
// "Calculus"), parsed in JS by parseTopicHierarchy, so the grouping reaches SQL as a JSON list of
// {id, g, s} entries: topic id, topic key and subtopic key (null for the topic itself). Every
// query below reports each topic once (sub = '') and each of its subtopics once. UNION rather than
// UNION ALL: a question tagged with a topic and its subtopic, or with several of its subtopics, is
// one question in that topic.
const QUESTION_GROUP_CTE = `
    WITH topic_group AS (
        SELECT CAST(json_extract(value, '$.id') AS INTEGER) AS topic_id,
               json_extract(value, '$.g') AS grp,
               json_extract(value, '$.s') AS sub
        FROM json_each(?)
    ),
    question_group AS (
        SELECT tg.grp, '' AS sub, qt.question_id
        FROM topic_group tg
        JOIN question_topics qt ON qt.topic_id = tg.topic_id
        UNION
        SELECT tg.grp, tg.sub, qt.question_id
        FROM topic_group tg
        JOIN question_topics qt ON qt.topic_id = tg.topic_id
        WHERE tg.sub IS NOT NULL
    )
`

export type Subtopic = {
    key: string
    name: string
    topicIds: number[]
}

export type TopicGroup = {
    key: string
    name: string
    topicIds: number[]
    subtopics: Subtopic[]
}

// A number in front of a subtopic ("1.2 Differentiation") is a syllabus code, so the same subtopic
// tagged with and without it ("Calculus - Differentiation") is one subtopic.
const subtopicKey = (label: string) => topicHierarchyKey(label.replace(/^\d+(?:\.\d+)*\s+/, '')) || topicHierarchyKey(label)

/**
 * Folds a subject's topics into the groups the Browse tab shows, each with its subtopics. Names that
 * differ only in case or spacing are one topic (or subtopic); the first name seen is the one shown.
 */
export function buildTopicGroups(topics: { id: number; name: string }[]): TopicGroup[] {
    const groups = new Map<string, TopicGroup>()
    for (const topic of topics) {
        const { topic: name, subtopic } = parseTopicHierarchy(topic.name || '')
        if (!name) continue
        const key = topicHierarchyKey(name)
        const group = groups.get(key) || { key, name, topicIds: [], subtopics: [] }
        const id = Number(topic.id)
        group.topicIds.push(id)
        if (subtopic) {
            const subKey = subtopicKey(subtopic)
            const existing = group.subtopics.find(entry => entry.key === subKey)
            if (existing) existing.topicIds.push(id)
            else group.subtopics.push({ key: subKey, name: subtopic, topicIds: [id] })
        }
        groups.set(key, group)
    }
    return Array.from(groups.values())
}

export const topicGroupsJson = (groups: TopicGroup[]) =>
    JSON.stringify(groups.flatMap(group => {
        const subtopicOf = new Map(group.subtopics.flatMap(subtopic => subtopic.topicIds.map(id => [id, subtopic.key] as const)))
        return group.topicIds.map(id => ({ id, g: group.key, s: subtopicOf.get(id) ?? null }))
    }))

export function buildTopicStatsQuery(userId: number, subject: string, groupsJson: string) {
    return {
        sql: `
            ${QUESTION_GROUP_CTE}
            SELECT qg.grp AS grp, qg.sub AS sub, ${PERSONAL_COLUMNS}
            FROM question_group qg
            JOIN exam_questions q ON q.id = qg.question_id AND q.is_deleted = 0
            JOIN papers p ON p.id = q.paper_id
            LEFT JOIN user_question_attempts ua ON ua.question_id = q.id AND ua.user_id = ?
            WHERE p.subject = ?
            GROUP BY qg.grp, qg.sub
        `,
        params: [groupsJson, userId, subject]
    }
}

/** Marks each paper gives each topic and subtopic: the raw material for exam weights and the HSC map. */
export function buildTopicPaperQuery(subject: string, groupsJson: string) {
    return {
        sql: `
            ${QUESTION_GROUP_CTE}
            SELECT qg.grp AS grp, qg.sub AS sub, q.paper_id AS paper_id,
                   COUNT(*) AS questions,
                   SUM(COALESCE(${MAX_MARKS}, 0)) AS marks
            FROM question_group qg
            JOIN exam_questions q ON q.id = qg.question_id AND q.is_deleted = 0
            JOIN papers p ON p.id = q.paper_id
            WHERE p.subject = ?
            GROUP BY qg.grp, qg.sub, q.paper_id
        `,
        params: [groupsJson, subject]
    }
}

export function buildPaperQuery(userId: number, subject: string) {
    return {
        sql: `
            SELECT p.id, p.school_name, p.academic_year, p.paper_type, ${PAPER_KIND} AS kind,
                   COUNT(q.id) AS questions,
                   SUM(COALESCE(${MAX_MARKS}, 0)) AS marks,
                   COUNT(ua.question_id) AS attempted
            FROM papers p
            LEFT JOIN exam_questions q ON q.paper_id = p.id AND q.is_deleted = 0
            LEFT JOIN user_question_attempts ua ON ua.question_id = q.id AND ua.user_id = ?
            WHERE p.subject = ?
            GROUP BY p.id
            ORDER BY p.academic_year, p.id
        `,
        params: [userId, subject]
    }
}

// Mark values bucket as 1, 2, 3, 4 and 5+. Bucket 0 holds questions with no ceiling, which can't be scored.
const MARKS_BUCKET = `CASE
    WHEN ${MAX_MARKS} IS NULL THEN 0
    WHEN ${MAX_MARKS} >= 5 THEN 5
    ELSE MAX(1, CAST(ROUND(${MAX_MARKS}) AS INTEGER))
END`

/** One row per (question type, mark value, paper kind); every breakdown is summed from it in JS. */
export function buildBreakdownQuery(userId: number, subject: string) {
    return {
        sql: `
            SELECT COALESCE(q.question_type, '') AS question_type,
                   ${MARKS_BUCKET} AS marks_bucket,
                   ${PAPER_KIND} AS kind,
                   ${PERSONAL_COLUMNS},
                   SUM(CASE WHEN ${SCORED} THEN 1 ELSE 0 END) AS scored,
                   SUM(CASE WHEN ${SCORED} AND ua.marks_awarded >= ${MAX_MARKS} THEN 1 ELSE 0 END) AS full_marks
            FROM exam_questions q
            JOIN papers p ON p.id = q.paper_id
            LEFT JOIN user_question_attempts ua ON ua.question_id = q.id AND ua.user_id = ?
            WHERE p.subject = ? AND q.is_deleted = 0
            GROUP BY 1, 2, 3
        `,
        params: [userId, subject]
    }
}

// The same rule as `buildReviewWhere`: the part of the review queue where marks were dropped.
// Retries and fixes are counted over that part only, since a question queued just for its note has
// nothing to fix.
const DROPPED = '(ua.marks_awarded < q.marks OR ua.marks_awarded IS NULL)'

/** Mirrors `buildReviewQueueQuery`'s FROM and WHERE, so `queued` matches the Review tab's list. */
export function buildReviewStatsQuery(userId: number, subject: string) {
    return {
        sql: `
            SELECT COUNT(*) AS queued,
                   COALESCE(SUM(CASE WHEN ${DROPPED} THEN 1 ELSE 0 END), 0) AS dropped,
                   COALESCE(SUM(CASE WHEN ${DROPPED} AND ura.id IS NOT NULL THEN 1 ELSE 0 END), 0) AS retried,
                   COALESCE(SUM(CASE WHEN ${DROPPED} AND q.marks > 0 AND ura.marks_awarded >= q.marks THEN 1 ELSE 0 END), 0) AS fixed,
                   COALESCE(SUM(CASE WHEN ${DROPPED} AND q.marks > 0 AND ura.id IS NOT NULL
                       THEN MAX(0, MIN(COALESCE(ura.marks_awarded, 0), q.marks) - MAX(0, MIN(COALESCE(ua.marks_awarded, 0), q.marks)))
                       ELSE 0 END), 0) AS recovered
            FROM exam_questions q
            JOIN papers p ON q.paper_id = p.id
            JOIN user_question_attempts ua ON q.id = ua.question_id AND ua.user_id = ?
            LEFT JOIN user_review_attempts ura ON q.id = ura.question_id AND ura.user_id = ?
                AND ura.id = (
                    SELECT MAX(id) FROM user_review_attempts WHERE question_id = q.id AND user_id = ?
                )
            WHERE p.subject = ?
              AND q.is_deleted = 0
            ${reviewQueuePredicate}
        `,
        params: [userId, userId, userId, subject]
    }
}

/**
 * Marking a mock writes into the practice attempts (there are no per-mock marks), and totals use
 * `q.marks` as the Mock Exam pages do. Only attempts saved after the exam was finished count, so a
 * finished mock that was never marked isn't scored from older practice on the same questions.
 */
export function buildMockStatsQuery(userId: number, subject: string) {
    return {
        sql: `
            SELECT m.id, m.exam_name, m.completed_at, m.is_timed, m.allowed_time_seconds, m.elapsed_time_seconds,
                   COUNT(*) AS questions,
                   SUM(CASE WHEN q.marks > 0 THEN q.marks ELSE 0 END) AS total_marks,
                   SUM(CASE WHEN q.marks > 0 AND ua.question_id IS NOT NULL
                       THEN MAX(0, MIN(COALESCE(ua.marks_awarded, 0), q.marks)) ELSE 0 END) AS marks_awarded,
                   COUNT(ua.question_id) AS marked
            FROM mock_exams m
            JOIN mock_exam_questions mq ON mq.mock_exam_id = m.id
            JOIN exam_questions q ON q.id = mq.question_id
            LEFT JOIN user_question_attempts ua ON ua.question_id = mq.question_id AND ua.user_id = m.user_id
                AND (m.completed_at IS NULL OR ua.updated_at >= m.completed_at)
            WHERE m.user_id = ? AND m.subject = ? AND m.status = 'completed'
            GROUP BY m.id
            ORDER BY COALESCE(m.completed_at, m.created_at), m.id
        `,
        params: [userId, subject]
    }
}

/**
 * First attempts plus review attempts, bucketed by UTC hour. The hours are moved onto Sydney days
 * in JS (`dailyActivity`), since SQLite has no time zone rules.
 */
export function buildActivityQuery(userId: number, subject: string) {
    return {
        sql: `
            SELECT hour, SUM(n) AS n FROM (
                SELECT strftime('%Y-%m-%d %H', ua.created_at) AS hour, COUNT(*) AS n
                FROM user_question_attempts ua
                JOIN exam_questions q ON q.id = ua.question_id
                JOIN papers p ON p.id = q.paper_id
                WHERE ua.user_id = ? AND p.subject = ?
                GROUP BY hour
                UNION ALL
                SELECT strftime('%Y-%m-%d %H', ura.created_at) AS hour, COUNT(*) AS n
                FROM user_review_attempts ura
                JOIN exam_questions q ON q.id = ura.question_id
                JOIN papers p ON p.id = q.paper_id
                WHERE ura.user_id = ? AND p.subject = ?
                GROUP BY hour
            )
            WHERE hour IS NOT NULL
            GROUP BY hour
            ORDER BY hour
        `,
        params: [userId, subject, userId, subject]
    }
}

type CountRow = {
    questions: number | null
    attempted: number | null
    marks_attempted: number | null
    marks_earned: number | null
}

export type Totals = {
    questions: number
    attempted: number
    marksAttempted: number
    marksEarned: number
}

const totalsOf = (row: CountRow): Totals => ({
    questions: Number(row.questions) || 0,
    attempted: Number(row.attempted) || 0,
    marksAttempted: Number(row.marks_attempted) || 0,
    marksEarned: Number(row.marks_earned) || 0
})

/** Marks earned over marks attempted; null until something has been marked. */
export const accuracyOf = (totals: Pick<Totals, 'marksAttempted' | 'marksEarned'>) =>
    totals.marksAttempted > 0 ? totals.marksEarned / totals.marksAttempted : null

export type BreakdownRow = CountRow & {
    question_type: string | null
    marks_bucket: number | null
    kind: PaperKind
    scored: number | null
    full_marks: number | null
}

export type BreakdownTotals = Totals & { scored: number; fullMarks: number }

export type BreakdownEntry = BreakdownTotals & { key: string; label: string; accuracy: number | null }

const emptyBreakdown = (): BreakdownTotals => ({ questions: 0, attempted: 0, marksAttempted: 0, marksEarned: 0, scored: 0, fullMarks: 0 })

const QUESTION_TYPE_LABELS: [string, string][] = [
    ['multiple_choice', 'Multiple choice'],
    ['short_answer', 'Short answer'],
    ['extended_response', 'Extended response'],
    ['', 'No type set']
]

const MARKS_LABELS: [string, string][] = [
    ['1', '1 mark'],
    ['2', '2 marks'],
    ['3', '3 marks'],
    ['4', '4 marks'],
    ['5', '5+ marks']
]

const PAPER_KIND_LABELS: [string, string][] = [
    ['hsc', 'HSC papers'],
    ['trial', 'Trial papers'],
    ['other', 'Other papers']
]

export function summarizeBreakdown(rows: BreakdownRow[]) {
    const total = emptyBreakdown()
    const byType = new Map<string, BreakdownTotals>()
    const byMarks = new Map<string, BreakdownTotals>()
    const byKind = new Map<string, BreakdownTotals>()

    const bucket = (map: Map<string, BreakdownTotals>, key: string) => {
        const existing = map.get(key)
        if (existing) return existing
        const created = emptyBreakdown()
        map.set(key, created)
        return created
    }
    const accumulate = (target: BreakdownTotals, row: BreakdownRow) => {
        const totals = totalsOf(row)
        target.questions += totals.questions
        target.attempted += totals.attempted
        target.marksAttempted += totals.marksAttempted
        target.marksEarned += totals.marksEarned
        target.scored += Number(row.scored) || 0
        target.fullMarks += Number(row.full_marks) || 0
    }

    for (const row of rows) {
        // An unrecognised type joins the untyped bucket rather than getting a row of its own.
        const type = QUESTION_TYPE_LABELS.some(([key]) => key !== '' && key === row.question_type) ? String(row.question_type) : ''
        accumulate(total, row)
        accumulate(bucket(byType, type), row)
        if (Number(row.marks_bucket) > 0) accumulate(bucket(byMarks, String(row.marks_bucket)), row)
        accumulate(bucket(byKind, row.kind), row)
    }

    const entries = (labels: [string, string][], map: Map<string, BreakdownTotals>): BreakdownEntry[] =>
        labels.flatMap(([key, label]) => {
            const totals = map.get(key)
            return totals && totals.questions > 0 ? [{ ...totals, key, label, accuracy: accuracyOf(totals) }] : []
        })

    return {
        total,
        byType: entries(QUESTION_TYPE_LABELS, byType),
        byMarks: entries(MARKS_LABELS, byMarks),
        byKind: entries(PAPER_KIND_LABELS, byKind)
    }
}

export type PaperRow = {
    id: number
    school_name: string | null
    academic_year: number | null
    paper_type: string | null
    kind: PaperKind
    questions: number | null
    marks: number | null
    attempted: number | null
}

export function summarizePapers(papers: PaperRow[]) {
    let total = 0
    let complete = 0
    let started = 0
    for (const paper of papers) {
        const questions = Number(paper.questions) || 0
        const attempted = Number(paper.attempted) || 0
        if (questions === 0) continue
        total += 1
        if (attempted >= questions) complete += 1
        else if (attempted > 0) started += 1
    }
    return { total, complete, started }
}

export type WeightBasis = 'hsc' | 'all'

export const isWeightBasis = (value: unknown): value is WeightBasis => value === 'hsc' || value === 'all'

// Rows of the topic queries carry sub = '' for the topic itself and the subtopic key otherwise.
type TopicLevel = { grp: string; sub?: string | null }
const isTopicLevel = (row: TopicLevel) => !row.sub

export type TopicPaperRow = TopicLevel & {
    paper_id: number
    questions: number | null
    marks: number | null
}

export type ExamWeight = { avgMarks: number; papers: number }

export type ExamWeights = {
    basis: WeightBasis
    /** Papers in the basis with at least one tagged question, oldest first. */
    papers: PaperRow[]
    byGroup: Map<string, ExamWeight>
    /** By topic key, then subtopic key. */
    bySubtopic: Map<string, Map<string, ExamWeight>>
}

const byYear = (a: PaperRow, b: PaperRow) =>
    (Number(a.academic_year) || 0) - (Number(b.academic_year) || 0) || Number(a.id) - Number(b.id)

/**
 * A topic's exam weight is the average marks per paper that went to it. Only papers with tagged
 * questions are averaged over, so a paper nobody tagged doesn't drag every topic down. A question
 * tagged with two topics counts for both, so a paper's weights can add up to more than its total.
 * Subtopics are averaged over the same papers as their topics.
 */
export function examWeights(topicPapers: TopicPaperRow[], papers: PaperRow[], basis: WeightBasis): ExamWeights {
    const inBasis = new Map(papers.filter(paper => basis === 'all' || paper.kind === 'hsc').map(paper => [Number(paper.id), paper]))
    const tagged = new Set<number>()
    const groupSums = new Map<string, { marks: number; papers: number }>()
    const subtopicSums = new Map<string, Map<string, { marks: number; papers: number }>>()
    for (const row of topicPapers) {
        const paperId = Number(row.paper_id)
        if (!inBasis.has(paperId) || !(Number(row.questions) > 0)) continue
        let sums = groupSums
        let key = row.grp
        if (isTopicLevel(row)) {
            tagged.add(paperId)
        } else {
            sums = subtopicSums.get(row.grp) || new Map()
            subtopicSums.set(row.grp, sums)
            key = String(row.sub)
        }
        const sum = sums.get(key) || { marks: 0, papers: 0 }
        sum.marks += Number(row.marks) || 0
        sum.papers += 1
        sums.set(key, sum)
    }
    const count = tagged.size
    const weigh = (sums: Map<string, { marks: number; papers: number }>) =>
        new Map(Array.from(sums, ([key, sum]) => [key, { avgMarks: count ? sum.marks / count : 0, papers: sum.papers }]))
    return {
        basis,
        papers: Array.from(tagged, id => inBasis.get(id)!).sort(byYear),
        byGroup: weigh(groupSums),
        bySubtopic: new Map(Array.from(subtopicSums, ([grp, sums]) => [grp, weigh(sums)]))
    }
}

/** HSC papers are the better guide to the exam, so they are the default whenever any are tagged. */
export const defaultWeightBasis = (topicPapers: TopicPaperRow[], papers: PaperRow[]): WeightBasis =>
    examWeights(topicPapers, papers, 'hsc').papers.length > 0 ? 'hsc' : 'all'

export type TopicStatRow = CountRow & TopicLevel

export type TopicSummary = Totals & {
    key: string
    name: string
    /** The topic ids behind this entry; several when differently written names were merged. */
    topicIds: number[]
    accuracy: number | null
    /** Share of the topic's questions attempted. */
    coverage: number
    /** Average marks per paper in the weighting basis; null when no paper in the basis is tagged. */
    avgMarks: number | null
    /** How many papers in the weighting basis the topic appears in. */
    papers: number
    /** Empty for a subtopic. */
    subtopics: TopicSummary[]
}

const heaviestFirst = (a: TopicSummary, b: TopicSummary) =>
    (b.avgMarks ?? 0) - (a.avgMarks ?? 0) || b.questions - a.questions || a.name.localeCompare(b.name)

/**
 * Topics with questions in this subject, heaviest first, each with its subtopics. A topic's own
 * figures count every question under it once, so its subtopics can add up to more (a question in
 * two subtopics) or less (a question tagged with the topic alone) than the topic.
 */
export function summarizeTopics(groups: TopicGroup[], rows: TopicStatRow[], weights: ExamWeights): TopicSummary[] {
    const rowsByLevel = new Map(rows.map(row => [`${row.grp}\u001f${row.sub || ''}`, row]))
    const weighted = weights.papers.length > 0
    const summarize = (key: string, name: string, topicIds: number[], row: TopicStatRow | undefined, weight: ExamWeight | undefined, subtopics: TopicSummary[]) => {
        const totals = row ? totalsOf(row) : null
        if (!totals || totals.questions === 0) return []
        return [{
            ...totals,
            key,
            name,
            topicIds,
            accuracy: accuracyOf(totals),
            coverage: totals.attempted / totals.questions,
            avgMarks: weighted ? weight?.avgMarks ?? 0 : null,
            papers: weight?.papers ?? 0,
            subtopics
        }]
    }
    return groups
        .flatMap(group => {
            const subtopicWeights = weights.bySubtopic.get(group.key)
            const subtopics = group.subtopics
                .flatMap(subtopic => summarize(subtopic.key, subtopic.name, subtopic.topicIds, rowsByLevel.get(`${group.key}\u001f${subtopic.key}`), subtopicWeights?.get(subtopic.key), []))
                .sort(heaviestFirst)
            return summarize(group.key, group.name, group.topicIds, rowsByLevel.get(`${group.key}\u001f`), weights.byGroup.get(group.key), subtopics)
        })
        .sort(heaviestFirst)
}

// Below this many marks attempted, a topic's accuracy is too thin to call it a weak spot.
export const MIN_TOPIC_MARKS = 5

export type FocusItem = { topic: TopicSummary; score: number }

/**
 * The two "Focus next" lists. A topic appears in at most one of them.
 * - leaks: practised topics ranked by the marks they cost per paper, weight × share dropped
 *   (lowest accuracy first when nothing is weighted). `score` is that marks figure.
 * - gaps: topics with questions left, ranked by how little they've been practised for what they're
 *   worth, marks attempted per mark of weight (fewest marks attempted first when unweighted).
 */
export function focusTopics(topics: TopicSummary[], limit = 3) {
    const weighted = topics.some(topic => topic.avgMarks != null)

    const leaks: FocusItem[] = topics
        .filter(topic => topic.accuracy != null && topic.accuracy < 1 && topic.marksAttempted >= MIN_TOPIC_MARKS)
        .map(topic => ({ topic, score: weighted ? (topic.avgMarks ?? 0) * (1 - topic.accuracy!) : 1 - topic.accuracy! }))
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score || a.topic.name.localeCompare(b.topic.name))
        .slice(0, limit)

    const inLeaks = new Set(leaks.map(item => item.topic.key))
    const gaps: FocusItem[] = topics
        .filter(topic => !inLeaks.has(topic.key) && topic.attempted < topic.questions && (!weighted || (topic.avgMarks ?? 0) > 0))
        .map(topic => ({ topic, score: weighted ? topic.marksAttempted / (topic.avgMarks as number) : topic.marksAttempted }))
        .sort((a, b) => a.score - b.score || (b.topic.avgMarks ?? 0) - (a.topic.avgMarks ?? 0) || b.topic.questions - a.topic.questions)
        .slice(0, limit)

    return { leaks, gaps }
}

export type TopicPaperMap = {
    /** The HSC papers with tagged questions, oldest first; one column each. */
    papers: PaperRow[]
    rows: { key: string; name: string; cells: number[]; total: number }[]
    max: number
}

/** Marks each HSC paper gave each topic (subtopics aren't broken out), heaviest topic first. */
export function hscTopicMap(topicPapers: TopicPaperRow[], papers: PaperRow[], groups: TopicGroup[]): TopicPaperMap {
    const columns = examWeights(topicPapers, papers, 'hsc').papers
    const columnOf = new Map(columns.map((paper, index) => [Number(paper.id), index]))
    const names = new Map(groups.map(group => [group.key, group.name]))
    const rows = new Map<string, TopicPaperMap['rows'][number]>()
    for (const row of topicPapers) {
        const column = columnOf.get(Number(row.paper_id))
        if (column === undefined || !isTopicLevel(row)) continue
        const entry = rows.get(row.grp) || { key: row.grp, name: names.get(row.grp) || row.grp, cells: columns.map(() => 0), total: 0 }
        const marks = Number(row.marks) || 0
        entry.cells[column] += marks
        entry.total += marks
        rows.set(row.grp, entry)
    }
    const sorted = Array.from(rows.values()).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
    return { papers: columns, rows: sorted, max: sorted.reduce((highest, row) => Math.max(highest, ...row.cells), 0) }
}

// Minutes per mark in a 3-hour, 100-mark paper, the format of most HSC exams.
export const HSC_MINUTES_PER_MARK = 1.8

export type MockRow = {
    id: number
    exam_name: string | null
    completed_at: string | null
    is_timed: number | null
    allowed_time_seconds: number | null
    elapsed_time_seconds: number | null
    questions: number | null
    total_marks: number | null
    marks_awarded: number | null
    marked: number | null
}

export type MockResult = {
    id: number
    name: string
    completedAt: string | null
    score: number
    marksAwarded: number
    totalMarks: number
    /** Time on the clock; only timed mocks keep it. */
    minutes: number | null
    allowedMinutes: number | null
}

/** Marked mocks only, in the order they were finished. */
export function summarizeMocks(rows: MockRow[], recent = 6) {
    const results: MockResult[] = rows
        .filter(row => Number(row.marked) > 0 && Number(row.total_marks) > 0)
        .map(row => {
            const elapsed = Number(row.elapsed_time_seconds) || 0
            const allowed = Number(row.allowed_time_seconds) || 0
            return {
                id: Number(row.id),
                name: (row.exam_name || '').trim() || 'Untitled Exam',
                completedAt: row.completed_at,
                score: (Number(row.marks_awarded) || 0) / Number(row.total_marks),
                marksAwarded: Number(row.marks_awarded) || 0,
                totalMarks: Number(row.total_marks),
                minutes: row.is_timed && elapsed > 0 ? elapsed / 60 : null,
                allowedMinutes: row.is_timed && allowed > 0 ? allowed / 60 : null
            }
        })
    const timed = results.filter(result => result.minutes != null)
    const timedMarks = timed.reduce((sum, result) => sum + result.totalMarks, 0)
    return {
        count: results.length,
        average: results.length ? results.reduce((sum, result) => sum + result.score, 0) / results.length : null,
        best: results.length ? Math.max(...results.map(result => result.score)) : null,
        /** Score change from the second-latest mock to the latest. */
        change: results.length >= 2 ? results[results.length - 1].score - results[results.length - 2].score : null,
        /** Minutes per mark across timed mocks. */
        pace: timedMarks > 0 ? timed.reduce((sum, result) => sum + (result.minutes as number), 0) / timedMarks : null,
        timedCount: timed.length,
        recent: results.slice(-recent).reverse()
    }
}

const SYDNEY_DAY = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit' })

/** The Sydney calendar date ("YYYY-MM-DD") an instant falls on. */
export function sydneyDate(instant: Date): string {
    const parts: Record<string, string> = {}
    for (const part of SYDNEY_DAY.formatToParts(instant)) parts[part.type] = part.value
    return `${parts.year}-${parts.month}-${parts.day}`
}

export type ActivityRow = { hour: string | null; n: number | null }

/** Sums `buildActivityQuery`'s UTC hours into Sydney days. Sydney's offset is whole hours, so no hour straddles two days. */
export function dailyActivity(rows: ActivityRow[]): Map<string, number> {
    const days = new Map<string, number>()
    for (const row of rows) {
        const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2})$/.exec(String(row.hour ?? ''))
        if (!match) continue
        const day = sydneyDate(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]))))
        days.set(day, (days.get(day) || 0) + (Number(row.n) || 0))
    }
    return days
}

const DAY_MS = 86_400_000

// Calendar dates as whole UTC days, so date arithmetic never meets a DST transition.
const dayIndex = (date: string) => {
    const [year, month, day] = date.split('-').map(Number)
    return Math.round(Date.UTC(year, month - 1, day) / DAY_MS)
}
const dateAt = (index: number) => new Date(index * DAY_MS).toISOString().slice(0, 10)
/** 0 for Monday through 6 for Sunday. */
const weekdayOf = (index: number) => (new Date(index * DAY_MS).getUTCDay() + 6) % 7

/** Totals and streaks over Sydney days, with weeks running Monday to Sunday. */
export function activitySummary(days: Map<string, number>, today: string) {
    const todayIndex = dayIndex(today)
    const weekStart = todayIndex - weekdayOf(todayIndex)
    const active = new Set<number>()
    let total = 0
    let thisWeek = 0
    let lastWeek = 0
    let lastIndex = Number.NEGATIVE_INFINITY
    for (const [date, count] of days) {
        if (!(count > 0)) continue
        const index = dayIndex(date)
        if (index > todayIndex) continue
        active.add(index)
        total += count
        lastIndex = Math.max(lastIndex, index)
        if (index >= weekStart) thisWeek += count
        else if (index >= weekStart - 7) lastWeek += count
    }

    // A streak holds until the day is over, so a quiet morning counts back from yesterday.
    let current = 0
    for (let index = active.has(todayIndex) ? todayIndex : todayIndex - 1; active.has(index); index--) current++

    let longest = 0
    let run = 0
    let previous = Number.NaN
    for (const index of Array.from(active).sort((a, b) => a - b)) {
        run = index === previous + 1 ? run + 1 : 1
        longest = Math.max(longest, run)
        previous = index
    }

    let activeLast30 = 0
    for (const index of active) if (index > todayIndex - 30) activeLast30++

    /** The most recent day with any activity, or null if there has been none. */
    const lastActive = Number.isFinite(lastIndex) ? dateAt(lastIndex) : null

    return { total, thisWeek, lastWeek, current, longest, activeLast30, lastActive }
}

export type HeatmapDay = { date: string; count: number | null }

/** `weeks` Monday-to-Sunday columns, the last holding today; days after today have a null count. */
export function activityHeatmap(days: Map<string, number>, today: string, weeks = 26) {
    const todayIndex = dayIndex(today)
    const firstIndex = todayIndex - weekdayOf(todayIndex) - (weeks - 1) * 7
    let max = 0
    const columns: HeatmapDay[][] = []
    for (let week = 0; week < weeks; week++) {
        const column: HeatmapDay[] = []
        for (let day = 0; day < 7; day++) {
            const index = firstIndex + week * 7 + day
            const date = dateAt(index)
            const count = index > todayIndex ? null : days.get(date) || 0
            if (count && count > max) max = count
            column.push({ date, count })
        }
        columns.push(column)
    }
    return { weeks: columns, max }
}
