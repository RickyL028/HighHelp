// Who a Q&A question is "relevant" to: students whose tags show they take the question's subject.
//
// New questions are filed under one of the asker's own tags ("Mathematics Extension 1 Yr11"), the
// way announcements target tags. Older questions used SUBJECTS keys ("Mathematics 3U (HSC)", or a
// bare "Physics" for the Year 11 course). Every form is reduced to one lowercase subject key -- the
// portal's name without the year suffix -- so a question still reaches the class after the tags
// roll over from Yr11 to Yr12, and old questions keep notifying the right students.
// As with announcements, a tag counts when its key exists, whatever its 0/1 display value.
//
// The JS and SQL forms below must agree; test/forumRelevance.test.ts checks them against each other.

// Forum subject base (lowercase, no " (HSC)") -> portal subject base, where the two differ.
export const FORUM_TAG_ALIASES: Record<string, string> = {
	'mathematics 2u': 'mathematics advanced',
	'mathematics 3u': 'mathematics extension 1',
	'mathematics 4u': 'mathematics extension 2',
	'health & movement science': 'health and movement science',
};

const HSC_SUFFIX = ' (hsc)';
const YEAR_TAG_SUFFIX = /^(.*) Yr[0-9][0-9]$/;
const YEAR_TAG_SUFFIX_LOWER = /^(.+) yr[0-9][0-9]$/;

// "Other" is the catch-all a student can always ask in. No tag matches it, so it notifies nobody.
export const GENERAL_SUBJECT = 'Other';

export function forumSubjectKey(subject: string): string {
	let base = String(subject || '').toLowerCase();
	if (base.endsWith(HSC_SUFFIX)) base = base.slice(0, -HSC_SUFFIX.length);
	else {
		const m = YEAR_TAG_SUFFIX_LOWER.exec(base);
		if (m) base = m[1];
	}
	return FORUM_TAG_ALIASES[base] ?? base;
}

export function tagSubjectKey(tag: string): string {
	const m = YEAR_TAG_SUFFIX.exec(String(tag || ''));
	return (m ? m[1] : String(tag || '')).toLowerCase();
}

// The tags a user carries, as stored. 'Year' and 'External' are reserved tags, never subjects.
export function viewerSubjectTags(tagsJson: string | null | undefined): string[] {
	const tags: string[] = [];
	try {
		const parsed = tagsJson ? JSON.parse(tagsJson) : null;
		if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
			for (const [key, value] of Object.entries(parsed)) {
				if (key === 'Year' || key === 'External' || value === null || value === undefined) continue;
				tags.push(key);
			}
		}
	} catch (e) {
		// A malformed tags column just means "no subjects".
	}
	return tags.sort((a, b) => a.localeCompare(b));
}

export function viewerSubjectKeys(tagsJson: string | null | undefined): Set<string> {
	return new Set(viewerSubjectTags(tagsJson).map(tagSubjectKey));
}

// What a user may file a question under: their own tags, plus the general catch-all.
export function askableSubjects(tagsJson: string | null | undefined): string[] {
	return [...viewerSubjectTags(tagsJson), GENERAL_SUBJECT];
}

export function isRelevantSubject(subject: string, tagsJson: string | null | undefined): boolean {
	return viewerSubjectKeys(tagsJson).has(forumSubjectKey(subject));
}

const sqlString = (s: string) => `'${s.replace(/'/g, "''")}'`;

const ALIAS_VALUES = Object.entries(FORUM_TAG_ALIASES)
	.map(([from, to]) => `(${sqlString(from)}, ${sqlString(to)})`)
	.join(', ');

// SQL twin of forumSubjectKey(). `col` is any SQL expression yielding a forum subject.
export const forumSubjectKeySql = (col: string) => {
	const lowered = `lower(${col})`;
	const base = `(CASE WHEN ${lowered} LIKE '%${HSC_SUFFIX}' THEN substr(${lowered}, 1, length(${lowered}) - ${HSC_SUFFIX.length})
		WHEN ${lowered} GLOB '?* yr[0-9][0-9]' THEN substr(${lowered}, 1, length(${lowered}) - 5)
		ELSE ${lowered} END)`;
	return `COALESCE((SELECT fa.column2 FROM (VALUES ${ALIAS_VALUES}) fa WHERE fa.column1 = ${base}), ${base})`;
};

// SQL twin of tagSubjectKey().
export const tagSubjectKeySql = (col: string) =>
	`lower(CASE WHEN ${col} GLOB '* Yr[0-9][0-9]' THEN substr(${col}, 1, length(${col}) - 5) ELSE ${col} END)`;

// SQL predicate: the viewer's tags include the subject that `subjectCol` is filed under.
// `viewerTags` is any SQL expression yielding users.tags JSON (a `u.tags` column or VIEWER_TAGS_EXPR).
// Malformed or missing tags fall back to '{}' so one bad row can never fail the whole query.
export const forumRelevanceMatch = (subjectCol: string, viewerTags: string) => `
	EXISTS (
		SELECT 1 FROM json_each(CASE WHEN json_valid(${viewerTags}) THEN ${viewerTags} ELSE '{}' END) fje
		WHERE fje.key NOT IN ('Year', 'External')
		  AND fje.type <> 'null'
		  AND ${tagSubjectKeySql('fje.key')} = ${forumSubjectKeySql(subjectCol)}
	)`;
