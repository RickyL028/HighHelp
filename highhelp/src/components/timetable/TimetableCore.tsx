import { html } from 'hono/html'

export const TimetableCore = html`
<script>
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
        // Note: Using standard string concatenation or escaping here too
        const loader = document.getElementById('loader');
        if(loader) loader.classList.add('hidden');
        const err = document.getElementById('error-msg');
        if(err) {
            err.classList.remove('hidden');
            err.innerHTML = 'Timetable data not found. Please <a href="/api/auth/login" class="underline">Log in again</a> to sync.';
        }
    }

    const calendarMap = studentData?.calendar || {}; 
    const daysData = studentData?.timetable?.days || {};
    const subjectsData = studentData?.timetable?.subjects || [];

    let currentDateStr = new URLSearchParams(window.location.search).get('date') || getInitialDate();
    let currentView = 'day'; 
    let tickerInterval = null;
    let hoveredPeriodData = null;
    let activeSubject = null;
    let bellCache = {};
    let pendingFetches = {};
    let isTickerUpdating = false;

    let subjectConfig = {};
    try {
        const raw = localStorage.getItem('subjectConfig');
        if (raw) subjectConfig = JSON.parse(raw);
    } catch(e) { console.error('Error loading subject config', e); }

    window.addEventListener('subjectConfigUpdated', () => {
         try {
            const raw = localStorage.getItem('subjectConfig');
            if (raw) subjectConfig = JSON.parse(raw);
            if (window.render) window.render();
        } catch(e) { console.error('Error reloading subject config', e); }
    });

    function getInitialDate() {
        const now = new Date();
        const isAfterSchool = (now.getHours() > 15) || (now.getHours() === 15 && now.getMinutes() >= 10);
        
        if (isAfterSchool) {
            now.setDate(now.getDate() + 1);
        }
        
        if (now.getDay() === 0) now.setDate(now.getDate() + 1);
        if (now.getDay() === 6) now.setDate(now.getDate() + 2);

         const year = now.getFullYear();
         const month = String(now.getMonth() + 1).padStart(2, '0');
         const day = String(now.getDate()).padStart(2, '0');
         // Fixed spacing in return string
         return \`\${year}-\${month}-\${day}\`;
    }

    function enrichPeriod(periodObj) {
        if (!periodObj) return null;
        const subj = subjectsData.find(s => 
            (s.shortTitle && s.shortTitle === periodObj.title) || 
            (s.title && s.title === periodObj.title) ||
            (s.subject && s.subject === periodObj.title) 
        );

        let color = subj ? subj.colour : periodObj.colour || periodObj.color || 'e5e7eb';
        let link = null;

        const subjectName = subj ? (subj.title || subj.shortTitle || subj.subject) : (periodObj.title);
        if (subjectName && subjectConfig[subjectName]) {
            if (subjectConfig[subjectName].color) color = subjectConfig[subjectName].color;
            if (subjectConfig[subjectName].link) link = subjectConfig[subjectName].link;
        }

        return {
            ...periodObj,
            color: color,
            link: link,
            fullTeacher: subj ? subj.fullTeacher : periodObj.fullTeacher || periodObj.teacher,
            subjectCode: subj ? (subj.shortTitle || subj.title) : (periodObj.title || 'Unknown')
        };
    }

    async function fetchDayData(date) {
        if (!studentData?.accessToken) return null;
        if (pendingFetches[date]) return pendingFetches[date];

        const fetchPromise = (async () => {
            const cachedRaw = localStorage.getItem('todayData_' + date);
            if (cachedRaw) {
                try {
                    const cachedObj = JSON.parse(cachedRaw);
                    const now = new Date().getTime();
                    if (cachedObj.timestamp && (now - cachedObj.timestamp < 300000)) { 
                        if (cachedObj.data && (cachedObj.data.status === 'OK' || cachedObj.data.timetable)) {
                            if (cachedObj.data.bells && cachedObj.data.bells.length > 0) {
                                bellCache[date] = cachedObj.data.bells.map(b => ({
                                    period: b.period || b.bell,  
                                    startTime: b.startTime || b.time,
                                    endTime: b.endTime || '23:59',
                                    label: b.bellDisplay || b.bell || b.period
                                }));
                            }
                            return cachedObj.data;
                        }
                    }
                } catch(e) { }
            }

            let data = null;
            try {
                // Fixed the fetch URL pathing and variable interpolation
                const res = await fetch(\`/api/proxy/day-data?date=\${date}&_=\${new Date().getTime()}\`, {
                    headers: { 'Authorization': \`Bearer \${studentData.accessToken}\` }
                });
                
                if (res.ok) {
                    data = await res.json();
                    if (data && (data.status === 'OK' || data.timetable)) {
                        const cacheObj = {
                            timestamp: new Date().getTime(),
                            data: data
                        };
                        localStorage.setItem('todayData_' + date, JSON.stringify(cacheObj));
                        
                        if (data.bells && data.bells.length > 0) {
                            bellCache[date] = data.bells.map(b => ({
                                period: b.period || b.bell,  
                                startTime: b.startTime || b.time,
                                endTime: b.endTime || '23:59',
                                label: b.bellDisplay || b.bell || b.period
                            }));
                        }
                    }
                    return data;
                }
            } catch(e) { console.error(e); }

            if (!data && cachedRaw) {
                try { 
                    const c = JSON.parse(cachedRaw);
                    return c.data || c;
                } catch(e) {}
            }
            return null;
        })();

        pendingFetches[date] = fetchPromise;
        try { return await fetchPromise; } finally { delete pendingFetches[date]; }
    }

    async function fetchClipboardData(date) {
        const url = localStorage.getItem('clipboardUrl');
        if (!url) return [];
        try {
            const res = await fetch(\`/api/clipboard/events?url=\${encodeURIComponent(url)}&date=\${date}\`);
            if (res.ok) {
                const data = await res.json();
                return data.events || [];
            }
        } catch (e) {
            console.error('Failed to fetch clipboard data', e);
        }
        return [];
    }

    function formatTime(t) {
        if (!t) return '';
        const [h, m] = t.split(':').map(Number);
        const suffix = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 || 12;
        return \`\${h12}:\${m.toString().padStart(2, '0')} \${suffix}\`;
    }

    function isTimePast(dateStr, timeStr) {
        if (!timeStr) return false;
        const t = new Date();
        const todayStr = \`\${t.getFullYear()}-\${String(t.getMonth() + 1).padStart(2, '0')}-\${String(t.getDate()).padStart(2, '0')}\`;
        if (dateStr < todayStr) return true;
        if (dateStr > todayStr) return false;
        const [h, m] = timeStr.split(':').map(Number);
        const now = new Date();
        const check = new Date(now);
        check.setHours(h, m, 0, 0);
        return now > check;
    }

    function attachHoverEffects() {
        const cards = document.querySelectorAll('.period-card');
        cards.forEach(card => {
            const subject = card.getAttribute('data-subject');
            card.addEventListener('click', (e) => {
                e.stopPropagation(); 
                const link = card.getAttribute('data-link');
                if (link) {
                    window.open(link, '_blank');
                    return;
                }
                if (activeSubject === subject) {
                    activeSubject = null;
                    resetCards(cards);
                    return;
                }
                resetCards(cards);
                activeSubject = subject;
                highlightCards(cards, subject, card);
            });
            card.addEventListener('mouseenter', () => {
                if (activeSubject) return; 
                highlightCards(cards, subject, card);
            });
            card.addEventListener('mouseleave', () => {
                if (activeSubject) return; 
                resetCards(cards);
            });
        });
    }

    function highlightCards(cards, subject, sourceCard) {
        const wrapper = sourceCard.closest('.flex.items-center');
        if(wrapper) {
            wrapper.style.zIndex = '50';
            wrapper.style.position = 'relative';
        }
        
        // MOVED UP: Tooltip logic must run before checking for subject
        // because clipboard items do not have a subject but have tooltips.
        document.querySelectorAll('.tooltip-content').forEach(t => t.style.display = 'none');
        const tooltip = sourceCard.querySelector('.tooltip-content');
        if (tooltip) {
            tooltip.style.display = 'block';
        }

        const start = sourceCard.getAttribute('data-start');
        const end = sourceCard.getAttribute('data-end');
        const title = sourceCard.getAttribute('data-title');
        const teacher = sourceCard.getAttribute('data-teacher');
        const room = sourceCard.getAttribute('data-room');
        if(start) {
            hoveredPeriodData = { start, end, title, teacher, room };
            if (window.updateTicker) window.updateTicker();
        }
        
        if (!subject) return;
        
        cards.forEach(c => {
            if (c.getAttribute('data-subject') === subject) {
                c.classList.add('opacity-100', 'ring-2', 'ring-offset-1', 'ring-gray-300');
                c.style.transform = 'scale(1.02)';
                c.style.zIndex = '10';
            } else {
                c.classList.add('opacity-25');
                c.classList.remove('opacity-100', 'ring-2', 'ring-offset-1', 'ring-gray-300');
                c.style.transform = '';
                c.style.zIndex = '';
            }
        });
    }

    function resetCards(cards) {
        hoveredPeriodData = null;
        if (window.updateTicker) window.updateTicker();
        cards.forEach(c => {
            const wrapper = c.closest('.flex.items-center');
            if(wrapper) {
                wrapper.style.zIndex = '';
                wrapper.style.position = '';
            }
            c.classList.remove('opacity-25', 'opacity-100', 'ring-2', 'ring-offset-1', 'ring-gray-300');
            c.style.transform = '';
            c.style.zIndex = '';
        });
        document.querySelectorAll('.tooltip-content').forEach(t => t.style.display = 'none');
    }

    function getMiniCycleHtml(subjectCode, color) {
        if (!subjectCode) return '';
        const t = new Date();
        const tStr = \`\${t.getFullYear()}-\${String(t.getMonth() + 1).padStart(2, '0')}-\${String(t.getDate()).padStart(2, '0')}\`;
        const todayInfo = calendarMap[tStr];
        const todayNum = todayInfo ? todayInfo.dayNumber : null;
        let htmlContent = '<div class="grid grid-cols-5 gap-1 gap-y-2">';
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
                let extraClass = '';
                if (todayNum && dayNum.toString() === todayNum) {
                    extraClass = 'ring-2 ring-white ring-offset-1 ring-offset-gray-800'; 
                }
                htmlContent += \`<div class="h-1.5 rounded-full w-full \${bgClass} \${extraClass}" style="\${style}"></div>\`;
            }
        }
        htmlContent += '</div>';
        return htmlContent;
    }

    function getNextSubjectOccurrence(subjectCode, currentDateStr, currentPeriodId) {
        if (!subjectCode) return '';
        const pOrder = ['0', '1', '2', '3', '4', '5'];
        let pInd = pOrder.indexOf(currentPeriodId);
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
                            if (dayOffset === 0) dayLabel = 'Today';
                            else if (dayOffset === 1) dayLabel = 'Next Day';
                            else {
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
</script>`