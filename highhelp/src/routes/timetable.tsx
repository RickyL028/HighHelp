import { Hono } from 'hono'
import { Layout } from '../layout'
import { getUser } from '../utils'
import { Bindings } from '../types'
import { html } from 'hono/html'

const app = new Hono<{ Bindings: Bindings }>()

app.get('/', async (c) => {
    const user = await getUser(c)
    if (!user) return c.redirect('/login')

    return c.html(
        <Layout title="Classes" user={user}>
            <div class="max-w-4xl mx-auto py-6" id="app-container">
                {/* Progress Bar */}
                <div id="daily-progress-bar" class="fixed left-0 top-0 h-full w-1.5 bg-gray-200 z-50 hidden transition-all duration-500 ease-in-out origin-top"></div>

                {/* Loader */}
                <div id="loader" class="text-center py-12">
                    <p class="text-gray-500">Loading timetable...</p>
                </div>

                {/* Content (Hidden initially) */}
                <div id="content" class="hidden">

                    {/* Tabs */}
                    <div class="flex border-b border-gray-200 mb-6">
                        <button id="tab-day" class="flex items-center gap-2 px-4 py-2 border-b-2 border-red-500 text-red-500 font-medium text-sm focus:outline-none transition-colors">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                            Day
                        </button>
                        <button id="tab-cycle" class="flex items-center gap-2 px-4 py-2 border-b-2 border-transparent text-gray-500 hover:text-gray-700 font-medium text-sm focus:outline-none transition-colors">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>
                            Cycle
                        </button>
                    </div>


                    {/* Big Timer */}
                    <div id="big-timer-display" class="mb-6 bg-gradient-to-br from-white-900 to-white-800 rounded-2xl p-6 text-black shadow-2xl transform transition-all relative overflow-hidden hidden">
                        <div class="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full -mr-10 -mt-10 blur-2xl"></div>
                        <div class="absolute bottom-0 left-0 w-24 h-24 bg-red-500 opacity-10 rounded-full -ml-10 -mb-10 blur-xl"></div>

                        <div class="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                            <div class="text-center md:text-left min-w-0">
                                <h2 class="text-gray-400 text-sm font-bold uppercase tracking-widest mb-1">Next</h2>
                                <div id="bt-subject" class="text-2xl font-bold truncate">Checking...</div>
                                <div id="bt-details" class="text-sm text-gray-400 mt-1 flex items-center gap-2 justify-center md:justify-start"></div>
                            </div>

                            <div class="text-center whitespace-nowrap">
                                <div id="bt-timer" class="text-5xl md:text-6xl font-mono font-bold tracking-tighter tabular-nums leading-none">--:--:--</div>
                                <div id="bt-label" class="text-xs text-red-400 font-bold mt-2 uppercase tracking-wide">Until Start</div>
                            </div>
                        </div>
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
                        const DEFAULT_BELL_TIMES = [
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

                        // Data mappings for static/cycle view
                        const calendarMap = studentData.calendar; 
                        const daysData = studentData.timetable.days || {};
                        const subjectsData = studentData.timetable.subjects || [];

                        // State
                        let currentDateStr = new URLSearchParams(window.location.search).get('date') || getInitialDate();
                        let currentView = 'day'; // 'day' or 'cycle'
                        let tickerInterval = null;
                        let hoveredPeriodData = null;

                        function getInitialDate() {
                            const now = new Date();
                            const isAfterSchool = (now.getHours() > 15) || (now.getHours() === 15 && now.getMinutes() >= 10);
                            
                            if (isAfterSchool) {
                                now.setDate(now.getDate() + 1);
                            }
                            // Ensure not weekend initially
                            if (now.getDay() === 0) now.setDate(now.getDate() + 1); // Sun -> Mon
                            if (now.getDay() === 6) now.setDate(now.getDate() + 2); // Sat -> Mon

                             const year = now.getFullYear();
                             const month = String(now.getMonth() + 1).padStart(2, '0');
                             const day = String(now.getDate()).padStart(2, '0');
                             return \`\${year}-\${month}-\${day}\`;
                        }

                        function enrichPeriod(periodObj) {
                            if (!periodObj) return null;
                            const subj = subjectsData.find(s => 
                                (s.shortTitle && s.shortTitle === periodObj.title) || 
                                (s.title && s.title === periodObj.title) ||
                                (s.subject && s.subject === periodObj.title) 
                            );

                            return {
                                ...periodObj,
                                color: subj ? subj.colour : periodObj.colour || periodObj.color || 'e5e7eb',
                                fullTeacher: subj ? subj.fullTeacher : periodObj.fullTeacher || periodObj.teacher,
                                subjectCode: subj ? (subj.shortTitle || subj.title) : (periodObj.title || 'Unknown')
                            };
                        }

                        async function fetchDayData(date) {
                            if (!studentData.accessToken) {
                                console.warn('No access token available for live refresh');
                                return null;
                            }

                            // Check cache first (synced by layout.tsx or previous visits)
                            const cached = localStorage.getItem('todayData_' + date);
                            if (cached) {
                                try {
                                    return JSON.parse(cached);
                                } catch(e) { console.error('Cache parse error', e); }
                            }

                            try {
                                const res = await fetch(\`/api/proxy/day-data?date=\${date}\`, {
                                    headers: { 'Authorization': \`Bearer \${studentData.accessToken}\` }
                                });
                                if (res.ok) {
                                    const data = await res.json();
                                    if (data && data.status === 'OK') {
                                        localStorage.setItem('todayData_' + date, JSON.stringify(data));
                                    }
                                    return data;
                                }
                                console.error('Failed to fetch day data', res.status);
                                return null;
                            } catch(e) {
                                console.error(e);
                                return null;
                            }
                        }

                        // Listen for global refreshes that might happen while we are viewing "today"
                        window.addEventListener('todayDataRefreshed', (e) => {
                            if (e.detail.date === currentDateStr) {
                                console.log('Today data updated via global sync, re-rendering...');
                                render();
                            }
                        });

                        function render() {
                            // Update Tab UI
                            const tabDay = document.getElementById('tab-day');
                            const tabCycle = document.getElementById('tab-cycle');
                            const headerControls = document.querySelector('#content > .flex.items-center.gap-2.mb-6');

                            if (currentView === 'day') {
                                tabDay.classList.add('border-red-500', 'text-red-500');
                                tabDay.classList.remove('border-transparent', 'text-gray-500');
                                tabCycle.classList.remove('border-red-500', 'text-red-500');
                                tabCycle.classList.add('border-transparent', 'text-gray-500');
                                
                                headerControls.classList.remove('hidden');
                                renderDay();
                            } else {
                                tabCycle.classList.add('border-red-500', 'text-red-500');
                                tabCycle.classList.remove('border-transparent', 'text-gray-500');
                                tabDay.classList.remove('border-red-500', 'text-red-500');
                                tabDay.classList.add('border-transparent', 'text-gray-500');
                                
                                headerControls.classList.add('hidden');
                                renderCycle();
                            }
                        }

                        async function renderDay() {
                            // Update URL
                            const url = new URL(window.location);
                            url.searchParams.set('date', currentDateStr);
                            window.history.replaceState({}, '', url);

                            const dayInfo = calendarMap[currentDateStr];
                            // Day Header
                            const d = new Date(currentDateStr);
                            const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                            const dayName = days[d.getDay()];
                            const day = d.getDate().toString().padStart(2, '0');
                            const month = (d.getMonth() + 1).toString().padStart(2, '0');
                            const year = d.getFullYear();
                            const dateFormatted = \`\${dayName}, \${day}/\${month}/\${year}\`;
                            
                            // Date Picker Injection
                            const dateDisplay = document.getElementById('date-display');
                            dateDisplay.innerHTML = \`
                                <div class="relative cursor-pointer group flex items-center gap-2">
                                    <span class="z-10 bg-transparent">\${dateFormatted} \${dayInfo ? ' [' + dayInfo.dayName[dayInfo.dayName.length - 1] + ']' : ''}</span>
                                    <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                    <input type="date" id="date-picker-input" 
                                           class="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-20"
                                           value="\${currentDateStr}">
                                </div>
                            \`;
                            // Attach listener
                            const picker = document.getElementById('date-picker-input');
                            if(picker) {
                                picker.onchange = (e) => {
                                    currentDateStr = e.target.value;
                                    render();
                                };
                            }

                            const container = document.getElementById('timetable-list');
                            container.innerHTML = '<div class="text-center py-12 text-gray-500">Checking for updates...</div>';
                            container.className = 'space-y-4';

                            // Fetch Live Data
                            const apiData = await fetchDayData(currentDateStr);

                            container.innerHTML = '';
                            
                            if (!apiData && (!dayInfo || !daysData[dayInfo.dayNumber])) {
                                container.innerHTML = '<div class="text-center py-12 text-gray-500">No classes scheduled for this day (and cannot fetch live data).</div>';
                                return;
                            }

                            // Prepare Data Sources
                            let periodsData = {};
                            let currentBellTimes = DEFAULT_BELL_TIMES;
                            let dayVariations = {};

                            if (apiData) {
                                // Dynamic bells from API
                                if (apiData.bells && apiData.bells.length > 0) {
                                    currentBellTimes = apiData.bells.map(b => ({
                                        period: b.period || b.bell, // Use period as ID
                                        startTime: b.startTime,
                                        endTime: b.endTime || '23:59',
                                        label: b.bellDisplay || b.bell || b.period
                                    }));
                                }
                                
                                // Periods
                                if (apiData.timetable && apiData.timetable.timetable && apiData.timetable.timetable.periods) {
                                    periodsData = apiData.timetable.timetable.periods;
                                }

                                // Variations
                                if (apiData.classVariations) {
                                    dayVariations = apiData.classVariations;
                                }
                            } else {
                                // Fallback to Static Data
                                if (dayInfo && daysData[dayInfo.dayNumber]) {
                                    const dr = daysData[dayInfo.dayNumber];
                                    periodsData = { ...dr.periods };
                                    if (dr.rollcall) periodsData['RC'] = dr.rollcall;
                                }
                            }
                            
                            currentBellTimes.forEach(bell => {
                                const pKey = bell.period; // e.g. "1", "RC"
                                let data = periodsData[pKey];
                                let variation = dayVariations[pKey];
                                
                                if (data) data = enrichPeriod(data);

                                let highlightChange = false;
                                let variationTags = [];

                                if (variation && variation.type !== 'novariation') {
                                    highlightChange = true;
                                    variationTags.push('CHANGED');
                                    
                                    if (!data) {
                                        // If no previous class, it's a new one (maybe?) or just filling in
                                        data = { title: variation.title || 'Variation', teacher: variation.teacher };
                                    }

                                    // Override fields
                                    if (variation.title) data.title = variation.title;
                                    
                                    if (variation.casualSurname) {
                                        data.fullTeacher = variation.casualSurname;
                                        data.teacher = variation.casual || variation.casualSurname;
                                        variationTags.push('Cover: ' + variation.casualSurname);
                                    } else if (variation.teacher && variation.teacher !== data.teacher) {
                                        data.teacher = variation.teacher;
                                    }

                                    if (variation.roomTo && variation.roomTo !== data.room) {
                                        data.room = variation.roomTo;
                                        variationTags.push('Room Change');
                                    }
                                    
                                    // Re-enrich to catch colors if subject code matched new title
                                    data = enrichPeriod(data);
                                }

                                const hasContent = !!data && (!!data.title || !!data.subject);
                                const stripColor = data?.color ? \`#\${data.color}\` : '#e5e7eb';
                                
                                // Reduce space for non-class periods
                                const isMinorPeriod = !hasContent || bell.period === 'R' || bell.period === 'L1' || bell.period === 'L2' || bell.period === 'EoD';
                                const containerClass = isMinorPeriod ? 'min-h-[1.5rem]' : 'min-h-[3rem]';
                                const timeWidth = 'w-24'; 
                                const textSize = 'text-sm';

                                // NEW: Past check
                                const isPast = isTimePast(currentDateStr, bell.endTime);
                                const opacityClass = isPast ? 'opacity-90 grayscale-[0.1]' : '';

                                let innerHtml = '';
                                if (hasContent) {
                                    // Calculate time to next
                                    const nextTimeStr = getNextSubjectOccurrence(data.subjectCode, currentDateStr, bell.period);
                                    const miniCycle = getMiniCycleHtml(data.subjectCode, stripColor);
                                    
                                    const borderClass = highlightChange ? 'ring-2 ring-red-500 ring-offset-2' : '';
                                    const changedBadge = highlightChange ? \`<span class="ml-2 px-1.5 py-0.5 bg-red-100 text-red-600 text-[10px] font-bold rounded animate-pulse">\${variationTags[0] || 'UPDATED'}</span>\` : '';

                                    innerHtml = \`
    <div class="period-card relative flex items-center justify-between bg-gray-100 rounded-lg p-3 shadow-sm hover:bg-gray-50 transition-all cursor-default group \${borderClass}"
         data-subject="\${data.subjectCode}"
         data-start="\${bell.startTime}"
         data-end="\${bell.endTime}"
         data-color="\${stripColor}">
        <div class="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-lg" 
             style="background-color: \${stripColor};">
        </div>

        <div class="pl-3 font-medium text-gray-900 \${textSize} flex items-center">
            \${data.title || data.subject || 'Unknown'}
            \${changedBadge}
        </div>
        
        <div class="pl-3 flex items-center gap-4 \${textSize}">
            <span class="text-gray-900">\${data.fullTeacher || data.teacher || ''}</span>
            \${data.room ? \`<span class="font-bold text-black \${highlightChange && variation && variation.roomTo ? 'text-red-600' : ''}">\${data.room}</span>\` : ''}
        </div>
        
        <div class="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block z-30 min-w-[200px] p-3 bg-gray-800 text-white text-xs rounded-lg shadow-xl pointer-events-none transform -translate-y-1">
            <div class="flex justify-between items-center mb-2 border-b border-gray-600 pb-2">
                <span class="font-bold text-sm">\${data.title}</span>
                <span class="text-gray-300">\${nextTimeStr}</span>
            </div>
            \${highlightChange ? '<div class="text-red-400 font-bold mb-1">' + variationTags.join(', ') + '</div>' : ''}
            <div class="text-[10px] text-gray-400 mb-1 uppercase tracking-wider">Cycle</div>
            \${miniCycle}
        </div>
    </div>
\`;
                                } else {
                                    if (bell.period === 'EoD') return;
                                    innerHtml = \`
                                        <div class="pl-2 text-gray-400 text-xs py-1">
                                            \${bell.label}
                                        </div>
                                    \`;
                                }

                                const html = \`
                                    <div class="flex items-center \${containerClass} \${opacityClass} transition-opacity duration-500">
                                        <div class="\${timeWidth} text-right pr-4 text-gray-500 font-medium \${textSize}">
                                            \${formatTime(bell.startTime)}
                                        </div>
                                        <div class="flex-grow">
                                            \${innerHtml}
                                        </div>
                                    </div>
                                \`;
                                container.insertAdjacentHTML('beforeend', html);
                            });

                            attachHoverEffects();
                            startTicker();
                        }

                        function renderCycle() {
                            const container = document.getElementById('timetable-list');
                            container.innerHTML = '';
                            container.className = 'overflow-x-auto pb-4';
                            
                            const weekA = ['1', '2', '3', '4', '5'];
                            const weekB = ['6', '7', '8', '9', '10'];
                            const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

                            let gridHtml = '<div class="flex flex-col gap-8 min-w-[800px]">';
                            
                            [weekA, weekB].forEach((weekIds, wIdx) => {
                                const weekLabel = wIdx === 0 ? 'Week A' : 'Week B';
                                gridHtml += \`
                                    <div>
                                        <h3 class="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2 pl-1">\${weekLabel}</h3>
                                        <div class="grid grid-cols-5 gap-2">
                                            \${weekIds.map((dNum, i) => \`
                                                <div class="text-center text-xs font-medium text-gray-500 mb-1">\${dayLabels[i]}</div>
                                            \`).join('')}
                                            
                                            \${weekIds.map(dNum => {
                                                const dayData = daysData[dNum];
                                                if (!dayData) return '<div></div>';
                                                
                                                // Include Period 0
                                                const displayPeriods = ['0', '1', '2', '3', '4', '5'];
                                                const periods = displayPeriods.map(p => {
                                                    let pData = dayData.periods[p];
                                                    if (pData) pData = enrichPeriod(pData);
                                                    return pData;
                                                });
                                                
                                                return \`
                                                    <div class="flex flex-col gap-0 border border-gray-100 rounded-lg overflow-hidden">
                                                        \${periods.map(p => {
                                                            if (!p) return '<div class="h-10 bg-gray-50/30"></div>';
                                                            const color = p.color ? '#' + p.color : '#e5e7eb';
                                                            // Using 10 alpha for higher transparency
                                                            return \`
                                                                <div class="period-card h-10 flex flex-col justify-center px-1 text-xs relative group cursor-default transition-all border-b border-white/50 last:border-b-0"
                                                                     style="background-color: \${color}10; border-left: 3px solid \${color};"
                                                                     data-subject="\${p.subjectCode}">
                                                                    <div class="font-bold truncate text-gray-800 text-[10px] leading-tight">\${p.subjectCode}</div>
                                                                    <div class="truncate text-gray-500 text-[9px] leading-tight">\${p.room || ''}</div>
                                                                </div>
                                                            \`;
                                                        }).join('')}
                                                    </div>
                                                \`;
                                            }).join('')}
                                        </div>
                                    </div>
                                \`;
                            });

                            gridHtml += '</div>';
                            container.innerHTML = gridHtml;
                            
                            attachHoverEffects();
                        }

                        function getMiniCycleHtml(subjectCode, color) {
                            if (!subjectCode) return '';

                            // Calculate today's day number for highlighting
                            const t = new Date();
                            const tStr = \`\${t.getFullYear()}-\${String(t.getMonth() + 1).padStart(2, '0')}-\${String(t.getDate()).padStart(2, '0')}\`;
                            const todayInfo = calendarMap[tStr];
                            const todayNum = todayInfo ? todayInfo.dayNumber : null;
                            
                            let html = '<div class="grid grid-cols-5 gap-1 gap-y-2">';
                            // 2 rows (Week A, Week B)
                            
                            for (let week=0; week<2; week++) {
                                for (let day=1; day<=5; day++) {
                                    const dayNum = (week*5) + day;
                                    const dData = daysData[dayNum.toString()];
                                    let hasSubject = false;
                                    if (dData && dData.periods) {
                                        Object.values(dData.periods).forEach(p => {
                                            if (!p) return;
                                            const e = enrichPeriod(p);
                                            if (e && e.subjectCode === subjectCode) hasSubject = true;
                                        });
                                    }
                                    
                                    const bgClass = hasSubject ? '' : 'bg-gray-700';
                                    const style = hasSubject ? \`background-color: \${color};\` : '';
                                    
                                    // Highlight today
                                    let extraClass = '';
                                    if (todayNum && dayNum.toString() === todayNum) {
                                        extraClass = 'ring-2 ring-white ring-offset-1 ring-offset-gray-800'; 
                                    }

                                    html += \`<div class="h-1.5 rounded-full w-full \${bgClass} \${extraClass}" style="\${style}"></div>\`;
                                }
                            }
                            html += '</div>';
                            return html;
                        }

                        function attachHoverEffects() {
                            const cards = document.querySelectorAll('.period-card');
                            cards.forEach(card => {
                                card.addEventListener('mouseenter', () => {
                                    const subject = card.getAttribute('data-subject');
                                    // Fix Z-Index for wrapper to ensure tooltip shows
                                    const wrapper = card.closest('.flex.items-center');
                                    if(wrapper) {
                                        wrapper.style.zIndex = '50';
                                        wrapper.style.position = 'relative';
                                    }

                                    // Capture time
                                    const start = card.getAttribute('data-start');
                                    const end = card.getAttribute('data-end');
                                    
                                    if(start) {
                                        hoveredPeriodData = { start, end };
                                        updateTicker(); // Immediate update
                                    }

                                    if (!subject) return;

                                    cards.forEach(c => {
                                        if (c.getAttribute('data-subject') === subject) {
                                            c.classList.add('opacity-100', 'ring-2', 'ring-offset-1', 'ring-gray-300');
                                            c.style.transform = 'scale(1.02)';
                                            c.style.zIndex = '10';
                                        } else {
                                            c.classList.add('opacity-25');
                                        }
                                    });
                                });
                                
                                card.addEventListener('mouseleave', () => {
                                    hoveredPeriodData = null;
                                    updateTicker(); // Immediate update

                                    const wrapper = card.closest('.flex.items-center');
                                    if(wrapper) {
                                        wrapper.style.zIndex = '';
                                        wrapper.style.position = '';
                                    }

                                    cards.forEach(c => {
                                        c.classList.remove('opacity-25', 'opacity-100', 'ring-2', 'ring-offset-1', 'ring-gray-300');
                                        c.style.transform = '';
                                        c.style.zIndex = '';
                                    });
                                });
                            });
                        }

                        function getNextSubjectOccurrence(subjectCode, currentDateStr, currentPeriodId) {
                            if (!subjectCode) return '';
                            const pOrder = ['0', '1', '2', '3', '4', '5'];
                            let pInd = pOrder.indexOf(currentPeriodId);
                            if (pInd === -1) pInd = -1; 
                            const [y, m, d] = currentDateStr.split('-').map(Number);
                            let searchDate = new Date(y, m - 1, d);
                            let checkFromIndex = pInd + 1;

                            for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
                                if (dayOffset > 0) {
                                    searchDate.setDate(searchDate.getDate() + 1);
                                    checkFromIndex = 0; 
                                }
                                const dy = searchDate.getFullYear();
                                const dm = String(searchDate.getMonth() + 1).padStart(2, '0');
                                const dd = String(searchDate.getDate()).padStart(2, '0');
                                const sStr = \`\${dy}-\${dm}-\${dd}\`;

                                const dInfo = calendarMap[sStr];
                                if (dInfo && daysData[dInfo.dayNumber]) {
                                    const dayP = daysData[dInfo.dayNumber].periods;
                                    for (let i = checkFromIndex; i < pOrder.length; i++) {
                                        const pId = pOrder[i];
                                        const pData = dayP[pId];
                                        if (pData) {
                                            const enriched = enrichPeriod(pData);
                                            if (enriched && enriched.subjectCode === subjectCode) {
                                                let dayLabel = '';
                                                if (dayOffset === 0) {
                                                    dayLabel = 'Today';
                                                } else if (dayOffset === 1) {
                                                    dayLabel = 'Next Day';
                                                } else {
                                                    const dName = dInfo.dayName || '';
                                                    dayLabel = dName.replace(/[AB]$/, '');
                                                }
                                                return \`Next: \${dayLabel} P\${pId}\`;
                                            }
                                        }
                                    }
                                }
                            }
                            return '/';
                        }

                function formatTime(t) {
                            if (!t) return '';
                const [h, m] = t.split(':').map(Number);
                            const suffix = h >= 12 ? 'PM' : 'AM';
                const h12 = h % 12 || 12;
                return \`\${h12}:\${m.toString().padStart(2, '0')} \${suffix}\`;
                        }

                function changeDate(delta) {
                            const [y, m, day] = currentDateStr.split('-').map(Number);
                let d = new Date(y, m - 1, day);
                let count = 0;
                while(count < 7) {
                    d.setDate(d.getDate() + delta);
                const dw = d.getDay();
                if (dw !== 0 && dw !== 6) break;
                count++;
                            }
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const dy = String(d.getDate()).padStart(2, '0');
                currentDateStr = \`\${year}-\${month}-\${dy}\`;
                render();
                        }
                        
                        document.getElementById('btn-prev').onclick = () => changeDate(-1);
                        document.getElementById('btn-next').onclick = () => changeDate(1);
                        document.getElementById('btn-reset').onclick = () => {
                    currentDateStr = getInitialDate();
                render();
                        };
                        
                        document.getElementById('tab-day').onclick = () => {
                    currentView = 'day';
                render();
                        };
                        document.getElementById('tab-cycle').onclick = () => {
                    currentView = 'cycle';
                render();
                        };

                document.getElementById('loader').classList.add('hidden');
                document.getElementById('content').classList.remove('hidden');
                render();

                        function isTimePast(dateStr, timeStr) {
                            if (!timeStr) return false;
                            const t = new Date();
                            const todayStr = \`\${t.getFullYear()}-\${String(t.getMonth() + 1).padStart(2, '0')}-\${String(t.getDate()).padStart(2, '0')}\`;

                            if (dateStr < todayStr) return true;
                            if (dateStr > todayStr) return false;

                            const [h, m] = timeStr.split(':').map(Number);
                            const now = new Date();
                            // If timeStr is "23:59", it's effectively end of day
                            const check = new Date(now);
                            check.setHours(h, m, 0, 0);
                            return now > check;
                        }

                        function startTicker() {
                            if (tickerInterval) clearInterval(tickerInterval);
                            updateTicker(); // First run
                            if(!tickerInterval) tickerInterval = setInterval(updateTicker, 1000);
                        }

                        function findNextPeriod(now) {
                             // Look ahead 14 days
                             for(let i=0; i<14; i++) {
                                const d = new Date(now);
                                d.setDate(d.getDate() + i);
                                const y = d.getFullYear();
                                const m = String(d.getMonth() + 1).padStart(2, '0');
                                const day = String(d.getDate()).padStart(2, '0');
                                const dateStr = \`\${y}-\${m}-\${day}\`;
                                
                                const dayInfo = calendarMap[dateStr];
                                if (!dayInfo) continue;
                                const dData = daysData[dayInfo.dayNumber];
                                if (!dData) continue;
                                
                                // Standard Bells fallback
                                const bells = DEFAULT_BELL_TIMES;
                                
                                for(let bell of bells) {
                                    // Skip "End of Day" or invalid periods for "Next Class"
                                    if(bell.period === 'EoD' || bell.period === 'RC' || bell.period === '0') {
                                        // Maybe user considers RC a period? Let's include RC, exclude 0 if desired? 
                                        // Usually students care about Period 1. Let's include everything that is a valid subject.
                                    }
                                    
                                    const [h, m] = bell.startTime.split(':').map(Number);
                                    const bellStart = new Date(d);
                                    bellStart.setHours(h, m, 0, 0);
                                    
                                    if (bellStart <= now) continue;
                                    
                                    // Check if actual class exists
                                    let pData = dData.periods ? dData.periods[bell.period] : null;
                                    // Check Rolcall?
                                    if (bell.period === 'RC' && dData.rollcall) pData = dData.rollcall;

                                    if(pData) {
                                        const enriched = enrichPeriod(pData);
                                        if (enriched && (enriched.subject || enriched.title)) {
                                            return {
                                                date: bellStart,
                                                period: bell.label || bell.period,
                                                subject: enriched.title || enriched.subject || 'Unknown',
                                                room: enriched.room,
                                                teacher: enriched.fullTeacher || enriched.teacher,
                                                isToday: i === 0,
                                                dayLabel: i === 0 ? 'Today' : (i === 1 ? 'Tomorrow' : dayInfo.dayName)
                                            };
                                        }
                                    }
                                }
                             }
                             return null;
                        }

                        function updateTicker() {
                            const now = new Date();
                            const t = new Date();
                            const todayStr = \`\${t.getFullYear()}-\${String(t.getMonth() + 1).padStart(2, '0')}-\${String(t.getDate()).padStart(2, '0')}\`;
                            
                            const progressBar = document.getElementById('daily-progress-bar');
                            const bigTimer = document.getElementById('big-timer-display');
                            const btSubject = document.getElementById('bt-subject');
                            const btTimer = document.getElementById('bt-timer');
                            const btDetails = document.getElementById('bt-details');
                            const btLabel = document.getElementById('bt-label');

                            // --- Progress Bar Logic (Only shows if ON today's page and it is today) ---
                            // Because progress bar is fixed to the specific day view logic
                            if (currentDateStr === todayStr && progressBar) {
                                progressBar.classList.remove('hidden');
                                const startMins = 8 * 60; 
                                const endMins = 15 * 60 + 10;
                                const currentMins = now.getHours() * 60 + now.getMinutes() + (now.getSeconds()/60);
                                
                                let pct = (currentMins - startMins) / (endMins - startMins);
                                if (pct < 0) pct = 0;
                                if (pct > 1) pct = 1;
                                
                                progressBar.style.height = \`\${pct * 100}%\`;
                                
                                let activeColor = '#e5e7eb';
                                const cards = document.querySelectorAll('.period-card');
                                cards.forEach(card => {
                                     const s = card.dataset.start;
                                     const e = card.dataset.end;
                                     if(s && e) {
                                         const [sh, sm] = s.split(':').map(Number);
                                         const [eh, em] = e.split(':').map(Number);
                                         const sTime = new Date(now); sTime.setHours(sh, sm, 0, 0);
                                         const eTime = new Date(now); eTime.setHours(eh, em, 0, 0);
                                         if (now >= sTime && now < eTime) {
                                             activeColor = card.dataset.color || '#e5e7eb';
                                         }
                                     }
                                });
                                progressBar.style.backgroundColor = activeColor;
                            } else if (progressBar) {
                                progressBar.classList.add('hidden');
                            }

                            // --- Big Timer Logic ---
                            if (bigTimer) {
                                bigTimer.classList.remove('hidden');
                                
                                let targetTime = null;
                                let timerLabel = "Until Start";
                                let mainText = "";
                                let subText = "";

                                if (hoveredPeriodData) {
                                     // Hovering a specific period
                                     const [h, m] = hoveredPeriodData.start.split(':').map(Number);
                                     // Date depends on text? Hovering assumes "rendered day"
                                     const [ry, rm, rd] = currentDateStr.split('-').map(Number);
                                     targetTime = new Date(ry, rm-1, rd);
                                     targetTime.setHours(h, m, 0, 0);
                                     
                                     mainText = "Hovered Class"; // Or subject name if we could grab it easily
                                     subText = "Selected Period";
                                     timerLabel = "Until Start";
                                     
                                     // Correction: If hovering a past period today?
                                     // The logic below calculates diff.
                                } else {
                                     // Normal Mode: Find NEXT period
                                     const next = findNextPeriod(now);
                                     if (next) {
                                         targetTime = next.date;
                                         mainText = next.subject;
                                         subText = \`<span class="font-bold text-black">\${next.dayLabel}</span> • \${next.period}\${next.room ? ' • ' + next.room : ''}\`;
                                         timerLabel = "Until Start";
                                     } else {
                                         // No future classes found
                                         mainText = "No Upcoming Classes";
                                         subText = "Relax!";
                                         btTimer.textContent = "--:--:--";
                                         return;
                                     }
                                }

                                if (targetTime) {
                                    let diff = targetTime - now;
                                    
                                    // Visual update
                                    btSubject.textContent = mainText;
                                    btDetails.innerHTML = subText;
                                    btLabel.textContent = timerLabel;

                                    if (diff < 0) {
                                         // Past
                                         btTimer.textContent = "Started";
                                         btLabel.textContent = "Time Since Start: " + formatDuration(Math.abs(diff));
                                    } else {
                                        btTimer.textContent = formatDuration(diff);
                                    }
                                }
                            }
                        }

                        function formatDuration(ms) {
                            const dHours = Math.floor(ms / (1000 * 60 * 60));
                            const dMins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
                            const dSecs = Math.floor((ms % (1000 * 60)) / 1000);
                            
                            // If > 24 hours, maybe show Days?
                            if (dHours > 24) {
                                const days = Math.floor(dHours / 24);
                                const h = dHours % 24;
                                return \`\${days}d \${h}h \${dMins}m\`;
                            }
                            
                            const hStr = dHours > 0 ? \`\${String(dHours)}:\` : '';
                            return \`\${hStr}\${String(dMins).padStart(2,'0')}:\${String(dSecs).padStart(2,'0')}\`;
                        }

                    })();
                `
                }}></script>
            </div>
        </Layout >
    )
})

export default app
