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
                <span class="z-10 bg-transparent">\${dateFormatted} \${dayInfo ? ' [' + dayInfo.dayName[dayInfo.dayName.length - 1] + ']' : ''}</span>
                <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                <input type="date" id="date-picker-input" 
                       class="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-20"
                       value="\${currentDateStr}">
            </div>
        \`;
        
        const picker = document.getElementById('date-picker-input');
        if(picker) picker.onchange = (e) => { currentDateStr = e.target.value; render(); };

        const container = document.getElementById('timetable-list');
        container.innerHTML = '<div class="text-center py-12 text-gray-500">Checking for updates...</div>';
        container.className = 'space-y-4';

        const apiData = await fetchDayData(currentDateStr);
        container.innerHTML = '';
        
        if (!apiData && (!dayInfo || !daysData[dayInfo.dayNumber])) {
            container.innerHTML = '<div class="text-center py-12 text-gray-500">No classes scheduled.</div>';
            return;
        }

        let periodsData = {};
        let currentBells = null;
        let classVariations = {};
        let roomVariations = {};

        if (apiData) {
            if (apiData.bells && apiData.bells.length > 0) {
                if(bellCache[currentDateStr]) {
                    currentBells = bellCache[currentDateStr];
                } else {
                    currentBells = apiData.bells.map(b => ({
                        period: b.period || b.bell,  
                        startTime: b.startTime || b.time,
                        endTime: b.endTime || '23:59',
                        label: b.bellDisplay || b.bell || b.period
                    }));
                    bellCache[currentDateStr] = currentBells;
                }
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
        
        const bellsToUse = currentBells || DEFAULT_BELL_TIMES;
        
        bellsToUse.forEach(bell => {
            const pKey = bell.period; 
            let data = periodsData[pKey];
            const classVar = classVariations[pKey];
            const roomVar = roomVariations[pKey];
            
            if (data) data = enrichPeriod(data);

            let highlightChange = false;
            let variationTags = [];

            if (classVar && classVar.type !== 'novariation') {
                highlightChange = true;
                if (!data) data = { title: classVar.title || 'Variation', teacher: classVar.teacher };
                if (classVar.title) data.title = classVar.title;
                if (classVar.casualSurname) {
                    data.fullTeacher = classVar.casualSurname;
                    data.teacher = classVar.casual || classVar.casualSurname;
                    variationTags.push('Sub: ' + classVar.casualSurname);
                } else if (classVar.type === 'nocover') {
                    variationTags.push('No Cover');
                }
                data = enrichPeriod(data);
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
            const containerClass = isMinorPeriod ? 'min-h-[1.5rem]' : 'min-h-[3rem]';
            const timeWidth = 'w-24'; 
            const textSize = 'text-sm';
            const isPast = isTimePast(currentDateStr, bell.endTime);
            const opacityClass = isPast ? 'opacity-90 grayscale-[0.1]' : '';

            let innerHtml = '';
            if (hasContent) {
                const nextTimeStr = getNextSubjectOccurrence(data.subjectCode, currentDateStr, bell.period);
                const miniCycle = getMiniCycleHtml(data.subjectCode, stripColor);
                const borderClass = highlightChange ? 'ring-2 ring-red-500 ring-offset-2' : '';
                const badgeText = variationTags.length > 0 ? variationTags[0] : 'UPDATED';
                const changedBadge = highlightChange ? \`<span class="ml-2 px-1.5 py-0.5 bg-red-100 text-red-600 text-[10px] font-bold rounded animate-pulse">\${badgeText}</span>\` : '';
                const roomColorClass = (highlightChange && (roomVar || (classVar && classVar.roomTo))) ? 'text-red-600 font-extrabold' : 'text-black';

                innerHtml = \`
                    <div class="period-card relative flex items-center justify-between bg-gray-100 rounded-lg p-3 shadow-sm hover:bg-gray-50 transition-all cursor-default group \${borderClass}"
                        data-subject="\${data.subjectCode}"
                        data-title="\${data.title || data.subject || ''}"
                        data-teacher="\${data.fullTeacher || data.teacher || ''}"
                        data-room="\${data.room || ''}"
                        data-start="\${bell.startTime}"
                        data-end="\${bell.endTime}"
                        data-color="\${stripColor}">
                        <div class="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-lg" style="background-color: \${stripColor};"></div>
                        <div class="pl-3 font-medium text-gray-900 \${textSize} flex items-center">
                            \${data.title || data.subject || 'Unknown'}
                            \${changedBadge}
                        </div>
                        <div class="pl-3 flex items-center gap-4 \${textSize}">
                            <span class="text-gray-900">\${data.fullTeacher || data.teacher || ''}</span>
                            \${data.room ? \`<span class="font-bold \${roomColorClass}">\${data.room}</span>\` : ''}
                        </div>
                        <div class="tooltip-content absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block z-30 min-w-[200px] p-3 bg-gray-800 text-white text-xs rounded-lg shadow-xl pointer-events-none transform -translate-y-1">
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
                    <div class="pl-2 text-gray-400 text-xs py-1">\${bell.label}</div>
                \`;
            }

            const html = \`
                <div class="flex items-center \${containerClass} \${opacityClass} transition-opacity duration-500">
                    <div class="\${timeWidth} text-right pr-4 text-gray-500 font-medium \${textSize}">\${formatTime(bell.startTime)}</div>
                    <div class="flex-grow">\${innerHtml}</div>
                </div>
            \`;
            container.insertAdjacentHTML('beforeend', html);
        });

        attachHoverEffects();
        startTicker();
    }
</script>
`
