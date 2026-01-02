import { Hono } from 'hono'
import { Layout } from '../layout'
import { getUser, renderTags, updatePoints } from '../utils'
import { SubjectSelector } from '../components/SubjectSelector'

import { Bindings, User } from '../types'
import { ANNOUNCEMENT_SUBJECTS } from '../constants' // Reusing subject list for dropdown

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
}
// 1. Forum Landing / Subject List
app.get('/forum', async (c) => {
    const user = await getUser(c) as User | null
    const subject = c.req.query('subject')

    // View: Recent Discussions (Global)
    if (!subject) {
        // Fetch recent posts
        const { results: recentPosts } = await c.env.DB.prepare(`
            SELECT p.*, u.first_name, u.last_name, u.tags, 
            (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) as comment_count
            FROM posts p 
            LEFT JOIN users u ON p.author_id = u.id 
            ORDER BY p.created_at DESC 
            LIMIT 10
        `).all()

        return c.html(
            <Layout title="Q&A Forum" user={user}>
                <div class="max-w-4xl mx-auto space-y-12">
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
                                    <div class="bg-white p-4 rounded shadow-sm border border-gray-200 hover:border-blue-400 transition group block">
                                        <div class="flex justify-between items-start">
                                            <div class="flex-grow">
                                                <div class="flex items-center gap-2 mb-1">
                                                    <span class="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full font-medium border border-blue-100">{p.subject}</span>
                                                    <span class="text-xs text-gray-400">• {new Date(p.created_at).toLocaleDateString()}</span>
                                                </div>
                                                <a href={`/forum/post/${p.id}`} class="block">
                                                    <h3 class="text-lg font-bold text-gray-800 group-hover:text-blue-600">{p.title}</h3>
                                                </a>
                                                <p class="text-sm text-gray-600 mt-1 line-clamp-2">{p.content}</p>

                                                <div class="mt-2 flex items-center text-xs text-gray-500">
                                                    <span>Posted by {p.first_name ? `${p.first_name} ${p.last_name}` : 'Unknown'}</span>
                                                    <span class="ml-2" dangerouslySetInnerHTML={{ __html: renderTags(p.tags) }}></span>
                                                </div>
                                            </div>
                                            <div class="flex flex-col items-end min-w-[60px]">
                                                <span class="flex items-center gap-1 text-gray-500 text-sm">
                                                    Comments: {p.comment_count}
                                                </span>
                                            </div>
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

    // View: Subject Specific Posts
    const { results } = await c.env.DB.prepare(`
        SELECT p.*, u.first_name, u.last_name, u.tags,
        (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) as comment_count
        FROM posts p 
        LEFT JOIN users u ON p.author_id = u.id 
        WHERE p.subject = ? 
        ORDER BY p.created_at DESC
    `).bind(subject).all()

    return c.html(
        <Layout title={`${subject} Forum`} user={user}>
            <div class="max-w-4xl mx-auto">
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

                <div class="space-y-4">
                    {results?.length === 0 ? (
                        <div class="bg-gray-50 p-8 text-center rounded border border-dashed border-gray-300">
                            <p class="text-gray-500 mb-2">No discussions in {subject} yet.</p>
                            {user ? (
                                <a href={`/forum/create?subject=${encodeURIComponent(subject)}`} class="text-blue-600 font-medium hover:underline">Ask a question</a>
                            ) : (
                                <a href="/login" class="text-blue-600 font-medium hover:underline">Log in to join Q&A</a>
                            )}
                        </div>
                    ) : (
                        results.map((p: any) => (
                            <div class="bg-white p-4 rounded shadow-sm border border-gray-200 hover:border-blue-400 transition group">
                                <div class="flex justify-between items-start">
                                    <div class="flex-grow">
                                        <div class="flex items-center gap-2 mb-1">
                                            <span class="text-xs text-gray-400">{new Date(p.created_at).toLocaleDateString()}</span>
                                        </div>
                                        <a href={`/forum/post/${p.id}`} class="block">
                                            <h3 class="text-lg font-bold text-gray-800 group-hover:text-blue-600">{p.title}</h3>
                                        </a>
                                        <p class="text-sm text-gray-600 mt-1 line-clamp-2">{p.content}</p>

                                        <div class="mt-2 flex items-center text-xs text-gray-500">
                                            <span>by {p.first_name ? `${p.first_name} ${p.last_name}` : 'Unknown'}</span>
                                            <span class="ml-2" dangerouslySetInnerHTML={{ __html: renderTags(p.tags) }}></span>
                                        </div>
                                    </div>
                                    <div class="flex flex-col items-end min-w-[60px]">
                                        <span class="flex items-center gap-1 text-gray-500 text-sm">
                                            Comments: {p.comment_count}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </Layout>
    )
})

// 2. Create Post Page
app.get('/forum/create', async (c) => {
    const user = await getUser(c)
    if (!user) return c.redirect('/login')
    const date = new Date().toISOString();

    const preselectedSubject = c.req.query('subject') || ""

    return c.html(
        <Layout title="Ask a Question" user={user}>
            <div class="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow-md border border-gray-200">
                <h1 class="text-2xl font-bold mb-6 text-gray-900">Ask a Question</h1>

                <form action="/forum" method="post" class="space-y-6">
                    <div>
                        <label class="block text-sm font-bold text-gray-700 mb-1">Title</label>
                        <input type="text" name="title" required placeholder="What's your question?" class="w-full rounded-md border-gray-300 shadow-sm p-3 border focus:ring-blue-500 focus:border-blue-500" />
                    </div>

                    <div>
                        <label class="block text-sm font-bold text-gray-700 mb-1">Subject</label>
                        <select name="subject" required class="w-full rounded-md border-gray-300 shadow-sm p-3 border focus:ring-blue-500 focus:border-blue-500 bg-white">
                            <option value="" disabled selected={!preselectedSubject}>Select a Subject</option>
                            {ANNOUNCEMENT_SUBJECTS.map(s => (
                                <option value={s} selected={s === preselectedSubject}>{s}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label class="block text-sm font-bold text-gray-700 mb-1">Details</label>
                        <textarea name="content" required rows={6} placeholder="Provide more context..." class="w-full rounded-md border-gray-300 shadow-sm p-3 border focus:ring-blue-500 focus:border-blue-500"></textarea>
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

// 3. Handle Create Post
app.post('/forum', async (c) => {
    const user = await getUser(c)
    if (!user) return c.redirect('/login')

    const body = await c.req.parseBody()
    const title = body['title'] as string
    const subject = body['subject'] as string
    const content = body['content'] as string

    if (title && subject && content) {
        // Default type to 'question'
        await c.env.DB.prepare('INSERT INTO posts (title, content, type, author_id, subject) VALUES (?, ?, ?, ?, ?)')
            .bind(title, content, 'question', user.id, subject)
            .run()
    }

    // Redirect to the subject page or the specific post (need ID to redirect to post, but simple redirect to subject is fine for MVP)
    return c.redirect(`/forum?subject=${encodeURIComponent(subject)}`)
})

// 4. Single Post View
app.get('/forum/post/:id', async (c) => {
    const user = await getUser(c)
    const postId = c.req.param('id')

    // Fetch Post
    // FIX: Cast the result to 'PostDetail | null' so TypeScript knows the shape of the data
    const post = await c.env.DB.prepare(`
        SELECT p.*, u.first_name, u.last_name, u.tags 
        FROM posts p 
        LEFT JOIN users u ON p.author_id = u.id 
        WHERE p.id = ?
    `).bind(postId).first() as PostDetail | null

    if (!post) {
        return c.text('Post not found', 404)
    }

    // Fetch Comments
    const { results: comments } = await c.env.DB.prepare(`
        SELECT c.*, u.first_name, u.last_name, u.tags 
        FROM comments c 
        LEFT JOIN users u ON c.author_id = u.id 
        WHERE c.post_id = ? 
        ORDER BY c.created_at ASC
    `).bind(postId).all()

    return c.html(
        // Now 'post.title' is known to be a string
        <Layout title={post.title} user={user}>
            <div class="max-w-4xl mx-auto">
                <div class="mb-4">
                    {/* Now 'post.subject' is known to be a string */}
                    <a href={`/forum?subject=${encodeURIComponent(post.subject)}`} class="text-blue-600 hover:underline text-sm">← Back to {post.subject}</a>
                </div>

                {/* Main Post */}
                <div class="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden mb-8">
                    <div class="p-6 border-b border-gray-100">
                        <div class="flex items-center gap-2 mb-2">
                            <span class="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">{post.type}</span>
                            {/* Now 'post.created_at' is known to be a string/date */}
                            <span class="text-gray-400 text-sm">| {new Date(post.created_at).toLocaleString()}</span>
                        </div>
                        <h1 class="text-3xl font-bold text-gray-900 mb-4">{post.title}</h1>
                        <p class="text-gray-800 whitespace-pre-wrap leading-relaxed text-lg">{post.content}</p>
                    </div>
                    <div class="bg-gray-50 px-6 py-3 flex items-center justify-between">
                        <div class="text-sm text-gray-600 flex items-center">
                            <span class="font-bold mr-1">Asked by:</span> {post.first_name ? `${post.first_name} ${post.last_name}` : 'Unknown'}
                            {/* Now 'post.tags' is known to be string | null */}
                            <span class="ml-2" dangerouslySetInnerHTML={{ __html: renderTags(post.tags) }}></span>
                        </div>
                    </div>
                </div>

                {/* Comments Section (unchanged) */}
                <div class="mb-8">
                    <h2 class="text-xl font-bold text-gray-900 mb-4">{comments?.length || 0} Answers / Comments</h2>

                    <div class="space-y-4">
                        {comments?.map((comment: any) => (
                            <div class="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                                <div class="flex justify-between items-start mb-2">
                                    <div class="flex items-center gap-2">
                                        <span class="font-bold text-gray-800">{comment.first_name ? `${comment.first_name} ${comment.last_name}` : 'Unknown'}</span>
                                        <span dangerouslySetInnerHTML={{ __html: renderTags(comment.tags) }}></span>
                                    </div>
                                    <span class="text-xs text-gray-400">{new Date(comment.created_at).toLocaleString()}</span>
                                </div>
                                <p class="text-gray-700 whitespace-pre-wrap">{comment.content}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Add Comment Form (unchanged) */}
                {user ? (
                    <div class="bg-blue-50 p-6 rounded-lg border border-blue-100">
                        <h3 class="text-lg font-bold text-blue-900 mb-4">Add Your Answer</h3>
                        <form action="/forum/comment" method="post">
                            <input type="hidden" name="post_id" value={postId} />
                            <textarea name="content" required rows={4} class="w-full rounded-md border-blue-200 shadow-sm p-3 border focus:ring-blue-500 focus:border-blue-500 mb-4" placeholder="Type your answer here..."></textarea>
                            <div class="text-right">
                                <button type="submit" class="bg-blue-600 text-white px-6 py-2 rounded font-bold hover:bg-blue-700 transition">
                                    Submit Answer
                                </button>
                            </div>
                        </form>
                    </div>
                ) : (
                    <div class="bg-gray-100 p-6 rounded-lg text-center">
                        <p class="text-gray-600 mb-2">Want to add an answer?</p>
                        <a href="/login" class="text-blue-600 font-bold hover:underline">Log in to participate</a>
                    </div>
                )}

            </div>
        </Layout>
    )
})

// 5. Handle Add Comment
app.post('/forum/comment', async (c) => {
    const user = await getUser(c)
    if (!user) return c.redirect('/login')

    const body = await c.req.parseBody()
    const postId = body['post_id'] as string
    const content = body['content'] as string

    if (postId && content) {
        await c.env.DB.prepare('INSERT INTO comments (post_id, content, author_id) VALUES (?, ?, ?)')
            .bind(postId, content, user.id)
            .run()

        // Award +0.3 points for answering
        await updatePoints(user.id, 0.3, c.env.DB);
    }


    return c.redirect(`/forum/post/${postId}`)
})

export default app
