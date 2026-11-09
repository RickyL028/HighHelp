import { Hono } from 'hono'
import { Layout } from '../layout'
import { Bindings } from '../types'
import { getUser } from '../utils'
import { ATTEMPTS_PER_DAY_SQL, USERS_PER_DAY_SQL, cumulativeDaily, sydneyToday } from '../infoStats'

const app = new Hono<{ Bindings: Bindings }>()

const fmt = (n: number) => n.toLocaleString('en-AU', { maximumFractionDigits: 1 })

// Milestones marked on the charts, keyed by month (YYYY-MM).
const USER_EVENTS: [string, string][] = [
    ['2026-02', 'Year 11 Canvas Announcement'],
    ['2026-08', 'Principal\'s Address on High Notes']
]
const ATTEMPT_EVENTS: [string, string][] = [
    ['2026-05', '1st Past Paper Update'],
    ['2026-10', 'HSC Update']
]

app.get('/info', async (c) => {
    const user = await getUser(c)

    const [usersRes, attemptsRes] = await c.env.DB.batch<{ day: string; n: number; marks?: number }>([
        c.env.DB.prepare(USERS_PER_DAY_SQL),
        c.env.DB.prepare(ATTEMPTS_PER_DAY_SQL)
    ])
    const userRows = usersRes.results || []
    const attemptRows = attemptsRes.results || []

    // Both charts share one date range so their months line up when stacked.
    const today = sydneyToday()
    const start = [userRows[0]?.day, attemptRows[0]?.day].filter(Boolean).sort()[0] as string | undefined
    const users = cumulativeDaily(userRows, today, start)
    const attempts = cumulativeDaily(attemptRows, today, start)

    const userCount = users.values[users.values.length - 1] || 0
    const attemptCount = attempts.values[attempts.values.length - 1] || 0
    const marks = attemptRows.reduce((sum, r) => sum + Number(r.marks || 0), 0)
    const minutes = marks * 1.5

    const charts = [
        { id: 'info-users', label: 'New Users', unit: 'users', values: users.values, events: USER_EVENTS },
        { id: 'info-attempts', label: 'Question attempts', unit: 'attempts', values: attempts.values, events: ATTEMPT_EVENTS }
    ]
    const data = { labels: users.labels, charts: charts.map(({ id, unit, values, events }) => ({ id, unit, values, events })) }
    const b = 'font-semibold text-gray-900 dark:text-white'

    return c.html(
        <Layout title="Info" user={user}>
            <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
            {/* Theme colour probes: the charts read these so they follow every site theme. */}
            <div class="hidden" aria-hidden="true">
                <span id="info-c-accent" class="text-blue-600 dark:text-blue-400"></span>
                <span id="info-c-muted" class="text-gray-500 dark:text-neutral-400"></span>
                <span id="info-c-ink" class="text-gray-900 dark:text-neutral-100"></span>
                <span id="info-c-grid" class="border border-gray-200 dark:border-neutral-800"></span>
                <span id="info-c-base" class="border border-gray-300 dark:border-neutral-700"></span>
            </div>

            <div class="max-w-5xl mx-auto">
                <div class="flex flex-col gap-10 lg:h-[calc(100vh-13rem)] lg:min-h-[520px]">
                    {charts.map((ch) => (
                        <section class="flex flex-col lg:flex-1 lg:min-h-0">
                            <h2 class="text-sm font-semibold text-gray-700 dark:text-neutral-300">{ch.label}</h2>
                            <div class="relative mt-3 h-64 sm:h-72 lg:h-auto lg:flex-1 lg:min-h-0">
                                <div class="absolute inset-0">
                                    <canvas id={ch.id} role="img" aria-label={`${ch.label} per month, with the running total as a percentage`}></canvas>
                                </div>
                            </div>
                        </section>
                    ))}
                </div>

                <p class="mt-10 text-center text-base sm:text-lg text-gray-600 dark:text-neutral-300">
                    <span class={b}>{fmt(attemptCount)}</span> questions, <span class={b}>{fmt(marks)}</span> marks done by{' '}
                    <span class={b}>{fmt(userCount)}</span> users - that's <span class={b}>{fmt(minutes)}</span> minutes, or{' '}
                    <span class={b}>{fmt(minutes / 60)}</span> hours!
                </p>
            </div>

            <script
                dangerouslySetInnerHTML={{
                    __html: `
                (function () {
                    var DATA = ${JSON.stringify(data).replace(/</g, '\\u003c')};
                    var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                    var nf = new Intl.NumberFormat('en-AU');
                    var cf = new Intl.NumberFormat('en-AU', { notation: 'compact', maximumFractionDigits: 1 });
                    var charts = [];

                    function monthName(key, withYear) { return MONTHS[Number(key.slice(5, 7)) - 1] + (withYear ? ' ' + key.slice(0, 4) : ''); }
                    function rgba(color, a) {
                        var p = (color.match(/[\\d.]+/g) || [0, 0, 0]).map(Number);
                        return 'rgba(' + p[0] + ',' + p[1] + ',' + p[2] + ',' + a + ')';
                    }
                    function opaque(color, fallback) {
                        var p = (color.match(/[\\d.]+/g) || []).map(Number);
                        return p.length < 3 || (p.length > 3 && p[3] < 0.9) ? fallback : color;
                    }
                    function probe(id, prop) { return getComputedStyle(document.getElementById(id))[prop]; }

                    function palette() {
                        var dark = document.documentElement.classList.contains('dark');
                        return {
                            accent: probe('info-c-accent', 'color'),
                            muted: probe('info-c-muted', 'color'),
                            ink: probe('info-c-ink', 'color'),
                            grid: probe('info-c-grid', 'borderTopColor'),
                            base: probe('info-c-base', 'borderTopColor'),
                            surface: opaque(getComputedStyle(document.body).backgroundColor, dark ? '#171717' : '#ffffff'),
                            font: getComputedStyle(document.body).fontFamily
                        };
                    }

                    // Daily running totals -> new per calendar month, plus the running total as a % of today's total.
                    function monthly(values) {
                        var labels = DATA.labels, months = [], added = [], pct = [];
                        var total = values[values.length - 1] || 0;
                        for (var i = 0; i < labels.length; i++) {
                            var key = labels[i].slice(0, 7);
                            if (months[months.length - 1] !== key) { months.push(key); added.push(0); pct.push(0); }
                            added[added.length - 1] += values[i] - (i ? values[i - 1] : 0);
                            pct[pct.length - 1] = total ? Math.round((values[i] / total) * 1000) / 10 : 0;
                        }
                        return { months: months, added: added, pct: pct };
                    }

                    // Milestones: a hairline through the month with its name above the plot. A name that
                    // would overlap an earlier one (or the total label) moves up a row; layout.padding.top
                    // leaves room for three.
                    var events = {
                        id: 'events',
                        beforeDatasetsDraw: function (chart) {
                            var list = chart.options.plugins.events.list, o = chart.options.plugins.events;
                            var labels = chart.data.labels, area = chart.chartArea, ctx = chart.ctx, x = chart.scales.x;
                            ctx.save();
                            ctx.font = '600 11px ' + o.font;
                            ctx.textBaseline = 'bottom';
                            var rows = [[], [], []];
                            // Keep milestone names clear of the total label when it sits in their first row.
                            var tb = totalBox(chart);
                            if (tb && tb.y < area.top) rows[0].push([tb.x - tb.w / 2, tb.x + tb.w / 2]);
                            list.forEach(function (ev) {
                                var i = labels.indexOf(ev[0]);
                                if (i < 0) return;
                                var px = Math.round(x.getPixelForValue(i)) + 0.5;
                                var w = ctx.measureText(ev[1]).width;
                                var right = px + 6 + w > area.right;
                                var x0 = right ? px - 6 - w : px, x1 = right ? px : px + 6 + w;
                                var row = 0;
                                while (row < rows.length - 1 && rows[row].some(function (r) { return x0 < r[1] + 8 && x1 > r[0] - 8; })) row++;
                                rows[row].push([x0, x1]);
                                var top = area.top - 4 - row * 16;
                                ctx.beginPath();
                                ctx.moveTo(px, top);
                                ctx.lineTo(px, area.bottom);
                                ctx.lineWidth = 1;
                                ctx.strokeStyle = o.line;
                                ctx.stroke();
                                ctx.textAlign = right ? 'right' : 'left';
                                ctx.fillStyle = o.text;
                                ctx.fillText(ev[1], right ? px - 6 : px + 6, top);
                            });
                            ctx.restore();
                        }
                    };

                    // Where the current total goes: centred just above the line's last point, nudged left
                    // if it would run past the plot. y is the text's baseline; near the top of the plot it
                    // lines up with the first row of milestone names.
                    function totalBox(chart) {
                        var o = chart.options.plugins.total;
                        var pts = chart.getDatasetMeta(0).data;
                        var p = pts[pts.length - 1];
                        if (!p || !o.text) return null;
                        chart.ctx.save();
                        chart.ctx.font = '600 13px ' + o.font;
                        var w = chart.ctx.measureText(o.text).width;
                        chart.ctx.restore();
                        var area = chart.chartArea;
                        var y = p.y - 10 < area.top ? area.top - 4 : p.y - 10;
                        return { x: Math.min(p.x, area.right - w / 2), y: y, w: w };
                    }

                    // The current total, with a halo so it stays readable over the line.
                    var total = {
                        id: 'total',
                        afterDatasetsDraw: function (chart) {
                            var o = chart.options.plugins.total, b = totalBox(chart);
                            if (!b) return;
                            var ctx = chart.ctx;
                            ctx.save();
                            ctx.font = '600 13px ' + o.font;
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'bottom';
                            ctx.lineJoin = 'round';
                            ctx.lineWidth = 4;
                            ctx.strokeStyle = o.halo;
                            ctx.strokeText(o.text, b.x, b.y);
                            ctx.fillStyle = o.color;
                            ctx.fillText(o.text, b.x, b.y);
                            ctx.restore();
                        }
                    };

                    function build(animate) {
                        charts.forEach(function (c) { c.destroy(); });
                        charts = [];
                        var pal = palette();
                        Chart.defaults.font.family = pal.font;
                        Chart.defaults.color = pal.muted;

                        DATA.charts.forEach(function (ch) {
                            var m = monthly(ch.values);
                            var max = Math.max.apply(null, m.added.concat([0]));
                            charts.push(new Chart(document.getElementById(ch.id), {
                                data: {
                                    labels: m.months,
                                    datasets: [
                                        {
                                            type: 'line',
                                            data: m.pct,
                                            yAxisID: 'pct',
                                            order: 0,
                                            borderColor: pal.accent,
                                            borderWidth: 2,
                                            borderCapStyle: 'round',
                                            borderJoinStyle: 'round',
                                            cubicInterpolationMode: 'monotone',
                                            pointRadius: 4,
                                            pointBackgroundColor: pal.accent,
                                            pointBorderColor: pal.surface,
                                            pointBorderWidth: 2,
                                            pointHoverRadius: 5,
                                            pointHoverBackgroundColor: pal.accent,
                                            pointHoverBorderColor: pal.surface,
                                            pointHoverBorderWidth: 2,
                                            clip: 8
                                        },
                                        {
                                            type: 'bar',
                                            data: m.added,
                                            yAxisID: 'y',
                                            order: 1,
                                            backgroundColor: rgba(pal.accent, 0.28),
                                            hoverBackgroundColor: rgba(pal.accent, 0.42),
                                            borderRadius: 4,
                                            borderSkipped: 'start',
                                            maxBarThickness: 32,
                                            categoryPercentage: 0.8,
                                            barPercentage: 0.9
                                        }
                                    ]
                                },
                                plugins: [events, total],
                                options: {
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    animation: animate ? { duration: 600, easing: 'easeOutQuart' } : false,
                                    layout: { padding: { top: 52 } },
                                    interaction: { mode: 'index', intersect: false },
                                    plugins: {
                                        legend: { display: false },
                                        events: { list: ch.events, line: pal.base, text: pal.muted, font: pal.font },
                                        total: {
                                            text: nf.format(ch.values[ch.values.length - 1] || 0) + ' ' + ch.unit,
                                            color: pal.ink,
                                            halo: pal.surface,
                                            font: pal.font
                                        },
                                        tooltip: {
                                            displayColors: false,
                                            backgroundColor: pal.surface,
                                            borderColor: pal.grid,
                                            borderWidth: 1,
                                            cornerRadius: 8,
                                            padding: { x: 12, y: 8 },
                                            caretSize: 0,
                                            titleColor: pal.ink,
                                            titleFont: { size: 13, weight: '600' },
                                            bodyColor: pal.muted,
                                            bodyFont: { size: 12 },
                                            itemSort: function (a, b) { return b.datasetIndex - a.datasetIndex; },
                                            callbacks: {
                                                title: function (items) { return monthName(m.months[items[0].dataIndex], true); },
                                                label: function (item) {
                                                    return item.dataset.type === 'bar'
                                                        ? '+' + nf.format(item.raw) + ' this month'
                                                        : item.raw + '% of total so far';
                                                }
                                            }
                                        }
                                    },
                                    scales: {
                                        x: {
                                            grid: { display: false },
                                            border: { color: pal.base },
                                            ticks: {
                                                maxRotation: 0,
                                                autoSkip: true,
                                                autoSkipPadding: 16,
                                                padding: 6,
                                                font: { size: 11 },
                                                callback: function (v, i) {
                                                    var key = m.months[v];
                                                    return monthName(key, i === 0 || key.slice(5, 7) === '01');
                                                }
                                            }
                                        },
                                        y: {
                                            position: 'left',
                                            beginAtZero: true,
                                            border: { display: false },
                                            grid: { color: pal.grid, lineWidth: 1, drawTicks: false },
                                            ticks: {
                                                maxTicksLimit: 5,
                                                precision: 0,
                                                padding: 8,
                                                font: { size: 11 },
                                                callback: function (y) { return max >= 10000 ? cf.format(y) : nf.format(y); }
                                            }
                                        },
                                        pct: {
                                            position: 'right',
                                            min: 0,
                                            max: 100,
                                            border: { display: false },
                                            grid: { display: false },
                                            ticks: { stepSize: 25, padding: 8, font: { size: 11 }, callback: function (y) { return y + '%'; } }
                                        }
                                    }
                                }
                            }));
                        });
                    }

                    function start() {
                        if (!window.Chart) return;
                        build(true);
                        // Recolour when the theme toggle changes the <html> classes.
                        var current = document.documentElement.className;
                        new MutationObserver(function () {
                            if (document.documentElement.className === current) return;
                            current = document.documentElement.className;
                            requestAnimationFrame(function () { build(false); });
                        }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
                    }

                    // Tailwind's CDN build styles the probes, so wait for it before reading colours.
                    if (document.readyState === 'complete') start();
                    else window.addEventListener('load', start);
                })();
            `
                }}
            ></script>
        </Layout>
    )
})

export default app
