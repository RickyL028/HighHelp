import { describe, expect, it } from 'vitest';
import {
	buildNavigationPlan,
	buildNeighborQueries,
	buildNeighborWindowQuery,
	buildPaperWhere,
	buildPracticeCountQuery,
	buildPracticeListQuery,
	buildPracticeWhere,
	buildReviewWhere,
	paperNeighborOrder,
	practiceNeighborKeyFields,
	practiceNeighborKeys,
	practiceNeighborOrder,
	readRawPracticeFilters,
	resolvePracticeFilters,
	reviewNeighborOrder,
	type PracticeFilters
} from '../src/routes/pastPapers/practiceQuery';

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
	sort: 'school_asc'
};

const rawFrom = (query: Record<string, string>) => readRawPracticeFilters(key => query[key]);

describe('readRawPracticeFilters', () => {
	it('defaults sort to school_asc and rejects unknown values', () => {
		expect(rawFrom({}).sort).toBe('school_asc');
		expect(rawFrom({ sort: 'year_desc' }).sort).toBe('year_desc');
		expect(rawFrom({ sort: 'year_asc' }).sort).toBe('year_asc');
		expect(rawFrom({ sort: 'rm -rf' }).sort).toBe('school_asc');
	});

	it('only accepts known status and type values', () => {
		expect(rawFrom({ status: 'done' }).status).toBe('done');
		expect(rawFrom({ status: 'undone' }).status).toBe('undone');
		expect(rawFrom({ status: 'nonsense' }).status).toBe('');
		expect(rawFrom({ type: 'multiple_choice' }).type).toBe('multiple_choice');
		expect(rawFrom({ type: 'essay' }).type).toBe('');
	});

	it('trims and bounds free-text filters', () => {
		const raw = rawFrom({ school: '  Brighton Grammar  ', topic_group: ' Algebra ', year: '2024' });
		expect(raw.school).toBe('Brighton Grammar');
		expect(raw.topicGroup).toBe('Algebra');
		expect(raw.year).toBe('2024');
	});
});

describe('resolvePracticeFilters', () => {
	it('rejects a malformed marks range instead of passing it through to SQL', async () => {
		const raw = rawFrom({ marks_min: '1; DROP TABLE users', marks_max: 'abc' });
		const db = { prepare: () => ({ bind: () => ({ first: async () => null }) }) } as unknown as D1Database;
		const filters = await resolvePracticeFilters(db, 'Mathematics', raw);
		expect(filters.marksMin).toBeNull();
		expect(filters.marksMax).toBeNull();
	});

	it('parses a valid marks range', async () => {
		const raw = rawFrom({ marks_min: '2', marks_max: '6.5' });
		const db = { prepare: () => ({ bind: () => ({ first: async () => null }) }) } as unknown as D1Database;
		const filters = await resolvePracticeFilters(db, 'Mathematics', raw);
		expect(filters.marksMin).toBe(2);
		expect(filters.marksMax).toBe(6.5);
	});

	it('sentinels an unknown topic so the query returns nothing', async () => {
		const db = {
			prepare: (sql: string) => ({
				bind: () => ({ first: async () => (sql.includes('SELECT id, name FROM topics') ? null : null) })
			})
		} as unknown as D1Database;
		const filters = await resolvePracticeFilters(db, 'Mathematics', rawFrom({ topic: 'Not A Topic' }));
		expect(filters.topicId).toBe('-1');
	});
});

describe('buildPracticeWhere', () => {
	it('always scopes to the subject and excludes deleted questions', () => {
		const { where, params } = buildPracticeWhere(7, 'Mathematics', baseFilters);
		expect(where).toContain('p.subject = ?');
		expect(where).toContain('q.is_deleted = 0');
		expect(params).toEqual([7, 'Mathematics']);
	});

	it('uses EXISTS instead of joining question_topics', () => {
		const { where, params } = buildPracticeWhere(7, 'Mathematics', {
			...baseFilters,
			topicId: '12'
		});
		expect(where).toContain('EXISTS (SELECT 1 FROM question_topics');
		expect(where).not.toContain('JOIN question_topics');
		expect(params).toEqual([7, 'Mathematics', '12']);
	});

	it('intersects topic and topic group', () => {
		const { where, params } = buildPracticeWhere(7, 'Mathematics', {
			...baseFilters,
			topicId: '12',
			topicGroup: 'Algebra',
			topicGroupIds: [12, 13, 14]
		});
		expect(where).toContain('qt.topic_id = ? AND qt.topic_id IN (?, ?, ?)');
		expect(params).toEqual([7, 'Mathematics', '12', 12, 13, 14]);
	});

	it('returns nothing when the requested topic group is unknown', () => {
		const { where } = buildPracticeWhere(7, 'Mathematics', {
			...baseFilters,
			topicGroup: 'Nonsense',
			topicGroupIds: []
		});
		expect(where).toContain('0');
	});

	it('returns nothing when a topic and an unknown topic group are combined', () => {
		const { where } = buildPracticeWhere(7, 'Mathematics', {
			...baseFilters,
			topicId: '-1',
			topicGroup: 'Nonsense',
			topicGroupIds: []
		});
		expect(where).toContain('0');
	});

	it('adds every supported filter condition', () => {
		const { where, params } = buildPracticeWhere(7, 'Mathematics', {
			...baseFilters,
			school: 'SBHS',
			year: '2024',
			type: 'short_answer',
			section: 'Section A',
			marksMin: 2,
			marksMax: 8,
			status: 'undone'
		});
		expect(where).toContain('p.school_name = ?');
		expect(where).toContain('p.academic_year = ?');
		expect(where).toContain('q.question_type = ?');
		expect(where).toContain('q.section_label = ?');
		expect(where).toContain('q.marks >= ?');
		expect(where).toContain('q.marks <= ?');
		expect(where).toContain('(ua.is_completed IS NULL OR ua.is_completed = 0)');
		expect(params).toEqual([7, 'Mathematics', 'SBHS', '2024', 'short_answer', 'Section A', 2, 8]);
	});

	it('scopes to a single paper when asked', () => {
		const { where, params } = buildPracticeWhere(7, 'Mathematics', baseFilters, { paperId: 99 });
		expect(where).toContain('q.paper_id = ?');
		expect(params).toEqual([7, 'Mathematics', 99]);
	});
});

describe('ordering', () => {
	it('always ends with q.id so pagination is stable', () => {
		for (const sort of ['school_asc', 'year_desc', 'year_asc'] as const) {
			expect(practiceNeighborOrder(sort)[practiceNeighborOrder(sort).length - 1].expression).toBe('q.id');
		}
	});

	it('sorts years in the requested direction', () => {
		expect(practiceNeighborOrder('year_desc')[0]).toEqual({ expression: 'p.academic_year', direction: 'DESC' });
		expect(practiceNeighborOrder('year_asc')[0]).toEqual({ expression: 'p.academic_year', direction: 'ASC' });
		expect(paperNeighborOrder.map(part => part.direction)).toEqual(['ASC', 'ASC']);
	});
});

describe('practiceNeighborKeys', () => {
	const row = { id: 7, school_name: 'SBHS', academic_year: 2024, ordering_index: null };

	it('uses the school as the leading key only for school ordering', () => {
		expect(practiceNeighborKeys('school_asc', row)).toEqual(['SBHS', 0, 7]);
	});

	it('uses the year as the leading key for year ordering', () => {
		expect(practiceNeighborKeys('year_desc', row)).toEqual([2024, 0, 7]);
		expect(practiceNeighborKeys('year_asc', row)).toEqual([2024, 0, 7]);
	});

	it('keeps a present ordering index', () => {
		expect(practiceNeighborKeys('school_asc', { ...row, ordering_index: 3 })).toEqual(['SBHS', 3, 7]);
	});
});

describe('buildPracticeListQuery', () => {
	it('projects explicit columns instead of q.*', () => {
		const list = buildPracticeListQuery(7, 'Mathematics', baseFilters, 51, 0);
		expect(list.sql).not.toContain('q.*');
		expect(list.sql).toContain('q.question_image_key');
		expect(list.sql).toContain('ua.is_completed');
	});

	it('applies the limit and offset after the filters and order', () => {
		const list = buildPracticeListQuery(7, 'Mathematics', baseFilters, 51, 100);
		expect(list.sql.indexOf('ORDER BY')).toBeLessThan(list.sql.indexOf('LIMIT'));
		expect(list.params.slice(-2)).toEqual([51, 100]);
	});
});

describe('buildPracticeCountQuery', () => {
	it('counts every filtered row rather than a page', () => {
		const count = buildPracticeCountQuery(7, 'Mathematics', baseFilters);
		expect(count.sql).toContain('COUNT(*)');
		expect(count.sql).not.toContain('LIMIT');
	});
});

describe('buildNeighborQueries', () => {
	const order = practiceNeighborOrder('school_asc');
	const keys = ['SBHS', 3, 42];

	it('counts the rows before the current question to derive its position', () => {
		const base = buildPracticeWhere(7, 'Mathematics', baseFilters);
		const queries = buildNeighborQueries(base, order, keys, 42);
		expect(queries.position.sql).toContain('before_count');
		expect(queries.position.sql).toContain('q.id = ?');
		// placeholders appear in SQL text order: before-predicate, current id, then the base clause
		expect(queries.position.params.slice(0, 6)).toEqual(['SBHS', 'SBHS', 3, 'SBHS', 3, 42]);
		expect(queries.position.params[6]).toBe(42);
		expect(queries.position.params.slice(7)).toEqual([7, 'Mathematics']);
	});

	it('binds the neighbor lookups in SQL text order', () => {
		const base = buildPracticeWhere(7, 'Mathematics', baseFilters);
		const queries = buildNeighborQueries(base, order, keys, 42);
		for (const side of ['previous', 'next'] as const) {
			expect(queries[side].params.slice(0, 2)).toEqual([7, 'Mathematics']);
			expect(queries[side].params.slice(2)).toEqual(['SBHS', 'SBHS', 3, 'SBHS', 3, 42]);
		}
	});

	it('walks backwards in reverse order to find the previous question', () => {
		const base = buildPracticeWhere(7, 'Mathematics', baseFilters);
		const queries = buildNeighborQueries(base, order, keys, 42);
		expect(queries.previous.sql).toContain('ORDER BY p.school_name DESC');
		expect(queries.previous.sql).toContain('LIMIT 1');
	});

	it('walks forwards in sort order to find the next question', () => {
		const base = buildPracticeWhere(7, 'Mathematics', baseFilters);
		const queries = buildNeighborQueries(base, order, keys, 42);
		expect(queries.next.sql).toContain('ORDER BY p.school_name ASC');
		expect(queries.next.sql).toContain('LIMIT 1');
	});

	it('escapes mixed sort directions correctly', () => {
		const base = buildPracticeWhere(7, 'Mathematics', baseFilters);
		const queries = buildNeighborQueries(base, practiceNeighborOrder('year_desc'), ['2024', 1, 5], 5);
		// year DESC + ordering ASC means "before" is a strictly greater year
		expect(queries.next.sql).toContain('p.academic_year < ?');
		expect(queries.previous.sql).toContain('p.academic_year > ?');
	});
});

describe('buildNeighborWindowQuery', () => {
	const order = practiceNeighborOrder('school_asc');
	const keys = ['SBHS', 3, 42];

	it('binds the base clause, the neighbour predicate and the limit in SQL text order', () => {
		const base = buildPracticeWhere(7, 'Mathematics', baseFilters);
		const query = buildNeighborWindowQuery(base, order, keys, 'after', 20);
		expect(query.params.slice(0, 2)).toEqual([7, 'Mathematics']);
		expect(query.params.slice(2, 8)).toEqual(['SBHS', 'SBHS', 3, 'SBHS', 3, 42]);
		expect(query.params[8]).toBe(20);
	});

	it('walks forwards in sort order for the questions after the current one', () => {
		const base = buildPracticeWhere(7, 'Mathematics', baseFilters);
		const query = buildNeighborWindowQuery(base, order, keys, 'after', 10);
		expect(query.sql).toContain('ORDER BY p.school_name ASC');
		expect(query.sql).toContain('LIMIT ?');
	});

	it('walks backwards in reverse order for the questions before the current one', () => {
		const base = buildPracticeWhere(7, 'Mathematics', baseFilters);
		const query = buildNeighborWindowQuery(base, order, keys, 'before', 9);
		expect(query.sql).toContain('ORDER BY p.school_name DESC');
	});

	it('selects the fields the question picker labels and tooltips need', () => {
		const base = buildPracticeWhere(7, 'Mathematics', baseFilters);
		const query = buildNeighborWindowQuery(base, order, keys, 'after', 20);
		for (const column of ['q.id', 'p.school_name', 'p.academic_year', 'q.section_label', 'q.question_number', 'q.marks']) {
			expect(query.sql).toContain(column);
		}
		expect(query.sql).toContain('COALESCE(ua.is_completed, 0) AS is_completed');
	});

	it('resolves the school and year of paper questions by joining papers', () => {
		const base = buildPaperWhere(7, 55);
		const query = buildNeighborWindowQuery(base, paperNeighborOrder, [0, 42], 'after', 20);
		expect(base.from).toContain('JOIN papers p');
		expect(query.sql).toContain('p.school_name');
		expect(query.params[0]).toBe(7);
		expect(query.params[1]).toBe(55);
	});

	it('prefers the review attempt for completion in review mode', () => {
		const base = buildReviewWhere(7, 'Mathematics');
		const query = buildNeighborWindowQuery(base, reviewNeighborOrder, ['2024-05-01 00:00:00', 42], 'before', 9, { reviewAttempts: true });
		expect(base.from).toContain('user_review_attempts');
		expect(query.sql).toContain('COALESCE(ura.is_completed, ua.is_completed, 0) AS is_completed');
		expect(query.sql).toContain('ORDER BY ua.created_at ASC');
	});
});

describe('buildNavigationPlan', () => {
	const row = { id: 7, school_name: 'SBHS', academic_year: 2024, ordering_index: 2 };

	// Maps an ORDER BY expression back to the row field it reads, so a key built from the
	// wrong column is detected instead of silently producing a wrong position.
	const fieldFor = (expression: string) => {
		if (expression.includes('academic_year')) return 'academic_year';
		if (expression.includes('school_name')) return 'school_name';
		if (expression.includes('ordering_index')) return 'ordering_index';
		if (expression.includes('ua.created_at')) return 'attemptCreatedAt';
		if (expression.endsWith('q.id')) return 'id';
		throw new Error(`unmapped order expression: ${expression}`);
	};

	it('keeps practice keys aligned with the ordering for every sort', () => {
		for (const sort of ['school_asc', 'year_desc', 'year_asc'] as const) {
			const plan = buildNavigationPlan({
				source: 'practice',
				userId: 1,
				subject: 'Mathematics',
				filters: { ...baseFilters, sort },
				row
			});
			const expected = practiceNeighborKeyFields[sort];
			expect(expected).toHaveLength(plan.order.length);
			expect(plan.order.map(part => fieldFor(part.expression))).toEqual(expected);
			expect(plan.keys).toEqual(expected.map(field => (row as any)[field]));
		}
	});

	it('does not use the school as the leading key for year ordering', () => {
		const plan = buildNavigationPlan({
			source: 'practice',
			userId: 1,
			subject: 'Mathematics',
			filters: { ...baseFilters, sort: 'year_desc' },
			row
		});
		expect(plan.keys[0]).toBe(2024);
		expect(plan.keys).not.toContain('SBHS');
	});

	it('keeps paper navigation keys aligned with paper ordering', () => {
		const plan = buildNavigationPlan({ source: 'paper', userId: 1, paperId: 5, row });
		expect(plan.order).toEqual(paperNeighborOrder);
		expect(plan.keys).toEqual([2, 7]);
		expect(plan.base.where).toContain('q.paper_id = ?');
	});

	it('keeps review navigation keys aligned with review ordering', () => {
		const plan = buildNavigationPlan({
			source: 'review',
			userId: 1,
			subject: 'Mathematics',
			questionId: 7,
			attemptCreatedAt: '2026-01-01 00:00:00'
		});
		expect(plan.order).toEqual(reviewNeighborOrder);
		expect(plan.keys).toEqual(['2026-01-01 00:00:00', 7]);
	});

	it('keeps every plan bindable with a real query', () => {
		for (const plan of [
			buildNavigationPlan({ source: 'practice', userId: 1, subject: 'Mathematics', filters: baseFilters, row }),
			buildNavigationPlan({ source: 'paper', userId: 1, paperId: 5, row }),
			buildNavigationPlan({ source: 'review', userId: 1, subject: 'Mathematics', questionId: 7, attemptCreatedAt: null })
		]) {
			const queries = buildNeighborQueries(plan.base, plan.order, plan.keys, 7);
			const count = (sql: string) => (sql.match(/\?/g) || []).length;
			expect(queries.position.params).toHaveLength(count(queries.position.sql));
			expect(queries.previous.params).toHaveLength(count(queries.previous.sql));
			expect(queries.next.params).toHaveLength(count(queries.next.sql));
		}
	});
});

describe('buildPaperWhere', () => {
	it('scopes navigation to a single paper', () => {
		const base = buildPaperWhere(7, 55);
		expect(base.where).toContain('q.paper_id = ?');
		expect(base.params).toEqual([7, 55]);
	});
});

describe('buildReviewWhere', () => {
	it('keeps the latest review attempt per question', () => {
		const base = buildReviewWhere(7, 'Mathematics');
		expect(base.from).toContain('ROW_NUMBER() OVER');
		expect(base.where).toContain('ua.marks_awarded < q.marks');
		expect(base.params).toEqual([7, 7, 'Mathematics']);
	});
});
