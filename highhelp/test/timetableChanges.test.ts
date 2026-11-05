import { describe, expect, it } from 'vitest';
import {
	addDays,
	extractChanges,
	firstClassGroup,
	formatChangeNotification,
	newChanges,
	parseSnapshot,
	planTick,
	scannedOn,
	sydneyClock,
} from '../src/timetableChanges';

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

	const dates = (iso: string) => planTick(at(iso)).checks.map((c) => `${c.date} ${c.label}`);

	it('checks the rest of the school week, nearer days more often', () => {
		// Mon 2 Nov 2026, 9:00am: every day to Friday is due on the hour
		expect(dates('2026-11-01T22:00:00Z')).toEqual([
			'2026-11-02 today',
			'2026-11-03 tomorrow',
			'2026-11-04 on Wednesday',
			'2026-11-05 on Thursday',
			'2026-11-06 on Friday',
		]);
		expect(dates('2026-11-01T21:30:00Z')).toEqual(['2026-11-02 today', '2026-11-03 tomorrow']); // 8:30am
		expect(dates('2026-11-01T21:45:00Z')).toEqual(['2026-11-02 today']); // 8:45am
		expect(dates('2026-11-01T21:50:00Z')).toEqual([]); // 8:50am
	});

	it('drops today after period 5, and stops at Friday', () => {
		expect(dates('2026-11-02T05:00:00Z')).toEqual([
			'2026-11-03 tomorrow',
			'2026-11-04 on Wednesday',
			'2026-11-05 on Thursday',
			'2026-11-06 on Friday',
		]); // Mon 4:00pm
		expect(dates('2026-11-05T21:00:00Z')).toEqual(['2026-11-06 today']); // Fri 8:00am
		expect(dates('2026-11-06T05:00:00Z')).toEqual([]); // Fri 4:00pm
	});

	it('looks at next week on Saturday and Sunday', () => {
		expect(dates('2026-11-06T22:00:00Z')).toEqual([
			'2026-11-09 on Monday',
			'2026-11-10 on Tuesday',
			'2026-11-11 on Wednesday',
			'2026-11-12 on Thursday',
			'2026-11-13 on Friday',
		]); // Sat 9:00am
		expect(dates('2026-11-07T22:00:00Z')).toEqual([
			'2026-11-09 tomorrow',
			'2026-11-10 on Tuesday',
			'2026-11-11 on Wednesday',
			'2026-11-12 on Thursday',
			'2026-11-13 on Friday',
		]); // Sun 9:00am
	});

	it('stays quiet overnight', () => {
		expect(dates('2026-11-01T18:45:00Z')).toEqual([]); // Mon 5:45am
		expect(dates('2026-11-02T10:00:00Z')).toEqual([]); // Mon 9:00pm
	});

	it('marks scan-on deadlines ten minutes before the first class', () => {
		const scan = (iso: string) => planTick(at(iso)).scan;
		expect(scan('2026-11-01T20:50:00Z')).toEqual({ group: 'p0', time: '7:50am' }); // Mon
		expect(scan('2026-11-01T21:50:00Z')).toEqual({ group: 'p1', time: '8:50am' }); // Mon
		expect(scan('2026-11-05T20:50:00Z')).toEqual({ group: 'p0', time: '7:50am' }); // Fri
		expect(scan('2026-11-05T21:50:00Z')).toBeNull(); // Fri 8:50, period 1 starts at 9:25
		expect(scan('2026-11-05T22:15:00Z')).toEqual({ group: 'p1', time: '9:15am' }); // Fri
		expect(scan('2026-11-06T21:50:00Z')).toBeNull(); // Sat
		expect(scan('2026-11-01T21:55:00Z')).toBeNull(); // Mon 8:55
		expect(scan('2026-06-01T21:50:00Z')).toEqual({ group: 'p0', time: '7:50am' }); // Tue in winter (AEST)
	});
});

describe('scan-on helpers', () => {
	const withPeriods = (periods: Record<string, unknown>) => ({ status: 'OK', timetable: { timetable: { periods } } });

	it('groups students by their first class', () => {
		expect(firstClassGroup(withPeriods({ '0': { title: 'MUS' }, '1': { title: 'ENG' } }))).toBe('p0');
		expect(firstClassGroup(withPeriods({ RC: { title: 'RC' }, '2': { title: 'ENG' } }))).toBe('p1');
		expect(firstClassGroup(withPeriods({ RC: { title: 'RC' }, '0': {} }))).toBeNull();
		expect(firstClassGroup({ status: 'OK' })).toBeNull();
	});

	it('finds a scan-in for the day', () => {
		const scans = { member: [{ date: '2026-11-03', timestamp: '2026-11-03T08:41:00+11:00' }] };
		expect(scannedOn(scans, '2026-11-03')).toBe(true);
		expect(scannedOn(scans, '2026-11-04')).toBe(false);
		expect(scannedOn(null, '2026-11-04')).toBe(false);
	});
});
