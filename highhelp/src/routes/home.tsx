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

    return c.html(
        <Layout title="Home" user={user}>
            <a class="block text-bg font-medium text-gray-1000 text-center text-2xl font-bold text-gray-800 uppercase tracking-wider">test - This Website is under development - All data may be erased</a>
            <div class="space-y-12 py-8">

                {/* Countdowns Section */}
                <div class="grid grid-cols-1 gap-4 max-w-2xl mx-auto">
                    {/* Half Yearly Countdown */}
                    <div class="bg-white p-5 rounded border border-t-4 border-gray-300 border-t-primary text-center">
                        <h2 class="text-xl font-bold text-gray-800 mb-2 uppercase tracking-tight">Half Yearly</h2>
                        <div id="half-yearly-countdown" class="text-3xl md:text-4xl font-mono font-bold text-primary">
                            --:--:--:--
                        </div>
                    </div>

                    {/* HSC Countdown */}
                    <div class="bg-white p-5 rounded border border-t-4 border-gray-300 border-t-secondary text-center">
                        <h2 class="text-xl font-bold text-gray-800 mb-2 uppercase tracking-tight">HSC 2027</h2>
                        <div id="hsc-countdown" class="text-3xl md:text-4xl font-mono font-bold text-secondary">
                            -- Weeks
                        </div>
                    </div>
                </div>

                {/* Latest Announcements Section */}
                <div class="max-w-5xl mx-auto">
                    <div class="flex items-center justify-between mb-6">
                        <h2 class="text-3xl font-bold text-gray-900">Test Announcements</h2>
                        <a href="/announcements" class="text-secondary hover:underline font-medium">View All →</a>
                    </div>

                    <div class="space-y-4">
                        {latestAnnouncements?.length === 0 ? (
                            <p class="text-gray-500 text-center py-6 bg-white rounded shadow-sm">No announcements yet.</p>
                        ) : (
                            latestAnnouncements?.map((a: any) => (
                                <div class="bg-white p-4 rounded border border-l-4 border-gray-300 border-l-secondary hover:bg-gray-50 transition-colors">
                                    <h3 class="text-lg font-bold text-gray-900 mb-1 leading-tight">{a.title}</h3>

                                    <div class="flex flex-wrap items-center gap-x-2 text-xs text-gray-500 mb-2">
                                        <span class="font-bold text-blue-700 uppercase tracking-wide">{a.subject}</span>
                                        <span class="text-gray-300">•</span>
                                        <span class="local-date" data-timestamp={a.created_at}>{new Date(a.created_at).toLocaleDateString()}</span>
                                        <span class="text-gray-300">•</span>
                                        <span class="flex items-center">
                                            {a.first_name ? `${a.first_name} ${a.last_name}` : 'Unknown'}
                                            <span class="ml-1" dangerouslySetInnerHTML={{ __html: renderTags(a.tags) }}></span>
                                        </span>
                                    </div>

                                    <p class="text-gray-700 text-sm line-clamp-2">{a.content}</p>
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
