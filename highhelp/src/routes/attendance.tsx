import { Hono } from 'hono'
import { Layout } from '../layout'
import { getUser } from '../utils'
import { Bindings } from '../types'

const app = new Hono<{ Bindings: Bindings }>()

app.get('/', async (c) => {
    const user = await getUser(c)
    if (!user) return c.redirect('/login')

    return c.html(
        <Layout title="Attendance" user={user}>
            <div class="max-w-5xl mx-auto pt-6 pb-16 px-4 md:px-6">
                <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
                    <div>
                        <h1 class="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Attendance</h1>
                        <p class="text-sm text-gray-500 dark:text-neutral-400 mt-1">(clipboard) absences & pre-explained</p>
                    </div>
                    <div class="flex items-center gap-3">
                        <button id="btn-refresh" class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 text-sm text-gray-700 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-700">
                            <i data-lucide="refresh-cw" class="w-4 h-4"></i>
                            Refresh
                        </button>
                    </div>
                </div>

                <div id="activity-breakdown" class="grid sm:grid-cols-2 gap-x-6 gap-y-2.5 mb-6">
                    <p class="text-sm text-gray-400 dark:text-neutral-600">Loading…</p>
                </div>

                <div id="calendar-container"></div>

                <div id="pre-explained-container"></div>

                <div id="error-state" class="hidden text-center py-16">
                    <div class="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gray-100 dark:bg-neutral-800 flex items-center justify-center">
                        <i id="error-icon" data-lucide="cloud-off" class="w-7 h-7 text-gray-400 dark:text-neutral-500"></i>
                    </div>
                    <h2 id="error-title" class="text-lg font-bold text-gray-900 dark:text-white"></h2>
                    <p id="error-message" class="text-sm text-gray-500 dark:text-neutral-400 mt-1 mb-6 max-w-md mx-auto"></p>
                    <a id="error-action" href="/api/auth/login" class="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold">
                        Log in to sync <i data-lucide="arrow-right" class="w-4 h-4"></i>
                    </a>
                </div>

                <div id="drawer-backdrop" class="fixed inset-0 bg-black/60 z-[70] hidden"></div>
                <aside id="audit-drawer" class="fixed top-0 right-0 h-full w-full max-w-md bg-white dark:bg-neutral-900 border-l border-gray-200 dark:border-neutral-700 z-[80] shadow-2xl translate-x-full transition-transform duration-300 flex flex-col">
                    <div id="drawer-content" class="flex-1 overflow-y-auto p-6"></div>
                </aside>

                <script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"></script>
                <script src="/attendance.js"></script>
            </div>
        </Layout>
    )
})

export default app
