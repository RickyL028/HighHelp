import { html } from 'hono/html'

export const TimetableNotices = html`
<script>
    async function renderNotices() {
        const url = new URL(window.location);
        url.searchParams.set('date', currentDateStr);
        window.history.replaceState({}, '', url);

        const container = document.getElementById('timetable-list');
        container.className = 'space-y-4';
        container.innerHTML = '<div class="text-center py-12 text-gray-500 dark:text-neutral-500">Loading notices...</div>';

        document.getElementById('date-display').innerHTML = \`<span class="font-bold text-gray-800 dark:text-neutral-200">\${currentDateStr}</span>\`;

        try {
            const res = await fetch('/api/proxy/notices?date=' + currentDateStr, {
                headers: { 'Authorization': 'Bearer ' + studentData.accessToken }
            });
            if (!res.ok) throw new Error('Failed to fetch notices');
            
            const data = await res.json();
            container.innerHTML = '';

            if (!data.notices || data.notices.length === 0) {
                container.innerHTML = '<div class="text-center py-12 text-gray-500 dark:text-neutral-500">No notices for this date.</div>';
                return;
            }

            data.notices.sort((a, b) => (b.relativeWeight || 0) - (a.relativeWeight || 0));

            data.notices.forEach(notice => {
                const isMeeting = notice.isMeeting === 1 || notice.isMeeting === "1" || notice.isMeeting === true;
                const weightIcon = notice.relativeWeight > 0 ? '<span class="text-red-500 ml-2 animate-pulse font-bold">!</span>' : '';
                
                let meetingInfo = '';
                if (isMeeting) {
                    meetingInfo = \`
                        <div class="mt-3 text-sm text-red-600 dark:text-red-400 font-medium bg-red-50 dark:bg-red-900/20 p-2 rounded border border-red-100 dark:border-red-900/30 inline-block">
                            Time: \${notice.meetingTime || notice.meetingTimeParsed}
                        </div>
                    \`;
                }

                const displayYears = notice.displayYears ? \`<span class="text-xs px-2 py-1 bg-gray-200 dark:bg-neutral-700 rounded text-gray-700 dark:text-neutral-300 font-medium">\${notice.displayYears}</span>\` : '';
                
                const html = \`
                    <div class="bg-white dark:bg-neutral-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-neutral-700 transition-all hover:shadow-md">
                        <div class="flex justify-between items-start mb-3">
                            <h3 class="font-bold text-gray-900 dark:text-white text-lg">\${notice.title} \${weightIcon}</h3>
                            \${displayYears}
                        </div>
                        <div class="text-sm text-gray-500 dark:text-neutral-400 mb-4 pb-3 border-b border-gray-100 dark:border-neutral-700">
                            From: <span class="font-medium text-gray-700 dark:text-neutral-300">\${notice.authorName}</span>
                        </div>
                        <div class="prose dark:prose-invert max-w-none text-sm text-gray-700 dark:text-neutral-300 leading-relaxed">
                            \${notice.content}
                        </div>
                        \${meetingInfo}
                    </div>
                \`;
                container.insertAdjacentHTML('beforeend', html);
            });
        } catch (e) {
            console.error(e);
            container.innerHTML = '<div class="text-center py-12 text-red-500 dark:text-red-400 font-medium"><a href="/login" class="underline">Log in again</a> to sync.</div>';
        }
    }
    
    window.renderNotices = renderNotices;
</script>
`
