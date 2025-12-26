import { Hono } from 'hono'
import { Layout } from './layout'

const app = new Hono<{ Bindings: Env }>()

app.get('/', (c) => {
    return c.html(
        <Layout title="Home">
            <div class="text-center py-20">
                <h1 class="text-4xl font-bold text-primary mb-4">Welcome to HighHelp</h1>
                <p class="text-xl text-gray-600 mb-8">The student-led platform for high school graduates.</p>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-left">
                    <div class="bg-white p-6 rounded-lg shadow-md border-t-4 border-primary">
                        <h2 class="text-xl font-bold mb-2">Resource Sharing</h2>
                        <p>Share and access high-quality notes from top students.</p>
                    </div>
                    <div class="bg-white p-6 rounded-lg shadow-md border-t-4 border-secondary">
                        <h2 class="text-xl font-bold mb-2">Past Papers</h2>
                        <p>Access a comprehensive bank of past exam papers.</p>
                    </div>
                    <div class="bg-white p-6 rounded-lg shadow-md border-t-4 border-primary">
                        <h2 class="text-xl font-bold mb-2">Q&A Forum</h2>
                        <p>Ask questions and get answers from the community.</p>
                    </div>
                </div>
            </div>
        </Layout>
    )
})

app.get('/resources', (c) => {
    return c.html(
        <Layout title="Resources">
            <h1 class="text-3xl font-bold mb-6">Resource Sharing</h1>
            <p class="mb-4">Upload and find notes here.</p>
            {/* Placeholder for resource list */}
            <div class="bg-white p-6 rounded shadow">
                <p class="text-gray-500 italic">Coming soon: List of files from R2 storage.</p>
            </div>
        </Layout>
    )
})

app.get('/announcements', async (c) => {
    const { results } = await c.env.DB.prepare('SELECT * FROM announcements ORDER BY created_at DESC').all()
    return c.html(
        <Layout title="Announcements">
            <h1 class="text-3xl font-bold mb-6">Announcements</h1>
            <div class="space-y-4">
                {results?.length === 0 ? (
                    <p class="text-gray-500">No announcements yet.</p>
                ) : (
                    results.map((a: any) => (
                        <div class="bg-white p-4 rounded shadow border-l-4 border-blue-500">
                            <h2 class="text-xl font-bold">{a.title}</h2>
                            <p class="mt-2">{a.content}</p>
                            <span class="text-xs text-gray-400 block mt-2">{new Date(a.created_at).toLocaleDateString()}</span>
                        </div>
                    ))
                )}
            </div>
        </Layout>
    )
})

app.get('/past-papers', (c) => {
    return c.html(
        <Layout title="Past Papers">
            <h1 class="text-3xl font-bold mb-6">Past Paper Bank</h1>
            <p>Access past papers here.</p>
        </Layout>
    )
})

app.get('/forum', (c) => {
    return c.html(
        <Layout title="Q&A Forum">
            <h1 class="text-3xl font-bold mb-6">Q&A Forum</h1>
            <p>Ask and answer questions here.</p>
        </Layout>
    )
})

app.get('/essays', (c) => {
    return c.html(
        <Layout title="Essay Exchange">
            <h1 class="text-3xl font-bold mb-6">Essay Exchange</h1>
            <p>Swap and review essays here.</p>
        </Layout>
    )
})


export default app
