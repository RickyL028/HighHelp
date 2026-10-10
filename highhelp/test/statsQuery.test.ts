import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { buildReviewQueueQuery } from '../src/routes/pastPapers/practiceQuery';
import {
	DEFAULT_STATS_FILTERS,
	MIN_TOPIC_MARKS,
	activityHeatmap,
	activitySummary,
	buildActivityQuery,
	buildBreakdownQuery,
	buildMockListQuery,
	buildMockStatsQuery,
	buildPaperListQuery,
	buildPaperResultsQuery,
	buildReviewStatsQuery,
	buildTopicGroups,
	buildTopicStatsQuery,
	buildTopicUnitQuery,
	dailyActivity,
	daysWithin,
	examWeights,
	focusTopics,
	readStatsFilters,
	statsFilterParams,
	statsScope,
	summarizeBreakdown,
	summarizeMocks,
	summarizePapers,
	summarizeTopics,
	sydneyDate,
	sydneyMidnight,
	topicGroupsJson,
	topicUnitMap,
	weeksSpanned,
	type ActivityRow,
	type BreakdownRow,
	type MockRow,
	type PaperResultRow,
	type PaperRow,
	type StatsScope,
	type TopicUnitRow,
	type TopicSummary
} from '../src/routes/pastPapers/statsQuery';

const paper = (id: number, kind: PaperRow['kind'], year: number, extra: Partial<PaperRow> = {}): PaperRow => ({
	id,
	school_name: kind === 'hsc' ? 'HSC' : 'Sydney Boys High School',
	academic_year: year,
	paper_type: kind === 'hsc' ? 'HSC Examination' : kind === 'trial' ? 'Trial Paper' : 'Half Yearly',
	kind,
	questions: 10,
	...extra
});

const topic = (key: string, extra: Partial<TopicSummary> = {}): TopicSummary => ({
	key,
	name: key,
	questions: 10,
	attempted: 0,
	marksAttempted: 0,
	marksEarned: 0,
	accuracy: null,
	coverage: 0,
	avgMarks: 10,
	papers: 1,
	topicIds: [],
	subtopics: [],
	...extra
});

describe('buildTopicGroups', () => {
	it('folds subtopics under their topic, as the Browse tab does', () => {
		const groups = buildTopicGroups([
			{ id: 1, name: 'Calculus' },
			{ id: 2, name: 'Calculus 1.2 Differentiation' },
			{ id: 3, name: 'calculus - Integration' },
			{ id: 4, name: 'Probability' },
			{ id: 5, name: '   ' }
		]);
		expect(groups).toEqual([
			{
				key: 'calculus',
				name: 'Calculus',
				topicIds: [1, 2, 3],
				subtopics: [
					{ key: 'differentiation', name: '1.2 Differentiation', topicIds: [2] },
					{ key: 'integration', name: 'Integration', topicIds: [3] }
				]
			},
			{ key: 'probability', name: 'Probability', topicIds: [4], subtopics: [] }
		]);
	});

	it('merges the same topic or subtopic written differently', () => {
		const [calculus, ...rest] = buildTopicGroups([
			{ id: 1, name: 'Calculus - Integration' },
			{ id: 2, name: 'calculus – integration' },
			// The syllabus code is dropped when matching subtopics, but kept for display.
			{ id: 3, name: 'Calculus 3.1 Integration' },
			{ id: 4, name: '  CALCULUS ' },
			{ id: 5, name: 'Calculus -' },
			{ id: 6, name: 'Product-to-Sum Identities' }
		]);
		expect(calculus).toEqual({
			key: 'calculus',
			name: 'Calculus',
			topicIds: [1, 2, 3, 4, 5],
			subtopics: [{ key: 'integration', name: 'Integration', topicIds: [1, 2, 3] }]
		});
		expect(rest.map(group => group.key)).toEqual(['product-to-sum identities']);
	});

	it('groups section codes run into the topic name, as Browse does', () => {
		expect(buildTopicGroups([
			{ id: 1, name: 'M1.1 - Vectors' },
			{ id: 2, name: 'M1.2 Forces' },
			{ id: 3, name: 'M - Vectors' }
		])).toEqual([
			{
				key: 'm',
				name: 'M',
				topicIds: [1, 2, 3],
				subtopics: [
					{ key: 'vectors', name: '1.1 - Vectors', topicIds: [1, 3] },
					{ key: 'forces', name: '1.2 Forces', topicIds: [2] }
				]
			}
		]);
	});

	it('serialises an {id, g, s} entry per topic for json_each, s being null for the topic itself', () => {
		const json = topicGroupsJson([
			{ key: 'calculus', name: 'Calculus', topicIds: [1, 2], subtopics: [{ key: 'integration', name: 'Integration', topicIds: [2] }] }
		]);
		expect(JSON.parse(json)).toEqual([
			{ id: 1, g: 'calculus', s: null },
			{ id: 2, g: 'calculus', s: 'integration' }
		]);
		expect(topicGroupsJson([])).toBe('[]');
	});
});

describe('readStatsFilters', () => {
	const read = (params: Record<string, string>, options: Partial<{ today: string; mockIds: number[]; topicKeys: string[] }> = {}) =>
		readStatsFilters(key => params[key], { today: '2026-10-10', mockIds: [3, 4], topicKeys: ['calculus', 'vectors'], ...options });

	it('defaults to every paper, every topic and all time', () => {
		expect(read({})).toEqual(DEFAULT_STATS_FILTERS);
	});

	it('maps each paper source to its kinds, and a mock source to the mocks', () => {
		expect(read({ source: 'hsc-trial' })).toMatchObject({ source: 'hsc-trial', kinds: ['hsc', 'trial'], mock: null });
		expect(read({ source: 'other' })).toMatchObject({ kinds: ['other'] });
		expect(read({ source: 'mocks' })).toMatchObject({ source: 'mocks', kinds: [], mock: 'all' });
		expect(read({ source: 'mock-4' })).toMatchObject({ source: 'mock-4', mock: 4 });
	});

	it("falls back to every paper for a mock that isn't the student's, or when they have none", () => {
		expect(read({ source: 'mock-9' })).toMatchObject({ source: 'all', mock: null });
		expect(read({ source: 'mocks' }, { mockIds: [] })).toMatchObject({ source: 'all', mock: null });
		expect(read({ source: 'bogus' })).toMatchObject({ source: 'all', kinds: [] });
	});

	it('accepts a topic by key or by name, and drops one the subject does not use', () => {
		expect(read({ topic: 'calculus' }).topic).toBe('calculus');
		expect(read({ topic: '  Calculus ' }).topic).toBe('calculus');
		expect(read({ topic: 'Mechanics' }).topic).toBe('');
	});

	it('turns a preset period into Sydney dates ending today', () => {
		expect(read({ period: '7d' })).toMatchObject({ period: '7d', from: '2026-10-04', to: '2026-10-10' });
		expect(read({ period: '30d' })).toMatchObject({ from: '2026-09-11', to: '2026-10-10' });
		expect(read({ period: 'year' })).toMatchObject({ from: '2026-01-01', to: '2026-10-10' });
		// A preset ignores any dates passed with it.
		expect(read({ period: '7d', from: '2020-01-01' })).toMatchObject({ from: '2026-10-04' });
	});

	it('takes custom dates, swapping them when reversed and dropping invalid ones', () => {
		expect(read({ period: 'custom', from: '2026-09-30', to: '2026-09-01' })).toMatchObject({ period: 'custom', from: '2026-09-01', to: '2026-09-30' });
		expect(read({ period: 'custom', from: '2026-02-30', to: '2026-03-01' })).toMatchObject({ period: 'custom', from: null, to: '2026-03-01' });
		expect(read({ from: '2026-09-01' })).toMatchObject({ period: 'custom', from: '2026-09-01', to: null });
		expect(read({ period: 'custom' })).toMatchObject({ period: 'all', from: null, to: null });
	});
});

describe('statsFilterParams', () => {
	it('leaves out defaults, and keeps dates for a custom period only', () => {
		expect(statsFilterParams(DEFAULT_STATS_FILTERS)).toEqual([]);
		expect(statsFilterParams({ ...DEFAULT_STATS_FILTERS, source: 'mock-3', mock: 3, topic: 'calculus', period: '30d', from: '2026-09-11', to: '2026-10-10' })).toEqual([
			['source', 'mock-3'],
			['topic', 'calculus'],
			['period', '30d']
		]);
		expect(statsFilterParams({ ...DEFAULT_STATS_FILTERS, period: 'custom', from: '2026-09-01', to: null })).toEqual([
			['period', 'custom'],
			['from', '2026-09-01']
		]);
	});
});

describe('sydneyMidnight and statsScope', () => {
	it('finds the UTC instant each Sydney day starts, either side of daylight saving', () => {
		// AEST (UTC+10) until 2am on 4 October 2026, AEDT (UTC+11) until 3am on 5 April 2026.
		expect(sydneyMidnight('2026-10-04')).toBe('2026-10-03 14:00:00');
		expect(sydneyMidnight('2026-10-05')).toBe('2026-10-04 13:00:00');
		expect(sydneyMidnight('2026-04-05')).toBe('2026-04-04 13:00:00');
		expect(sydneyMidnight('2026-04-06')).toBe('2026-04-05 14:00:00');
	});

	it('bounds attempts from the start of the first day to the start of the day after the last', () => {
		const filters = { ...DEFAULT_STATS_FILTERS, topic: 'calculus', period: 'custom' as const, from: '2026-10-05', to: '2026-10-05' };
		expect(statsScope(7, 'Maths', filters, [1, 2])).toEqual({
			userId: 7,
			subject: 'Maths',
			kinds: [],
			mock: null,
			topicIds: [1, 2],
			since: '2026-10-04 13:00:00',
			until: '2026-10-05 13:00:00'
		});
		// No topic chosen, so the ids passed in are ignored; no period, so no bounds.
		expect(statsScope(7, 'Maths', DEFAULT_STATS_FILTERS, [1, 2])).toMatchObject({ topicIds: null, since: null, until: null });
	});
});

describe('examWeights', () => {
	const topicUnits: TopicUnitRow[] = [
		{ grp: 'calculus', unit_id: 1, questions: 3, marks: 30 },
		{ grp: 'calculus', unit_id: 2, questions: 2, marks: 10 },
		{ grp: 'calculus', unit_id: 3, questions: 4, marks: 50 },
		{ grp: 'vectors', unit_id: 1, questions: 1, marks: 6 }
	];

	it('averages over the exams in scope that have tagged questions, in the order given', () => {
		const weights = examWeights(topicUnits, [4, 2, 1]);
		// Exam 4 has no tagged question, so it is left out rather than averaged in as zero; exam 3
		// isn't in scope.
		expect(weights.units).toEqual([2, 1]);
		expect(weights.byGroup.get('calculus')).toEqual({ avgMarks: 20, papers: 2 });
		expect(weights.byGroup.get('vectors')).toEqual({ avgMarks: 3, papers: 1 });
	});

	it('takes in every exam in scope', () => {
		const weights = examWeights(topicUnits, [1, 2, 3]);
		expect(weights.units).toEqual([1, 2, 3]);
		expect(weights.byGroup.get('calculus')).toEqual({ avgMarks: 30, papers: 3 });
		expect(weights.byGroup.get('vectors')).toEqual({ avgMarks: 2, papers: 1 });
	});

	it('weighs subtopics over the same exams as their topics', () => {
		const weights = examWeights(
			[
				...topicUnits,
				{ grp: 'calculus', sub: 'integration', unit_id: 1, questions: 1, marks: 12 },
				{ grp: 'calculus', sub: 'integration', unit_id: 3, questions: 1, marks: 9 }
			],
			[2, 1]
		);
		// Two tagged exams, so 12 marks in one of them averages to 6.
		expect(weights.bySubtopic.get('calculus')?.get('integration')).toEqual({ avgMarks: 6, papers: 1 });
		// Subtopic rows don't count towards their topic twice.
		expect(weights.byGroup.get('calculus')).toEqual({ avgMarks: 20, papers: 2 });
	});
});

describe('summarizeTopics', () => {
	const groups = [
		{ key: 'calculus', name: 'Calculus', topicIds: [1], subtopics: [] },
		{ key: 'vectors', name: 'Vectors', topicIds: [2], subtopics: [] },
		{ key: 'empty', name: 'Empty', topicIds: [3], subtopics: [] }
	];
	const rows = [
		{ grp: 'vectors', questions: 4, attempted: 1, marks_attempted: 2, marks_earned: 1 },
		{ grp: 'calculus', questions: 10, attempted: 5, marks_attempted: 20, marks_earned: 15 }
	];

	it('derives accuracy and coverage, heaviest topic first, skipping topics without questions', () => {
		const weights = examWeights(
			[
				{ grp: 'vectors', unit_id: 1, questions: 1, marks: 8 },
				{ grp: 'calculus', unit_id: 1, questions: 1, marks: 25 }
			],
			[1]
		);
		const topics = summarizeTopics(groups, rows, weights);
		expect(topics.map(t => t.key)).toEqual(['calculus', 'vectors']);
		expect(topics[0]).toMatchObject({ name: 'Calculus', accuracy: 0.75, coverage: 0.5, avgMarks: 25, papers: 1 });
		expect(topics[1]).toMatchObject({ accuracy: 0.5, coverage: 0.25, avgMarks: 8 });
	});

	it('leaves weights null when no exam in scope is tagged, and orders by question count', () => {
		const topics = summarizeTopics(groups, rows, examWeights([], []));
		expect(topics.map(t => t.key)).toEqual(['calculus', 'vectors']);
		expect(topics.every(t => t.avgMarks === null && t.papers === 0)).toBe(true);
	});

	it('nests subtopics under their topic, heaviest first, dropping any without questions', () => {
		const nested = [
			{
				key: 'calculus',
				name: 'Calculus',
				topicIds: [1, 2, 3, 4],
				subtopics: [
					{ key: 'integration', name: 'Integration', topicIds: [2] },
					{ key: 'differentiation', name: '1.2 Differentiation', topicIds: [3] },
					{ key: 'limits', name: 'Limits', topicIds: [4] }
				]
			}
		];
		const weights = examWeights(
			[
				{ grp: 'calculus', sub: '', unit_id: 1, questions: 3, marks: 20 },
				{ grp: 'calculus', sub: 'integration', unit_id: 1, questions: 2, marks: 9 },
				{ grp: 'calculus', sub: 'differentiation', unit_id: 1, questions: 2, marks: 14 }
			],
			[1]
		);
		const [calculus] = summarizeTopics(
			nested,
			[
				{ grp: 'calculus', sub: '', questions: 3, attempted: 1, marks_attempted: 4, marks_earned: 3 },
				{ grp: 'calculus', sub: 'integration', questions: 2, attempted: 1, marks_attempted: 4, marks_earned: 3 },
				{ grp: 'calculus', sub: 'differentiation', questions: 2, attempted: 0, marks_attempted: 0, marks_earned: 0 }
			],
			weights
		);
		expect(calculus).toMatchObject({ key: 'calculus', questions: 3, avgMarks: 20, topicIds: [1, 2, 3, 4] });
		expect(calculus.subtopics.map(t => [t.key, t.name, t.questions, t.avgMarks, t.accuracy, t.topicIds])).toEqual([
			['differentiation', '1.2 Differentiation', 2, 14, null, [3]],
			['integration', 'Integration', 2, 9, 0.75, [2]]
		]);
		expect(calculus.subtopics.every(t => t.subtopics.length === 0)).toBe(true);
	});
});

describe('focusTopics', () => {
	it('ranks weak spots by the marks they cost per paper', () => {
		const { leaks } = focusTopics([
			topic('calculus', { avgMarks: 25, marksAttempted: 40, marksEarned: 30, accuracy: 0.75 }),
			topic('vectors', { avgMarks: 8, marksAttempted: 10, marksEarned: 2, accuracy: 0.2 }),
			topic('proof', { avgMarks: 30, marksAttempted: 10, marksEarned: 10, accuracy: 1 })
		]);
		// Vectors costs 8 × 0.8 = 6.4 marks a paper and Calculus 25 × 0.25 = 6.25. Proof is at full marks.
		expect(leaks.map(item => [item.topic.key, Number(item.score.toFixed(2))])).toEqual([
			['vectors', 6.4],
			['calculus', 6.25]
		]);
	});

	it(`needs at least ${MIN_TOPIC_MARKS} marks attempted before calling a topic weak`, () => {
		const { leaks, gaps } = focusTopics([
			topic('thin', { avgMarks: 20, attempted: 1, marksAttempted: MIN_TOPIC_MARKS - 1, accuracy: 0 }),
			topic('enough', { avgMarks: 20, attempted: 2, marksAttempted: MIN_TOPIC_MARKS, accuracy: 0.4 })
		]);
		expect(leaks.map(item => item.topic.key)).toEqual(['enough']);
		expect(gaps.map(item => item.topic.key)).toEqual(['thin']);
	});

	it('ranks gaps by practice per mark of weight, skipping finished and unexamined topics', () => {
		const { gaps } = focusTopics([
			topic('big-started', { avgMarks: 25, attempted: 2, marksAttempted: 5, accuracy: 1 }),
			topic('small-untouched', { avgMarks: 4 }),
			topic('big-untouched', { avgMarks: 12 }),
			topic('finished', { avgMarks: 30, attempted: 10, questions: 10, marksAttempted: 50, accuracy: 1 }),
			topic('never-examined', { avgMarks: 0 })
		]);
		expect(gaps.map(item => item.topic.key)).toEqual(['big-untouched', 'small-untouched', 'big-started']);
	});

	it('falls back to accuracy and raw practice when nothing is weighted', () => {
		const { leaks, gaps } = focusTopics([
			topic('a', { avgMarks: null, attempted: 3, marksAttempted: 10, accuracy: 0.9 }),
			topic('b', { avgMarks: null, attempted: 3, marksAttempted: 10, accuracy: 0.3 }),
			topic('c', { avgMarks: null, attempted: 1, marksAttempted: 1, accuracy: 0 })
		]);
		expect(leaks.map(item => item.topic.key)).toEqual(['b', 'a']);
		expect(gaps.map(item => item.topic.key)).toEqual(['c']);
	});
});

describe('summarizeBreakdown', () => {
	const row = (question_type: string, marks_bucket: number, counts: Partial<BreakdownRow> = {}): BreakdownRow => ({
		question_type,
		marks_bucket,
		questions: 1,
		attempted: 1,
		marks_attempted: marks_bucket,
		marks_earned: marks_bucket,
		scored: 1,
		full_marks: 1,
		...counts
	});

	it('sums every dimension from the one cube, in a fixed order', () => {
		const summary = summarizeBreakdown([
			row('short_answer', 3, { marks_earned: 1, full_marks: 0 }),
			row('multiple_choice', 1),
			row('essay', 5, { questions: 2, attempted: 0, marks_attempted: 0, marks_earned: 0, scored: 0, full_marks: 0 }),
			row('short_answer', 0, { attempted: 0, marks_attempted: 0, marks_earned: 0, scored: 0, full_marks: 0 })
		]);
		expect(summary.total).toEqual({ questions: 5, attempted: 2, marksAttempted: 4, marksEarned: 2, scored: 2, fullMarks: 1 });
		// An unknown type joins the untyped bucket rather than getting a row of its own.
		expect(summary.byType.map(e => [e.label, e.questions, e.accuracy])).toEqual([
			['Multiple choice', 1, 1],
			['Short answer', 2, 1 / 3],
			['No type set', 2, null]
		]);
		// Bucket 0 is unscorable and has no row.
		expect(summary.byMarks.map(e => e.label)).toEqual(['1 mark', '3 marks', '5+ marks']);
	});
});

describe('summarizePapers', () => {
	const result = (id: number, questions: number, attempted: number, marks_attempted = 0, marks_earned = 0): PaperResultRow => ({
		id,
		questions,
		attempted,
		marks_attempted,
		marks_earned
	});

	it('counts finished and started papers, newest first, skipping papers with nothing in scope', () => {
		const summary = summarizePapers(
			[paper(1, 'hsc', 2023), paper(2, 'hsc', 2024), paper(3, 'trial', 2024), paper(4, 'trial', 2022)],
			[result(1, 4, 4, 10, 5), result(2, 4, 1, 2, 2), result(3, 4, 0), result(4, 0, 0), result(9, 3, 3)]
		);
		expect(summary).toMatchObject({ total: 3, complete: 1, started: 1 });
		// Paper 4 has no questions in scope and paper 9 isn't in the subject.
		expect(summary.results.map(r => [r.paper.id, r.attempted, r.accuracy])).toEqual([
			[3, 0, null],
			[2, 1, 1],
			[1, 4, 0.5]
		]);
	});
});

describe('topicUnitMap', () => {
	const topicUnits: TopicUnitRow[] = [
		{ grp: 'vectors', unit_id: 2, questions: 1, marks: 6 },
		{ grp: 'calculus', unit_id: 1, questions: 2, marks: 20 },
		{ grp: 'calculus', unit_id: 2, questions: 1, marks: 12 },
		{ grp: 'calculus', unit_id: 3, questions: 9, marks: 99 },
		{ grp: 'calculus', sub: 'integration', unit_id: 1, questions: 1, marks: 5 },
		{ grp: 'calculus', sub: 'integration', unit_id: 2, questions: 1, marks: 4 },
		{ grp: 'calculus', sub: 'limits', unit_id: 2, questions: 1, marks: 8 }
	];
	const names = new Map([
		['calculus', 'Calculus'],
		['vectors', 'Vectors']
	]);

	it('lays out one column per tagged exam in scope and sorts topics by total marks', () => {
		// Exam 3 isn't in scope.
		const map = topicUnitMap(topicUnits, examWeights(topicUnits, [2, 1]), names);
		expect(map.units).toEqual([2, 1]);
		expect(map.unitCount).toBe(2);
		expect(map.rows).toEqual([
			{ key: 'calculus', name: 'Calculus', cells: [12, 20], avg: 16 },
			{ key: 'vectors', name: 'Vectors', cells: [6, 0], avg: 3 }
		]);
		expect(map.max).toBe(20);
	});

	it("breaks one topic down into its subtopics", () => {
		const map = topicUnitMap(topicUnits, examWeights(topicUnits, [1, 2]), new Map([['integration', 'Integration']]), { topic: 'calculus' });
		expect(map.rows).toEqual([
			{ key: 'integration', name: 'Integration', cells: [5, 4], avg: 4.5 },
			{ key: 'limits', name: 'limits', cells: [0, 8], avg: 4 }
		]);
	});

	it('shows only the latest exams when limited, but averages over all of them', () => {
		const map = topicUnitMap(topicUnits, examWeights(topicUnits, [1, 2, 3]), names, { limit: 2 });
		expect(map.units).toEqual([2, 3]);
		expect(map.unitCount).toBe(3);
		expect(map.rows[0]).toEqual({ key: 'calculus', name: 'Calculus', cells: [12, 99], avg: (20 + 12 + 99) / 3 });
		expect(map.max).toBe(99);
	});
});

describe('summarizeMocks', () => {
	const mock = (id: number, extra: Partial<MockRow>): MockRow => ({
		id,
		exam_name: `Mock ${id}`,
		completed_at: `2026-10-0${id} 00:00:00`,
		is_timed: 0,
		allowed_time_seconds: 0,
		elapsed_time_seconds: 0,
		questions: 5,
		total_marks: 20,
		marks_awarded: 10,
		marked: 5,
		...extra
	});

	it('scores marked mocks only, with pace taken from timed ones', () => {
		const summary = summarizeMocks([
			mock(1, { marks_awarded: 10, is_timed: 1, allowed_time_seconds: 3600, elapsed_time_seconds: 2400 }),
			mock(2, { marked: 0, marks_awarded: 0 }),
			mock(3, { marks_awarded: 15 }),
			mock(4, { total_marks: 0, marks_awarded: 0 })
		]);
		expect(summary.count).toBe(2);
		expect(summary.average).toBeCloseTo(0.625);
		expect(summary.best).toBe(0.75);
		expect(summary.change).toBeCloseTo(0.25);
		expect(summary.pace).toBeCloseTo(2);
		expect(summary.timedCount).toBe(1);
		expect(summary.recent.map(r => r.id)).toEqual([3, 1]);
		expect(summary.recent[1]).toMatchObject({ minutes: 40, allowedMinutes: 60 });
	});

	it('reports nothing before a mock is marked', () => {
		expect(summarizeMocks([])).toMatchObject({ count: 0, average: null, best: null, change: null, pace: null, recent: [] });
	});
});

describe('Sydney days', () => {
	it('moves UTC instants onto Sydney dates either side of daylight saving', () => {
		// AEST (UTC+10) until 2am on 4 October 2026, AEDT (UTC+11) after.
		expect(sydneyDate(new Date(Date.UTC(2026, 9, 3, 13)))).toBe('2026-10-03');
		expect(sydneyDate(new Date(Date.UTC(2026, 9, 3, 14)))).toBe('2026-10-04');
		expect(sydneyDate(new Date(Date.UTC(2026, 9, 4, 12)))).toBe('2026-10-04');
		expect(sydneyDate(new Date(Date.UTC(2026, 9, 4, 13)))).toBe('2026-10-05');
	});

	it('sums hour buckets into days and skips malformed hours', () => {
		const days = dailyActivity([
			{ hour: '2026-10-03 13', n: 2 },
			{ hour: '2026-10-03 14', n: 1 },
			{ hour: '2026-10-04 12', n: 4 },
			{ hour: null, n: 9 },
			{ hour: '2026-10-04', n: 9 }
		]);
		expect([...days]).toEqual([
			['2026-10-03', 2],
			['2026-10-04', 5]
		]);
	});
});

describe('activitySummary', () => {
	const days = new Map([
		['2026-09-20', 1],
		['2026-10-02', 2],
		['2026-10-03', 1],
		['2026-10-04', 3],
		['2026-10-05', 1],
		['2026-10-08', 2],
		['2026-10-09', 4],
		['2026-10-11', 7]
	]);

	it('keeps the streak alive on a quiet morning and splits weeks on Monday', () => {
		// Saturday 10 October: nothing yet today, so the streak counts back from Friday.
		expect(activitySummary(days, '2026-10-10')).toEqual({
			total: 14,
			thisWeek: 7,
			lastWeek: 6,
			current: 2,
			longest: 4,
			activeDays: 7,
			activeLast30: 7,
			lastActive: '2026-10-09'
		});
	});

	it('counts today once there is activity, and ignores days after today', () => {
		const summary = activitySummary(new Map([...days, ['2026-10-10', 1]]), '2026-10-10');
		expect(summary.current).toBe(3);
		expect(summary.total).toBe(15);
		expect(summary.lastActive).toBe('2026-10-10');
	});

	it('has no last active day before any practice', () => {
		expect(activitySummary(new Map(), '2026-10-10')).toEqual({
			total: 0,
			thisWeek: 0,
			lastWeek: 0,
			current: 0,
			longest: 0,
			activeDays: 0,
			activeLast30: 0,
			lastActive: null
		});
	});
});

describe('activityHeatmap', () => {
	it('builds Monday-start weeks ending with the current one, blanking the future', () => {
		const heatmap = activityHeatmap(new Map([['2026-10-06', 3], ['2026-04-13', 1]]), '2026-10-10', 26);
		expect(heatmap.weeks).toHaveLength(26);
		expect(heatmap.weeks.every(week => week.length === 7)).toBe(true);
		expect(heatmap.weeks[0][0]).toEqual({ date: '2026-04-13', count: 1 });
		expect(heatmap.weeks[25].map(day => day.count)).toEqual([0, 3, 0, 0, 0, 0, null]);
		expect(heatmap.weeks[25][6].date).toBe('2026-10-11');
		expect(heatmap.max).toBe(3);
	});

	it('ends on the last day of a period and blanks the days before it', () => {
		const days = daysWithin(new Map([['2026-09-01', 5], ['2026-09-10', 2], ['2026-09-20', 4]]), '2026-09-09', '2026-09-16');
		expect([...days]).toEqual([['2026-09-10', 2]]);
		// Wednesday 9 to Wednesday 16 September touches two Monday-to-Sunday weeks.
		const weeks = weeksSpanned('2026-09-09', '2026-09-16');
		expect(weeks).toBe(2);
		const heatmap = activityHeatmap(days, '2026-09-16', weeks, '2026-09-09');
		expect(heatmap.weeks.map(week => week.map(day => day.count))).toEqual([
			[null, null, 0, 2, 0, 0, 0],
			[0, 0, 0, null, null, null, null]
		]);
		expect(heatmap.max).toBe(2);
	});
});

describe('weeksSpanned', () => {
	it('counts the Monday-to-Sunday weeks a run of days touches', () => {
		expect(weeksSpanned('2026-10-05', '2026-10-11')).toBe(1);
		expect(weeksSpanned('2026-10-11', '2026-10-12')).toBe(2);
		expect(weeksSpanned('2026-09-11', '2026-10-10')).toBe(5);
	});
});

// Every builder against a seeded D1. One subject (Maths) is under test; Physics, another user and a
// deleted question are there to prove they stay out.
describe('statistics queries against D1', () => {
	const MATHS = 'Mathematics 2U (HSC)';
	const USER = 7;

	const setup = async () => {
		const tables = ['papers', 'exam_questions', 'topics', 'question_topics', 'user_question_attempts', 'user_review_attempts', 'mock_exams', 'mock_exam_questions'];
		await env.DB.batch(tables.map(table => env.DB.prepare(`DROP TABLE IF EXISTS ${table}`)));
		await env.DB.batch([
			env.DB.prepare(`CREATE TABLE papers (id INTEGER PRIMARY KEY, subject TEXT NOT NULL, school_name TEXT NOT NULL, academic_year INTEGER NOT NULL,
				reference_link TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, paper_type TEXT DEFAULT 'Trial Paper', is_locked BOOLEAN DEFAULT 0)`),
			env.DB.prepare(`CREATE TABLE exam_questions (id INTEGER PRIMARY KEY, paper_id INTEGER NOT NULL, section_label TEXT NOT NULL, segment_label TEXT,
				question_number TEXT NOT NULL, question_type TEXT, marks INTEGER, is_deleted BOOLEAN DEFAULT 0, ordering_index REAL DEFAULT 0)`),
			env.DB.prepare('CREATE TABLE topics (id INTEGER PRIMARY KEY, subject TEXT NOT NULL, name TEXT NOT NULL, UNIQUE(subject, name))'),
			env.DB.prepare('CREATE TABLE question_topics (question_id INTEGER NOT NULL, topic_id INTEGER NOT NULL, PRIMARY KEY (question_id, topic_id))'),
			env.DB.prepare(`CREATE TABLE user_question_attempts (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, question_id INTEGER NOT NULL,
				response_content TEXT, selected_option TEXT, marks_awarded INTEGER, marker_notes TEXT, is_completed BOOLEAN DEFAULT 0,
				created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id, question_id))`),
			env.DB.prepare(`CREATE TABLE user_review_attempts (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, question_id INTEGER NOT NULL,
				response_content TEXT, selected_option TEXT, marks_awarded INTEGER, marker_notes TEXT, is_completed BOOLEAN DEFAULT 0,
				created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`),
			env.DB.prepare(`CREATE TABLE mock_exams (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, subject TEXT NOT NULL, exam_name TEXT,
				created_method TEXT NOT NULL, allowed_time_seconds INTEGER, elapsed_time_seconds INTEGER DEFAULT 0, is_timed BOOLEAN DEFAULT 0,
				status TEXT DEFAULT 'in_progress', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, completed_at TIMESTAMP)`),
			env.DB.prepare(`CREATE TABLE mock_exam_questions (mock_exam_id INTEGER NOT NULL, question_id INTEGER NOT NULL, ordering_index INTEGER NOT NULL,
				response_content TEXT, selected_option TEXT, marks_awarded INTEGER, marker_notes TEXT, PRIMARY KEY (mock_exam_id, question_id))`)
		]);

		await env.DB.batch([
			env.DB.prepare(`INSERT INTO papers (id, subject, school_name, academic_year, paper_type) VALUES
				(1, 'Mathematics 2U (HSC)', 'HSC', 2023, 'HSC Examination'),
				(2, 'Mathematics 2U (HSC)', 'hsc', 2024, 'Trial Paper'),
				(3, 'Mathematics 2U (HSC)', 'Sydney Boys High School', 2024, 'Trial Paper'),
				(4, 'Mathematics 2U (HSC)', 'Sydney Boys High School', 2024, 'Half Yearly'),
				(5, 'Physics (HSC)', 'HSC', 2024, 'HSC Examination')`),
			env.DB.prepare(`INSERT INTO topics (id, subject, name) VALUES
				(1, 'Mathematics 2U (HSC)', 'Calculus'), (2, 'Mathematics 2U (HSC)', 'Calculus 1.2 Differentiation'),
				(3, 'Mathematics 2U (HSC)', 'Probability'), (4, 'Mathematics 2U (HSC)', 'Vectors'),
				(5, 'Mathematics 2U (HSC)', 'Calculus - Integration'), (6, 'Mathematics 2U (HSC)', 'calculus – integration'),
				(7, 'Mathematics 2U (HSC)', 'Z-scores'),
				(9, 'Physics (HSC)', 'Kinematics')`),
			env.DB.prepare(`INSERT INTO exam_questions (id, paper_id, section_label, question_number, question_type, marks, is_deleted) VALUES
				(101, 1, 'I', '1', 'multiple_choice', 1, 0),
				(102, 1, 'II', '11', 'short_answer', 3, 0),
				(103, 1, 'II', '12', 'short_answer', 4, 0),
				(104, 1, 'II', '13', 'extended_response', 6, 0),
				(105, 1, 'II', '14', 'short_answer', NULL, 0),
				(201, 2, 'I', '1', 'multiple_choice', NULL, 0),
				(202, 2, 'II', '11', 'short_answer', 2, 0),
				(203, 2, 'II', '12', 'short_answer', 5, 1),
				(301, 3, 'II', '11', 'short_answer', 4, 0),
				(302, 3, 'II', '12', 'short_answer', 2, 0),
				(401, 4, 'II', '11', 'short_answer', 3, 0),
				(501, 5, 'II', '11', 'short_answer', 3, 0)`),
			// 102 carries Calculus and one of its subtopics; 104 carries Calculus, two of its subtopics
			// and Probability. 202 reaches Integration through a second spelling of it (topic 6).
			env.DB.prepare(`INSERT INTO question_topics (question_id, topic_id) VALUES
				(101, 1), (102, 1), (102, 2), (103, 3), (104, 1), (104, 3), (201, 4), (202, 1), (203, 3),
				(301, 1), (302, 4), (401, 3), (501, 9),
				(104, 2), (104, 5), (301, 5), (202, 6), (103, 7)`),
			// 102 is a part-marked batch save (is_completed = 0); 301 was over-awarded; 203 is deleted.
			env.DB.prepare(`INSERT INTO user_question_attempts (user_id, question_id, marks_awarded, marker_notes, is_completed, created_at, updated_at) VALUES
				(7, 101, 1, '', 1, '2026-10-03 13:00:00', '2026-10-05 00:10:00'),
				(7, 102, 1, '', 0, '2026-10-03 14:30:00', '2026-10-04 23:00:00'),
				(7, 103, 4, '', 1, '2026-10-04 13:00:00', '2026-10-05 00:10:00'),
				(7, 104, 2, 'check the integral', 1, '2026-10-05 01:00:00', '2026-10-05 01:00:00'),
				(7, 201, 1, '', 1, '2026-10-05 02:00:00', '2026-10-05 02:00:00'),
				(7, 203, 0, '', 1, '2026-10-06 01:00:00', '2026-10-06 01:00:00'),
				(7, 301, 9, '', 1, '2026-10-06 00:00:00', '2026-10-06 00:05:00'),
				(7, 302, 0, '', 1, '2026-10-06 02:00:00', '2026-10-06 02:00:00'),
				(7, 501, 0, '', 1, '2026-10-09 06:00:00', '2026-10-09 06:00:00'),
				(8, 101, 0, '', 1, '2026-10-05 00:00:00', '2026-10-05 00:00:00'),
				(8, 103, 0, '', 1, '2026-10-05 00:00:00', '2026-10-05 00:00:00')`),
			env.DB.prepare(`INSERT INTO user_review_attempts (user_id, question_id, marks_awarded, marker_notes, is_completed, created_at) VALUES
				(7, 104, 3, '', 1, '2026-10-08 03:00:00'),
				(7, 104, 6, '', 1, '2026-10-08 04:00:00'),
				(7, 102, 2, '', 1, '2026-10-09 05:00:00'),
				(8, 103, 4, '', 1, '2026-10-09 05:00:00')`),
			env.DB.prepare(`INSERT INTO mock_exams (id, user_id, subject, exam_name, created_method, allowed_time_seconds, elapsed_time_seconds, is_timed, status, created_at, completed_at) VALUES
				(1, 7, 'Mathematics 2U (HSC)', 'Timed', 'auto', 3600, 1800, 1, 'completed', '2026-10-04 22:00:00', '2026-10-05 00:00:00'),
				(2, 7, 'Mathematics 2U (HSC)', 'Untimed', 'manual', 0, 0, 0, 'completed', '2026-10-05 23:00:00', '2026-10-06 00:00:00'),
				(3, 7, 'Mathematics 2U (HSC)', 'Never marked', 'manual', 0, 0, 0, 'completed', '2026-10-06 23:00:00', '2026-10-07 00:00:00'),
				(4, 7, 'Mathematics 2U (HSC)', 'Still going', 'manual', 0, 0, 0, 'in_progress', '2026-10-07 23:00:00', NULL),
				(5, 8, 'Mathematics 2U (HSC)', 'Someone else', 'manual', 0, 0, 0, 'completed', '2026-10-04 22:00:00', '2026-10-05 00:00:00'),
				(6, 7, 'Physics (HSC)', 'Physics', 'manual', 0, 0, 0, 'completed', '2026-10-04 22:00:00', '2026-10-05 00:00:00')`),
			env.DB.prepare(`INSERT INTO mock_exam_questions (mock_exam_id, question_id, ordering_index) VALUES
				(1, 101, 0), (1, 102, 1), (1, 103, 2),
				(2, 301, 0), (2, 302, 1),
				(3, 202, 0),
				(4, 101, 0),
				(5, 101, 0),
				(6, 501, 0)`)
		]);
	};

	const run = async <T>(query: { sql: string; params: unknown[] }) =>
		(await env.DB.prepare(query.sql).bind(...query.params).all<T>()).results;

	const groups = buildTopicGroups([
		{ id: 1, name: 'Calculus' },
		{ id: 2, name: 'Calculus 1.2 Differentiation' },
		{ id: 3, name: 'Probability' },
		{ id: 4, name: 'Vectors' },
		{ id: 5, name: 'Calculus - Integration' },
		{ id: 6, name: 'calculus – integration' },
		{ id: 7, name: 'Z-scores' }
	]);
	const groupsJson = () => topicGroupsJson(groups);
	const CALCULUS = groups.find(group => group.key === 'calculus')!.topicIds;

	// Every paper, every topic, all time, unless overridden.
	const scope = (overrides: Partial<StatsScope> = {}): StatsScope => ({
		userId: USER,
		subject: MATHS,
		kinds: [],
		mock: null,
		topicIds: null,
		since: null,
		until: null,
		...overrides
	});
	// Sydney's 5 October 2026 (AEDT), from statsScope as the page builds it.
	const OCTOBER_5 = statsScope(USER, MATHS, { ...DEFAULT_STATS_FILTERS, period: 'custom', from: '2026-10-05', to: '2026-10-05' }, null);

	const totalsOf = async (query: { sql: string; params: unknown[] }) => summarizeBreakdown(await run<BreakdownRow>(query)).total;

	it('counts a question once per topic however many of its subtopics it carries', async () => {
		await setup();
		const rows = await run<Record<string, unknown>>(buildTopicStatsQuery(scope(), groupsJson()));
		const byLevel = Object.fromEntries(rows.map(row => [row.sub ? `${row.grp}/${row.sub}` : row.grp, row]));
		// Calculus: 101, 102, 104, 202, 301, each once, though 104 is in two subtopics and four
		// questions also carry a subtopic. 301's 9 marks clamp to 4.
		expect(byLevel.calculus).toEqual({ grp: 'calculus', sub: '', questions: 5, attempted: 4, marks_attempted: 14, marks_earned: 8 });
		expect(byLevel['calculus/differentiation']).toEqual({ grp: 'calculus', sub: 'differentiation', questions: 2, attempted: 2, marks_attempted: 9, marks_earned: 3 });
		// Integration: 104 and 301, plus 202 through the other spelling.
		expect(byLevel['calculus/integration']).toEqual({ grp: 'calculus', sub: 'integration', questions: 3, attempted: 2, marks_attempted: 10, marks_earned: 6 });
		// Probability: 103, 104, 401; the deleted 203 is out.
		expect(byLevel.probability).toEqual({ grp: 'probability', sub: '', questions: 3, attempted: 2, marks_attempted: 10, marks_earned: 6 });
		// Vectors: 201 is an unmarked MCQ, scored out of 1.
		expect(byLevel.vectors).toEqual({ grp: 'vectors', sub: '', questions: 2, attempted: 2, marks_attempted: 3, marks_earned: 1 });
		// A hyphenated name is a topic of its own, not "Z" with a subtopic "scores".
		expect(byLevel['z-scores']).toEqual({ grp: 'z-scores', sub: '', questions: 1, attempted: 1, marks_attempted: 4, marks_earned: 4 });
		expect(rows).toHaveLength(6);
	});

	it('gives each paper its marks per topic and subtopic, within the subject', async () => {
		await setup();
		const rows = await run<TopicUnitRow>(buildTopicUnitQuery(scope(), groupsJson()));
		const cells = rows.map(row => `${row.grp}${row.sub ? `/${row.sub}` : ''}:${row.unit_id}=${row.marks}/${row.questions}`).sort();
		expect(cells).toEqual([
			'calculus/differentiation:1=9/2',
			'calculus/integration:1=6/1',
			'calculus/integration:2=2/1',
			'calculus/integration:3=4/1',
			'calculus:1=10/3',
			'calculus:2=2/1',
			'calculus:3=4/1',
			'probability:1=10/2',
			'probability:4=3/1',
			'vectors:2=1/1',
			'vectors:3=2/1',
			'z-scores:1=4/1'
		]);
	});

	it('classifies papers, and weighs topics over the kinds of paper in scope', async () => {
		await setup();
		const papers = await run<PaperRow>(buildPaperListQuery(MATHS));
		// Paper 2 is filed as a trial but under the HSC school, so it is an HSC paper.
		expect(papers.map(p => [p.id, p.kind, p.questions])).toEqual([
			[1, 'hsc', 5],
			[2, 'hsc', 2],
			[3, 'trial', 2],
			[4, 'other', 1]
		]);
		const order = papers.map(p => p.id);

		const hsc = scope({ kinds: ['hsc'] });
		const weights = examWeights(await run<TopicUnitRow>(buildTopicUnitQuery(hsc, groupsJson())), order);
		expect(weights.units).toEqual([1, 2]);
		expect(Object.fromEntries(weights.byGroup)).toEqual({
			calculus: { avgMarks: 6, papers: 2 },
			probability: { avgMarks: 5, papers: 1 },
			vectors: { avgMarks: 0.5, papers: 1 },
			'z-scores': { avgMarks: 2, papers: 1 }
		});
		expect(Object.fromEntries(weights.bySubtopic.get('calculus') ?? [])).toEqual({
			differentiation: { avgMarks: 4.5, papers: 1 },
			integration: { avgMarks: 4, papers: 2 }
		});

		// Every paper: calculus has 10 + 2 + 4 marks over four tagged papers.
		const all = examWeights(await run<TopicUnitRow>(buildTopicUnitQuery(scope(), groupsJson())), order);
		expect(all.units).toEqual([1, 2, 3, 4]);
		expect(all.byGroup.get('calculus')).toEqual({ avgMarks: 4, papers: 3 });
	});

	it('scores each paper over its questions in scope', async () => {
		await setup();
		const papers = await run<PaperRow>(buildPaperListQuery(MATHS));
		const summary = summarizePapers(papers, await run<PaperResultRow>(buildPaperResultsQuery(scope())));
		expect(summary).toMatchObject({ total: 4, complete: 1, started: 2 });
		expect(summary.results.map(r => [r.paper.id, r.questions, r.attempted, r.marksAttempted, r.marksEarned])).toEqual([
			[4, 1, 0, 0, 0],
			[3, 2, 2, 6, 4],
			[2, 2, 1, 1, 1],
			[1, 5, 4, 14, 8]
		]);

		// Only the Calculus questions: paper 4 has none, and paper 1 is finished on 101, 102 and 104.
		const calculus = summarizePapers(papers, await run<PaperResultRow>(buildPaperResultsQuery(scope({ topicIds: CALCULUS }))));
		expect(calculus).toMatchObject({ total: 3, complete: 2, started: 0 });
		expect(calculus.results.map(r => [r.paper.id, r.questions, r.attempted])).toEqual([
			[3, 1, 1],
			[2, 1, 0],
			[1, 3, 3]
		]);
	});

	it('sums the breakdown cube to the subject totals', async () => {
		await setup();
		const summary = summarizeBreakdown(await run<BreakdownRow>(buildBreakdownQuery(scope())));
		expect(summary.total).toEqual({ questions: 10, attempted: 7, marksAttempted: 21, marksEarned: 13, scored: 7, fullMarks: 4 });
		expect(summary.byType.map(e => [e.key, e.questions, e.attempted, e.marksAttempted, e.marksEarned])).toEqual([
			['multiple_choice', 2, 2, 2, 2],
			['short_answer', 7, 4, 13, 9],
			['extended_response', 1, 1, 6, 2]
		]);
		expect(summary.byMarks.map(e => [e.key, e.questions])).toEqual([
			['1', 2],
			['2', 2],
			['3', 2],
			['4', 2],
			['5', 1]
		]);
	});

	it('narrows every total to the kinds of paper chosen', async () => {
		await setup();
		// 301 (over-awarded, so full marks) and 302.
		expect(await totalsOf(buildBreakdownQuery(scope({ kinds: ['trial'] })))).toEqual({
			questions: 2, attempted: 2, marksAttempted: 6, marksEarned: 4, scored: 2, fullMarks: 1
		});
		expect((await totalsOf(buildBreakdownQuery(scope({ kinds: ['hsc', 'trial'] })))).questions).toBe(9);
		expect((await totalsOf(buildBreakdownQuery(scope({ kinds: ['other'] })))).questions).toBe(1);
	});

	it("narrows the totals to one topic, matching that topic's row", async () => {
		await setup();
		const totals = await totalsOf(buildBreakdownQuery(scope({ topicIds: CALCULUS })));
		expect(totals).toMatchObject({ questions: 5, attempted: 4, marksAttempted: 14, marksEarned: 8 });
	});

	it('counts only attempts saved in the period, by Sydney date', async () => {
		await setup();
		expect(OCTOBER_5).toMatchObject({ since: '2026-10-04 13:00:00', until: '2026-10-05 13:00:00' });
		// 101, 103, 104 and 201 were saved on 5 October in Sydney, and so was 102 (23:00 UTC on the 4th).
		// 301 and 302 were saved on the 6th. Every question still counts towards the total.
		expect(await totalsOf(buildBreakdownQuery(OCTOBER_5))).toEqual({
			questions: 10, attempted: 5, marksAttempted: 15, marksEarned: 9, scored: 5, fullMarks: 3
		});
		const rows = await run<Record<string, unknown>>(buildTopicStatsQuery(OCTOBER_5, groupsJson()));
		expect(rows.find(row => row.grp === 'calculus' && !row.sub)).toMatchObject({ questions: 5, attempted: 3, marks_attempted: 10, marks_earned: 4 });
	});

	it('scopes to the questions in finished mocks, marked once each mock was finished', async () => {
		await setup();
		// 101, 102, 103 (mock 1), 301, 302 (mock 2) and 202 (mock 3); the unfinished mock 4 is out. 102
		// was last saved before mock 1 was finished, and 202 was never attempted.
		expect(await totalsOf(buildBreakdownQuery(scope({ mock: 'all' })))).toMatchObject({ questions: 6, attempted: 4, marksAttempted: 11, marksEarned: 9 });
		expect(await totalsOf(buildBreakdownQuery(scope({ mock: 2 })))).toMatchObject({ questions: 2, attempted: 2, marksAttempted: 6, marksEarned: 4 });

		const rows = await run<Record<string, unknown>>(buildTopicStatsQuery(scope({ mock: 'all' }), groupsJson()));
		expect(rows.find(row => row.grp === 'calculus' && !row.sub)).toMatchObject({ questions: 4, attempted: 2, marks_attempted: 5, marks_earned: 5 });

		// In mock scope each mock is an exam, so topic marks are per mock.
		const units = await run<TopicUnitRow>(buildTopicUnitQuery(scope({ mock: 'all' }), groupsJson()));
		const calculus = units.filter(row => row.grp === 'calculus' && !row.sub).map(row => `${row.unit_id}=${row.marks}/${row.questions}`).sort();
		expect(calculus).toEqual(['1=4/2', '2=4/1', '3=2/1']);
		expect(examWeights(units, [1, 2, 3]).byGroup.get('calculus')?.avgMarks).toBeCloseTo(10 / 3);
	});

	it('lists finished mocks and scores each from marks saved after it was finished', async () => {
		await setup();
		expect((await run<{ id: number }>(buildMockListQuery(USER, MATHS))).map(row => row.id)).toEqual([1, 2, 3]);

		const rows = await run<MockRow>(buildMockStatsQuery(scope({ mock: 'all' })));
		expect(rows.map(row => [row.id, row.total_marks, row.marks_awarded, row.marked])).toEqual([
			// 102 was last saved before the mock was finished, so only 101 and 103 count.
			[1, 8, 5, 2],
			// 301's 9 marks clamp to 4.
			[2, 6, 4, 2],
			[3, 2, 0, 0]
		]);
		const summary = summarizeMocks(rows);
		expect(summary.count).toBe(2);
		expect(summary.average).toBeCloseTo((5 / 8 + 4 / 6) / 2);
		expect(summary.pace).toBeCloseTo(30 / 8);

		expect((await run<MockRow>(buildMockStatsQuery(scope({ mock: 2 })))).map(row => row.id)).toEqual([2]);
		// Only mocks finished in the period, scored on their Calculus questions alone: 301 in mock 2, 202 in mock 3.
		const later = await run<MockRow>(buildMockStatsQuery(scope({ mock: 'all', since: '2026-10-05 13:00:00', topicIds: CALCULUS })));
		expect(later.map(row => [row.id, row.total_marks, row.marks_awarded, row.marked])).toEqual([
			[2, 4, 4, 1],
			[3, 2, 0, 0]
		]);
	});

	it('matches the Review tab queue and scores retries from the latest review attempt', async () => {
		await setup();
		const [stats] = await run<Record<string, number>>(buildReviewStatsQuery(scope()));
		const queue = await run<{ id: number }>(buildReviewQueueQuery(USER, MATHS));
		expect(stats.queued).toBe(queue.length);
		// Queued: 102 (1/3), 104 (2/6 with a note), 302 (0/2). Retried: 102 and 104. Fixed: 104, whose
		// latest retry is 6/6 (its older 3/6 doesn't count). Recovered: (6 - 2) + (2 - 1).
		expect(stats).toEqual({ queued: 3, dropped: 3, retried: 2, fixed: 1, recovered: 5 });

		// Calculus leaves out 302; the mocks leave out 104 (in none) and 102 (marked before mock 1 was finished).
		const [calculus] = await run<Record<string, number>>(buildReviewStatsQuery(scope({ topicIds: CALCULUS })));
		expect(calculus).toEqual({ queued: 2, dropped: 2, retried: 2, fixed: 1, recovered: 5 });
		const [mocks] = await run<Record<string, number>>(buildReviewStatsQuery(scope({ mock: 'all' })));
		expect(mocks).toEqual({ queued: 1, dropped: 1, retried: 0, fixed: 0, recovered: 0 });
	});

	it('buckets first attempts and review attempts into Sydney days', async () => {
		await setup();
		const days = dailyActivity(await run<ActivityRow>(buildActivityQuery(scope())));
		expect([...days]).toEqual([
			['2026-10-03', 1],
			['2026-10-04', 1],
			['2026-10-05', 3],
			['2026-10-06', 3],
			['2026-10-08', 2],
			['2026-10-09', 1]
		]);
		expect(activitySummary(days, '2026-10-10')).toEqual({
			total: 11,
			thisWeek: 9,
			lastWeek: 2,
			current: 2,
			longest: 4,
			activeDays: 6,
			activeLast30: 6,
			lastActive: '2026-10-09'
		});

		// Trial papers only: 301 and 302, both first tried on 6 October.
		expect([...dailyActivity(await run<ActivityRow>(buildActivityQuery(scope({ kinds: ['trial'] }))))]).toEqual([['2026-10-06', 2]]);
	});
});
