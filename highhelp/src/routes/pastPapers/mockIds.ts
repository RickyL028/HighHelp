// Helpers for building a mock exam from a typed/pasted list of question IDs
// (e.g. IDs an AI picked out of the practice JSON export).

export const MAX_MOCK_QUESTIONS = 200

// D1 caps bound parameters per statement at 100.
const LOOKUP_CHUNK = 90
const INSERT_CHUNK = 33

export type ParsedQuestionIds = {
    ids: number[]
    invalid: string[]
    duplicates: number[]
}

// Accepts "1, 4, 100,49", one-per-line lists, "[1, 4]" or "#12 #40". Order is kept; repeats are dropped.
export function parseQuestionIdList(raw: string): ParsedQuestionIds {
    const ids: number[] = []
    const invalid: string[] = []
    const duplicates: number[] = []
    const seen = new Set<number>()

    for (const token of (raw || '').split(/[\s,;[\]]+/)) {
        if (!token) continue
        const match = token.match(/^#?(\d{1,9})$/)
        const id = match ? Number(match[1]) : 0
        if (!id) {
            invalid.push(token)
            continue
        }
        if (seen.has(id)) {
            if (!duplicates.includes(id)) duplicates.push(id)
            continue
        }
        seen.add(id)
        ids.push(id)
    }

    return { ids, invalid, duplicates }
}

const chunk = <T>(items: T[], size: number): T[][] => {
    const out: T[][] = []
    for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
    return out
}

// One statement per chunk; each returns the IDs that exist, aren't deleted and belong to `subject`.
export function buildQuestionIdLookups(ids: number[], subject: string) {
    return chunk(ids, LOOKUP_CHUNK).map(part => ({
        sql: `
            SELECT q.id
            FROM exam_questions q
            JOIN papers p ON q.paper_id = p.id
            WHERE p.subject = ? AND q.is_deleted = 0 AND q.id IN (${part.map(() => '?').join(', ')})
        `,
        params: [subject, ...part] as (string | number)[]
    }))
}

export function missingQuestionIds(requested: number[], found: Iterable<number>): number[] {
    const foundSet = new Set(Array.from(found, Number))
    return requested.filter(id => !foundSet.has(id))
}

export function buildMockQuestionInserts(examId: number, ids: number[]) {
    return chunk(ids, INSERT_CHUNK).map((part, chunkIndex) => ({
        sql: `INSERT INTO mock_exam_questions (mock_exam_id, question_id, ordering_index) VALUES ${part.map(() => '(?, ?, ?)').join(', ')}`,
        params: part.flatMap((id, i) => [examId, id, chunkIndex * INSERT_CHUNK + i])
    }))
}
