import { Child } from 'hono/jsx'

export const TimetableLayout = ({ children }: { children: Child }) => (
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
        {children}
    </div>
)
