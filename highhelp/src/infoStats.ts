// Site-wide totals for the /info page.

// Days are bucketed in Sydney standard time (DST is ignored, so the boundary can be off by an hour).
const DAY = `date(created_at, '+10 hours')`

export const USERS_PER_DAY_SQL = `
    SELECT ${DAY} AS day, COUNT(*) AS n
    FROM users
    WHERE created_at IS NOT NULL
    GROUP BY day
    ORDER BY day
`

// Every saved attempt: first attempts plus each review re-attempt. A question is worth its marks,
// or 1 for an unmarked multiple-choice item (the ceiling statsQuery.ts and batch mode use).
export const ATTEMPTS_PER_DAY_SQL = `
    WITH a AS (
        SELECT question_id, created_at FROM user_question_attempts
        UNION ALL
        SELECT question_id, created_at FROM user_review_attempts
    )
    SELECT date(a.created_at, '+10 hours') AS day,
           COUNT(*) AS n,
           COALESCE(SUM(CASE WHEN q.marks > 0 THEN q.marks WHEN q.question_type = 'multiple_choice' THEN 1 ELSE 0 END), 0) AS marks
    FROM a
    LEFT JOIN exam_questions q ON q.id = a.question_id
    WHERE a.created_at IS NOT NULL
    GROUP BY day
    ORDER BY day
`

export function sydneyToday(now = Date.now()): string {
    return new Date(now + 10 * 3600 * 1000).toISOString().slice(0, 10)
}

/**
 * Turns per-day counts (sorted by day, YYYY-MM-DD) into a running total with one point per calendar
 * day through `until`, so gaps don't distort an evenly spaced axis. The series starts at its first
 * row, or at `from` if that is earlier (so several series can share one date range).
 */
export function cumulativeDaily(
    rows: { day: string; n: number }[],
    until: string,
    from?: string
): { labels: string[]; values: number[] } {
    const labels: string[] = []
    const values: number[] = []
    if (rows.length === 0 && !from) return { labels, values }

    const byDay = new Map<string, number>()
    for (const r of rows) byDay.set(r.day, (byDay.get(r.day) || 0) + Number(r.n || 0))

    const first = rows.length && (!from || rows[0].day < from) ? rows[0].day : from!
    const last = rows.length && rows[rows.length - 1].day > until ? rows[rows.length - 1].day : until
    let total = 0
    for (let d = new Date(first + 'T00:00:00Z'); ; d.setUTCDate(d.getUTCDate() + 1)) {
        const key = d.toISOString().slice(0, 10)
        total += byDay.get(key) || 0
        labels.push(key)
        values.push(total)
        if (key >= last) break
    }
    return { labels, values }
}
