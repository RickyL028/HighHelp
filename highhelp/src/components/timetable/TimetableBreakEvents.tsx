import { html } from 'hono/html'

// Personal events pinned to Roll Call / Recess / Lunch 1 / Lunch 2, stored in localStorage('breakEvents').
// Shape: { id, period: 'RC'|'R'|'L1'|'L2', title, location, color, repeat: 'none'|'weekly'|'cycle'|'daily',
//          date (first/only occurrence), weekday (0-6), cycleDay (calendarMap dayNumber), skip: [dates] }
export const TimetableBreakEvents = html`
<div id="break-event-modal" class="hidden fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
    <div class="bg-white dark:bg-neutral-900 rounded-2xl w-full max-w-md mx-4 shadow-2xl overflow-hidden transform transition-transform scale-95 opacity-0" id="break-event-modal-content">
        <div class="px-6 py-4 border-b border-gray-100 dark:border-neutral-800 flex justify-between items-center bg-gray-50 dark:bg-neutral-950/50">
            <div>
                <h3 class="text-lg font-bold text-gray-900 dark:text-white" id="break-event-heading">Add event</h3>
                <p class="text-sm text-gray-500 dark:text-neutral-400" id="break-event-sub"></p>
            </div>
            <button id="break-event-close" class="text-gray-400 dark:text-neutral-500 hover:text-gray-600 dark:hover:text-neutral-300 transition-colors">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
        </div>
        <form id="break-event-form" class="p-6 space-y-4">
            <div>
                <label for="break-event-title" class="block text-xs font-semibold text-gray-500 dark:text-neutral-400 mb-1">Title</label>
                <input id="break-event-title" type="text" maxlength="60" required placeholder="e.g. Chess club"
                    class="w-full text-sm bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-gray-900 dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-red-400 focus:border-red-400" />
            </div>
            <div>
                <label for="break-event-location" class="block text-xs font-semibold text-gray-500 dark:text-neutral-400 mb-1">Location <span class="font-normal">(optional)</span></label>
                <input id="break-event-location" type="text" maxlength="40" placeholder="e.g. Library"
                    class="w-full text-sm bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-gray-900 dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-red-400 focus:border-red-400" />
            </div>
            <div>
                <label for="break-event-repeat" class="block text-xs font-semibold text-gray-500 dark:text-neutral-400 mb-1">Repeat</label>
                <select id="break-event-repeat"
                    class="w-full text-sm bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-gray-900 dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-red-400 focus:border-red-400"></select>
                <p id="break-event-series-note" class="hidden mt-1 text-[11px] text-gray-400 dark:text-neutral-500">Changes apply to every occurrence.</p>
            </div>
            <div>
                <span class="block text-xs font-semibold text-gray-500 dark:text-neutral-400 mb-1">Colour</span>
                <div id="break-event-colors" class="flex gap-2"></div>
            </div>
            <div class="flex items-center justify-between pt-2">
                <div id="break-event-delete-group" class="flex gap-2"></div>
                <button type="submit" class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors shadow-sm">Save</button>
            </div>
        </form>
    </div>
</div>

<script>
    const BREAK_EVENT_COLORS = ['3b82f6', '10b981', 'f59e0b', 'ef4444', '8b5cf6', 'ec4899'];
    const BREAK_EVENT_WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // Bell codes vary by day (e.g. MTL1 on Mon/Tue, WFL1 on Wed/Fri), so map them to one slot.
    function getBreakSlot(bell) {
        const code = String(bell.period || '');
        const label = String(bell.label || '');
        if (code === 'RC' || label.startsWith('RC ') || /roll\\s*call/i.test(label)) return 'RC';
        if (code === 'R' || /recess/i.test(code) || /recess/i.test(label)) return 'R';
        if (/L1$/.test(code) || /lunch\\s*1/i.test(label)) return 'L1';
        if (/L2$/.test(code) || /lunch\\s*2/i.test(label)) return 'L2';
        if (/lunch/i.test(code) || /lunch/i.test(label)) return 'L1';
        return null;
    }

    function _beEsc(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

    function loadBreakEvents() {
        try {
            const list = JSON.parse(localStorage.getItem('breakEvents') || '[]');
            return Array.isArray(list) ? list : [];
        } catch (e) { return []; }
    }

    function saveBreakEvents(list) {
        try { localStorage.setItem('breakEvents', JSON.stringify(list)); } catch (e) { console.error('[break-events] save failed', e); }
    }

    function breakEventOccursOn(ev, dateStr) {
        if (ev.repeat === 'none') return ev.date === dateStr;
        if (dateStr < ev.date) return false;
        if (Array.isArray(ev.skip) && ev.skip.includes(dateStr)) return false;
        const weekday = new Date(dateStr + 'T12:00:00').getDay();
        if (ev.repeat === 'weekly') return weekday === ev.weekday;
        if (ev.repeat === 'cycle') return String(calendarMap[dateStr]?.dayNumber ?? '') === String(ev.cycleDay);
        if (ev.repeat === 'daily') return weekday >= 1 && weekday <= 5;
        return false;
    }

    function getBreakEventsFor(dateStr, period) {
        return loadBreakEvents().filter(ev => ev.period === period && breakEventOccursOn(ev, dateStr));
    }

    function breakEventRepeatLabel(ev) {
        if (ev.repeat === 'weekly') return 'Every ' + BREAK_EVENT_WEEKDAYS[ev.weekday];
        if (ev.repeat === 'cycle') return 'Every ' + (ev.cycleLabel || ('Day ' + ev.cycleDay));
        if (ev.repeat === 'daily') return 'Every school day';
        return '';
    }

    // Inner HTML for a break/Roll Call row in the Day view. With no events it's the plain label plus an
    // add button; with events, the label moves into each event card and the add button sits beside them.
    function renderBreakSlotHtml(bell, dateStr) {
        const slot = getBreakSlot(bell);
        const events = getBreakEventsFor(dateStr, slot);
        const label = _beEsc(bell.label);
        const addBtn = \`
            <button type="button" class="break-event-add w-5 h-5 flex-shrink-0 flex items-center justify-center rounded text-gray-300 dark:text-neutral-600 hover:text-gray-600 dark:hover:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                data-period="\${slot}" data-label="\${label}" title="Add event to \${label}" aria-label="Add event to \${label}">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"></path></svg>
            </button>\`;

        if (events.length === 0) {
            return \`
                <div class="pl-2 flex items-center gap-2 text-gray-400 dark:text-neutral-500 text-xs py-1">
                    <span>\${label}</span>
                    \${addBtn}
                </div>\`;
        }

        const cards = events.map(ev => {
            const color = '#' + (ev.color || BREAK_EVENT_COLORS[0]);
            const repeatLabel = breakEventRepeatLabel(ev);
            return \`
                <div class="break-event-card relative flex items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 shadow-sm cursor-pointer border-l-4 hover:opacity-90 transition-opacity"
                    style="background-color: \${color}15; border-color: \${color};"
                    data-event-id="\${_beEsc(ev.id)}" title="\${_beEsc(repeatLabel || 'One-off event')}">
                    <div class="flex items-center gap-2 min-w-0 text-sm">
                        <span class="text-[10px] font-bold tracking-wider flex-shrink-0" style="color: \${color};">\${label}</span>
                        <span class="font-medium text-gray-900 dark:text-white truncate">\${_beEsc(ev.title)}</span>
                        \${repeatLabel ? '<svg class="w-3 h-3 flex-shrink-0 text-gray-400 dark:text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>' : ''}
                    </div>
                    \${ev.location ? \`<div class="text-xs font-bold text-gray-700 dark:text-neutral-300 flex-shrink-0">\${_beEsc(ev.location)}</div>\` : ''}
                </div>\`;
        }).join('');
        return \`
            <div class="flex items-center gap-1.5 py-0.5">
                <div class="flex-grow min-w-0 space-y-1">\${cards}</div>
                \${addBtn}
            </div>\`;
    }

    function attachBreakEventHandlers(container, dateStr) {
        container.querySelectorAll('.break-event-add').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                openBreakEventModal({ date: dateStr, period: btn.dataset.period, label: btn.dataset.label });
            });
        });
        container.querySelectorAll('.break-event-card').forEach(card => {
            card.addEventListener('click', (e) => {
                e.stopPropagation();
                const ev = loadBreakEvents().find(x => x.id === card.dataset.eventId);
                if (!ev) return;
                const label = (DEFAULT_BELL_TIMES.find(b => b.period === ev.period) || {}).label || ev.period;
                openBreakEventModal({ date: dateStr, period: ev.period, label, event: ev });
            });
        });
    }

    (function() {
        const modal = document.getElementById('break-event-modal');
        const content = document.getElementById('break-event-modal-content');
        const form = document.getElementById('break-event-form');
        const titleInput = document.getElementById('break-event-title');
        const locationInput = document.getElementById('break-event-location');
        const repeatSelect = document.getElementById('break-event-repeat');
        const colorsEl = document.getElementById('break-event-colors');
        const deleteGroup = document.getElementById('break-event-delete-group');
        const seriesNote = document.getElementById('break-event-series-note');
        let ctx = null;
        let selectedColor = BREAK_EVENT_COLORS[0];

        function close() {
            content.classList.remove('scale-100', 'opacity-100');
            content.classList.add('scale-95', 'opacity-0');
            setTimeout(() => modal.classList.add('hidden'), 200);
            ctx = null;
        }

        function afterChange() {
            close();
            if (window.rerenderDayFast) window.rerenderDayFast();
            else if (window.render) window.render();
        }

        function renderColors() {
            colorsEl.innerHTML = BREAK_EVENT_COLORS.map(c => \`
                <button type="button" data-color="\${c}" aria-label="Colour #\${c}"
                    class="w-6 h-6 rounded-full transition-transform \${c === selectedColor ? 'ring-2 ring-offset-2 ring-gray-400 dark:ring-offset-neutral-900 scale-110' : ''}"
                    style="background-color: #\${c};"></button>\`).join('');
            colorsEl.querySelectorAll('button').forEach(b => b.onclick = () => { selectedColor = b.dataset.color; renderColors(); });
        }

        function deleteButton(text, onClick) {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'px-3 py-2 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors';
            b.textContent = text;
            b.onclick = onClick;
            return b;
        }

        window.openBreakEventModal = function(opts) {
            ctx = opts;
            const ev = opts.event;
            const dayInfo = calendarMap[opts.date];
            const weekday = new Date(opts.date + 'T12:00:00').getDay();
            const prettyDate = new Date(opts.date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

            document.getElementById('break-event-heading').textContent = ev ? 'Edit event' : 'Add event';
            document.getElementById('break-event-sub').textContent = opts.label + ' · ' + prettyDate;
            titleInput.value = ev?.title || '';
            locationInput.value = ev?.location || '';
            selectedColor = ev?.color || BREAK_EVENT_COLORS[0];
            renderColors();

            // Recurrence anchors come from the event when editing, otherwise from the viewed date.
            const anchorWeekday = ev && ev.repeat === 'weekly' ? ev.weekday : weekday;
            const anchorCycleDay = ev && ev.repeat === 'cycle' ? ev.cycleDay : dayInfo?.dayNumber;
            const anchorCycleLabel = ev && ev.repeat === 'cycle' ? ev.cycleLabel : dayInfo?.dayName;
            const options = [['none', "Doesn't repeat"], ['weekly', 'Every ' + BREAK_EVENT_WEEKDAYS[anchorWeekday]]];
            if (anchorCycleDay) options.push(['cycle', 'Every ' + (anchorCycleLabel || 'Day ' + anchorCycleDay) + ' (fortnightly)']);
            options.push(['daily', 'Every school day']);
            repeatSelect.innerHTML = options.map(([v, t]) => \`<option value="\${v}">\${_beEsc(t)}</option>\`).join('');
            repeatSelect.value = ev?.repeat || 'none';
            seriesNote.classList.toggle('hidden', !ev || ev.repeat === 'none');

            deleteGroup.innerHTML = '';
            if (ev) {
                if (ev.repeat !== 'none') {
                    deleteGroup.appendChild(deleteButton('Skip this day', () => {
                        saveBreakEvents(loadBreakEvents().map(x => x.id === ev.id ? { ...x, skip: [...(x.skip || []), opts.date] } : x));
                        afterChange();
                    }));
                }
                deleteGroup.appendChild(deleteButton(ev.repeat !== 'none' ? 'Delete all' : 'Delete', () => {
                    saveBreakEvents(loadBreakEvents().filter(x => x.id !== ev.id));
                    afterChange();
                }));
            }

            modal.classList.remove('hidden');
            requestAnimationFrame(() => {
                content.classList.remove('scale-95', 'opacity-0');
                content.classList.add('scale-100', 'opacity-100');
                titleInput.focus();
            });
        };

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            if (!ctx) return;
            const title = titleInput.value.trim();
            if (!title) return;
            const repeat = repeatSelect.value;
            const prev = ctx.event;
            const dayInfo = calendarMap[ctx.date];
            const keepAnchor = prev && prev.repeat === repeat;
            const next = {
                id: prev?.id || (Date.now().toString(36) + Math.random().toString(36).slice(2, 8)),
                period: ctx.period,
                title,
                location: locationInput.value.trim(),
                color: selectedColor,
                repeat,
                // Keep the series' original start when only details change; re-anchor to the viewed day otherwise.
                date: keepAnchor ? prev.date : ctx.date,
                weekday: keepAnchor && repeat === 'weekly' ? prev.weekday : new Date(ctx.date + 'T12:00:00').getDay(),
                cycleDay: keepAnchor && repeat === 'cycle' ? prev.cycleDay : (dayInfo?.dayNumber ?? null),
                cycleLabel: keepAnchor && repeat === 'cycle' ? prev.cycleLabel : (dayInfo?.dayName ?? null),
                skip: keepAnchor ? (prev.skip || []) : [],
            };
            const list = loadBreakEvents().filter(x => x.id !== next.id);
            list.push(next);
            saveBreakEvents(list);
            afterChange();
        });

        document.getElementById('break-event-close').addEventListener('click', close);
        modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.classList.contains('hidden')) close(); });
    })();
</script>
`
