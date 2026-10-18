import { Hono } from 'hono'
import { Layout } from '../layout'
import { Bindings } from '../types'
import { getUser, loginRedirect, formatDate, logAction } from '../utils'
import { PermissionLevel, canPostGeneral } from '../permissions'

const app = new Hono<{ Bindings: Bindings }>()

type LeaderboardSubject = {
    subject: string
    displayLimit: number
    showPercentage: boolean
    entries: { name: string; rank: number; percentage: number | string }[]
}

// Year 11 Overall (S1+S2)
const OVERALL_LEADERBOARD_DATA: LeaderboardSubject[] = [
    {
        subject: "Overall",
        displayLimit: 5,
        showPercentage: false,
        entries: [
            { name: "", rank: 1, percentage: "" },
        ]
    },
    {
        subject: "English Advanced",
        displayLimit: 2,
        showPercentage: true,
        entries: [
            { name: "Nicklas Li", rank: 1, percentage: "98"},
            { name: "", rank: 2, percentage: "" },
            { name: "", rank: 3, percentage: "" },
        ]
    },
    {
        subject: "Mathematics",
        displayLimit: 3,
        showPercentage: true,
        entries: [
            { name: "Daniel Zmak", rank: 1, percentage: "95" },
            { name: "Lin Le", rank: 2, percentage: "94" },
            { name: "Munjin CHOWDHURY", rank: 3, percentage: "94" },
        ]
    },
    {
        subject: "Physics",
        displayLimit: 4,
        showPercentage: true,
        entries: [
            { name: "Lin Le", rank: 1, percentage: "" },
            { name: "", rank: 2, percentage: "" },
            { name: "", rank: 3, percentage: "" },
        ]
    },
    {
        subject: "Chemistry",
        displayLimit: 3,
        showPercentage: true,
        entries: [
            { name: "Jiekai Miao", rank: 1, percentage: "" },
            { name: "Joshua Kuo", rank: 2, percentage: "89" },
            { name: "", rank: 3, percentage: "" },
        ]
    },
    {
        subject: "Biology",
        displayLimit: 4,
        showPercentage: true,
        entries: [
            { name: "Jiekai Miao", rank: 1, percentage: "" },
            { name: "", rank: 2, percentage: "" },
            { name: "", rank: 3, percentage: "" },
        ]
    },
    {
        subject: "English Extension",
        displayLimit: 1,
        showPercentage: true,
        entries: [
            { name: "", rank: 1, percentage: "" },
        ]
    },
    {
        subject: "SOR",
        displayLimit: 2,
        showPercentage: true,
        entries: [
            { name: "Aryan Ghosh", rank: 1, percentage: "97" },
            { name: "Joshua Kuo", rank: 2, percentage: "94" },
        ]
    },
    {
        subject: "Economics",
        displayLimit: 2,
        showPercentage: true,
        entries: [
            { name: "", rank: 1, percentage: "" },
        ]
    },
    {
        subject: "Modern History",
        displayLimit: 1,
        showPercentage: false,
        entries: [
            { name: "", rank: 1, percentage: "" },
        ]
    },
    {
        subject: "Business Studies",
        displayLimit: 1,
        showPercentage: false,
        entries: [
            { name: "", rank: 1, percentage: "" },
        ]
    },
    {
        subject: "Legal Studies",
        displayLimit: 1,
        showPercentage: true,
        entries: [
            { name: "", rank: 1, percentage: "" },
        ]
    },
    {
        subject: "Geography",
        displayLimit: 1,
        showPercentage: true,
        entries: [
            { name: "", rank: 1, percentage: "" },
        ]
    },
    {
        subject: "Engineering Studies",
        displayLimit: 2,
        showPercentage: true,
        entries: [
            { name: "Felix Tran", rank: 1, percentage: "95" },
            { name: "Joshua Kuo", rank: 2, percentage: "95" },
        ]
    },
    {
        subject: "Health and Movement Science",
        displayLimit: 1,
        showPercentage: false,
        entries: [
            { name: "", rank: 1, percentage: "" },
        ]
    },
    {
        subject: "Music",
        displayLimit: 1,
        showPercentage: false,
        entries: [
            { name: "", rank: 1, percentage: "" },
        ]
    },
    {
        subject: "Visual Arts",
        displayLimit: 1,
        showPercentage: false,
        entries: [
            { name: "", rank: 1, percentage: "" },
        ]
    },
    {
        subject: "Software Engineering",
        displayLimit: 1,
        showPercentage: true,
        entries: [
            { name: "Ricky Luo", rank: 1, percentage: "94" },
        ]
    },
    {
        subject: "Acc. Business Studies",
        displayLimit: 1,
        showPercentage: false,
        entries: [
            { name: "Charlie Cheshire", rank: 1, percentage: ""},
        ]
    },
    {
        subject: "Acc. Geography",
        displayLimit: 1,
        showPercentage: true,
        entries: [
            { name: "PRADYUM NUGGEHALLI", rank: 1, percentage: "" },
        ]
    },
    {
        subject: "Acc. Modern History",
        displayLimit: 1,
        showPercentage: false,
        entries: [
            { name: "", rank: 1, percentage: "" },
        ]
    },
]

// Year 11 Semester 1
const LEADERBOARD_DATA: LeaderboardSubject[] = [
    {
        subject: "Overall",
        displayLimit: 5,
        showPercentage: false,
        entries: [
            { name: "Jiekai Miao", rank: 1, percentage: '%%' },
            { name: "Aarav Mishra", rank: 2, percentage: '%%' },
            { name: "Sharvil Pande", rank: 3, percentage: '%%' },
            { name: "Pradyum Nuggehalli", rank: 4, percentage: '%%' },
            { name: "Hayden Nguyen", rank: 5, percentage: '%%' },
        ]
    },
    {
        subject: "English Advanced",
        displayLimit: 2,
        showPercentage: true,
        entries: [
            { name: "Luke Busic", rank: 1, percentage: 100 },
            { name: "Nireat Deka", rank: 1, percentage: 100 },
            { name: "", rank: 3, percentage: 95 },
            { name: "", rank: 12, percentage: 90},
            
        ]
    },
    {
        subject: "Mathematics",
        displayLimit: 3,
        showPercentage: true,
        entries: [
            { name: "Daniel Zmak", rank: 1, percentage: 93 },
            { name: "Munjin CHOWDHURY", rank: 2, percentage: 92 },
            { name: "Lin Le", rank: 3, percentage: 90 },
            
            { name: "?", rank: 5, percentage: 98 },
        ]
    },
    {
        subject: "Physics",
        displayLimit: 4,
        showPercentage: true,
        entries: [
            { name: "Lin Le", rank: 1, percentage: 82 },
            { name: "jiekai miao", rank: 2, percentage: 80 },
            { name: "tom ye", rank: 3, percentage: 78 },
            

        ]
    },
    {
        subject: "Chemistry",
        displayLimit: 3,
        showPercentage: true,
        entries: [
            { name: "Joshua Kuo", rank: 1, percentage: 98 },
            { name: "Jiekai Miao", rank: 1, percentage: 98 },
            { name: "Tom Ye", rank: 3, percentage: 96 },
            { name: "?", rank: 4, percentage: 98 },
            { name: "?", rank: 5, percentage: 98 },
        ]
    },
    {
        subject: "Biology",
        displayLimit: 4,
        showPercentage: true,
        entries: [
            { name: "nicklas li", rank: 1, percentage: 94 },
            { name: "jiekai miao", rank: 1, percentage: 94 },
            { name: "aryan ghosh", rank: 3, percentage: 92 },
            { name: "lin le", rank: 3, percentage: 92 },
            

            { name: "?", rank: 5, percentage: 98 },
        ]
    },
    {
        subject: "English Extension",
        displayLimit: 1,
        showPercentage: true,
        entries: [
            { name: "Akshobhya KUMAR", rank: 1, percentage: 100 },
            { name: "?", rank: 2, percentage: 98 },
            { name: "?", rank: 3, percentage: 98 },
            { name: "?", rank: 4, percentage: 98 },
            { name: "?", rank: 5, percentage: 98 },
        ]
    },
    {
        subject: "SOR",
        displayLimit: 1,
        showPercentage: true,
        entries: [
            { name: "Aryan Ghosh", rank: 1, percentage: 95 },
            { name: "?", rank: 2, percentage: 98 },
            { name: "?", rank: 3, percentage: 98 },
            { name: "?", rank: 4, percentage: 98 },
            { name: "?", rank: 5, percentage: 98 },
        ]
    },
    {
        subject: "Economics",
        displayLimit: 2,
        showPercentage: true,
        entries: [
            { name: "Charlie Chesire", rank: 1, percentage: 94 },
            { name: "Ryan Park", rank: 1, percentage: 94 },
            { name: "?", rank: 3, percentage: 98 },
            { name: "?", rank: 4, percentage: 98 },
            { name: "?", rank: 5, percentage: 98 },
        ]
    },
    {
        subject: "Modern History",
        displayLimit: 1,
        showPercentage: false,
        entries: [
            { name: "(Year 10)", rank: 1, percentage: 670 },
            { name: "?", rank: 2, percentage: 98 },
            { name: "?", rank: 3, percentage: 98 },
            { name: "?", rank: 4, percentage: 98 },
            { name: "?", rank: 5, percentage: 98 },
        ]
    },
    {
        subject: "Business Studies",
        displayLimit: 1,
        showPercentage: false,
        entries: [
            { name: "(Year 10)", rank: 1, percentage: 670 },
            { name: "?", rank: 2, percentage: 98 },
            { name: "?", rank: 3, percentage: 98 },
            { name: "?", rank: 4, percentage: 98 },
            { name: "?", rank: 5, percentage: 98 },
        ]
    },
    {
        subject: "Legal Studies",
        displayLimit: 1,
        showPercentage: true,
        entries: [
            { name: "Tuyvan Mai", rank: 1, percentage: 88},
            { name: "?", rank: 2, percentage: 98 },
            { name: "?", rank: 3, percentage: 98 },
            { name: "?", rank: 4, percentage: 98 },
            { name: "?", rank: 5, percentage: 98 },
        ]
    },
        {
        subject: "Geography",
        displayLimit: 1,
        showPercentage: true,
        entries: [
            { name: "Charlie Caro", rank: 1, percentage: 100 },
            { name: "?", rank: 2, percentage: 98 },
            { name: "?", rank: 3, percentage: 98 },
            { name: "?", rank: 4, percentage: 98 },
            { name: "?", rank: 5, percentage: 98 },
        ]
    },
            {
        subject: "Engineering Studies",
        displayLimit: 1,
        showPercentage: true,
        entries: [
            { name: "Joshua Kuo", rank: 1, percentage: 94 },
            { name: "?", rank: 2, percentage: 98 },
            { name: "?", rank: 3, percentage: 98 },
            { name: "?", rank: 4, percentage: 98 },
            { name: "?", rank: 5, percentage: 98 },
        ]
    },    
    {
        subject: "Health and Movement Science",
        displayLimit: 1,
        showPercentage: false,
        entries: [
            { name: "Mahir Patel", rank: 1, percentage: 670 },
            { name: "?", rank: 2, percentage: 98 },
            { name: "?", rank: 3, percentage: 98 },
            { name: "?", rank: 4, percentage: 98 },
            { name: "?", rank: 5, percentage: 98 },
        ]
    },  
    {
        subject: "Music",
        displayLimit: 1,
        showPercentage: false,
        entries: [
            { name: "(Year 10)", rank: 1, percentage: 670 },
            { name: "?", rank: 2, percentage: 98 },
            { name: "?", rank: 3, percentage: 98 },
            { name: "?", rank: 4, percentage: 98 },
            { name: "?", rank: 5, percentage: 98 },
        ]
    },  
    {
        subject: "Visual Arts",
        displayLimit: 1,
        showPercentage: false,
        entries: [
            { name: "Thomas Zheng", rank: 1, percentage: 670 },
            { name: "?", rank: 2, percentage: 98 },
            { name: "?", rank: 3, percentage: 98 },
            { name: "?", rank: 4, percentage: 98 },
            { name: "?", rank: 5, percentage: 98 },
        ]
    },  
    {
        subject: "Software Engineering",
        displayLimit: 1,
        showPercentage: true,
        entries: [
            { name: "Ricky Luo", rank: 1, percentage: 96 },
            { name: "?", rank: 2, percentage: 98 },
            { name: "?", rank: 3, percentage: 98 },
            { name: "?", rank: 4, percentage: 98 },
            { name: "?", rank: 5, percentage: 98 },
        ]
    },  
    {
        subject: "Acc. Business Studies",
        displayLimit: 1,
        showPercentage: true,
        entries: [
            { name: "Charlie CHESHIRE", rank: 1, percentage: 94},
            { name: "?", rank: 2, percentage: 98 },
            { name: "?", rank: 3, percentage: 98 },
            { name: "?", rank: 4, percentage: 98 },
            { name: "?", rank: 5, percentage: 98 },
        ]
    },  
    {
        subject: "Acc. Geography",
        displayLimit: 1,
        showPercentage: true,
        entries: [
            { name: "Pradyum NUGGEHALLI", rank: 1, percentage: 97},
            { name: "?", rank: 2, percentage: 98 },
            { name: "?", rank: 3, percentage: 98 },
            { name: "?", rank: 4, percentage: 98 },
            { name: "?", rank: 5, percentage: 98 },
        ]
    },  
    {
        subject: "Acc. Modern History",
        displayLimit: 1,
        showPercentage: false,
        entries: [
            { name: "(Year 12)", rank: 1, percentage: 97},
            { name: "?", rank: 2, percentage: 98 },
            { name: "?", rank: 3, percentage: 98 },
            { name: "?", rank: 4, percentage: 98 },
            { name: "?", rank: 5, percentage: 98 },
        ]
    },  

]

const LeaderboardGrid = ({ data }: { data: LeaderboardSubject[] }) => (
    /* The Grid: 1 col on mobile, 2 on tablet, 3 on desktop */
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {data.map((sub) => {
            const visibleEntries = sub.entries
                .filter(e => e.rank <= sub.displayLimit)
                .sort((a, b) => a.rank - b.rank);

            return (
                <div class="flex flex-col">
                    <h2 class="font-mono font-bold text-sm mb-2 px-2 py-1 bg-black text-white dark:bg-white dark:text-black self-start">
                        {sub.subject}
                    </h2>

                    <div class="overflow-x-auto border border-gray-300 dark:border-neutral-700">
                        <table class="w-full text-left border-collapse font-mono text-sm">
                            <thead>
                                <tr class="bg-gray-100 dark:bg-neutral-800 border-b border-gray-300 dark:border-neutral-700">
                                    <th class="px-3 py-2 border-r border-gray-300 dark:border-neutral-700 w-12 text-center">RANK</th>
                                    <th class="px-3 py-2 border-r border-gray-300 dark:border-neutral-700">NAME</th>
                                    {sub.showPercentage && (
                                        <th class="px-3 py-2 text-right">PERCENTAGE</th>
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {visibleEntries.map((person) => (
                                    <tr class="border-b border-gray-200 dark:border-neutral-800 hover:bg-gray-50 dark:hover:bg-neutral-900 last:border-0">
                                        <td class={`px-3 py-2 border-r border-gray-300 dark:border-neutral-700 text-center font-bold ${person.rank === 1 ? 'text-amber-600' : ''}`}>
                                            {person.rank.toString().padStart(2, '0')}
                                        </td>
                                        <td class="px-3 py-2 border-r border-gray-300 dark:border-neutral-700 uppercase">
                                            {person.name}
                                        </td>
                                        {sub.showPercentage && (
                                            <td class="px-3 py-2 text-right text-blue-600 dark:text-blue-400">
                                                {person.percentage === '' ? '' : `${person.percentage}%`}
                                            </td>
                                        )}
                                    </tr>
                                ))}
                                {/* Fill empty rows to keep tables consistent height (Optional) */}
                                {/* {Array.from({ length: Math.max(0, 5 - visibleEntries.length) }).map(() => (
                                    <tr class="border-b border-gray-200 dark:border-neutral-800 opacity-20">
                                        <td class="px-3 py-2 border-r border-gray-300 dark:border-neutral-700">&nbsp;</td>
                                        <td class="px-3 py-2 border-r border-gray-300 dark:border-neutral-700">&nbsp;</td>
                                        {sub.showPercentage && <td class="px-3 py-2">&nbsp;</td>}
                                    </tr>
                                ))} */}
                            </tbody>
                        </table>
                    </div>

                </div>
            )
        })}

    </div>
)

// Submissions are for the Overall board. They go to an admin-only queue and never change the page.
const SUBMITTABLE_SUBJECTS = OVERALL_LEADERBOARD_DATA.map(s => s.subject)
const MAX_RANK = 300

type SubmissionRow = {
    id: number
    subject: string
    nominee_name: string
    rank: number
    percentage: number | null
    created_at: string
    first_name: string | null
    last_name: string | null
    student_id: string | null
}

const isAdmin = (user: any) => !!user && Number(user.permission_level) >= PermissionLevel.ADMIN

const labelClass = 'block text-xs uppercase font-bold text-gray-500 dark:text-gray-400 mb-1'
const inputClass = 'w-full border border-gray-300 dark:border-neutral-700 bg-white dark:bg-black px-3 py-2 text-sm text-gray-900 dark:text-white outline-none'

app.get('/leaderboard', async (c) => {
    const user = await getUser(c)
    const submitted = c.req.query('submitted') === '1'

    let pendingSubmissions = 0
    if (isAdmin(user)) {
        pendingSubmissions = (await c.env.DB.prepare(
            'SELECT COUNT(*) AS n FROM leaderboard_submissions WHERE is_deleted = 0'
        ).first<number>('n')) ?? 0
    }

    const userSubmissionsRes = await c.env.DB.prepare(
        'SELECT * FROM atar_submissions WHERE user_id = ? AND is_deleted = 0 ORDER BY created_at DESC'
    ).bind(user?.id || 0).all();
    const userSubmissions = userSubmissionsRes.results || [];
    
    const hasSubmitted = userSubmissions.length > 0;
    
    let allSubmissions: { rank: number; aggregate: number }[] = [];
    if (hasSubmitted || (user && user.permission_level > 1)) {
        const { results } = await c.env.DB.prepare(
            'SELECT rank, aggregate FROM atar_submissions WHERE is_deleted = 0 ORDER BY rank ASC'
        ).all();
        allSubmissions = (results || []) as { rank: number; aggregate: number }[];
    }

    return c.html(
        <Layout title="Hall of Fame (Year 11)" user={user}>
            <div class="max-w-7xl mx-auto px-4 py-8">
                <section class="mb-16">
                    <header class="mb-8 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
                        <h1 class="text-3xl font-mono font-bold uppercase tracking-tighter mb-2">Year 11 Overall (S1+S2)</h1>
                        {isAdmin(user) && (
                            <a href="/leaderboard/submissions" class="font-mono text-sm font-bold uppercase underline hover:opacity-70">
                                Submissions ({pendingSubmissions})
                            </a>
                        )}
                    </header>

                    {submitted && (
                        <p class="mb-4 font-mono text-sm text-green-700 dark:text-green-400">
                            Thanks! Ill check later
                        </p>
                    )}

                    <details class="mb-12 border border-gray-300 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900 font-mono">
                        <summary class="cursor-pointer select-none px-4 py-3 font-bold uppercase text-sm">Submit a result</summary>
                        <div class="px-4 pb-4">
                            <p class="text-xs text-gray-500 dark:text-gray-400 mb-4">
                                Up to top 5 each subject & Submissions don't appear on the leaderboard automatically btw
                            </p>
                            {!user ? (
                                <a href={loginRedirect(c)} class="text-sm font-bold underline">Log in to submit</a>
                            ) : !canPostGeneral(user) ? (
                                <p class="text-sm text-red-600 dark:text-red-400">You are muted and cannot submit results.</p>
                            ) : (
                                <form action="/leaderboard/submit" method="post" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                                    <div>
                                        <label class={labelClass} for="lb-subject">Subject</label>
                                        <select id="lb-subject" name="subject" required class={inputClass}>
                                            <option value="" disabled selected>Choose...</option>
                                            {SUBMITTABLE_SUBJECTS.map((s) => <option value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label class={labelClass} for="lb-nominee">Full name</label>
                                        <input id="lb-nominee" type="text" name="nominee_name" required maxlength={100} class={inputClass} />
                                    </div>
                                    <div>
                                        <label class={labelClass} for="lb-rank">Rank</label>
                                        <input id="lb-rank" type="number" name="rank" required min="1" max={String(MAX_RANK)} step="1" class={inputClass} />
                                    </div>
                                    <div>
                                        <label class={labelClass} for="lb-percentage">Percentage (optional)</label>
                                        <input id="lb-percentage" type="number" name="percentage" min="0" max="100" step="any" class={inputClass} />
                                    </div>
                                    <button type="submit" class="bg-black text-white dark:bg-white dark:text-black font-bold uppercase px-6 py-2 text-sm hover:opacity-80">
                                        Submit
                                    </button>
                                </form>
                            )}
                        </div>
                    </details>

                    <LeaderboardGrid data={OVERALL_LEADERBOARD_DATA} />
                </section>

                <section>
                    <header class="mb-12">
                        <h1 class="text-3xl font-mono font-bold uppercase tracking-tighter mb-2">Year 11 Semester 1</h1>
                    </header>

                    <LeaderboardGrid data={LEADERBOARD_DATA} />
                </section>
            </div>

        </Layout>
    )
})

app.post('/leaderboard/submit', async (c) => {
    const user = await getUser(c)
    if (!user) return c.redirect(loginRedirect(c, '/leaderboard'))
    if (!canPostGeneral(user)) return c.text('You are muted.', 403)

    const body = await c.req.parseBody()
    const subject = String(body['subject'] ?? '').trim()
    const nomineeName = String(body['nominee_name'] ?? '').trim()
    const rank = Number(body['rank'])
    const percentageRaw = String(body['percentage'] ?? '').trim()
    const percentage = percentageRaw === '' ? null : Number(percentageRaw)

    if (!SUBMITTABLE_SUBJECTS.includes(subject)) return c.text('Invalid subject.', 400)
    if (!nomineeName || nomineeName.length > 100) return c.text('Enter a full name (up to 100 characters).', 400)
    if (!Number.isInteger(rank) || rank < 1 || rank > MAX_RANK) return c.text(`Rank must be a whole number from 1 to ${MAX_RANK}.`, 400)
    if (percentage !== null && (!Number.isFinite(percentage) || percentage < 0 || percentage > 100)) {
        return c.text('Percentage must be between 0 and 100.', 400)
    }

    const res = await c.env.DB.prepare(
        'INSERT INTO leaderboard_submissions (submitter_id, subject, nominee_name, rank, percentage) VALUES (?, ?, ?, ?, ?)'
    ).bind(user.id, subject, nomineeName, rank, percentage).run()

    await logAction(c.env.DB, user.id, 'SUBMIT_LEADERBOARD', `${subject} #${rank}: "${nomineeName}"`, res.meta.last_row_id, 'leaderboard_submissions')

    return c.redirect('/leaderboard?submitted=1')
})

// Admin: review queue. Read-only with respect to the leaderboard itself.
app.get('/leaderboard/submissions', async (c) => {
    const user = await getUser(c)
    if (!user) return c.redirect(loginRedirect(c))
    if (!isAdmin(user)) return c.text('Unauthorised', 403)

    const { results } = await c.env.DB.prepare(`
        SELECT s.id, s.subject, s.nominee_name, s.rank, s.percentage, s.created_at,
               u.first_name, u.last_name, u.student_id
        FROM leaderboard_submissions s
        LEFT JOIN users u ON s.submitter_id = u.id
        WHERE s.is_deleted = 0
        ORDER BY s.rank ASC, s.created_at ASC
    `).all<SubmissionRow>()

    // Group by subject, in the same order as the leaderboard. Subjects since removed from the board go last.
    const bySubject = new Map<string, SubmissionRow[]>()
    for (const s of results || []) {
        if (!bySubject.has(s.subject)) bySubject.set(s.subject, [])
        bySubject.get(s.subject)!.push(s)
    }
    const subjectOrder = (s: string) => {
        const i = SUBMITTABLE_SUBJECTS.indexOf(s)
        return i === -1 ? SUBMITTABLE_SUBJECTS.length : i
    }
    const groups = [...bySubject.entries()].sort((a, b) => subjectOrder(a[0]) - subjectOrder(b[0]))

    return c.html(
        <Layout title="Leaderboard Submissions" user={user}>
            <div class="max-w-5xl mx-auto px-4 py-8 font-mono">
                <a href="/leaderboard" class="text-sm underline hover:opacity-70">← Leaderboard</a>
                <header class="mt-4 mb-8">
                    <h1 class="text-3xl font-bold uppercase tracking-tighter mb-2">Submissions</h1>
                    <p class="text-sm text-gray-600 dark:text-gray-400">
                        {(results || []).length} pending for Year 11 Overall (S1+S2). These don't change the leaderboard: update
                        <code class="mx-1">OVERALL_LEADERBOARD_DATA</code> in <code>src/routes/leaderboard.tsx</code>.
                    </p>
                </header>

                {groups.length === 0 ? (
                    <p class="text-sm text-gray-500 italic">No submissions yet.</p>
                ) : (
                    <div class="space-y-10">
                        {groups.map(([subject, rows]) => (
                            <div>
                                <h2 class="inline-block font-bold text-sm mb-2 px-2 py-1 bg-black text-white dark:bg-white dark:text-black">
                                    {subject}
                                </h2>
                                <div class="overflow-x-auto border border-gray-300 dark:border-neutral-700">
                                    <table class="w-full text-left border-collapse text-sm">
                                        <thead>
                                            <tr class="bg-gray-100 dark:bg-neutral-800 border-b border-gray-300 dark:border-neutral-700 uppercase">
                                                <th class="px-3 py-2 border-r border-gray-300 dark:border-neutral-700 w-12 text-center">Rank</th>
                                                <th class="px-3 py-2 border-r border-gray-300 dark:border-neutral-700">Nominee</th>
                                                <th class="px-3 py-2 border-r border-gray-300 dark:border-neutral-700 text-right">%</th>
                                                <th class="px-3 py-2 border-r border-gray-300 dark:border-neutral-700">Submitted by</th>
                                                <th class="px-3 py-2 border-r border-gray-300 dark:border-neutral-700">Date</th>
                                                <th class="px-3 py-2"></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {rows.map((s) => (
                                                <tr class="border-b border-gray-200 dark:border-neutral-800 last:border-0">
                                                    <td class="px-3 py-2 border-r border-gray-300 dark:border-neutral-700 text-center font-bold">
                                                        {String(s.rank).padStart(2, '0')}
                                                    </td>
                                                    <td class="px-3 py-2 border-r border-gray-300 dark:border-neutral-700 uppercase">{s.nominee_name}</td>
                                                    <td class="px-3 py-2 border-r border-gray-300 dark:border-neutral-700 text-right text-blue-600 dark:text-blue-400">
                                                        {s.percentage == null ? '—' : `${s.percentage}%`}
                                                    </td>
                                                    <td class="px-3 py-2 border-r border-gray-300 dark:border-neutral-700 whitespace-nowrap">
                                                        {s.first_name ? `${s.first_name} ${s.last_name ?? ''}` : 'Unknown user'}
                                                        {s.student_id && <span class="ml-2 text-xs text-gray-500">{s.student_id}</span>}
                                                    </td>
                                                    <td class="px-3 py-2 border-r border-gray-300 dark:border-neutral-700 whitespace-nowrap">{formatDate(s.created_at)}</td>
                                                    <td class="px-3 py-2 text-right">
                                                        <form action={`/leaderboard/submissions/${s.id}/delete`} method="post" class="inline">
                                                            <button type="submit" class="text-red-600 dark:text-red-400 text-xs font-bold uppercase hover:underline" onclick="return confirm('Remove this submission?')">
                                                                Remove
                                                            </button>
                                                        </form>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </Layout>
    )
})

// Admin: clear a handled or bogus submission (soft delete).
app.post('/leaderboard/submissions/:id/delete', async (c) => {
    const user = await getUser(c)
    if (!isAdmin(user)) return c.text('Unauthorised', 403)

    const id = Number(c.req.param('id'))
    const existing = await c.env.DB.prepare(
        'SELECT id FROM leaderboard_submissions WHERE id = ? AND is_deleted = 0'
    ).bind(id).first()
    if (!existing) return c.notFound()

    await c.env.DB.prepare('UPDATE leaderboard_submissions SET is_deleted = 1 WHERE id = ?').bind(id).run()
    await logAction(c.env.DB, user.id, 'DELETE_LEADERBOARD_SUBMISSION', `Removed submission ${id}`, id, 'leaderboard_submissions')

    return c.redirect('/leaderboard/submissions')
})

export default app