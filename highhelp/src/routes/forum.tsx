import { Hono } from 'hono'
import { Layout } from '../layout'
import { getUser, renderTags, updatePoints, logAction } from '../utils'
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
                                    <div class={`bg-white rounded border border-gray-300 p-4 hover:bg-gray-50 transition-colors group block ${p.is_deleted ? 'border-red-500 bg-red-50' : ''}`}>
                                        <a href={`/forum/post/${p.id}`} class="block">
                                            <h3 class="text-lg font-bold text-gray-900 group-hover:text-blue-700 transition-colors mb-1 leading-snug">{p.title}</h3>
                                        </a>

                                        <div class="flex flex-wrap items-center gap-x-2 text-xs text-gray-500 mb-2">
                                            <span class="font-bold text-blue-700 uppercase tracking-wide">{p.subject}</span>
                                            <span class="text-gray-300">•</span>
                                            <span class="local-date" data-timestamp={p.created_at}>{new Date(p.created_at).toLocaleDateString()}</span>
                                            <span class="text-gray-300">•</span>
                                            <span class="flex items-center">
                                                {p.first_name ? `${p.first_name} ${p.last_name}` : 'Unknown'}
                                                <span class="ml-1" dangerouslySetInnerHTML={{ __html: renderTags(p.tags) }}></span>
                                            </span>
                                            {p.is_deleted && <span class="font-bold text-red-600 uppercase ml-2">Deleted</span>}
                                        </div>

                                        <p class="text-sm text-gray-700 mb-2 line-clamp-2">{p.content}</p>

                                        <div class="flex items-center justify-between">
                                            <span class="flex items-center gap-1 text-gray-500 text-xs font-medium bg-gray-50 px-2 py-0.5 rounded">
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
                        <input type="text" id="search-input" placeholder="Search discussions..." class="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" />
                        <svg class="w-5 h-5 text-gray-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                    </div>
                    <div class="flex items-center gap-2 bg-white rounded-lg p-1 border border-gray-200 shadow-sm">
                        <button id="view-list" class="p-2 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors" title="List View">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
                        </button>
                        <button id="view-grid" class="p-2 rounded text-gray-500 hover:bg-gray-50 transition-colors" title="Grid View">
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
                                class={`search-item bg-white rounded border border-gray-300 p-4 hover:bg-gray-50 transition-colors group block h-full flex flex-col justify-between ${p.is_deleted ? 'border-red-500 bg-red-50' : ''}`}
                                data-search-text={`${p.title} ${p.content} ${p.subject} ${p.first_name || ''} ${p.last_name || ''}`}
                            >
                                <div>
                                    <a href={`/forum/post/${p.id}`} class="block">
                                        <h3 class="text-lg font-bold text-gray-900 group-hover:text-blue-700 transition-colors mb-1 leading-snug">{p.title}</h3>
                                    </a>

                                    <div class="flex flex-wrap items-center gap-x-2 text-xs text-gray-500 mb-2">
                                        <span class="font-bold text-blue-700 uppercase tracking-wide">{p.subject}</span>
                                        <span class="text-gray-300">•</span>
                                        <span class="local-date" data-timestamp={p.created_at}>{new Date(p.created_at).toLocaleDateString()}</span>
                                        <span class="text-gray-300">•</span>
                                        <span class="flex items-center">
                                            {p.first_name ? `${p.first_name} ${p.last_name}` : 'Unknown'}
                                            <span class="ml-1" dangerouslySetInnerHTML={{ __html: renderTags(p.tags) }}></span>
                                        </span>
                                        {p.is_deleted && <span class="font-bold text-red-600 uppercase ml-2">Deleted</span>}
                                    </div>

                                    <p class="text-sm text-gray-700 mb-2 line-clamp-2">{p.content}</p>
                                </div>

                                <div class="flex items-center justify-between mt-auto">
                                    <span class="flex items-center gap-1 text-gray-500 text-xs font-medium bg-gray-50 px-2 py-0.5 rounded">
                                        💬 {p.comment_count} Comments
                                    </span>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* List View */}
                <div id="list-view-container" class="hidden overflow-x-auto bg-white rounded-lg shadow border border-gray-200">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Topic</th>
                                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Snippet</th>
                                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Author</th>
                                <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Replies</th>
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                            {results?.length === 0 ? (
                                <tr>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center" colspan={5}>No discussions yet.</td>
                                </tr>
                            ) : (
                                results.map((p: any) => (
                                    <tr
                                        class={`search-item hover:bg-gray-50 transition-colors cursor-pointer ${p.is_deleted ? 'bg-red-50' : ''}`}
                                        data-search-text={`${p.title} ${p.content} ${p.subject} ${p.first_name || ''} ${p.last_name || ''}`}
                                        onclick={`window.location.href='/forum/post/${p.id}'`}
                                    >
                                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 local-date" data-timestamp={p.created_at}>
                                            {new Date(p.created_at).toLocaleDateString()}
                                        </td>
                                        <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                                            {p.title}
                                            {p.is_deleted && <span class="ml-2 text-xs text-red-600 uppercase">Deleted</span>}
                                        </td>
                                        <td class="px-6 py-4 text-sm text-gray-500 truncate max-w-xs">
                                            {p.content}
                                        </td>
                                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {p.first_name ? `${p.first_name} ${p.last_name}` : 'Unknown'}
                                        </td>
                                        <td class="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
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
            <div class="max-w-2xl mx-auto bg-white p-6 rounded border border-gray-300 shadow-none">
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
                    
                    <a href={`/forum?subject=${encodeURIComponent(post.subject)}`} class="text-blue-600 hover:underline text-sm">← Back to {post.subject}</a>
                </div>

                {/* Main Post */}
                <div class={`bg-white rounded border border-gray-300 overflow-hidden mb-8 ${post.is_deleted ? 'border-red-500 bg-red-50' : ''}`}>
                    <div class="p-6 border-b border-gray-100">
                        {post.is_deleted && <span class="text-xs font-bold text-red-600 uppercase mb-2 block">Deleted</span>}
                        <div class="flex items-center gap-2 mb-2">
                            <span class="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">{post.type}</span>
                            
                            <span class="text-gray-400 text-sm local-date" data-timestamp={post.created_at} data-format="datetime">| {new Date(post.created_at).toLocaleString()}</span>
                        </div>
                        <h1 class="text-3xl font-bold text-gray-900 mb-4">{post.title}</h1>
                        <p class="text-gray-800 whitespace-pre-wrap leading-relaxed text-lg">{post.content}</p>
                    </div>
                    <div class="bg-gray-50 px-6 py-3 flex items-center justify-between">
                        <div class="text-sm text-gray-600 flex items-center">
                            <span class="font-bold mr-1">Asked by:</span> {post.first_name ? `${post.first_name} ${post.last_name}` : 'Unknown'}
                            
                            <span class="ml-2" dangerouslySetInnerHTML={{ __html: renderTags(post.tags) }}></span>
                        </div>
                        {!post.is_deleted && user && (canCommentModeration(user) || user.id === post.author_id) && (
                            <form action={`/forum/post/${post.id}/delete`} method="post">
                                <button class="text-red-500 font-bold text-sm hover:underline" onclick="return confirm('Delete this post?')">Delete Post</button>
                            </form>
                        )}
                    </div>
                </div>

                {/* Comments Section */}
                <div class="mb-8">
                    <h2 class="text-xl font-bold text-gray-900 mb-4">{comments?.length || 0} Answers / Comments</h2>

                    <div class="space-y-4">
                        {comments?.map((comment: any) => (
                            <div class={`bg-white p-4 rounded border ${comment.is_deleted ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}>
                                {comment.is_deleted && <span class="text-xs font-bold text-red-600 uppercase mb-1 block">Deleted</span>}
                                <div class="flex justify-between items-start mb-2">
                                    <div class="flex items-center gap-2">
                                        <span class="font-bold text-gray-800">{comment.first_name ? `${comment.first_name} ${comment.last_name}` : 'Unknown'}</span>
                                        <span dangerouslySetInnerHTML={{ __html: renderTags(comment.tags) }}></span>
                                    </div>
                                    <span class="text-xs text-gray-400 local-date" data-timestamp={comment.created_at} data-format="datetime">{new Date(comment.created_at).toLocaleString()}</span>
                                </div>
                                <p class="text-gray-700 whitespace-pre-wrap">{comment.content}</p>
                                {!comment.is_deleted && user && (canCommentModeration(user) || user.id === comment.author_id) && (
                                    <form action={`/forum/comment/${comment.id}/delete`} method="post" class="text-right mt-2">
                                        <button class="text-red-400 text-xs hover:text-red-600" onclick="return confirm('Delete comment?')">Delete</button>
                                    </form>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Add Comment  */}
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
