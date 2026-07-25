import { html } from 'hono/html'

export const TimetableDay = html`
<script>
    // Cache of scan-in data keyed by week-start (Monday) date string, e.g. { "2026-07-20": { timestamp, data } }
    let _scanInWeekCache = {};
    let _scanInFetchPromises = {};

    // Returns { from, to, key } for the Mon-Sun week containing dateStr. key = Monday's date string.
    function getWeekRange(dateStr) {
        const d = new Date(dateStr + 'T12:00:00');
        const day = d.getDay(); // 0 = Sunday .. 6 = Saturday
        const diffToMonday = (day === 0 ? -6 : 1 - day);
        const monday = new Date(d);
        monday.setDate(d.getDate() + diffToMonday);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        const fmt = (dt) => \`\${dt.getFullYear()}-\${String(dt.getMonth() + 1).padStart(2, '0')}-\${String(dt.getDate()).padStart(2, '0')}\`;
        return { from: fmt(monday), to: fmt(sunday), key: fmt(monday) };
    }

    // Fetches (and caches, per-week) scan-in data covering the week containing dateStr.
    async function fetchScanIns(dateStr, forceFetch = false) {
        if (!studentData?.accessToken || !studentData?.studentId) return null;

        const { from, to, key } = getWeekRange(dateStr);

        if (!forceFetch) {
            const cached = _scanInWeekCache[key];
            if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
                return cached.data;
            }
            if (_scanInFetchPromises[key]) return _scanInFetchPromises[key];
        }

        const fetchPromise = (async () => {
            try {
                const url = '/api/proxy/scan-ins?studentId=' + encodeURIComponent(studentData.studentId)
                    + '&from=' + from + '&to=' + to;
                let res = await fetch(url, {
                    headers: { 'Authorization': 'Bearer ' + studentData.accessToken }
                });

                if (res.status === 401 || res.status === 403) {
                    const refreshRes = await fetch('/api/auth/refresh');
                    const refreshData = await refreshRes.json();
                    if (refreshData.success && refreshData.accessToken) {
                        studentData.accessToken = refreshData.accessToken;
                        localStorage.setItem('studentData', JSON.stringify(studentData));
                        res = await fetch(url, {
                            headers: { 'Authorization': 'Bearer ' + refreshData.accessToken }
                        });
                    } else {
                        window.location.href = '/logout';
                        return null;
                    }
                }

                if (!res.ok) {
                    console.warn('[scan-in] fetch failed', res.status);
                    return null;
                }

                const data = await res.json();
                _scanInWeekCache[key] = { timestamp: Date.now(), data };
                return data;
            } catch (e) {
                console.error('[scan-in] fetch threw', e);
                return null;
            }
        })();

        if (!forceFetch) _scanInFetchPromises[key] = fetchPromise;
        try {
            return await fetchPromise;
        } finally {
            if (!forceFetch) delete _scanInFetchPromises[key];
        }
    }

    // Finds the scan-in record for a specific date within a fetched week's data.
    function getScanInForDate(scanData, dateStr) {
        if (!scanData?.member) return null;
        return scanData.member.find(m => m.date === dateStr) || null;
    }

    function formatScanInTime(timestamp) {
        if (!timestamp) return '';
        const d = new Date(timestamp);
        const h = d.getHours();
        const m = d.getMinutes();
        const suffix = h >= 12 ? 'pm' : 'am';
        const h12 = h % 12 || 12;
        return h12 + ':' + String(m).padStart(2, '0') + suffix;
    }

    function formatScanInTimeFull(timestamp) {
        if (!timestamp) return '';
        const d = new Date(timestamp);
        const h = d.getHours();
        const m = d.getMinutes();
        const s = d.getSeconds();
        const suffix = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 || 12;
        return h12 + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0') + ' ' + suffix;
    }

    function formatResponseType(type) {
        if (!type) return '';
        if (type.toLowerCase().includes('authorised')) return 'Authorised';
        return type.charAt(0).toUpperCase() + type.slice(1);
    }

    // Renders the badge for whatever date is currently being viewed (currentDateStr),
    // using whatever week-cache data has been loaded for that date.
    function getScanInHtml() {
        const { key } = getWeekRange(currentDateStr);
        const weekData = _scanInWeekCache[key]?.data;
        if (!weekData) return '';

        const scanIn = getScanInForDate(weekData, currentDateStr);
        const isSchoolDay = !!calendarMap[currentDateStr];

        if (!scanIn) {
            if (isSchoolDay) {
                return \`<span id="scan-in-badge" class="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full text-xs font-semibold ml-2 flex-shrink-0" data-time="" data-location="" data-response="Not scanned in" data-output=""><span class="w-1.5 h-1.5 bg-red-500 rounded-full"></span>Not scanned in</span>\`;
            }
            return '';
        }

        const timeStr = formatScanInTime(scanIn.timestamp);
        const timeFull = formatScanInTimeFull(scanIn.timestamp);
        const location = scanIn.kiosk?.location || scanIn.kioskName || '';
        const responseType = formatResponseType(scanIn.response?.type);
        const responseOutput = scanIn.response?.output || '';
        return \`<span id="scan-in-badge" class="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full text-xs font-semibold cursor-pointer ml-2 flex-shrink-0" data-time="\${timeFull}" data-location="\${esc(location)}" data-response="\${esc(responseType)}" data-output="\${esc(responseOutput)}"><span class="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>\${timeStr}</span>\`;
    }

    function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

    function attachScanInBadge() {
        const badge = document.getElementById('scan-in-badge');
        if (!badge || badge._bound) return;
        badge._bound = true;
        badge.addEventListener('click', (e) => {
            e.stopPropagation();
            let popup = document.getElementById('scan-in-popup');
            if (popup) { popup.remove(); return; }
            popup = document.createElement('div');
            popup.id = 'scan-in-popup';
            popup.className = 'z-50 p-3 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-xl shadow-xl max-w-xs';
            const time = badge.dataset.time || '';
            const loc = badge.dataset.location || '';
            const resp = badge.dataset.response || '';
            const out = badge.dataset.output || '';
            popup.innerHTML = \`<div class="text-[10px] uppercase tracking-wider text-gray-400 dark:text-neutral-500 font-bold mb-2">Scan-in Details</div><div class="space-y-1.5 text-sm"><div class="flex justify-between"><span class="text-gray-500 dark:text-neutral-400">Time</span><span class="text-gray-900 dark:text-white font-medium">\${time}</span></div>\${loc ? \`<div class="flex justify-between"><span class="text-gray-500 dark:text-neutral-400">Location</span><span class="text-gray-900 dark:text-white font-medium">\${loc}</span></div>\` : ''}\${resp ? \`<div class="flex justify-between"><span class="text-gray-500 dark:text-neutral-400">Response</span><span class="text-gray-900 dark:text-white font-medium">\${resp}</span></div>\` : ''}\${out ? \`<div class="pt-1.5 mt-1.5 border-t border-gray-100 dark:border-neutral-700"><span class="text-gray-500 dark:text-neutral-400 text-xs">\${out}</span></div>\` : ''}</div>\`;
            const rect = badge.getBoundingClientRect();
            popup.style.position = 'fixed';
            popup.style.top = (rect.bottom + 8) + 'px';
            popup.style.left = Math.min(rect.left, window.innerWidth - 280) + 'px';
            document.body.appendChild(popup);
            const close = (ev) => { if (!popup.contains(ev.target) && ev.target !== badge) { popup.remove(); document.removeEventListener('click', close); } };
            setTimeout(() => document.addEventListener('click', close), 0);
        });
    }

    async function renderDay() {
        const url = new URL(window.location);
        url.searchParams.set('date', currentDateStr);
        window.history.replaceState({}, '', url);

        const dayInfo = calendarMap[currentDateStr];
        const d = new Date(currentDateStr);
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayName = days[d.getDay()];
        const day = d.getDate().toString().padStart(2, '0');
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const year = d.getFullYear();
        const dateFormatted = \`\${dayName}, \${day}/\${month}/\${year}\`;
        const isPaperTheme = document.documentElement.classList.contains('paper');
        const paperDateStr = isPaperTheme ? paperDateFormat(currentDateStr) : dateFormatted;
        const paperTermLabel = isPaperTheme ? getTermLabel(currentDateStr).replace('[ ', '/ ').replace(']', '').replace('Term ', 'Term ').replace(' Week ', ' \\u2022 Wk ') : getTermLabel(currentDateStr);
        
        document.getElementById('date-display').innerHTML = \`
            <div class="relative cursor-pointer group flex items-center gap-1.5 text-center leading-tight">
                <span class="z-10 bg-transparent text-gray-800 dark:text-neutral-200 font-bold whitespace-nowrap">\${paperDateStr}\${dayInfo ? ' [' + dayInfo.dayName[dayInfo.dayName.length - 1] + ']' : ''}\${paperTermLabel}</span>
                <svg class="w-4 h-4 flex-shrink-0 text-gray-400 dark:text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                <input type="date" id="date-picker-input" 
                       class="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-20"
                       value="\${currentDateStr}">
            </div>
        \`;
        
        const picker = document.getElementById('date-picker-input');
        if(picker) picker.onchange = (e) => { currentDateStr = e.target.value; render(); };

        const container = document.getElementById('timetable-list');
        container.className = 'space-y-1';

        // 1. Extract the rendering logic into a reusable function
        function buildUI(apiData, clipboardEvents, dayNotes) {
            container.innerHTML = '';
            
            if (!apiData && (!dayInfo || !daysData[dayInfo.dayNumber])) {
                const hasAnyData = Object.keys(daysData).length > 0;
                if (!hasAnyData) {
                    container.innerHTML = \`
                        <div class="text-center py-12">
                            <p class="text-gray-500 dark:text-neutral-400 mb-4">Timetable data not found.</p>
                            <a href="/api/auth/login" class="inline-flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg font-bold hover:bg-red-600 transition-colors">
                                Log in again to sync
                            </a>
                        </div>
                    \`;
                } else {
                    container.innerHTML = '<div class="text-center py-12 text-gray-500 dark:text-neutral-500">No classes scheduled.</div>';
                }
                return;
            }

            let periodsData = {};
            let currentBells = null;
            let classVariations = {};
            let roomVariations = {};

            if (apiData) {
                if (apiData.bells && apiData.bells.length > 0) {
                    currentBells = apiData.bells.map(b => ({
                        period: b.period || b.bell,  
                        startTime: b.startTime || b.time,
                        endTime: b.endTime || '23:59',
                        label: b.bellDisplay || b.bell || b.period
                    }));
                    bellCache[currentDateStr] = currentBells;
                }
                if (apiData.timetable?.timetable?.periods) periodsData = apiData.timetable.timetable.periods;
                if (apiData.classVariations) classVariations = apiData.classVariations;
                if (apiData.roomVariations) roomVariations = apiData.roomVariations;
            } else {
                if (dayInfo && daysData[dayInfo.dayNumber]) {
                    const dr = daysData[dayInfo.dayNumber];
                    periodsData = { ...dr.periods };
                    if (dr.rollcall) periodsData['RC'] = dr.rollcall;
                }
            }
            
            // Try to use newly fetched bells, otherwise cached bells, otherwise defaults
            const bellsToUse = currentBells || bellCache[currentDateStr] || DEFAULT_BELL_TIMES;
            
            bellsToUse.forEach(bell => {
                const pKey = bell.period; 
                let data = periodsData[pKey];
                const classVar = classVariations[pKey];
                const roomVar = roomVariations[pKey];
                
                // Enrich base data BEFORE checking variations so overrides don't get undone
                if (data) data = enrichPeriod(data);

                let highlightChange = false;
                let variationTags = [];
                let isSub = false;
                let isNoCover = false;
                
                // Set default teacher string from enriched base data
                let teacherDisplay = data ? (data.fullTeacher || data.teacher || '') : '';

                if (classVar && classVar.type !== 'novariation') {
                    highlightChange = true;
                    if (!data) {
                        data = { title: classVar.title || 'Variation', teacher: classVar.teacher };
                        data = enrichPeriod(data);
                    }
                    if (classVar.title) data.title = classVar.title;

                    // If it's a sub, completely replace the teacher string
                    if (classVar.casualSurname || classVar.casual) {
                        isSub = true;
                        teacherDisplay = classVar.casualSurname || classVar.casual || 'Sub';
                    } else if (classVar.type === 'nocover') {
                        isNoCover = true;
                    }
                }

                if (roomVar) {
                    highlightChange = true;
                    if (!data && roomVar.title) {
                         data = { title: roomVar.title, room: roomVar.roomFrom };
                         data = enrichPeriod(data);
                    }
                    if (data) {
                        data.room = roomVar.roomTo;
                        //variationTags.push('Room Change');
                    }
                }

                
                
                const isRCPeriod = bell.period === 'RC' || 
                   (typeof bell.label === 'string' && bell.label.startsWith('RC '));
                const isBreakCode = bell.period === 'R' || bell.period === 'L1' || bell.period === 'L2' || bell.period === 'EoD' || isRCPeriod;
                const hasContent = !!data && (!!data.title || !!data.subject) && !isBreakCode && !isRCPeriod;
                const stripColor = data?.color ? \`#\${data.color}\` : '#e5e7eb';
                const isMinorPeriod = !hasContent || bell.period === 'R' || bell.period === 'L1' || bell.period === 'L2' || bell.period === 'EoD' || isRCPeriod;
                const containerClass = isMinorPeriod ? 'min-h-[0.5rem]' : 'min-h-[2.8rem]';
                const timeWidth = 'w-24'; 
                const textSize = 'text-sm';
                const isPast = isTimePast(currentDateStr, bell.endTime);
                const opacityClass = isPast ? 'opacity-50 grayscale-[0.5]' : '';

                const isGlassTheme = document.documentElement.classList.contains('glass');

                function getGlassCardBg(hexColor) {
                    const c = hexColor.toLowerCase();
                    const map = {
                        '#5F7B8C': 'rgba(95,123,140,.45)',
                        '#896D73': 'rgba(137,109,115,.45)',
                        '#597068': 'rgba(89,112,104,.45)',
                        '#996830': 'rgba(153,104,48,.45)',
                        '#8A7A28': 'rgba(138,122,40,.45)',
                        '#726894': 'rgba(114,104,148,.45)',
                        '#262E36': 'rgba(38,46,54,.65)',
                        '#1F2937': 'rgba(31,41,55,.65)',
                        '#4B4B4B': 'rgba(75,75,75,.45)',
                        '#D4AF37': 'rgba(212,175,55,.4)',
                        '#CBD5E1': 'rgba(203,213,225,.35)',
                        '#2F4F4F': 'rgba(47,79,79,.45)',
                        '#FFD700': 'rgba(255,215,0,.4)',
                        '#6B7280': 'rgba(107,114,128,.45)',
                        '#1E293B': 'rgba(30,41,59,.65)',
                        '#27272A': 'rgba(39,39,42,.65)',
                        '#374151': 'rgba(55,65,81,.5)',
                        '#556B2F': 'rgba(85,107,47,.45)',
                        '#4682B4': 'rgba(70,130,180,.45)',
                        '#9B59B6': 'rgba(155,89,182,.45)',
                        '#0E7490': 'rgba(14,116,144,.45)',
                        '#0284C7': 'rgba(2,132,199,.45)',
                        '#2563EB': 'rgba(37,99,235,.45)',
                        '#9333EA': 'rgba(147,51,234,.45)',
                        '#7C3AED': 'rgba(124,58,237,.45)',
                    };
                    if (map[c]) return map[c];
                    const r = parseInt(c.slice(1,3),16), g = parseInt(c.slice(3,5),16), b = parseInt(c.slice(5,7),16);
                    if (!isNaN(r) && !isNaN(g) && !isNaN(b)) return 'rgba('+r+','+g+','+b+',.35)';
                    return 'rgba(95,123,140,.35)';
                }

                const periodNotes = data?.subjectCode ? dayNotes.filter(n => n.class_name === data.subjectCode) : [];
                const notesCount = periodNotes.length;
                const notesBadge = notesCount > 0 ? \`<span class="ml-2 px-1.5 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-[10px] font-bold rounded">\${notesCount}</span>\` : '';

                let notesPreviewHtml = '';
                if (notesCount > 0) {
                    const firstNote = periodNotes[0];
                    const previewText = firstNote.content.length > 40 ? firstNote.content.substring(0, 40) + '...' : firstNote.content;
                    notesPreviewHtml = \`<div class="mt-2 text-xs bg-gray-700 dark:bg-neutral-900/50 p-2 rounded italic text-gray-300 dark:text-neutral-400 break-words">\${previewText}</div>\`;
                }
                let linkPreviewHtml = data?.link ? \`<div class="mt-1 text-[10px] text-blue-400 flex items-center gap-1"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg> Link Available (Cmd/Ctrl + K)</div>\` : '';

                let innerHtml = '';
                if (hasContent) {
                    const nextTimeStr = getNextSubjectOccurrence(data.subjectCode, currentDateStr, bell.period);
                    const miniCycle = getMiniCycleHtml(data.subjectCode, stripColor);
                    const ringColorClass = isGlassTheme ? 'ring-[#5F7B8C]' : document.documentElement.classList.contains('night') ? 'ring-purple-500' : 'ring-red-500';
                    const borderClass = highlightChange ? ('ring-2 ' + ringColorClass + ' ring-offset-2 dark:ring-offset-neutral-900') : '';
                    
                    let changedBadge = '';
                    if (variationTags.length > 0) {
                        const badgeClasses = isGlassTheme ? 'bg-[#5F7B8C]/20 text-[#7FA0B0]' : 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400';
                        changedBadge = \`<span class="ml-2 px-1.5 py-0.5 \${badgeClasses} text-[10px] font-bold rounded animate-pulse">\${variationTags[0]}</span>\`;
                    }

                    const roomColorClass = isGlassTheme ? 'text-white font-extrabold' : (highlightChange && (roomVar || (classVar && classVar.roomTo))) ? 'text-red-600 dark:text-red-400 font-extrabold' : 'text-gray-900 dark:text-white';
                    
                    const cardBgClass = isGlassTheme
                        ? (isNoCover ? 'bg-[#896D73]/30 line-through' : 'bg-transparent')
                        : (isNoCover ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 line-through' : 'bg-gray-100 dark:bg-neutral-800');
                    const titleColorClass = isGlassTheme ? 'text-white' : (isNoCover ? 'text-red-700 dark:text-red-400' : 'text-gray-900 dark:text-white');
                    
                    const teacherColorClass = isGlassTheme
                        ? (isSub ? 'text-white font-bold' : 'text-white/80')
                        : (isNoCover ? 'text-red-700 dark:text-red-400' : (isSub ? 'text-red-600 dark:text-red-400 font-bold' : 'text-gray-900 dark:text-gray-100'));

                    const glassCardStyle = isGlassTheme ? \` style="background:\${isNoCover ? 'rgba(137,109,115,.45)' : getGlassCardBg(stripColor)}"\` : '';

                    innerHtml = \`
                        <div class="period-card relative flex items-center justify-between \${cardBgClass} rounded-lg p-2.5 shadow-sm hover:bg-opacity-80 transition-all cursor-default group \${borderClass}"\${glassCardStyle}
                            data-subject="\${data.subjectCode}"
                            data-title="\${data.title || data.subject || ''}"
                            data-teacher="\${teacherDisplay}"
                            data-room="\${data.room || ''}"
                            data-start="\${bell.startTime}"
                            data-end="\${bell.endTime}"
                            data-link="\${data.link || ''}"
                            data-color="\${stripColor}">
                                <div class="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-lg" style="background-color: \${stripColor};"></div>
                                <div class="pl-3 font-medium \${titleColorClass} \${textSize} flex items-center" data-accent-text style="--strip-color: \${stripColor}">
                                    \${data.title || data.subject || 'Unknown'}
                                    \${changedBadge}
                                    \${notesBadge}
                                </div>
                                <div class="pl-3 flex items-center gap-4 \${textSize}">
                                    <span class="\${teacherColorClass}">\${teacherDisplay}</span>
                                    \${data.room ? \`<span class="font-bold \${roomColorClass}" data-accent-text style="--strip-color: \${stripColor}">\${data.room}</span>\` : ''}
                                </div>
                                <div class="tooltip-content absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block z-30 min-w-[200px] p-3 bg-gray-800 dark:bg-neutral-950 text-white text-xs rounded-lg shadow-xl pointer-events-none transform -translate-y-1">
                                    <div class="flex justify-between items-center mb-2 border-b border-gray-600 dark:border-neutral-700 pb-2">
                                        <span class="font-bold text-sm">\${data.title}</span>
                                        <span class="text-gray-300 dark:text-neutral-400 font-mono">\${nextTimeStr}</span>
                                    </div>
                                    \${highlightChange && (variationTags.length > 0 || isSub || isNoCover) ? '<div class="text-red-400 dark:text-red-500 font-bold mb-1">' + (isNoCover ? 'No Cover' : (isSub ? 'Sub: ' + teacherDisplay : variationTags.join(', '))) + '</div>' : ''}
                                    <div class="text-[10px] text-gray-400 dark:text-neutral-500 mb-1 uppercase tracking-wider">Cycle</div>
                                    \${miniCycle}
                                    \${linkPreviewHtml}
                                    \${notesPreviewHtml}
                                </div>
                        </div>\`;
                } else {
                    if (bell.period === 'EoD') return;
                    innerHtml = \`
                        <div class="pl-2 text-gray-400 dark:text-neutral-500 text-xs py-1">\${bell.label}</div>
                    \`;
                }

                const html = \`
                    <div class="flex items-center \${containerClass} \${opacityClass} transition-opacity duration-500">
                        <div class="\${timeWidth} text-right pr-4 text-gray-500 dark:text-neutral-500 font-medium \${textSize}">\${formatTime(bell.startTime)}</div>
                        <div class="flex-grow">\${innerHtml}</div>
                    </div>
                \`;

                
                container.insertAdjacentHTML('beforeend', html);
                
            });
            
            // Split clipboard events (handle both new "startDateTime" format and old "start" format)
            function getEventStart(e) {
                return new Date(e.startDateTime || e.start);
            }
            const morningEvents = clipboardEvents.filter(e => {
                const d = getEventStart(e);
                return !isNaN(d) && d.getHours() < 12;
            });
            const afternoonEvents = clipboardEvents.filter(e => {
                const d = getEventStart(e);
                return !isNaN(d) && d.getHours() >= 12;
            });

            function renderClipboardEvent(event) {
                const isNewFormat = !!event.startDateTime;
                const start = isNewFormat ? new Date(event.startDateTime) : new Date(event.start);
                const end = isNewFormat ? new Date(event.endDateTime) : new Date(event.end);
                const timeStr = formatTime(start.toTimeString().slice(0, 5));
                const endTimeStr = formatTime(end.toTimeString().slice(0, 5));

                const title = isNewFormat ? (event.title || event.activity?.name || '') : (event.summary || '');
                const hexColour = isNewFormat ? (event.activity?.hexColour || '3b82f6') : '3b82f6';
                const color = '#' + hexColour;
                const activityName = isNewFormat ? (event.activity?.name || title) : title;
                const locationName = isNewFormat ? (event.location?.name || '') : '';
                const locationLat = event.location?.latitude;
                const locationLng = event.location?.longitude;
                const locationAddr = event.location?.address || '';

                let mapsUrl = '';
                if (locationLat && locationLng) {
                    mapsUrl = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(locationLat + ',' + locationLng);
                } else if (locationAddr) {
                    mapsUrl = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(locationAddr);
                }

                const eventNotes = dayNotes.filter(n => n.class_name === title);
                const notesCount = eventNotes.length;
                const notesBadgeHtml = notesCount > 0 ? \`<span class="ml-2 px-1.5 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-[10px] font-bold rounded">\${notesCount}</span>\` : '';

                let eventNotesPreviewHtml = '';
                if (notesCount > 0) {
                    const firstNote = eventNotes[0];
                    const previewText = firstNote.content.length > 40 ? firstNote.content.substring(0, 40) + '...' : firstNote.content;
                    eventNotesPreviewHtml = \`<div class="mt-2 text-xs bg-gray-700 dark:bg-neutral-900/50 p-2 rounded italic text-gray-300 dark:text-neutral-400 break-words">\${previewText}</div>\`;
                }

                let tagsHtml = '';
                if (isNewFormat) {
                    const tags = [];
                    if (event.cancelled) tags.push('<span class="px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-[10px] font-bold rounded">Cancelled</span>');
                    if (event.scored) tags.push('<span class="px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[10px] font-bold rounded">Scored</span>');
                    if (event.optional) tags.push('<span class="px-1.5 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-[10px] font-bold rounded">Optional</span>');
                    if (event.bye) tags.push('<span class="px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-[10px] font-bold rounded">Bye</span>');
                    if (event.status && event.status !== 'confirmed') tags.push('<span class="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-[10px] font-bold rounded">' + esc(event.status) + '</span>');
                    if (tags.length > 0) tagsHtml = '<span class="ml-2 flex items-center gap-1 flex-shrink-0">' + tags.join('') + '</span>';
                }

                let locationHtml = '';
                if (mapsUrl) {
                    locationHtml = '<a href="' + esc(mapsUrl) + '" target="_blank" rel="noopener" class="mt-1.5 text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1"><svg class="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>' + esc(locationName || locationAddr) + '</a>';
                } else if (locationName) {
                    locationHtml = '<div class="mt-1.5 text-[10px] text-gray-400 dark:text-neutral-500">' + esc(locationName) + '</div>';
                }

                let detailsHtml = '';
                if (isNewFormat) {
                    const detailLines = [];
                    if (event.opponent) detailLines.push('<div class="flex justify-between"><span class="text-gray-500 dark:text-neutral-400">Opponent</span><span class="text-gray-900 dark:text-white font-medium">' + esc(event.opponent) + '</span></div>');
                    if (event.roundName) detailLines.push('<div class="flex justify-between"><span class="text-gray-500 dark:text-neutral-400">Round</span><span class="text-gray-900 dark:text-white font-medium">' + esc(event.roundName) + '</span></div>');
                    if (event.organisationScore !== null || event.opponentScore !== null) detailLines.push('<div class="flex justify-between"><span class="text-gray-500 dark:text-neutral-400">Score</span><span class="text-gray-900 dark:text-white font-medium">' + (event.organisationScore ?? 0) + ' - ' + (event.opponentScore ?? 0) + '</span></div>');
                    if (event.result) detailLines.push('<div class="flex justify-between"><span class="text-gray-500 dark:text-neutral-400">Result</span><span class="text-gray-900 dark:text-white font-medium">' + esc(event.result) + '</span></div>');
                    if (event.notes) detailLines.push('<div class="mt-1.5 text-[10px] text-gray-400 dark:text-neutral-500 italic">' + esc(event.notes) + '</div>');
                    if (event.studentParentNotes) detailLines.push('<div class="mt-1 text-[10px] text-gray-400 dark:text-neutral-500 italic">' + esc(event.studentParentNotes) + '</div>');
                    if (event.resultNotes) detailLines.push('<div class="mt-1 text-[10px] text-gray-400 dark:text-neutral-500 italic">' + esc(event.resultNotes) + '</div>');
                    if (detailLines.length > 0) detailsHtml = '<div class="space-y-1 mt-2 pt-2 border-t border-gray-600 dark:border-neutral-700">' + detailLines.join('') + '</div>';
                } else {
                    const locText = event.location || '';
                    const descText = event.description || '';
                    if (locText) detailsHtml += '<div class="mt-1.5 text-[10px] text-gray-400 dark:text-neutral-500">' + esc(locText) + '</div>';
                    if (descText) detailsHtml += '<div class="mt-1 text-[10px] text-gray-400 dark:text-neutral-500 italic">' + esc(descText) + '</div>';
                }

                const cardBorderClass = event.cancelled ? 'opacity-60' : '';
                const cardLineClass = event.cancelled ? 'line-through' : '';
                const titleSizeClass = title.length > 30 ? 'text-xs' : 'text-sm';

                return \`
                    <div class="flex items-center min-h-[2rem] opacity-90 transition-opacity duration-500 hover:opacity-100 mb-2">
                        <div class="w-24 text-right pr-4 font-bold text-sm" style="color: \${color};">\${timeStr}</div>
                        <div class="flex-grow">
                            <div class="period-card relative flex items-center justify-between rounded-lg p-2.5 shadow-sm hover:bg-opacity-80 transition-all cursor-default group border-l-4 \${cardBorderClass}"
                                style="background-color: \${color}15; border-color: \${color};"
                                data-subject="\${esc(activityName)}"
                                data-title="\${esc(title)}"
                                data-start="\${timeStr}"
                                data-end="\${endTimeStr}">
                                <div class="pl-2 font-medium text-gray-900 dark:text-white flex items-center \${titleSizeClass}">
                                    <span class="\${cardLineClass}">\${esc(title)}</span>
                                    \${tagsHtml}
                                    \${notesBadgeHtml}
                                </div>
                                <div class="tooltip-content absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block z-30 min-w-[220px] p-3 bg-gray-800 dark:bg-neutral-950 text-white text-xs rounded-lg shadow-xl pointer-events-none transform -translate-y-1">
                                    <div class="font-bold mb-1 text-sm border-b border-gray-600 dark:border-neutral-700 pb-1">\${esc(title)}</div>
                                    <div class="mb-1 text-gray-300 dark:text-neutral-400 font-mono">\${timeStr} - \${endTimeStr}</div>
                                    \${locationHtml}
                                    \${detailsHtml}
                                    \${eventNotesPreviewHtml}
                                </div>
                            </div>
                        </div>
                    </div>
                \`;
            }

            // Prepend morning events
            if (morningEvents.length > 0) {
                const morningHtml = morningEvents.map(renderClipboardEvent).join('');
                container.insertAdjacentHTML('afterbegin', '<div class="mb-2 space-y-2">' + morningHtml + '</div>');
            }

            // Append afternoon events
            if (afternoonEvents.length > 0) {
                const afternoonHtml = afternoonEvents.map(renderClipboardEvent).join('');
                container.insertAdjacentHTML('beforeend', '<div class="mt-2 pt-4 border-t border-gray-200 dark:border-neutral-700 space-y-2">' + afternoonHtml + '</div>');
            }

            attachHoverEffects();

            // Attach scan-in badge click handler (badge is rendered by ticker in bt-details)
            attachScanInBadge();

            startTicker();
        }

        // --- 2. FAST PASS (Synchronous Render) ---
        // Render immediately using local/cached base timetable arrays
        buildUI(null, [], []);

        // Compute date window for clipboard sessions (7 days before, 14 days after)
        const [_y, _m, _d] = currentDateStr.split('-').map(Number);
        const _dAfter = new Date(_y, _m - 1, _d); _dAfter.setDate(_dAfter.getDate() - 7);
        const _dBefore = new Date(_y, _m - 1, _d); _dBefore.setDate(_dBefore.getDate() + 14);
        const sessionsDateAfter = _dAfter.toISOString().split('T')[0];
        const sessionsDateBefore = _dBefore.toISOString().split('T')[0];

        // --- 3. STALE PASS (Cached Render) ---
        // If we have any cached data from previous sessions, show it immediately
        const cachedApi = getCachedDayData(currentDateStr);
        const cachedCal = getCachedCalendarData(currentDateStr);
        const cachedSessions = getCachedClipboardSessions(sessionsDateAfter, sessionsDateBefore);
        const cachedSessionsForDate = getClipboardSessionsForDate(cachedSessions, currentDateStr);
        if (cachedApi || (cachedCal && cachedCal.length > 0) || cachedSessionsForDate.length > 0) {
            buildUI(cachedApi, [...cachedSessionsForDate, ...(cachedCal || [])], []);
        }

        // Fetch scan-in data for the week containing the *viewed* date (not just "today").
        // Cheap no-op if that week is already cached and fresh.
        const scanInSnapshotDate = currentDateStr;
        fetchScanIns(currentDateStr).then(() => {
            // Only refresh the ticker if we're still looking at the date this fetch was for
            if (currentDateStr === scanInSnapshotDate && window.updateTicker) {
                window.updateTicker();
                attachScanInBadge();
            }
        }).catch(() => {});

        // Capture snapshot to prevent overwriting if user has navigated away or changed date
        const snapshotDate = currentDateStr;
        const snapshotView = currentView;

        // Only force-fetch for today/future dates (past dates are static)
        const todayStr = getLocalDateStr();
        const shouldForceFetch = currentDateStr >= todayStr;

        // --- 4. BACKGROUND PASS (Asynchronous Fetch & Update) ---
        // Fetch fresh data in the background and re-render quietly when they arrive
        try {
            const [apiData, clipboardEvents, clipboardSessions, notesRes] = await Promise.all([
                fetchDayData(currentDateStr, shouldForceFetch),
                fetchCalendarData(currentDateStr, shouldForceFetch),
                fetchClipboardSessions(shouldForceFetch, sessionsDateAfter, sessionsDateBefore),
                fetch('/timetable/notes?date=' + currentDateStr).then(res => res.json()).catch(() => ({ notes: [] }))
            ]);
            
            // If the user has changed view or date while we were fetching, Don't overwrite the DOM
            if (currentDateStr !== snapshotDate || currentView !== snapshotView) {
                return;
            }

            const dayNotes = notesRes?.notes || [];
            
            const sessionsForDate = getClipboardSessionsForDate(clipboardSessions, currentDateStr);
            const mergedClipboard = [...sessionsForDate, ...(clipboardEvents || [])];
            
            // Final Render: Overwrite DOM structure seamlessly with real-time data
            buildUI(apiData, mergedClipboard, dayNotes);

            // Pre-fetch next weekday in the background (no force — let cache work)
            if (shouldForceFetch) {
                const [y, m, d] = currentDateStr.split('-').map(Number);
                const nextDay = new Date(y, m - 1, d);
                let tries = 0;
                while (tries < 7) {
                    nextDay.setDate(nextDay.getDate() + 1);
                    const dw = nextDay.getDay();
                    if (dw !== 0 && dw !== 6) break;
                    tries++;
                }
                if (tries < 7) {
                    const ny = nextDay.getFullYear();
                    const nm = String(nextDay.getMonth() + 1).padStart(2, '0');
                    const nd = String(nextDay.getDate()).padStart(2, '0');
                    const nextStr = \`\${ny}-\${nm}-\${nd}\`;
                    fetchDayData(nextStr, false);
                    fetchCalendarData(nextStr, false);
                }
            }
            
        } catch (error) {
            console.error("Failed to fetch fresh data in the background:", error);
            const container = document.getElementById('timetable-list');
            if (container && currentDateStr === snapshotDate && currentView === snapshotView) {
                container.innerHTML = '<div class="text-center py-12 text-red-500 dark:text-red-400 font-medium"><a href="/api/auth/login" class="underline">Log in again</a> to sync.</div>';
            }
        }
    }
</script>
`