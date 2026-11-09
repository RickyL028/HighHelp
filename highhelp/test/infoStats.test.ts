import { env } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';
import { ATTEMPTS_PER_DAY_SQL, USERS_PER_DAY_SQL, cumulativeDaily, sydneyToday } from '../src/infoStats';

describe('cumulativeDaily', () => {
	it('fills gaps and runs through the end date', () => {
		const out = cumulativeDaily(
			[
				{ day: '2026-02-27', n: 2 },
				{ day: '2026-03-02', n: 3 }
			],
			'2026-03-03'
		);
		expect(out.labels).toEqual(['2026-02-27', '2026-02-28', '2026-03-01', '2026-03-02', '2026-03-03']);
		expect(out.values).toEqual([2, 2, 2, 5, 5]);
	});

	it('handles no rows, and rows later than the end date', () => {
		expect(cumulativeDaily([], '2026-03-03')).toEqual({ labels: [], values: [] });
		expect(cumulativeDaily([{ day: '2026-03-04', n: 1 }], '2026-03-03').labels).toEqual(['2026-03-04']);
	});

	it('starts at an earlier shared start date with zeros', () => {
		const out = cumulativeDaily([{ day: '2026-03-02', n: 4 }], '2026-03-02', '2026-02-28');
		expect(out.labels).toEqual(['2026-02-28', '2026-03-01', '2026-03-02']);
		expect(out.values).toEqual([0, 0, 4]);
		expect(cumulativeDaily([], '2026-03-01', '2026-02-28').values).toEqual([0, 0]);
		expect(cumulativeDaily([{ day: '2026-02-27', n: 1 }], '2026-02-28', '2026-02-28').labels).toEqual(['2026-02-27', '2026-02-28']);
	});
});

describe('sydneyToday', () => {
	it('rolls over at 14:00 UTC', () => {
		expect(sydneyToday(Date.parse('2026-03-03T13:59:00Z'))).toBe('2026-03-03');
		expect(sydneyToday(Date.parse('2026-03-03T14:00:00Z'))).toBe('2026-03-04');
	});
});

describe('info SQL', () => {
	beforeAll(async () => {
		await env.DB.batch([
			env.DB.prepare('DROP TABLE IF EXISTS users'),
			env.DB.prepare('DROP TABLE IF EXISTS exam_questions'),
			env.DB.prepare('DROP TABLE IF EXISTS user_question_attempts'),
			env.DB.prepare('DROP TABLE IF EXISTS user_review_attempts'),
			env.DB.prepare('CREATE TABLE users (id INTEGER PRIMARY KEY, created_at TIMESTAMP)'),
			env.DB.prepare('CREATE TABLE exam_questions (id INTEGER PRIMARY KEY, marks INTEGER, question_type TEXT)'),
			env.DB.prepare('CREATE TABLE user_question_attempts (user_id INTEGER, question_id INTEGER, created_at TIMESTAMP)'),
			env.DB.prepare('CREATE TABLE user_review_attempts (user_id INTEGER, question_id INTEGER, created_at TIMESTAMP)'),
			env.DB.prepare(
				`INSERT INTO users VALUES (1, '2026-03-01 01:00:00'), (2, '2026-03-01 15:00:00'), (3, '2026-03-02 02:00:00')`
			),
			env.DB.prepare(`INSERT INTO exam_questions VALUES (10, 4, 'written'), (11, NULL, 'multiple_choice'), (12, NULL, 'written')`),
			env.DB.prepare(
				`INSERT INTO user_question_attempts VALUES (1, 10, '2026-03-01 01:00:00'), (1, 11, '2026-03-01 02:00:00'), (2, 12, '2026-03-02 00:00:00'), (2, 99, '2026-03-02 00:00:00')`
			),
			env.DB.prepare(`INSERT INTO user_review_attempts VALUES (1, 10, '2026-03-02 01:00:00')`)
		]);
	});

	it('buckets users by Sydney day', async () => {
		const { results } = await env.DB.prepare(USERS_PER_DAY_SQL).all();
		expect(results).toEqual([
			{ day: '2026-03-01', n: 1 },
			{ day: '2026-03-02', n: 2 }
		]);
	});

	it('counts first attempts and reviews, with MC worth 1 and unmarked/missing questions worth 0', async () => {
		const { results } = await env.DB.prepare(ATTEMPTS_PER_DAY_SQL).all();
		expect(results).toEqual([
			{ day: '2026-03-01', n: 2, marks: 5 },
			{ day: '2026-03-02', n: 3, marks: 4 }
		]);
	});
});
