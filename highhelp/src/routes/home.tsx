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
            <div class="space-y-12 py-8">

                {/* Countdowns Section */}
                <div class="grid grid-cols-1 gap-8 max-w-2xl mx-auto">
                    {/* Half Yearly Countdown */}
                    <div class="bg-white p-8 rounded-lg shadow-lg border-t-8 border-primary text-center">
                        <h2 class="text-2xl font-bold text-gray-800 mb-4 uppercase tracking-wider">Half Yearly</h2>
                        <div id="half-yearly-countdown" class="text-4xl md:text-5xl font-mono font-bold text-primary mb-2">
                            --:--:--:--
                        </div>

                    </div>

                    {/* HSC Countdown */}
                    <div class="bg-white p-8 rounded-lg shadow-lg border-t-8 border-secondary text-center">
                        <h2 class="text-2xl font-bold text-gray-800 mb-4 uppercase tracking-wider">HSC 2027</h2>
                        <div id="hsc-countdown" class="text-4xl md:text-5xl font-mono font-bold text-secondary mb-2">
                            -- Weeks
                        </div>

                    </div>
                </div>

                {/* Latest Announcements Section */}
                <div class="max-w-5xl mx-auto">
                    <div class="flex items-center justify-between mb-6">
                        <h2 class="text-3xl font-bold text-gray-900">Latest Announcements</h2>
                        <a href="/announcements" class="text-secondary hover:underline font-medium">View All →</a>
                    </div>

                    <div class="space-y-4">
                        {latestAnnouncements?.length === 0 ? (
                            <p class="text-gray-500 text-center py-6 bg-white rounded shadow-sm">No announcements yet.</p>
                        ) : (
                            latestAnnouncements?.map((a: any) => (
                                <div class="bg-white p-6 rounded-lg shadow-md border-l-4 border-secondary hover:shadow-lg transition">
                                    <div class="flex justify-between items-start">
                                        <div>
                                            <h3 class="text-xl font-bold text-gray-800 mb-1">{a.title}</h3>
                                            <div class="flex items-center gap-2 mb-3">
                                                <span class="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full font-medium">{a.subject}</span>
                                                <span class="text-sm text-gray-500 flex items-center">
                                                    • {a.first_name ? `${a.first_name} ${a.last_name}` : 'Unknown'}
                                                    <span class="ml-2" dangerouslySetInnerHTML={{ __html: renderTags(a.tags) }}></span>
                                                </span>
                                            </div>
                                            <p class="text-gray-600 line-clamp-2">{a.content}</p>
                                        </div>
                                        <span class="text-sm text-gray-400 whitespace-nowrap ml-4">{new Date(a.created_at).toLocaleDateString()}</span>
                                    </div>
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
