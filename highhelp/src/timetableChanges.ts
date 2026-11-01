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
    label: 'today' | 'tomorrow';
}

const DAY_START = 6 * 60; // 6:00am
const SCHOOL_END = 15 * 60 + 15; // 3:15pm, just after period 5
const DAY_END = 21 * 60; // 9:00pm

// Which date a cron tick (every 15 minutes) should check, or null to skip it. School days are checked
// for "today" until the end of period 5. After that, Sunday to Thursday evenings look ahead to
// tomorrow at half the rate (on the hour and half hour), when next-day subs tend to appear.
export function planCheck(now: Date): CheckPlan | null {
    const { date, weekday, minutes } = sydneyClock(now);
    if (minutes < DAY_START || minutes >= DAY_END) return null;
    if (minutes < SCHOOL_END) return weekday >= 1 && weekday <= 5 ? { date, label: 'today' } : null;
    if (weekday === 5 || weekday === 6) return null;
    if (Math.floor(minutes / 15) % 2 !== 0) return null;
    return { date: addDays(date, 1), label: 'tomorrow' };
}
