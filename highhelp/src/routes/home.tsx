import { Hono } from 'hono'
import { Layout } from '../layout'
import { getUser, renderTags } from '../utils'
import { Bindings } from '../types'

const app = new Hono<{ Bindings: Bindings }>()

app.get('/', async (c) => {
    const user = await getUser(c)

    // Fetch latest 3 announcements
    const { results: latestAnnouncements } = await c.env.DB.prepare(`
        SELECT a.*, u.first_name, u.last_name, u.tags 
        FROM announcements a 
        LEFT JOIN users u ON a.author_id = u.id 
        ORDER BY a.created_at DESC 
        LIMIT 3
    `).all()

    // Half Yearly Date (Backend Adjustable)
    const HALF_YEARLY_DATE = "2026-05-25T09:00:00";
    const c1d = "2026-02-02T09:00:00";

    return c.html(
        <Layout title="Home" user={user}>
            {/* Development Warning */}

            {/* Main Content Container - Added pt-12 for spacing since Hero Image is gone */}
            <div class="space-y-12 px-4 md:px-0 pb-12 pt-12">

                {/* Countdowns Section */}
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto items-center">

                    {/* School Starts Countdown (Standard) */}
                    <div class="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-default">
                        <h2 class="text-sm font-bold text-gray-500 mb-1 uppercase tracking-wider">School Starts</h2>
                        <div id="c1-countdown" class="text-2xl md:text-3xl font-mono font-bold text-gray-800">
                            --:--:--:--
                        </div>
                    </div>

                    {/* Half Yearly Countdown (Prominent) */}
                    <div class="bg-white p-8 rounded-2xl border-2 border-secondary shadow-xl transform md:scale-110 z-10 hover:scale-115 transition-all duration-300 relative overflow-hidden group">
                        <div class="absolute top-0 left-0 w-full h-2 bg-secondary"></div>
                        <h2 class="text-lg font-bold text-secondary mb-2 uppercase tracking-tight flex items-center justify-center gap-2">
                            Half Yearly
                        </h2>
                        <div id="half-yearly-countdown" class="text-4xl md:text-5xl font-mono font-black text-gray-900 group-hover:text-secondary transition-colors">
                            --:--:--:--
                        </div>
                    </div>

                    {/* HSC Countdown (Standard) */}
                    <div class="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-default">
                        <h2 class="text-sm font-bold text-gray-500 mb-1 uppercase tracking-wider">HSC 2027</h2>
                        <div id="hsc-countdown" class="text-2xl md:text-3xl font-mono font-bold text-gray-800">
                            -- Weeks
                        </div>
                    </div>
                </div>

                {/* NEW SECTION: Logo and Branding Below Countdowns */}
                <div class="flex flex-col items-center justify-center space-y-4 py-4">
                    <img
                        src="https://assets.schools.nsw.gov.au/content/dam/doe/sws/schools/s/sydneyboys-h/logo.png"
                        alt="Sydney Boys High School Logo"
                        class="h-48 w-auto object-contain drop-shadow-sm"
                    />
                    <h1 class="text-4xl font-bold text-gray-900 tracking-tight">HighHelp</h1>
                    <p class="text-lg text-gray-600">Designed and programmed specifically for, and by, class of 2027.</p>
                </div>

                {/* Latest Announcements Section */}
                <div class="max-w-5xl mx-auto">
                    <div class="flex items-center justify-between mb-6 border-b border-gray-200 pb-4">
                        <h2 class="text-3xl font-bold text-gray-900">Latest Announcements</h2>
                        <a href="/announcements" class="text-secondary hover:text-blue-800 font-semibold flex items-center gap-1 transition-colors">
                            View All
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                        </a>
                    </div>

                    <div class="space-y-4">
                        {latestAnnouncements?.length === 0 ? (
                            <div class="text-gray-500 text-center py-12 bg-white rounded-lg border border-dashed border-gray-300">
                                <p>No announcements yet.</p>
                            </div>
                        ) : (
                            latestAnnouncements?.map((a: any) => (
                                <div class="group bg-white p-5 rounded-lg border border-gray-200 shadow-sm hover:shadow-md hover:border-l-4 hover:border-l-secondary transition-all duration-200">
                                    <div class="flex justify-between items-start mb-2">
                                        <h3 class="text-xl font-bold text-gray-900 leading-tight group-hover:text-secondary transition-colors">{a.title}</h3>
                                        <span class="text-xs font-bold bg-blue-50 text-blue-700 px-2 py-1 rounded uppercase tracking-wide">{a.subject}</span>
                                    </div>

                                    <div class="flex flex-wrap items-center gap-x-3 text-xs text-gray-500 mb-3">
                                        <span class="flex items-center gap-1">
                                            <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                            <span class="local-date" data-timestamp={a.created_at}>{new Date(a.created_at).toLocaleDateString()}</span>
                                        </span>
                                        <span class="text-gray-300">|</span>
                                        <span class="flex items-center gap-1">
                                            <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                            {a.first_name ? `${a.first_name} ${a.last_name}` : 'Unknown'}
                                            <span class="ml-1 opacity-75" dangerouslySetInnerHTML={{ __html: renderTags(a.tags) }}></span>
                                        </span>
                                    </div>

                                    <p class="text-gray-700 text-sm line-clamp-2 leading-relaxed">{a.content}</p>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Countdown Script */}
                <script dangerouslySetInnerHTML={{
                    __html: `
                    (function() {
                        const halfYearlyTarget = new Date("${HALF_YEARLY_DATE}").getTime();
                        const c1 = new Date("${c1d}").getTime();
                        // HSC 2027 Target: Oct 12, 2027 (Approx)
                        const hscTarget = new Date("2027-10-12T09:00:00").getTime();

                        function updateCountdowns() {
                            const now = new Date().getTime();

                            // Half Yearly Logic
                            const distanceHY = halfYearlyTarget - now;
                            if (distanceHY < 0) {
                                document.getElementById("half-yearly-countdown").innerText = "EXPIRED";
                            } else {
                                const days = Math.floor(distanceHY / (1000 * 60 * 60 * 24));
                                const hours = Math.floor((distanceHY % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                                const minutes = Math.floor((distanceHY % (1000 * 60 * 60)) / (1000 * 60));
                                const seconds = Math.floor((distanceHY % (1000 * 60)) / 1000);
                                document.getElementById("half-yearly-countdown").innerText = \`\${days}d \${hours}h \${minutes}m \${seconds}s\`;
                            }

                            // C1 Logic
                            const distanceC1 = c1 - now;
                            if (distanceC1 < 0) {
                                document.getElementById("c1-countdown").innerText = "Started";
                            } else {
                                const days = Math.floor(distanceC1 / (1000 * 60 * 60 * 24));
                                const hours = Math.floor((distanceC1 % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                                const minutes = Math.floor((distanceC1 % (1000 * 60 * 60)) / (1000 * 60));
                                const seconds = Math.floor((distanceC1 % (1000 * 60)) / 1000);
                                document.getElementById("c1-countdown").innerText = \`\${days}d \${hours}h \${minutes}m \${seconds}s\`;
                            }

                            // HSC Logic (Weeks)
                            const distanceHSC = hscTarget - now;
                            if (distanceHSC < 0) {
                                document.getElementById("hsc-countdown").innerText = "Done!";
                            } else {
                                const weeks = Math.ceil(distanceHSC / (1000 * 60 * 60 * 24 * 7));
                                document.getElementById("hsc-countdown").innerText = \`\${weeks} Weeks\`;
                            }
                        }

                        setInterval(updateCountdowns, 1000);
                        updateCountdowns(); // Initial call
                    })();
                ` }} />

            </div>
        </Layout>
    )
})

export default app