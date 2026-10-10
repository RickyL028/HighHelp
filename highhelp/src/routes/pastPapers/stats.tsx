import type { Child } from 'hono/jsx'
import { subjectLabel } from '../../constants'
import {
    DEFAULT_STATS_FILTERS,
    HSC_MINUTES_PER_MARK,
    MIN_TOPIC_MARKS,
    PAPER_SOURCES,
    PERIODS,
    accuracyOf,
    activityHeatmap,
    activitySummary,
    buildActivityQuery,
    buildBreakdownQuery,
    buildMockListQuery,
    buildMockStatsQuery,
    buildPaperListQuery,
    buildPaperResultsQuery,
    buildReviewStatsQuery,
    buildTopicGroups,
    buildTopicStatsQuery,
    buildTopicUnitQuery,
    dailyActivity,
    daysWithin,
    examWeights,
    focusTopics,
    readStatsFilters,
    statsFilterParams,
    statsScope,
    summarizeBreakdown,
    summarizeMocks,
    summarizePapers,
    summarizeTopics,
    sydneyDate,
    topicGroupsJson,
    topicUnitMap,
    weeksSpanned,
    type ActivityRow,
    type BreakdownEntry,
    type BreakdownRow,
    type FocusItem,
    type HeatmapDay,
    type MockListRow,
    type MockResult,
    type MockRow,
    type PaperKind,
    type PaperResult,
    type PaperResultRow,
    type PaperRow,
    type StatsFilters,
    type TopicStatRow,
    type TopicSummary,
    type TopicUnitMap,
    type TopicUnitRow
} from './statsQuery'

// Rows shown before "Show all"; the rest are rendered too and folded away by the page script.
const TOPIC_ROWS = 12;
const MAP_ROWS = 12;
const RESULT_ROWS = 8;
// The topic map shows the latest exams in scope; the averages still cover every one.
const MAP_COLUMNS = 20;
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
const FIELD_LABEL = 'text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-neutral-400';
// The underlined fields of the Practice tab's filter bar.
const FIELD = 'bg-transparent border-b border-gray-300 dark:border-neutral-600 focus:outline-none focus:border-blue-500 dark:bg-transparent dark:text-white dark:[color-scheme:dark] py-0.5 pr-1 text-sm';

const formatCount = (value: number) => Math.round(value).toLocaleString('en-AU');
const formatMarks = (value: number) => (Math.round(value * 10) / 10).toLocaleString('en-AU');
// A score just short of perfect must not round up to 100%.
const formatPercent = (value: number | null) => (value == null ? '—' : `${value >= 1 ? 100 : Math.min(99, Math.round(value * 100))}%`);
const plural = (count: number, word: string, many = `${word}s`) => `${formatCount(count)} ${count === 1 ? word : many}`;
// A mark figure that may be fractional, such as an average: "1 mark", "1.5 marks".
const pluralMarks = (value: number) => `${formatMarks(value)} ${formatMarks(value) === '1' ? 'mark' : 'marks'}`;

// Mock timestamps are UTC text ("2026-10-05 00:10:00"); heatmap and filter dates are already Sydney days.
const formatTimestamp = (timestamp: string | null) => {
    const instant = timestamp ? new Date(`${timestamp.replace(' ', 'T')}Z`) : null;
    return instant && !Number.isNaN(instant.getTime())
        ? instant.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', timeZone: 'Australia/Sydney' })
        : '';
};
const formatDay = (date: string, options: Intl.DateTimeFormatOptions) =>
    new Date(`${date}T00:00:00Z`).toLocaleDateString('en-AU', { ...options, timeZone: 'UTC' });

const statsUrl = (subject: string, filters: StatsFilters) =>
    `/past-papers?${new URLSearchParams([['subject', subject], ['tab', 'stats'], ...statsFilterParams(filters)]).toString()}`;
// Subtopics link by topic id, as on the Browse tab. One that merges several spellings uses the first.
const topicIdPracticeUrl = (subject: string, topicId: number, unattemptedOnly = false) => {
    const params = new URLSearchParams({ subject, tab: 'practice', topic: String(topicId) });
    if (unattemptedOnly) params.set('status', 'undone');
    return `/past-papers?${params.toString()}`;
};
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

const mockName = (mock: { exam_name: string | null }) => (mock.exam_name || '').trim() || 'Untitled Exam';

const paperName = (paper: PaperRow) =>
    `${(paper.school_name || '').trim()} ${paper.academic_year ?? ''}${paper.kind === 'other' && paper.paper_type ? ` ${paper.paper_type}` : ''}`.trim();

// A column-sized name for a school: "HSC", or the initials of the rest ("SBHS").
const schoolCode = (school: string | null) => {
    const name = (school || '').trim();
    if (name.toLowerCase() === 'hsc') return 'HSC';
    const initials = name.split(/\s+/).filter(word => /^[A-Za-z]/.test(word)).map(word => word[0].toUpperCase()).join('');
    return initials.slice(0, 5) || name.slice(0, 4);
};

// What one exam in scope is called. "Marks per HSC paper" when only HSC papers are counted, and so on.
const examNoun = (filters: StatsFilters) =>
    filters.mock != null ? 'mock' : filters.source === 'hsc' ? 'HSC paper' : filters.source === 'trial' ? 'trial paper' : 'paper';

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

// One GET form, so every filter is a plain link that can be bookmarked or shared. The page script
// applies a menu choice at once and keeps defaults out of the URL.
const FilterBar = ({ subject, filters, papers, mocks, topics, today }: {
    subject: string
    filters: StatsFilters
    papers: PaperRow[]
    mocks: MockListRow[]
    topics: { key: string; name: string }[]
    today: string
}) => {
    const countOf = (kinds: PaperKind[]) =>
        papers.filter(paper => Number(paper.questions) > 0 && (kinds.length === 0 || kinds.includes(paper.kind))).length;
    // A choice is offered only when it picks out some papers but not all of them, so none is a dead
    // end or a copy of "All papers".
    const everyPaper = countOf([]);
    const sources = PAPER_SOURCES
        .map(source => ({ ...source, count: countOf(source.kinds) }))
        .filter(source => source.key === 'all' || source.key === filters.source || (source.count > 0 && source.count < everyPaper));
    return (
        <form method="get" action="/past-papers" data-stats-filters class="flex flex-wrap items-end gap-x-6 gap-y-3 pb-4 border-b border-gray-200 dark:border-neutral-700">
            <input type="hidden" name="subject" value={subject} />
            <input type="hidden" name="tab" value="stats" />
            <label class="flex flex-col gap-1 min-w-0">
                <span class={FIELD_LABEL}>Questions from</span>
                <select name="source" class={`${FIELD} max-w-[18rem]`}>
                    <optgroup label="Past papers">
                        {sources.map(source => (
                            <option value={source.key} selected={filters.source === source.key}>{source.label} ({source.count})</option>
                        ))}
                    </optgroup>
                    {mocks.length > 0 && (
                        <optgroup label="Your mock exams">
                            <option value="mocks" selected={filters.source === 'mocks'}>All mock exams ({mocks.length})</option>
                            {[...mocks].reverse().map(mock => {
                                const finished = formatTimestamp(mock.completed_at);
                                return (
                                    <option value={`mock-${mock.id}`} selected={filters.source === `mock-${mock.id}`}>
                                        {mockName(mock)}{finished ? ` · ${finished}` : ''}
                                    </option>
                                );
                            })}
                        </optgroup>
                    )}
                </select>
            </label>
            <label class="flex flex-col gap-1 min-w-0">
                <span class={FIELD_LABEL}>Topic</span>
                <select name="topic" class={`${FIELD} max-w-[18rem]`}>
                    <option value="">All topics</option>
                    {topics.map(topic => <option value={topic.key} selected={filters.topic === topic.key}>{topic.name}</option>)}
                </select>
            </label>
            <label class="flex flex-col gap-1">
                <span class={FIELD_LABEL}>Period</span>
                <select name="period" class={FIELD}>
                    {PERIODS.map(period => <option value={period.key} selected={filters.period === period.key}>{period.label}</option>)}
                </select>
            </label>
            <span data-custom-dates class={`${filters.period === 'custom' ? 'flex' : 'hidden'} flex-wrap items-end gap-x-3 gap-y-3`}>
                <label class="flex flex-col gap-1">
                    <span class={FIELD_LABEL}>From</span>
                    <input type="date" name="from" value={filters.period === 'custom' ? filters.from ?? '' : ''} max={today} class={FIELD} />
                </label>
                <label class="flex flex-col gap-1">
                    <span class={FIELD_LABEL}>To</span>
                    <input type="date" name="to" value={filters.period === 'custom' ? filters.to ?? '' : ''} max={today} class={FIELD} />
                </label>
            </span>
            <button type="submit" data-filters-apply class={`pb-0.5 ${ACTION_LINK}`}>Apply</button>
            {statsFilterParams(filters).length > 0 && (
                <a href={statsUrl(subject, DEFAULT_STATS_FILTERS)} class={`pb-0.5 text-sm ${MUTED} hover:text-gray-900 dark:hover:text-neutral-200 hover:underline`}>Reset</a>
            )}
        </form>
    );
};

const Stat = ({ label, value, of, note, tone }: { label: string; value: string; of?: string; note?: string; tone?: string }) => (
    <div>
        <dt class={FIELD_LABEL}>{label}</dt>
        <dd class={`mt-1 text-3xl font-bold tabular-nums ${tone || 'text-gray-900 dark:text-white'}`}>
            {value}
            {of != null && <span class={`text-lg font-semibold ${MUTED}`}>/{of}</span>}
        </dd>
        {note && <dd class={`mt-0.5 text-sm ${MUTED}`}>{note}</dd>}
    </div>
);

const FocusList = ({ title, items, empty, describe, href }: {
    title: string
    items: FocusItem[]
    empty: string
    describe: (item: FocusItem) => string
    href: (topic: TopicSummary) => string
}) => (
    <div>
        <h3 class="mb-3 font-semibold text-gray-900 dark:text-white">{title}</h3>
        {items.length === 0 ? (
            <p class={`text-sm ${MUTED}`}>{empty}</p>
        ) : (
            <ol class="space-y-3">
                {items.map(item => (
                    <li>
                        <a href={href(item.topic)} title="Practise the questions you haven't tried" class={`font-semibold ${NAME_LINK}`}>
                            {item.topic.name}
                        </a>
                        <p class={`text-sm ${MUTED}`}>{describe(item)}</p>
                    </li>
                ))}
            </ol>
        )}
    </div>
);

type TopicColumns = {
    weighted: boolean
    /** Exams in scope with tagged questions; the Papers column is left out when there's only one. */
    examCount: number
    /** "paper" or "mock", for the column headings. */
    per: string
};

// One row of the topic table, for a topic or (indented, quieter) one of its subtopics. Every row
// carries its own sort keys, so subtopics can be ordered within their topic too.
const TopicRow = ({ topic, href, linkTitle, nested, columns }: {
    topic: TopicSummary
    href: string
    linkTitle: string
    nested?: boolean
    columns: TopicColumns
}) => {
    const strong = nested ? BODY : 'font-semibold text-gray-900 dark:text-white';
    return (
        <tr class={`${TABLE_ROW} align-top`}
            data-sort-name={topic.name.toLowerCase()}
            data-sort-weight={String(topic.avgMarks ?? 0)}
            data-sort-done={String(topic.coverage)}
            data-sort-accuracy={topic.accuracy == null ? '' : String(topic.accuracy)}>
            <td class={`py-2 pr-3 sm:pr-4 [overflow-wrap:anywhere]${nested ? ' pl-4 sm:pl-6' : ''}`}>
                <a href={href} title={linkTitle} class={nested ? `${BODY} hover:text-blue-700 dark:hover:text-blue-400 hover:underline` : NAME_LINK}>
                    {topic.name}
                </a>
                {topic.subtopics.length > 0 && (
                    <button type="button" hidden data-subtopics-toggle aria-expanded="false"
                        data-more={plural(topic.subtopics.length, 'subtopic')} data-less="hide subtopics"
                        class={`ml-2 text-xs ${MUTED} hover:text-gray-900 dark:hover:text-white hover:underline`}>
                        {plural(topic.subtopics.length, 'subtopic')}
                    </button>
                )}
                {columns.weighted && <div class={`sm:hidden text-xs tabular-nums ${MUTED}`}>{pluralMarks(topic.avgMarks ?? 0)} a {columns.per}</div>}
            </td>
            {columns.weighted && (
                <td class={`hidden sm:table-cell py-2 pr-4 text-right tabular-nums ${strong}`}>{formatMarks(topic.avgMarks ?? 0)}</td>
            )}
            {columns.weighted && columns.examCount > 1 && (
                <td class={`hidden sm:table-cell py-2 pr-4 text-right tabular-nums ${MUTED}`}>{topic.papers}/{columns.examCount}</td>
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
                <span class={`${nested ? '' : 'font-semibold '}${scoreTone(topic.accuracy)}`}>{formatPercent(topic.accuracy)}</span>
            </td>
        </tr>
    );
};

// A tbody per topic keeps its subtopic rows with it when the table is sorted or folded.
const TopicTable = ({ topics, columns, label, rowLink, subtopicLink }: {
    topics: TopicSummary[]
    columns: TopicColumns
    /** "Topic", or "Subtopic" when the table is one topic broken down. */
    label: string
    rowLink: (topic: TopicSummary) => { href: string; title: string }
    subtopicLink: (subtopic: TopicSummary) => { href: string; title: string }
}) => (
    <>
        <table class="w-full text-sm" data-stats-table="topics" data-stats-grouped data-limit={String(TOPIC_ROWS)}>
            <thead>
                <tr class={TABLE_HEAD}>
                    <SortHeader sort="name" label={label} first="ascending" />
                    {columns.weighted && <SortHeader sort="weight" label={`Marks / ${columns.per}`} first="descending" align="right" current wide />}
                    {columns.weighted && columns.examCount > 1 && (
                        <th class="hidden sm:table-cell py-2 pr-4 font-bold text-right">{columns.per === 'mock' ? 'Mocks' : 'Papers'}</th>
                    )}
                    <SortHeader sort="done" label="Attempted" first="ascending" align="right" />
                    <SortHeader sort="accuracy" label="Accuracy" first="ascending" align="right" />
                </tr>
            </thead>
            {topics.map(topic => {
                const link = rowLink(topic);
                return (
                    <tbody>
                        <TopicRow topic={topic} href={link.href} linkTitle={link.title} columns={columns} />
                        {topic.subtopics.map(subtopic => {
                            const subLink = subtopicLink(subtopic);
                            return <TopicRow topic={subtopic} href={subLink.href} linkTitle={subLink.title} columns={columns} nested />;
                        })}
                    </tbody>
                );
            })}
        </table>
        {topics.length > TOPIC_ROWS && <ShowAllToggle target="topics" count={topics.length} noun={`${label.toLowerCase()}s`} />}
    </>
);

type ExamColumn = { label: string; detail: string; title: string; href: string };

const TopicMapTable = ({ map, columns }: { map: TopicUnitMap; columns: ExamColumn[] }) => {
    // A second header line tells papers of the same year apart, when there are several schools.
    const showDetail = columns.some(column => column.detail !== columns[0]?.detail);
    return (
        <>
            <div class="overflow-x-auto">
                <table class="mx-auto text-sm" data-stats-table="topic-map" data-limit={String(MAP_ROWS)}>
                    <thead>
                        <tr class="text-[11px] uppercase tracking-wider text-gray-500 dark:text-neutral-400">
                            <th class="sticky left-0 z-10 bg-background dark:bg-neutral-900 py-2 pr-3 sm:pr-4 text-left font-bold align-bottom">Topic</th>
                            {columns.map(column => (
                                <th class="px-[1px] py-2 text-center font-bold tabular-nums align-bottom whitespace-nowrap">
                                    <a href={column.href} title={column.title} class="hover:underline">
                                        {showDetail && <span class="block font-normal">{column.detail}</span>}
                                        {column.label}
                                    </a>
                                </th>
                            ))}
                            <th class="py-2 pl-3 text-right font-bold align-bottom">Avg</th>
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
                                            data-tip={`${row.name}, ${columns[index].title}: ${marks > 0 ? plural(marks, 'mark') : 'not tagged'}`}>
                                            {marks > 0 ? formatMarks(marks) : ' '}
                                        </span>
                                    </td>
                                ))}
                                <td class={`py-[1px] pl-3 text-right tabular-nums ${MUTED}`}>{formatMarks(row.avg)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {map.rows.length > MAP_ROWS && <div class="text-center"><ShowAllToggle target="topic-map" count={map.rows.length} noun="rows" /></div>}
        </>
    );
};

// The group name heads the first column, so each of the small tables explains itself.
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

const PaperTable = ({ results }: { results: PaperResult[] }) => (
    <>
        <table class="w-full text-sm" data-stats-table="papers" data-limit={String(RESULT_ROWS)}>
            <thead>
                <tr class={TABLE_HEAD}>
                    <th class="py-2 pr-3 font-bold">Paper</th>
                    <th class="py-2 pr-3 font-bold text-right">Attempted</th>
                    <th class="hidden sm:table-cell py-2 pr-3 font-bold text-right">Marks</th>
                    <th class="py-2 font-bold text-right">Accuracy</th>
                </tr>
            </thead>
            <tbody>
                {results.map(result => (
                    <tr class={TABLE_ROW}>
                        <td class="py-2 pr-3 [overflow-wrap:anywhere]">
                            <a href={`/past-papers/paper/${result.paper.id}`} class={NAME_LINK}>{paperName(result.paper)}</a>
                        </td>
                        <td class={`py-2 pr-3 text-right whitespace-nowrap tabular-nums ${BODY}`}>{formatCount(result.attempted)}/{formatCount(result.questions)}</td>
                        <td class={`hidden sm:table-cell py-2 pr-3 text-right whitespace-nowrap tabular-nums ${MUTED}`}>
                            {result.marksAttempted > 0 ? `${formatMarks(result.marksEarned)}/${formatMarks(result.marksAttempted)}` : '—'}
                        </td>
                        <td class={`py-2 text-right tabular-nums font-semibold ${scoreTone(result.accuracy)}`}>{formatPercent(result.accuracy)}</td>
                    </tr>
                ))}
            </tbody>
        </table>
        {results.length > RESULT_ROWS && <ShowAllToggle target="papers" count={results.length} noun="papers" />}
    </>
);

const MockTable = ({ results }: { results: MockResult[] }) => (
    <>
        <table class="w-full text-sm" data-stats-table="mocks" data-limit={String(RESULT_ROWS)}>
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
        {results.length > RESULT_ROWS && <ShowAllToggle target="mocks" count={results.length} noun="mock exams" />}
    </>
);

// Short " · "-separated facts, the zero ones left out.
const facts = (...parts: (string | false)[]) => parts.filter(Boolean).join(' · ');

const reviewSummary = (review: ReviewStats) =>
    review.queued === 0
        ? 'Nothing waiting.'
        : facts(
              `${formatCount(review.queued)} waiting`,
              review.dropped > 0 && `${formatCount(review.retried)} of ${formatCount(review.dropped)} retried`,
              review.fixed > 0 && `${formatCount(review.fixed)} fixed`,
              review.recovered > 0 && `${plural(review.recovered, 'mark')} won back`
          );

const activityText = (activity: ReturnType<typeof activitySummary>, inPeriod: boolean) =>
    activity.total === 0
        ? 'Nothing yet.'
        : inPeriod
            ? facts(plural(activity.total, 'attempt'), `${plural(activity.activeDays, 'active day')}`, `longest streak ${plural(activity.longest, 'day')}`)
            : facts(
                  `${formatCount(activity.thisWeek)} this week`,
                  `${formatCount(activity.lastWeek)} last week`,
                  `${formatCount(activity.total)} in all`,
                  activity.current > 0 && `${plural(activity.current, 'day')} streak`,
                  `longest ${plural(activity.longest, 'day')}`
              );

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
            <div class="flex justify-center gap-[3px] text-[10px] leading-none text-gray-400 dark:text-neutral-500" role="img" aria-label="Attempts each day">
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
            <div class="mt-2 flex items-center justify-center gap-[3px] text-[11px] text-gray-400 dark:text-neutral-500" aria-hidden="true">
                Less
                {[0, 1, 2, 3, 4].map(level => <span class={`hh-heat-${level} inline-block h-[11px] w-[11px] rounded-[2px]`}></span>)}
                More
            </div>
        </>
    );
};

const describeLeak = (weighted: boolean, noun: string) => (item: FocusItem) =>
    facts(
        `${formatPercent(item.topic.accuracy)} accuracy`,
        weighted ? `~${pluralMarks(item.score)} lost a ${noun}` : `${plural(item.topic.marksAttempted, 'mark')} tried`
    );

const describeGap = (weighted: boolean, noun: string) => (item: FocusItem) =>
    facts(
        `${formatCount(item.topic.attempted)}/${formatCount(item.topic.questions)} attempted`,
        weighted && `~${pluralMarks(item.topic.avgMarks ?? 0)} a ${noun}`
    );

// The activity calendar covers the period when there is one (up to a year of it), else the last year.
const activityFor = (rows: ActivityRow[], filters: StatsFilters, today: string) => {
    const days = daysWithin(dailyActivity(rows), filters.from, filters.to);
    const end = filters.to && filters.to < today ? filters.to : today;
    const weeks = filters.from ? Math.max(1, Math.min(HEATMAP_WEEKS, weeksSpanned(filters.from, end))) : HEATMAP_WEEKS;
    return { summary: activitySummary(days, today), heatmap: activityHeatmap(days, end, weeks, filters.from) };
};

// The filter bar, then table sorting, "Show all" folding and the cell tooltip. Every row is in the
// HTML and the filters are a plain form, so without this script the tables are simply unfolded and
// unsorted, and filters apply with the Apply button.
const STATS_SCRIPT = `
(function () {
    var slice = function (list, from) { return Array.prototype.slice.call(list, from || 0); };

    var form = document.querySelector('[data-stats-filters]');
    if (form) {
        var period = form.elements.namedItem('period');
        var dates = form.querySelector('[data-custom-dates]');
        var apply = form.querySelector('[data-filters-apply]');
        var fields = slice(form.querySelectorAll('select, input[type=date]'));
        var custom = function () { return period.value === 'custom'; };
        var sync = function () {
            dates.classList.toggle('hidden', !custom());
            dates.classList.toggle('flex', custom());
            // A menu choice applies at once. Dates wait for Apply, since typing one changes it part-way.
            apply.hidden = !custom();
        };
        // Defaults stay out of the URL: a disabled field isn't submitted.
        var strip = function () {
            fields.forEach(function (field) {
                field.disabled = field.type === 'date' ? !custom() || !field.value : field.value === '' || field.value === 'all';
            });
        };
        form.addEventListener('change', function (event) {
            if (!event.target || event.target.tagName !== 'SELECT') return;
            sync();
            if (event.target === period && custom()) {
                form.elements.namedItem('from').focus();
                return;
            }
            strip();
            form.submit();
        });
        form.addEventListener('submit', strip);
        // Going back can restore the page with the fields still disabled.
        window.addEventListener('pageshow', function () {
            fields.forEach(function (field) { field.disabled = false; });
            sync();
        });
        sync();
    }

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

/**
 * Content of the Statistics tab: every figure is per subject, for the signed-in student, worked out
 * over the filters in the query string (see readStatsFilters).
 */
export async function renderStatisticsTab(db: D1Database, userId: number, subject: string, query: (key: string) => string | undefined) {
    const paperList = buildPaperListQuery(subject);
    const mockList = buildMockListQuery(userId, subject);
    const [topicRows, paperRows, mockRows] = await db.batch([
        db.prepare('SELECT id, name FROM topics WHERE subject = ? ORDER BY name COLLATE NOCASE, id').bind(subject),
        db.prepare(paperList.sql).bind(...paperList.params),
        db.prepare(mockList.sql).bind(...mockList.params)
    ]);

    const papers = paperRows.results as PaperRow[];
    if (!papers.some(paper => Number(paper.questions) > 0)) {
        return <div class={`text-center py-12 ${MUTED}`}>No papers found for {subjectLabel(subject)}, so there's nothing to measure yet.</div>;
    }

    const groups = buildTopicGroups(topicRows.results as { id: number; name: string }[]);
    const mocks = mockRows.results as MockListRow[];
    const today = sydneyDate(new Date());
    const filters = readStatsFilters(query, { today, mockIds: mocks.map(mock => Number(mock.id)), topicKeys: groups.map(group => group.key) });
    const group = groups.find(entry => entry.key === filters.topic) ?? null;
    const scope = statsScope(userId, subject, filters, group?.topicIds ?? null);
    const inMocks = filters.mock != null;
    const singleMock = typeof filters.mock === 'number';
    const groupsJson = topicGroupsJson(groups);

    const queries = [
        buildTopicStatsQuery(scope, groupsJson),
        buildTopicUnitQuery(scope, groupsJson),
        buildBreakdownQuery(scope),
        buildReviewStatsQuery(scope),
        inMocks ? buildMockStatsQuery(scope) : buildPaperResultsQuery(scope),
        // Mock scope is about results, so it has no activity calendar.
        ...(inMocks ? [] : [buildActivityQuery(scope)])
    ];
    const [topicStats, topicUnitRows, breakdownRows, reviewRows, resultRows, activityRows] = await db.batch(
        queries.map(entry => db.prepare(entry.sql).bind(...entry.params))
    );

    // Exams are the papers in scope, or the mocks; the SQL has already left out any not in scope.
    const topicUnits = topicUnitRows.results as TopicUnitRow[];
    const weights = examWeights(topicUnits, inMocks ? mocks.map(mock => Number(mock.id)) : papers.map(paper => Number(paper.id)));
    const weighted = weights.units.length > 0;
    const allTopics = summarizeTopics(groups, topicStats.results as TopicStatRow[], weights);
    // With a topic chosen, the topic analyses move down a level, to its subtopics.
    const chosen = group ? allTopics.find(topic => topic.key === group.key) ?? null : null;
    const tableTopics = group ? chosen?.subtopics ?? [] : allTopics;
    const focus = focusTopics(tableTopics);
    const rowNames = new Map(group ? group.subtopics.map(subtopic => [subtopic.key, subtopic.name] as const) : groups.map(entry => [entry.key, entry.name] as const));
    const map = topicUnitMap(topicUnits, weights, rowNames, { topic: group?.key, limit: MAP_COLUMNS });

    const breakdown = summarizeBreakdown(breakdownRows.results as BreakdownRow[]);
    const { total } = breakdown;
    const accuracy = accuracyOf(total);
    const review = (reviewRows.results[0] as ReviewStats | undefined) ?? { queued: 0, dropped: 0, retried: 0, fixed: 0, recovered: 0 };
    const paperResults = inMocks ? null : summarizePapers(papers, resultRows.results as PaperResultRow[]);
    const mockResults = inMocks ? summarizeMocks(resultRows.results as MockRow[], resultRows.results.length) : null;
    const activity = inMocks ? null : activityFor((activityRows?.results ?? []) as ActivityRow[], filters, today);

    const noun = examNoun(filters);
    const per = inMocks ? 'mock' : 'paper';
    const paperById = new Map(papers.map(paper => [Number(paper.id), paper]));
    const mockById = new Map(mocks.map(mock => [Number(mock.id), mock]));
    const columns: ExamColumn[] = map.units.map(id => {
        const mock = inMocks ? mockById.get(id) : undefined;
        if (mock) {
            const finished = formatTimestamp(mock.completed_at);
            return { label: finished || '—', detail: '', title: `${mockName(mock)}${finished ? `, ${finished}` : ''}`, href: `/past-papers/mock-exams/${id}/mark` };
        }
        const paper = paperById.get(id);
        return paper
            ? { label: String(paper.academic_year ?? ''), detail: schoolCode(paper.school_name), title: paperName(paper), href: `/past-papers/paper/${id}` }
            : { label: '?', detail: '', title: '', href: '#' };
    });

    // The Topic menu lists the topics with questions in scope, plus the chosen one whatever the scope.
    const topicOptions = allTopics.map(topic => ({ key: topic.key, name: topic.name }));
    if (group && !topicOptions.some(option => option.key === group.key)) topicOptions.push({ key: group.key, name: group.name });
    topicOptions.sort((a, b) => a.name.localeCompare(b.name));

    const topicsTitle = group ? `${group.name} subtopics` : 'Topics';
    const topicsAction = group && (
        <div class="flex flex-wrap gap-x-5">
            <a href={statsUrl(subject, { ...filters, topic: '' })} class={ACTION_LINK}>All topics</a>
            <a href={practiceUrl(subject, group.name)} class={ACTION_LINK}>Practise {group.name}</a>
        </div>
    );

    return (
        <div class="space-y-12" data-stats-root>
            <style dangerouslySetInnerHTML={{ __html: HEAT_STYLES }} />

            <div class="space-y-6">
                <h1 class="text-3xl font-bold dark:text-white">Statistics</h1>
                <FilterBar subject={subject} filters={filters} papers={papers} mocks={mocks} topics={topicOptions} today={today} />
                {total.questions > 0 && (
                    <>
                        <dl class="grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-6">
                            <Stat label="Attempted" value={formatCount(total.attempted)} of={formatCount(total.questions)} />
                            <Stat label="Accuracy" value={formatPercent(accuracy)} tone={accuracy == null ? undefined : scoreTone(accuracy)}
                                note={total.marksAttempted > 0 ? `${formatMarks(total.marksEarned)} of ${plural(total.marksAttempted, 'mark')}` : undefined} />
                            {total.scored > 0 ? (
                                <Stat label="Full marks" value={formatCount(total.fullMarks)} of={formatCount(total.scored)} />
                            ) : (
                                <Stat label="Full marks" value="—" />
                            )}
                            {mockResults ? (
                                <Stat label={singleMock ? 'Mock score' : 'Mock average'} value={formatPercent(mockResults.average)}
                                    tone={mockResults.average == null ? undefined : scoreTone(mockResults.average)}
                                    note={mockResults.count === 0
                                        ? 'not marked yet'
                                        : singleMock
                                            ? `${formatMarks(mockResults.recent[0].marksAwarded)} of ${plural(mockResults.recent[0].totalMarks, 'mark')}`
                                            : mockResults.count > 1 ? `best ${formatPercent(mockResults.best)}` : undefined} />
                            ) : paperResults && (
                                <Stat label="Papers finished" value={formatCount(paperResults.complete)} of={formatCount(paperResults.total)}
                                    note={paperResults.started > 0 ? `${formatCount(paperResults.started)} started` : undefined} />
                            )}
                        </dl>
                    </>
                )}
            </div>

            {total.questions === 0 ? (
                <p class={BODY}>
                    No questions match these filters.{' '}
                    <a href={statsUrl(subject, DEFAULT_STATS_FILTERS)} class={INLINE_LINK}>Show everything</a>
                </p>
            ) : (
                <>
                    <Section title={topicsTitle} action={topicsAction}>
                        {tableTopics.length === 0 ? (
                            <p class={BODY}>
                                {group
                                    ? `${group.name} has no subtopics here.`
                                    : 'No topics tagged yet.'}
                            </p>
                        ) : (
                            <>
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8 mb-10">
                                    <FocusList
                                        title="Losing the most marks"
                                        items={focus.leaks}
                                        empty="Nothing yet."
                                        describe={describeLeak(weighted, noun)}
                                        href={topic => (group ? topicIdPracticeUrl(subject, topic.topicIds[0], true) : practiceUrl(subject, topic.name, true))}
                                    />
                                    <FocusList
                                        title="Least practised"
                                        items={focus.gaps}
                                        empty="Everything attempted."
                                        describe={describeGap(weighted, noun)}
                                        href={topic => (group ? topicIdPracticeUrl(subject, topic.topicIds[0], true) : practiceUrl(subject, topic.name, true))}
                                    />
                                </div>

                                <TopicTable
                                    topics={tableTopics}
                                    columns={{ weighted, examCount: weights.units.length, per }}
                                    label={group ? 'Subtopic' : 'Topic'}
                                    rowLink={topic => (group
                                        ? { href: topicIdPracticeUrl(subject, topic.topicIds[0]), title: 'Practise these questions' }
                                        : { href: statsUrl(subject, { ...filters, topic: topic.key }), title: `Statistics for ${topic.name} and its subtopics` })}
                                    subtopicLink={subtopic => ({ href: topicIdPracticeUrl(subject, subtopic.topicIds[0]), title: 'Practise these questions' })}
                                />

                                {map.unitCount > 1 && map.rows.length > 0 && (
                                    <div class="mt-10">
                                        <h3 class="mb-4 font-semibold text-gray-900 dark:text-white">Marks in each {per}</h3>
                                        <TopicMapTable map={map} columns={columns} />
                                        {map.units.length < map.unitCount && (
                                            <p class={`mt-2 text-center text-xs ${MUTED}`}>Latest {map.units.length} of {plural(map.unitCount, noun)}; Avg covers all</p>
                                        )}
                                        <p class={`mt-2 text-center text-xs ${MUTED}`}>Note: Sum usually exceeds 100 due to cross-topic questions OR Options essay</p>
                                    </div>
                                    
                                )}
                            </>
                        )}
                    </Section>

                    {mockResults ? (
                        <Section title={singleMock ? 'Mock exam' : 'Mock exams'}
                            action={<a href={`/past-papers/mock-exams?subject=${encodeURIComponent(subject)}`} class={ACTION_LINK}>All mock exams</a>}>
                            {mockResults.count === 0 ? (
                                <p class={BODY}>
                                    Not marked yet.
                                    {singleMock && <> <a href={`/past-papers/mock-exams/${filters.mock}/mark`} class={INLINE_LINK}>Mark it</a></>}
                                </p>
                            ) : (
                                <>
                                    {mockResults.pace != null && (
                                        <p class={`mb-4 text-sm ${MUTED}`}>
                                            Pace <span class={STRONG}>{formatMarks(mockResults.pace)}</span> min a mark (HSC {HSC_MINUTES_PER_MARK})
                                        </p>
                                    )}
                                    <MockTable results={mockResults.recent} />
                                </>
                            )}
                        </Section>
                    ) : paperResults && (
                        <Section title="Papers" action={<a href={`/past-papers?subject=${encodeURIComponent(subject)}&tab=browse`} class={ACTION_LINK}>Browse papers</a>}>
                            {paperResults.complete + paperResults.started > 0 ? (
                                <PaperTable results={paperResults.results.filter(result => result.attempted > 0)} />
                            ) : (
                                <p class={BODY}>None started yet.</p>
                            )}
                        </Section>
                    )}

                    <Section title="How you score">
                        <div class="grid grid-cols-1 sm:grid-cols-2 items-start gap-x-10 gap-y-8">
                            <BreakdownTable title="Question type" entries={breakdown.byType} />
                            <BreakdownTable title="Mark value" entries={breakdown.byMarks} />
                        </div>
                    </Section>

                    <Section title="Review" action={<a href={`/past-papers?subject=${encodeURIComponent(subject)}&tab=review`} class={ACTION_LINK}>Open Review</a>}>
                        <p class={BODY}>{reviewSummary(review)}</p>
                    </Section>

                    {activity && (
                        <Section title="Activity">
                            <p class={`mb-4 ${BODY}`}>{activityText(activity.summary, !!(filters.from || filters.to))}</p>
                            <ActivityHeatmap heatmap={activity.heatmap} />
                        </Section>
                    )}
                </>
            )}

            <details class={`text-sm ${MUTED}`}>
                <summary class="cursor-pointer font-bold text-gray-600 dark:text-neutral-300">How these numbers are worked out</summary>
                <ul class="mt-3 space-y-2 list-disc pl-5">
                    <li>Every figure on this page follows the filters. "Questions from" picks which questions count: papers of one kind, or the questions in your finished mock exams. "Topic" keeps only that topic's questions and breaks the topic tables down into its subtopics. "Period" keeps only the answers and marks you saved on those Sydney dates, so a question last marked before the period counts as not attempted.</li>
                    <li>A question counts as attempted once you've saved an answer or a mark for it, in Practice, Batch Mode or a marked mock exam. Accuracy is the marks you gave yourself out of the marks available on those questions.</li>
                    <li>Topics are grouped the way Browse groups them: "Calculus 1.2 Differentiation" and "Calculus - Integration" are subtopics of Calculus, and names that differ only in case, spacing or a syllabus number are merged. A question counts once towards a topic however many of its subtopics it's tagged with, so a topic's subtopics can add up to more than the topic.</li>
                    <li>Marks per paper is how many marks a paper in your chosen papers gives a topic on average, over the papers with tagged questions; with mock exams chosen, it's per mock instead. A question tagged with two topics counts towards both, so an exam's topics can add up to more than its total.</li>
                    <li>"Losing the most marks" multiplies a topic's marks per paper by the share you're dropping, once you've tried {MIN_TOPIC_MARKS} marks' worth of it. "Least practised" compares the marks you've attempted on a topic with what it's worth.</li>
                    <li>Mock exams are scored from the marks you saved when you marked them, so a finished mock you haven't marked isn't counted. With a period chosen, only mocks finished in it count.</li>
                    <li>Activity counts the first time you attempt each question, plus every review attempt, by Sydney date.</li>
                </ul>
            </details>

            <script dangerouslySetInnerHTML={{ __html: STATS_SCRIPT }} />
        </div>
    );
}
