import { Hono } from 'hono'
import { Layout } from '../layout'
import { getUser } from '../utils'
import { Bindings } from '../types'

const app = new Hono<{ Bindings: Bindings }>()

app.get('/', async (c) => {
    const user = await getUser(c)

    const HALF_YEARLY_DATE = "2026-08-27T09:00:00";

    return c.html(
        <Layout title="Home" user={user} noScroll>
            <div class="space-y-12 px-4 md:px-0 pb-12 pt-12">

                {/* Timeline & Countdowns Section */}
                <div class="flex flex-col gap-6 max-w-4xl mx-auto mb-12 ">

                    {/* Row 1: Half Yearly Banner */}
                    <div class="flex flex-col items-center justify-center gap-4 w-full mb-6">


                        <div id="half-yearly-countdown" class="mb-6 text-center text-5xl md:text-7xl font-mono font-black text-gray-900 dark:text-white tracking-tight">
                            --:--:--:--
                        </div>
                        <h2 class="text-xl md:text-1xl font-bold text-secondary tracking-widest flex items-center justify-center dark:text-white gap-2">
                            Until Year 11 Math Advanced Yearly
                        </h2>
                    </div>




                </div>

                {/* Homepage logo */}
                <div class="flex flex-col items-center justify-center space-y-4 py-4 mt-6 ">
                    <img
                        src="https://assets.schools.nsw.gov.au/content/dam/doe/sws/schools/s/sydneyboys-h/logo.png"
                        alt="Sydney Boys High School Logo"
                        class="h-48 w-auto object-contain drop-shadow-sm dark:opacity-80"
                    />
                    <h1 class="text-4xl font-bold text-gray-900 dark:text-white tracking-tight">HighHelp</h1>
                    <p class="text-lg text-gray-600 dark:text-gray-400 text-center">Designed and programmed specifically for, and by, class of 2027.</p>
                </div>

                <script dangerouslySetInnerHTML={{
                    __html: `
                    (function() {
                        const halfYearlyTarget = new Date("${HALF_YEARLY_DATE}").getTime();

                        // Continuous Countdown Timer
                        function updateCountdowns() {
                            const now = new Date().getTime();

                            // Half Yearly Logic
                            const distanceHY = halfYearlyTarget - now;
                            if (distanceHY < 0) {
                                document.getElementById("half-yearly-countdown").innerText = "/";
                            } else {
                                const days = Math.floor(distanceHY / (1000 * 60 * 60 * 24));
                                const hours = Math.floor((distanceHY % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                                const minutes = Math.floor((distanceHY % (1000 * 60 * 60)) / (1000 * 60));
                                const seconds = Math.floor((distanceHY % (1000 * 60)) / 1000);

                                // Format text nicely (added zero padding for stable width on mono font)
                                const pad = (n) => n.toString().padStart(2, '0');
                                document.getElementById("half-yearly-countdown").innerText =
                                    \`\${days}d \${pad(hours)}h \${pad(minutes)}m \${pad(seconds)}s\`;
                            }
                        }

                        // Initialization
                        setInterval(updateCountdowns, 1000);
                        updateCountdowns();
                    })();
                ` }} />

            </div>
        </Layout>
    )
})

export default app
