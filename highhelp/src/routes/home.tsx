import { Hono } from 'hono'
import { Layout } from '../layout'
import { getUser, renderTags, formatDate } from '../utils'
import { Bindings } from '../types'

const app = new Hono<{ Bindings: Bindings }>()

app.get('/', async (c) => {
    const user = await getUser(c)

    // fetching
    const [
        { results: latestAnnouncements },
        { results: latestResources },
        { results: latestPapers },
        { results: latestQuestions },
        { results: latestEssays }
    ] = await Promise.all([
        c.env.DB.prepare(`
            SELECT a.*, u.first_name, u.last_name, u.tags 
            FROM announcements a 
            LEFT JOIN users u ON a.author_id = u.id 
            WHERE a.is_deleted = 0
            ORDER BY a.created_at DESC 
            LIMIT 3
        `).all(),

        c.env.DB.prepare(`
            SELECT r.*, u.first_name, u.last_name, u.tags 
            FROM resources r 
            LEFT JOIN users u ON r.uploader_id = u.id 
            WHERE r.type = 'resource' AND r.is_deleted = 0
            ORDER BY r.created_at DESC 
            LIMIT 3
        `).all(),
        c.env.DB.prepare(`
            SELECT p.*, count(q.id) as question_count 
            FROM papers p 
            LEFT JOIN exam_questions q ON p.id = q.paper_id 
            GROUP BY p.id 
            ORDER BY p.created_at DESC 
            LIMIT 3
        `).all(),
        c.env.DB.prepare(`
            SELECT p.*, u.first_name, u.last_name, u.tags,
            (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id AND c.is_deleted = 0) as comment_count
            FROM posts p 
            LEFT JOIN users u ON p.author_id = u.id 
            WHERE p.type = 'question' AND p.is_deleted = 0
            ORDER BY p.created_at DESC 
            LIMIT 3
        `).all(),
        c.env.DB.prepare(`
            SELECT e.* 
            FROM essays e 
            WHERE e.is_deleted = 0
            ORDER BY e.created_at DESC 
            LIMIT 3
        `).all()
    ]);


    const HALF_YEARLY_DATE = "2026-05-25T09:00:00";
    const c1d = "2026-02-02T09:00:00";

    return c.html(
        <Layout title="Home" user={user}>
            <div class="space-y-12 px-4 md:px-0 pb-12 pt-12">
                <p>Please note https://highhelp.org/ is blocked by school for a while due to new domain purchase. Please use https://highhelp.sbhs27.workers.dev/ for now.</p>
                <p>* testing and debugging stage, particularly for timetable. Please report any bugs to <u><a href='/about#contact'>Contact</a></u></p>
                {/* Countdowns Section */}
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto items-center">
                    {/* School Starts */}
                    <div class="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-default">
                        <h2 class="text-sm font-bold text-gray-500 mb-1 uppercase tracking-wider">School Starts</h2>
                        <div id="c1-countdown" class="text-2xl md:text-3xl font-mono font-bold text-gray-800">
                            --:--:--:--
                        </div>
                    </div>

                    {/* Half Yearly */}
                    <div class="bg-white p-8 rounded-2xl border-2 border-secondary shadow-xl transform md:scale-110 z-10 hover:scale-115 transition-all duration-300 relative overflow-hidden group">
                        <div class="absolute top-0 left-0 w-full h-2 bg-secondary"></div>
                        <h2 class="text-lg font-bold text-secondary mb-2 uppercase tracking-tight flex items-center justify-center gap-2">
                            Half Yearly
                        </h2>
                        <div id="half-yearly-countdown" class="text-4xl md:text-5xl font-mono font-black text-gray-900 group-hover:text-secondary transition-colors">
                            --:--:--:--
                        </div>
                    </div>

                    {/* HSC */}
                    <div class="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-default">
                        <h2 class="text-sm font-bold text-gray-500 mb-1 uppercase tracking-wider">HSC 2027</h2>
                        <div id="hsc-countdown" class="text-2xl md:text-3xl font-mono font-bold text-gray-800">
                            -- Weeks
                        </div>
                    </div>
                </div>

                {/* Homepage logo */}
                <div class="flex flex-col items-center justify-center space-y-4 py-4">
                    <img
                        src="https://assets.schools.nsw.gov.au/content/dam/doe/sws/schools/s/sydneyboys-h/logo.png"
                        alt="Sydney Boys High School Logo"
                        class="h-48 w-auto object-contain drop-shadow-sm"
                    />
                    <h1 class="text-4xl font-bold text-gray-900 tracking-tight">HighHelp</h1>
                    <p class="text-lg text-gray-600">Designed and programmed specifically for, and by, class of 2027.</p>
                </div>

                {/* lastest updates */}
                <div class="max-w-7xl mx-auto space-y-12">

                    {/* 1. Announcements */}
                    <div class="border-t pt-8">
                        <div class="flex items-center justify-between mb-6">
                            <h2 class="text-2xl font-bold text-gray-900">Announcements</h2>
                            <a href="/announcements" class="text-blue-600 hover:underline text-sm font-bold">View All →</a>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {latestAnnouncements?.length === 0 ? <p class="text-gray-500 col-span-3">No announcements.</p> : latestAnnouncements?.map((a: any) => (
                                <div class="bg-white p-5 rounded-lg border border-gray-200 shadow-sm hover:border-blue-400 transition-all h-full flex flex-col cursor-pointer group" onclick={`window.open('/announcements/${a.id}', '_blank')`}>
                                    <h3 class="font-bold text-lg text-gray-900 mb-2 leading-tight group-hover:text-blue-700">{a.title}</h3>
                                    <div class="flex items-center gap-2 text-xs text-gray-500 mb-3">
                                        <span class="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-bold uppercase">{a.subject}</span>
                                        <span class="local-date" data-timestamp={a.created_at}>{formatDate(a.created_at)}</span>
                                    </div>
                                    <p class="text-gray-600 text-sm line-clamp-3 mb-4 flex-grow whitespace-pre-wrap">{a.content}</p>
                                    <div class="text-xs text-gray-400 mt-auto pt-2 border-t border-gray-50 flex items-center gap-1">
                                        By {a.first_name ? `${a.first_name}` : 'Unknown'}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 2. Resources */}
                    <div class="border-t pt-8">
                        <div class="flex items-center justify-between mb-6">
                            <h2 class="text-2xl font-bold text-gray-900">Latest Resources</h2>
                            <a href="/resources" class="text-blue-600 hover:underline text-sm font-bold">View All →</a>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {latestResources?.length === 0 ? <p class="text-gray-500 col-span-3">No resources.</p> : latestResources?.map((r: any) => (
                                <div class="bg-white p-5 rounded-lg border border-gray-200 shadow-sm hover:border-blue-400 transition-all h-full flex flex-col">
                                    <h3 class="font-bold text-lg text-gray-900 mb-2 leading-tight">{r.title}</h3>
                                    <div class="flex items-center gap-2 text-xs text-gray-500 mb-3">
                                        <span class="font-bold text-gray-700 uppercase">{r.subject}</span>
                                        <span>•</span>
                                        <span class="local-date" data-timestamp={r.created_at}>{formatDate(r.created_at)}</span>
                                    </div>
                                    <p class="text-gray-600 text-sm line-clamp-2 mb-4 flex-grow">{r.description}</p>
                                    <div class="mt-auto pt-2 flex justify-between items-center border-t border-gray-50">
                                        <a href={`/download/${r.file_key}?id=${r.id}`} target="_blank" class="text-blue-600 font-bold text-xs hover:underline flex items-center gap-1 uppercase">
                                            Download ({r.download_count || 0})
                                        </a>
                                        <span class="text-xs text-gray-400">{r.first_name}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 3. Past Papers */}
                    <div class="border-t pt-8">
                        <div class="flex items-center justify-between mb-6">
                            <h2 class="text-2xl font-bold text-gray-900">Latest Papers</h2>
                            <a href="/past-papers" class="text-blue-600 hover:underline text-sm font-bold">Browse Bank →</a>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {latestPapers?.length === 0 ? <p class="text-gray-500 col-span-3">No papers added recently.</p> : latestPapers?.map((p: any) => (
                                <a href={`/past-papers/paper/${p.id}`} class="bg-white p-5 rounded-lg border border-gray-200 shadow-sm hover:border-blue-400 hover:shadow-md transition-all h-full block">
                                    <h3 class="font-bold text-lg text-gray-900 mb-1">{p.school_name}</h3>
                                    <div class="flex flex-wrap items-center gap-2 text-xs text-gray-500 mb-3">
                                        <span class="bg-gray-100 px-2 py-0.5 rounded font-mono font-bold text-gray-700">{p.academic_year}</span>
                                        <span class="capitalize">{p.paper_type || 'Trial'}</span>
                                        <span class="text-blue-600 font-bold uppercase">{p.subject}</span>
                                    </div>
                                    <div class="flex items-center gap-4 text-xs text-gray-500 mt-4 pt-3 border-t border-gray-50">
                                        <span>📝 {p.question_count || 0} Questions</span>
                                    </div>
                                </a>
                            ))}
                        </div>
                    </div>

                    {/* 4. Q&A and Essays (Split Row) */}
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-12 border-t pt-8">
                        {/* Q&A */}
                        <div>
                            <div class="flex items-center justify-between mb-6">
                                <h2 class="text-2xl font-bold text-gray-900">Recent Q&A</h2>
                                <a href="/forum" class="text-blue-600 hover:underline text-sm font-bold">Visit Forum →</a>
                            </div>
                            <div class="space-y-4">
                                {latestQuestions?.length === 0 ? <p class="text-gray-500">No questions yet.</p> : latestQuestions?.map((q: any) => (
                                    <a href={`/forum/post/${q.id}`} class="block bg-white p-4 rounded border border-gray-200 hover:bg-gray-50 transition-colors">
                                        <h3 class="font-bold text-gray-900 truncate mb-1">{q.title}</h3>
                                        <div class="flex items-center gap-2 text-xs text-gray-500">
                                            <span class="text-blue-600 font-bold uppercase">{q.subject}</span>
                                            <span>•</span>
                                            <span>{q.comment_count} Answers</span>
                                            <span>•</span>
                                            <span class="local-date" data-timestamp={q.created_at}>{formatDate(q.created_at)}</span>
                                        </div>
                                    </a>
                                ))}
                            </div>
                        </div>

                        {/* Essays */}
                        <div>
                            <div class="flex items-center justify-between mb-6">
                                <h2 class="text-2xl font-bold text-gray-900">Latest Essays</h2>
                                <a href="/essays" class="text-blue-600 hover:underline text-sm font-bold">Exchange →</a>
                            </div>
                            <div class="space-y-4">
                                {latestEssays?.length === 0 ? <p class="text-gray-500">No essays yet.</p> : latestEssays?.map((e: any) => (
                                    <a href={`/essays/view/${e.id}`} class="block bg-white p-4 rounded border border-gray-200 hover:bg-gray-50 transition-colors">
                                        <h3 class="font-bold text-gray-900 truncate mb-1">{e.title}</h3>
                                        <div class="flex items-center gap-2 text-xs text-gray-500">
                                            <span class="text-purple-600 font-bold uppercase">{e.subject}</span>
                                            <span>•</span>
                                            <span>Max: {e.full_marks || '-'}</span>
                                            <span>•</span>
                                            <span class="local-date" data-timestamp={e.created_at}>{formatDate(e.created_at)}</span>
                                        </div>
                                    </a>
                                ))}
                            </div>
                        </div>
                    </div>

                </div>



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