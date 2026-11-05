// Pure helpers for timetable change alerts: what counts as a change in a portal daytimetable.json
// response, which changes are new since the last alert, the notification text, and when the cron
// should check. The change rules mirror how the Day view badges a period (TimetableDay.tsx).

export type ChangeKind = 'sub' | 'nocover' | 'class' | 'room';

export interface TimetableChange {
    period: string;
    subject: string;
    kind: ChangeKind;
    detail: string;
}

// The portal keys variations by period; tolerate an array of `{ period, ... }` too.
function byPeriod(value: unknown): Record<string, any> {
    if (Array.isArray(value)) {
        const out: Record<string, any> = {};
        for (const v of value) if (v && v.period != null) out[String(v.period)] = v;
        return out;
    }
    return value && typeof value === 'object' ? (value as Record<string, any>) : {};
}

function subjectName(day: any, period: any, fallback: unknown): string {
    const title = period?.title ?? fallback;
    const subjects = day?.timetable?.subjects;
    let subject: any = null;
    if (Array.isArray(subjects)) {
        subject = subjects.find((s: any) => s && (s.shortTitle === title || s.title === title));
    } else if (subjects && typeof subjects === 'object' && title) {
        subject = subjects[`${period?.year ?? ''}${title}`] ?? subjects[title];
    }
    const name = subject?.title || subject?.shortTitle || title;
    return typeof name === 'string' && name.trim() ? name.trim() : 'Class';
}

const PERIOD_ORDER: Record<string, number> = { '0': 0, RC: 0.5 };

function periodRank(period: string): number {
    if (period in PERIOD_ORDER) return PERIOD_ORDER[period];
    const n = Number(period);
    return Number.isFinite(n) ? n : 99;
}

function compareChanges(a: TimetableChange, b: TimetableChange) {
    return periodRank(a.period) - periodRank(b.period) || a.period.localeCompare(b.period) || a.kind.localeCompare(b.kind);
}

export function extractChanges(day: any): TimetableChange[] {
    const periods = byPeriod(day?.timetable?.timetable?.periods);
    const changes: TimetableChange[] = [];

    for (const [period, v] of Object.entries(byPeriod(day?.classVariations))) {
        if (!v || v.type === 'novariation') continue;
        const subject = subjectName(day, periods[period], v.title);
        const casual = v.casualSurname || v.casual;
        if (casual) changes.push({ period, subject, kind: 'sub', detail: `Sub: ${casual}` });
        else if (v.type === 'nocover') changes.push({ period, subject, kind: 'nocover', detail: 'No cover' });
        else changes.push({ period, subject, kind: 'class', detail: 'Class changed' });
    }

    for (const [period, v] of Object.entries(byPeriod(day?.roomVariations))) {
        if (!v || !v.roomTo) continue;
        const from = v.roomFrom || periods[period]?.room;
        if (from && from === v.roomTo) continue;
        const subject = subjectName(day, periods[period], v.title);
        changes.push({ period, subject, kind: 'room', detail: from ? `Room ${from} → ${v.roomTo}` : `Room ${v.roomTo}` });
    }

    return changes.sort(compareChanges);
}

// Changes in `current` that weren't alerted before: new periods/kinds, or a different detail
// (e.g. a different sub). Changes that disappear aren't alerted.
export function newChanges(previous: TimetableChange[], current: TimetableChange[]): TimetableChange[] {
    const seen = new Map(previous.map((c) => [`${c.period}|${c.kind}`, c.detail]));
    return current.filter((c) => seen.get(`${c.period}|${c.kind}`) !== c.detail);
}

export function parseSnapshot(json: string | null | undefined): TimetableChange[] {
    if (!json) return [];
    try {
        const parsed = JSON.parse(json);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function periodLabel(period: string): string {
    if (/^\d+$/.test(period)) return `P${period}`;
    if (period === 'RC') return 'Roll call';
    return period;
}

const MAX_LINES = 8;

// One notification per date, listing every current change (it replaces the previous one for that date).
export function formatChangeNotification(changes: TimetableChange[], label: string): { title: string; body: string } {
    const grouped = new Map<string, { subject: string; details: string[] }>();
    for (const c of changes) {
        const entry = grouped.get(c.period) ?? { subject: c.subject, details: [] };
        entry.details.push(c.detail);
        grouped.set(c.period, entry);
    }
    const lines = [...grouped].map(([period, { subject, details }]) => `${periodLabel(period)} ${subject}: ${details.join(', ')}`);
    const shown = lines.slice(0, MAX_LINES);
    if (lines.length > MAX_LINES) shown.push(`+${lines.length - MAX_LINES} more`);
    const title = lines.length === 1 ? `Timetable change ${label}` : `${lines.length} timetable changes ${label}`;
    return { title, body: shown.join('\n') };
}

// ---- Scheduling ----

const SYDNEY = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Sydney',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
});

// The school's wall clock, which follows AEST/AEDT.
export function sydneyClock(now: Date): { date: string; weekday: number; minutes: number } {
    const parts: Record<string, string> = {};
    for (const p of SYDNEY.formatToParts(now)) parts[p.type] = p.value;
    const date = `${parts.year}-${parts.month}-${parts.day}`;
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    return { date, weekday, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

export function addDays(date: string, days: number): string {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}

export interface CheckPlan {
    date: string;
    label: string; // 'today', 'tomorrow' or 'on Wednesday', as used in the notification title
}

// A scan-on deadline: students whose first class is in `group` get reminded if they haven't scanned on.
export interface ScanDeadline {
    group: 'p0' | 'p1';
    time: string; // shown in the reminder, e.g. '8:50am'
}

export interface TickPlan {
    checks: CheckPlan[];
    scan: ScanDeadline | null;
}

const DAY_START = 6 * 60; // 6:00am
const SCHOOL_END = 15 * 60 + 15; // 3:15pm, just after period 5
const DAY_END = 21 * 60; // 9:00pm
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Ten minutes before the first class: P0 starts at 8:00, P1 at 9:00, or 9:25 on Fridays.
function scanDeadline(weekday: number, minutes: number): ScanDeadline | null {
    if (weekday < 1 || weekday > 5) return null;
    if (minutes === 7 * 60 + 50) return { group: 'p0', time: '7:50am' };
    if (weekday !== 5 && minutes === 8 * 60 + 50) return { group: 'p1', time: '8:50am' };
    if (weekday === 5 && minutes === 9 * 60 + 15) return { group: 'p1', time: '9:15am' };
    return null;
}

// What a cron tick (every 5 minutes) should do. Change checks cover the rest of the school week:
// from today (or tomorrow once period 5 is over) to Friday, or next week's Monday to Friday on
// Saturday and Sunday. Nearer days are checked more often: today every 15 minutes, tomorrow every
// 30, later days hourly, all between 6am and 9pm.
export function planTick(now: Date): TickPlan {
    const { date, weekday, minutes } = sydneyClock(now);
    const plan: TickPlan = { checks: [], scan: scanDeadline(weekday, minutes) };
    if (minutes < DAY_START || minutes >= DAY_END) return plan;

    let first: number; // days from today
    if (weekday === 6) first = 2;
    else if (weekday === 0) first = 1;
    else first = minutes < SCHOOL_END ? 0 : 1;
    const last = weekday === 6 ? 6 : weekday === 0 ? 5 : 5 - weekday; // up to Friday

    for (let offset = first; offset <= last; offset++) {
        const every = offset === 0 ? 15 : offset === 1 ? 30 : 60;
        if (minutes % every !== 0) continue;
        const label = offset === 0 ? 'today' : offset === 1 ? 'tomorrow' : `on ${WEEKDAYS[(weekday + offset) % 7]}`;
        plan.checks.push({ date: addDays(date, offset), label });
    }
    return plan;
}

const NON_CLASS_PERIODS = new Set(['RC', 'R', 'L1', 'L2', 'EoD']);

// Which scan-on group a student's day puts them in: 'p0' if they have period 0, 'p1' for any other
// day with classes, or null when there are no classes (holidays, pupil-free days).
export function firstClassGroup(day: any): 'p0' | 'p1' | null {
    const periods = byPeriod(day?.timetable?.timetable?.periods);
    const classes = Object.entries(periods).filter(([period, p]) => !NON_CLASS_PERIODS.has(period) && p && (p.title || p.subject));
    if (classes.length === 0) return null;
    return classes.some(([period]) => period === '0') ? 'p0' : 'p1';
}

// Whether the portal's scan-ins list (attendance/scan-ins) has an entry for `date`.
export function scannedOn(scanIns: any, date: string): boolean {
    const members = Array.isArray(scanIns?.member) ? scanIns.member : [];
    return members.some((m: any) => m?.date === date);
}
