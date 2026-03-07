import { html } from 'hono/html'

export const TimetableDay = html`
<script>
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
        
        document.getElementById('date-display').innerHTML = \`
            <div class="relative cursor-pointer group flex items-center gap-2">
                <span class="z-10 bg-transparent text-gray-800 dark:text-neutral-200 font-bold">\${dateFormatted} \${dayInfo ? ' [' + dayInfo.dayName[dayInfo.dayName.length - 1] + ']' : ''}</span>
                <svg class="w-4 h-4 text-gray-400 dark:text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
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
                container.innerHTML = '<div class="text-center py-12 text-gray-500 dark:text-neutral-500">No classes scheduled.</div>';
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
                        variationTags.push('Room Change');
                    }
                }

                const hasContent = !!data && (!!data.title || !!data.subject);
                const stripColor = data?.color ? \`#\${data.color}\` : '#e5e7eb';
                const isMinorPeriod = !hasContent || bell.period === 'R' || bell.period === 'L1' || bell.period === 'L2' || bell.period === 'EoD';
                const containerClass = isMinorPeriod ? 'min-h-[0.5rem]' : 'min-h-[2.8rem]';
                const timeWidth = 'w-24'; 
                const textSize = 'text-sm';
                const isPast = isTimePast(currentDateStr, bell.endTime);
                const opacityClass = isPast ? 'opacity-50 grayscale-[0.5]' : '';

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
                    const borderClass = highlightChange ? 'ring-2 ring-red-500 ring-offset-2 dark:ring-offset-neutral-900' : '';
                    
                    let changedBadge = '';
                    if (variationTags.length > 0) {
                        changedBadge = \`<span class="ml-2 px-1.5 py-0.5 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 text-[10px] font-bold rounded animate-pulse">\${variationTags[0]}</span>\`;
                    }

                    const roomColorClass = (highlightChange && (roomVar || (classVar && classVar.roomTo))) ? 'text-red-600 dark:text-red-400 font-extrabold' : 'text-gray-900 dark:text-white';
                    
                    const cardBgClass = isNoCover ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 line-through' : 'bg-gray-100 dark:bg-neutral-800';
                    const titleColorClass = isNoCover ? 'text-red-700 dark:text-red-400' : 'text-gray-900 dark:text-white';
                    
                    // Mark the substitute teacher in bold red, or just normal styling for standard periods
                    const teacherColorClass = isNoCover ? 'text-red-700 dark:text-red-400' : (isSub ? 'text-red-600 dark:text-red-400 font-bold' : 'text-gray-900 dark:text-gray-100');

                    innerHtml = \`
                        <div class="period-card relative flex items-center justify-between \${cardBgClass} rounded-lg p-2.5 shadow-sm hover:bg-opacity-80 transition-all cursor-default group \${borderClass}"
                            data-subject="\${data.subjectCode}"
                            data-title="\${data.title || data.subject || ''}"
                            data-teacher="\${teacherDisplay}"
                            data-room="\${data.room || ''}"
                            data-start="\${bell.startTime}"
                            data-end="\${bell.endTime}"
                            data-link="\${data.link || ''}"
                            data-color="\${stripColor}">
                                <div class="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-lg" style="background-color: \${stripColor};"></div>
                                <div class="pl-3 font-medium \${titleColorClass} \${textSize} flex items-center">
                                    \${data.title || data.subject || 'Unknown'}
                                    \${changedBadge}
                                    \${notesBadge}
                                </div>
                                <div class="pl-3 flex items-center gap-4 \${textSize}">
                                    <span class="\${teacherColorClass}">\${teacherDisplay}</span>
                                    \${data.room ? \`<span class="font-bold \${roomColorClass}">\${data.room}</span>\` : ''}
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
            
            // Split clipboard events
            const morningEvents = clipboardEvents.filter(e => {
                const d = new Date(e.start);
                return d.getHours() < 12;
            });
            const afternoonEvents = clipboardEvents.filter(e => {
                const d = new Date(e.start);
                return d.getHours() >= 12;
            });

            function renderClipboardEvent(event) {
                const start = new Date(event.start);
                const end = new Date(event.end);
                const timeStr = formatTime(start.toTimeString().slice(0, 5));
                const endTimeStr = formatTime(end.toTimeString().slice(0, 5));
                
                const eventNotes = dayNotes.filter(n => n.class_name === event.summary);
                const notesCount = eventNotes.length;
                const notesBadgeHtml = notesCount > 0 ? \`<span class="ml-2 px-1.5 py-0.5 bg-yellow-100 text-yellow-700 text-[10px] font-bold rounded">\${notesCount}</span>\` : '';

                let eventNotesPreviewHtml = '';
                if (notesCount > 0) {
                    const firstNote = eventNotes[0];
                    const previewText = firstNote.content.length > 40 ? firstNote.content.substring(0, 40) + '...' : firstNote.content;
                    eventNotesPreviewHtml = \`<div class="mt-2 text-xs bg-gray-700 p-2 rounded italic text-gray-300 break-words">\${previewText}</div>\`;
                }

                return \`
                        <div class="flex items-center min-h-[2rem] opacity-90 transition-opacity duration-500 hover:opacity-100 mb-2">
                        <div class="w-24 text-right pr-4 text-blue-500 dark:text-blue-400 font-bold text-sm">\${timeStr}</div>
                        <div class="flex-grow">
                            <div class="period-card relative flex items-center justify-between bg-blue-50 dark:bg-neutral-800 rounded-lg p-2.5 shadow-sm hover:bg-blue-100 dark:hover:bg-neutral-700 transition-all cursor-default group border-l-4 border-blue-500"
                                data-subject="\${event.summary}"
                                data-title="\${event.summary}"
                                data-start="\${timeStr}"
                                data-end="\${endTimeStr}">
                                <div class="pl-2 font-medium text-gray-900 dark:text-white text-sm flex items-center">
                                    \${event.summary}
                                    \${notesBadgeHtml}
                                </div>
                                <div class="tooltip-content absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block z-30 min-w-[200px] p-2.5 bg-gray-800 dark:bg-neutral-950 text-white text-xs rounded-lg shadow-xl pointer-events-none transform -translate-y-1">
                                    <div class="font-bold mb-1 text-sm border-b border-gray-600 dark:border-neutral-700 pb-1">\${event.summary}</div>
                                    <div class="mb-1 text-gray-300 dark:text-neutral-400 font-mono">\${timeStr} - \${endTimeStr}</div>
                                    <div class="pl-3 flex items-center gap-4 text-sm text-gray-600 dark:text-neutral-400">
                                        \${event.location || ''}
                                    </div>
                                    <div class="text-gray-400 dark:text-neutral-500 italic">\${event.description || 'No description'}</div>
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
            startTicker();
        }

        // --- 2. FAST PASS (Synchronous Render) ---
        // Render immediately using local/cached base timetable arrays
        buildUI(null, [], []);

        // --- 3. STALE PASS (Cached Render) ---
        // If we have any cached data from previous sessions, show it immediately
        const cachedApi = getCachedDayData(currentDateStr);
        const cachedCal = getCachedCalendarData(currentDateStr);
        if (cachedApi || (cachedCal && cachedCal.length > 0)) {
            buildUI(cachedApi, cachedCal || [], []);
        }

        // Capture snapshot to prevent overwriting if user has navigated away or changed date
        const snapshotDate = currentDateStr;
        const snapshotView = currentView;

        // --- 4. BACKGROUND PASS (Asynchronous Fetch & Update) ---
        // Fetch fresh data in the background and re-render quietly when they arrive
        try {
            const [apiData, clipboardEvents, notesRes] = await Promise.all([
                fetchDayData(currentDateStr, true),
                fetchCalendarData(currentDateStr, true),
                fetch('/timetable/notes?date=' + currentDateStr).then(res => res.json()).catch(() => ({ notes: [] }))
            ]);
            
            // If the user has changed view or date while we were fetching, Don't overwrite the DOM
            if (currentDateStr !== snapshotDate || currentView !== snapshotView) {
                return;
            }

            const dayNotes = notesRes?.notes || [];
            
            // Final Render: Overwrite DOM structure seamlessly with real-time data
            buildUI(apiData, clipboardEvents || [], dayNotes);
            
        } catch (error) {
            console.error("Failed to fetch fresh data in the background:", error);
        }
    }
</script>
`