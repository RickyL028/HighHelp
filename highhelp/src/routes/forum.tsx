import { Hono } from 'hono'
import { Layout } from '../layout'
import { getUser, renderTags, updatePoints, logAction, formatDate } from '../utils'
import { canPostGeneral, canViewDeleted, canCommentModeration } from '../permissions'
import { SubjectSelector } from '../components/SubjectSelector'

import { Bindings, User } from '../types'
import { ANNOUNCEMENT_SUBJECTS } from '../constants'

const app = new Hono<{ Bindings: Bindings }>()
interface PostDetail {
id: number;
title: string;
content: string;
type: string;
subject: string;
created_at: string;
first_name: string | null;
last_name: string | null;
tags: string | null;
is_deleted: number;
author_id: number;
}

app.get('/forum', async (c) => {
const user = await getUser(c) as User | null
const subject = c.req.query('subject')
if (!subject) {

    const showDeleted = user && canViewDeleted(user);
    const sql = `
        SELECT p.*, u.first_name, u.last_name, u.tags, 
        (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id AND c.is_deleted = 0) as comment_count
        FROM posts p 
        LEFT JOIN users u ON p.author_id = u.id 
        WHERE p.type = 'question'
        ${showDeleted ? '' : 'AND p.is_deleted = 0'}
        ORDER BY p.created_at DESC 
        LIMIT 10
    `;
    const { results: recentPosts } = await c.env.DB.prepare(sql).all()

    return c.html(
        <Layout title="Q&A Forum" user={user}>
            <div class="mx-auto space-y-12">
                <section>
                    <div class="flex justify-between items-center mb-6">
                        <h1 class="text-3xl font-bold">Recent Discussions</h1>
                        {user ? (
                            <a href="/forum/create" class="bg-blue-600 text-white px-4 py-2 rounded font-bold hover:bg-blue-700 transition shadow-sm">
                                + Ask a Question
                            </a>
                        ) : null}
                    </div>

                    <div class="space-y-4">
                        {recentPosts?.length === 0 ? (
                            <p class="text-gray-500 italic">No discussions yet. Be the first to ask!</p>
                        ) : (
                            recentPosts?.map((p: any) => (
                                <div class={`bg-white dark:bg-neutral-800 rounded border border-gray-300 dark:border-neutral-700 p-4 hover:bg-gray-50 dark:hover:bg-neutral-700 transition-colors group block ${p.is_deleted ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : ''}`}>
                                    <a href={`/forum/post/${p.id}`} class="block">
                                        <h3 class="text-lg font-bold text-gray-900 dark:text-white group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors mb-1 leading-snug">{p.title}</h3>
                                    </a>

                                    <div class="flex flex-wrap items-center gap-x-2 text-xs text-gray-500 dark:text-neutral-400 mb-2">
                                        <span class="font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wide">{p.subject}</span>
                                        <span class="text-gray-300 dark:text-neutral-600">•</span>
                                        <span class="local-date" data-timestamp={p.created_at}>{formatDate(p.created_at)}</span>
                                        <span class="text-gray-300 dark:text-neutral-600">•</span>
                                        <span class="flex items-center">
                                            {p.first_name ? `${p.first_name} ${p.last_name}` : 'Unknown'}
                                            <span class="ml-1" dangerouslySetInnerHTML={{ __html: renderTags(p.tags) }}></span>
                                        </span>
                                        {p.is_deleted ? <span class="font-bold text-red-600 uppercase ml-2">Deleted</span> : null}
                                    </div>

                                    <p class="text-sm text-gray-700 dark:text-neutral-300 mb-2 line-clamp-2">{p.content}</p>

                                    <div class="flex items-center justify-between">
                                        <span class="flex items-center gap-1 text-gray-500 dark:text-neutral-400 text-xs font-medium bg-gray-50 dark:bg-neutral-900 px-2 py-0.5 rounded">
                                            💬 {p.comment_count} Comments
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </section>

                <hr class="border-gray-200" />

                <section>
                    <h2 class="text-xl font-bold mb-4">Browse by Subject</h2>
                    <SubjectSelector baseUrl="/forum" type="standard" />
                </section>
            </div>
        </Layout>
    )
}


const showDeleted = user && canViewDeleted(user);
const sql = `
    SELECT p.*, u.first_name, u.last_name, u.tags,
    (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id AND c.is_deleted = 0) as comment_count
    FROM posts p 
    LEFT JOIN users u ON p.author_id = u.id 
    WHERE p.subject = ? 
    AND p.type = 'question' 
    ${showDeleted ? '' : 'AND p.is_deleted = 0'}
    ORDER BY p.created_at DESC
`;
const { results } = await c.env.DB.prepare(sql).bind(subject).all()

return c.html(
    <Layout title={`${subject} Forum`} user={user}>
        <div class="mx-auto">
            <div class="flex items-center justify-between mb-6">
                <div>
                    <h1 class="text-3xl font-bold">{subject} Forum</h1>
                    <a href="/forum" class="text-blue-600 hover:underline text-sm">← All Subjects</a>
                </div>
                {user ? (
                    <a href={`/forum/create?subject=${encodeURIComponent(subject)}`} class="bg-blue-600 text-white px-4 py-2 rounded font-bold hover:bg-blue-700 transition shadow-sm">
                        + Ask Question
                    </a>
                ) : null}
            </div>

            <div class="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <div class="relative w-full md:w-96">
                    <input type="text" id="search-input" placeholder="Search discussions..." class="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" />
                    <svg class="w-5 h-5 text-gray-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                </div>
                <div class="flex items-center gap-2 bg-white dark:bg-neutral-800 rounded-lg p-1 border border-gray-200 dark:border-neutral-700 shadow-sm">
                    <button id="view-list" class="p-2 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/60 transition-colors" title="List View">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
                    </button>
                    <button id="view-grid" class="p-2 rounded text-gray-500 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-700 transition-colors" title="Grid View">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>
                    </button>
                </div>
            </div>

            {/* Grid View Container */}
            <div id="grid-view-container" class="space-y-4">
                {results?.length === 0 ? (
                    <div class="bg-gray-50 p-8 text-center rounded border border-dashed border-gray-300">
                        <p class="text-gray-500 mb-2">No discussions in {subject} yet.</p>
                        {user ? (
                            <a href={`/forum/create?subject=${encodeURIComponent(subject)}`} class="text-blue-600 hover:underline">Start the first discussion!</a>
                        ) : (
                            <a href="/login" class="text-blue-600 hover:underline">Login to start a discussion!</a>
                        )}
                    </div>
                ) : (
                    results.map((p: any) => (
                        <div
                            class={`search-item bg-white dark:bg-neutral-800 rounded border border-gray-300 dark:border-neutral-700 p-4 hover:bg-gray-50 dark:hover:bg-neutral-700 transition-colors group block h-full flex flex-col justify-between ${p.is_deleted ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : ''}`}
                            data-search-text={`${p.title} ${p.content} ${p.subject} ${p.first_name || ''} ${p.last_name || ''}`}
                        >
                            <div>
                                <a href={`/forum/post/${p.id}`} class="block">
                                    <h3 class="text-lg font-bold text-gray-900 dark:text-white group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors mb-1 leading-snug">{p.title}</h3>
                                </a>

                                <div class="flex flex-wrap items-center gap-x-2 text-xs text-gray-500 dark:text-neutral-400 mb-2">
                                    <span class="font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wide">{p.subject}</span>
                                    <span class="text-gray-300 dark:text-neutral-600">•</span>
                                    <span class="local-date" data-timestamp={p.created_at}>{formatDate(p.created_at)}</span>
                                    <span class="text-gray-300 dark:text-neutral-600">•</span>
                                    <span class="flex items-center">
                                        {p.first_name ? `${p.first_name} ${p.last_name}` : 'Unknown'}
                                        <span class="ml-1" dangerouslySetInnerHTML={{ __html: renderTags(p.tags) }}></span>
                                    </span>
                                    {p.is_deleted ? <span class="font-bold text-red-600 uppercase ml-2">Deleted</span> : null}
                                </div>

                                <p class="text-sm text-gray-700 dark:text-neutral-300 mb-2 line-clamp-2">{p.content}</p>
                            </div>

                            <div class="flex items-center justify-between mt-auto">
                                <span class="flex items-center gap-1 text-gray-500 dark:text-neutral-400 text-xs font-medium bg-gray-50 dark:bg-neutral-900 px-2 py-0.5 rounded">
                                    💬 {p.comment_count} Comments
                                </span>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* List View */}
            <div id="list-view-container" class="hidden overflow-x-auto bg-white dark:bg-neutral-800 rounded-lg shadow border border-gray-200 dark:border-neutral-700">
                <table class="min-w-full divide-y divide-gray-200 dark:divide-neutral-700">
                    <thead class="bg-gray-50 dark:bg-neutral-900">
                        <tr>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-neutral-400 uppercase tracking-wider">Date</th>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-neutral-400 uppercase tracking-wider">Topic</th>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-neutral-400 uppercase tracking-wider">Snippet</th>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-neutral-400 uppercase tracking-wider">Author</th>
                            <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-neutral-400 uppercase tracking-wider">Replies</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white dark:bg-neutral-800 divide-y divide-gray-200 dark:divide-neutral-700">
                        {results?.length === 0 ? (
                            <tr>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center" colspan={5}>No discussions yet.</td>
                            </tr>
                        ) : (
                            results.map((p: any) => (
                                <tr
                                    class={`search-item hover:bg-gray-50 dark:hover:bg-neutral-700 transition-colors cursor-pointer ${p.is_deleted ? 'bg-red-50 dark:bg-red-900/20' : ''}`}
                                    data-search-text={`${p.title} ${p.content} ${p.subject} ${p.first_name || ''} ${p.last_name || ''}`}
                                    onclick={`window.location.href='/forum/post/${p.id}'`}
                                >
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-neutral-400 local-date" data-timestamp={p.created_at}>
                                        {formatDate(p.created_at)}
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-white">
                                        {p.title}
                                        {p.is_deleted ? <span class="ml-2 text-xs text-red-600 uppercase">Deleted</span> : null}
                                    </td>
                                    <td class="px-6 py-4 text-sm text-gray-500 dark:text-neutral-400 truncate max-w-xs">
                                        {p.content}
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-neutral-400">
                                        {p.first_name ? `${p.first_name} ${p.last_name}` : 'Unknown'}
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500 dark:text-neutral-400">
                                        {p.comment_count} 💬
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    </Layout>
)
})

// Create Post Page
app.get('/forum/create', async (c) => {
const user = await getUser(c)
if (!user) return c.redirect('/login')
const date = new Date().toISOString();

const preselectedSubject = c.req.query('subject') || ""

return c.html(
    <Layout title="Ask a Question" user={user}>
        <div class="max-w-2xl mx-auto bg-white dark:bg-neutral-800 p-6 rounded border border-gray-300 dark:border-neutral-700 shadow-none">
            <h1 class="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Ask a Question</h1>

            <form action="/forum" method="post" class="space-y-6">
                <div>
                    <label class="block text-sm font-bold text-gray-700 dark:text-neutral-300 mb-1">Title</label>
                    <input type="text" name="title" required placeholder="What's your question?" class="w-full rounded-md border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 dark:text-white shadow-sm p-3 border focus:ring-blue-500 focus:border-blue-500" />
                </div>

                <div>
                    <label class="block text-sm font-bold text-gray-700 dark:text-neutral-300 mb-1">Subject</label>
                    <select name="subject" required class="w-full rounded-md border-gray-300 dark:border-neutral-600 shadow-sm p-3 border focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-neutral-700 dark:text-white">
                        <option value="" disabled selected={!preselectedSubject}>Select a Subject</option>
                        {ANNOUNCEMENT_SUBJECTS.map(s => (
                            <option value={s} selected={s === preselectedSubject}>{s}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label class="block text-sm font-bold text-gray-700 dark:text-neutral-300 mb-1">Details</label>
                    <textarea name="content" required rows={6} placeholder="Provide more context..." class="w-full rounded-md border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 dark:text-white shadow-sm p-3 border focus:ring-blue-500 focus:border-blue-500"></textarea>
                </div>

                <div class="flex items-center justify-end gap-4">
                    <a href="/forum" class="text-gray-500 hover:text-gray-700">Cancel</a>
                    <button type="submit" class="bg-blue-600 text-white px-6 py-2 rounded-md font-bold hover:bg-blue-700 transition">
                        Post Question
                    </button>
                </div>
            </form>
        </div>
    </Layout>
)
})

// Handle Create Post
app.post('/forum', async (c) => {
const user = await getUser(c)
if (!user) return c.redirect('/login')


if (!canPostGeneral(user)) return c.text("You are muted.", 403);

const body = await c.req.parseBody()
const title = body['title'] as string
const subject = body['subject'] as string
const content = body['content'] as string

if (title && subject && content) {
    // Default type to 'question'
    const res = await c.env.DB.prepare('INSERT INTO posts (title, content, type, author_id, subject) VALUES (?, ?, ?, ?, ?)')
        .bind(title, content, 'question', user.id, subject)
        .run()

    await logAction(c.env.DB, user.id, 'CREATE_POST', `Created question '${title}' in ${subject}`, res.meta.last_row_id, 'posts');
}


return c.redirect(`/forum?subject=${encodeURIComponent(subject)}`)
})

// Single Post View
app.get('/forum/post/:id', async (c) => {
const user = await getUser(c)
const postId = c.req.param('id')

const post = await c.env.DB.prepare(`
    SELECT p.*, u.first_name, u.last_name, u.tags 
    FROM posts p 
    LEFT JOIN users u ON p.author_id = u.id 
    WHERE p.id = ?
`).bind(postId).first() as PostDetail | null

if (!post) {
    return c.text('Post not found', 404)
}

const showDeleted = user && canViewDeleted(user);
const sqlComments = `
    SELECT c.*, u.first_name, u.last_name, u.tags 
    FROM comments c 
    LEFT JOIN users u ON c.author_id = u.id 
    WHERE c.post_id = ? 
    ${showDeleted ? '' : 'AND c.is_deleted = 0'}
    ORDER BY c.created_at ASC
`;
const { results: comments } = await c.env.DB.prepare(sqlComments).bind(postId).all()

return c.html(

    <Layout title={post.title} user={user}>
        <div class="mx-auto">
            <div class="mb-4">

                <a href={`/forum?subject=${encodeURIComponent(post.subject)}`} class="text-blue-600 dark:text-blue-400 hover:underline text-sm">← Back to {post.subject}</a>
            </div>

            {/* Main Post */}
            <div class={`bg-white dark:bg-neutral-800 rounded-lg border border-gray-200 dark:border-neutral-700 shadow-sm overflow-hidden mb-8 ${post.is_deleted ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : ''}`}>
                <div class="p-6 border-b border-gray-100 dark:border-neutral-700">
                    {post.is_deleted ? <span class="text-xs font-bold text-red-600 uppercase mb-2 block">Deleted</span> : null}
                    <div class="flex items-center gap-2 mb-2">
                        <span class="bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 text-xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">{post.type}</span>

                        <span class="text-gray-400 dark:text-neutral-500 text-sm local-date" data-timestamp={post.created_at} data-format="datetime">| {formatDate(post.created_at)}</span>
                    </div>
                    <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-4">{post.title}</h1>
                    <p class="text-gray-800 dark:text-neutral-200 whitespace-pre-wrap leading-relaxed text-lg">{post.content}</p>
                </div>
                <div class="bg-gray-50 dark:bg-neutral-900/50 px-6 py-3 flex items-center justify-between">
                    <div class="text-sm text-gray-600 dark:text-neutral-400 flex items-center">
                        <span class="font-bold mr-1 text-gray-700 dark:text-neutral-300">Asked by:</span> <span class="text-gray-900 dark:text-white font-medium ml-1">{post.first_name ? `${post.first_name} ${post.last_name}` : 'Unknown'}</span>

                        <span class="ml-2" dangerouslySetInnerHTML={{ __html: renderTags(post.tags) }}></span>
                    </div>
                    {(!post.is_deleted && user && (canCommentModeration(user) || user.id === post.author_id)) ? (
                        <form action={`/forum/post/${post.id}/delete`} method="post">
                            <button class="text-red-500 font-bold text-sm hover:underline" onclick="return confirm('Delete this post?')">Delete Post</button>
                        </form>
                    ) : null}
                </div>
            </div>

            {/* Comments Section */}
            <div class="mb-8">
                <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-4">{comments?.length || 0} Answers / Comments</h2>

                <div class="bg-white dark:bg-neutral-800 rounded-lg border border-gray-200 dark:border-neutral-700 divide-y divide-gray-100 dark:divide-neutral-700/50 shadow-sm">
                    {comments?.length === 0 ? (
                        <div class="p-8 text-center text-gray-500 dark:text-neutral-400">
                            No answers yet. Be the first to reply!
                        </div>
                    ) : (
                        comments?.map((comment: any) => (
                            <div class={`p-6 ${comment.is_deleted ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`}>
                                <div class="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-3">
                                    <div class="flex items-center gap-2 flex-wrap">
                                        <span class="font-bold text-gray-900 dark:text-white">
                                            {comment.first_name ? `${comment.first_name} ${comment.last_name}` : 'Unknown'}
                                        </span>
                                        <span dangerouslySetInnerHTML={{ __html: renderTags(comment.tags) }}></span>
                                        <span class="hidden sm:inline text-gray-300 dark:text-neutral-600">•</span>
                                        <span class="text-sm text-gray-500 dark:text-neutral-400 local-date" data-timestamp={comment.created_at} data-format="datetime">
                                            {formatDate(comment.created_at)}
                                        </span>
                                        {comment.is_deleted ? (
                                            <span class="text-[10px] font-bold text-red-600 uppercase px-2 py-0.5 bg-red-100 dark:bg-red-900/30 rounded ml-2">Deleted</span>
                                        ) : null}
                                    </div>
                                    {(!comment.is_deleted && user && (canCommentModeration(user) || user.id === comment.author_id)) ? (
                                        <form action={`/forum/comment/${comment.id}/delete`} method="post" class="shrink-0">
                                            <button class="text-gray-400 hover:text-red-500 text-sm font-medium transition-colors" onclick="return confirm('Delete comment?')">Delete</button>
                                        </form>
                                    ) : null}
                                </div>
                                <p class="text-gray-800 dark:text-neutral-200 whitespace-pre-wrap leading-relaxed">{comment.content}</p>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Add Comment  */}
            {user ? (
                <div class="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg border border-blue-100 dark:border-blue-900/40">
                    <h3 class="text-lg font-bold text-blue-900 dark:text-blue-200 mb-4">Add Your Answer</h3>
                    <form action="/forum/comment" method="post">
                        <input type="hidden" name="post_id" value={postId} />
                        <textarea name="content" required rows={4} class="w-full rounded-md border-blue-200 dark:border-blue-800 bg-white dark:bg-neutral-800 dark:text-white shadow-sm p-3 border focus:ring-blue-500 focus:border-blue-500 mb-4" placeholder="Type your answer here..."></textarea>
                        <div class="text-right">
                            <button type="submit" class="bg-blue-600 text-white px-6 py-2 rounded font-bold hover:bg-blue-700 transition">
                                Submit Answer
                            </button>
                        </div>
                    </form>
                </div>
            ) : (
                <div class="bg-gray-100 dark:bg-neutral-800 p-6 rounded-lg text-center border border-gray-200 dark:border-neutral-700">
                    <p class="text-gray-600 dark:text-neutral-400 mb-2">Want to add an answer?</p>
                    <a href="/login" class="text-blue-600 dark:text-blue-400 font-bold hover:underline">Log in to participate</a>
                </div>
            )}

        </div>
    </Layout>
)
})

// Add Comment
app.post('/forum/comment', async (c) => {
const user = await getUser(c)
if (!user) return c.redirect('/login')

const body = await c.req.parseBody()
const postId = body['post_id'] as string
const content = body['content'] as string

if (!canPostGeneral(user)) return c.text("You are muted.", 403);

if (postId && content) {
    const res = await c.env.DB.prepare('INSERT INTO comments (post_id, content, author_id) VALUES (?, ?, ?)')
        .bind(postId, content, user.id)
        .run()

    await logAction(c.env.DB, user.id, 'CREATE_COMMENT', `Commented on post ${postId}`, res.meta.last_row_id, 'comments');


    await updatePoints(user.id, 0.3, c.env.DB);
}


return c.redirect(`/forum/post/${postId}`)
})

app.post('/forum/post/:id/delete', async (c) => {
const user = await getUser(c)
if (!user) return c.redirect('/login')
const id = c.req.param('id')

const post = await c.env.DB.prepare('SELECT * FROM posts WHERE id = ?').bind(id).first() as any;
if (!post) return c.notFound();


if (!canCommentModeration(user) && user.id !== post.author_id) return c.text('Unauthorised', 403);

await c.env.DB.prepare('UPDATE posts SET is_deleted = 1 WHERE id = ?').bind(id).run();
await logAction(c.env.DB, user.id, 'DELETE_POST', `Deleted post ${id}`, Number(id), 'posts');



return c.redirect(`/forum?subject=${encodeURIComponent(post?.subject || '')}`);
})

app.post('/forum/comment/:id/delete', async (c) => {
const user = await getUser(c)
if (!user) return c.redirect('/login')
const id = c.req.param('id')


const comment = await c.env.DB.prepare('SELECT * FROM comments WHERE id = ?').bind(id).first() as any;
if (!comment) return c.notFound();


if (!canCommentModeration(user) && user.id !== comment.author_id) return c.text('Unauthorised', 403);

await c.env.DB.prepare('UPDATE comments SET is_deleted = 1 WHERE id = ?').bind(id).run();
await logAction(c.env.DB, user.id, 'DELETE_COMMENT', `Deleted comment ${id}`, Number(id), 'comments');

if (comment) {
    return c.redirect(`/forum/post/${comment.post_id}`);
}
return c.redirect('/forum');
})

export default app
