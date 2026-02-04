import { Hono } from 'hono'
import { Layout } from '../layout'
import { getUser } from '../utils'
import { Bindings } from '../types'
import { html } from 'hono/html'
import { BELL_TIMES, CALENDAR, TIMETABLE_DATA, PeriodData } from '../data/mockTimetable'

const app = new Hono<{ Bindings: Bindings }>()

// Helper to format 24h time "09:00" to "9:00 AM"
function formatTime(timeStr: string) {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':').map(Number);
    const suffix = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${m.toString().padStart(2, '0')} ${suffix}`;
}

// Helper to format date "2026-02-05" -> "Thu, 05/02/2026"
function formatDateHeader(dateStr: string) {
    const d = new Date(dateStr);
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayName = days[d.getDay()];
    // Manual DD/MM/YYYY to match design
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    return `${dayName}, ${day}/${month}/${year}`;
}

app.get('/', async (c) => {
    const user = await getUser(c)

    // 1. Determine Target Date
    const url = new URL(c.req.url);
    let dateStr = url.searchParams.get('date');
    const isReset = url.searchParams.get('reset');

    const now = new Date();
    // Default logic if no date or reset requested
    if (!dateStr || isReset) {
        // "Reset" logic in design seems to go to "Next Day" if late, or just today? 
        // Let's stick to the "Next Day" logic requested initially as it's useful.
        const isAfterSchool = (now.getHours() > 15) || (now.getHours() === 15 && now.getMinutes() >= 10);

        if (isAfterSchool) {
            // Find next day logic...
            const todayStr = now.toISOString().split('T')[0];
            const dates = Object.keys(CALENDAR).sort();
            const todayIndex = dates.indexOf(todayStr);
            if (todayIndex !== -1 && todayIndex < dates.length - 1) {
                dateStr = dates[todayIndex + 1];
            } else {
                const nextDay = new Date(now);
                nextDay.setDate(now.getDate() + 1);
                dateStr = nextDay.toISOString().split('T')[0];
            }
        } else {
            dateStr = now.toISOString().split('T')[0];
        }
    }

    // 2. Lookup Data
    const dayNumber = CALENDAR[dateStr];
    const timetable = dayNumber ? TIMETABLE_DATA[dayNumber] : null;

    // 3. Helper for Navigation
    const dates = Object.keys(CALENDAR).sort();
    const currentIndex = dates.indexOf(dateStr);
    const prevDate = currentIndex > 0 ? dates[currentIndex - 1] : null;
    const nextDate = currentIndex !== -1 && currentIndex < dates.length - 1 ? dates[currentIndex + 1] : null;

    return c.html(
        <Layout title="Classes" user={user}>
            <div class="max-w-4xl mx-auto py-6">

                {/* Tabs (Visual Only for now) */}
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
                    <a
                        href={prevDate ? `/classes?date=${prevDate}` : '#'}
                        class={`w-10 h-10 flex items-center justify-center rounded-lg border border-red-500 text-red-500 hover:bg-red-50 transition-colors ${!prevDate ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                    </a>

                    {/* Date Display (Visual Input Box) */}
                    <div class="flex-grow flex items-center justify-center border border-gray-200 rounded-lg h-10 bg-white shadow-sm px-4">
                        <span class="font-bold text-gray-800 text-sm">
                            {formatDateHeader(dateStr)} {timetable ? `Wk 1${timetable.dayname.includes('A') ? 'A' : 'B'}` : ''} {/* Simulating Cycle display logic, though mock data has explicit cycle info */}
                        </span>
                    </div>

                    {/* Reset Button */}
                    <a href="/classes?reset=true" class="h-10 px-4 flex items-center justify-center rounded-lg border border-red-500 text-red-500 font-medium text-sm hover:bg-red-50 transition-colors">
                        Reset
                    </a>

                    {/* Next Button */}
                    <a
                        href={nextDate ? `/classes?date=${nextDate}` : '#'}
                        class={`w-10 h-10 flex items-center justify-center rounded-lg border border-red-500 text-red-500 hover:bg-red-50 transition-colors ${!nextDate ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                    </a>
                </div>

                {/* Timetable List List */}
                <div class="space-y-4">
                    {!timetable ? (
                        <div class="text-center py-12 text-gray-500">
                            No classes scheduled for this day.
                        </div>
                    ) : (
                        BELL_TIMES.map((bell) => {
                            // Find corresponding period
                            const periodData = timetable.periods[bell.period];
                            const data = periodData || (bell.period === 'RC' ? timetable.rollcall : null);

                            // Check if this slot is "active" or has content
                            const hasContent = !!data;

                            // Color Handling: API provides hex without hash.
                            const stripColor = data?.color ? `#${data.color}` : '#e5e7eb'; // Default gray if no color

                            return (
                                <div class="flex items-center min-h-[3rem]">
                                    {/* Time Column (Fixed Width) */}
                                    <div class="w-24 text-right pr-6 text-sm text-gray-500 font-medium">
                                        {formatTime(bell.startTime)}
                                    </div>

                                    {/* Card Content */}
                                    <div class="flex-grow">
                                        {hasContent ? (
                                            <div class="relative flex items-center justify-between bg-gray-100 rounded-lg p-3 shadow-sm hover:bg-gray-50 transition-colors">
                                                {/* Color Strip Indicator */}
                                                <div
                                                    class="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-lg"
                                                    style={`background-color: ${stripColor};`}
                                                ></div>

                                                <div class="pl-3 font-medium text-gray-900 text-sm">
                                                    {data.title || data.subject}
                                                </div>
                                                <div class="flex items-center gap-4 text-sm">
                                                    <span class="text-gray-900">{data.fullTeacher || data.teacher}</span>
                                                    {data.room && <span class="font-bold text-black">{data.room}</span>}
                                                </div>
                                            </div>
                                        ) : (
                                            // Empty Slot (Just Text)
                                            <div class="pl-2 text-gray-400 text-sm">
                                                {bell.label} {/* e.g. "Recess", "Period 0" */}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

            </div>
        </Layout>
    )
})

export default app
