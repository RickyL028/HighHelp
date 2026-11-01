import { describe, expect, it } from 'vitest';
import { addDays, extractChanges, formatChangeNotification, newChanges, parseSnapshot, planCheck, sydneyClock } from '../src/timetableChanges';

// Shaped like student.sbhs.net.au/api/timetable/daytimetable.json
const day = {
	status: 'OK',
	timetable: {
		timetable: {
			periods: {
				RC: { title: 'RC', room: '101' },
				'1': { title: 'MAX1', teacher: 'ABC', room: '204', year: '11' },
				'2': { title: 'ENG', teacher: 'DEF', room: '301', year: '11' },
				'3': { title: 'PHY', teacher: 'GHI', room: '402', year: '11' },
				'5': { title: 'CHE', teacher: 'JKL', room: '108', year: '11' },
			},
		},
		subjects: {
			'11MAX1': { title: '11 Mathematics Extension 1', shortTitle: 'MAX1' },
			'11ENG': { title: '11 English Advanced', shortTitle: 'ENG' },
		},
	},
	classVariations: {
		'1': { period: '1', type: 'replacement', casual: 'SMIT', casualSurname: 'Smith', title: 'MAX1' },
		'2': { period: '2', type: 'nocover', title: 'ENG' },
		'3': { period: '3', type: 'novariation', title: 'PHY' },
	},
	roomVariations: {
		'1': { period: '1', roomFrom: '204', roomTo: '108', title: 'MAX1' },
		'5': { period: '5', roomFrom: '108', roomTo: '108', title: 'CHE' },
	},
};

describe('extractChanges', () => {
	it('picks out subs, no-cover and room changes, ignoring non-variations', () => {
		expect(extractChanges(day)).toEqual([
			{ period: '1', subject: '11 Mathematics Extension 1', kind: 'room', detail: 'Room 204 → 108' },
			{ period: '1', subject: '11 Mathematics Extension 1', kind: 'sub', detail: 'Sub: Smith' },
			{ period: '2', subject: '11 English Advanced', kind: 'nocover', detail: 'No cover' },
		]);
	});

	it('handles missing data, arrays of variations and unknown subjects', () => {
		expect(extractChanges(null)).toEqual([]);
		expect(extractChanges({ status: 'OK' })).toEqual([]);
		expect(
			extractChanges({
				classVariations: [{ period: '4', type: 'replacement', teacher: 'XYZ', title: 'GEO' }],
				roomVariations: [{ period: 'RC', roomTo: 'Hall' }],
			})
		).toEqual([
			{ period: 'RC', subject: 'Class', kind: 'room', detail: 'Room Hall' },
			{ period: '4', subject: 'GEO', kind: 'class', detail: 'Class changed' },
		]);
	});
});

describe('newChanges', () => {
	const current = extractChanges(day);

	it('treats everything as new without a snapshot', () => {
		expect(newChanges([], current)).toEqual(current);
	});

	it('alerts each change once, and again only if it changes', () => {
		expect(newChanges(current, current)).toEqual([]);

		const differentSub = current.map((c) => (c.kind === 'sub' ? { ...c, detail: 'Sub: Jones' } : c));
		expect(newChanges(current, differentSub)).toEqual([{ ...current[1], detail: 'Sub: Jones' }]);

		expect(newChanges(current, current.slice(0, 1))).toEqual([]);
	});

	it('survives a corrupt snapshot', () => {
		expect(parseSnapshot('not json')).toEqual([]);
		expect(parseSnapshot('{"a":1}')).toEqual([]);
		expect(parseSnapshot(JSON.stringify(current))).toEqual(current);
	});
});

describe('formatChangeNotification', () => {
	it('groups changes by period', () => {
		expect(formatChangeNotification(extractChanges(day), 'today')).toEqual({
			title: '2 timetable changes today',
			body: 'P1 11 Mathematics Extension 1: Room 204 → 108, Sub: Smith\nP2 11 English Advanced: No cover',
		});
	});

	it('uses a singular title and caps the length', () => {
		expect(formatChangeNotification([{ period: 'RC', subject: 'Roll Call', kind: 'room', detail: 'Room 5' }], 'tomorrow').title).toBe(
			'Timetable change tomorrow'
		);

		const many = Array.from({ length: 11 }, (_, i) => ({ period: String(i), subject: 'S', kind: 'nocover' as const, detail: 'No cover' }));
		const { body } = formatChangeNotification(many, 'today');
		expect(body.split('\n')).toHaveLength(9);
		expect(body.endsWith('+3 more')).toBe(true);
	});
});

describe('scheduling', () => {
	// Sydney is UTC+11 (AEDT) from October to April and UTC+10 (AEST) otherwise.
	const at = (iso: string) => new Date(iso);

	it('reads the Sydney wall clock across daylight saving', () => {
		expect(sydneyClock(at('2026-11-01T21:30:00Z'))).toEqual({ date: '2026-11-02', weekday: 1, minutes: 8 * 60 + 30 });
		expect(sydneyClock(at('2026-06-01T22:30:00Z'))).toEqual({ date: '2026-06-02', weekday: 2, minutes: 8 * 60 + 30 });
		expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
	});

	it('checks today during school hours on weekdays', () => {
		expect(planCheck(at('2026-11-01T21:30:00Z'))).toEqual({ date: '2026-11-02', label: 'today' }); // Mon 8:30am
		expect(planCheck(at('2026-11-02T04:00:00Z'))).toEqual({ date: '2026-11-02', label: 'today' }); // Mon 3:00pm
		expect(planCheck(at('2026-10-31T21:30:00Z'))).toBeNull(); // Sun 8:30am
		expect(planCheck(at('2026-11-01T18:45:00Z'))).toBeNull(); // Mon 5:45am
	});

	it('looks ahead to tomorrow on Sunday to Thursday evenings, every half hour', () => {
		expect(planCheck(at('2026-11-02T05:30:00Z'))).toEqual({ date: '2026-11-03', label: 'tomorrow' }); // Mon 4:30pm
		expect(planCheck(at('2026-11-02T05:45:00Z'))).toBeNull(); // Mon 4:45pm
		expect(planCheck(at('2026-11-01T09:00:00Z'))).toEqual({ date: '2026-11-02', label: 'tomorrow' }); // Sun 8:00pm
		expect(planCheck(at('2026-11-06T09:00:00Z'))).toBeNull(); // Fri 8:00pm
		expect(planCheck(at('2026-11-02T10:00:00Z'))).toBeNull(); // Mon 9:00pm
	});
});
