import { Hono } from 'hono'
import { Layout } from '../layout'
import { getSortedSubjects, getUser, renderTags, updatePoints, logAction, formatDate } from '../utils'
import { canUploadResource, canViewDeleted, canModerateSubject } from '../permissions'
import { SubjectSelector } from '../components/SubjectSelector'

import { Bindings } from '../types'

const app = new Hono<{ Bindings: Bindings }>()

// Helper to render uploader name based on display preference
const renderUploaderName = (r: any) => {
    const display = r.uploader_display || 'initials';
    if (display === 'anonymous' || !r.first_name) return 'Anonymous';
    if (display === 'initials') {
        const fi = r.first_name?.charAt(0) || '';
        const li = r.last_name?.charAt(0) || '';
        return `${fi}${li}`.toUpperCase();
    }
    return `${r.first_name} ${r.last_name || ''}`.trim();
};

// Subject icon/color config
interface SubjectStyle { color: string; bg: string; icon: any }

function getSubjectStyle(subject: string): SubjectStyle {
    const s = subject.toLowerCase();
    const ico = (d: string, extra?: string) => <svg class="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={d}></path>{extra && <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={extra}></path>}</svg>;
    const icoL = (d: string) => <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={d}></path></svg>;

    const badge = (color: string, bg: string, d: string, extra?: string): SubjectStyle => ({ color, bg, icon: ico(d, extra) });
    const badgeL = (color: string, bg: string, d: string): SubjectStyle => ({ color, bg, icon: icoL(d) });

    if (/bio/.test(s))   return badge('text-green-700 dark:text-green-400', 'bg-green-50 dark:bg-green-900/30', 'M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25');
    if (/chem/.test(s))  return badge('text-purple-700 dark:text-purple-400', 'bg-purple-50 dark:bg-purple-900/30', 'M9 3v6m6-6v6m-3 3v6m0-14a3 3 0 013 3v3a3 3 0 01-6 0V9a3 3 0 013-3z');
    if (/phys/.test(s))  return badge('text-indigo-700 dark:text-indigo-400', 'bg-indigo-50 dark:bg-indigo-900/30', 'M13 10V3L4 14h7v7l9-11h-7z');
    if (/math/.test(s))  return badge('text-orange-700 dark:text-orange-400', 'bg-orange-50 dark:bg-orange-900/30', 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z');
    if (/eng/.test(s))   return badge('text-cyan-700 dark:text-cyan-400', 'bg-cyan-50 dark:bg-cyan-900/30', 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4');
    if (/english|writing/.test(s)) return badge('text-blue-700 dark:text-blue-400', 'bg-blue-50 dark:bg-blue-900/30', 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253');
    if (/econom|business|legal/.test(s)) return badge('text-amber-700 dark:text-amber-400', 'bg-amber-50 dark:bg-amber-900/30', 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z');
    if (/history|geograph/.test(s)) return badge('text-teal-700 dark:text-teal-400', 'bg-teal-50 dark:bg-teal-900/30', 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z');
    if (/drama|music/.test(s)) return badge('text-pink-700 dark:text-pink-400', 'bg-pink-50 dark:bg-pink-900/30', 'M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3');
    if (/visual art|art/.test(s)) return badge('text-fuchsia-700 dark:text-fuchsia-400', 'bg-fuchsia-50 dark:bg-fuchsia-900/30', 'M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01');
    if (/chinese|german|latin|greek|language/.test(s)) return badge('text-rose-700 dark:text-rose-400', 'bg-rose-50 dark:bg-rose-900/30', 'M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129');
    if (/software|cs|computing/.test(s)) return badge('text-lime-700 dark:text-lime-400', 'bg-lime-50 dark:bg-lime-900/30', 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4');
    if (/health|sport|movement/.test(s)) return badge('text-red-700 dark:text-red-400', 'bg-red-50 dark:bg-red-900/30', 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z');
    return badge('text-gray-700 dark:text-gray-400', 'bg-gray-50 dark:bg-gray-900/30', 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10');
}

function SubjectBadge({ subject }: { subject: string }) {
    const s = getSubjectStyle(subject);
    return (
        <span class={`inline-flex items-center gap-1 ${s.color} text-xs whitespace-nowrap`}>
            {s.icon}
            {subject}
        </span>
    );
}

function SubjectIcon({ subject }: { subject: string }) {
    const s = getSubjectStyle(subject);
    return (
        <div class={`shrink-0 w-10 h-10 ${s.bg} ${s.color} rounded-lg items-center justify-center hidden sm:flex`}>
            {s.icon}
        </div>
    );
}

app.get('/resources', async (c) => {
    const user = await getUser(c)

    const subject = c.req.query('subject')


    if (!subject) {

        const showDeleted = user && canViewDeleted(user);
        const sql = `
            SELECT r.*, u.first_name, u.last_name, u.tags 
            FROM resources r 
            LEFT JOIN users u ON r.uploader_id = u.id 
            WHERE r.type = 'resource'
            ${showDeleted ? '' : 'AND r.is_deleted = 0'}
            ORDER BY r.created_at DESC 
            LIMIT 100
        `;
        const { results: recentResources } = await c.env.DB.prepare(sql).all()
        const allSubjects = Array.from(new Set(recentResources?.map((r: any) => r.subject) || []));

        return c.html(
            <Layout title="Resources" user={user}>
                <div class="mx-auto space-y-6">
                    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
                        <h1 class="text-3xl font-bold">Resources Feed</h1>
                        <a href="#browse-subjects" class="text-blue-600 hover:underline">Upload Resources ↓</a>
                    </div>

                    {/* Top Controls Bar (Search, Filters, Sort, View) */}
                    <div class="bg-white dark:bg-neutral-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-neutral-700 flex flex-col lg:flex-row gap-4 items-center">

                        {/* Search Input */}
                        <div class="w-full lg:w-1/4 relative shrink-0">
                            <input type="text" id="feed-search" placeholder="Search resources..." class="w-full pl-10 pr-4 py-2 rounded border border-gray-300 dark:border-neutral-600 dark:bg-neutral-700 dark:text-white focus:outline-none focus:border-blue-500 transition-colors text-sm" />
                            <svg class="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                        </div>

                        {/* Horizontally Scrollable Filters */}
                        <div class="w-full lg:flex-1 overflow-x-auto" id="feed-subject-filters" style="scrollbar-width: thin;">
                            <div class="flex items-center gap-2 w-max pb-2 lg:pb-0">
                                {allSubjects.length === 0 ? <p class="text-sm text-gray-500 italic px-2">No subjects available.</p> : null}
                                {allSubjects.map((sub: any) => (
                                    <label class="shrink-0 flex items-center gap-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-neutral-700 bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 py-1.5 px-3 rounded-full transition-colors">
                                        <input type="checkbox" value={sub} class="subject-cb rounded text-blue-600 focus:ring-blue-500 bg-white dark:bg-neutral-800 border-gray-300 dark:border-neutral-600 w-3.5 h-3.5" />
                                        <span class="text-sm text-gray-700 dark:text-neutral-300 whitespace-nowrap select-none font-medium">{sub}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Sort & View Controls */}
                        <div class="flex w-full lg:w-auto gap-4 items-center justify-between lg:justify-end shrink-0 border-t lg:border-t-0 border-gray-100 pt-3 lg:pt-0">
                            <div class="flex items-center gap-2">
                                <label class="text-sm text-gray-600 dark:text-neutral-400 font-medium">Sort:</label>
                                <select id="feed-sort" class="border border-gray-300 dark:border-neutral-600 rounded text-sm py-1.5 px-2 focus:outline-none focus:border-blue-500 bg-white dark:bg-neutral-700 dark:text-white">
                                    <option value="date-desc">Newest First</option>
                                    <option value="downloads-desc">Most Downloads</option>
                                </select>
                            </div>

                            <div class="flex items-center gap-1 bg-gray-100 dark:bg-neutral-900 rounded p-1 border border-gray-200 dark:border-neutral-700">
                                <button id="feed-view-list" class="p-1.5 rounded dark:hover:bg-neutral-800 text-blue-600 transition-colors" title="List View">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
                                </button>
                                <button id="feed-view-grid" class="p-1.5 rounded text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors" title="Grid View">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6z"></path></svg>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Feed Containers (Full width now that sidebars are removed) */}
                    <div class="w-full">
                        {/* Grid View Container */}
                        <div id="feed-container" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 hidden">
                            {recentResources?.map((r: any) => (
                                <div class={`feed-item grid-style bg-white dark:bg-neutral-800 rounded border border-gray-300 dark:border-neutral-700 p-4 hover:shadow-md transition-shadow flex-col justify-between ${r.is_deleted ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : ''}`}
                                    data-title={r.title?.toLowerCase() || ''}
                                    data-desc={r.description?.toLowerCase() || ''}
                                    data-subject={r.subject}
                                    data-date={r.created_at}
                                    data-downloads={r.download_count || 0}>
                                    <div>
                                        <a href={`/resources/view/${r.id}`} class="text-lg font-bold text-gray-900 dark:text-white mb-1 leading-snug hover:text-blue-600 dark:hover:text-blue-400 line-clamp-2">{r.title}</a>
                                        <div class="flex flex-wrap items-center gap-x-2 text-xs text-gray-500 dark:text-neutral-400 mb-3">
                                            <SubjectBadge subject={r.subject} />
                                            <span class="text-gray-300 dark:text-neutral-600">•</span>
                                            <span class="local-date" data-timestamp={r.created_at}>{formatDate(r.created_at)}</span>
                                        </div>
                                        <p class="text-gray-600 dark:text-neutral-300 mb-4 text-sm line-clamp-2 leading-relaxed">{r.description || <span class="italic text-gray-400 dark:text-neutral-500">No description...</span>}</p>
                                    </div>
                                    <div class="flex justify-end items-center mt-auto pt-3 border-t border-gray-100 dark:border-neutral-700 gap-2">
                                        <a href={`/download/${r.file_key}?id=${r.id}`} target="_blank" class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300" title="Download">
                                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                                        </a>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* List View Container */}
                        <div id="feed-list-container" class="bg-white dark:bg-neutral-800 rounded-lg border border-gray-200 dark:border-neutral-700 shadow-sm overflow-hidden hidden">
                            <div class="divide-y divide-gray-100 dark:divide-neutral-700 feed-list">
                                {recentResources?.map((r: any) => (
                                    <div class={`feed-item list-style p-4 hover:bg-gray-50 dark:hover:bg-neutral-700 flex items-center gap-4 transition-colors ${r.is_deleted ? 'bg-red-50 dark:bg-red-900/20' : ''}`}
                                        data-title={r.title?.toLowerCase() || ''}
                                        data-desc={r.description?.toLowerCase() || ''}
                                        data-subject={r.subject}
                                        data-date={r.created_at}
                                        data-downloads={r.download_count || 0}>
                                        <SubjectIcon subject={r.subject} />
                                        <div class="flex-grow min-w-0">
                                            <div class="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3 mb-1">
                                                <a href={`/resources/view/${r.id}`} class="text-sm font-bold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 truncate">{r.title}</a>
                                                <SubjectBadge subject={r.subject} />
                                            </div>
                                            {r.description && <p class="text-xs text-gray-500 dark:text-neutral-400 truncate mt-0.5">{r.description}</p>}
                                        </div>
                                        <div class="shrink-0 flex items-center gap-4">
                                            <a href={`/resources/view/${r.id}`} target="_blank" class="px-3 py-1.5 bg-gray-100 dark:bg-neutral-700 hover:bg-gray-200 dark:hover:bg-neutral-600 text-gray-700 dark:text-neutral-200 text-xs font-medium rounded transition-colors whitespace-nowrap border border-gray-200 dark:border-neutral-600">
                                                View
                                            </a>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div id="feed-empty-state" class="hidden py-12 text-center text-gray-500 bg-white rounded-lg border border-dashed border-gray-300 mt-4">
                            No resources match your search and filters.
                        </div>
                    </div>

                    <script dangerouslySetInnerHTML={{
                        __html: `
                        document.addEventListener('DOMContentLoaded', () => {
                            const searchInput = document.getElementById('feed-search');
                            const sortSelect = document.getElementById('feed-sort');
                            const checkboxes = document.querySelectorAll('.subject-cb');
                            const viewListBtn = document.getElementById('feed-view-list');
                            const viewGridBtn = document.getElementById('feed-view-grid');
                            const gridContainer = document.getElementById('feed-container');
                            const listContainer = document.getElementById('feed-list-container');
                            const emptyState = document.getElementById('feed-empty-state');
                            
                            if (!gridContainer || !listContainer) return;
                            
                            // Load preferences
                            const prefs = JSON.parse(localStorage.getItem('resourcesFeedPrefs') || '{"view":"list","sort":"date-desc","subjects":[]}');
                            
                            if (sortSelect) sortSelect.value = prefs.sort || 'date-desc';
                            checkboxes.forEach(cb => {
                                if (prefs.subjects.includes(cb.value)) cb.checked = true;
                            });

                            const applyView = (view) => {
                                if (view === 'grid') {
                                    gridContainer.classList.remove('hidden');
                                    listContainer.classList.add('hidden');
                                    viewGridBtn.classList.add('bg-white', 'shadow-sm', 'text-blue-600');
                                    viewGridBtn.classList.remove('text-gray-500', 'hover:text-gray-700');
                                    viewListBtn.classList.remove('bg-white', 'shadow-sm', 'text-blue-600');
                                    viewListBtn.classList.add('text-gray-500', 'hover:text-gray-700');
                                } else {
                                    gridContainer.classList.add('hidden');
                                    listContainer.classList.remove('hidden');
                                    viewListBtn.classList.add('bg-white', 'shadow-sm', 'text-blue-600');
                                    viewListBtn.classList.remove('text-gray-500', 'hover:text-gray-700');
                                    viewGridBtn.classList.remove('bg-white', 'shadow-sm', 'text-blue-600');
                                    viewGridBtn.classList.add('text-gray-500', 'hover:text-gray-700');
                                }
                                prefs.view = view;
                                savePrefs();
                            };

                            const savePrefs = () => localStorage.setItem('resourcesFeedPrefs', JSON.stringify(prefs));

                            const sortAndFilterItems = (container, isGrid) => {
                                const parent = isGrid ? container : container.querySelector('.feed-list');
                                if (!parent) return 0;
                                
                                const items = Array.from(parent.querySelectorAll('.feed-item'));
                                const term = (searchInput ? searchInput.value.toLowerCase() : '');
                                const activeSubjects = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);
                                const sortVal = sortSelect ? sortSelect.value : 'date-desc';

                                let visibleCount = 0;
                                items.forEach(item => {
                                    const title = item.getAttribute('data-title') || '';
                                    const desc = item.getAttribute('data-desc') || '';
                                    const subj = item.getAttribute('data-subject') || '';
                                    
                                    const matchesSearch = title.includes(term) || desc.includes(term);
                                    const matchesSubject = activeSubjects.length === 0 || activeSubjects.includes(subj);
                                    
                                    if (matchesSearch && matchesSubject) {
                                        item.classList.remove('hidden');
                                        if (isGrid) item.classList.add('flex');
                                        visibleCount++;
                                    } else {
                                        item.classList.add('hidden');
                                        if (isGrid) item.classList.remove('flex');
                                    }
                                });

                                const visibleItems = items.filter(item => !item.classList.contains('hidden'));
                                visibleItems.sort((a, b) => {
                                    if (sortVal === 'downloads-desc') {
                                        return parseInt(b.getAttribute('data-downloads')) - parseInt(a.getAttribute('data-downloads'));
                                    } else {
                                        return parseInt(b.getAttribute('data-date')) - parseInt(a.getAttribute('data-date'));
                                    }
                                });

                                visibleItems.forEach(item => parent.appendChild(item));
                                return visibleCount;
                            };

                            const update = () => {
                                prefs.sort = sortSelect ? sortSelect.value : 'date-desc';
                                prefs.subjects = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);
                                savePrefs();
                                
                                const gridVisible = sortAndFilterItems(gridContainer, true);
                                const listVisible = sortAndFilterItems(listContainer, false);
                                
                                if (gridVisible === 0) {
                                    if(emptyState) emptyState.classList.remove('hidden');
                                } else {
                                    if(emptyState) emptyState.classList.add('hidden');
                                }
                            };

                            if(searchInput) searchInput.addEventListener('input', update);
                            if(sortSelect) sortSelect.addEventListener('change', update);
                            checkboxes.forEach(cb => cb.addEventListener('change', update));
                            
                            if(viewListBtn) viewListBtn.addEventListener('click', () => applyView('list'));
                            if(viewGridBtn) viewGridBtn.addEventListener('click', () => applyView('grid'));

                            // initial load
                            applyView(prefs.view || 'list');
                            update();
                        });
                    `}} />

                    <hr class="border-gray-200 dark:border-neutral-700 my-8" id="browse-subjects" />

                    <section class="bg-gray-50 dark:bg-neutral-800 p-6 rounded-lg border border-gray-100 dark:border-neutral-700">
                        <h2 class="text-xl font-bold mb-4 text-gray-800 dark:text-white">Upload To...</h2>
                        <SubjectSelector baseUrl="/resources" type="standard" />
                    </section>
                </div>
            </Layout>
        )
    }

    // --- Rest of code remains identical ---
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
                <div class="bg-gray-50 dark:bg-neutral-800 p-6 rounded-lg border border-gray-200 dark:border-neutral-700 mb-8">
                    <h3 class="text-lg font-bold mb-4 dark:text-white">Upload Resource</h3>
                    <form action="/resources" method="post" enctype="multipart/form-data" class="space-y-4">
                        <input type="hidden" name="subject" value={subject} />
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-neutral-300">Title - e.g. My Notes on Differentiation!</label>
                            <input type="text" name="title" required class="mt-1 block w-full rounded-md border-gray-300 dark:border-neutral-600 dark:bg-neutral-700 dark:text-white shadow-sm p-2 border" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-neutral-300">Description - e.g. Some class notes from my math class 11MAX2 && my personal tips!</label>
                            <textarea name="description" rows={4} class="mt-1 block w-full rounded-md border-gray-300 dark:border-neutral-600 dark:bg-neutral-700 dark:text-white shadow-sm p-2 border"></textarea>
                        </div>
                        <a class="block text-sm font-medium text-gray-400 dark:text-neutral-500">Note: inappropiate content will be removed & you may be banned :/</a>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">Display Name</label>
                            <div class="flex flex-wrap gap-3">
                                <label class="flex items-center gap-2 cursor-pointer bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-600 rounded-lg px-4 py-2.5 hover:border-blue-400 dark:hover:border-blue-500 transition-colors has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50 dark:has-[:checked]:bg-blue-900/30">
                                    <input type="radio" name="uploader_display" value="anonymous" class="text-blue-600 focus:ring-blue-500" />
                                    <div>
                                        <span class="text-sm font-medium text-gray-700 dark:text-neutral-200">Anonymous</span>
                                        <p class="text-xs text-gray-400 dark:text-neutral-500"></p>
                                    </div>
                                </label>
                                <label class="flex items-center gap-2 cursor-pointer bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-600 rounded-lg px-4 py-2.5 hover:border-blue-400 dark:hover:border-blue-500 transition-colors has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50 dark:has-[:checked]:bg-blue-900/30">
                                    <input type="radio" name="uploader_display" value="initials" checked class="text-blue-600 focus:ring-blue-500" />
                                    <div>
                                        <span class="text-sm font-medium text-gray-700 dark:text-neutral-200">Initials</span>
                                        <p class="text-xs text-gray-400 dark:text-neutral-500">ie "{user.first_name?.charAt(0)}{user.last_name?.charAt(0)}"</p>
                                    </div>
                                </label>
                                <label class="flex items-center gap-2 cursor-pointer bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-600 rounded-lg px-4 py-2.5 hover:border-blue-400 dark:hover:border-blue-500 transition-colors has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50 dark:has-[:checked]:bg-blue-900/30">
                                    <input type="radio" name="uploader_display" value="full" class="text-blue-600 focus:ring-blue-500" />
                                    <div>
                                        <span class="text-sm font-medium text-gray-700 dark:text-neutral-200">Full Name</span>
                                        <p class="text-xs text-gray-400 dark:text-neutral-500">ie "{user.first_name} {user.last_name}"</p>
                                    </div>
                                </label>
                            </div>
                        </div>
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
                <div class="bg-blue-50 dark:bg-blue-900/20 p-4 rounded mb-8 text-center text-blue-800 dark:text-blue-300">
                    <a href='/about#application'><u>Please agree to website guidelines before uploading resources :P</u></a>
                </div>
            )}

            <div class="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <div class="relative w-full md:w-96">
                    <input type="text" id="search-input" placeholder="Search resources..." class="w-full pl-10 pr-4 py-2 rounded border border-gray-300 dark:border-neutral-600 dark:bg-neutral-700 dark:text-white focus:outline-none focus:border-blue-500 transition-colors text-sm" />
                    <svg class="w-4 h-4 text-gray-400 absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                </div>
                <div class="flex items-center gap-2 bg-gray-100 dark:bg-neutral-900 rounded p-1 border border-gray-200 dark:border-neutral-700 shadow-sm">
                    <button id="view-list" class="p-1.5 rounded dark:hover:bg-neutral-800 text-blue-600 transition-colors" title="List View">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
                    </button>
                    <button id="view-grid" class="p-1.5 rounded text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors" title="Grid View">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6z"></path></svg>
                    </button>
                </div>
            </div>

            {/* Grid View */}
            <div id="grid-view-container" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 hidden">
                {results?.length === 0 ? (
                    <div class="col-span-full text-center py-12 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                        No resources uploaded for this subject yet.
                    </div>
                ) : (
                    results.map((r: any) => (
                        <div
                            class={`search-item flex-col bg-white dark:bg-neutral-800 rounded border border-gray-300 dark:border-neutral-700 p-4 hover:shadow-md transition-shadow justify-between ${r.is_deleted ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'flex'}`}
                            data-search-text={`${r.title} ${r.description} ${r.subject} ${r.first_name || ''} ${r.last_name || ''}`}
                        >
                            <div>
                                <a href={`/resources/view/${r.id}`} class="text-lg font-bold text-gray-900 dark:text-white mb-1 leading-snug hover:text-blue-600 dark:hover:text-blue-400 line-clamp-2">{r.title}</a>

                                <div class="flex flex-wrap items-center gap-x-2 text-xs text-gray-500 dark:text-neutral-400 mb-2">
                                    <SubjectBadge subject={r.subject} />
                                    <span class="text-gray-300 dark:text-neutral-600">•</span>
                                    <span class="local-date" data-timestamp={r.created_at}>{formatDate(r.created_at)}</span>
                                    {r.is_deleted && <span class="font-bold text-red-600 uppercase ml-2">Deleted</span>}
                                </div>

                                <p class="text-gray-600 dark:text-neutral-300 mb-4 text-sm line-clamp-2 leading-relaxed">{r.description || <span class="italic text-gray-400 dark:text-neutral-500">No description...</span>}</p>
                            </div>

                            <div class="flex justify-between items-center mt-auto pt-3 border-t border-gray-100 dark:border-neutral-700 gap-2">
                                <div class="text-xs text-gray-500 dark:text-neutral-400 flex items-center min-w-0">
                                    <span class="truncate">By {renderUploaderName(r)}</span>
                                    {r.uploader_display !== 'anonymous' && <span class="ml-1 shrink-0" dangerouslySetInnerHTML={{ __html: renderTags(r.tags) }}></span>}
                                </div>
                                <div class="flex items-center gap-3 shrink-0">

                                    <a href={`/download/${r.file_key}?id=${r.id}`} target="_blank" class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300" title="Download">
                                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                                    </a>
                                    {!r.is_deleted && user && (canModerateSubject(user, r.subject) || user.id === r.uploader_id) && (
                                        <form action={`/resources/${r.id}/delete`} method="post" class="inline">
                                            <button class="text-red-400 hover:text-red-600" title="Delete">
                                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                            </button>
                                        </form>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* List View Container */}
            <div id="list-view-container" class="bg-white dark:bg-neutral-800 rounded-lg border border-gray-200 dark:border-neutral-700 shadow-sm overflow-hidden">
                {results?.length === 0 ? (
                    <div class="py-12 text-center text-gray-500 dark:text-neutral-400">No resources uploaded for this subject yet.</div>
                ) : (
                    <div class="divide-y divide-gray-100 dark:divide-neutral-700">
                        {results.map((r: any) => (
                            <div
                                class={`search-item list-style p-4 hover:bg-gray-50 dark:hover:bg-neutral-700 flex items-center gap-4 transition-colors ${r.is_deleted ? 'bg-red-50 dark:bg-red-900/20' : ''}`}
                                data-search-text={`${r.title} ${r.description} ${r.subject} ${r.first_name || ''} ${r.last_name || ''}`}
                            >
                                <SubjectIcon subject={r.subject} />
                                <div class="flex-grow min-w-0">
                                    <div class="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3 mb-1">
                                        <a href={`/resources/view/${r.id}`} class="text-sm font-bold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 truncate">{r.title}</a>
                                        <SubjectBadge subject={r.subject} />
                                        {r.is_deleted && <span class="text-[10px] font-bold text-red-600 uppercase">Deleted</span>}
                                    </div>
                                    {r.description && <p class="text-xs text-gray-500 dark:text-neutral-400 truncate mt-0.5">{r.description}</p>}
                                    <div class="text-xs text-gray-500 dark:text-neutral-400 flex items-center gap-2 mt-0.5">
                                        <span class="truncate">By {renderUploaderName(r)}</span>
                                        <span class="text-gray-300 dark:text-neutral-600">•</span>
                                        <span class="local-date whitespace-nowrap" data-timestamp={r.created_at}>{formatDate(r.created_at)}</span>
                                    </div>
                                </div>
                                <div class="shrink-0 flex items-center gap-4">

                                    <a href={`/download/${r.file_key}?id=${r.id}`} target="_blank" class="px-3 py-1.5 bg-gray-100 dark:bg-neutral-700 hover:bg-gray-200 dark:hover:bg-neutral-600 text-gray-700 dark:text-neutral-200 text-xs font-medium rounded transition-colors whitespace-nowrap border border-gray-200 dark:border-neutral-600">
                                        Download
                                    </a>
                                    {!r.is_deleted && user && (canModerateSubject(user, r.subject) || user.id === r.uploader_id) && (
                                        <form action={`/resources/${r.id}/delete`} method="post" class="inline">
                                            <button class="text-red-400 hover:text-red-700 px-2" title="Delete">
                                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                            </button>
                                        </form>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
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
        const uploaderDisplay = (body['uploader_display'] as string) || 'initials'
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
            await c.env.BUCKET.put(fileKey, file, {
                httpMetadata: {
                    contentType: file.type || 'application/octet-stream'
                }
            })
            const res = await c.env.DB.prepare('INSERT INTO resources (title, description, file_key, subject, uploader_id, type, uploader_display) VALUES (?, ?, ?, ?, ?, ?, ?)')
                .bind(title, description, fileKey, subject, user.id, 'resource', uploaderDisplay)
                .run()

            await logAction(c.env.DB, user.id, 'CREATE_RESOURCE', `Uploaded resource '${title}' in ${subject}`, res.meta.last_row_id, 'resources');


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
        return c.text('Unauthorised', 403);
    }

    await c.env.DB.prepare('UPDATE resources SET is_deleted = 1 WHERE id = ?').bind(id).run();
    await logAction(c.env.DB, user.id, 'DELETE_RESOURCE', `Deleted resource ${id}`, Number(id), 'resources');

    return c.redirect(`/resources?subject=${encodeURIComponent(resource.subject)}`);
})

// Helper to guess MIME type by extension
const getMimeType = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    const map: Record<string, string> = {
        'pdf': 'application/pdf',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp',
        'txt': 'text/plain',
        'mp4': 'video/mp4'
    };
    return map[ext || ''] || 'application/octet-stream';
};

app.get('/download/*', async (c) => {
    try {
        const user = await getUser(c)
        if (!user) return c.redirect('/login')

        const path = c.req.path;
        const prefix = '/download/';
        const key = path.slice(prefix.length);
        const object = await c.env.BUCKET.get(key);
        if (!object) return c.text('File not found', 404);

        // --- NEW LOGIC ---
        // If the bucket metadata is missing or generic, use our helper
        let contentType = object.httpMetadata?.contentType;
        if (!contentType || contentType === 'application/octet-stream') {
            contentType = getMimeType(key);
        }
        // -----------------

        const id = c.req.query('id');
        if (id) {
            await c.env.DB.prepare('UPDATE resources SET download_count = download_count + 1 WHERE id = ?').bind(id).run();
        }

        return new Response(object.body, {
            headers: {
                'etag': object.httpEtag,
                'Content-Type': contentType, // Use the detected type
                // Ensure browser doesn't force download
                'Content-Disposition': 'inline',
            }
        })
    } catch (e: any) {
        return c.text(`Download Failed: ${e.message}`, 500);
    }
})
app.get('/resources/view/:id', async (c) => {
    const user = await getUser(c)
    const id = c.req.param('id')

    const sql = `
        SELECT r.*, u.first_name, u.last_name, u.tags 
        FROM resources r 
        LEFT JOIN users u ON r.uploader_id = u.id 
        WHERE r.id = ?
    `;
    const resource = await c.env.DB.prepare(sql).bind(id).first() as any;

    if (!resource) return c.notFound();

    if (resource.is_deleted && (!user || !canViewDeleted(user))) {
        return c.notFound();
    }

    // --- NEW PREVIEW LOGIC ---
    const fileExt = resource.file_key.split('.').pop()?.toLowerCase() || '';
    const isPDF = fileExt === 'pdf';
    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExt);
    const isText = ['txt', 'csv', 'md'].includes(fileExt);
    const hasPreview = isPDF || isImage || isText;
    // -------------------------

    return c.html(
        <Layout title={`${resource.title} - ${resource.subject}`} user={user}>
            <div class="max-w-4xl mx-auto py-8 px-4">
                <a href={`/resources?subject=${encodeURIComponent(resource.subject)}`} class="text-blue-600 hover:underline mb-6 inline-block">← Back to {resource.subject} Resources</a>

                <div class="bg-white dark:bg-neutral-800 rounded-lg border border-gray-200 dark:border-neutral-700 shadow-sm p-8">
                    {/* Header Section */}
                    <div class="flex items-start justify-between mb-6">
                        <div>
                            <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-3">{resource.title}</h1>
                            <div class="flex flex-wrap items-center gap-x-3 text-sm text-gray-500 dark:text-neutral-400">
                                <SubjectBadge subject={resource.subject} />
                                <span class="local-date" data-format="datetime" data-timestamp={resource.created_at}>{formatDate(resource.created_at)}</span>
                                <span class="text-gray-300 dark:text-neutral-600">•</span>
                                <span class="flex items-center">
                                    Uploaded by: <b class="ml-1 text-gray-700 dark:text-neutral-200">{renderUploaderName(resource)}</b>
                                    {resource.uploader_display !== 'anonymous' && <span class="ml-1" dangerouslySetInnerHTML={{ __html: renderTags(resource.tags) }}></span>}
                                </span>
                            </div>
                        </div>
                        {resource.is_deleted && <span class="bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 font-bold px-3 py-1 rounded-full text-sm uppercase">Deleted</span>}
                    </div>

                    {/* Description Section */}
                    <div class="bg-gray-50 dark:bg-neutral-900/50 p-6 rounded-lg mb-8 border border-gray-100 dark:border-neutral-700">
                        <h3 class="text-sm font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-wider mb-2">Description</h3>
                        <p class="text-gray-800 dark:text-neutral-200 whitespace-pre-wrap leading-relaxed">{resource.description || <span class="italic text-gray-400 dark:text-neutral-500">No description provided.</span>}</p>
                    </div>

                    {/* NEW PREVIEW SECTION */}
                    {hasPreview && (
                        <div class="mb-8 border border-gray-200 dark:border-neutral-700 rounded-lg overflow-hidden bg-gray-50 dark:bg-neutral-900 shadow-inner">
                            <div class="bg-gray-100 dark:bg-neutral-800 px-4 py-3 border-b border-gray-200 dark:border-neutral-700 flex justify-between items-center">
                                <span class="text-sm font-bold text-gray-700 dark:text-neutral-300 uppercase tracking-wider">File Preview</span>
                                <a href={`/download/${resource.file_key}`} target="_blank" class="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
                                    Open in new tab
                                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                                </a>
                            </div>
                            <div class="w-full h-[600px] flex items-center justify-center overflow-auto">
                                {(isPDF || isText) && (
                                    <iframe
                                        src={`/download/${resource.file_key}`}
                                        class="w-full h-full border-0 bg-white dark:bg-white"
                                        title="File Preview">
                                    </iframe>
                                )}
                                {isImage && (
                                    <img
                                        src={`/download/${resource.file_key}`}
                                        alt={resource.title}
                                        class="max-w-full max-h-full object-contain p-4"
                                    />
                                )}
                            </div>
                        </div>
                    )}

                    {/* Download/Action Footer */}
                    <div class="flex items-center justify-between border-t border-gray-100 dark:border-neutral-700 pt-6">
                        <div class="text-gray-500 dark:text-neutral-400 text-sm">
                            <span class="font-medium text-gray-700 dark:text-neutral-200">{resource.download_count || 0}</span> downloads
                        </div>
                        <div class="flex gap-4">
                            {!resource.is_deleted && user && (canModerateSubject(user, resource.subject) || user.id === resource.uploader_id) && (
                                <form action={`/resources/${resource.id}/delete`} method="post">
                                    <button class="px-4 py-2 border border-red-200 text-red-600 rounded hover:bg-red-50 font-medium transition-colors">Delete Resource</button>
                                </form>
                            )}
                            <a href={`/download/${resource.file_key}?id=${resource.id}`} target="_blank" class="px-6 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 transition-colors flex items-center gap-2">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                                Download File
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    )
})

export default app