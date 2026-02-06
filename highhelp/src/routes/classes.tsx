import { Hono } from 'hono'
import { Layout } from '../layout'
import { getUser } from '../utils'
import { Bindings } from '../types'
import { html } from 'hono/html'

const app = new Hono<{ Bindings: Bindings }>()

app.get('/', async (c) => {
    const user = await getUser(c)

    return c.html(
        <Layout title="Classes" user={user}>
            <div class="max-w-4xl mx-auto py-6" id="app-container">
                {/* Loader */}
                <div id="loader" class="text-center py-12">
                    <p class="text-gray-500">Loading timetable...</p>
                </div>

                {/* Content (Hidden initially) */}
                <div id="content" class="hidden">

                    {/* Tabs */}
                    <div class="flex border-b border-gray-200 mb-6">
                        <button class="flex items-center gap-2 px-4 py-2 border-b-2 border-red-500 text-red-500 font-medium text-sm focus:outline-none">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                            Day
                        </button>
                        <button class="flex items-center gap-2 px-4 py-2 border-b-2 border-transparent text-gray-500 hover:text-gray-700 font-medium text-sm focus:outline-none">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>
                            Cycle
                        </button>
                    </div>

                    {/* Header Control Bar */}
                    <div class="flex items-center gap-2 mb-6">
                        {/* Prev Button */}
                        <button id="btn-prev" class="w-10 h-10 flex items-center justify-center rounded-lg border border-red-500 text-red-500 hover:bg-red-50 transition-colors">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                        </button>

                        {/* Date Display */}
                        <div class="flex-grow flex items-center justify-center border border-gray-200 rounded-lg h-10 bg-white shadow-sm px-4">
                            <span id="date-display" class="font-bold text-gray-800 text-sm"></span>
                        </div>

                        {/* Reset Button */}
                        <button id="btn-reset" class="h-10 px-4 flex items-center justify-center rounded-lg border border-red-500 text-red-500 font-medium text-sm hover:bg-red-50 transition-colors">
                            Reset
                        </button>

                        {/* Next Button */}
                        <button id="btn-next" class="w-10 h-10 flex items-center justify-center rounded-lg border border-red-500 text-red-500 hover:bg-red-50 transition-colors">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                        </button>
                    </div>

                    {/* Timetable List List */}
                    <div id="timetable-list" class="space-y-4">
                        {/* Dynamic Content */}
                    </div>
                </div>

                <div id="error-msg" class="hidden text-center py-12 text-red-500"></div>

                <script dangerouslySetInnerHTML={{
                    __html: `
                    (function() {
                        const BELL_TIMES = [
                            { period: "0", startTime: "08:00", endTime: "08:50", label: "Period 0" },
                            { period: "RC", startTime: "08:50", endTime: "08:57", label: "Roll Call" },
                            { period: "1", startTime: "09:00", endTime: "10:00", label: "Period 1" },
                            { period: "2", startTime: "10:05", endTime: "11:05", label: "Period 2" },
                            { period: "R", startTime: "11:05", endTime: "11:22", label: "Recess" },
                            { period: "3", startTime: "11:25", endTime: "12:25", label: "Period 3" },
                            { period: "L1", startTime: "12:25", endTime: "12:45", label: "Lunch 1" },
                            { period: "L2", startTime: "12:45", endTime: "13:02", label: "Lunch 2" },
                            { period: "4", startTime: "13:05", endTime: "14:05", label: "Period 4" },
                            { period: "5", startTime: "14:10", endTime: "15:10", label: "Period 5" },
                            { period: "EoD", startTime: "15:10", endTime: "23:59", label: "End of Day" }
                        ];

                        let studentData = null;
                        try {
                            const raw = localStorage.getItem('studentData');
                            if (raw) studentData = JSON.parse(raw);
                        } catch(e) { console.error(e); }

                        if (!studentData || !studentData.timetable || !studentData.calendar) {
                            document.getElementById('loader').classList.add('hidden');
                            const err = document.getElementById('error-msg');
                            err.classList.remove('hidden');
                            err.innerHTML = 'Timetable data not found. Please <a href="/api/auth/login" class="underline">Log in again</a> to sync.';
                            return;
                        }

                        // Parse Calendar Mapping
                        // The structure is { "2026-02-03": { dayNumber: "2", dayName: "TueA", ... } }
                        const calendarMap = studentData.calendar; 
                        // Note: Depending on API, it might be nested under 'days' or direct. 
                        // Based on apioutput.txt/calendar/days.json, it seems to be flattened or slightly different. 
                        // Step 8 shows: "2026-02-03": {...} (Direct object keys?)
                        // Wait, Step 8 shows: { "2026-02-03": { ... } } 
                        // Code in Auth was: fetch(...days.json). So it matches that structure.
                        
                        // Parse Timetable Mapping
                        // studentData.timetable has { student: {}, subjects: [], days: { "1": {...}, "2": {...} } }
                        const daysData = studentData.timetable.days || {};
                        const subjectsData = studentData.timetable.subjects || [];

                        // Helper to find subject color/details
                        function enrichPeriod(periodObj) {
                            if (!periodObj) return null;
                            // Search subject list for color/teacher if missing in period
                            // In apioutput.txt, period has: { title: "PHY 1", teacher: "HOOM", room: "304" ... }
                            // Subject list has: { shortcut: "PHY 1", ... colour: "2ee8d7" }
                            // Actually subjects structure: { title: "11 Physics 1", shortTitle: "PHY 1", teacher: "HOOM", colour: "2ee8d7" ... }
                            
                            // Try to find matching subject
                            const subj = subjectsData.find(s => 
                                (s.shortTitle && s.shortTitle === periodObj.title) || 
                                (s.title && s.title === periodObj.title) ||
                                (s.subject && s.subject === periodObj.title) 
                            );

                            return {
                                ...periodObj,
                                color: subj ? subj.colour : periodObj.colour || periodObj.color || 'e5e7eb',
                                fullTeacher: subj ? subj.fullTeacher : periodObj.fullTeacher || periodObj.teacher
                            };
                        }

                        // State
                        let currentDateStr = new URLSearchParams(window.location.search).get('date') || getInitialDate();

                        function getInitialDate() {
                            const now = new Date();
                            const isAfterSchool = (now.getHours() > 15) || (now.getHours() === 15 && now.getMinutes() >= 10);
                            
                            if (isAfterSchool) {
                                // Next day logic
                                now.setDate(now.getDate() + 1);
                            }
                             const year = now.getFullYear();
                             const month = String(now.getMonth() + 1).padStart(2, '0');
                             const day = String(now.getDate()).padStart(2, '0');
                             return \`\${year}-\${month}-\${day}\`;
                        }

                        function render() {
                            // Update URL without reload
                            const url = new URL(window.location);
                            url.searchParams.set('date', currentDateStr);
                            window.history.replaceState({}, '', url);

                            // Find Day Info
                            const dayInfo = calendarMap[currentDateStr];
                            const dayNumber = dayInfo ? dayInfo.dayNumber : null;
                            
                            // Day Header
                            const d = new Date(currentDateStr);
                            const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                            const dayName = days[d.getDay()];
                            const day = d.getDate().toString().padStart(2, '0');
                            const month = (d.getMonth() + 1).toString().padStart(2, '0');
                            const year = d.getFullYear();
                            const dateFormatted = \`\${dayName}, \${day}/\${month}/\${year}\`;
                            
                            document.getElementById('date-display').textContent = \`\${dateFormatted} \${dayInfo ? '(' + dayInfo.dayName + ')' : ''}\`;

                            // Timetable List
                            const container = document.getElementById('timetable-list');
                            container.innerHTML = '';

                            if (!dayNumber || !daysData[dayNumber]) {
                                container.innerHTML = '<div class="text-center py-12 text-gray-500">No classes scheduled for this day.</div>';
                                return;
                            }

                            const dailyRoutine = daysData[dayNumber];
                             // dailyRoutine has: { dayname: "MonA", routine: "...", rollcall: {...}, periods: { "1": {...} } }

                            BELL_TIMES.forEach(bell => {
                                let data = null;
                                if (bell.period === 'RC') {
                                    data = dailyRoutine.rollcall;
                                } else {
                                    data = dailyRoutine.periods[bell.period];
                                }

                                if (data) {
                                  data = enrichPeriod(data);
                                }

                                const hasContent = !!data;
                                const stripColor = data?.color ? \`#\${data.color}\` : '#e5e7eb';

                                const html = \`
                                    <div class="flex items-center min-h-[3rem]">
                                        <div class="w-24 text-right pr-6 text-sm text-gray-500 font-medium">
                                            \${formatTime(bell.startTime)}
                                        </div>
                                        <div class="flex-grow">
                                            \${hasContent ? \`
                                                <div class="relative flex items-center justify-between bg-gray-100 rounded-lg p-3 shadow-sm hover:bg-gray-50 transition-colors">
                                                    <div class="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-lg" style="background-color: \${stripColor};"></div>
                                                    <div class="pl-3 font-medium text-gray-900 text-sm">
                                                        \${data.title || data.subject || 'Unknown'}
                                                    </div>
                                                    <div class="flex items-center gap-4 text-sm">
                                                        <span class="text-gray-900">\${data.fullTeacher || data.teacher || ''}</span>
                                                        \${data.room ? \`<span class="font-bold text-black">\${data.room}</span>\` : ''}
                                                    </div>
                                                </div>
                                            \` : \`
                                                <div class="pl-2 text-gray-400 text-sm">
                                                    \${bell.label}
                                                </div>
                                            \`}
                                        </div>
                                    </div>
                                \`;
                                container.insertAdjacentHTML('beforeend', html);
                            });
                        }

                        function formatTime(t) {
                            if (!t) return '';
                            const [h, m] = t.split(':').map(Number);
                            const suffix = h >= 12 ? 'PM' : 'AM';
                            const h12 = h % 12 || 12;
                            return \`\${h12}:\${m.toString().padStart(2, '0')} \${suffix}\`;
                        }

                        function changeDate(delta) {
                            const d = new Date(currentDateStr);
                            d.setDate(d.getDate() + delta);
                            const year = d.getFullYear();
                            const month = String(d.getMonth() + 1).padStart(2, '0');
                            const day = String(d.getDate()).padStart(2, '0');
                            currentDateStr = \`\${year}-\${month}-\${day}\`;
                            render();
                        }

                        // Determine Date Logic (Previous/Next in calendar)
                        // Using simple date addition for now as per original request to handle dates
                        // Ideally we'd skip weekends based on calendarMap keys
                        function findNextSchoolDay(currentStr, limit=30) {
                           // Search forward in calendarMap
                           // But calendarMap keys are unsorted or string based.
                           // Simplest is to just iterate +1 day until found
                           let d = new Date(currentStr);
                           for(let i=0; i<limit; i++) {
                               d.setDate(d.getDate() + 1);
                               const s = d.toISOString().split('T')[0];
                               if (calendarMap[s]) return s;
                           }
                           return null;
                        }
                         function findPrevSchoolDay(currentStr, limit=30) {
                           let d = new Date(currentStr);
                           for(let i=0; i<limit; i++) {
                               d.setDate(d.getDate() - 1);
                               const s = d.toISOString().split('T')[0];
                               if (calendarMap[s]) return s;
                           }
                           return null;
                        }


                        // Event Listeners
                        document.getElementById('btn-prev').onclick = () => {
                             // Try to match simple date decrement for UX smoothness, or "Strict School Day"
                             // Let's stick to simple date decrement but verify if it exists in calendarMap?
                             // Original code checked 'dates' array.
                             // Let's replicate simple date decrement
                             changeDate(-1);
                        };
                        document.getElementById('btn-next').onclick = () => changeDate(1);
                        document.getElementById('btn-reset').onclick = () => {
                            currentDateStr = getInitialDate();
                            render();
                        };

                        // Init
                        document.getElementById('loader').classList.add('hidden');
                        document.getElementById('content').classList.remove('hidden');
                        render();

                    })();
                    `
                }}></script>
            </div>
        </Layout>
    )
})

export default app
