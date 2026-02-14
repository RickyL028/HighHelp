import { html } from 'hono/html'

export const TimetableTicker = html`
<script>
    function startTicker() {
        if (tickerInterval) clearInterval(tickerInterval);
        updateTicker(); 
        tickerInterval = setInterval(updateTicker, 1000);
    }

    async function findNextPeriod(now) {
        for(let i=0; i<30; i++) { 
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
            let bells = bellCache[dateStr];
            if (!bells) {
                try {
                    const fetched = await fetchDayData(dateStr);
                    if (fetched && bellCache[dateStr]) {
                        bells = bellCache[dateStr];
                    }
                } catch(e) { console.error('Ticker fetch error', e); }
            }
            if (!bells) bells = DEFAULT_BELL_TIMES;
            for(let bell of bells) {
                if(bell.period === 'EoD') continue;
                const [sh, sm] = bell.startTime.split(':').map(Number);
                const bellStart = new Date(d);
                bellStart.setHours(sh, sm, 0, 0);
                const [eh, em] = bell.endTime.split(':').map(Number);
                const bellEnd = new Date(d);
                bellEnd.setHours(eh, em, 0, 0);
                if (bellEnd <= now) continue;
                let pData = null;
                let isBreak = false;
                const breakCodes = ['R', 'L1', 'L2', 'MTL1', 'MTL2', 'WFL1', 'WFL2', 'Recess', 'Lunch'];
                if (breakCodes.includes(bell.period) || bell.type === 'L' || bell.type === 'R') {
                    isBreak = true;
                    pData = { title: bell.label, isBreak: true };
                } else {
                    if (dData.periods && dData.periods[bell.period]) {
                        pData = dData.periods[bell.period];
                    } else if (bell.period === 'RC' && dData.rollcall) {
                        pData = dData.rollcall;
                    } else if (bell.period === '0' && dData.periods && dData.periods['0']) {
                        pData = dData.periods['0'];
                    }
                }
                if(pData) {
                    const enriched = isBreak ? pData : enrichPeriod(pData);
                    if (enriched && (enriched.subject || enriched.title)) {
                        const isCurrent = (now >= bellStart && now < bellEnd);
                        return {
                            date: isCurrent ? bellEnd : bellStart,
                            isCurrent: isCurrent,
                            period: bell.label || bell.period,
                            subject: enriched.title || enriched.subject || 'Unknown',
                            room: enriched.room,
                            teacher: enriched.fullTeacher || enriched.teacher,
                            dayLabel: i === 0 ? 'Today' : (i===1 ? 'Tomorrow' : dayInfo.dayName)
                        };
                    }
                }
            }
        }
        return null;
    }

    async function updateTicker() {
        if (isTickerUpdating) return;
        isTickerUpdating = true;
        try {
            const now = new Date();
            const todayStr = \`\${now.getFullYear()}-\${String(now.getMonth() + 1).padStart(2, '0')}-\${String(now.getDate()).padStart(2, '0')}\`;
            const progressBar = document.getElementById('daily-progress-bar');
            const bigTimer = document.getElementById('big-timer-display');
            const btSubject = document.getElementById('bt-subject');
            const btTimer = document.getElementById('bt-timer');
            const btDetails = document.getElementById('bt-details');
            const btLabel = document.getElementById('bt-label');

            if (currentDateStr === todayStr && progressBar) {
                progressBar.classList.remove('hidden');
                let startMins = 8 * 60; 
                let endMins = 15 * 60 + 10;
                const todayBells = bellCache[todayStr];
                if (todayBells && todayBells.length > 0) {
                    const sorted = [...todayBells].sort((a,b) => (a.startTime || '').localeCompare(b.startTime || ''));
                    const first = sorted[0];
                    if (first && first.startTime) {
                        const [h, m] = first.startTime.split(':').map(Number);
                        startMins = h * 60 + m;
                    }
                    let maxMins = 0;
                    sorted.forEach(b => {
                        if (b.period === 'EoD' || b.endTime.startsWith('23')) return;
                        const [h, m] = b.endTime.split(':').map(Number);
                        const mins = h * 60 + m;
                        if (mins > maxMins) maxMins = mins;
                    });
                    if (maxMins > startMins) endMins = maxMins;
                }
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
                            if (now >= sTime && now < eTime) activeColor = card.dataset.color || '#e5e7eb';
                        }
                });
                progressBar.style.backgroundColor = activeColor;
            } else if (progressBar) {
                progressBar.classList.add('hidden');
            }

            if (bigTimer) {
                bigTimer.classList.remove('hidden');
                let targetTime = null;
                let timerLabel = "Until Start";
                let mainText = "";
                let subText = "";
                if (hoveredPeriodData) {
                        const [h, m] = hoveredPeriodData.start.split(':').map(Number);
                        const [ry, rm, rd] = currentDateStr.split('-').map(Number);
                        targetTime = new Date(ry, rm-1, rd);
                        targetTime.setHours(h, m, 0, 0);
                        mainText = hoveredPeriodData.title || "Selected Class";
                        subText = \`<span class= "font-bold text-black"> \${hoveredPeriodData.room || ''}</span>\${hoveredPeriodData.room && hoveredPeriodData.teacher ? ' • ' : ''}\${hoveredPeriodData.teacher || ''}\`;
                        timerLabel = "Until Start";
                        if (!hoveredPeriodData.room && !hoveredPeriodData.teacher) subText = \`<span class="font-bold text-black">Selected Period</span>\`;
                } else {
                    const next = await findNextPeriod(now);
                    if (next) {
                        targetTime = next.date;
                        mainText = next.subject;
                        subText = \`<span class="font-bold text-black">\${next.dayLabel}</span> • \${next.period}\${next.room ? ' • ' + next.room : ''}\`;
                        timerLabel = next.isCurrent ? "Time Left" : "Until Start";
                    } else {
                        mainText = "No Upcoming Classes";
                        subText = "Relax!";
                        btTimer.textContent = "--:--:--";
                    }
                }
                if (targetTime) {
                    let diff = targetTime - now;
                    btSubject.textContent = mainText;
                    btDetails.innerHTML = subText;
                    btLabel.textContent = timerLabel;
                    if (diff < 0) {
                        btTimer.textContent = "Started";
                        btLabel.textContent = "Time Since: " + formatDuration(Math.abs(diff));
                    } else {
                        btTimer.textContent = formatDuration(diff);
                    }
                } else if (mainText === "No Upcoming Classes") {
                    btSubject.textContent = mainText;
                    btDetails.innerHTML = subText;
                    btLabel.textContent = "";
                    btTimer.textContent = "--:--:--";
                }
            }
        } catch(e) {
            console.error('Ticker error', e); 
        } finally {
            isTickerUpdating = false;
        }
    }

    function formatDuration(ms) {
        const dHours = Math.floor(ms / (1000 * 60 * 60));
        const dMins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
        const dSecs = Math.floor((ms % (1000 * 60)) / 1000);
        if (dHours > 24) {
            const days = Math.floor(dHours / 24);
            const h = dHours % 24;
            return \`\${days}d \${h}h \${dMins}m\`;
        }
        const hStr = dHours > 0 ? \`\${String(dHours)}:\` : '';
        return \`\${hStr}\${String(dMins).padStart(2, '0')}:\${String(dSecs).padStart(2, '0')}\`;
    }
</script>
`
