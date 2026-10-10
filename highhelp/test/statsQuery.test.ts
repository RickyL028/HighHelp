import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { buildReviewQueueQuery } from '../src/routes/pastPapers/practiceQuery';
import {
	MIN_TOPIC_MARKS,
	activityHeatmap,
	activitySummary,
	buildActivityQuery,
	buildBreakdownQuery,
	buildMockStatsQuery,
	buildPaperQuery,
	buildReviewStatsQuery,
	buildTopicGroups,
	buildTopicPaperQuery,
	buildTopicStatsQuery,
	dailyActivity,
	defaultWeightBasis,
	examWeights,
	focusTopics,
	hscTopicMap,
	isWeightBasis,
	summarizeBreakdown,
	summarizeMocks,
	summarizePapers,
	summarizeTopics,
	sydneyDate,
	topicGroupsJson,
	type ActivityRow,
	type BreakdownRow,
	type MockRow,
	type PaperRow,
	type TopicPaperRow,
	type TopicSummary
} from '../src/routes/pastPapers/statsQuery';

const paper = (id: number, kind: PaperRow['kind'], year: number, extra: Partial<PaperRow> = {}): PaperRow => ({
	id,
	school_name: kind === 'hsc' ? 'HSC' : 'Sydney Boys High School',
	academic_year: year,
	paper_type: kind === 'hsc' ? 'HSC Examination' : kind === 'trial' ? 'Trial Paper' : 'Half Yearly',
	kind,
	questions: 10,
	marks: 100,
	attempted: 0,
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

describe('isWeightBasis', () => {
	it('only accepts the two bases', () => {
		expect(isWeightBasis('hsc')).toBe(true);
		expect(isWeightBasis('all')).toBe(true);
		expect(isWeightBasis('trial')).toBe(false);
		expect(isWeightBasis(undefined)).toBe(false);
	});
});

describe('examWeights', () => {
	const papers = [paper(1, 'hsc', 2024), paper(2, 'hsc', 2023), paper(3, 'trial', 2024), paper(4, 'hsc', 2022)];
	const topicPapers: TopicPaperRow[] = [
		{ grp: 'calculus', paper_id: 1, questions: 3, marks: 30 },
		{ grp: 'calculus', paper_id: 2, questions: 2, marks: 10 },
		{ grp: 'calculus', paper_id: 3, questions: 4, marks: 50 },
		{ grp: 'vectors', paper_id: 1, questions: 1, marks: 6 }
	];

	it('averages over the HSC papers that have tagged questions, oldest first', () => {
		const weights = examWeights(topicPapers, papers, 'hsc');
		// Paper 4 has no tagged question, so it is left out rather than averaged in as zero.
		expect(weights.papers.map(p => p.id)).toEqual([2, 1]);
		expect(weights.byGroup.get('calculus')).toEqual({ avgMarks: 20, papers: 2 });
		expect(weights.byGroup.get('vectors')).toEqual({ avgMarks: 3, papers: 1 });
	});

	it('takes in every paper for the "all" basis', () => {
		const weights = examWeights(topicPapers, papers, 'all');
		expect(weights.papers.map(p => p.id)).toEqual([2, 1, 3]);
		expect(weights.byGroup.get('calculus')).toEqual({ avgMarks: 30, papers: 3 });
		expect(weights.byGroup.get('vectors')).toEqual({ avgMarks: 2, papers: 1 });
	});

	it('weighs subtopics over the same papers as their topics', () => {
		const weights = examWeights(
			[
				...topicPapers,
				{ grp: 'calculus', sub: 'integration', paper_id: 1, questions: 1, marks: 12 },
				{ grp: 'calculus', sub: 'integration', paper_id: 3, questions: 1, marks: 9 }
			],
			papers,
			'hsc'
		);
		// Two tagged HSC papers, so 12 marks in one of them averages to 6.
		expect(weights.bySubtopic.get('calculus')?.get('integration')).toEqual({ avgMarks: 6, papers: 1 });
		// Subtopic rows don't count towards their topic twice.
		expect(weights.byGroup.get('calculus')).toEqual({ avgMarks: 20, papers: 2 });
	});

	it('defaults to HSC papers only when one is tagged', () => {
		expect(defaultWeightBasis(topicPapers, papers)).toBe('hsc');
		expect(defaultWeightBasis([{ grp: 'calculus', paper_id: 3, questions: 1, marks: 5 }], papers)).toBe('all');
		expect(defaultWeightBasis([], [])).toBe('all');
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
				{ grp: 'vectors', paper_id: 1, questions: 1, marks: 8 },
				{ grp: 'calculus', paper_id: 1, questions: 1, marks: 25 }
			],
			[paper(1, 'hsc', 2024)],
			'hsc'
		);
		const topics = summarizeTopics(groups, rows, weights);
		expect(topics.map(t => t.key)).toEqual(['calculus', 'vectors']);
		expect(topics[0]).toMatchObject({ name: 'Calculus', accuracy: 0.75, coverage: 0.5, avgMarks: 25, papers: 1 });
		expect(topics[1]).toMatchObject({ accuracy: 0.5, coverage: 0.25, avgMarks: 8 });
	});

	it('leaves weights null when no paper in the basis is tagged, and orders by question count', () => {
		const topics = summarizeTopics(groups, rows, examWeights([], [], 'hsc'));
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
				{ grp: 'calculus', sub: '', paper_id: 1, questions: 3, marks: 20 },
				{ grp: 'calculus', sub: 'integration', paper_id: 1, questions: 2, marks: 9 },
				{ grp: 'calculus', sub: 'differentiation', paper_id: 1, questions: 2, marks: 14 }
			],
			[paper(1, 'hsc', 2024)],
			'hsc'
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
	const row = (question_type: string, marks_bucket: number, kind: BreakdownRow['kind'], counts: Partial<BreakdownRow> = {}): BreakdownRow => ({
		question_type,
		marks_bucket,
		kind,
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
			row('short_answer', 3, 'trial', { marks_earned: 1, full_marks: 0 }),
			row('multiple_choice', 1, 'hsc'),
			row('essay', 5, 'other', { questions: 2, attempted: 0, marks_attempted: 0, marks_earned: 0, scored: 0, full_marks: 0 }),
			row('short_answer', 0, 'hsc', { attempted: 0, marks_attempted: 0, marks_earned: 0, scored: 0, full_marks: 0 })
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
		expect(summary.byKind.map(e => [e.key, e.questions])).toEqual([
			['hsc', 2],
			['trial', 1],
			['other', 2]
		]);
	});
});

describe('summarizePapers', () => {
	it('counts fully attempted and started papers, ignoring empty ones', () => {
		expect(
			summarizePapers([
				paper(1, 'hsc', 2024, { questions: 4, attempted: 4 }),
				paper(2, 'hsc', 2023, { questions: 4, attempted: 1 }),
				paper(3, 'trial', 2024, { questions: 4, attempted: 0 }),
				paper(4, 'trial', 2024, { questions: 0, attempted: 0 })
			])
		).toEqual({ total: 3, complete: 1, started: 1 });
	});
});

describe('hscTopicMap', () => {
	it('lays out one column per tagged HSC paper and sorts topics by total marks', () => {
		const map = hscTopicMap(
			[
				{ grp: 'vectors', paper_id: 2, questions: 1, marks: 6 },
				{ grp: 'calculus', paper_id: 1, questions: 2, marks: 20 },
				{ grp: 'calculus', paper_id: 2, questions: 1, marks: 12 },
				{ grp: 'calculus', paper_id: 3, questions: 9, marks: 99 },
				{ grp: 'calculus', sub: 'integration', paper_id: 1, questions: 1, marks: 5 }
			],
			[paper(1, 'hsc', 2024), paper(2, 'hsc', 2021), paper(3, 'trial', 2024)],
			[
				{ key: 'calculus', name: 'Calculus', topicIds: [1], subtopics: [] },
				{ key: 'vectors', name: 'Vectors', topicIds: [2], subtopics: [] }
			]
		);
		expect(map.papers.map(p => p.academic_year)).toEqual([2021, 2024]);
		expect(map.rows).toEqual([
			{ key: 'calculus', name: 'Calculus', cells: [12, 20], total: 32 },
			{ key: 'vectors', name: 'Vectors', cells: [6, 0], total: 6 }
		]);
		expect(map.max).toBe(20);
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

	const run = async <T>(query: { sql: string; params: any[] }) =>
		(await env.DB.prepare(query.sql).bind(...query.params).all<T>()).results;

	const groupsJson = () =>
		topicGroupsJson(
			buildTopicGroups([
				{ id: 1, name: 'Calculus' },
				{ id: 2, name: 'Calculus 1.2 Differentiation' },
				{ id: 3, name: 'Probability' },
				{ id: 4, name: 'Vectors' },
				{ id: 5, name: 'Calculus - Integration' },
				{ id: 6, name: 'calculus – integration' },
				{ id: 7, name: 'Z-scores' }
			])
		);

	it('counts a question once per topic however many of its subtopics it carries', async () => {
		await setup();
		const rows = await run<Record<string, unknown>>(buildTopicStatsQuery(USER, MATHS, groupsJson()));
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
		const rows = await run<TopicPaperRow>(buildTopicPaperQuery(MATHS, groupsJson()));
		const cells = rows.map(row => `${row.grp}${row.sub ? `/${row.sub}` : ''}:${row.paper_id}=${row.marks}/${row.questions}`).sort();
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

	it('classifies papers and counts attempts per paper', async () => {
		await setup();
		const papers = await run<PaperRow>(buildPaperQuery(USER, MATHS));
		expect(papers.map(p => [p.id, p.kind, p.questions, p.marks, p.attempted])).toEqual([
			[1, 'hsc', 5, 14, 4],
			[2, 'hsc', 2, 3, 1],
			[3, 'trial', 2, 6, 2],
			[4, 'other', 1, 3, 0]
		]);
		expect(summarizePapers(papers)).toEqual({ total: 4, complete: 1, started: 2 });

		const topicPapers = await run<TopicPaperRow>(buildTopicPaperQuery(MATHS, groupsJson()));
		const weights = examWeights(topicPapers, papers, defaultWeightBasis(topicPapers, papers));
		expect(weights.basis).toBe('hsc');
		expect(weights.papers.map(p => p.id)).toEqual([1, 2]);
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
	});

	it('sums the breakdown cube to the subject totals', async () => {
		await setup();
		const summary = summarizeBreakdown(await run<BreakdownRow>(buildBreakdownQuery(USER, MATHS)));
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
		expect(summary.byKind.map(e => [e.key, e.questions, e.attempted])).toEqual([
			['hsc', 7, 5],
			['trial', 2, 2],
			['other', 1, 0]
		]);
	});

	it('matches the Review tab queue and scores retries from the latest review attempt', async () => {
		await setup();
		const [stats] = await run<Record<string, number>>(buildReviewStatsQuery(USER, MATHS));
		const queue = await run<{ id: number }>(buildReviewQueueQuery(USER, MATHS));
		expect(stats.queued).toBe(queue.length);
		// Queued: 102 (1/3), 104 (2/6 with a note), 302 (0/2). Retried: 102 and 104. Fixed: 104, whose
		// latest retry is 6/6 (its older 3/6 doesn't count). Recovered: (6 - 2) + (2 - 1).
		expect(stats).toEqual({ queued: 3, dropped: 3, retried: 2, fixed: 1, recovered: 5 });
	});

	it('scores only finished mocks, from marks saved after they were finished', async () => {
		await setup();
		const rows = await run<MockRow>(buildMockStatsQuery(USER, MATHS));
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
	});

	it('buckets first attempts and review attempts into Sydney days', async () => {
		await setup();
		const days = dailyActivity(await run<ActivityRow>(buildActivityQuery(USER, MATHS)));
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
			activeLast30: 6,
			lastActive: '2026-10-09'
		});
	});
});
