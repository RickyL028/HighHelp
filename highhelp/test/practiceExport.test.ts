import { describe, expect, it } from 'vitest';
import {
	buildPracticeExport,
	buildPracticeExportQueries,
	buildPracticeSearchClause,
	buildQuestionIdentifier,
	cleanExportSearch,
	exportFilename,
	parseStimulusCoordinates,
	toExportedQuestion,
	EXPORT_ROW_LIMIT,
	type PracticeExportRow
} from '../src/routes/pastPapers/practiceExport';
import { readRawPracticeFilters, type PracticeFilters } from '../src/routes/pastPapers/practiceQuery';

const baseFilters: PracticeFilters = {
	topicId: '',
	topicLabel: '',
	topicGroup: '',
	topicGroupIds: [],
	school: '',
	year: '',
	status: '',
	type: '',
	section: '',
	marksMin: null,
	marksMax: null,
	sort: 'year_asc'
};

const baseRow: PracticeExportRow = {
	id: 42,
	section_label: 'II',
	segment_label: 'A',
	question_number: '1',
	question_type: 'short_answer',
	marks: 4,
	question_text: 'Evaluate the derivative.',
	answer_text: '2x',
	mc_answer: null,
	stimulus_image_key: null,
	academic_year: 2025,
	paper_type: 'HSC Examination',
	topic_names: 'Calculus||Differential'
};

const rawFrom = (query: Record<string, string>) => readRawPracticeFilters(key => query[key]);

describe('buildQuestionIdentifier', () => {
	it('reads as "<year> <paper type> Q<number>"', () => {
		expect(buildQuestionIdentifier({ academic_year: 2025, paper_type: 'HSC', question_number: '1' })).toBe('2025 HSC Q1');
		expect(buildQuestionIdentifier({ academic_year: 2024, paper_type: 'Trial Paper', question_number: '22a' })).toBe('2024 Trial Paper Q22a');
	});

	it('falls back for missing paper details instead of emitting blanks', () => {
		expect(buildQuestionIdentifier({ academic_year: null, paper_type: null, question_number: null })).toBe('Undated Paper Q?');
		expect(buildQuestionIdentifier({ academic_year: 2025, paper_type: '  ', question_number: ' 7 ' })).toBe('2025 Paper Q7');
	});
});

describe('parseStimulusCoordinates', () => {
	it('unwraps a stored pdf_crop key', () => {
		const key = 'pdf_crop:{"page":35,"x":27.8,"y":32.1,"w":43.8,"h":16.5}';
		expect(parseStimulusCoordinates(key)).toEqual({ page: 35, x: 27.8, y: 32.1, w: 43.8, h: 16.5 });
	});

	it('returns null for real image keys, malformed crops and non-numeric fields', () => {
		expect(parseStimulusCoordinates('questions/123-diagram')).toBeNull();
		expect(parseStimulusCoordinates('pdf_crop:{oops}')).toBeNull();
		expect(parseStimulusCoordinates('pdf_crop:{"page":"35","x":1,"y":1,"w":1,"h":1}')).toBeNull();
		expect(parseStimulusCoordinates(null)).toBeNull();
	});
});

describe('toExportedQuestion', () => {
	it('emits the import shape with the identifier in place of the full label', () => {
		expect(toExportedQuestion(baseRow)).toEqual({
			question_id: 42,
			section_label: 'II',
			segment_label: 'A',
			question_number: '1',
			question_full_label: '2025 HSC Examination Q1',
			question_type: 'short_answer',
			marks: 4,
			question_text: 'Evaluate the derivative.',
			mc_answer: null,
			answer_text: '2x',
			topics: ['Calculus', 'Differential'],
			stimulus_coordinates: null
		});
	});

	it('mirrors the importer defaults for missing or unrecognised values', () => {
		const question = toExportedQuestion({
			...baseRow,
			section_label: null,
			segment_label: '  ',
			question_number: null,
			question_type: 'essay',
			marks: null,
			mc_answer: '  ',
			topic_names: null
		});
		expect(question.section_label).toBe('I');
		expect(question.segment_label).toBeNull();
		expect(question.question_number).toBe('?');
		expect(question.question_type).toBe('short_answer');
		expect(question.marks).toBeNull();
		expect(question.mc_answer).toBeNull();
		expect(question.topics).toEqual([]);
	});

	it('keeps recognised question types and drops blank topic entries', () => {
		const question = toExportedQuestion({
			...baseRow,
			question_type: 'multiple_choice',
			mc_answer: 'B',
			topic_names: 'Photosynthesis|| ||Cytology'
		});
		expect(question.question_type).toBe('multiple_choice');
		expect(question.mc_answer).toBe('B');
		expect(question.topics).toEqual(['Photosynthesis', 'Cytology']);
	});
});

describe('cleanExportSearch', () => {
	it('trims and bounds the search term', () => {
		expect(cleanExportSearch('  algebra ')).toBe('algebra');
		expect(cleanExportSearch(undefined)).toBe('');
		expect(cleanExportSearch('x'.repeat(200))).toHaveLength(120);
	});
});

describe('buildPracticeSearchClause', () => {
	it('adds nothing for an empty term', () => {
		expect(buildPracticeSearchClause('   ')).toEqual({ sql: '', params: [] });
	});

	it('matches the columns the practice list exposes to client-side search', () => {
		const clause = buildPracticeSearchClause('algebra');
		expect(clause.sql).toContain('p.school_name LIKE ?');
		expect(clause.sql).toContain('q.question_text LIKE ?');
		expect(clause.sql).toContain('q.question_type LIKE ?');
		expect(clause.params).toEqual(Array(clause.params.length).fill('%algebra%'));
	});

	it('escapes LIKE wildcards so a term cannot match everything', () => {
		const clause = buildPracticeSearchClause('100%_a\\b');
		expect(clause.params[0]).toBe('%100\\%\\_a\\\\b%');
	});
});

describe('buildPracticeExportQueries', () => {
	it('projects explicit columns and joins topics through a subquery', () => {
		const { list } = buildPracticeExportQueries(7, 'Mathematics', baseFilters);
		expect(list.sql).not.toContain('q.*');
		expect(list.sql).toContain('GROUP_CONCAT(t.name,');
		expect(list.sql).toContain('p.paper_type');
		expect(list.sql).toContain('SELECT q.id,');
	});

	it('caps the export and orders it by the active sort', () => {
		const { list } = buildPracticeExportQueries(7, 'Mathematics', { ...baseFilters, sort: 'year_desc' });
		expect(list.sql).toContain('ORDER BY p.academic_year DESC');
		expect(list.params.slice(-1)).toEqual([EXPORT_ROW_LIMIT]);
	});

	it('counts every matching row without a limit', () => {
		const { count } = buildPracticeExportQueries(7, 'Mathematics', baseFilters);
		expect(count.sql).toContain('COUNT(*)');
		expect(count.sql).not.toContain('LIMIT');
	});

	it('binds base params, then search params, then the limit', () => {
		const { list, count } = buildPracticeExportQueries(7, 'Mathematics', { ...baseFilters, school: 'SBHS' }, 'algebra');
		expect(count.params).toEqual([7, 'Mathematics', 'SBHS', ...buildPracticeSearchClause('algebra').params]);
		expect(list.params.slice(0, count.params.length)).toEqual(count.params);
		expect(list.params.slice(-1)).toEqual([EXPORT_ROW_LIMIT]);
		expect(list.sql).toContain('p.school_name = ?');
	});
});

describe('buildPracticeExport', () => {
	const options = { rawFilters: rawFrom({ school: 'SBHS', sort: 'year_desc' }), search: 'algebra', exportedAt: '2026-09-26T00:00:00.000Z', totalMatching: 12 };

	it('wraps mapped rows in the import-compatible envelope', () => {
		const payload = buildPracticeExport('Mathematics', [baseRow], { ...options, totalMatching: 1 });
		expect(payload.questions).toHaveLength(1);
		expect(payload.questions[0].question_full_label).toBe('2025 HSC Examination Q1');
		expect(payload.subject).toBe('Mathematics');
		expect(payload.exported_at).toBe('2026-09-26T00:00:00.000Z');
	});

	it('echoes only the filters that were applied', () => {
		const payload = buildPracticeExport('Mathematics', [], options);
		expect(payload.filters).toEqual({ school: 'SBHS', sort: 'year_desc', q: 'algebra' });
		expect(payload.questions).toEqual([]);
	});

	it('flags a truncated export so a partial file is obvious', () => {
		expect(buildPracticeExport('Mathematics', [], { ...options, totalMatching: 500 }).truncated).toBe(true);
		expect(buildPracticeExport('Mathematics', [baseRow], { ...options, totalMatching: 1 }).truncated).toBe(false);
	});
});

describe('exportFilename', () => {
	it('slugs the subject and dates the file', () => {
		expect(exportFilename('Biology (HSC)', '2026-09-26T01:02:03.000Z')).toBe('practice-biology-hsc-2026-09-26.json');
		expect(exportFilename('Other', '')).toBe('practice-other-export.json');
	});
});
