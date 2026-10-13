import { Hono } from 'hono'
import { Layout } from '../layout'
import { getUser } from '../utils'
import { Bindings } from '../types'

const app = new Hono<{ Bindings: Bindings }>()

// School-wide countdowns (Sydney local time). The home page counts down to the next one that
// hasn't passed and rolls over by itself, so queue future events here ahead of time. Shown as
// "Until <label>". Students can add their own on top of these; those live in their browser only.
const SCHOOL_COUNTDOWNS: { label: string; date: string }[] = [
    { label: 'HSC Task 1', date: '2026-11-30T09:00' },
]

const iconButton = 'w-8 h-8 flex items-center justify-center rounded-full text-lg leading-none text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-neutral-800 hover:text-gray-900 dark:hover:text-white'
const fieldClass = 'px-3 py-1.5 rounded-md border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm text-gray-900 dark:text-white dark:[color-scheme:dark]'

app.get('/', async (c) => {
    const user = await getUser(c)

    return c.html(
        <Layout title="Home" user={user} noScroll>
            <div class="space-y-12 px-4 md:px-0 pb-12 pt-12">

                {/* Timeline & Countdowns Section */}
                <div class="flex flex-col gap-6 max-w-4xl mx-auto mb-12 ">

                    {/* Row 1: Countdown Banner. Controls show on hover (always on touch screens). */}
                    <div class="group flex flex-col items-center justify-center gap-4 w-full mb-6">


                        <div id="home-countdown" class="mb-6 text-center text-5xl md:text-7xl font-mono font-black text-gray-900 dark:text-white tracking-tight">
                            --:--:--:--
                        </div>
                        <h2 id="home-countdown-label" class="text-xl md:text-1xl font-bold text-secondary tracking-widest flex items-center justify-center dark:text-white gap-2">
                            &nbsp;
                        </h2>

                        <div class="flex items-center justify-center gap-1 transition-opacity [@media(hover:hover)]:opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                            <button type="button" id="countdown-prev" class={`${iconButton} hidden`} title="Previous event" aria-label="Previous event">&lsaquo;</button>
                            <button type="button" id="countdown-add" class={iconButton} title="Add your own countdown" aria-label="Add your own countdown">+</button>
                            <button type="button" id="countdown-remove" class={`${iconButton} hidden`} title="Remove this countdown" aria-label="Remove this countdown">&times;</button>
                            <button type="button" id="countdown-next" class={`${iconButton} hidden`} title="Next event" aria-label="Next event">&rsaquo;</button>
                        </div>

                        <form id="countdown-form" class="hidden flex flex-wrap items-center justify-center gap-2">
                            <input id="countdown-form-label" type="text" required maxlength={60} placeholder="Event name" class={fieldClass} />
                            <input id="countdown-form-date" type="datetime-local" required class={fieldClass} />
                            <button type="submit" class="px-3 py-1.5 rounded-md bg-primary text-white text-sm font-semibold hover:opacity-90">Add</button>
                            <button type="button" id="countdown-form-cancel" class="px-3 py-1.5 rounded-md text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-neutral-800">Cancel</button>
                        </form>
                    </div>




                </div>

                {/* Homepage logo */}
                <div class="flex flex-col items-center justify-center space-y-4 py-4 mt-6 ">
                    <img
                        src="https://assets.schools.nsw.gov.au/content/dam/doe/sws/schools/s/sydneyboys-h/logo.png"
                        alt="Sydney Boys High School Logo"
                        class="h-48 w-auto object-contain drop-shadow-sm dark:opacity-80"
                    />
                    <h1 class="text-4xl font-bold text-gray-900 dark:text-white tracking-tight">HighHelp</h1>
                    <p class="text-lg text-gray-600 dark:text-gray-400 text-center">Designed and programmed specifically for, and by, class of 2027.</p>
                </div>

                <script dangerouslySetInnerHTML={{
                    __html: `
                    (function() {
                        var SCHOOL = ${JSON.stringify(SCHOOL_COUNTDOWNS).replace(/</g, '\\u003c')};
                        var STORE_KEY = 'homeCountdowns';     // [{ label, date }] added by this user
                        var SELECTED_KEY = 'homeCountdownSel'; // key of the event being shown

                        function load(key, fallback) {
                            try { var v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; } catch (e) { return fallback; }
                        }
                        function save(key, value) {
                            try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
                        }

                        // Drop personal events that have already passed.
                        var mine = load(STORE_KEY, []);
                        if (!Array.isArray(mine)) mine = [];
                        mine = mine.filter(function(e) {
                            return e && typeof e.label === 'string' && new Date(e.date).getTime() > Date.now();
                        });
                        save(STORE_KEY, mine);
                        var selected = load(SELECTED_KEY, null);

                        var countdownEl = document.getElementById('home-countdown');
                        var labelEl = document.getElementById('home-countdown-label');
                        var prevBtn = document.getElementById('countdown-prev');
                        var nextBtn = document.getElementById('countdown-next');
                        var addBtn = document.getElementById('countdown-add');
                        var removeBtn = document.getElementById('countdown-remove');
                        var form = document.getElementById('countdown-form');
                        var formLabel = document.getElementById('countdown-form-label');
                        var formDate = document.getElementById('countdown-form-date');

                        function eventKey(e, isMine) { return (isMine ? 'mine|' : 'school|') + e.date + '|' + e.label; }

                        // Upcoming school + personal events, soonest first.
                        function upcoming(now) {
                            var tag = function(isMine) {
                                return function(e) { return { label: e.label, date: e.date, mine: isMine, at: new Date(e.date).getTime(), key: eventKey(e, isMine) }; };
                            };
                            return SCHOOL.map(tag(false)).concat(mine.map(tag(true)))
                                .filter(function(e) { return e.at > now; })
                                .sort(function(a, b) { return a.at - b.at; });
                        }

                        // The chosen event if it's still upcoming, otherwise the next school event, otherwise anything.
                        var list = [], index = -1;
                        function pick(now) {
                            list = upcoming(now);
                            index = list.findIndex(function(e) { return e.key === selected; });
                            if (index < 0) index = list.findIndex(function(e) { return !e.mine; });
                            if (index < 0 && list.length) index = 0;
                            return list[index];
                        }

                        var pad = function(n) { return n.toString().padStart(2, '0'); };

                        // Continuous Countdown Timer
                        function render() {
                            var now = Date.now();
                            var current = pick(now);
                            if (!current) {
                                countdownEl.innerText = '/';
                                labelEl.innerText = 'No upcoming events';
                            } else {
                                var distance = current.at - now;
                                var days = Math.floor(distance / (1000 * 60 * 60 * 24));
                                var hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                                var minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
                                var seconds = Math.floor((distance % (1000 * 60)) / 1000);
                                // Zero padding keeps the width stable in the mono font
                                countdownEl.innerText = days + 'd ' + pad(hours) + 'h ' + pad(minutes) + 'm ' + pad(seconds) + 's';
                                labelEl.innerText = 'Until ' + current.label;
                            }
                            prevBtn.classList.toggle('hidden', list.length < 2);
                            nextBtn.classList.toggle('hidden', list.length < 2);
                            removeBtn.classList.toggle('hidden', !(current && current.mine));
                        }

                        function select(key) {
                            selected = key;
                            save(SELECTED_KEY, key);
                            render();
                        }
                        function step(by) {
                            if (list.length < 2) return;
                            select(list[(index + by + list.length) % list.length].key);
                        }
                        prevBtn.addEventListener('click', function() { step(-1); });
                        nextBtn.addEventListener('click', function() { step(1); });

                        removeBtn.addEventListener('click', function() {
                            var current = list[index];
                            if (!current || !current.mine) return;
                            mine = mine.filter(function(e) { return eventKey(e, true) !== current.key; });
                            save(STORE_KEY, mine);
                            select(null);
                        });

                        function toggleForm(open) {
                            form.classList.toggle('hidden', !open);
                            if (open) {
                                // datetime-local wants local time without a zone
                                var d = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
                                formDate.min = d.toISOString().slice(0, 16);
                                formLabel.focus();
                            } else {
                                form.reset();
                            }
                        }
                        addBtn.addEventListener('click', function() { toggleForm(form.classList.contains('hidden')); });
                        document.getElementById('countdown-form-cancel').addEventListener('click', function() { toggleForm(false); });
                        formDate.addEventListener('input', function() { formDate.setCustomValidity(''); });

                        form.addEventListener('submit', function(ev) {
                            ev.preventDefault();
                            var entry = { label: formLabel.value.replace(/\\s+/g, ' ').trim().slice(0, 60), date: formDate.value.slice(0, 16) };
                            if (!entry.label) return;
                            if (!(new Date(entry.date).getTime() > Date.now())) {
                                formDate.setCustomValidity('Pick a time in the future');
                                formDate.reportValidity();
                                return;
                            }
                            mine.push(entry);
                            save(STORE_KEY, mine);
                            toggleForm(false);
                            select(eventKey(entry, true));
                        });

                        // Initialization
                        setInterval(render, 1000);
                        render();
                    })();
                ` }} />

            </div>
        </Layout>
    )
})

export default app
