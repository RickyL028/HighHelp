import { html } from 'hono/html'

export const TimetableEvents = html`
<script>
    function getWeekStart(dateStr) {
        const d = new Date(dateStr + 'T12:00:00');
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        d.setDate(diff);
        return d;
    }

    function formatWeekRange(start) {
        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const sMon = months[start.getMonth()];
        const eMon = months[end.getMonth()];
        if (sMon === eMon) {
            return sMon + ' ' + start.getDate() + ' – ' + end.getDate();
        }
        return sMon + ' ' + start.getDate() + ' – ' + eMon + ' ' + end.getDate();
    }

    function toDateStr(d) {
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    function parseApiDate(apiDateStr) {
        const parts = apiDateStr.split('/');
        if (parts.length === 3) {
            const d = new Date(parts[2] + '-' + parts[1] + '-' + parts[0] + 'T12:00:00');
            return toDateStr(d);
        }
        return apiDateStr;
    }

    const typeColors = {
        school: { badge: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300', dot: 'bg-indigo-500' },
        assessment: { badge: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-300', dot: 'bg-red-500' },
        moodle: { badge: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-300', dot: 'bg-orange-500' },
        personal: { badge: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-300', dot: 'bg-green-500' }
    };

    async function renderEvents() {
        const url = new URL(window.location);
        url.searchParams.set('date', currentDateStr);
        window.history.replaceState({}, '', url);

        const container = document.getElementById('timetable-list');
        container.innerHTML = '<div class="text-center py-12 text-gray-500 dark:text-neutral-500">Loading events...</div>';

        const weekStart = getWeekStart(currentDateStr);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);

        const fromStr = toDateStr(weekStart);
        const toStr = toDateStr(weekEnd);

        document.getElementById('date-display').innerHTML = \`<span class="font-bold text-gray-800 dark:text-neutral-200">\${formatWeekRange(weekStart)}\${getTermLabel(fromStr)}</span>\`;

        const snapshotDate = currentDateStr;
        const snapshotView = currentView;

        try {
            showLoadingBar();
            const res = await fetch('/api/proxy/events?date=' + fromStr + '&to=' + toStr, {
                headers: { 'Authorization': 'Bearer ' + studentData.accessToken }
            });
            if (!res.ok) throw new Error('Failed to fetch events');

            const data = await res.json();
            if (currentDateStr !== snapshotDate || currentView !== snapshotView) return;

            container.innerHTML = '';

            if (!data || data.length === 0) {
                container.innerHTML = \`
                    <div class="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-neutral-600">
                        <svg class="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                        <p class="text-sm font-medium">No events this week.</p>
                    </div>
                \`;
                return;
            }

            // Build flat list of events with day info
            const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const rows = [];
            const todayStr2 = new Date().toISOString().split('T')[0];

            data.forEach(day => {
                const isoDate = parseApiDate(day.info.date);
                const d = new Date(isoDate + 'T12:00:00');
                const dayLabel = dayLabels[d.getDay()];
                const dayNum = d.getDate();
                const isToday = isoDate === todayStr2;
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;

                if (!day.items || day.items.length === 0) return;

                day.items.forEach((item, idx) => {
                    const type = item.type || 'school';
                    const tc = typeColors[type] || typeColors.school;

                    let location = '';
                    if (item.data) {
                        location = item.data.displayVenue || item.data.venue || item.data.room || '';
                    }

                    rows.push({
                        isoDate,
                        dayLabel,
                        dayNum,
                        isToday,
                        isWeekend,
                        isFirst: idx === 0,
                        timeLabel: item.time || '',
                        title: item.title || item.subject || 'Event',
                        type,
                        tc,
                        location,
                        description: item.description || ''
                    });
                });
            });

            if (rows.length === 0) {
                container.innerHTML = \`
                    <div class="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-neutral-600">
                        <svg class="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                        <p class="text-sm font-medium">No events this week.</p>
                    </div>
                \`;
                return;
            }

            // Render vertical table
            let html = '<div class="overflow-x-auto -mx-4 px-4"><table class="w-full text-sm">';

            // Header
            html += '<thead><tr class="border-b border-gray-200 dark:border-neutral-800">';
            html += '<th class="text-left py-2.5 pr-3 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-neutral-500 w-20">Day</th>';
            html += '<th class="text-left py-2.5 pr-3 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-neutral-500 w-16">Time</th>';
            html += '<th class="text-left py-2.5 pr-3 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-neutral-500">Event</th>';
            html += '<th class="text-left py-2.5 pr-3 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-neutral-500 w-20">Type</th>';
            html += '<th class="text-left py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-neutral-500 w-24">Location</th>';
            html += '</tr></thead><tbody>';

            rows.forEach((r, idx) => {
                const prev = idx > 0 ? rows[idx - 1] : null;
                const showDayHeader = !prev || prev.isoDate !== r.isoDate;
                const isLast = idx === rows.length - 1;

                html += \`<tr class="\${showDayHeader ? 'border-t border-gray-100 dark:border-neutral-800' : ''} \${r.isToday ? 'bg-red-50/40 dark:bg-red-900/10' : ''} \${!isLast ? 'border-b border-gray-50 dark:border-neutral-800/50' : ''} hover:bg-gray-50/50 dark:hover:bg-neutral-900/30 transition-colors">\`;

                // Day column
                if (showDayHeader) {
                    html += \`
                        <td class="py-2.5 pr-3 align-top" rowspan="\${rows.filter(r2 => r2.isoDate === r.isoDate).length}">
                            <div class="flex flex-col">
                                <span class="text-[10px] font-medium uppercase tracking-wider \${r.isToday ? 'text-red-500' : 'text-gray-400 dark:text-neutral-500'}">\${r.dayLabel}</span>
                                <span class="text-lg font-bold \${r.isToday ? 'text-red-500' : 'text-gray-800 dark:text-neutral-200'} leading-none mt-0.5">\${r.dayNum}</span>
                            </div>
                        </td>
                    \`;
                }

                // Time column
                html += \`<td class="py-2.5 pr-3 align-top"><span class="text-xs font-medium text-gray-700 dark:text-neutral-300 whitespace-nowrap">\${r.timeLabel || '—'}</span></td>\`;

                // Event column
                html += \`<td class="py-2.5 pr-3 align-top">
                    <div class="group relative">
                        <div class="flex items-center gap-1.5">
                            <span class="w-1.5 h-1.5 rounded-full \${r.tc.dot} flex-shrink-0"></span>
                            <span class="text-xs font-semibold text-gray-800 dark:text-neutral-200">\${r.title}</span>
                        </div>
                        \${r.description ? \`
                            <div class="hidden group-hover:block absolute z-20 left-0 top-full mt-1 w-64 p-2.5 bg-gray-800 dark:bg-neutral-950 text-white text-xs rounded-lg shadow-xl pointer-events-none">
                                <div class="font-semibold mb-1">\${r.title}</div>
                                <div class="text-gray-300 dark:text-neutral-400 leading-relaxed">\${r.description}</div>
                            </div>
                        \` : ''}
                    </div>
                </td>\`;

                // Type column
                html += \`<td class="py-2.5 pr-3 align-top"><span class="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded \${r.tc.badge}">\${r.type}</span></td>\`;

                // Location column
                html += \`<td class="py-2.5 align-top"><span class="text-xs text-gray-500 dark:text-neutral-400">\${r.location || '—'}</span></td>\`;

                html += '</tr>';
            });

            html += '</tbody></table></div>';

            // Summary footer
            const totalEvents = rows.length;
            const typeCounts = {};
            rows.forEach(r => { typeCounts[r.type] = (typeCounts[r.type] || 0) + 1; });
            const typeLabels = { school: 'School', assessment: 'Assessment', moodle: 'Moodle', personal: 'Personal' };
            const typeSummary = Object.entries(typeCounts)
                .map(([t, c]) => \`<span class="\${typeColors[t] ? typeColors[t].badge : 'text-gray-500'}">\${c} \${typeLabels[t] || t}</span>\`)
                .join('<span class="text-gray-300 dark:text-neutral-700 mx-1.5">·</span>');

            html += \`
                <div class="flex items-center justify-center gap-1.5 mt-4 pt-3 border-t border-gray-100 dark:border-neutral-800 text-[11px] text-gray-400 dark:text-neutral-500">
                    \${totalEvents} event\${totalEvents !== 1 ? 's' : ''}
                    <span class="text-gray-300 dark:text-neutral-700">·</span>
                    \${typeSummary}
                </div>
            \`;

            container.innerHTML = html;

        } catch (e) {
            console.error(e);
            container.innerHTML = '<div class="text-center py-12 text-red-500 dark:text-red-400 font-medium">Error loading events.</div>';
        } finally {
            hideLoadingBar();
        }
    }

    window.renderEvents = renderEvents;
</script>
`
