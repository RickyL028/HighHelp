import { env } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';
import {
	buildMockQuestionInserts,
	buildQuestionIdLookups,
	missingQuestionIds,
	parseQuestionIdList
} from '../src/routes/pastPapers/mockIds';

describe('parseQuestionIdList', () => {
	it('reads comma lists with or without spaces, keeping the given order', () => {
		expect(parseQuestionIdList('1, 4, 100,49')).toEqual({ ids: [1, 4, 100, 49], invalid: [], duplicates: [] });
	});

	it('accepts new lines, semicolons, brackets and # prefixes', () => {
		expect(parseQuestionIdList('[12,\n40]; #7\t 9').ids).toEqual([12, 40, 7, 9]);
	});

	it('drops repeats but reports them', () => {
		const parsed = parseQuestionIdList('3, 5, 3, 3, 5');
		expect(parsed.ids).toEqual([3, 5]);
		expect(parsed.duplicates).toEqual([3, 5]);
	});

	it('flags tokens that are not positive whole numbers', () => {
		const parsed = parseQuestionIdList('1, Q4, 2.5, 0, -3, 7');
		expect(parsed.ids).toEqual([1, 7]);
		expect(parsed.invalid).toEqual(['Q4', '2.5', '0', '-3']);
	});

	it('returns nothing for blank input', () => {
		expect(parseQuestionIdList('  \n ,, ')).toEqual({ ids: [], invalid: [], duplicates: [] });
	});
});

describe('missingQuestionIds', () => {
	it('lists requested IDs absent from the lookup, in request order', () => {
		expect(missingQuestionIds([9, 2, 5], [2])).toEqual([9, 5]);
		expect(missingQuestionIds([1, 2], [2, 1])).toEqual([]);
	});
});

describe('buildMockQuestionInserts', () => {
	it('stays under the D1 parameter cap and keeps a continuous ordering index', () => {
		const ids = Array.from({ length: 70 }, (_, i) => 1000 + i);
		const inserts = buildMockQuestionInserts(5, ids);
		expect(inserts.length).toBe(3);
		for (const insert of inserts) expect(insert.params.length).toBeLessThanOrEqual(100);
		const rows = inserts.flatMap(insert => {
			const out: number[][] = [];
			for (let i = 0; i < insert.params.length; i += 3) out.push(insert.params.slice(i, i + 3));
			return out;
		});
		expect(rows.map(r => r[1])).toEqual(ids);
		expect(rows.map(r => r[2])).toEqual(ids.map((_, i) => i));
		expect(rows.every(r => r[0] === 5)).toBe(true);
	});
});

describe('buildQuestionIdLookups', () => {
	beforeAll(async () => {
		await env.DB.batch([
			env.DB.prepare('DROP TABLE IF EXISTS exam_questions'),
			env.DB.prepare('DROP TABLE IF EXISTS papers'),
			env.DB.prepare('CREATE TABLE papers (id INTEGER PRIMARY KEY, subject TEXT)'),
			env.DB.prepare('CREATE TABLE exam_questions (id INTEGER PRIMARY KEY, paper_id INTEGER, is_deleted INTEGER DEFAULT 0)'),
			env.DB.prepare(`INSERT INTO papers (id, subject) VALUES (1, 'Mathematics'), (2, 'Physics')`),
			env.DB.prepare(`INSERT INTO exam_questions (id, paper_id, is_deleted) VALUES (1, 1, 0), (4, 1, 0), (49, 1, 1), (100, 2, 0)`)
		]);
		const many = Array.from({ length: 150 }, (_, i) => `(${1000 + i}, 1, 0)`).join(', ');
		await env.DB.prepare(`INSERT INTO exam_questions (id, paper_id, is_deleted) VALUES ${many}`).run();
	});

	const run = async (ids: number[], subject: string) => {
		const results = await env.DB.batch(buildQuestionIdLookups(ids, subject).map(q => env.DB.prepare(q.sql).bind(...q.params)));
		return results.flatMap(r => (r.results as { id: number }[]).map(row => row.id));
	};

	it('finds only live questions from the requested subject', async () => {
		const found = await run([1, 4, 100, 49, 7], 'Mathematics');
		expect(found.sort((a, b) => a - b)).toEqual([1, 4]);
		expect(missingQuestionIds([1, 4, 100, 49, 7], found)).toEqual([100, 49, 7]);
	});

	it('splits large lists across statements that D1 accepts', async () => {
		const ids = Array.from({ length: 150 }, (_, i) => 1000 + i);
		const lookups = buildQuestionIdLookups(ids, 'Mathematics');
		expect(lookups.length).toBe(2);
		for (const lookup of lookups) expect(lookup.params.length).toBeLessThanOrEqual(100);
		expect((await run(ids, 'Mathematics')).length).toBe(150);
	});
});
