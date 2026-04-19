import { Hono } from 'hono'
import { Layout } from '../layout'
import { getUser, renderTags, getFruitPermission, formatDate } from '../utils'
import { Bindings, User } from '../types'

const app = new Hono<{ Bindings: Bindings }>()

app.get('/profile', async (c) => {
    const user = await getUser(c) as User | null
    if (!user) return c.redirect('/login')

    let userTags: Record<string, number> = {};
    try {
        userTags = user.tags ? JSON.parse(user.tags) : {};
    } catch (e) {
        userTags = {};
    }

    const tagKeys = Object.keys(userTags);

    return c.html(
        <Layout title="Profile" user={user}>
            <div class="max-w-2xl mx-auto py-10 px-4">
                <header class="mb-8">
                    <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Profile Settings</h1>
                    
                </header>

                <section class="space-y-6">
                    {/* Basic Info - Simple List */}
                    <div class="border-t border-gray-200 dark:border-neutral-800 pt-6">
                        <dl class="divide-y divide-gray-100 dark:divide-neutral-800 text-sm">
                            <div class="py-3 flex justify-between">
                                <dt class="font-medium text-gray-500">Full Name</dt>
                                <dd class="text-gray-900 dark:text-neutral-200">
                                    {user.first_name} {user.last_name}
                                    <span class="ml-2" dangerouslySetInnerHTML={{ __html: renderTags(user.tags || null) }}></span>
                                </dd>
                            </div>
                            <div class="py-3 flex justify-between">
                                <dt class="font-medium text-gray-500">Student ID</dt>
                                <dd class="font-mono text-gray-900 dark:text-neutral-200">{user.student_id || '—'}</dd>
                            </div>
                            <div class="py-3 flex justify-between">
                                <dt class="font-medium text-gray-500">Role</dt>
                                <dd class="text-gray-900 dark:text-neutral-200">{user.role}</dd>
                            </div>
                            <div class="py-3 flex justify-between">
                                <dt class="font-medium text-gray-500">Since</dt>
                                <dd class="text-gray-900 dark:text-neutral-200">{formatDate(user.created_at)}</dd>
                            </div>
                        </dl>
                    </div>

                    {/* Tag Management */}
                    <div class="bg-gray-50 dark:bg-neutral-900 p-6 rounded-lg">
                        <h2 class="text-sm font-semibold mb-4 text-gray-900 dark:text-white">Visibility Tags</h2>
                        {tagKeys.length === 0 ? (
                            <p class="text-xs text-gray-500 italic">No tags available to manage.</p>
                        ) : (
                            <form action="/profile" method="post" class="space-y-4">
                                <input type="hidden" name="action" value="update_tags" />
                                <div class="flex flex-wrap gap-4">
                                    {tagKeys.map(tag => (
                                        <label class="flex items-center gap-2 cursor-pointer text-sm">
                                            <input
                                                type="checkbox"
                                                name={`tag_${encodeURIComponent(tag)}`}
                                                value="1"
                                                checked={!!userTags[tag]}
                                                class="rounded border-gray-300"
                                            />
                                            <span class="text-gray-700 dark:text-neutral-300">{tag}</span>
                                        </label>
                                    ))}
                                </div>
                                <button type="submit" class="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 transition">
                                    Update Tags
                                </button>
                            </form>
                        )}
                    </div>

                    {/* Navigation */}
                    <div class="pt-4">
                        <a href="/profile/contributions" class="text-sm text-blue-600 hover:underline">
                            View my contributions &rarr;
                        </a>
                    </div>
                </section>
            </div>
        </Layout>
    )
})


app.post('/profile', async (c) => {
    const user = await getUser(c) as User | null
    if (!user) return c.redirect('/login')

    const body = await c.req.parseBody()
    const action = body['action']

    if (action === 'update_tags') {

        let currentTags: Record<string, number> = {};
        try {
            currentTags = user.tags ? JSON.parse(user.tags) : {};
        } catch (e) {
            currentTags = {};
        }

        const newTags: Record<string, number> = {};

        for (const tag of Object.keys(currentTags)) {

            const formKey = `tag_${encodeURIComponent(tag)}`;

            if (body[formKey] === '1') {
                newTags[tag] = 1;
            } else {
                newTags[tag] = 0;
            }
        }
        await c.env.DB.prepare('UPDATE users SET tags = ? WHERE id = ?')
            .bind(JSON.stringify(newTags), user.id).run();
        return c.redirect('/profile')
    }


    if (action === 'change_password') {
        // TODO: change password
    }

    return c.redirect('/profile')
})

app.get('/profile/contributions', async (c) => {
    const user = await getUser(c) as User | null
    if (!user) return c.redirect('/login')

    const { results: myResources } = await c.env.DB.prepare('SELECT * FROM resources WHERE uploader_id = ? ORDER BY created_at DESC').bind(user.id).all();
    const { results: myAnnouncements } = await c.env.DB.prepare('SELECT * FROM announcements WHERE author_id = ? ORDER BY created_at DESC').bind(user.id).all();

    return c.html(
        <Layout title="My Contributions" user={user}>
            <div class="max-w-5xl mx-auto py-8 px-4 sm:px-6">
                <div class="flex items-center justify-between mb-8">
                    <h1 class="text-3xl font-bold text-gray-900 dark:text-white">My Contributions</h1>
                    <a href="/profile" class="text-blue-600 dark:text-blue-400 hover:underline">← Back to Profile</a>
                </div>

                <div class="space-y-12">
                    {/* Resources */}
                    <section>
                        <h2 class="text-2xl font-bold mb-4 flex items-center gap-2 text-gray-800 dark:text-neutral-100">
                            <span class="bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-400 text-sm px-2 py-1 rounded-full">{myResources?.length || 0}</span>
                            Resources Shared
                        </h2>
                        {myResources?.length === 0 ? (
                            <div class="bg-gray-50 dark:bg-neutral-900/50 border border-dashed border-gray-300 dark:border-neutral-700 rounded-xl p-6 text-center text-gray-500 dark:text-neutral-400">
                                You haven't uploaded any resources yet.
                            </div>
                        ) : (
                            <div class="grid grid-cols-1 gap-4">
                                {myResources?.map((r: any) => (
                                    <div class="bg-white dark:bg-neutral-800 p-4 rounded-xl border border-gray-300 dark:border-neutral-700 flex justify-between items-center group hover:border-blue-500 dark:hover:border-blue-400 transition-colors shadow-sm">
                                        <div>
                                            <h3 class="font-bold text-gray-800 dark:text-neutral-100">{r.title}</h3>
                                            <p class="text-sm text-gray-500 dark:text-neutral-400">{r.subject} • {formatDate(r.created_at)}</p>
                                        </div>
                                        <a href={`/download/${r.file_key}`} target="_blank" class="text-blue-600 dark:text-blue-400 text-sm font-medium hover:underline">Download</a>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    {/* Announcements */}
                    <section>
                        <h2 class="text-2xl font-bold mb-4 flex items-center gap-2 text-gray-800 dark:text-neutral-100">
                            <span class="bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-400 text-sm px-2 py-1 rounded-full">{myAnnouncements?.length || 0}</span>
                            Announcements Posted
                        </h2>
                        {myAnnouncements?.length === 0 ? (
                            <div class="bg-gray-50 dark:bg-neutral-900/50 border border-dashed border-gray-300 dark:border-neutral-700 rounded-xl p-6 text-center text-gray-500 dark:text-neutral-400">
                                You haven't posted any announcements yet.
                            </div>
                        ) : (
                            <div class="grid grid-cols-1 gap-4">
                                {myAnnouncements?.map((a: any) => (
                                    <div class="bg-white dark:bg-neutral-800 p-4 rounded-xl border border-gray-300 dark:border-neutral-700 hover:border-purple-500 dark:hover:border-purple-400 transition-colors shadow-sm">
                                        <div class="flex justify-between">
                                            <h3 class="font-bold text-gray-800 dark:text-neutral-100">{a.title}</h3>
                                            <span class="text-xs text-gray-400 dark:text-neutral-500">{formatDate(a.created_at)}</span>
                                        </div>
                                        <p class="text-sm text-gray-600 dark:text-neutral-300 mt-1 line-clamp-1">{a.content}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </Layout>
    )
})

export default app
