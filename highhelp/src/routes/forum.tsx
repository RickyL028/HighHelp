import { Hono } from 'hono'
import { Layout } from '../layout'
import { getUser } from '../utils'
import { SubjectSelector } from '../components/SubjectSelector'
import { Bindings } from '../types'

const app = new Hono<{ Bindings: Bindings }>()

app.get('/forum', async (c) => {
    const user = await getUser(c)
    return c.html(
        <Layout title="Q&A Forum" user={user}>
            <div class="max-w-4xl mx-auto space-y-12">
                <section>
                    <h1 class="text-3xl font-bold mb-2">Q&A Forum</h1>
                    <p class="text-gray-600">Discussions coming soon.</p>
                </section>

                <hr class="border-gray-200" />

                <section>
                    <h2 class="text-xl font-bold mb-4">Select Subject</h2>
                    <SubjectSelector baseUrl="/forum" type="standard" />
                </section>
            </div>
        </Layout>
    )
})

export default app
