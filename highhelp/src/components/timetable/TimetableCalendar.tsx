import { html } from 'hono/html'

export const TimetableCalendar = html`
<script>
    let calendarMonth = null;
    let calendarYear = null;

    function initCalendarMonth() {
        if (calendarMonth !== null) return;
        const d = new Date(currentDateStr + 'T12:00:00');
        calendarMonth = d.getMonth();
        calendarYear = d.getFullYear();
    }

    function getMonthDays(year, month) {
        return new Date(year, month + 1, 0).getDate();
    }

    function getFirstDayOfWeek(year, month) {
        const day = new Date(year, month, 1).getDay();
        return day === 0 ? 6 : day - 1;
    }

    function formatDateStr(y, m, d) {
        return y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    }

    function formatMonthYear(year, month) {
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        return months[month] + ' ' + year;
    }

    const calTypeColors = {
        school: { bg: 'bg-indigo-50 dark:bg-indigo-900/20', text: 'text-indigo-700 dark:text-indigo-300', dot: 'bg-indigo-500' },
        assessment: { bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-700 dark:text-red-300', dot: 'bg-red-500' },
        moodle: { bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-700 dark:text-orange-300', dot: 'bg-orange-500' },
        personal: { bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-700 dark:text-green-300', dot: 'bg-green-500' }
    };

    function isY11Event(item) {
        const title = (item.title || item.subject || '').toLowerCase();
        const desc = (item.description || '').toLowerCase();
        const combined = title + ' ' + desc;
        return combined.includes('year 11') || combined.includes('y11');
    }

    function ensureTooltip() {
        let tt = document.getElementById('cal-tooltip');
        if (!tt) {
            tt = document.createElement('div');
            tt.id = 'cal-tooltip';
            tt.className = 'fixed z-[999] max-w-[224px] p-2 bg-gray-800 dark:bg-neutral-950 text-white text-xs rounded-lg shadow-xl pointer-events-none opacity-0 transition-opacity duration-150';
            tt.style.display = 'none';
            document.body.appendChild(tt);
        }
        return tt;
    }

    function showTooltip(el, e) {
        const title = el.getAttribute('data-tip-title');
        const desc = el.getAttribute('data-tip-desc');
        if (!title && !desc) return;
        const tt = ensureTooltip();
        tt.innerHTML = (title ? '<div class="font-semibold mb-0.5">' + title + '</div>' : '') +
                       (desc ? '<div class="text-gray-300 dark:text-neutral-400 text-[11px] leading-relaxed">' + desc + '</div>' : '');
        tt.style.display = 'block';

        const r = el.getBoundingClientRect();
        let left = r.left;
        let top = r.bottom + 4;
        if (left + 224 > window.innerWidth) left = window.innerWidth - 228;
        if (left < 4) left = 4;
        if (top + 100 > window.innerHeight) top = r.top - 4 - tt.offsetHeight;
        tt.style.left = left + 'px';
        tt.style.top = top + 'px';
        tt.style.opacity = '1';
    }

    function hideTooltip() {
        const tt = document.getElementById('cal-tooltip');
        if (tt) { tt.style.opacity = '0'; tt.style.display = 'none'; }
    }

    async function renderCalendar() {
        initCalendarMonth();

        const url = new URL(window.location);
        url.searchParams.set('date', currentDateStr);
        window.history.replaceState({}, '', url);

        const container = document.getElementById('timetable-list');
        container.innerHTML = '<div class="text-center py-12 text-gray-500 dark:text-neutral-500">Loading calendar...</div>';

        document.getElementById('date-display').innerHTML = '<span class="font-bold text-gray-800 dark:text-neutral-200">' + formatMonthYear(calendarYear, calendarMonth) + '</span>';

        const monthStart = new Date(calendarYear, calendarMonth, 1);
        const monthEnd = new Date(calendarYear, calendarMonth + 1, 0);
        const fromStr = formatDateStr(calendarYear, calendarMonth, 1);
        const toStr = formatDateStr(calendarYear, calendarMonth, monthEnd.getDate());

        const snapshotDate = currentDateStr;
        const snapshotView = currentView;
        const snapMonth = calendarMonth;
        const snapYear = calendarYear;

        try {
            showLoadingBar();
            const res = await fetch('/api/proxy/events?date=' + fromStr + '&to=' + toStr, {
                headers: { 'Authorization': 'Bearer ' + studentData.accessToken }
            });
            if (!res.ok) throw new Error('Failed to fetch events');
            const data = await res.json();

            if (currentDateStr !== snapshotDate || currentView !== snapshotView || calendarMonth !== snapMonth || calendarYear !== snapYear) return;

            const eventsByDate = {};
            if (data && data.length > 0) {
                data.forEach(day => {
                    if (!day.items || day.items.length === 0) return;
                    const parts = day.info.date.split('/');
                    let isoDate = day.info.date;
                    if (parts.length === 3) {
                        isoDate = parts[2] + '-' + parts[1] + '-' + parts[0];
                    }
                    day.items.forEach(item => {
                        if (!isY11Event(item)) return;
                        if (!eventsByDate[isoDate]) eventsByDate[isoDate] = [];
                        eventsByDate[isoDate].push({
                            time: item.time || '',
                            title: item.title || item.subject || 'Event',
                            type: item.type || 'school',
                            description: item.description || ''
                        });
                    });
                });
            }

            const daysInMonth = getMonthDays(snapYear, snapMonth);
            const startOffset = getFirstDayOfWeek(snapYear, snapMonth);
            const todayStr = new Date().toISOString().split('T')[0];
            const dayHeaders = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

            let calHtml = '<div class="border border-gray-200 dark:border-neutral-700 rounded-xl bg-white dark:bg-neutral-800">';

            calHtml += '<div class="grid grid-cols-7 border-b border-gray-200 dark:border-neutral-700">';
            dayHeaders.forEach(h => {
                calHtml += '<div class="py-2 text-center text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-neutral-500 border-r border-gray-100 dark:border-neutral-700 last:border-r-0">' + h + '</div>';
            });
            calHtml += '</div>';

            calHtml += '<div class="grid grid-cols-7">';
            const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;

            for (let i = 0; i < totalCells; i++) {
                const dayNum = i - startOffset + 1;
                const isCurrentMonth = dayNum >= 1 && dayNum <= daysInMonth;
                const dateStr = isCurrentMonth ? formatDateStr(snapYear, snapMonth, dayNum) : '';
                const isToday = dateStr === todayStr;
                const dayEvents = isCurrentMonth && eventsByDate[dateStr] ? eventsByDate[dateStr] : [];
                const isWeekend = isCurrentMonth ? ((i % 7) >= 5) : false;

                let cellClass = 'border-r border-b border-gray-100 dark:border-neutral-700 last:border-r-0 min-h-[5rem] sm:min-h-[6.5rem] p-1.5';
                if (!isCurrentMonth) {
                    cellClass += ' bg-gray-50/50 dark:bg-neutral-900/30';
                } else if (isToday) {
                    cellClass += ' bg-red-50/50 dark:bg-red-900/10';
                } else if (isWeekend) {
                    cellClass += ' bg-gray-50/30 dark:bg-neutral-900/20';
                }

                calHtml += '<div class="' + cellClass + '">';

                if (isCurrentMonth) {
                    const numColor = isToday ? 'text-red-500 font-bold' : (isWeekend ? 'text-gray-400 dark:text-neutral-600' : 'text-gray-500 dark:text-neutral-500');
                    calHtml += '<div class="flex justify-end mb-1"><span class="text-[11px] font-medium ' + numColor + '">' + dayNum + '</span></div>';

                    dayEvents.forEach(evt => {
                        const tc = calTypeColors[evt.type] || calTypeColors.school;
                        const escTitle = evt.title.replace(/"/g, '&quot;');
                        const tipText = (evt.time ? evt.time + ' – ' : '') + (evt.description || '');
                        const escTip = tipText.replace(/"/g, '&quot;').replace(/</g, '&lt;');
                        calHtml += '<div class="' + tc.bg + ' rounded px-1 py-0.5 mb-0.5 cursor-default cal-evt" data-tip-title="' + escTitle + '" data-tip-desc="' + escTip + '">';
                        calHtml += '<div class="flex items-center gap-1">';
                        calHtml += '<span class="w-1 h-1 rounded-full ' + tc.dot + ' flex-shrink-0"></span>';
                        calHtml += '<span class="text-[10px] font-medium ' + tc.text + ' truncate">' + evt.title + '</span>';
                        calHtml += '</div></div>';
                    });
                }

                calHtml += '</div>';
            }

            calHtml += '</div></div>';

            const totalY11 = Object.values(eventsByDate).reduce((sum, arr) => sum + arr.length, 0);
            calHtml += '<div class="flex items-center justify-center gap-1.5 mt-3 pt-3 border-t border-gray-100 dark:border-neutral-800 text-[11px] text-gray-400 dark:text-neutral-500">';
            calHtml += totalY11 + ' Year 11 event' + (totalY11 !== 1 ? 's' : '') + ' this month';
            calHtml += '</div>';

            container.innerHTML = calHtml;

            container.querySelectorAll('.cal-evt').forEach(el => {
                el.addEventListener('mouseenter', function(e) { showTooltip(this, e); });
                el.addEventListener('mouseleave', hideTooltip);
            });

        } catch (e) {
            console.error(e);
            container.innerHTML = '<div class="text-center py-12 text-red-500 dark:text-red-400 font-medium">Error loading calendar.</div>';
        } finally {
            hideLoadingBar();
        }
    }

    function calendarPrevMonth() {
        calendarMonth--;
        if (calendarMonth < 0) { calendarMonth = 11; calendarYear--; }
        const midMonth = formatDateStr(calendarYear, calendarMonth, 15);
        currentDateStr = midMonth;
        renderCalendar();
    }

    function calendarNextMonth() {
        calendarMonth++;
        if (calendarMonth > 11) { calendarMonth = 0; calendarYear++; }
        const midMonth = formatDateStr(calendarYear, calendarMonth, 15);
        currentDateStr = midMonth;
        renderCalendar();
    }

    function resetCalendarMonth() {
        calendarMonth = null;
        calendarYear = null;
    }

    window.renderCalendar = renderCalendar;
    window.calendarPrevMonth = calendarPrevMonth;
    window.calendarNextMonth = calendarNextMonth;
    window.resetCalendarMonth = resetCalendarMonth;
</script>
`
