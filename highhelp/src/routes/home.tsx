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

    const HALF_YEARLY_DATE = "2026-08-13T08:00:00";

    return c.html(
        <Layout title="Home" user={user}>
            <div class="space-y-12 px-4 md:px-0 pb-12 pt-12">

                {/* Timeline & Countdowns Section */}
                <div class="flex flex-col gap-6 max-w-4xl mx-auto mb-12 ">

                    {/* Row 1: Half Yearly Banner */}
                    <div class="flex flex-col items-center justify-center gap-4 w-full mb-6">


                        <div id="half-yearly-countdown" class="mb-6 text-center text-5xl md:text-7xl font-mono font-black text-gray-900 dark:text-white tracking-tight">
                            --:--:--:--
                        </div>
                        <h2 class="text-xl md:text-1xl font-bold text-secondary tracking-widest flex items-center justify-center dark:text-white gap-2">
                            Until Biology Depth Study
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

                <div class="flex flex-col gap-6 max-w-4xl mx-auto">

                    <div id="hsc-progress-container" class="mt-16 flex flex-wrap gap-1.5 sm:gap-2 justify-center md:justify-start">
                    </div>
                    <div class="flex flex-col items-center justify-center gap-4 w-full">
                        <h4 class="w-full text-center text-xl md:text-1xl font-bold text-secondary tracking-widest flex items-center justify-center dark:text-white gap-2">

                        </h4>
                    </div>


                </div>
                {/* lastest updates */}
                <div class="max-w-7xl mx-auto space-y-12">

                    {/* 1. Announcements */}
                    <div class="border-t dark:border-neutral-800 pt-8">
                        <div class="flex items-center justify-between mb-6">
                            <h2 class="text-2xl font-bold text-gray-900 dark:text-white">Announcements</h2>
                            <a href="/announcements" class="text-blue-600 dark:text-blue-400 hover:underline text-sm font-bold">View All →</a>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {latestAnnouncements?.length === 0 ? <p class="text-gray-500 dark:text-gray-400 col-span-3">No announcements.</p> : latestAnnouncements?.map((a: any) => (
                                <div class="bg-white dark:bg-neutral-800 p-5 rounded-lg border border-gray-200 dark:border-neutral-700 shadow-sm hover:border-blue-400 dark:hover:border-blue-500 transition-all h-full flex flex-col cursor-pointer group" onclick={`window.open('/announcements/${a.id}', '_blank')`}>
                                    <h3 class="font-bold text-lg text-gray-900 dark:text-white mb-2 leading-tight group-hover:text-blue-700 dark:group-hover:text-blue-400">{a.title}</h3>
                                    <div class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-3">
                                        <span class="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded font-bold uppercase">{a.subject}</span>
                                        <span class="local-date" data-timestamp={a.created_at}>{formatDate(a.created_at)}</span>
                                    </div>
                                    <p class="text-gray-600 dark:text-gray-400 text-sm line-clamp-3 mb-4 flex-grow whitespace-pre-wrap">{a.content}</p>
                                    <div class="text-xs text-gray-400 dark:text-gray-500 mt-auto pt-2 border-t border-gray-50 dark:border-neutral-700 flex items-center gap-1">
                                        By {a.first_name ? `${a.first_name}` : 'Unknown'}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 2. Resources */}
                    <div class="border-t dark:border-neutral-800 pt-8">
                        <div class="flex items-center justify-between mb-6">
                            <h2 class="text-2xl font-bold text-gray-900 dark:text-white">Latest Resources</h2>
                            <a href="/resources" class="text-blue-600 dark:text-blue-400 hover:underline text-sm font-bold">View All →</a>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {latestResources?.length === 0 ? <p class="text-gray-500 dark:text-gray-400 col-span-3">No resources.</p> : latestResources?.map((r: any) => (
                                <div class="bg-white dark:bg-neutral-800 p-5 rounded-lg border border-gray-200 dark:border-neutral-700 shadow-sm hover:border-blue-400 dark:hover:border-blue-500 transition-all h-full flex flex-col">
                                    <h3 class="font-bold text-lg text-gray-900 dark:text-white mb-2 leading-tight">{r.title}</h3>
                                    <div class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-3">
                                        <span class="font-bold text-gray-700 dark:text-neutral-300 uppercase">{r.subject}</span>
                                        <span>•</span>
                                        <span class="local-date" data-timestamp={r.created_at}>{formatDate(r.created_at)}</span>
                                    </div>
                                    <p class="text-gray-600 dark:text-gray-400 text-sm line-clamp-2 mb-4 flex-grow">{r.description}</p>
                                    <div class="mt-auto pt-2 flex justify-between items-center border-t border-gray-50 dark:border-neutral-700">
                                        <a href={`/download/${r.file_key}?id=${r.id}`} target="_blank" class="text-blue-600 dark:text-blue-400 font-bold text-xs hover:underline flex items-center gap-1 uppercase">
                                            Download ({r.download_count || 0})
                                        </a>
                                        <span class="text-xs text-gray-400 dark:text-gray-500">{r.first_name}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 3. Past Papers */}
                    <div class="border-t dark:border-neutral-800 pt-8">
                        <div class="flex items-center justify-between mb-6">
                            <h2 class="text-2xl font-bold text-gray-900 dark:text-white">Latest Papers</h2>
                            <a href="/past-papers" class="text-blue-600 dark:text-blue-400 hover:underline text-sm font-bold">Browse Bank →</a>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {latestPapers?.length === 0 ? <p class="text-gray-500 dark:text-gray-400 col-span-3">No papers added recently.</p> : latestPapers?.map((p: any) => (
                                <a href={`/past-papers/paper/${p.id}`} class="bg-white dark:bg-neutral-800 p-5 rounded-lg border border-gray-200 dark:border-neutral-700 shadow-sm hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md transition-all h-full block">
                                    <h3 class="font-bold text-lg text-gray-900 dark:text-white mb-1">{p.school_name}</h3>
                                    <div class="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-3">
                                        <span class="bg-gray-100 dark:bg-neutral-700 px-2 py-0.5 rounded font-mono font-bold text-gray-700 dark:text-neutral-300">{p.academic_year}</span>
                                        <span class="capitalize">{p.paper_type || 'Trial'}</span>
                                        <span class="text-blue-600 dark:text-blue-400 font-bold uppercase">{p.subject}</span>
                                    </div>
                                    <div class="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 mt-4 pt-3 border-t border-gray-50 dark:border-neutral-700">
                                        <span>📝 {p.question_count || 0} Questions</span>
                                    </div>
                                </a>
                            ))}
                        </div>
                    </div>

                    {/* 4. Q&A and Essays (Split Row) */}
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-12 border-t dark:border-neutral-800 pt-8">
                        {/* Q&A */}
                        <div>
                            <div class="flex items-center justify-between mb-6">
                                <h2 class="text-2xl font-bold text-gray-900 dark:text-white">Recent Q&A</h2>
                                <a href="/forum" class="text-blue-600 dark:text-blue-400 hover:underline text-sm font-bold">Visit Forum →</a>
                            </div>
                            <div class="space-y-4">
                                {latestQuestions?.length === 0 ? <p class="text-gray-500 dark:text-gray-400">No questions yet.</p> : latestQuestions?.map((q: any) => (
                                    <a href={`/forum/post/${q.id}`} class="block bg-white dark:bg-neutral-800 p-4 rounded border border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-700 transition-colors">
                                        <h3 class="font-bold text-gray-900 dark:text-white truncate mb-1">{q.title}</h3>
                                        <div class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                            <span class="text-blue-600 dark:text-blue-400 font-bold uppercase">{q.subject}</span>
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
                                <h2 class="text-2xl font-bold text-gray-900 dark:text-white">Latest Essays</h2>
                                <a href="/essays" class="text-blue-600 dark:text-blue-400 hover:underline text-sm font-bold">Exchange →</a>
                            </div>
                            <div class="space-y-4">
                                {latestEssays?.length === 0 ? <p class="text-gray-500 dark:text-gray-400">No essays yet.</p> : latestEssays?.map((e: any) => (
                                    <a href={`/essays/view/${e.id}`} class="block bg-white dark:bg-neutral-800 p-4 rounded border border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-700 transition-colors">
                                        <h3 class="font-bold text-gray-900 dark:text-white truncate mb-1">{e.title}</h3>
                                        <div class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                            <span class="text-purple-600 dark:text-purple-400 font-bold uppercase">{e.subject}</span>
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
                        
                        // HSC Timeline Setup
                        const hscStart = new Date("2022-01-01T00:00:00").getTime();
                        const hscEnd = new Date("2027-10-12T09:00:00").getTime(); // Approximate HSC Start
                        
                        // 1. Generate HSC Progress Grid
                        function initHscProgress() {
                            const now = new Date().getTime();
                            
                            // Calculate in weeks
                            const msPerWeek = 1000 * 60 * 60 * 24 * 7;
                            const totalWeeks = Math.ceil((hscEnd - hscStart) / msPerWeek);
                            const elapsedWeeks = Math.max(0, Math.floor((now - hscStart) / msPerWeek));
                            
                            const container = document.getElementById("hsc-progress-container");
                            
                            
                            if (container) {
                                // textContainer.innerText = \`\${elapsedWeeks} / \${totalWeeks} Weeks Completed\`;
                                
                                let boxesHtml = '';
                                for(let i = 0; i < totalWeeks; i++) {
                                    if(i < elapsedWeeks) {
                                        boxesHtml += '<div class="w-5 h-5 md:w-3 md:h-3 bg-blue-600 dark:bg-blue-500 rounded-[1px] shadow-sm" title="Week ' + (i+1) + ' (Completed)"></div>';
                                    } else {
                                        boxesHtml += '<div class="w-5 h-5 md:w-3 md:h-3 bg-gray-100 dark:bg-neutral-700 border border-gray-200 dark:border-neutral-600 rounded-[1px]" title="Week ' + (i+1) + '"></div>';
                                    }
                                }
                                boxesHtml += '<div class="w-5 h-5 md:w-3 md:h-3 bg-red-600 dark:bg-red-500 rounded-[1px] shadow-sm" title="Week ' + (totalWeeks+1) + ' (HSC)"></div>';
                                container.innerHTML = boxesHtml;
                            }
                        }

                        // 2. Continuous Countdown Timer
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
                        initHscProgress();
                        setInterval(updateCountdowns, 1000);
                        updateCountdowns();
                    })();
                ` }} />

            </div>
        </Layout>
    )
})

export default app