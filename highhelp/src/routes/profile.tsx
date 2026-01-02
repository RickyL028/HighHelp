import { Hono } from 'hono'
import { Layout } from '../layout'
import { getUser, renderTags, censorEmail, getFruitPermission } from '../utils'
import { Bindings, User } from '../types'

const app = new Hono<{ Bindings: Bindings }>()

app.get('/profile', async (c) => {
    const user = await getUser(c) as User | null
    if (!user) return c.redirect('/login')

    // Parse Tags
    let userTags: Record<string, number> = {};
    try {
        userTags = user.tags ? JSON.parse(user.tags) : {};
    } catch (e) {
        userTags = {};
    }

    const tagKeys = Object.keys(userTags);

    return c.html(
        <Layout title="My Profile" user={user}>
            <div class="max-w-4xl mx-auto py-8">
                <h1 class="text-3xl font-bold mb-8 text-primary border-b pb-4">My Profile</h1>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* User Info Card */}
                    <div class="bg-white p-6 rounded-lg shadow-md border border-gray-200">
                        <h2 class="text-xl font-bold mb-4 text-gray-800">Account Details</h2>

                        <div class="space-y-4">
                            <div>
                                <label class="block text-xs font-bold text-gray-400 uppercase tracking-widest">Full Name</label>
                                <p class="text-lg font-medium">
                                    {user.first_name} {user.last_name}
                                    {/* Show Preview of Own Tags */}
                                    <span class="ml-2" dangerouslySetInnerHTML={{ __html: renderTags(user.tags || null) }}></span>
                                </p>
                            </div>

                            <div>
                                <label class="block text-xs font-bold text-gray-400 uppercase tracking-widest">Student ID</label>
                                <p class="text-lg font-mono">{user.student_id || 'N/A'}</p>
                            </div>

                            <div>
                                <label class="block text-xs font-bold text-gray-400 uppercase tracking-widest">Email</label>
                                <p class="text-lg font-mono">{censorEmail(user.email)}</p>
                            </div>

                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-xs font-bold text-gray-400 uppercase tracking-widest">Permission Level</label>
                                    <span class="inline-block bg-yellow-100 text-yellow-800 text-sm px-2 py-1 rounded-full font-bold mt-1">
                                        {getFruitPermission(user.permission_level)}
                                    </span>
                                </div>
                                <div>
                                    <label class="block text-xs font-bold text-gray-400 uppercase tracking-widest">Role</label>
                                    <span class="inline-block bg-blue-100 text-blue-800 text-sm px-2 py-1 rounded-full font-bold mt-1 capitalize">
                                        {user.role}
                                    </span>
                                </div>
                            </div>

                            <div>
                                <label class="block text-xs font-bold text-gray-400 uppercase tracking-widest">Joined</label>
                                <p class="text-sm text-gray-600">{new Date(user.created_at).toLocaleDateString()}</p>
                            </div>
                        </div>
                    </div>

                    <div class="space-y-8">
                        {/* Tags Section */}
                        <div class="bg-white p-6 rounded-lg shadow-md border border-gray-200">
                            <h2 class="text-xl font-bold mb-4 text-gray-800">Profile Tags</h2>
                            <p class="text-sm text-gray-500 mb-4">Toggle visibility of your awarded tags.</p>

                            {tagKeys.length === 0 ? (
                                <p class="text-gray-400 italic">You don't have any tags yet.</p>
                            ) : (
                                <form action="/profile" method="post">
                                    <input type="hidden" name="action" value="update_tags" />
                                    <div class="flex flex-wrap gap-3 mb-6">
                                        {tagKeys.map(tag => (
                                            <label class="inline-flex items-center cursor-pointer">

                                                <input
                                                    type="checkbox"
                                                    name={`tag_${encodeURIComponent(tag)}`}
                                                    value="1"
                                                    checked={!!userTags[tag]}
                                                    class="form-checkbox h-5 w-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                                />
                                                <span class="ml-2 text-gray-700 select-none">{tag}</span>
                                            </label>
                                        ))}
                                    </div>
                                    <button type="submit" class="bg-gray-800 text-white px-4 py-2 rounded text-sm font-medium hover:bg-gray-900 transition">
                                        Save Tags
                                    </button>
                                </form>
                            )}
                        </div>

                        {/* Password Change Section */}
                        <div class="bg-white p-6 rounded-lg shadow-md border border-gray-200">
                            <h2 class="text-xl font-bold mb-4 text-gray-800">Security</h2>
                            <form action="/profile" method="post" class="space-y-4">
                                <input type="hidden" name="action" value="change_password" />
                                <div>
                                    <label class="block text-sm font-medium text-gray-700">New Password</label>
                                    <input type="password" name="new_password" required minLength="6" placeholder="Min 6 characters" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border" />
                                </div>
                                <button type="submit" class="w-full bg-red-600 text-white px-4 py-2 rounded text-sm font-bold hover:bg-red-700 transition">
                                    Update Password
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
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
        // 1. Fetch current tags safely
        let currentTags: Record<string, number> = {};
        try {
            currentTags = user.tags ? JSON.parse(user.tags) : {};
        } catch (e) {
            currentTags = {};
        }

        const newTags: Record<string, number> = {};

        // 2. Iterate over the EXISTING keys from the DB
        for (const tag of Object.keys(currentTags)) {

            // --- THE FIX ---
            // We replicate exactly how the Frontend created the input name.
            // If the tag is "Dean's List", the key becomes "tag_Dean%27s%20List"
            const formKey = `tag_${encodeURIComponent(tag)}`;

            // 3. Check if that specific key exists in the form body
            if (body[formKey] === '1') {
                newTags[tag] = 1;
            } else {
                newTags[tag] = 0;
            }
        }

        // 4. Update Database
        await c.env.DB.prepare('UPDATE users SET tags = ? WHERE id = ?')
            .bind(JSON.stringify(newTags), user.id).run();

        // Redirect back to profile to show changes
        return c.redirect('/profile')
    }

    // Handle password change or other actions here...
    if (action === 'change_password') {
        // ... your password logic
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
            <div class="max-w-5xl mx-auto py-8">
                <div class="flex items-center justify-between mb-8">
                    <h1 class="text-3xl font-bold text-gray-900">My Contributions</h1>
                    <a href="/profile" class="text-blue-600 hover:underline">← Back to Profile</a>
                </div>

                <div class="space-y-12">
                    {/* Resources */}
                    <section>
                        <h2 class="text-2xl font-bold mb-4 flex items-center gap-2">
                            <span class="bg-blue-100 text-blue-800 text-sm px-2 py-1 rounded-full">{myResources?.length || 0}</span>
                            Resources Shared
                        </h2>
                        {myResources?.length === 0 ? (
                            <div class="bg-gray-50 border border-dashed border-gray-300 rounded p-6 text-center text-gray-500">
                                You haven't uploaded any resources yet.
                            </div>
                        ) : (
                            <div class="grid grid-cols-1 gap-4">
                                {myResources?.map((r: any) => (
                                    <div class="bg-white p-4 rounded shadow-sm border border-gray-200 flex justify-between items-center group hover:border-blue-400 transition">
                                        <div>
                                            <h3 class="font-bold text-gray-800">{r.title}</h3>
                                            <p class="text-sm text-gray-500">{r.subject} • {new Date(r.created_at).toLocaleDateString()}</p>
                                        </div>
                                        <a href={`/download/${r.file_key}`} target="_blank" class="text-blue-600 text-sm hover:underline">Download</a>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    {/* Announcements */}
                    <section>
                        <h2 class="text-2xl font-bold mb-4 flex items-center gap-2">
                            <span class="bg-purple-100 text-purple-800 text-sm px-2 py-1 rounded-full">{myAnnouncements?.length || 0}</span>
                            Announcements Posted
                        </h2>
                        {myAnnouncements?.length === 0 ? (
                            <div class="bg-gray-50 border border-dashed border-gray-300 rounded p-6 text-center text-gray-500">
                                You haven't posted any announcements yet.
                            </div>
                        ) : (
                            <div class="grid grid-cols-1 gap-4">
                                {myAnnouncements?.map((a: any) => (
                                    <div class="bg-white p-4 rounded shadow-sm border border-gray-200 hover:border-purple-400 transition">
                                        <div class="flex justify-between">
                                            <h3 class="font-bold text-gray-800">{a.title}</h3>
                                            <span class="text-xs text-gray-400">{new Date(a.created_at).toLocaleDateString()}</span>
                                        </div>
                                        <p class="text-sm text-gray-600 mt-1 line-clamp-1">{a.content}</p>
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
