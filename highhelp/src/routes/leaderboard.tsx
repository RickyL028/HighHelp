import { Hono } from 'hono'
import { Layout } from '../layout'
import { Bindings } from '../types'
import { getUser } from '../utils'

const app = new Hono<{ Bindings: Bindings }>()

const LEADERBOARD_DATA = [
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
            { name: "Reza Bassam", rank: 1, percentage: 670 },
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

app.get('/leaderboard', async (c) => {
    const user = await getUser(c)

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
        <Layout title="Hall of Fame (Y11 Semester 1)" user={user}>
            <div class="max-w-7xl mx-auto px-4 py-8">
                <header class="mb-12">
                    <h1 class="text-3xl font-mono font-bold uppercase tracking-tighter mb-2">Year 11 Semester 1</h1>
                    

                </header>

                {/* The Grid: 1 col on mobile, 2 on tablet, 3 on desktop */}
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {LEADERBOARD_DATA.map((sub) => {
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
                                                            {person.percentage}%
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
            </div>
                
        </Layout>
    )
})

export default app