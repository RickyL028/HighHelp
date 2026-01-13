import { Hono } from 'hono'
import { Layout } from '../layout'
import { getSortedSubjects, getUser, renderTags, updatePoints, logAction } from '../utils'
import { canUploadResource, canViewDeleted, canModerateSubject } from '../permissions'
import { SubjectSelector } from '../components/SubjectSelector'

import { Bindings } from '../types'

const app = new Hono<{ Bindings: Bindings }>()

app.get('/resources', async (c) => {
    const user = await getUser(c)
    const subject = c.req.query('subject')

    // 1. Landing Page (No Subject) -> Show Recent Resources + Subject Selector at Bottom
    if (!subject) {
        // Fetch recent resources globally
        const showDeleted = user && canViewDeleted(user);
        const sql = `
            SELECT r.*, u.first_name, u.last_name, u.tags 
            FROM resources r 
            LEFT JOIN users u ON r.uploader_id = u.id 
            WHERE r.type = 'resource'
            ${showDeleted ? '' : 'AND r.is_deleted = 0'}
            ORDER BY r.created_at DESC 
            LIMIT 5
        `;
        const { results: recentResources } = await c.env.DB.prepare(sql).all()
        return c.html(
            <Layout title="Resources" user={user}>
                <div class="mx-auto space-y-12">

                    {/* Recent Resources Section */}
                    <section>
                        <h1 class="text-3xl font-bold mb-6">Recent Resources</h1>
                        <div class="space-y-4">
                            {recentResources?.length === 0 ? (
                                <p class="text-gray-500 italic">No resources uploaded recently.</p>
                            ) : (
                                recentResources?.map((r: any) => (
                                    <div class={`bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 h-full flex flex-col justify-between ${r.is_deleted ? 'border-red-500 bg-red-50' : ''}`}>
                                        <div>
                                            <div class="flex justify-between items-center mb-3">
                                                <div class="flex items-center gap-2">
                                                    <span class="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide">{r.subject}</span>
                                                    {r.is_deleted && <span class="text-xs font-bold text-red-600 uppercase">Deleted</span>}
                                                </div>
                                                <span class="text-xs text-gray-400 local-date" data-timestamp={r.created_at}>{new Date(r.created_at).toLocaleDateString()}</span>
                                            </div>

                                            <h2 class="text-xl font-bold text-gray-800 mb-2 group-hover:text-blue-600 transition-colors">{r.title}</h2>

                                            <div class="text-sm text-gray-500 mb-4 flex items-center">
                                                By {r.first_name ? `${r.first_name} ${r.last_name}` : 'Unknown'}
                                                <span class="ml-2" dangerouslySetInnerHTML={{ __html: renderTags(r.tags) }}></span>
                                            </div>
                                        </div>

                                        <div class="border-t border-gray-100 pt-3 flex justify-between items-center">
                                            <a href={`/download/${r.file_key}`} target="_blank" class="text-blue-600 font-bold text-sm hover:underline flex items-center gap-1">
                                                <span>Download Resource</span>
                                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                                            </a>
                                            {!r.is_deleted && user && (canModerateSubject(user, r.subject) || user.id === r.uploader_id) && (
                                                <form action={`/resources/${r.id}/delete`} method="post">
                                                    <button class="text-red-400 text-xs hover:text-red-600 font-medium">Delete</button>
                                                </form>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </section>

                    <hr class="border-gray-200" />

                    {/* Subject Selector at Bottom */}
                    <section>
                        <h2 class="text-xl font-bold mb-4">Browse/Upload by Subject</h2>
                        <SubjectSelector baseUrl="/resources" type="standard" />
                    </section>
                </div>
            </Layout>
        )
    }

    // 2. Subject Page -> Unchanged Logic
    const showDeleted = user && canViewDeleted(user);
    const sql = `
        SELECT r.*, u.first_name, u.last_name, u.tags 
        FROM resources r 
        LEFT JOIN users u ON r.uploader_id = u.id 
        WHERE r.subject = ? 
        ${showDeleted ? '' : 'AND r.is_deleted = 0'}
        ORDER BY r.created_at DESC
    `;
    const { results } = await c.env.DB.prepare(sql).bind(subject).all()

    return c.html(
        <Layout title={`Resources - ${subject}`} user={user}>
            <div class="flex items-center justify-between mb-6">
                <h1 class="text-3xl font-bold">{subject} Resources</h1>
                <a href="/resources" class="text-blue-600 hover:underline">← All Subjects</a>
            </div>

            {user && canUploadResource(user) ? (
                <div class="bg-gray-50 p-6 rounded-lg border border-gray-200 mb-8">
                    <h3 class="text-lg font-bold mb-4">Upload Resource</h3>
                    <form action="/resources" method="post" enctype="multipart/form-data" class="space-y-4">
                        <input type="hidden" name="subject" value={subject} />
                        <div>
                            <label class="block text-sm font-medium text-gray-700">Title - e.g. My Notes on Differentiation!</label>
                            <input type="text" name="title" required class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700">Description - e.g. Some class notes from my math class 11MAX2 && my personal tips!</label>
                            <textarea name="description" rows={4} class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"></textarea>
                        </div>
                        <a class="block text-sm font-medium text-gray-300">Note: inappropiate content will be removed & you may be banned :/</a>
                        <div>
                            <label class="block text-sm font-medium text-gray-500">File</label>
                            <input
                                type="file"
                                name="file"
                                required
                                class="mt-1 block w-full text-sm text-gray-500"
                                accept="*"
                                onchange="if(this.files[0].size > 26214400){ alert('File is too big! Max size is 25MB.'); this.value = ''; }"
                            />
                            <p class="text-xs text-gray-500 mt-1">Maximum file size: 25 MB</p>
                        </div>
                        <button type="submit" class="bg-primary text-white px-4 py-2 rounded hover:bg-blue-700">Upload Resource</button>
                    </form>
                </div>
            ) : (
                <div class="bg-blue-50 p-4 rounded mb-8 text-center text-blue-800">
                    <p>Please agree to website guidelines before uploading resources :P</p>
                </div>
            )}

            <div class="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <div class="relative w-full md:w-96">
                    <input type="text" id="search-input" placeholder="Search resources..." class="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" />
                    <svg class="w-5 h-5 text-gray-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                </div>
                <div class="flex items-center gap-2 bg-white rounded-lg p-1 border border-gray-200 shadow-sm">
                    <button id="view-list" class="p-2 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors" title="List View">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
                    </button>
                    <button id="view-grid" class="p-2 rounded text-gray-500 hover:bg-gray-50 transition-colors" title="Grid View">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>
                    </button>
                </div>
            </div>

            {/* Grid View Container */}
            <div id="grid-view-container" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {results?.length === 0 ? (
                    <div class="col-span-full text-center py-12 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                        No resources uploaded for this subject yet.
                    </div>
                ) : (
                    results.map((r: any) => (
                        <div
                            class={`search-item bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 h-full flex flex-col justify-between ${r.is_deleted ? 'border-red-500 bg-red-50' : ''}`}
                            data-search-text={`${r.title} ${r.description} ${r.subject} ${r.first_name || ''} ${r.last_name || ''}`}
                        >
                            <div>
                                <div class="flex justify-between items-center mb-3">
                                    <div class="flex items-center gap-2">
                                        <span class="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide">{subject}</span>
                                        {r.is_deleted && <span class="text-xs font-bold text-red-600 uppercase">Deleted</span>}
                                    </div>
                                    <span class="text-xs text-gray-400 local-date" data-timestamp={r.created_at}>{new Date(r.created_at).toLocaleDateString()}</span>
                                </div>

                                <h2 class="text-xl font-bold text-gray-800 mb-2">{r.title}</h2>
                                <p class="text-gray-600 mb-4 line-clamp-3">{r.description}</p>
                            </div>

                            <div class="border-t border-gray-100 pt-3 flex justify-between items-center">
                                <div class="text-sm text-gray-500 flex items-center">
                                    Uploaded by {r.first_name ? `${r.first_name} ${r.last_name}` : 'Unknown'}
                                    <span class="ml-2" dangerouslySetInnerHTML={{ __html: renderTags(r.tags) }}></span>
                                </div>
                                <div class="flex items-center gap-4">
                                    <a href={`/download/${r.file_key}`} target="_blank" class="text-blue-600 font-bold text-sm hover:underline flex items-center gap-1">
                                        Download
                                    </a>
                                    {!r.is_deleted && user && (canModerateSubject(user, r.subject) || user.id === r.uploader_id) && (
                                        <form action={`/resources/${r.id}/delete`} method="post">
                                            <button class="text-red-400 text-xs hover:text-red-600 font-medium">Delete</button>
                                        </form>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* List View Container (Table) */}
            <div id="list-view-container" class="hidden overflow-x-auto bg-white rounded-lg shadow border border-gray-200">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Uploader</th>
                            <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        {results?.length === 0 ? (
                            <tr>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center" colspan={5}>No resources uploaded for this subject yet.</td>
                            </tr>
                        ) : (
                            results.map((r: any) => (
                                <tr
                                    class={`search-item hover:bg-gray-50 transition-colors ${r.is_deleted ? 'bg-red-50' : ''}`}
                                    data-search-text={`${r.title} ${r.description} ${r.subject} ${r.first_name || ''} ${r.last_name || ''}`}
                                >
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 local-date" data-timestamp={r.created_at}>
                                        {new Date(r.created_at).toLocaleDateString()}
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                                        {r.title}
                                        {r.is_deleted && <span class="ml-2 text-xs text-red-600 uppercase">Deleted</span>}
                                    </td>
                                    <td class="px-6 py-4 text-sm text-gray-500 truncate max-w-xs">
                                        {r.description}
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {r.first_name ? `${r.first_name} ${r.last_name}` : 'Unknown'}
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium flex items-center justify-end gap-3">
                                        <a href={`/download/${r.file_key}`} target="_blank" class="text-blue-600 hover:text-blue-900">Download</a>
                                        {!r.is_deleted && user && (canModerateSubject(user, r.subject) || user.id === r.uploader_id) && (
                                            <form action={`/resources/${r.id}/delete`} method="post">
                                                <button class="text-red-500 hover:text-red-700">Delete</button>
                                            </form>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </Layout>
    )
})

app.post('/resources', async (c) => {
    try {
        const user = await getUser(c)
        if (!user) return c.redirect('/login')

        const body = await c.req.parseBody()
        const title = body['title'] as string
        const description = body['description'] as string
        const subject = body['subject'] as string
        const file = body['file'] as File
        const MAX_SIZE = 25 * 1024 * 1024
        if (file && file.size > MAX_SIZE) {
            return c.text("File too large. Maximum size is 25MB.", 400)
        }

        if (title && file && subject) {
            if (!canUploadResource(user)) {
                return c.text('You are not allowed to upload resources.', 403);
            }

            const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
            const fileKey = `resources/${Date.now()}-${safeName}`
            await c.env.BUCKET.put(fileKey, file)
            const res = await c.env.DB.prepare('INSERT INTO resources (title, description, file_key, subject, uploader_id, type) VALUES (?, ?, ?, ?, ?, ?)')
                .bind(title, description, fileKey, subject, user.id, 'resource')
                .run()

            await logAction(c.env.DB, user.id, 'CREATE_RESOURCE', `Uploaded resource '${title}' in ${subject}`, res.meta.last_row_id, 'resources');

            // Award +3 points for upload
            await updatePoints(user.id, 3, c.env.DB);

        }
        return c.redirect(`/resources?subject=${encodeURIComponent(subject)}`)
    } catch (e: any) {
        return c.text(`Upload Failed: ${e.message}`, 500)
    }
})

app.post('/resources/:id/delete', async (c) => {
    const user = await getUser(c)
    if (!user) return c.redirect('/login')
    const id = c.req.param('id')

    const resource = await c.env.DB.prepare('SELECT * FROM resources WHERE id = ?').bind(id).first() as any;
    if (!resource) return c.notFound();

    if (!canModerateSubject(user, resource.subject) && user.id !== resource.uploader_id) {
        return c.text('Unauthorized', 403);
    }

    await c.env.DB.prepare('UPDATE resources SET is_deleted = 1 WHERE id = ?').bind(id).run();
    await logAction(c.env.DB, user.id, 'DELETE_RESOURCE', `Deleted resource ${id}`, Number(id), 'resources');

    return c.redirect(`/resources?subject=${encodeURIComponent(resource.subject)}`);
})

app.get('/download/*', async (c) => {
    try {
        const path = c.req.path;
        const prefix = '/download/';
        if (!path.startsWith(prefix)) return c.text('Invalid path', 400);
        const key = path.slice(prefix.length);
        const object = await c.env.BUCKET.get(key);
        if (!object) return c.text('File not found', 404);
        return new Response(object.body, {
            headers: {
                'etag': object.httpEtag,
                'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
            }
        })
    } catch (e: any) {
        return c.text(`Download Failed: ${e.message}`, 500);
    }
})

export default app
