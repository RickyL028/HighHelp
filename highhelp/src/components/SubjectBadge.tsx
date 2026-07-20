interface SubjectColors { color: string; bg: string }

export function getSubjectColors(subject: string): SubjectColors {
    const s = subject.toLowerCase();

    if (/bio/.test(s))   return { color: 'text-green-700 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/30' };
    if (/chem/.test(s))  return { color: 'text-purple-700 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/30' };
    if (/phys/.test(s))  return { color: 'text-indigo-700 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-900/30' };
    if (/math/.test(s))  return { color: 'text-orange-700 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/30' };
    if (/eng/.test(s))   return { color: 'text-cyan-700 dark:text-cyan-400', bg: 'bg-cyan-50 dark:bg-cyan-900/30' };
    if (/english|writing/.test(s)) return { color: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/30' };
    if (/econom|business|legal/.test(s)) return { color: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/30' };
    if (/history|geograph/.test(s)) return { color: 'text-teal-700 dark:text-teal-400', bg: 'bg-teal-50 dark:bg-teal-900/30' };
    if (/drama|music/.test(s)) return { color: 'text-pink-700 dark:text-pink-400', bg: 'bg-pink-50 dark:bg-pink-900/30' };
    if (/visual art|art/.test(s)) return { color: 'text-fuchsia-700 dark:text-fuchsia-400', bg: 'bg-fuchsia-50 dark:bg-fuchsia-900/30' };
    if (/chinese|german|latin|greek|language/.test(s)) return { color: 'text-rose-700 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-900/30' };
    if (/software|cs|computing/.test(s)) return { color: 'text-lime-700 dark:text-lime-400', bg: 'bg-lime-50 dark:bg-lime-900/30' };
    if (/health|sport|movement/.test(s)) return { color: 'text-red-700 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/30' };
    return { color: 'text-gray-700 dark:text-gray-400', bg: 'bg-gray-50 dark:bg-gray-900/30' };
}

type TabType = 'resource' | 'essay' | 'past_paper' | 'qa' | 'forum';

const TAB_ICONS: Record<TabType, string> = {
    resource:   'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10',
    essay:      'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
    past_paper: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    qa:         'M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z',
    forum:      'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
};

function TabIconSvg({ tab }: { tab: TabType }) {
    return (
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={TAB_ICONS[tab]}></path>
        </svg>
    );
}

function TabIconSm({ tab }: { tab: TabType }) {
    return (
        <svg class="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={TAB_ICONS[tab]}></path>
        </svg>
    );
}

export function SubjectBadge({ subject, tab }: { subject: string; tab?: TabType }) {
    const s = getSubjectColors(subject);
    return (
        <span class={`inline-flex items-center gap-1 ${s.color} text-xs whitespace-nowrap`}>
            {tab && <TabIconSm tab={tab} />}
            {subject}
        </span>
    );
}

export function SubjectIcon({ subject, tab }: { subject: string; tab: TabType }) {
    const s = getSubjectColors(subject);
    return (
        <div class={`shrink-0 w-10 h-10 ${s.bg} ${s.color} rounded-lg items-center justify-center hidden sm:flex`}>
            <TabIconSvg tab={tab} />
        </div>
    );
}
