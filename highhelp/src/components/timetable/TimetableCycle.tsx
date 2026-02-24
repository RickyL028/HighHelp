import { html } from 'hono/html'

export const TimetableCycle = html`
<script>
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
            gridHtml += \`<div><h3 class="text-sm font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-wider mb-2 pl-1">\${weekLabel}</h3><div class="grid grid-cols-5 gap-2">\${weekIds.map((dNum, i) => \`<div class="text-center text-xs font-medium text-gray-500 dark:text-neutral-400 mb-1">\${dayLabels[i]}</div>\`).join('')}\${weekIds.map(dNum => {const dayData = daysData[dNum];if (!dayData) return '<div></div>';const displayPeriods = ['0', '1', '2', '3', '4', '5'];const periods = displayPeriods.map(p => {let pData = dayData.periods[p];if (pData) pData = enrichPeriod(pData);return pData;});return \`<div class="flex flex-col gap-0 border border-gray-100 dark:border-neutral-800 rounded-lg overflow-hidden">\${periods.map(p => {if (!p) return '<div class="h-10 bg-gray-50/30 dark:bg-neutral-900/10"></div>';const color = p.color ? '#' + p.color : '#e5e7eb';return \`<div class="period-card h-10 flex flex-col justify-center px-1 text-xs relative group cursor-default transition-all border-b border-white/50 dark:border-neutral-700/50 last:border-b-0" style="background-color: \${color}15; border-left: 3px solid \${color};" data-subject="\${p.subjectCode}"><div class="font-bold truncate text-gray-800 dark:text-neutral-200 text-[10px] leading-tight">\${p.subjectCode}</div><div class="truncate text-gray-500 dark:text-neutral-400 text-[9px] leading-tight">\${p.room || ''}</div></div>\`;}).join('')}</div>\`;}).join('')}</div></div>\`;
        });
        gridHtml += '</div>';
        container.innerHTML = gridHtml;
        attachHoverEffects();
    }
</script>
`
