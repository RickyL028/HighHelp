import { html } from 'hono/html'

export const TimetableNotices = html`
<script>
    async function renderNotices() {
        const url = new URL(window.location);
        url.searchParams.set('date', currentDateStr);
        window.history.replaceState({}, '', url);

        const container = document.getElementById('timetable-list');
        container.className = '';
        container.innerHTML = '<div class="text-center py-12 text-gray-500 dark:text-neutral-500">Loading notices...</div>';

        const isPaperTheme = document.documentElement.classList.contains('paper');
        const displayDate = isPaperTheme ? paperDateFormat(currentDateStr) : currentDateStr;
        const displayTerm = isPaperTheme ? getTermLabel(currentDateStr).replace('[ ', '/ ').replace(']', '').replace(' Week ', ' \\u2022 Wk ') : getTermLabel(currentDateStr);
        document.getElementById('date-display').innerHTML = \`<span class="font-bold text-gray-800 dark:text-neutral-200">\${displayDate}\${displayTerm}</span>\`;
        const snapshotDate = currentDateStr;
        const snapshotView = currentView;

        try {
            showLoadingBar();
            const res = await fetch('/api/proxy/notices?date=' + currentDateStr, {
                headers: { 'Authorization': 'Bearer ' + studentData.accessToken }
            });
            if (!res.ok) throw new Error('Failed to fetch notices');

            const data = await res.json();

            if (currentDateStr !== snapshotDate || currentView !== snapshotView) return;

            container.innerHTML = '';

            if (!data.notices || data.notices.length === 0) {
                container.innerHTML = \`
                    <div class="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-neutral-600">
                        <svg class="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"></path></svg>
                        <p class="text-sm font-medium">No notices for this date.</p>
                    </div>
                \`;
                return;
            }

            data.notices.sort((a, b) => (b.relativeWeight || 0) - (a.relativeWeight || 0));

            // Group by date (all same date here, but structure for future week-view)
            const groups = {};
            const today = currentDateStr;
            groups[today] = data.notices;

            const seenNoticeIds = new Set();
            const orderedDates = Object.keys(groups).sort();

            orderedDates.forEach(dateStr => {
                const items = groups[dateStr];
                const d = new Date(dateStr + 'T12:00:00');
                const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getDay()];
                const day = d.getDate();
                const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()];

                container.insertAdjacentHTML('beforeend', \`
                    <div class="sticky top-0 z-10 bg-background/90 dark:bg-neutral-900/90 backdrop-blur-sm py-3 mb-2 border-b border-gray-200 dark:border-neutral-800">
                        <div class="flex items-baseline gap-2">
                            <span class="text-lg font-bold text-gray-900 dark:text-neutral-100">\${day}</span>
                            <span class="text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-neutral-500">\${month} · \${dayName}</span>
                        </div>
                    </div>
                \`);

                items.forEach((notice, idx) => {
                    const noticeKey = notice.title + notice.authorName + (notice.content || '').substring(0, 20);
                    if (seenNoticeIds.has(noticeKey) && idx > 0) return;
                    seenNoticeIds.add(noticeKey);

                    const weight = notice.relativeWeight || 0;
                    const barColor = weight > 0 ? '#ef4444' : (weight < 0 ? '#6b7280' : '#d1d5db');
                    const barWidth = weight > 0 ? '4px' : '2px';

                    const isMeeting = notice.isMeeting === 1 || notice.isMeeting === "1" || notice.isMeeting === true;
                    const displayYears = notice.displayYears ? \`<span class="text-[10px] px-2 py-0.5 bg-gray-100 dark:bg-neutral-800 rounded text-gray-500 dark:text-neutral-400 font-medium">\${notice.displayYears}</span>\` : '';

                    container.insertAdjacentHTML('beforeend', \`
                        <div class="relative pl-4 pb-5 group">
                            <div class="absolute left-[3px] top-2 bottom-0 w-px bg-gray-200 dark:bg-neutral-800 group-last:hidden"></div>
                            <div class="absolute left-0 top-2 w-[7px] h-[7px] rounded-full border-2 border-gray-300 dark:border-neutral-600 bg-background dark:bg-neutral-900"></div>
                            <div class="ml-3">
                                <div class="flex items-start justify-between gap-3">
                                    <h3 class="text-sm font-semibold text-gray-900 dark:text-neutral-100 leading-snug">
                                        \${notice.title}
                                        \${weight > 0 ? '<span class="inline-block w-1.5 h-1.5 rounded-full bg-red-500 ml-1.5 align-middle"></span>' : ''}
                                    </h3>
                                    \${displayYears}
                                </div>
                                <div class="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">
                                    \${notice.authorName}
                                    \${isMeeting && (notice.meetingTime || notice.meetingTimeParsed) ? ' · ' + (notice.meetingTime || notice.meetingTimeParsed) : ''}
                                </div>
                                \${notice.content ? \`<div class="mt-1.5 text-sm text-gray-600 dark:text-neutral-400 leading-relaxed line-clamp-3">\${notice.content}</div>\` : ''}
                                \${isMeeting && (notice.meetingTime || notice.meetingTimeParsed) ? \`
                                    <div class="mt-2 inline-flex items-center gap-1.5 text-[11px] font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-md">
                                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                        Meeting: \${notice.meetingTime || notice.meetingTimeParsed}
                                    </div>
                                \` : ''}
                            </div>
                        </div>
                    \`);
                });
            });
        } catch (e) {
            console.error(e);
            container.innerHTML = '<div class="text-center py-12 text-red-500 dark:text-red-400 font-medium"><a href="/login" class="underline">Log in again</a> to sync.</div>';
        } finally {
            hideLoadingBar();
        }
    }

    window.renderNotices = renderNotices;
</script>
`
