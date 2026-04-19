import { html } from 'hono/html'

export const TimetableEvents = html`
<script>
    async function renderEvents() {
        const url = new URL(window.location);
        url.searchParams.set('date', currentDateStr);
        window.history.replaceState({}, '', url);

        const container = document.getElementById('timetable-list');
        container.className = 'space-y-4';
        container.innerHTML = '<div class="text-center py-12 text-gray-500 dark:text-neutral-500">Loading events...</div>';

        document.getElementById('date-display').innerHTML = \`<span class="font-bold text-gray-800 dark:text-neutral-200" > \${ currentDateStr }</span > \`;
        const snapshotDate = currentDateStr;
        const snapshotView = currentView;

        try {
            const nextWeek = new Date(currentDateStr);
            nextWeek.setDate(nextWeek.getDate() + 7);
            const toDateStr = nextWeek.toISOString().split('T')[0];

            const res = await fetch('/api/proxy/events?date=' + currentDateStr + '&to=' + toDateStr, {
                headers: { 'Authorization': 'Bearer ' + studentData.accessToken }
            });
            if (!res.ok) throw new Error('Failed to fetch events');
            
            const data = await res.json();

            // If the user has changed view or date while we were fetching, Don't overwrite the DOM
            if (currentDateStr !== snapshotDate || currentView !== snapshotView) {
                return;
            }

            container.innerHTML = '';

            if (!data || data.length === 0) {
                container.innerHTML = '<div class="text-center py-12 text-gray-500 dark:text-neutral-500 font-medium">No events found.</div>';
                return;
            }

            let renderedAny = false;

            data.forEach(day => {
                if (!day.items || day.items.length === 0) return;
                
                renderedAny = true;
                const dateHeader = \`
                    <h3 class="font-bold text-gray-800 dark:text-neutral-200 mt-8 mb-4 border-b border-gray-200 dark:border-neutral-700 pb-2 text-lg">
                        \${day.info.date}
                    </h3>
                \`;
                container.insertAdjacentHTML('beforeend', dateHeader);

                day.items.forEach(item => {
                    const timeStr = item.time ? \`<span class="text-sm font-bold text-blue-600 dark:text-blue-400 min-w-[60px] inline-block mr-4">\${item.time}</span>\` : '<span class="min-w-[76px] inline-block mr-4"></span>';
                    
                    let dataHtml = '';
                    if (item.data) {
                        const location = item.data.displayVenue || item.data.venue || item.data.room || '';
                        if (location) {
                            dataHtml += \`<div class="text-xs text-gray-500 dark:text-neutral-400 mt-2 font-medium bg-gray-50 dark:bg-neutral-900/50 inline-block px-2 py-1 rounded">📍 \${location}</div>\`;
                        }
                    }

                    const typeColors = {
                        school: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 ring-indigo-500/10',
                        assessment: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 ring-red-500/10',
                        moodle: 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30 ring-orange-500/10',
                        personal: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 ring-green-500/10'
                    };
                    const typeColor = typeColors[item.type] || 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/30 ring-gray-500/10';

                    const html = \`
                        <div class="bg-white dark:bg-neutral-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-neutral-700 mb-3 hover:shadow-md transition-shadow group relative overflow-hidden">
                            <div class="absolute left-0 top-0 bottom-0 w-1 bg-gray-200 dark:bg-neutral-700"></div>
                            <div class="flex items-start pl-2">
                                <div class="flex items-center pt-0.5">
                                    \${timeStr}
                                </div>
                                <div class="flex-grow">
                                    <div class="flex justify-between items-start mb-1">
                                        <h4 class="font-bold text-gray-900 dark:text-white text-base">\${item.title || item.subject}</h4>
                                        <span class="text-[10px] px-2.5 py-1 rounded-full uppercase tracking-wider font-bold ring-1 ring-inset \${typeColor}">\${item.type}</span>
                                    </div>
                                    <div class="text-sm text-gray-600 dark:text-neutral-400 leading-relaxed max-w-2xl">\${item.description || ''}</div>
                                    \${dataHtml}
                                </div>
                            </div>
                        </div>
                    \`;
                    container.insertAdjacentHTML('beforeend', html);
                });
            });

            if (!renderedAny) {
                 container.innerHTML = '<div class="text-center py-12 text-gray-500 dark:text-neutral-500 font-medium">No events found in the upcoming week.</div>';
            }
        } catch (e) {
            console.error(e);
            container.innerHTML = '<div class="text-center py-12 text-red-500 dark:text-red-400 font-medium">Error loading events. Please check your authentication or try again later.</div>';
        }
    }
    
    window.renderEvents = renderEvents;
</script>
`
