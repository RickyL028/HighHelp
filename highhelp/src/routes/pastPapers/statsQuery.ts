import { parseTopicHierarchy, topicHierarchyKey } from '../../utils'
import { reviewQueuePredicate } from './practiceQuery'

// The Statistics tab only reads what the other past-paper tabs already record. As in
// practiceQuery.ts, the SQL builders are pure so the tests can run them against a seeded D1, and
// the summarising helpers below them take plain rows.
//
// Every figure on the tab is worked out over one filtered slice of a subject, a StatsScope: which
// questions (papers of some kinds, or the student's own mock exams, and optionally one topic) and
// which attempts (those saved within a period). There is no separate HSC, trial or mock analysis;
// each of those is the same analysis over a different scope.

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

// ---------------------------------------------------------------------------------------------
// Filters

export type PeriodKey = 'all' | '7d' | '30d' | '90d' | 'year' | 'custom'

export type PaperSource = { key: string; label: string; kinds: PaperKind[] }

/** The paper choices of the "Questions from" filter; the student's mock exams follow them. */
export const PAPER_SOURCES: PaperSource[] = [
    { key: 'all', label: 'All papers', kinds: [] },
    { key: 'hsc', label: 'HSC papers', kinds: ['hsc'] },
    { key: 'trial', label: 'Trial papers', kinds: ['trial'] },
    { key: 'hsc-trial', label: 'HSC and trial papers', kinds: ['hsc', 'trial'] },
    { key: 'other', label: 'Other papers', kinds: ['other'] }
]

export const PERIODS: { key: PeriodKey; label: string; days?: number }[] = [
    { key: 'all', label: 'All time' },
    { key: '7d', label: 'Last 7 days', days: 7 },
    { key: '30d', label: 'Last 30 days', days: 30 },
    { key: '90d', label: 'Last 90 days', days: 90 },
    { key: 'year', label: 'This year' },
    { key: 'custom', label: 'Custom dates' }
]

export type StatsFilters = {
    /** 'all' or another PAPER_SOURCES key, 'mocks', or 'mock-<id>'. */
    source: string
    /** Paper kinds in scope; empty for every kind. */
    kinds: PaperKind[]
    /** Every finished mock exam, one of them, or null for the papers. */
    mock: 'all' | number | null
    /** A topic key (see buildTopicGroups), or '' for every topic. */
    topic: string
    period: PeriodKey
    /** The period as Sydney dates, both inclusive; null where it is open. */
    from: string | null
    to: string | null
}

export const DEFAULT_STATS_FILTERS: StatsFilters = { source: 'all', kinds: [], mock: null, topic: '', period: 'all', from: null, to: null }

/**
 * Reads the filters from the query string. A filter naming something the student doesn't have (a
 * mock that isn't theirs or isn't finished, a topic the subject doesn't use) falls back to its
 * default rather than to an empty page. A preset period is kept as its key, so a bookmarked "last
 * 30 days" stays the last 30 days.
 */
export function readStatsFilters(
    query: (key: string) => string | undefined,
    { today, mockIds, topicKeys }: { today: string; mockIds: number[]; topicKeys: string[] }
): StatsFilters {
    const filters: StatsFilters = { ...DEFAULT_STATS_FILTERS }

    const source = (query('source') || '').trim()
    const paperSource = PAPER_SOURCES.find(entry => entry.key === source)
    const mockMatch = /^mock-(\d+)$/.exec(source)
    if (paperSource) {
        filters.source = paperSource.key
        filters.kinds = paperSource.kinds
    } else if (source === 'mocks' && mockIds.length > 0) {
        filters.source = 'mocks'
        filters.mock = 'all'
    } else if (mockMatch && mockIds.includes(Number(mockMatch[1]))) {
        filters.source = `mock-${Number(mockMatch[1])}`
        filters.mock = Number(mockMatch[1])
    }

    const topic = topicHierarchyKey(query('topic') || '')
    if (topicKeys.includes(topic)) filters.topic = topic

    const fromValue = query('from')
    const toValue = query('to')
    const requested = query('period') || (fromValue || toValue ? 'custom' : 'all')
    const preset = PERIODS.find(entry => entry.key === requested)
    if (preset?.days) {
        filters.period = preset.key
        filters.from = addDays(today, 1 - preset.days)
        filters.to = today
    } else if (preset?.key === 'year') {
        filters.period = 'year'
        filters.from = `${today.slice(0, 4)}-01-01`
        filters.to = today
    } else if (preset?.key === 'custom') {
        let from = isDate(fromValue) ? fromValue : null
        let to = isDate(toValue) ? toValue : null
        if (from && to && from > to) [from, to] = [to, from]
        if (from || to) Object.assign(filters, { period: 'custom', from, to })
    }
    return filters
}

/** The filters as query-string pairs, leaving out every default. */
export function statsFilterParams(filters: StatsFilters): [string, string][] {
    const params: [string, string][] = []
    if (filters.source !== 'all') params.push(['source', filters.source])
    if (filters.topic) params.push(['topic', filters.topic])
    if (filters.period !== 'all') params.push(['period', filters.period])
    if (filters.period === 'custom') {
        if (filters.from) params.push(['from', filters.from])
        if (filters.to) params.push(['to', filters.to])
    }
    return params
}

export type StatsScope = {
    userId: number
    subject: string
    kinds: PaperKind[]
    mock: 'all' | number | null
    /** Ids of the topic in scope (every spelling of it and its subtopics), or null for every topic. */
    topicIds: number[] | null
    /** Attempts saved in [since, until), as UTC timestamps in the database's own format. */
    since: string | null
    until: string | null
}

export function statsScope(userId: number, subject: string, filters: StatsFilters, topicIds: number[] | null): StatsScope {
    return {
        userId,
        subject,
        kinds: filters.kinds,
        mock: filters.mock,
        topicIds: filters.topic ? topicIds : null,
        since: filters.from ? sydneyMidnight(filters.from) : null,
        until: filters.to ? sydneyMidnight(addDays(filters.to, 1)) : null
    }
}

// ---------------------------------------------------------------------------------------------
// SQL

type Clause = { sql: string; params: unknown[] }

const clause = (sql: string, ...params: unknown[]): Clause => ({ sql, params })

// Joins clauses in order, so each `?` keeps its value however many optional clauses are left out.
// A plain string is SQL with no parameters.
const joinClauses = (parts: (Clause | string)[], separator = '\n'): Clause => {
    const present = parts.filter(part => (typeof part === 'string' ? part : part.sql).trim() !== '')
    return {
        sql: present.map(part => (typeof part === 'string' ? part : part.sql)).join(separator),
        params: present.flatMap(part => (typeof part === 'string' ? [] : part.params))
    }
}

const sql = (...parts: (Clause | string)[]) => joinClauses(parts)

const withCtes = (...ctes: (Clause | string)[]) => {
    const list = joinClauses(ctes, ',\n')
    return list.sql ? sql('WITH', list) : ''
}

// Topic names carry their own hierarchy ("Calculus 1.2 Differentiation" is a subtopic of
// "Calculus"), parsed in JS by parseTopicHierarchy, so the grouping reaches SQL as a JSON list of
// {id, g, s} entries: topic id, topic key and subtopic key (null for the topic itself). Every
// query below reports each topic once (sub = '') and each of its subtopics once. UNION rather than
// UNION ALL: a question tagged with a topic and its subtopic, or with several of its subtopics, is
// one question in that topic.
const topicGroupCtes = (groupsJson: string) => clause(`
    topic_group AS (
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
    )`, groupsJson)

// In mock scope, `mock_question` holds each finished mock in scope with its questions. Marking a mock
// writes into the practice attempts (there are no per-mock marks), so `since` is when the mock was
// finished: only an attempt saved from then on is the mock's mark, and a finished mock that was never
// marked isn't scored from older practice on the same questions. A mock with no finish time takes
// any attempt. A question in several of the mocks counts once in `mock_scope`, from the first of them.
const mockCtes = (scope: StatsScope) => {
    if (scope.mock == null) return ''
    return sql(
        clause(`
    mock_question AS (
        SELECT m.id AS mock_id, mq.question_id, COALESCE(m.completed_at, '') AS since
        FROM mock_exams m
        JOIN mock_exam_questions mq ON mq.mock_exam_id = m.id
        WHERE m.user_id = ? AND m.subject = ? AND m.status = 'completed'`, scope.userId, scope.subject),
        typeof scope.mock === 'number' ? clause('AND m.id = ?', scope.mock) : '',
        scope.since ? clause('AND m.completed_at >= ?', scope.since) : '',
        scope.until ? clause('AND m.completed_at < ?', scope.until) : '',
        `),
    mock_scope AS (
        SELECT question_id, MIN(since) AS since FROM mock_question GROUP BY question_id
    )`
    )
}

const mockScopeJoin = (scope: StatsScope) => (scope.mock != null ? 'JOIN mock_scope ms ON ms.question_id = q.id' : '')

// The kinds of paper and the topic in scope, as conditions on `p` and `q`. `withTopic` is off for
// the topic queries, which group by every topic and pick the chosen one in JS.
const scopeConditions = (scope: StatsScope, withTopic = true) => sql(
    scope.kinds.length ? clause(`AND (${PAPER_KIND}) IN (${scope.kinds.map(() => '?').join(', ')})`, ...scope.kinds) : '',
    withTopic && scope.topicIds
        ? clause(
              'AND EXISTS (SELECT 1 FROM question_topics st WHERE st.question_id = q.id AND st.topic_id IN (SELECT value FROM json_each(?)))',
              JSON.stringify(scope.topicIds)
          )
        : ''
)

const questionWhere = (scope: StatsScope, withTopic = true) =>
    sql(clause('WHERE p.subject = ? AND q.is_deleted = 0', scope.subject), scopeConditions(scope, withTopic))

const periodConditions = (scope: StatsScope, column: string) => sql(
    scope.since ? clause(`AND ${column} >= ?`, scope.since) : '',
    scope.until ? clause(`AND ${column} < ?`, scope.until) : ''
)

// The student's attempt at each question, when it was saved in the period and, in mock scope, once
// the mock was finished. Comes after mockScopeJoin, which it reads.
const attemptJoin = (scope: StatsScope, join: 'JOIN' | 'LEFT JOIN' = 'LEFT JOIN') => sql(
    clause(`${join} user_question_attempts ua ON ua.question_id = q.id AND ua.user_id = ?`, scope.userId),
    scope.mock != null ? 'AND ua.updated_at >= ms.since' : '',
    periodConditions(scope, 'ua.updated_at')
)

/** Every topic and subtopic in the source and period, with the student's results on it. Ignores the topic filter. */
export function buildTopicStatsQuery(scope: StatsScope, groupsJson: string) {
    return sql(
        withCtes(topicGroupCtes(groupsJson), mockCtes(scope)),
        `SELECT qg.grp AS grp, qg.sub AS sub, ${PERSONAL_COLUMNS}
        FROM question_group qg
        JOIN exam_questions q ON q.id = qg.question_id
        JOIN papers p ON p.id = q.paper_id`,
        mockScopeJoin(scope),
        attemptJoin(scope),
        questionWhere(scope, false),
        'GROUP BY qg.grp, qg.sub'
    )
}

/**
 * Marks each exam in scope gives each topic and subtopic: the raw material for exam weights and the
 * topic map. The exams are the papers, or in mock scope the mocks. Ignores the topic filter.
 */
export function buildTopicUnitQuery(scope: StatsScope, groupsJson: string) {
    const mocks = scope.mock != null
    return sql(
        withCtes(topicGroupCtes(groupsJson), mockCtes(scope)),
        `SELECT qg.grp AS grp, qg.sub AS sub, ${mocks ? 'mu.mock_id' : 'q.paper_id'} AS unit_id,
               COUNT(*) AS questions,
               SUM(COALESCE(${MAX_MARKS}, 0)) AS marks
        FROM question_group qg
        JOIN exam_questions q ON q.id = qg.question_id
        JOIN papers p ON p.id = q.paper_id`,
        mocks ? 'JOIN mock_question mu ON mu.question_id = q.id' : '',
        questionWhere(scope, false),
        'GROUP BY 1, 2, 3'
    )
}

/** Every paper in the subject, oldest first, with its kind and live question count. */
export function buildPaperListQuery(subject: string) {
    return {
        sql: `
            SELECT p.id, p.school_name, p.academic_year, p.paper_type, ${PAPER_KIND} AS kind,
                   (SELECT COUNT(*) FROM exam_questions q WHERE q.paper_id = p.id AND q.is_deleted = 0) AS questions
            FROM papers p
            WHERE p.subject = ?
            ORDER BY p.academic_year, p.id
        `,
        params: [subject]
    }
}

export type MockListRow = { id: number; exam_name: string | null; completed_at: string | null }

/** The student's finished mock exams in the subject, in the order they were finished. */
export function buildMockListQuery(userId: number, subject: string) {
    return {
        sql: `
            SELECT id, exam_name, completed_at
            FROM mock_exams
            WHERE user_id = ? AND subject = ? AND status = 'completed'
            ORDER BY COALESCE(completed_at, created_at), id
        `,
        params: [userId, subject]
    }
}

/** Each paper with questions in scope, and the student's results on those questions. */
export function buildPaperResultsQuery(scope: StatsScope) {
    return sql(
        withCtes(mockCtes(scope)),
        `SELECT q.paper_id AS id, ${PERSONAL_COLUMNS}
        FROM exam_questions q
        JOIN papers p ON p.id = q.paper_id`,
        mockScopeJoin(scope),
        attemptJoin(scope),
        questionWhere(scope),
        'GROUP BY q.paper_id'
    )
}

// Mark values bucket as 1, 2, 3, 4 and 5+. Bucket 0 holds questions with no ceiling, which can't be scored.
const MARKS_BUCKET = `CASE
    WHEN ${MAX_MARKS} IS NULL THEN 0
    WHEN ${MAX_MARKS} >= 5 THEN 5
    ELSE MAX(1, CAST(ROUND(${MAX_MARKS}) AS INTEGER))
END`

/** One row per (question type, mark value) in scope; the totals and both breakdowns are summed from it in JS. */
export function buildBreakdownQuery(scope: StatsScope) {
    return sql(
        withCtes(mockCtes(scope)),
        `SELECT COALESCE(q.question_type, '') AS question_type,
               ${MARKS_BUCKET} AS marks_bucket,
               ${PERSONAL_COLUMNS},
               SUM(CASE WHEN ${SCORED} THEN 1 ELSE 0 END) AS scored,
               SUM(CASE WHEN ${SCORED} AND ua.marks_awarded >= ${MAX_MARKS} THEN 1 ELSE 0 END) AS full_marks
        FROM exam_questions q
        JOIN papers p ON p.id = q.paper_id`,
        mockScopeJoin(scope),
        attemptJoin(scope),
        questionWhere(scope),
        'GROUP BY 1, 2'
    )
}

// The same rule as `buildReviewWhere`: the part of the review queue where marks were dropped.
// Retries and fixes are counted over that part only, since a question queued just for its note has
// nothing to fix.
const DROPPED = '(ua.marks_awarded < q.marks OR ua.marks_awarded IS NULL)'

/** Mirrors `buildReviewQueueQuery`'s FROM and WHERE, so an unfiltered `queued` matches the Review tab's list. */
export function buildReviewStatsQuery(scope: StatsScope) {
    return sql(
        withCtes(mockCtes(scope)),
        `SELECT COUNT(*) AS queued,
               COALESCE(SUM(CASE WHEN ${DROPPED} THEN 1 ELSE 0 END), 0) AS dropped,
               COALESCE(SUM(CASE WHEN ${DROPPED} AND ura.id IS NOT NULL THEN 1 ELSE 0 END), 0) AS retried,
               COALESCE(SUM(CASE WHEN ${DROPPED} AND q.marks > 0 AND ura.marks_awarded >= q.marks THEN 1 ELSE 0 END), 0) AS fixed,
               COALESCE(SUM(CASE WHEN ${DROPPED} AND q.marks > 0 AND ura.id IS NOT NULL
                   THEN MAX(0, MIN(COALESCE(ura.marks_awarded, 0), q.marks) - MAX(0, MIN(COALESCE(ua.marks_awarded, 0), q.marks)))
                   ELSE 0 END), 0) AS recovered
        FROM exam_questions q
        JOIN papers p ON q.paper_id = p.id`,
        mockScopeJoin(scope),
        attemptJoin(scope, 'JOIN'),
        clause(`LEFT JOIN user_review_attempts ura ON q.id = ura.question_id AND ura.user_id = ?
            AND ura.id = (
                SELECT MAX(id) FROM user_review_attempts WHERE question_id = q.id AND user_id = ?
            )`, scope.userId, scope.userId),
        questionWhere(scope),
        reviewQueuePredicate
    )
}

/**
 * Each finished mock in scope, scored over its questions in scope. Totals use `q.marks`, and deleted
 * questions still count, as on the Mock Exam pages.
 */
export function buildMockStatsQuery(scope: StatsScope) {
    return sql(
        `SELECT m.id, m.exam_name, m.completed_at, m.is_timed, m.allowed_time_seconds, m.elapsed_time_seconds,
               COUNT(*) AS questions,
               SUM(CASE WHEN q.marks > 0 THEN q.marks ELSE 0 END) AS total_marks,
               SUM(CASE WHEN q.marks > 0 AND ua.question_id IS NOT NULL
                   THEN MAX(0, MIN(COALESCE(ua.marks_awarded, 0), q.marks)) ELSE 0 END) AS marks_awarded,
               COUNT(ua.question_id) AS marked
        FROM mock_exams m
        JOIN mock_exam_questions mq ON mq.mock_exam_id = m.id
        JOIN exam_questions q ON q.id = mq.question_id
        JOIN papers p ON p.id = q.paper_id
        LEFT JOIN user_question_attempts ua ON ua.question_id = mq.question_id AND ua.user_id = m.user_id
            AND (m.completed_at IS NULL OR ua.updated_at >= m.completed_at)`,
        periodConditions(scope, 'ua.updated_at'),
        clause(`WHERE m.user_id = ? AND m.subject = ? AND m.status = 'completed'`, scope.userId, scope.subject),
        typeof scope.mock === 'number' ? clause('AND m.id = ?', scope.mock) : '',
        periodConditions(scope, 'm.completed_at'),
        scopeConditions(scope),
        `GROUP BY m.id
        ORDER BY COALESCE(m.completed_at, m.created_at), m.id`
    )
}

/**
 * First attempts plus review attempts on the questions in scope, bucketed by UTC hour. The hours
 * are moved onto Sydney days, and cut to the period, in JS (`dailyActivity`, `daysWithin`), since
 * SQLite has no time zone rules. Mock scope doesn't apply: it's about results, not practice days.
 */
export function buildActivityQuery(scope: StatsScope) {
    const attempts = (table: string, alias: string) => sql(
        clause(`SELECT strftime('%Y-%m-%d %H', ${alias}.created_at) AS hour, COUNT(*) AS n
            FROM ${table} ${alias}
            JOIN exam_questions q ON q.id = ${alias}.question_id
            JOIN papers p ON p.id = q.paper_id
            WHERE ${alias}.user_id = ? AND p.subject = ?`, scope.userId, scope.subject),
        scopeConditions(scope),
        'GROUP BY hour'
    )
    return sql(
        'SELECT hour, SUM(n) AS n FROM (',
        attempts('user_question_attempts', 'ua'),
        'UNION ALL',
        attempts('user_review_attempts', 'ura'),
        `)
        WHERE hour IS NOT NULL
        GROUP BY hour
        ORDER BY hour`
    )
}

// ---------------------------------------------------------------------------------------------
// Topics

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

// A number in front of a subtopic ("1.2 Differentiation", "1.1 - Vectors") is a syllabus code, so the
// same subtopic tagged with and without it ("Calculus - Differentiation") is one subtopic.
const subtopicKey = (label: string) => topicHierarchyKey(label.replace(/^\d+(?:\.\d+)*(?:\s*[-–—:.]\s*|\s+)/, '')) || topicHierarchyKey(label)

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

// Rows of the topic queries carry sub = '' for the topic itself and the subtopic key otherwise.
type TopicLevel = { grp: string; sub?: string | null }
const isTopicLevel = (row: TopicLevel) => !row.sub

export type TopicUnitRow = TopicLevel & {
    /** A paper id, or in mock scope a mock id. */
    unit_id: number
    questions: number | null
    marks: number | null
}

export type ExamWeight = { avgMarks: number; papers: number }

export type ExamWeights = {
    /** The exams in scope with at least one tagged question, in the order given. */
    units: number[]
    byGroup: Map<string, ExamWeight>
    /** By topic key, then subtopic key. */
    bySubtopic: Map<string, Map<string, ExamWeight>>
}

/**
 * A topic's exam weight is the average marks per exam in scope that went to it. Only exams with
 * tagged questions are averaged over, so a paper nobody tagged doesn't drag every topic down. A
 * question tagged with two topics counts for both, so an exam's weights can add up to more than its
 * total. Subtopics are averaged over the same exams as their topics. `unitOrder` is every exam in
 * scope in display order; rows for any other exam are ignored.
 */
export function examWeights(topicUnits: TopicUnitRow[], unitOrder: number[]): ExamWeights {
    const order = new Map(unitOrder.map((id, index) => [Number(id), index]))
    const tagged = new Set<number>()
    const groupSums = new Map<string, { marks: number; papers: number }>()
    const subtopicSums = new Map<string, Map<string, { marks: number; papers: number }>>()
    for (const row of topicUnits) {
        const unitId = Number(row.unit_id)
        if (!order.has(unitId) || !(Number(row.questions) > 0)) continue
        let sums = groupSums
        let key = row.grp
        if (isTopicLevel(row)) {
            tagged.add(unitId)
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
        units: Array.from(tagged).sort((a, b) => order.get(a)! - order.get(b)!),
        byGroup: weigh(groupSums),
        bySubtopic: new Map(Array.from(subtopicSums, ([grp, sums]) => [grp, weigh(sums)]))
    }
}

export type TopicStatRow = CountRow & TopicLevel

export type TopicSummary = Totals & {
    key: string
    name: string
    /** The topic ids behind this entry; several when differently written names were merged. */
    topicIds: number[]
    accuracy: number | null
    /** Share of the topic's questions attempted. */
    coverage: number
    /** Average marks per exam in scope; null when no exam in scope is tagged. */
    avgMarks: number | null
    /** How many exams in scope the topic appears in. */
    papers: number
    /** Empty for a subtopic. */
    subtopics: TopicSummary[]
}

const heaviestFirst = (a: TopicSummary, b: TopicSummary) =>
    (b.avgMarks ?? 0) - (a.avgMarks ?? 0) || b.questions - a.questions || a.name.localeCompare(b.name)

/**
 * Topics with questions in scope, heaviest first, each with its subtopics. A topic's own figures
 * count every question under it once, so its subtopics can add up to more (a question in two
 * subtopics) or less (a question tagged with the topic alone) than the topic.
 */
export function summarizeTopics(groups: TopicGroup[], rows: TopicStatRow[], weights: ExamWeights): TopicSummary[] {
    const rowsByLevel = new Map(rows.map(row => [`${row.grp}\u001f${row.sub || ''}`, row]))
    const weighted = weights.units.length > 0
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
 * - leaks: practised topics ranked by the marks they cost per exam, weight × share dropped
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

export type TopicUnitMap = {
    /** The tagged exams shown, one column each, in order: the latest `limit` of them. */
    units: number[]
    /** Every tagged exam in scope; each row's average is over all of them, shown or not. */
    unitCount: number
    rows: { key: string; name: string; cells: number[]; avg: number }[]
    max: number
}

/**
 * Marks each tagged exam gave each topic, heaviest topic first. With `topic`, the rows are that
 * topic's subtopics instead. `names` maps a row key to the name shown.
 */
export function topicUnitMap(
    topicUnits: TopicUnitRow[],
    weights: ExamWeights,
    names: Map<string, string>,
    { topic, limit }: { topic?: string; limit?: number } = {}
): TopicUnitMap {
    const columns = limit && weights.units.length > limit ? weights.units.slice(-limit) : weights.units
    const columnOf = new Map(columns.map((id, index) => [id, index]))
    const tagged = new Set(weights.units)
    const rows = new Map<string, { key: string; name: string; cells: number[]; total: number }>()
    for (const row of topicUnits) {
        const unitId = Number(row.unit_id)
        if (!tagged.has(unitId)) continue
        const key = topic ? (row.grp === topic && !isTopicLevel(row) ? String(row.sub) : null) : isTopicLevel(row) ? row.grp : null
        if (key == null) continue
        const entry = rows.get(key) || { key, name: names.get(key) || key, cells: columns.map(() => 0), total: 0 }
        const marks = Number(row.marks) || 0
        entry.total += marks
        const column = columnOf.get(unitId)
        if (column !== undefined) entry.cells[column] += marks
        rows.set(key, entry)
    }
    const sorted = Array.from(rows.values())
        .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
        .map(({ total, ...row }) => ({ ...row, avg: weights.units.length ? total / weights.units.length : 0 }))
    return {
        units: columns,
        unitCount: weights.units.length,
        rows: sorted,
        max: sorted.reduce((highest, row) => Math.max(highest, ...row.cells), 0)
    }
}

// ---------------------------------------------------------------------------------------------
// Scores

export type BreakdownRow = CountRow & {
    question_type: string | null
    marks_bucket: number | null
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

export function summarizeBreakdown(rows: BreakdownRow[]) {
    const total = emptyBreakdown()
    const byType = new Map<string, BreakdownTotals>()
    const byMarks = new Map<string, BreakdownTotals>()

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
    }

    const entries = (labels: [string, string][], map: Map<string, BreakdownTotals>): BreakdownEntry[] =>
        labels.flatMap(([key, label]) => {
            const totals = map.get(key)
            return totals && totals.questions > 0 ? [{ ...totals, key, label, accuracy: accuracyOf(totals) }] : []
        })

    return {
        total,
        byType: entries(QUESTION_TYPE_LABELS, byType),
        byMarks: entries(MARKS_LABELS, byMarks)
    }
}

export type PaperRow = {
    id: number
    school_name: string | null
    academic_year: number | null
    paper_type: string | null
    kind: PaperKind
    /** Live questions on the paper. */
    questions: number | null
}

export type PaperResultRow = CountRow & { id: number }

export type PaperResult = Totals & { paper: PaperRow; accuracy: number | null }

/**
 * Papers with questions in scope, newest first, each with the student's results on those questions,
 * plus how many are finished (every question in scope attempted) and started.
 */
export function summarizePapers(papers: PaperRow[], rows: PaperResultRow[]) {
    const byId = new Map(papers.map(paper => [Number(paper.id), paper]))
    const results: PaperResult[] = rows.flatMap(row => {
        const paper = byId.get(Number(row.id))
        const totals = totalsOf(row)
        return paper && totals.questions > 0 ? [{ ...totals, paper, accuracy: accuracyOf(totals) }] : []
    })
    results.sort((a, b) =>
        (Number(b.paper.academic_year) || 0) - (Number(a.paper.academic_year) || 0) || Number(b.paper.id) - Number(a.paper.id))
    return {
        results,
        total: results.length,
        complete: results.filter(result => result.attempted >= result.questions).length,
        started: results.filter(result => result.attempted > 0 && result.attempted < result.questions).length
    }
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

/** Marked mocks only, in the order they were finished; `recent` is newest first. */
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

// ---------------------------------------------------------------------------------------------
// Dates and activity

const SYDNEY_DAY = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit' })
const SYDNEY_CLOCK = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Sydney',
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
})

const partsOf = (format: Intl.DateTimeFormat, instant: Date) => {
    const parts: Record<string, string> = {}
    for (const part of format.formatToParts(instant)) parts[part.type] = part.value
    return parts
}

/** The Sydney calendar date ("YYYY-MM-DD") an instant falls on. */
export function sydneyDate(instant: Date): string {
    const parts = partsOf(SYDNEY_DAY, instant)
    return `${parts.year}-${parts.month}-${parts.day}`
}

const DAY_MS = 86_400_000
const HOUR_MS = 3_600_000

// Calendar dates as whole UTC days, so date arithmetic never meets a DST transition.
const dayIndex = (date: string) => {
    const [year, month, day] = date.split('-').map(Number)
    return Math.round(Date.UTC(year, month - 1, day) / DAY_MS)
}
const dateAt = (index: number) => new Date(index * DAY_MS).toISOString().slice(0, 10)
/** 0 for Monday through 6 for Sunday. */
const weekdayOf = (index: number) => (new Date(index * DAY_MS).getUTCDay() + 6) % 7

export const addDays = (date: string, days: number) => dateAt(dayIndex(date) + days)

/** A real calendar date written "YYYY-MM-DD". */
export const isDate = (value: string | null | undefined): value is string =>
    !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && dateAt(dayIndex(value)) === value

/**
 * The UTC instant Sydney's day starts, as "YYYY-MM-DD HH:MM:SS" like CURRENT_TIMESTAMP, so it compares
 * directly with stored timestamps. Daylight saving changes at 2 or 3am, so the offset is read an
 * hour or so into the day, which is always on the same side of the change as midnight.
 */
export function sydneyMidnight(date: string): string {
    const utcMidnight = dayIndex(date) * DAY_MS
    const probe = new Date(utcMidnight - 10 * HOUR_MS)
    const parts = partsOf(SYDNEY_CLOCK, probe)
    const wall = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute))
    const offset = wall - probe.getTime()
    return new Date(utcMidnight - offset).toISOString().slice(0, 19).replace('T', ' ')
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

/** The days from `from` to `to` (inclusive; either may be open). */
export function daysWithin(days: Map<string, number>, from: string | null, to: string | null): Map<string, number> {
    if (!from && !to) return days
    return new Map(Array.from(days).filter(([date]) => (!from || date >= from) && (!to || date <= to)))
}

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

    return { total, thisWeek, lastWeek, current, longest, activeDays: active.size, activeLast30, lastActive }
}

export type HeatmapDay = { date: string; count: number | null }

/**
 * `weeks` Monday-to-Sunday columns, the last holding `end` (today, or the end of the period). Days
 * after `end`, and before `start` when one is given, have a null count.
 */
export function activityHeatmap(days: Map<string, number>, end: string, weeks = 26, start: string | null = null) {
    const endIndex = dayIndex(end)
    const startIndex = start ? dayIndex(start) : Number.NEGATIVE_INFINITY
    const firstIndex = endIndex - weekdayOf(endIndex) - (weeks - 1) * 7
    let max = 0
    const columns: HeatmapDay[][] = []
    for (let week = 0; week < weeks; week++) {
        const column: HeatmapDay[] = []
        for (let day = 0; day < 7; day++) {
            const index = firstIndex + week * 7 + day
            const date = dateAt(index)
            const count = index > endIndex || index < startIndex ? null : days.get(date) || 0
            if (count && count > max) max = count
            column.push({ date, count })
        }
        columns.push(column)
    }
    return { weeks: columns, max }
}

/** Monday-to-Sunday weeks touched by the days from `from` to `to`. */
export const weeksSpanned = (from: string, to: string) => {
    const first = dayIndex(from)
    const last = dayIndex(to)
    return Math.floor((last - weekdayOf(last) - (first - weekdayOf(first))) / 7) + 1
}
