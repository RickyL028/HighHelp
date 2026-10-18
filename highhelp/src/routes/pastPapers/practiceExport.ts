import { buildPracticeSearchClause, buildPracticeWhere, practiceOrder, practiceUrlFilters, type PracticeFilters, type RawPracticeFilters } from './practiceQuery'

// The search clause now lives with the other practice filters; re-exported for existing callers.
export { buildPracticeSearchClause }

export const EXPORT_ROW_LIMIT = 2000

const TOPIC_SEPARATOR = '||'

const QUESTION_TYPES = ['multiple_choice', 'short_answer', 'extended_response'] as const

export type QuestionType = (typeof QUESTION_TYPES)[number]

export type StimulusCoordinates = {
    page: number
    x: number
    y: number
    w: number
    h: number
}

export type PracticeExportRow = {
    id: number
    section_label: string | null
    segment_label: string | null
    question_number: string | null
    question_type: string | null
    marks: number | null
    question_text: string | null
    answer_text: string | null
    mc_answer: string | null
    stimulus_image_key: string | null
    academic_year: number | null
    paper_type: string | null
    topic_names: string | null
}

export type ExportedQuestion = {
    // Not part of the AI import format (the importer ignores it); lets an exported list be turned back into a mock exam.
    question_id: number
    section_label: string
    segment_label: string | null
    question_number: string
    question_full_label: string
    question_type: QuestionType
    marks: number | null
    question_text: string | null
    mc_answer: string | null
    answer_text: string | null
    topics: string[]
    stimulus_coordinates: StimulusCoordinates | null
}

export type PracticeExportPayload = {
    subject: string
    exported_at: string
    filters: Record<string, string>
    total_matching: number
    truncated: boolean
    questions: ExportedQuestion[]
}

const trimmedOrNull = (value: string | null) => {
    const trimmed = (value || '').trim()
    return trimmed || null
}

export function buildQuestionIdentifier(row: { academic_year: number | null; paper_type: string | null; question_number: string | null }): string {
    const year = row.academic_year ? String(row.academic_year) : 'Undated'
    const paperType = (row.paper_type || '').trim() || 'Paper'
    const number = (row.question_number || '').trim() || '?'
    return `${year} ${paperType} Q${number}`
}

export function parseStimulusCoordinates(key: string | null): StimulusCoordinates | null {
    if (!key || !key.startsWith('pdf_crop:')) return null
    try {
        const parsed = JSON.parse(key.slice('pdf_crop:'.length))
        if (!parsed || typeof parsed !== 'object') return null
        const { page, x, y, w, h } = parsed as Record<string, unknown>
        if ([page, x, y, w, h].some(value => typeof value !== 'number' || !Number.isFinite(value))) return null
        return { page, x, y, w, h } as StimulusCoordinates
    } catch {
        return null
    }
}

export function toExportedQuestion(row: PracticeExportRow): ExportedQuestion {
    return {
        question_id: row.id,
        section_label: (row.section_label || '').trim() || 'I',
        segment_label: trimmedOrNull(row.segment_label),
        question_number: (row.question_number || '').trim() || '?',
        question_full_label: buildQuestionIdentifier(row),
        question_type: QUESTION_TYPES.includes(row.question_type as QuestionType) ? (row.question_type as QuestionType) : 'short_answer',
        marks: row.marks ?? null,
        question_text: row.question_text ?? null,
        mc_answer: trimmedOrNull(row.mc_answer),
        answer_text: row.answer_text ?? null,
        topics: (row.topic_names || '')
            .split(TOPIC_SEPARATOR)
            .map(topic => topic.trim())
            .filter(Boolean),
        stimulus_coordinates: parseStimulusCoordinates(row.stimulus_image_key)
    }
}

export function cleanExportSearch(term: string | undefined): string {
    return (term || '').trim().slice(0, 120)
}

export function buildPracticeExportQueries(userId: number, subject: string, filters: PracticeFilters, search = '') {
    const { from, where, params } = buildPracticeWhere(userId, subject, filters)
    const searchClause = buildPracticeSearchClause(search)
    const scopedWhere = searchClause.sql ? `${where} ${searchClause.sql}` : where
    const scopedParams = [...params, ...searchClause.params]

    return {
        list: {
            sql: `
                SELECT q.id, q.section_label, q.segment_label, q.question_number, q.question_type, q.marks,
                       q.question_text, q.answer_text, q.mc_answer, q.stimulus_image_key,
                       p.academic_year, p.paper_type,
                       (SELECT GROUP_CONCAT(t.name, '${TOPIC_SEPARATOR}') FROM question_topics qt
                          JOIN topics t ON t.id = qt.topic_id WHERE qt.question_id = q.id) AS topic_names
                ${from}
                ${scopedWhere}
                ORDER BY ${practiceOrder(filters.sort)}
                LIMIT ?
            `,
            params: [...scopedParams, EXPORT_ROW_LIMIT]
        },
        count: {
            sql: `SELECT COUNT(*) AS total ${from} ${scopedWhere}`,
            params: scopedParams
        }
    }
}

export function buildPracticeExport(
    subject: string,
    rows: PracticeExportRow[],
    options: { rawFilters: RawPracticeFilters; search?: string; exportedAt: string; totalMatching: number }
): PracticeExportPayload {
    const filterValues: Record<string, string> = { ...practiceUrlFilters(options.rawFilters) }
    if (options.search) filterValues.q = options.search.trim()
    const questions = rows.map(toExportedQuestion)

    return {
        subject,
        exported_at: options.exportedAt,
        filters: Object.fromEntries(Object.entries(filterValues).filter(([, value]) => value)),
        total_matching: options.totalMatching,
        truncated: questions.length < options.totalMatching,
        questions
    }
}

export function exportFilename(subject: string, exportedAt: string): string {
    const slug = subject.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'subject'
    const date = (exportedAt || '').slice(0, 10) || 'export'
    return `practice-${slug}-${date}.json`
}
