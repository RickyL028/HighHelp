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

                <div id="daily-progress-bar" class="fixed left-0 top-0 h-full w-1.5 bg-gray-200 z-50 hidden transition-all duration-500 ease-in-out origin-top"></div>
                <div id="loader" class="text-center py-12">
                    <p class="text-gray-500">Loading timetable...</p>
                </div>

                <div id="content" class="hidden">
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

                    <div id="big-timer-display" class="mb-6 bg-white border border-gray-200 rounded-2xl p-6 text-black transform transition-all relative overflow-hidden hidden">
                        <div class="absolute top-0 right-0 w-32 h-32 bg-gray-100 opacity-50 rounded-full -mr-10 -mt-10 blur-2xl"></div>
                        <div class="absolute bottom-0 left-0 w-24 h-24 bg-red-500 opacity-5 rounded-full -ml-10 -mb-10 blur-xl"></div>

                        <div class="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                            <div class="text-center md:text-left min-w-0">
                                <h2 class="text-gray-400 text-sm font-bold uppercase tracking-widest mb-1">Time till</h2>
                                <div id="bt-subject" class="text-2xl font-bold truncate">Checking...</div>
                                <div id="bt-details" class="text-sm text-gray-400 mt-1 flex items-center gap-2 justify-center md:justify-start"></div>
                            </div>

                            <div class="text-center whitespace-nowrap">
                                <div id="bt-timer" class="text-5xl md:text-6xl font-mono font-bold tracking-tighter tabular-nums leading-none">--:--:--</div>
                                <div id="bt-label" class="text-xs text-red-400 font-bold mt-2 uppercase tracking-wide">Until Start</div>
                            </div>
                        </div>
                    </div>

                    <div class="flex items-center gap-2 mb-6">
                        <button id="btn-prev" class="w-10 h-10 flex items-center justify-center rounded-lg border border-red-500 text-red-500 hover:bg-red-50 transition-colors">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                        </button>
                        <div class="flex-grow flex items-center justify-center border border-gray-200 rounded-lg h-10 bg-white shadow-sm px-4">
                            <span id="date-display" class="font-bold text-gray-800 text-sm"></span>
                        </div>
                        <button id="btn-reset" class="h-10 px-4 flex items-center justify-center rounded-lg border border-red-500 text-red-500 font-medium text-sm hover:bg-red-50 transition-colors">
                            Reset
                        </button>
                        <button id="btn-next" class="w-10 h-10 flex items-center justify-center rounded-lg border border-red-500 text-red-500 hover:bg-red-50 transition-colors">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                        </button>
                    </div>

                    <div id="timetable-list" class="space-y-4"></div>
                </div>

                <div id="error-msg" class="hidden text-center py-12 text-red-500"></div>

                {html`
                <script>
                    (function() {
                        const BELL_PATTERNS = {
                            'Mon': [
                                { period: "0", startTime: "08:00", endTime: "08:50", label: "Period 0" },
                                { period: "RC", startTime: "08:50", endTime: "08:57", label: "Roll Call" },
                                { period: "1", startTime: "09:00", endTime: "10:00", label: "Period 1" },
                                { period: "2", startTime: "10:05", endTime: "11:05", label: "Period 2" },
                                { period: "R", startTime: "11:05", endTime: "11:22", label: "Recess" },
                                { period: "3", startTime: "11:25", endTime: "12:25", label: "Period 3" },
                                { period: "4", startTime: "12:30", endTime: "13:30", label: "Period 4" },
                                { period: "L1", startTime: "13:30", endTime: "13:50", label: "Lunch 1" },
                                { period: "L2", startTime: "13:50", endTime: "14:07", label: "Lunch 2" },
                                { period: "5", startTime: "14:10", endTime: "15:10", label: "Period 5" },
                                { period: "EoD", startTime: "15:10", endTime: "23:59", label: "End of Day" }
                            ],
                            'Tue': [
                                { period: "0", startTime: "08:00", endTime: "08:50", label: "Period 0" },
                                { period: "RC", startTime: "08:50", endTime: "08:57", label: "Roll Call" },
                                { period: "1", startTime: "09:00", endTime: "10:00", label: "Period 1" },
                                { period: "2", startTime: "10:05", endTime: "11:05", label: "Period 2" },
                                { period: "R", startTime: "11:05", endTime: "11:22", label: "Recess" },
                                { period: "3", startTime: "11:25", endTime: "12:25", label: "Period 3" },
                                { period: "4", startTime: "12:30", endTime: "13:30", label: "Period 4" },
                                { period: "L1", startTime: "13:30", endTime: "13:50", label: "Lunch 1" },
                                { period: "L2", startTime: "13:50", endTime: "14:07", label: "Lunch 2" },
                                { period: "5", startTime: "14:10", endTime: "15:10", label: "Period 5" },
                                { period: "EoD", startTime: "15:10", endTime: "23:59", label: "End of Day" }
                            ],
                            'Fri': [
                                { period: "0", startTime: "08:00", endTime: "08:50", label: "Period 0" },
                                { period: "RC", startTime: "08:50", endTime: "08:57", label: "Roll Call" },
                                { period: "1", startTime: "09:25", endTime: "10:20", label: "Period 1" },
                                { period: "2", startTime: "10:25", endTime: "11:20", label: "Period 2" },
                                { period: "R", startTime: "11:20", endTime: "11:40", label: "Recess" },
                                { period: "3", startTime: "11:40", endTime: "12:35", label: "Period 3" },
                                { period: "L1", startTime: "12:35", endTime: "12:55", label: "Lunch 1" },
                                { period: "L2", startTime: "12:55", endTime: "13:15", label: "Lunch 2" },
                                { period: "4", startTime: "13:15", endTime: "14:10", label: "Period 4" },
                                { period: "5", startTime: "14:15", endTime: "15:10", label: "Period 5" },
                                { period: "EoD", startTime: "15:10", endTime: "23:59", label: "End of Day" }
                            ],
                            'Default': [
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
                            ]
                        };

                        function getBellsForDate(dateStr) {
                            const d = new Date(dateStr);
                            const dayNum = d.getDay(); 
                            if (dayNum === 1) return BELL_PATTERNS['Mon'];
                            if (dayNum === 2) return BELL_PATTERNS['Tue'];
                            if (dayNum === 5) return BELL_PATTERNS['Fri'];
                            return BELL_PATTERNS['Default'];
                        }

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
                        
                        const calendarMap = studentData.calendar; 
                        const daysData = studentData.timetable.days || {};
                        const subjectsData = studentData.timetable.subjects || [];
                        
                        let currentDateStr = new URLSearchParams(window.location.search).get('date') || getInitialDate();
                        let currentView = 'day'; 
                        let tickerInterval = null;
                        let hoveredPeriodData = null;
                        let activeSubject = null;

                        function getInitialDate() {
                            const now = new Date();
                            const isAfterSchool = (now.getHours() > 15) || (now.getHours() === 15 && now.getMinutes() >= 10);
                            if (isAfterSchool) now.setDate(now.getDate() + 1);
                            if (now.getDay() === 0) now.setDate(now.getDate() + 1);
                            if (now.getDay() === 6) now.setDate(now.getDate() + 2);
                            return now.toISOString().split('T')[0];
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
                            if (!studentData.accessToken) return null;
                            const cached = localStorage.getItem('todayData_' + date);
                            if (cached) {
                                try { return JSON.parse(cached); } catch(e) {}
                            }
                            try {
                                const res = await fetch('/api/proxy/day-data?date=' + date, {
                                    headers: { 'Authorization': 'Bearer ' + studentData.accessToken }
                                });
                                if (res.ok) {
                                    const data = await res.json();
                                    if (data && data.status === 'OK') localStorage.setItem('todayData_' + date, JSON.stringify(data));
                                    return data;
                                }
                                return null;
                            } catch(e) { return null; }
                        }

                        window.addEventListener('todayDataRefreshed', (e) => {
                            if (e.detail.date === currentDateStr) render();
                        });

                        function render() {
                            activeSubject = null;
                            const tabDay = document.getElementById('tab-day');
                            const tabCycle = document.getElementById('tab-cycle');
                            const headerControls = document.querySelector('#content > .flex.items-center.gap-2.mb-6');

                            if (currentView === 'day') {
                                tabDay.className = "flex items-center gap-2 px-4 py-2 border-b-2 border-red-500 text-red-500 font-medium text-sm focus:outline-none transition-colors";
                                tabCycle.className = "flex items-center gap-2 px-4 py-2 border-b-2 border-transparent text-gray-500 hover:text-gray-700 font-medium text-sm focus:outline-none transition-colors";
                                headerControls.classList.remove('hidden');
                                renderDay();
                            } else {
                                tabCycle.className = "flex items-center gap-2 px-4 py-2 border-b-2 border-red-500 text-red-500 font-medium text-sm focus:outline-none transition-colors";
                                tabDay.className = "flex items-center gap-2 px-4 py-2 border-b-2 border-transparent text-gray-500 hover:text-gray-700 font-medium text-sm focus:outline-none transition-colors";
                                headerControls.classList.add('hidden');
                                renderCycle();
                            }
                        }

                        async function renderDay() {
                            const url = new URL(window.location);
                            url.searchParams.set('date', currentDateStr);
                            window.history.replaceState({}, '', url);

                            const dayInfo = calendarMap[currentDateStr];
                            const d = new Date(currentDateStr);
                            const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                            const dateFormatted = days[d.getDay()] + ', ' + d.getDate().toString().padStart(2, '0') + '/' + (d.getMonth()+1).toString().padStart(2,'0') + '/' + d.getFullYear();
                            
                            document.getElementById('date-display').innerHTML = 
                                '<div class="relative cursor-pointer group flex items-center gap-2">' +
                                    '<span>' + dateFormatted + (dayInfo ? ' [' + dayInfo.dayName.slice(-1) + ']' : '') + '</span>' +
                                    '<input type="date" id="date-picker-input" class="absolute inset-0 opacity-0 cursor-pointer" value="' + currentDateStr + '">' +
                                '</div>';
                            
                            document.getElementById('date-picker-input').onchange = (e) => {
                                currentDateStr = e.target.value;
                                render();
                            };

                            const container = document.getElementById('timetable-list');
                            container.innerHTML = '<div class="text-center py-12 text-gray-500">Loading...</div>';
                            const apiData = await fetchDayData(currentDateStr);
                            container.innerHTML = '';
                            
                            let periodsData = {};
                            let currentBellTimes = getBellsForDate(currentDateStr);
                            let dayVariations = {};

                            if (apiData) {
                                if (apiData.bells?.length) currentBellTimes = apiData.bells.map(b => ({ period: b.period || b.bell, startTime: b.startTime, endTime: b.endTime || '23:59', label: b.bellDisplay || b.bell || b.period }));
                                if (apiData.timetable?.timetable?.periods) periodsData = apiData.timetable.timetable.periods;
                                if (apiData.classVariations) dayVariations = apiData.classVariations;
                            } else if (dayInfo && daysData[dayInfo.dayNumber]) {
                                periodsData = { ...daysData[dayInfo.dayNumber].periods };
                                if (daysData[dayInfo.dayNumber].rollcall) periodsData['RC'] = daysData[dayInfo.dayNumber].rollcall;
                            }
                            
                            currentBellTimes.forEach(bell => {
                                let data = periodsData[bell.period];
                                let variation = dayVariations[bell.period];
                                if (data) data = enrichPeriod(data);

                                if (variation && variation.type !== 'novariation') {
                                    if (!data) data = { title: variation.title || 'Variation', teacher: variation.teacher };
                                    if (variation.title) data.title = variation.title;
                                    if (variation.casualSurname) { data.fullTeacher = variation.casualSurname; data.teacher = variation.casualSurname; }
                                    if (variation.roomTo) data.room = variation.roomTo;
                                    data = enrichPeriod(data);
                                }

                                if (bell.period === 'EoD') return;
                                const hasContent = data && (data.title || data.subject);
                                const stripColor = data?.color ? '#' + data.color : '#e5e7eb';
                                const isPast = isTimePast(currentDateStr, bell.endTime);

                                container.insertAdjacentHTML('beforeend', 
                                    '<div class="flex items-center ' + (isPast ? 'opacity-50' : '') + '">' +
                                        '<div class="w-20 text-right pr-4 text-gray-500 text-sm">' + formatTime(bell.startTime) + '</div>' +
                                        '<div class="flex-grow">' +
                                            (hasContent ? 
                                                '<div class="period-card relative flex items-center justify-between bg-gray-100 rounded-lg p-3 shadow-sm group" ' +
                                                     'data-subject="' + (data.subjectCode || '') + '" data-start="' + bell.startTime + '" data-end="' + bell.endTime + '" data-color="' + stripColor + '" ' +
                                                     'data-title="' + (data.title || '') + '" data-teacher="' + (data.fullTeacher || data.teacher || '') + '" data-room="' + (data.room || '') + '">' +
                                                    '<div class="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-lg" style="background-color: ' + stripColor + '"></div>' +
                                                    '<div class="pl-3 font-medium text-sm text-gray-900">' + (data.title || '') + '</div>' +
                                                    '<div class="text-sm text-gray-500">' + (data.room || '') + '</div>' +
                                                '</div>'
                                            : '<div class="pl-2 text-gray-400 text-xs py-1">' + bell.label + '</div>') +
                                        '</div>' +
                                    '</div>'
                                );
                            });
                            attachHoverEffects();
                            startTicker();
                        }

                        function renderCycle() {
                            const container = document.getElementById('timetable-list');
                            container.innerHTML = '<div class="text-gray-500 text-center py-10">Cycle view (Optimized)</div>';
                        }

                        function attachHoverEffects() {
                            document.querySelectorAll('.period-card').forEach(card => {
                                card.onmouseenter = () => { hoveredPeriodData = { ...card.dataset }; updateTicker(); };
                                card.onmouseleave = () => { hoveredPeriodData = null; updateTicker(); };
                            });
                        }

                        function formatTime(t) {
                            if (!t) return '';
                            const [h, m] = t.split(':').map(Number);
                            return (h % 12 || 12) + ':' + m.toString().padStart(2, '0') + (h >= 12 ? ' PM' : ' AM');
                        }
                        
                        function formatDuration(ms) {
                            const s = Math.floor(ms / 1000);
                            const h = Math.floor(s / 3600);
                            const m = Math.floor((s % 3600) / 60);
                            const sec = s % 60;
                            if (h > 0) return h + ':' + m.toString().padStart(2,'0') + ':' + sec.toString().padStart(2,'0');
                            return m.toString().padStart(2,'0') + ':' + sec.toString().padStart(2,'0');
                        }

                        function isTimePast(dateStr, timeStr) {
                            const now = new Date();
                            const todayStr = now.toISOString().split('T')[0];
                            if (dateStr < todayStr) return true;
                            if (dateStr > todayStr) return false;
                            const [h, m] = timeStr.split(':').map(Number);
                            const end = new Date(); end.setHours(h, m, 0, 0);
                            return now > end;
                        }

                        function startTicker() {
                            if (tickerInterval) clearInterval(tickerInterval);
                            updateTicker();
                            tickerInterval = setInterval(updateTicker, 1000);
                        }
                        
                        function findCurrentPeriod(now) {
                            const dateStr = now.toISOString().split('T')[0];
                            const bells = getBellsForDate(dateStr);
                            const dayInfo = calendarMap[dateStr];
                            if (!dayInfo) return null;
                            const dData = daysData[dayInfo.dayNumber] || {};
                            const periods = dData.periods || {};
                            const rc = dData.rollcall;

                            for (let bell of bells) {
                                if (bell.period === 'EoD') continue;
                                const [sh, sm] = bell.startTime.split(':').map(Number);
                                const [eh, em] = bell.endTime.split(':').map(Number);
                                const start = new Date(now); start.setHours(sh, sm, 0, 0);
                                const end = new Date(now); end.setHours(eh, em, 0, 0);
                                
                                if (now >= start && now < end) {
                                     let pData = periods[bell.period];
                                     if (bell.period === 'RC' && rc) pData = rc;
                                     if (['R','L1','L2'].includes(bell.period)) pData = { title: bell.label };
                                     
                                     const enriched = enrichPeriod(pData || { title: bell.label });
                                     return {
                                         target: end,
                                         label: "Time Remaining",
                                         title: enriched.title || bell.label,
                                         details: enriched.room ? enriched.room + ' • ' + (enriched.fullTeacher || '') : (enriched.fullTeacher || '')
                                     };
                                }
                            }
                            return null;
                        }
                        
                        function findNextPeriod(now) {
                            for(let i=0; i<14; i++) {
                                const d = new Date(now);
                                d.setDate(d.getDate() + i);
                                const dateStr = d.toISOString().split('T')[0];
                                
                                const dayInfo = calendarMap[dateStr];
                                if (!dayInfo) continue;
                                const bells = getBellsForDate(dateStr);
                                const dData = daysData[dayInfo.dayNumber] || {};
                                const periods = dData.periods || {};
                                
                                for(let bell of bells) {
                                    if(['EoD'].includes(bell.period)) continue;
                                    const [h, m] = bell.startTime.split(':').map(Number);
                                    const start = new Date(d); start.setHours(h, m, 0, 0);
                                    
                                    if (start <= now) continue;
                                    
                                    let pData = periods[bell.period];
                                    if (bell.period === 'RC') pData = dData.rollcall;
                                    
                                    if (pData) {
                                        const enriched = enrichPeriod(pData);
                                        return {
                                            target: start,
                                            label: "Until Start",
                                            title: enriched.title,
                                            details: (i===0 ? 'Today' : (i===1?'Tomorrow':dayInfo.dayName)) + ' • ' + (enriched.room || '')
                                        };
                                    }
                                }
                            }
                            return null;
                        }

                        function updateTicker() {
                            const now = new Date();
                            const bigTimer = document.getElementById('big-timer-display');
                            if (!bigTimer) return;
                            bigTimer.classList.remove('hidden');

                            const btSubject = document.getElementById('bt-subject');
                            const btTimer = document.getElementById('bt-timer');
                            const btDetails = document.getElementById('bt-details');
                            const btLabel = document.getElementById('bt-label');

                            // Progress Bar
                            const progressBar = document.getElementById('daily-progress-bar');
                            const todayStr = now.toISOString().split('T')[0];
                            if (currentDateStr === todayStr && progressBar) {
                                progressBar.classList.remove('hidden');
                                const bells = getBellsForDate(todayStr);
                                const [sh, sm] = bells[0].startTime.split(':').map(Number);
                                // Find last bell start (EoD start)
                                const last = bells.find(b=>b.period==='EoD') || bells[bells.length-1];
                                const [eh, em] = last.startTime.split(':').map(Number);
                                
                                const sMins = sh*60 + sm;
                                const eMins = eh*60 + em;
                                const cMins = now.getHours()*60 + now.getMinutes() + now.getSeconds()/60;
                                const pct = Math.max(0, Math.min(1, (cMins - sMins)/(eMins - sMins)));
                                progressBar.style.height = (pct*100) + '%';
                                
                                // Color logic
                                let activeColor = '#e5e7eb';
                                const cards = document.querySelectorAll('.period-card');
                                cards.forEach(c => {
                                    const s = c.dataset.start; const e = c.dataset.end;
                                    if(s && e) {
                                        const [h1, m1] = s.split(':').map(Number);
                                        const [h2, m2] = e.split(':').map(Number);
                                        const d1=new Date(now); d1.setHours(h1,m1,0,0);
                                        const d2=new Date(now); d2.setHours(h2,m2,0,0);
                                        if(now >= d1 && now < d2) activeColor = c.dataset.color;
                                    }
                                });
                                progressBar.style.backgroundColor = activeColor;
                            } else if (progressBar) progressBar.classList.add('hidden');

                            // Timer Display
                            let data = null;
                            if (hoveredPeriodData) {
                                const [h, m] = hoveredPeriodData.start.split(':').map(Number);
                                let d = new Date(currentDateStr); 
                                const [y,mo,da] = currentDateStr.split('-').map(Number);
                                d = new Date(y, mo-1, da);
                                d.setHours(h, m, 0, 0);
                                data = {
                                    target: d,
                                    title: hoveredPeriodData.title,
                                    details: hoveredPeriodData.room,
                                    label: "Until Start"
                                };
                            } else {
                                data = findCurrentPeriod(now) || findNextPeriod(now);
                            }

                            if (data && data.target) {
                                btSubject.textContent = data.title;
                                btDetails.textContent = data.details;
                                btLabel.textContent = data.label;
                                const diff = data.target - now;
                                if (diff < 0 && data.label === 'Until Start') {
                                     btTimer.textContent = "Started";
                                     btLabel.textContent = "Since Start";
                                     btTimer.textContent = formatDuration(Math.abs(diff));
                                } else if (diff < 0) {
                                     btTimer.textContent = "00:00:00";
                                } else {
                                     btTimer.textContent = formatDuration(diff);
                                }
                            } else {
                                btSubject.textContent = "No Classes";
                                btDetails.textContent = "Relax";
                                btTimer.textContent = "--:--:--";
                                btLabel.textContent = "";
                            }
                        }

                        function changeDate(delta) {
                            const [y, m, da] = currentDateStr.split('-').map(Number);
                            const d = new Date(y, m - 1, da);
                            
                            // Simple skipping of weekends logic
                            let count = 0;
                            // Basic skipping logic: just add days and if landing on weekend, keep going
                            d.setDate(d.getDate() + delta);
                            
                            // If weekend, skip
                            while(d.getDay() === 0 || d.getDay() === 6) {
                                d.setDate(d.getDate() + (delta > 0 ? 1 : -1));
                            }
                            
                            const year = d.getFullYear();
                            const month = String(d.getMonth() + 1).padStart(2, '0');
                            const day = String(d.getDate()).padStart(2, '0');
                            currentDateStr = year + '-' + month + '-' + day;
                            render();
                        }

                        // Event Listeners
                        const btnPrev = document.getElementById('btn-prev');
                        if (btnPrev) btnPrev.onclick = () => changeDate(-1);
                        
                        const btnNext = document.getElementById('btn-next');
                        if (btnNext) btnNext.onclick = () => changeDate(1);
                        
                        const btnReset = document.getElementById('btn-reset');
                        if (btnReset) btnReset.onclick = () => {
                            currentDateStr = getInitialDate();
                            render();
                        };
                        
                        const tabDay = document.getElementById('tab-day');
                        if (tabDay) tabDay.onclick = () => { 
                            currentView = 'day'; 
                            render(); 
                        };
                        
                        const tabCycle = document.getElementById('tab-cycle');
                        if (tabCycle) tabCycle.onclick = () => { 
                            currentView = 'cycle'; 
                            render(); 
                        };

                        // Startup
                        document.getElementById('loader').classList.add('hidden');
                        document.getElementById('content').classList.remove('hidden');
                        render();
                    })();
                </script>
                `}
            </div>
        </Layout>
    )
})

export default app