import { Hono } from 'hono'
import { Layout } from '../layout'
import { getUser, loginRedirect, renderTags, getFruitPermission, formatDate, RESERVED_TAGS } from '../utils'
import { subjectLabel } from '../constants'
import { notesQuery } from '../resourceFolders'
import { Bindings, User } from '../types'

const app = new Hono<{ Bindings: Bindings }>()

// A switch-styled checkbox. Changing it submits its form straight away; <noscript> keeps a Save button.
const NotificationToggle = ({ name, label, hint, checked }: { name: string; label: string; hint: string; checked: boolean }) => (
    <label class="flex items-center justify-between gap-4 py-3 cursor-pointer">
        <span>
            <span class="block text-sm text-gray-700 dark:text-neutral-300">{label}</span>
            <span class="block text-xs text-gray-500 dark:text-neutral-400 mt-0.5">{hint}</span>
        </span>
        <span class="relative inline-flex shrink-0">
            <input type="checkbox" name={name} value="1" checked={checked} class="peer sr-only" onchange="this.form.submit()" />
            <span class="w-9 h-5 rounded-full bg-gray-300 dark:bg-neutral-700 peer-checked:bg-blue-600 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500 peer-focus-visible:ring-offset-2 dark:peer-focus-visible:ring-offset-neutral-900"></span>
            <span class="absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4"></span>
        </span>
    </label>
)

app.get('/profile', async (c) => {
    const user = await getUser(c) as User | null
    if (!user) return c.redirect(loginRedirect(c))

    let userTags: Record<string, number> = {};
    try {
        userTags = user.tags ? JSON.parse(user.tags) : {};
    } catch (e) {
        userTags = {};
    }

    const tagKeys = Object.keys(userTags).filter(tag =>
        !RESERVED_TAGS.includes(tag) && (userTags[tag] === 0 || userTags[tag] === 1)
    );

    return c.html(
        <Layout title="Profile" user={user}>
            <div class="max-w-2xl mx-auto py-10 px-4">
                <header class="mb-8">
                    <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Profile Settings</h1>
                    
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

                    {/* Notifications */}
                    <div class="bg-gray-50 dark:bg-neutral-900 p-6 rounded-lg">
                        <h2 class="text-sm font-semibold mb-1 text-gray-900 dark:text-white">Notifications</h2>
                        <p class="text-xs text-gray-500 dark:text-neutral-400">Choose which tabs show a red dot when there's something new.</p>
                        <form action="/profile" method="post" class="mt-2 divide-y divide-gray-200 dark:divide-neutral-800">
                            <input type="hidden" name="action" value="update_notifications" />
                            <NotificationToggle
                                name="notify_announcements"
                                label="Announcements"
                                hint="New announcements aimed at you."
                                checked={user.notify_announcements !== 0}
                            />
                            <NotificationToggle
                                name="notify_questions"
                                label="Q&A"
                                hint="New questions in the subjects on your profile."
                                checked={!!user.notify_questions}
                            />
                            <noscript>
                                <button type="submit" class="mt-3 text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 transition">
                                    Save
                                </button>
                            </noscript>
                        </form>
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
    if (!user) return c.redirect(loginRedirect(c))

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

            const isToggleable = !RESERVED_TAGS.includes(tag) && (currentTags[tag] === 0 || currentTags[tag] === 1);

            if (!isToggleable) {
                // Preserve non-toggleable tags (e.g. Year, External) untouched
                newTags[tag] = currentTags[tag];
                continue;
            }

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


    if (action === 'update_notifications') {
        // Unchecked boxes aren't submitted, so a missing field means "off".
        await c.env.DB.prepare('UPDATE users SET notify_announcements = ?, notify_questions = ? WHERE id = ?')
            .bind(body['notify_announcements'] === '1' ? 1 : 0, body['notify_questions'] === '1' ? 1 : 0, user.id).run();
        return c.redirect('/profile')
    }

    if (action === 'change_password') {
        // TODO: change password
    }

    return c.redirect('/profile')
})

app.get('/profile/contributions', async (c) => {
    const user = await getUser(c) as User | null
    if (!user) return c.redirect(loginRedirect(c))

    // Notes the user uploaded that have not been removed (removed ones sit under the Removed folder).
    const mine = notesQuery({ uploaderId: user.id, limit: 500 });
    const { results: myResources } = await c.env.DB.prepare(mine.sql).bind(...mine.params).all();
    const { results: myAnnouncements } = await c.env.DB.prepare('SELECT * FROM announcements WHERE author_id = ? AND is_deleted = 0 ORDER BY created_at DESC').bind(user.id).all();

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
                                            <p class="text-sm text-gray-500 dark:text-neutral-400">{subjectLabel(r.subject)} • {formatDate(r.created_at)}</p>
                                        </div>
                                        <a href={`/resources/view/${r.id}`} class="text-blue-600 dark:text-blue-400 text-sm font-medium hover:underline">View</a>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    {/* Announcements */}
                    <section>
                        <h2 class="text-2xl font-bold mb-4 flex items-center gap-2 text-gray-800 dark:text-neutral-100">
                            <span class="bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-400 text-sm px-2 py-1 rounded-full">{myAnnouncements?.length || 0}</span>
                            Announcements Proposed
                        </h2>
                        {myAnnouncements?.length === 0 ? (
                            <div class="bg-gray-50 dark:bg-neutral-900/50 border border-dashed border-gray-300 dark:border-neutral-700 rounded-xl p-6 text-center text-gray-500 dark:text-neutral-400">
                                You haven't proposed any announcements yet.
                            </div>
                        ) : (
                            <div class="grid grid-cols-1 gap-4">
                                {myAnnouncements?.map((a: any) => (
                                    <a href={`/announcements/${a.id}`} class="bg-white dark:bg-neutral-800 p-4 rounded-xl border border-gray-300 dark:border-neutral-700 hover:border-purple-500 dark:hover:border-purple-400 transition-colors shadow-sm">
                                        <div class="flex items-start justify-between gap-3">
                                            <h3 class="font-bold text-gray-800 dark:text-neutral-100">{a.title}</h3>
                                            <span class={`shrink-0 px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${
                                                a.status === 'published'
                                                    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                                                    : a.status === 'rejected'
                                                    ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-300'
                                                    : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                                            }`}>
                                                {a.status === 'published' ? 'Published' : a.status === 'rejected' ? 'Rejected' : 'Pending'}
                                            </span>
                                        </div>
                                        <p class="text-sm text-gray-600 dark:text-neutral-300 mt-1 line-clamp-1">{a.content}</p>
                                        {a.status === 'rejected' && a.review_feedback && (
                                            <p class="text-xs text-red-600 dark:text-red-400 mt-2 line-clamp-2">
                                                <span class="font-bold uppercase">Feedback:</span> {a.review_feedback}
                                            </p>
                                        )}
                                        <p class="text-xs text-gray-400 dark:text-neutral-500 mt-2">{formatDate(a.published_at || a.created_at)}</p>
                                    </a>
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
