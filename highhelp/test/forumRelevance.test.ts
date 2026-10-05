import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { SUBJECTS } from '../src/constants';
import {
	askableSubjects,
	forumRelevanceMatch,
	forumSubjectKey,
	forumSubjectKeySql,
	isRelevantSubject,
	tagSubjectKey,
	tagSubjectKeySql,
	viewerSubjectKeys,
} from '../src/forumRelevance';

// Real tag shape from buildUserTags(): portal subject names with a year suffix, plus Year.
const TAGS = JSON.stringify({
	'ACCELERATED COURSES COMPLETED Yr11': 0,
	'English Advanced Yr11': 0,
	'Mathematics Extension 1 Yr11': 0,
	'Physics Yr11': 1,
	Year: '11',
});

describe('forum subject relevance', () => {
	it('maps forum subjects onto portal subject names', () => {
		expect(forumSubjectKey('Mathematics 3U (HSC)')).toBe('mathematics extension 1');
		expect(forumSubjectKey('Mathematics 2U (HSC)')).toBe('mathematics advanced');
		expect(forumSubjectKey('Physics')).toBe('physics');
		expect(forumSubjectKey('Physics (HSC)')).toBe('physics');
		expect(forumSubjectKey('Mathematics Advanced')).toBe('mathematics advanced'); // legacy rows
	});

	it('keys tag-named questions by subject, whatever the year', () => {
		expect(forumSubjectKey('Mathematics Extension 1 Yr11')).toBe('mathematics extension 1');
		expect(forumSubjectKey('Physics Yr12')).toBe('physics');
		expect(isRelevantSubject('Physics Yr12', TAGS)).toBe(true); // still reaches the class after rollover
		expect(isRelevantSubject('Chemistry Yr11', TAGS)).toBe(false);
	});

	it('only offers the asker their own tags plus Other', () => {
		expect(askableSubjects(TAGS)).toEqual([
			'ACCELERATED COURSES COMPLETED Yr11',
			'English Advanced Yr11',
			'Mathematics Extension 1 Yr11',
			'Physics Yr11',
			'Other',
		]);
		expect(askableSubjects(null)).toEqual(['Other']);
	});

	it('strips the year suffix from tags', () => {
		expect(tagSubjectKey('Physics Yr11')).toBe('physics');
		expect(tagSubjectKey('Mathematics Extension 1 Yr12')).toBe('mathematics extension 1');
		expect(tagSubjectKey('Physics')).toBe('physics');
	});

	it('counts a 0-valued tag and ignores reserved tags', () => {
		const keys = viewerSubjectKeys(TAGS);
		expect(keys.has('english advanced')).toBe(true);
		expect(keys.has('year')).toBe(false);
		expect(isRelevantSubject('English Advanced (HSC)', TAGS)).toBe(true);
		expect(isRelevantSubject('Mathematics 3U (HSC)', TAGS)).toBe(true);
		expect(isRelevantSubject('Chemistry (HSC)', TAGS)).toBe(false);
		expect(isRelevantSubject('Other', TAGS)).toBe(false);
	});

	it('treats missing or malformed tags as no subjects', () => {
		expect(viewerSubjectKeys(null).size).toBe(0);
		expect(viewerSubjectKeys('not json').size).toBe(0);
	});

	// D1 counts parameter occurrences and the SQL forms repeat their input, so it goes through a CTE.
	it('SQL keys agree with the JS keys', async () => {
		const subjects = [...SUBJECTS, 'Mathematics Advanced', 'Chinese Continuers', ...Object.keys(JSON.parse(TAGS)), 'Physics Yr12', 'Yr11'];
		for (const s of subjects) {
			const row = await env.DB.prepare(`WITH v AS (SELECT ? AS x) SELECT ${forumSubjectKeySql('(SELECT x FROM v)')} AS k`).bind(s).first<{ k: string }>();
			expect(row?.k, s).toBe(forumSubjectKey(s));
		}
		for (const t of Object.keys(JSON.parse(TAGS))) {
			const row = await env.DB.prepare(`WITH v AS (SELECT ? AS x) SELECT ${tagSubjectKeySql('(SELECT x FROM v)')} AS k`).bind(t).first<{ k: string }>();
			expect(row?.k, t).toBe(tagSubjectKey(t));
		}
	});

	it('SQL predicate agrees with isRelevantSubject', async () => {
		const tagSets = [TAGS, null, 'not json', '{}'];
		for (const tags of tagSets) {
			for (const s of [...SUBJECTS, ...askableSubjects(TAGS), 'Chemistry Yr11']) {
				const row = await env.DB.prepare(`WITH viewer AS (SELECT ? AS tags), post AS (SELECT ? AS subject)
					SELECT ${forumRelevanceMatch('(SELECT subject FROM post)', '(SELECT tags FROM viewer)')} AS m`)
					.bind(tags, s)
					.first<{ m: number }>();
				expect(!!row?.m, `${s} / ${tags}`).toBe(isRelevantSubject(s, tags));
			}
		}
	});
});
