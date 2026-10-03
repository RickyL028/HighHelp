import { getTopicIdsForHierarchy } from '../../utils'

export const PRACTICE_PAGE_SIZE = 50

export type PracticeSort = 'year_asc' | 'year_desc' | 'question_asc' | 'question_desc'

export const DEFAULT_PRACTICE_SORT: PracticeSort = 'year_asc'

const PRACTICE_SORTS: readonly string[] = ['year_asc', 'year_desc', 'question_asc', 'question_desc']

export const isPracticeSort = (value: string | undefined | null): value is PracticeSort =>
    !!value && PRACTICE_SORTS.includes(value)

export type RawPracticeFilters = {
    topic: string
    topicGroup: string
    school: string
    year: string
    status: '' | 'done' | 'undone'
    type: '' | 'multiple_choice' | 'short_answer' | 'extended_response'
    section: string
    marksMin: string
    marksMax: string
    sort: PracticeSort
}

export type PracticeFilters = {
    topicId: string
    topicLabel: string
    topicGroup: string
    topicGroupIds: number[]
    school: string
    year: string
    status: '' | 'done' | 'undone'
    type: '' | 'multiple_choice' | 'short_answer' | 'extended_response'
    section: string
    marksMin: number | null
    marksMax: number | null
    sort: PracticeSort
}

export type PracticeWhere = {
    from: string
    where: string
    params: any[]
}

export type PracticeWhereOptions = {
    paperId?: number
}

export type NeighborOrder = {
    expression: string
    direction: 'ASC' | 'DESC'
}[]

export type NeighborQuery = { sql: string; params: any[] }

export type NeighborQueries = {
    position: NeighborQuery
    previous: NeighborQuery
    next: NeighborQuery
}

// One row of the question-picker window, as returned by `buildNeighborWindowQuery`.
export type NeighborWindowRow = {
    id: number
    school_name: string | null
    academic_year: number | null
    section_label: string | null
    question_number: string | null
    marks: number | null
    question_type: string | null
    marks_awarded: number | null
}

const cleanText = (value: string | undefined, maxLength = 160) => (value || '').trim().slice(0, maxLength)

const parseMarks = (value: string) => {
    if (!/^\d+(?:\.\d+)?$/.test(value)) return null
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
}

export function readRawPracticeFilters(query: (key: string) => string | undefined): RawPracticeFilters {
    const sortValue = query('sort')
    const typeValue = query('type')
    const statusValue = query('status')

    return {
        topic: cleanText(query('topic')),
        topicGroup: cleanText(query('topic_group')),
        school: cleanText(query('school')),
        year: cleanText(query('year'), 40),
        status: statusValue === 'done' || statusValue === 'undone' ? statusValue : '',
        type: typeValue === 'multiple_choice' || typeValue === 'short_answer' || typeValue === 'extended_response' ? typeValue : '',
        section: cleanText(query('section'), 80),
        marksMin: cleanText(query('marks_min'), 20),
        marksMax: cleanText(query('marks_max'), 20),
        sort: isPracticeSort(sortValue) ? sortValue : DEFAULT_PRACTICE_SORT
    }
}

export async function resolvePracticeFilters(db: D1Database, subject: string, raw: RawPracticeFilters): Promise<PracticeFilters> {
    let topicId = ''
    let topicLabel = raw.topic

    if (raw.topic) {
        const row = /^\d+$/.test(raw.topic)
            ? await db.prepare('SELECT id, name FROM topics WHERE id = ? AND subject = ?').bind(raw.topic, subject).first<{ id: number; name: string }>()
            : await db.prepare('SELECT id, name FROM topics WHERE subject = ? AND name = ? COLLATE NOCASE').bind(subject, raw.topic).first<{ id: number; name: string }>()

        if (row) {
            topicId = String(row.id)
            topicLabel = row.name
        } else {
            topicId = '-1'
        }
    }

    const topicGroupIds = raw.topicGroup ? await getTopicIdsForHierarchy(db, subject, raw.topicGroup) : []
    const marksMin = parseMarks(raw.marksMin)
    const marksMax = parseMarks(raw.marksMax)

    return {
        topicId,
        topicLabel,
        topicGroup: raw.topicGroup,
        topicGroupIds,
        school: raw.school,
        year: raw.year,
        status: raw.status,
        type: raw.type,
        section: raw.section,
        marksMin,
        marksMax,
        sort: raw.sort
    }
}

export function buildPracticeWhere(userId: number, subject: string, filters: PracticeFilters, options: PracticeWhereOptions = {}): PracticeWhere {
    const from = `
        FROM exam_questions q
        JOIN papers p ON q.paper_id = p.id
        LEFT JOIN user_question_attempts ua ON q.id = ua.question_id AND ua.user_id = ?
    `
    const params: any[] = [userId, subject]
    const conditions = ['p.subject = ?', 'q.is_deleted = 0']

    if (filters.topicId && filters.topicGroup) {
        if (filters.topicGroupIds.length > 0) {
            const placeholders = filters.topicGroupIds.map(() => '?').join(', ')
            conditions.push(`EXISTS (SELECT 1 FROM question_topics qt WHERE qt.question_id = q.id AND qt.topic_id = ? AND qt.topic_id IN (${placeholders}))`)
            params.push(filters.topicId, ...filters.topicGroupIds)
        } else {
            conditions.push('0')
        }
    } else if (filters.topicId) {
        conditions.push('EXISTS (SELECT 1 FROM question_topics qt WHERE qt.question_id = q.id AND qt.topic_id = ?)')
        params.push(filters.topicId)
    } else if (filters.topicGroup) {
        if (filters.topicGroupIds.length > 0) {
            const placeholders = filters.topicGroupIds.map(() => '?').join(', ')
            conditions.push(`EXISTS (SELECT 1 FROM question_topics qt WHERE qt.question_id = q.id AND qt.topic_id IN (${placeholders}))`)
            params.push(...filters.topicGroupIds)
        } else {
            conditions.push('0')
        }
    }

    if (filters.school) {
        conditions.push('p.school_name = ?')
        params.push(filters.school)
    }
    if (filters.year) {
        conditions.push('p.academic_year = ?')
        params.push(filters.year)
    }
    if (filters.type) {
        conditions.push('q.question_type = ?')
        params.push(filters.type)
    }
    if (filters.section) {
        conditions.push('q.section_label = ?')
        params.push(filters.section)
    }
    if (filters.marksMin !== null) {
        conditions.push('q.marks >= ?')
        params.push(filters.marksMin)
    }
    if (filters.marksMax !== null) {
        conditions.push('q.marks <= ?')
        params.push(filters.marksMax)
    }
    if (filters.status === 'done') {
        conditions.push('ua.is_completed = 1')
    } else if (filters.status === 'undone') {
        conditions.push('(ua.is_completed IS NULL OR ua.is_completed = 0)')
    }

    if (options.paperId !== undefined) {
        conditions.push('q.paper_id = ?')
        params.push(options.paperId)
    }

    return { from, where: `WHERE ${conditions.join(' AND ')}`, params }
}

// `question_number` is free text ("1", "12", "32a", "A1", "b", "ii"), so ordering by it means
// ordering by the number it starts with. The cast has to happen in SQL for the ORDER BY and in
// JS for the keyset predicate, so both sides are pinned to the one expression and one mirror
// function below; `questionNumberKey` is verified against SQLite in the test suite.
const QUESTION_NUMBER_KEY = 'IFNULL(CAST(q.question_number AS INTEGER), 0)'
const QUESTION_NUMBER_TIEBREAK = 'q.question_number COLLATE NOCASE'

/** JS mirror of `CAST(x AS INTEGER)`: leading integer, truncated at the first non-digit, 0 when there is none. */
export const questionNumberKey = (value: string | null | undefined) => {
    const parsed = parseInt(String(value ?? '').trim(), 10)
    return Number.isFinite(parsed) ? parsed : 0
}

export const UNSORTED_SECTION_LABEL = 'Unsorted'

/** Section labels are "I", "II", "A", "1" — sort by the leading number so II does not precede I. */
export const sectionNumber = (value: string) => {
    const match = value.match(/\d+/);
    return match ? parseInt(match[0], 10) : NaN;
};

/**
 * The list and batch views present the flat `practiceOrder` result as section blocks, so both must
 * bucket identically or a batch started from the list reorders the questions. Order of the sections
 * is numeric where possible and alphabetical otherwise; rows inside a section keep the SQL order.
 */
export const groupBySection = <T extends { section_label?: string | null }>(rows: T[]): [string, T[]][] => {
    const grouped = new Map<string, T[]>();
    for (const row of rows) {
        const key = (row.section_label || '').trim() || UNSORTED_SECTION_LABEL;
        const current = grouped.get(key) || [];
        current.push(row);
        grouped.set(key, current);
    }
    return Array.from(grouped.entries()).sort(([a], [b]) => {
        const aNumber = sectionNumber(a);
        const bNumber = sectionNumber(b);
        if (!Number.isNaN(aNumber) && !Number.isNaN(bNumber)) return aNumber - bNumber;
        return a.localeCompare(b);
    });
};

/**
 * Every practice sort is defined once, as its ordered list of keys. The plain ORDER BY string is
 * rendered from the same list, so the list page and the keyset neighbour lookups on the attempt
 * page cannot drift apart.
 */
const practiceOrderParts = (sort: PracticeSort): NeighborOrder => {
    if (sort === 'year_desc' || sort === 'year_asc') {
        return [
            { expression: 'p.academic_year', direction: sort === 'year_desc' ? 'DESC' : 'ASC' },
            { expression: 'IFNULL(q.ordering_index, 0)', direction: 'ASC' },
            { expression: 'q.id', direction: 'ASC' }
        ]
    }

    // Every Q1 across every paper, then every Q2: the number leads, and the year breaks ties so
    // repeated numbers stay grouped by paper year rather than by insertion order.
    const direction = sort === 'question_desc' ? 'DESC' : 'ASC'
    return [
        { expression: QUESTION_NUMBER_KEY, direction },
        { expression: QUESTION_NUMBER_TIEBREAK, direction },
        { expression: 'p.academic_year', direction },
        { expression: 'q.id', direction }
    ]
}

export function practiceOrder(sort: PracticeSort) {
    return practiceOrderParts(sort)
        .map(part => `${part.expression} ${part.direction}`)
        .join(', ')
}

export function practiceNeighborOrder(sort: PracticeSort): NeighborOrder {
    return practiceOrderParts(sort)
}

export function buildPaperWhere(userId: number, paperId: number): PracticeWhere {
    return {
        from: `
            FROM exam_questions q
            JOIN papers p ON q.paper_id = p.id
            LEFT JOIN user_question_attempts ua ON q.id = ua.question_id AND ua.user_id = ?
        `,
        where: 'WHERE q.paper_id = ? AND q.is_deleted = 0',
        params: [userId, paperId]
    }
}

export const paperNeighborOrder: NeighborOrder = [
    { expression: 'IFNULL(q.ordering_index, 0)', direction: 'ASC' },
    { expression: 'q.id', direction: 'ASC' }
]

export function buildReviewWhere(userId: number, subject: string): PracticeWhere {
    return {
        from: `
            FROM exam_questions q
            JOIN papers p ON q.paper_id = p.id
            JOIN user_question_attempts ua ON q.id = ua.question_id AND ua.user_id = ?
            LEFT JOIN (
                SELECT question_id, is_completed, marks_awarded
                FROM (
                    SELECT question_id, is_completed, marks_awarded,
                           ROW_NUMBER() OVER (PARTITION BY question_id ORDER BY created_at DESC, id DESC) AS rn
                    FROM user_review_attempts
                    WHERE user_id = ?
                ) WHERE rn = 1
            ) ura ON q.id = ura.question_id
        `,
        where: 'WHERE p.subject = ? AND q.is_deleted = 0 AND (ua.marks_awarded < q.marks OR ua.marks_awarded IS NULL)',
        params: [userId, userId, subject]
    }
}

export const reviewNeighborOrder: NeighborOrder = [
    { expression: 'ua.created_at', direction: 'DESC' },
    { expression: 'q.id', direction: 'DESC' }
]

export type NeighborKeyRow = {
    id: number
    school_name: string
    academic_year: number
    question_number: string | null
    ordering_index: number | null
    created_at?: string | null
}

export function practiceNeighborKeys(sort: PracticeSort, row: NeighborKeyRow): any[] {
    if (sort === 'question_desc' || sort === 'question_asc') {
        return [questionNumberKey(row.question_number), row.question_number, row.academic_year, row.id];
    }
    const ordering = row.ordering_index ?? 0;
    return [row.academic_year, ordering, row.id];
}

// Where each practice sort key comes from on the current row, in the same order as
// `practiceNeighborKeys` and `practiceOrderParts`. `question_number_key` is the derived numeric
// key, not a column, so the list page and the navigation plan stay checkable against each other.
export type NeighborKeySource = 'academic_year' | 'ordering_index' | 'id' | 'question_number' | 'question_number_key'

export const practiceNeighborKeyFields: Record<PracticeSort, NeighborKeySource[]> = {
    year_asc: ['academic_year', 'ordering_index', 'id'],
    year_desc: ['academic_year', 'ordering_index', 'id'],
    question_asc: ['question_number_key', 'question_number', 'academic_year', 'id'],
    question_desc: ['question_number_key', 'question_number', 'academic_year', 'id']
}

export type NavigationPlanInput =
    | { source: 'practice'; userId: number; subject: string; filters: PracticeFilters; row: NeighborKeyRow }
    | { source: 'review'; userId: number; subject: string; questionId: number; attemptCreatedAt: string | null }
    | { source: 'paper'; userId: number; paperId: number; row: NeighborKeyRow }

export type NavigationPlan = {
    base: PracticeWhere
    order: NeighborOrder
    keys: any[]
}

/**
 * Resolves the base filter, the ORDER BY expressions and the sort-key values used for
 * neighbour lookups as a single unit. Keys must be positionally aligned with `order`,
 * so building them together here keeps the two from drifting apart.
 */
export function buildNavigationPlan(input: NavigationPlanInput): NavigationPlan {
    if (input.source === 'review') {
        return {
            base: buildReviewWhere(input.userId, input.subject),
            order: reviewNeighborOrder,
            keys: [input.attemptCreatedAt, input.questionId]
        }
    }

    if (input.source === 'paper') {
        return {
            base: buildPaperWhere(input.userId, input.paperId),
            order: paperNeighborOrder,
            keys: [input.row.ordering_index ?? 0, input.row.id]
        }
    }

    return {
        base: buildPracticeWhere(input.userId, input.subject, input.filters),
        order: practiceNeighborOrder(input.filters.sort),
        keys: practiceNeighborKeys(input.filters.sort, input.row)
    }
}

export function buildPracticeListQuery(userId: number, subject: string, filters: PracticeFilters, limit: number, offset: number) {
    const { from, where, params } = buildPracticeWhere(userId, subject, filters)
    return {
        sql: `
            SELECT q.id, q.paper_id, q.section_label, q.segment_label, q.question_number,
                   q.question_type, q.marks, q.question_text, q.question_image_key, q.ordering_index,
                   p.school_name, p.academic_year, ua.is_completed, ua.marks_awarded
            ${from}
            ${where}
            ORDER BY ${practiceOrder(filters.sort)}
            LIMIT ? OFFSET ?
        `,
        params: [...params, limit, offset]
    }
}

export const BATCH_PAGE_LIMIT = 500

export function buildBatchPracticeQuery(userId: number, subject: string, filters: PracticeFilters) {
    const { from, where, params } = buildPracticeWhere(userId, subject, filters)
    return {
        sql: `
            SELECT q.id, q.paper_id, q.section_label, q.segment_label, q.question_number,
                   q.question_type, q.marks, q.question_text, q.question_image_key, q.answer_image_key,
                   q.answer_text, q.stimulus_image_key, q.stimulus_text, q.mc_answer,
                   p.subject, p.school_name, p.academic_year, p.reference_link,
                   ua.response_content AS ua_response,
                   ua.selected_option AS ua_selected,
                   ua.marks_awarded AS ua_marks,
                   ua.is_completed AS ua_completed,
                   ua.marker_notes AS ua_notes,
                   ua.updated_at AS ua_updated
            ${from}
            ${where}
            ORDER BY ${practiceOrder(filters.sort)}
            LIMIT ?
        `,
        params: [...params, BATCH_PAGE_LIMIT]
    }
}

/**
 * The Review tab lists the questions worth revisiting: anything attempted without full marks, plus
 * anything the user wrote a note on — a note is a deliberate flag even when the marks were full.
 * Both the original attempt and the review attempt count as "has a note". Whitespace-only notes are
 * treated as empty, and NULLIF(TRIM(...)) keeps the predicate index-friendly rather than comparing
 * against a bare ''.
 *
 * `user_question_attempts` is UNIQUE(user_id, question_id), so one join row per question is
 * guaranteed and no GROUP BY is needed. The earlier version joined question_topics purely to
 * group_concat the topic names, which multiplied rows and required collapsing them again.
 */
export const reviewQueuePredicate = `
              AND (
                  ua.marks_awarded < q.marks
                  OR ua.marks_awarded IS NULL
                  OR NULLIF(TRIM(COALESCE(ua.marker_notes, '')), '') IS NOT NULL
                  OR NULLIF(TRIM(COALESCE(ura.marker_notes, '')), '') IS NOT NULL
              )
`

export function buildReviewQueueQuery(userId: number, subject: string) {
    return {
        sql: `
            SELECT q.*, p.school_name, p.academic_year,
                   ua.marks_awarded AS original_marks,
                   ua.created_at AS original_attempt_date,
                   ua.marker_notes AS original_notes,
                   ura.marks_awarded AS review_marks,
                   ura.marker_notes AS review_notes,
                   ura.is_completed AS review_completed
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
            ORDER BY ua.created_at DESC
        `,
        params: [userId, userId, userId, subject]
    }
}

export function buildPracticeSectionTypeQuery(userId: number, subject: string, filters: PracticeFilters) {
    const { from, where, params } = buildPracticeWhere(userId, subject, filters)
    return {
        sql: `
            SELECT q.section_label AS section_label,
                   MAX(CASE WHEN q.question_type = 'multiple_choice' THEN 1 ELSE 0 END) AS has_mcq
            ${from}
            ${where}
            GROUP BY q.section_label
        `,
        params
    }
}

export function buildPracticeCountQuery(userId: number, subject: string, filters: PracticeFilters) {
    const { from, where, params } = buildPracticeWhere(userId, subject, filters)
    return {
        sql: `SELECT COUNT(*) AS total ${from} ${where}`,
        params
    }
}

/**
 * Keyset comparison for an ordered key list: one OR-branch per key, each pinning the keys before
 * it and then stepping that key forward (or back). The result is a single expression, and callers
 * that append it to a WHERE must keep it parenthesised — SQLite binds AND tighter than OR, so a
 * bare `AND <this>` would let the later OR-branches escape the base filters.
 */
function comparisonPredicate(order: NeighborOrder, keys: any[], side: 'before' | 'after') {
    const branches: string[] = []
    const params: any[] = []

    order.forEach((part, index) => {
        const ascending = part.direction === 'ASC'
        const after = side === 'after'
        const operator = ascending === after ? '>' : '<'
        const equalities: string[] = []

        for (let previous = 0; previous < index; previous++) {
            equalities.push(`${order[previous].expression} = ?`)
            params.push(keys[previous])
        }
        equalities.push(`${part.expression} ${operator} ?`)
        params.push(keys[index])
        branches.push(`(${equalities.join(' AND ')})`)
    })

    return { sql: branches.length ? `(${branches.join(' OR ')})` : '0', params }
}

function orderClause(order: NeighborOrder, reverse = false) {
    return order
        .map(part => `${part.expression} ${reverse ? (part.direction === 'ASC' ? 'DESC' : 'ASC') : part.direction}`)
        .join(', ')
}

export function buildNeighborQueries(base: PracticeWhere, order: NeighborOrder, keys: any[], currentId: number): NeighborQueries {
    const before = comparisonPredicate(order, keys, 'before')
    const after = comparisonPredicate(order, keys, 'after')

    return {
        position: {
            sql: `
                SELECT COUNT(*) AS total,
                       COALESCE(SUM(CASE WHEN ${before.sql} THEN 1 ELSE 0 END), 0) AS before_count,
                       COALESCE(MAX(CASE WHEN q.id = ? THEN 1 ELSE 0 END), 0) AS found
                ${base.from}
                ${base.where}
            `,
                params: [...before.params, currentId, ...base.params]
        },
        previous: {
            sql: `
                SELECT q.id
                ${base.from}
                ${base.where}
                AND (${before.sql})
                ORDER BY ${orderClause(order, true)}
                LIMIT 1
            `,
            params: [...base.params, ...before.params]
        },
        next: {
            sql: `
                SELECT q.id
                ${base.from}
                ${base.where}
                AND (${after.sql})
                ORDER BY ${orderClause(order)}
                LIMIT 1
            `,
            params: [...base.params, ...after.params]
        }
    }
}

// Columns the question picker needs: identity, the source details shown on hover, and the marks
// the chip is labelled and coloured by. The review-attempt table is only joined in review mode,
// so its column is only read when it is there.
export const neighborWindowColumns = (reviewAttempts = false) => `
    q.id, p.school_name, p.academic_year, q.section_label, q.question_number, q.marks, q.question_type,
    ${reviewAttempts ? 'ura.marks_awarded, ua.marks_awarded' : 'ua.marks_awarded'} AS marks_awarded
`

/**
 * Fetches the questions immediately before or after the current one, in navigation order,
 * so a question picker can offer a window of neighbours without loading each one at a time.
 * "before" rows are returned nearest-first, which the caller reverses into sort order.
 */
export function buildNeighborWindowQuery(
    base: PracticeWhere,
    order: NeighborOrder,
    keys: any[],
    side: 'before' | 'after',
    limit: number,
    options: { reviewAttempts?: boolean } = {}
): NeighborQuery {
    const predicate = comparisonPredicate(order, keys, side)

    return {
        sql: `
            SELECT ${neighborWindowColumns(options.reviewAttempts)}
            ${base.from}
            ${base.where}
            AND (${predicate.sql})
            ORDER BY ${orderClause(order, side === 'before')}
            LIMIT ?
        `,
        params: [...base.params, ...predicate.params, limit]
    }
}

export function practiceUrlFilters(raw: RawPracticeFilters): Record<string, string> {
    return {
        school: raw.school,
        topic: raw.topic,
        topic_group: raw.topicGroup,
        year: raw.year,
        status: raw.status,
        sort: raw.sort,
        type: raw.type,
        section: raw.section,
        marks_min: raw.marksMin,
        marks_max: raw.marksMax
    }
}

export function buildPracticeUrl(subject: string, raw: RawPracticeFilters, extra: Record<string, string> = {}) {
    const params = new URLSearchParams({ subject, tab: 'practice' })
    const values: Record<string, string> = { ...practiceUrlFilters(raw), ...extra }
    Object.entries(values).forEach(([key, value]) => {
        if (value) params.set(key, value)
    })
    return `/past-papers?${params.toString()}`
}

export function buildPracticeRowsUrl(subject: string, raw: RawPracticeFilters, mode: string | undefined, offset: number) {
    const params = new URLSearchParams({ subject, offset: String(offset) })
    const values: Record<string, string> = { ...practiceUrlFilters(raw), mode: mode || '' }
    Object.entries(values).forEach(([key, value]) => {
        if (value) params.set(key, value)
    })
    return `/past-papers/rows?${params.toString()}`
}

export function buildPracticeExportUrl(subject: string, raw: RawPracticeFilters, search = '') {
    const params = new URLSearchParams({ subject })
    const values: Record<string, string> = { ...practiceUrlFilters(raw), q: search }
    Object.entries(values).forEach(([key, value]) => {
        if (value) params.set(key, value)
    })
    return `/past-papers/export-json?${params.toString()}`
}
