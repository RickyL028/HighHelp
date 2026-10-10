import type { Child } from 'hono/jsx'
import { subjectLabel } from '../../constants'
import {
    HSC_MINUTES_PER_MARK,
    MIN_TOPIC_MARKS,
    accuracyOf,
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
    type BreakdownEntry,
    type BreakdownRow,
    type ExamWeights,
    type FocusItem,
    type HeatmapDay,
    type MockResult,
    type MockRow,
    type PaperRow,
    type TopicPaperMap,
    type TopicPaperRow,
    type TopicStatRow,
    type TopicSummary,
    type WeightBasis
} from './statsQuery'

// Rows shown before "Show all"; the rest are rendered too and folded away by the page script.
const TOPIC_ROWS = 12;
const MAP_ROWS = 12;
// A year of activity on wide screens; narrower screens drop the oldest weeks rather than scroll.
const HEATMAP_WEEKS = 53;
const HEATMAP_WEEKS_MEDIUM = 26;
const HEATMAP_WEEKS_PHONE = 17;

type ReviewStats = { queued: number; dropped: number; retried: number; fixed: number; recovered: number };

const BODY = 'text-gray-700 dark:text-neutral-300';
const MUTED = 'text-gray-500 dark:text-neutral-400';
const STRONG = 'font-bold text-gray-900 dark:text-white';
const ACTION_LINK = 'text-sm font-bold text-blue-600 dark:text-blue-400 hover:underline';
const INLINE_LINK = 'font-bold text-blue-600 dark:text-blue-400 hover:underline';
const NAME_LINK = 'text-gray-900 dark:text-white hover:text-blue-700 dark:hover:text-blue-400 hover:underline';
// The header and row rules the Practice and Review tables use.
const TABLE_HEAD = 'text-left text-[11px] uppercase tracking-wider text-gray-500 dark:text-neutral-400 border-b-2 border-gray-200 dark:border-neutral-700';
const TABLE_ROW = 'border-b border-gray-100 dark:border-neutral-800';

const formatCount = (value: number) => Math.round(value).toLocaleString('en-AU');
const formatMarks = (value: number) => (Math.round(value * 10) / 10).toLocaleString('en-AU');
// A score just short of perfect must not round up to 100%.
const formatPercent = (value: number | null) => (value == null ? '—' : `${value >= 1 ? 100 : Math.min(99, Math.round(value * 100))}%`);
const plural = (count: number, word: string, many = `${word}s`) => `${formatCount(count)} ${count === 1 ? word : many}`;

// Mock timestamps are UTC text ("2026-10-05 00:10:00"); heatmap dates are already Sydney days.
const formatTimestamp = (timestamp: string | null) => {
    const instant = timestamp ? new Date(`${timestamp.replace(' ', 'T')}Z`) : null;
    return instant && !Number.isNaN(instant.getTime())
        ? instant.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', timeZone: 'Australia/Sydney' })
        : '';
};
const formatDay = (date: string, options: Intl.DateTimeFormatOptions) =>
    new Date(`${date}T00:00:00Z`).toLocaleDateString('en-AU', { ...options, timeZone: 'UTC' });

const statsUrl = (subject: string, basis: WeightBasis) => `/past-papers?${new URLSearchParams({ subject, tab: 'stats', basis }).toString()}`;
// Subtopics link by topic id, as on the Browse tab. One that merges several spellings uses the first.
const subtopicUrl = (subject: string, topicId: number) => `/past-papers?${new URLSearchParams({ subject, tab: 'practice', topic: String(topicId) }).toString()}`;
const practiceUrl = (subject: string, topicGroup: string, unattemptedOnly = false) => {
    const params = new URLSearchParams({ subject, tab: 'practice', topic_group: topicGroup });
    if (unattemptedOnly) params.set('status', 'undone');
    return `/past-papers?${params.toString()}`;
};

// Scores are marked the way the Review tab marks them: green when strong, red when weak, ink otherwise.
const scoreTone = (value: number | null) =>
    value == null ? 'text-gray-400 dark:text-neutral-500'
        : value >= 0.8 ? 'text-green-700 dark:text-green-400'
            : value < 0.5 ? 'text-red-600 dark:text-red-400'
                : 'text-gray-900 dark:text-white';

// One blue ramp for both heatmaps, stepped separately for each mode (more is darker on light,
// lighter on dark), with each step's label ink picked for contrast. Step 0 is "none".
const HEAT_STYLES = `
    .hh-heat-0 { background-color: #e5e7eb; }
    .hh-heat-1 { background-color: #86b6ef; color: #111827; }
    .hh-heat-2 { background-color: #3987e5; color: #111827; }
    .hh-heat-3 { background-color: #1c5cab; color: #fff; }
    .hh-heat-4 { background-color: #0d366b; color: #fff; }
    .dark .hh-heat-0 { background-color: #404040; }
    .dark .hh-heat-1 { background-color: #1c5cab; color: #fff; }
    .dark .hh-heat-2 { background-color: #2a78d6; color: #000; }
    .dark .hh-heat-3 { background-color: #5598e7; color: #111827; }
    .dark .hh-heat-4 { background-color: #86b6ef; color: #111827; }
    [data-tip].hh-heat:hover { outline: 1px solid #111827; outline-offset: 1px; }
    .dark [data-tip].hh-heat:hover { outline-color: #fff; }
`;

const heatLevel = (value: number, max: number) => (value > 0 && max > 0 ? Math.min(4, Math.max(1, Math.ceil((value / max) * 4))) : 0);

// Open sections like the Practice tab's: a heading on a hairline rule, no box around the content.
const Section = ({ title, action, children }: { title: string; action?: Child; children?: Child }) => (
    <section>
        <div class="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 mb-4 pb-2 border-b border-gray-200 dark:border-neutral-700">
            <h2 class="text-xl font-bold text-gray-900 dark:text-white">{title}</h2>
            {action}
        </div>
        {children}
    </section>
);

// Unfolds a table's extra rows. Hidden until the page script has folded some away.
const ShowAllToggle = ({ target, count, noun }: { target: string; count: number; noun: string }) => (
    <button type="button" hidden data-stats-toggle={target} data-more={`Show all ${count} ${noun}`} data-less="Show fewer" class={`mt-3 ${ACTION_LINK}`}>
        Show all {count} {noun}
    </button>
);

// `first` is the direction of the first click: weakest and least-done topics come first, as that
// is what the table is opened to find.
const SortHeader = ({ sort, label, first, align, current, wide }: {
    sort: string
    label: string
    first: 'ascending' | 'descending'
    align?: 'right'
    current?: boolean
    /** Hidden on phones, where the column folds into the topic cell. */
    wide?: boolean
}) => (
    <th class={`py-2 pr-3 sm:pr-4 last:pr-0 font-bold${align === 'right' ? ' text-right' : ''}${wide ? ' hidden sm:table-cell' : ''}`} aria-sort={current ? first : undefined}>
        <button type="button" data-sort={sort} data-sort-first={first} class="font-bold uppercase tracking-wider hover:text-gray-900 dark:hover:text-neutral-200 transition-colors">
            {label}
        </button>
    </th>
);

const WeightLinks = ({ subject, basis, hscCount, allCount }: { subject: string; basis: WeightBasis; hscCount: number; allCount: number }) => {
    const option = (value: WeightBasis, label: string) =>
        basis === value
            ? <span class="font-semibold text-gray-900 dark:text-white" aria-current="true">{label}</span>
            : <a href={statsUrl(subject, value)} class="text-blue-600 dark:text-blue-400 hover:underline">{label}</a>;
    return (
        <p class={`text-sm ${MUTED}`}>
            Weighted by {option('hsc', `HSC papers (${hscCount})`)} / {option('all', `all papers (${allCount})`)}
        </p>
    );
};

const FocusList = ({ subject, title, items, empty, describe }: {
    subject: string
    title: string
    items: FocusItem[]
    empty: string
    describe: (item: FocusItem) => string
}) => (
    <div>
        <h3 class="mb-3 font-semibold text-gray-900 dark:text-white">{title}</h3>
        {items.length === 0 ? (
            <p class={`text-sm ${MUTED}`}>{empty}</p>
        ) : (
            <ol class="space-y-3">
                {items.map(item => (
                    <li>
                        <a href={practiceUrl(subject, item.topic.name, true)} title="Practise the questions you haven't tried" class={`font-semibold ${NAME_LINK}`}>
                            {item.topic.name}
                        </a>
                        <p class={`text-sm ${MUTED}`}>{describe(item)}</p>
                    </li>
                ))}
            </ol>
        )}
    </div>
);

// One row of the topic table, for a topic or (indented, quieter) one of its subtopics. Every row
// carries its own sort keys, so subtopics can be ordered within their topic too.
const TopicRow = ({ subject, topic, weights, subtopic }: { subject: string; topic: TopicSummary; weights: ExamWeights; subtopic?: boolean }) => {
    const weighted = weights.papers.length > 0;
    const strong = subtopic ? BODY : 'font-semibold text-gray-900 dark:text-white';
    return (
        <tr class={`${TABLE_ROW} align-top`}
            data-sort-name={topic.name.toLowerCase()}
            data-sort-weight={String(topic.avgMarks ?? 0)}
            data-sort-done={String(topic.coverage)}
            data-sort-accuracy={topic.accuracy == null ? '' : String(topic.accuracy)}>
            <td class={`py-2 pr-3 sm:pr-4 [overflow-wrap:anywhere]${subtopic ? ' pl-4 sm:pl-6' : ''}`}>
                <a href={subtopic ? subtopicUrl(subject, topic.topicIds[0]) : practiceUrl(subject, topic.name)}
                    class={subtopic ? `${BODY} hover:text-blue-700 dark:hover:text-blue-400 hover:underline` : NAME_LINK}>
                    {topic.name}
                </a>
                {topic.subtopics.length > 0 && (
                    <button type="button" hidden data-subtopics-toggle aria-expanded="false"
                        data-more={plural(topic.subtopics.length, 'subtopic')} data-less="hide subtopics"
                        class={`ml-2 text-xs ${MUTED} hover:text-gray-900 dark:hover:text-white hover:underline`}>
                        {plural(topic.subtopics.length, 'subtopic')}
                    </button>
                )}
                {weighted && <div class={`sm:hidden text-xs tabular-nums ${MUTED}`}>{formatMarks(topic.avgMarks ?? 0)} marks a paper</div>}
            </td>
            {weighted && (
                <td class={`hidden sm:table-cell py-2 pr-4 text-right tabular-nums ${strong}`}>{formatMarks(topic.avgMarks ?? 0)}</td>
            )}
            {weighted && (
                <td class={`hidden sm:table-cell py-2 pr-4 text-right tabular-nums ${MUTED}`}>{topic.papers}/{weights.papers.length}</td>
            )}
            <td class="py-2 pr-3 sm:pr-4 text-right whitespace-nowrap tabular-nums">
                <span class="hidden sm:inline-block align-middle mr-2 h-1 w-16 overflow-hidden rounded-full bg-blue-100 dark:bg-blue-900/40" aria-hidden="true">
                    <span class="block h-full bg-blue-600 dark:bg-blue-500" style={`width: ${(topic.coverage * 100).toFixed(1)}%`}></span>
                </span>
                {/* A fixed slot for the count keeps every row's bar in the same place. */}
                <span class={`inline-block sm:min-w-[4.5rem] ${BODY}`}>{formatCount(topic.attempted)}/{formatCount(topic.questions)}</span>
            </td>
            <td class="py-2 text-right whitespace-nowrap tabular-nums">
                {topic.marksAttempted > 0 && (
                    <span class={`hidden sm:inline mr-2 ${MUTED}`}>{formatCount(topic.marksEarned)}/{formatCount(topic.marksAttempted)}</span>
                )}
                <span class={`${subtopic ? '' : 'font-semibold '}${scoreTone(topic.accuracy)}`}>{formatPercent(topic.accuracy)}</span>
            </td>
        </tr>
    );
};

// A tbody per topic keeps its subtopic rows with it when the table is sorted or folded.
const TopicTable = ({ subject, topics, weights }: { subject: string; topics: TopicSummary[]; weights: ExamWeights }) => {
    const weighted = weights.papers.length > 0;
    return (
        <>
            <table class="w-full text-sm" data-stats-table="topics" data-stats-grouped data-limit={String(TOPIC_ROWS)}>
                <thead>
                    <tr class={TABLE_HEAD}>
                        <SortHeader sort="name" label="Topic" first="ascending" />
                        {weighted && <SortHeader sort="weight" label="Marks / paper" first="descending" align="right" current wide />}
                        {weighted && <th class="hidden sm:table-cell py-2 pr-4 font-bold text-right">Papers</th>}
                        <SortHeader sort="done" label="Attempted" first="ascending" align="right" />
                        <SortHeader sort="accuracy" label="Accuracy" first="ascending" align="right" />
                    </tr>
                </thead>
                {topics.map(topic => (
                    <tbody>
                        <TopicRow subject={subject} topic={topic} weights={weights} />
                        {topic.subtopics.map(subtopic => <TopicRow subject={subject} topic={subtopic} weights={weights} subtopic />)}
                    </tbody>
                ))}
            </table>
            {topics.length > TOPIC_ROWS && <ShowAllToggle target="topics" count={topics.length} noun="topics" />}
        </>
    );
};

const TopicMapTable = ({ map }: { map: TopicPaperMap }) => (
    <>
        <div class="overflow-x-auto">
            <table class="text-sm" data-stats-table="hsc-map" data-limit={String(MAP_ROWS)}>
                <thead>
                    <tr class="text-[11px] uppercase tracking-wider text-gray-500 dark:text-neutral-400">
                        <th class="sticky left-0 z-10 bg-background dark:bg-neutral-900 py-2 pr-3 sm:pr-4 text-left font-bold">Topic</th>
                        {map.papers.map(paper => (
                            <th class="px-[1px] py-2 text-center font-bold tabular-nums">
                                <a href={`/past-papers/paper/${paper.id}`} title={`${paper.school_name} ${paper.academic_year}`} class="hover:underline">{paper.academic_year}</a>
                            </th>
                        ))}
                        <th class="py-2 pl-3 text-right font-bold">Avg</th>
                    </tr>
                </thead>
                <tbody>
                    {map.rows.map(row => (
                        <tr>
                            <td class={`sticky left-0 z-10 bg-background dark:bg-neutral-900 py-[1px] pr-3 sm:pr-4 ${BODY}`}>
                                <span class="block max-w-[8.5rem] truncate sm:max-w-none" title={row.name}>{row.name}</span>
                            </td>
                            {row.cells.map((marks, index) => (
                                <td class="p-[1px]">
                                    <span class={`hh-heat hh-heat-${heatLevel(marks, map.max)} block min-w-[2.5rem] px-1.5 py-1 text-center text-xs font-semibold tabular-nums`}
                                        data-tip={`${row.name}, ${map.papers[index].academic_year}: ${marks > 0 ? plural(marks, 'mark') : 'not tagged'}`}>
                                        {marks > 0 ? formatMarks(marks) : ' '}
                                    </span>
                                </td>
                            ))}
                            <td class={`py-[1px] pl-3 text-right tabular-nums ${MUTED}`}>{formatMarks(row.total / map.papers.length)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
        {map.rows.length > MAP_ROWS && <ShowAllToggle target="hsc-map" count={map.rows.length} noun="topics" />}
    </>
);

// The group name heads the first column, so each of the three small tables explains itself.
const BreakdownTable = ({ title, entries }: { title: string; entries: BreakdownEntry[] }) => (
    <table class="w-full text-sm">
        <thead>
            <tr class={TABLE_HEAD}>
                <th class="py-2 pr-3 font-bold">{title}</th>
                <th class="py-2 pr-3 font-bold text-right">Attempted</th>
                <th class="py-2 font-bold text-right">Accuracy</th>
            </tr>
        </thead>
        <tbody>
            {entries.length === 0 ? (
                <tr class={TABLE_ROW}>
                    <td colspan={3} class={`py-1.5 ${MUTED}`}>No questions yet</td>
                </tr>
            ) : (
                entries.map(entry => (
                    <tr class={TABLE_ROW}>
                        <td class={`py-1.5 pr-3 ${BODY}`}>{entry.label}</td>
                        <td class={`py-1.5 pr-3 text-right tabular-nums ${MUTED}`}>{formatCount(entry.attempted)}/{formatCount(entry.questions)}</td>
                        <td class={`py-1.5 text-right tabular-nums font-semibold ${scoreTone(entry.accuracy)}`}>{formatPercent(entry.accuracy)}</td>
                    </tr>
                ))
            )}
        </tbody>
    </table>
);

const MockTable = ({ results }: { results: MockResult[] }) => (
    <table class="w-full text-sm">
        <thead>
            <tr class={TABLE_HEAD}>
                <th class="py-2 pr-3 font-bold">Exam</th>
                <th class="py-2 pr-3 font-bold">Finished</th>
                <th class="py-2 pr-3 font-bold text-right">Marks</th>
                <th class="hidden sm:table-cell py-2 pr-3 font-bold text-right">Time</th>
                <th class="py-2 font-bold text-right">Score</th>
            </tr>
        </thead>
        <tbody>
            {results.map(result => (
                <tr class={TABLE_ROW}>
                    <td class="py-2 pr-3 [overflow-wrap:anywhere]">
                        <a href={`/past-papers/mock-exams/${result.id}/mark`} class={NAME_LINK}>{result.name}</a>
                    </td>
                    <td class={`py-2 pr-3 whitespace-nowrap ${MUTED}`}>{formatTimestamp(result.completedAt)}</td>
                    <td class={`py-2 pr-3 text-right whitespace-nowrap tabular-nums ${MUTED}`}>{formatMarks(result.marksAwarded)}/{formatMarks(result.totalMarks)}</td>
                    <td class={`hidden sm:table-cell py-2 pr-3 text-right whitespace-nowrap tabular-nums ${MUTED}`}>
                        {result.minutes == null
                            ? 'untimed'
                            : `${Math.round(result.minutes)}${result.allowedMinutes ? ` of ${Math.round(result.allowedMinutes)}` : ''} min`}
                    </td>
                    <td class={`py-2 text-right tabular-nums font-semibold ${scoreTone(result.score)}`}>{formatPercent(result.score)}</td>
                </tr>
            ))}
        </tbody>
    </table>
);

const mockSummary = (mocks: ReturnType<typeof summarizeMocks>) => {
    const change = mocks.change == null ? 0 : Math.round(mocks.change * 100);
    const trend = mocks.change == null
        ? ''
        : change === 0
            ? ' Your latest scored the same as the one before.'
            : ` Your latest was ${plural(Math.abs(change), 'point')} ${change > 0 ? 'up on' : 'down on'} the one before.`;
    return mocks.count === 1
        ? <>You've marked <strong class={STRONG}>1</strong> mock exam and scored <strong class={STRONG}>{formatPercent(mocks.average)}</strong> on it.</>
        : <>You've marked <strong class={STRONG}>{formatCount(mocks.count)}</strong> mock exams, averaging <strong class={STRONG}>{formatPercent(mocks.average)}</strong> with a best of {formatPercent(mocks.best)}.{trend}</>;
};

const paceSummary = (mocks: ReturnType<typeof summarizeMocks>) =>
    mocks.pace == null
        ? `${mocks.count === 1 ? "It wasn't timed" : 'None of them were timed'}. Set a timer next time to compare your pace with the HSC's ${HSC_MINUTES_PER_MARK} minutes a mark.`
        : `In timed mocks you're taking about ${formatMarks(mocks.pace)} minutes a mark. A 3-hour, 100-mark HSC paper gives you ${HSC_MINUTES_PER_MARK}${mocks.pace > HSC_MINUTES_PER_MARK ? ', so speed is worth working on.' : '.'}`;

const reviewSummary = (review: ReviewStats) => {
    if (review.queued === 0) return "Nothing to review right now. Questions you don't get full marks on, or leave a note on, end up here.";
    const waiting = `${plural(review.queued, 'question')} ${review.queued === 1 ? 'is' : 'are'} waiting in Review.`;
    if (review.dropped === 0) return waiting;
    if (review.retried === 0) return `${waiting} You haven't retried any of the ${formatCount(review.dropped)} you dropped marks on yet.`;
    const retried = `You've retried ${formatCount(review.retried)} of the ${formatCount(review.dropped)} you dropped marks on`;
    return review.fixed === 0
        ? `${waiting} ${retried}, but none at full marks yet.`
        : `${waiting} ${retried} and fixed ${formatCount(review.fixed)}, winning back ${plural(review.recovered, 'mark')}.`;
};

// The grid's month row labels the week holding the 1st of each month.
const monthLabel = (week: HeatmapDay[]) => {
    const first = week.find(day => day.date.endsWith('-01'));
    return first ? formatDay(first.date, { month: 'short' }) : '';
};

const ActivityHeatmap = ({ heatmap }: { heatmap: ReturnType<typeof activityHeatmap> }) => {
    const weekClass = (index: number) => {
        const age = heatmap.weeks.length - 1 - index;
        return age >= HEATMAP_WEEKS_MEDIUM ? 'hidden lg:flex' : age >= HEATMAP_WEEKS_PHONE ? 'hidden sm:flex' : 'flex';
    };
    return (
        <>
            <div class="flex gap-[3px] text-[10px] leading-none text-gray-400 dark:text-neutral-500" role="img" aria-label="Attempts each day over the last year">
                <div class="flex flex-col gap-[3px] pr-1" aria-hidden="true">
                    <span class="h-3"></span>
                    {['Mon', '', 'Wed', '', 'Fri', '', ''].map(day => <span class="h-[11px] leading-[11px]">{day}</span>)}
                </div>
                {heatmap.weeks.map((week, index) => (
                    <div class={`${weekClass(index)} flex-col gap-[3px]`}>
                        <span class="h-3 w-[11px] whitespace-nowrap">{monthLabel(week)}</span>
                        {week.map(day =>
                            day.count == null ? (
                                <span class="h-[11px] w-[11px]"></span>
                            ) : (
                                <span class={`hh-heat hh-heat-${heatLevel(day.count, heatmap.max)} h-[11px] w-[11px] rounded-[2px]`}
                                    data-tip={`${formatDay(day.date, { weekday: 'short', day: 'numeric', month: 'short' })}: ${plural(day.count, 'attempt')}`}></span>
                            )
                        )}
                    </div>
                ))}
            </div>
            <div class="mt-2 flex items-center gap-[3px] text-[11px] text-gray-400 dark:text-neutral-500" aria-hidden="true">
                Less
                {[0, 1, 2, 3, 4].map(level => <span class={`hh-heat-${level} inline-block h-[11px] w-[11px] rounded-[2px]`}></span>)}
                More
            </div>
        </>
    );
};

const describeLeak = (weighted: boolean, paperNoun: string) => (item: FocusItem) =>
    weighted
        ? `${formatPercent(item.topic.accuracy)} so far. About ${formatMarks(item.score)} marks lost per ${paperNoun}.`
        : `${formatPercent(item.topic.accuracy)} so far, on ${plural(item.topic.marksAttempted, 'mark')} attempted.`;

const describeGap = (weighted: boolean, paperNoun: string) => (item: FocusItem) => {
    const { topic } = item;
    const practice = topic.attempted === 0
        ? `Not started (${plural(topic.questions, 'question')}).`
        : `${formatCount(topic.attempted)} of ${plural(topic.questions, 'question')} attempted.`;
    return weighted ? `${practice} Worth about ${formatMarks(topic.avgMarks ?? 0)} marks per ${paperNoun}.` : practice;
};

const yearRange = (papers: PaperRow[]) => {
    const years = papers.map(paper => Number(paper.academic_year)).filter(Number.isFinite);
    if (years.length === 0) return '';
    const low = Math.min(...years);
    const high = Math.max(...years);
    return low === high ? String(low) : `${low}–${high}`;
};

// Table sorting, "Show all" folding and the cell tooltip. Every row is in the HTML, so without
// this script the tables are simply unfolded and unsorted.
const STATS_SCRIPT = `
(function () {
    var slice = function (list, from) { return Array.prototype.slice.call(list, from || 0); };

    document.querySelectorAll('[data-stats-table]').forEach(function (table) {
        // A grouped table has a tbody per topic, its first row the topic and the rest its subtopics.
        var grouped = table.hasAttribute('data-stats-grouped');
        var limit = Number(table.getAttribute('data-limit')) || 0;
        var toggle = document.querySelector('[data-stats-toggle="' + table.getAttribute('data-stats-table') + '"]');
        var expanded = false;

        function items() { return grouped ? slice(table.tBodies) : slice(table.tBodies[0].rows); }
        function leadRow(item) { return grouped ? item.rows[0] : item; }

        function fold() {
            items().forEach(function (item, index) {
                item.hidden = !expanded && limit > 0 && index >= limit;
            });
            if (toggle) toggle.textContent = toggle.getAttribute(expanded ? 'data-less' : 'data-more');
        }

        if (toggle && limit > 0 && items().length > limit) {
            toggle.hidden = false;
            toggle.addEventListener('click', function () {
                expanded = !expanded;
                fold();
            });
        }

        table.querySelectorAll('[data-sort]').forEach(function (button) {
            button.addEventListener('click', function () {
                var key = button.getAttribute('data-sort');
                var header = button.closest('th');
                var current = header.getAttribute('aria-sort');
                var descending = current ? current === 'ascending' : button.getAttribute('data-sort-first') === 'descending';
                table.querySelectorAll('th[aria-sort]').forEach(function (th) { th.removeAttribute('aria-sort'); });
                header.setAttribute('aria-sort', descending ? 'descending' : 'ascending');
                function compare(a, b) {
                    var x = a.getAttribute('data-sort-' + key) || '';
                    var y = b.getAttribute('data-sort-' + key) || '';
                    if (key === 'name') return (descending ? -1 : 1) * x.localeCompare(y);
                    // A topic with nothing marked yet has no accuracy, so it stays at the bottom either way.
                    if (x === '' || y === '') return (x === '' ? 1 : 0) - (y === '' ? 1 : 0);
                    return (descending ? -1 : 1) * (Number(x) - Number(y));
                }
                var sorted = items().sort(function (a, b) { return compare(leadRow(a), leadRow(b)); });
                sorted.forEach(function (item) {
                    item.parentNode.appendChild(item);
                    if (grouped) slice(item.rows, 1).sort(compare).forEach(function (row) { item.appendChild(row); });
                });
                fold();
            });
        });

        fold();
    });

    // Subtopic rows start folded under their topic; the server renders them open, so without this
    // script they are simply all shown.
    document.querySelectorAll('[data-subtopics-toggle]').forEach(function (button) {
        button.hidden = false;
        slice(button.closest('tbody').rows, 1).forEach(function (row) { row.hidden = true; });
    });
    document.addEventListener('click', function (event) {
        var button = event.target && event.target.closest ? event.target.closest('[data-subtopics-toggle]') : null;
        if (!button) return;
        var open = button.getAttribute('aria-expanded') !== 'true';
        button.setAttribute('aria-expanded', String(open));
        button.textContent = button.getAttribute(open ? 'data-less' : 'data-more');
        slice(button.closest('tbody').rows, 1).forEach(function (row) { row.hidden = !open; });
    });

    var tip = document.createElement('div');
    tip.setAttribute('aria-hidden', 'true');
    tip.className = 'fixed z-[100] hidden pointer-events-none max-w-xs rounded-sm bg-gray-900 dark:bg-neutral-100 text-white dark:text-gray-900 text-xs font-medium px-2.5 py-1.5 shadow-lg';
    document.body.appendChild(tip);

    function hideTip() { tip.classList.add('hidden'); }

    document.addEventListener('pointerover', function (event) {
        var cell = event.target && event.target.closest ? event.target.closest('[data-stats-root] [data-tip]') : null;
        if (!cell) return hideTip();
        tip.textContent = cell.getAttribute('data-tip') || '';
        tip.classList.remove('hidden');
        var rect = cell.getBoundingClientRect();
        tip.style.left = Math.max(8, Math.min(rect.left + rect.width / 2 - tip.offsetWidth / 2, window.innerWidth - tip.offsetWidth - 8)) + 'px';
        tip.style.top = Math.max(8, rect.top - tip.offsetHeight - 8) + 'px';
    });
    window.addEventListener('scroll', hideTip, { passive: true });
})();
`;

/** Content of the Statistics tab: every figure is per subject, for the signed-in student. */
export async function renderStatisticsTab(db: D1Database, userId: number, subject: string, requestedBasis?: string) {
    const topicRows = await db.prepare('SELECT id, name FROM topics WHERE subject = ? ORDER BY name COLLATE NOCASE, id').bind(subject).all<{ id: number; name: string }>();
    const groups = buildTopicGroups(topicRows.results);
    const groupsJson = topicGroupsJson(groups);
    const queries = [
        buildTopicStatsQuery(userId, subject, groupsJson),
        buildTopicPaperQuery(subject, groupsJson),
        buildPaperQuery(userId, subject),
        buildBreakdownQuery(userId, subject),
        buildReviewStatsQuery(userId, subject),
        buildMockStatsQuery(userId, subject),
        buildActivityQuery(userId, subject)
    ];
    const [topicStats, topicPaperRows, paperRows, breakdownRows, reviewRows, mockRows, activityRows] = await db.batch(
        queries.map(query => db.prepare(query.sql).bind(...query.params))
    );

    const papers = paperRows.results as PaperRow[];
    if (!papers.some(paper => Number(paper.questions) > 0)) {
        return <div class={`text-center py-12 ${MUTED}`}>No papers found for {subjectLabel(subject)}, so there's nothing to measure yet.</div>;
    }

    const topicPapers = topicPaperRows.results as TopicPaperRow[];
    const hscWeights = examWeights(topicPapers, papers, 'hsc');
    const allWeights = examWeights(topicPapers, papers, 'all');
    // An HSC basis with no tagged HSC paper would weigh nothing, so it falls back to the default.
    const basis: WeightBasis = isWeightBasis(requestedBasis) && (requestedBasis === 'all' || hscWeights.papers.length > 0)
        ? requestedBasis
        : defaultWeightBasis(topicPapers, papers);
    const weights = basis === 'hsc' ? hscWeights : allWeights;
    const weighted = weights.papers.length > 0;
    const paperNoun = basis === 'hsc' ? 'HSC paper' : 'paper';
    const aPaper = basis === 'hsc' ? 'an HSC paper' : 'a paper';

    const topics = summarizeTopics(groups, topicStats.results as TopicStatRow[], weights);
    const focus = focusTopics(topics);
    const map = hscTopicMap(topicPapers, papers, groups);
    const breakdown = summarizeBreakdown(breakdownRows.results as BreakdownRow[]);
    const paperSummary = summarizePapers(papers);
    const review = (reviewRows.results[0] as ReviewStats | undefined) ?? { queued: 0, dropped: 0, retried: 0, fixed: 0, recovered: 0 };
    const mocks = summarizeMocks(mockRows.results as MockRow[]);
    const days = dailyActivity(activityRows.results as ActivityRow[]);
    const today = sydneyDate(new Date());
    const activity = activitySummary(days, today);
    const heatmap = activityHeatmap(days, today, HEATMAP_WEEKS);

    const { total } = breakdown;
    const accuracy = accuracyOf(total);

    return (
        <div class="space-y-12" data-stats-root>
            <style dangerouslySetInnerHTML={{ __html: HEAT_STYLES }} />

            <div>
                <h1 class="text-3xl font-bold dark:text-white">Statistics</h1>
                <ul class={`mt-3 flex flex-wrap gap-x-8 gap-y-1 text-base sm:text-lg ${BODY}`}>
                    <li>
                        <strong class={STRONG}>{formatCount(total.attempted)}</strong> of {formatCount(total.questions)} questions attempted
                        {paperSummary.complete > 0 ? ` (${plural(paperSummary.complete, 'full paper')})` : ''}
                    </li>
                    {accuracy != null && <li><strong class={STRONG}>{formatPercent(accuracy)}</strong> accuracy</li>}
                    <li>{mocks.count > 0 ? <><strong class={STRONG}>{formatPercent(mocks.average)}</strong> mock average</> : 'no mocks marked yet'}</li>
                    {activity.current > 0 ? (
                        <li><strong class={STRONG}>{formatCount(activity.current)}</strong>-day streak</li>
                    ) : activity.lastActive ? (
                        <li>last practised {formatDay(activity.lastActive, { day: 'numeric', month: 'short' })}</li>
                    ) : null}
                </ul>
            </div>

            {topics.length === 0 ? (
                <p class={MUTED}>No questions in {subjectLabel(subject)} are tagged with topics yet, so there are no topic statistics.</p>
            ) : (
                <>
                    <Section title="What to work on">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                            <FocusList
                                subject={subject}
                                title="Losing the most marks"
                                items={focus.leaks}
                                empty={total.attempted === 0
                                    ? 'Once you mark a few questions, the topics costing you marks will show up here.'
                                    : `Nothing stands out yet. A topic shows up here once you've tried ${MIN_TOPIC_MARKS} marks' worth of it and dropped some.`}
                                describe={describeLeak(weighted, paperNoun)}
                            />
                            <FocusList
                                subject={subject}
                                title="Least practised"
                                items={focus.gaps}
                                empty="You've attempted every question in every topic the papers examine."
                                describe={describeGap(weighted, paperNoun)}
                            />
                        </div>
                    </Section>

                    <Section
                        title="Topics"
                        action={hscWeights.papers.length > 0 && (
                            <WeightLinks subject={subject} basis={basis} hscCount={hscWeights.papers.length} allCount={allWeights.papers.length} />
                        )}>
                        <p class={`mb-4 text-sm ${MUTED}`}>
                            {weighted
                                ? `Marks per paper is the average ${aPaper} gives each topic, across ${plural(weights.papers.length, paperNoun)} from ${yearRange(weights.papers)}.`
                                : "No paper has tagged questions yet, so topics can't be weighted."}
                        </p>
                        <TopicTable subject={subject} topics={topics} weights={weights} />
                    </Section>

                    {map.papers.length > 0 && map.rows.length > 0 && (
                        <Section title="Topics in each HSC paper">
                            <p class={`mb-4 text-sm ${MUTED}`}>Marks each HSC paper gave a topic. A blank means none of that year's questions were tagged with it.</p>
                            <TopicMapTable map={map} />
                        </Section>
                    )}
                </>
            )}

            <Section title="How you score">
                <p class={`mb-5 ${BODY}`}>
                    {total.scored > 0 ? (
                        <>
                            Overall you've scored <strong class={STRONG}>{formatCount(total.marksEarned)}</strong> of {formatCount(total.marksAttempted)} marks
                            ({formatPercent(accuracy)}), with full marks on {formatCount(total.fullMarks)} of the {plural(total.scored, 'question')} you've attempted.
                        </>
                    ) : (
                        "Once you've marked some questions, this shows where your marks come from."
                    )}
                </p>
                <div class="grid grid-cols-1 sm:grid-cols-3 items-start gap-x-10 gap-y-8">
                    <BreakdownTable title="Question type" entries={breakdown.byType} />
                    <BreakdownTable title="Mark value" entries={breakdown.byMarks} />
                    <BreakdownTable title="Paper" entries={breakdown.byKind} />
                </div>
            </Section>

            <Section title="Mock exams" action={<a href={`/past-papers/mock-exams?subject=${encodeURIComponent(subject)}`} class={ACTION_LINK}>All mock exams</a>}>
                {mocks.count === 0 ? (
                    <p class={BODY}>
                        You haven't marked a mock exam yet. A timed mock is the closest practice you'll get to the real exam.{' '}
                        <a href={`/past-papers/mock-exams/create?subject=${encodeURIComponent(subject)}`} class={INLINE_LINK}>Create one</a>
                    </p>
                ) : (
                    <>
                        <p class={BODY}>{mockSummary(mocks)}</p>
                        <p class={`mt-1 mb-5 ${BODY}`}>{paceSummary(mocks)}</p>
                        <MockTable results={mocks.recent} />
                    </>
                )}
            </Section>

            <Section title="Review" action={<a href={`/past-papers?subject=${encodeURIComponent(subject)}&tab=review`} class={ACTION_LINK}>Open Review</a>}>
                <p class={BODY}>{reviewSummary(review)}</p>
            </Section>

            <Section title="Activity">
                <p class={`mb-4 ${BODY}`}>
                    {activity.total === 0
                        ? 'Nothing yet. Every question you attempt shows up here.'
                        : `${plural(activity.thisWeek, 'attempt')} this week and ${formatCount(activity.lastWeek)} last week, ${formatCount(activity.total)} in all. ` +
                          `Active on ${formatCount(activity.activeLast30)} of the last 30 days; your longest streak is ${plural(activity.longest, 'day')}.`}
                </p>
                <ActivityHeatmap heatmap={heatmap} />
            </Section>

            <details class={`text-sm ${MUTED}`}>
                <summary class="cursor-pointer font-bold text-gray-600 dark:text-neutral-300">How these numbers are worked out</summary>
                <ul class="mt-3 space-y-2 list-disc pl-5">
                    <li>A question counts as attempted once you've saved an answer or a mark for it, in Practice, Batch Mode or a marked mock exam. Accuracy is the marks you gave yourself out of the marks available on those questions.</li>
                    <li>Topics are grouped the way Browse groups them: "Calculus 1.2 Differentiation" and "Calculus - Integration" are subtopics of Calculus, and names that differ only in case, spacing or a syllabus number are merged. A question counts once towards a topic however many of its subtopics it's tagged with, so a topic's subtopics can add up to more than the topic.</li>
                    <li>Marks per paper is how many marks a paper gives a topic on average. A question tagged with two topics counts towards both, so a paper's topics can add up to more than its total.</li>
                    <li>"Losing the most marks" multiplies a topic's marks per paper by the share you're dropping, once you've tried {MIN_TOPIC_MARKS} marks' worth of it. "Least practised" compares the marks you've attempted on a topic with what it's worth.</li>
                    <li>Mock exams are scored from the marks you saved when you marked them, so a finished mock you haven't marked isn't counted.</li>
                    <li>Activity counts the first time you attempt each question, plus every review attempt, by Sydney date.</li>
                </ul>
            </details>

            <script dangerouslySetInnerHTML={{ __html: STATS_SCRIPT }} />
        </div>
    );
}
