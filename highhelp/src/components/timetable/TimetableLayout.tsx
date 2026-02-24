import { Child } from 'hono/jsx'

export const TimetableLayout = ({ children }: { children: Child }) => (
    <div class="max-w-4xl mx-auto pt-0 pb-6 px-4" id="app-container">
        <div id="daily-progress-bar" class="fixed left-0 top-0 h-full w-1.5 bg-gray-200 dark:bg-neutral-800 z-50 hidden transition-all duration-500 ease-in-out origin-top"></div>
        <div id="loader" class="text-center py-12">
            <p class="text-gray-500 dark:text-neutral-400">Loading timetable...</p>
        </div>

        <div id="content" class="hidden">
            <div class="flex border-b border-gray-200 dark:border-neutral-700 mb-3">
                <button id="tab-day" class="flex items-center gap-2 px-4 py-2 border-b-2 border-red-500 text-red-500 font-medium text-sm focus:outline-none transition-colors">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                    Day
                </button>
                <button id="tab-cycle" class="flex items-center gap-2 px-4 py-2 border-b-2 border-transparent text-gray-500 dark:text-neutral-400 hover:text-gray-700 dark:hover:text-neutral-200 font-medium text-sm focus:outline-none transition-colors">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>
                    Cycle
                </button>
                <button id="tab-config" class="flex items-center gap-2 px-4 py-2 border-b-2 border-transparent text-gray-500 dark:text-neutral-400 hover:text-gray-700 dark:hover:text-neutral-200 font-medium text-sm focus:outline-none transition-colors">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                    Config
                </button>
            </div>

            <div id="big-timer-display" class="mb-4 bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-2xl p-4 text-black dark:text-white font-sans transform transition-all relative overflow-hidden hidden">
                <div class="absolute top-0 right-0 w-32 h-30 bg-gray-100 dark:bg-neutral-700 opacity-50 dark:opacity-20 rounded-full -mr-10 -mt-10 blur-2xl"></div>
                <div class="absolute bottom-0 left-0 w-24 h-20 bg-red-500 opacity-5 rounded-full -ml-10 -mb-10 blur-xl"></div>

                <div class="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div class="text-center md:text-left min-w-0">
                        <h2 class="text-gray-400 dark:text-neutral-500 text-sm mb-1">Time till</h2>
                        <div id="bt-subject" class="text-2xl font-bold">Checking...</div>
                        <div id="bt-details" class="text-sm text-gray-400 dark:text-neutral-500 flex items-center gap-2 justify-center md:justify-start"></div>
                    </div>

                    <div class="text-center whitespace-nowrap">
                        <div id="bt-timer" class="text-4xl md:text-5xl font-bold tracking-wide leading-none">--:--:--</div>
                        <div id="bt-label" class="text-xs text-red-500 dark:text-red-400 mt-2 tracking-wide uppercase">Until Start</div>
                    </div>
                </div>
            </div>

            <div class="flex items-center gap-2 mb-3">
                <button id="btn-prev" class="w-10 h-7 flex items-center justify-center rounded-lg border border-red-500 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                </button>

                <div class="flex-grow flex items-center justify-center border border-gray-200 dark:border-neutral-700 rounded-lg h-7 bg-white dark:bg-neutral-800 shadow-sm px-4">
                    <span id="date-display" class="font-bold text-gray-800 dark:text-neutral-200 text-sm"></span>
                </div>

                <button id="btn-reset" class="h-7 px-4 flex items-center justify-center rounded-lg border border-red-500 text-red-500 font-medium text-sm hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                    Reset
                </button>

                <button id="btn-next" class="w-10 h-7 flex items-center justify-center rounded-lg border border-red-500 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                </button>
            </div>

            <div id="timetable-list" class="space-y-4"></div>
        </div>

        <div id="error-msg" class="hidden text-center py-12 text-red-500"></div>
        {children}
    </div>
)
