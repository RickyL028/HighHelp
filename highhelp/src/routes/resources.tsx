// Resources: a folder browser laid out like a code host's file view. A navigation tree sits on the
// left of every page (browser, note view, edit, move); the main pane lists the open folder or shows
// a note. Subjects hold the seven root sections (Task 1 … Unfiled), which hold user folders and
// notes; a note carries up to three attached files. Removed items sit in the admin-only Removed
// folder. The rules and SQL live in ../resourceFolders.ts; these handlers load the rows, ask the
// rules, and render.

import { Hono } from 'hono'
import type { Context } from 'hono'
import { raw } from 'hono/html'
import { Layout } from '../layout'
import { getSortedSubjects, getUser, loginRedirect, renderTags, updatePoints, logAction, formatDate } from '../utils'
import { canUploadResource } from '../permissions'
import { SubjectBadge, getSubjectColors } from '../components/SubjectBadge'
import { subjectLabel } from '../constants'
import { Bindings, User } from '../types'
import { DRAWING_KEY_PREFIX } from './pastPapers/drawingDoc'
import {
    MAX_CHAIN,
    MAX_FILES_PER_NOTE,
    MAX_FOLDER_NAME,
    MAX_NOTE_TITLE,
    LIVE_FOLDERS_SQL,
    LIVE_TOP_NOTES_SQL,
    ROOT_FOLDERS_SQL,
    SUBJECT_COUNTS_SQL,
    addToFolderError,
    buildFolderTree,
    canAddToFolder,
    canEditFolder,
    canEditNote,
    canMoveFolder,
    canMoveNote,
    canRemoveNote,
    canSeeChain,
    chainInTrash,
    chainSubject,
    childFoldersQuery,
    cleanAccess,
    cleanFolderName,
    createFolderStatement,
    createRootsStatements,
    emptyFoldersQuery,
    fileKey,
    fileKind,
    folderChainQuery,
    folderFilesQuery,
    folderNotesQuery,
    formatBytes,
    isAdmin,
    missingRoots,
    moveError,
    moveFolderStatements,
    moveNoteStatement,
    noteFilesQuery,
    notesQuery,
    previewKind,
    removeFolderError,
    removeFolderStatement,
    removeNoteStatement,
    subtreeFoldersQuery,
    subtreeNotesQuery,
    subtreeStatsQuery,
    treeFoldersQuery,
    treeNotesQuery,
    uploadError,
    uploadedFiles,
    type FolderBranch,
    type FolderRow,
    type Statement,
} from '../resourceFolders'

const app = new Hono<{ Bindings: Bindings }>()

type Ctx = Context<{ Bindings: Bindings }>
type Viewer = User | null

// ---------------------------------------------------------------------------------------------
// Data helpers
// ---------------------------------------------------------------------------------------------

const stmt = (db: D1Database, s: Statement) => db.prepare(s.sql).bind(...s.params)
const rows = async <T = any>(db: D1Database, s: Statement): Promise<T[]> => (await stmt(db, s).all<T>()).results
const loadChain = (db: D1Database, folderId: number) => rows<FolderRow>(db, folderChainQuery(folderId))

const parseId = (raw: unknown): number => {
    const n = Number(raw)
    return Number.isInteger(n) && n > 0 ? n : 0
}
const text = (value: unknown): string => (typeof value === 'string' ? value : '')

const loadNote = (db: D1Database, id: number) =>
    db.prepare(`
        SELECT r.*, u.first_name, u.last_name, u.tags
        FROM resources r
        LEFT JOIN users u ON r.uploader_id = u.id
        WHERE r.id = ?
    `).bind(id).first<any>()

// The top-level folders, creating any that are missing (a subject added to constants.ts, or a
// database that has never seen the resources tree).
async function loadRoots(db: D1Database): Promise<FolderRow[]> {
    let roots = (await db.prepare(ROOT_FOLDERS_SQL).all<FolderRow>()).results
    const missing = missingRoots(roots)
    if (missing.subjects.length || missing.trash) {
        await db.batch(createRootsStatements(missing.subjects).map((s) => stmt(db, s)))
        roots = (await db.prepare(ROOT_FOLDERS_SQL).all<FolderRow>()).results
    }
    return roots
}

async function trashId(db: D1Database): Promise<number> {
    const roots = await loadRoots(db)
    return roots.find((f) => f.kind === 'trash')!.id
}

// Popular subjects first, then the rest alphabetically; subjects no longer in the list go last.
function sortSubjects(folders: FolderRow[]): FolderRow[] {
    const { popular, others } = getSortedSubjects('standard')
    const order = [...popular, ...others] as string[]
    const rank = (f: FolderRow) => {
        const i = order.indexOf(f.subject || '')
        return i === -1 ? order.length : i
    }
    return [...folders].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
}

// ---------------------------------------------------------------------------------------------
// The navigation tree (sidebar) and the location picker (New note)
//
// Both are drawn in the browser by TREE_SCRIPT from the same data: the top-level folders, plus the
// contents of every folder on the way to the page being shown, so the tree opens on the current
// item without a request. Any other folder's contents are fetched from /resources/tree/:id when
// it is first expanded.
// ---------------------------------------------------------------------------------------------

type TreeFolder = { id: number; name: string; kind: string; tone: string; locked: boolean; add: boolean; nf: number; nn: number }
type TreeData = {
    roots: TreeFolder[]
    children: Record<number, { folders: TreeFolder[]; notes: { id: number; title: string }[] }>
    path: number[]
    activeFolder: number
    activeNote: number
}

const folderLabel = (f: Pick<FolderRow, 'kind' | 'subject' | 'name'>) => (f.kind === 'subject' ? subjectLabel(f.subject || f.name) : f.name)

// Icon artwork, shared by the server-rendered icons and the tree script. All use a 20x20 viewBox
// and currentColor: a two-tone folder, a lined page for a note, a solid page for an attached file.
const FOLDER_ART = '<path opacity=".45" d="M2 5.5A1.5 1.5 0 013.5 4h4.4a1.5 1.5 0 011.05.43L10.5 6h6A1.5 1.5 0 0118 7.5V10H2V5.5z"></path><path d="M2 8.5A1.5 1.5 0 013.5 7h13A1.5 1.5 0 0118 8.5v6a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 012 14.5v-6z"></path>'
const NOTE_ART = '<path fill="currentColor" opacity=".2" d="M5 2.5h6L15.5 7v9a1.5 1.5 0 01-1.5 1.5H5A1.5 1.5 0 013.5 16V4A1.5 1.5 0 015 2.5z"></path><path fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" d="M11 2.5H5A1.5 1.5 0 003.5 4v12A1.5 1.5 0 005 17.5h9a1.5 1.5 0 001.5-1.5V7L11 2.5zm0 0V7h4.5m-9 3.5h6m-6 3h4"></path>'
const FILE_ART = '<path fill="currentColor" d="M5 2.5h6L15.5 7v9a1.5 1.5 0 01-1.5 1.5H5A1.5 1.5 0 013.5 16V4A1.5 1.5 0 015 2.5z"></path><path fill="#fff" opacity=".6" d="M11 2.5V6a1 1 0 001 1h3.5L11 2.5z"></path>'

// Folder colour says what kind it is: a subject takes its subject colour, the seven fixed sections
// are sky blue, folders students made are amber.
const NOTE_TONE = 'text-violet-500 dark:text-violet-400'
const folderTone = (f?: { kind?: string; subject?: string | null }) =>
    f?.kind === 'trash' ? 'text-red-500 dark:text-red-400'
        : f?.kind === 'subject' ? getSubjectColors(f.subject || '').color.replace('-700', '-500')
            : f?.kind === 'section' ? 'text-sky-500 dark:text-sky-400'
                : f?.kind === 'root' ? 'text-gray-500 dark:text-neutral-400'
                    : 'text-amber-500 dark:text-amber-400'

// `parentChain` is the chain of the folder `f` sits in.
const treeFolder = (user: Viewer, parentChain: FolderRow[], f: any): TreeFolder => ({
    id: f.id,
    name: folderLabel(f),
    kind: f.kind,
    tone: folderTone(f),
    locked: f.kind === 'folder' && f.access === 'owner',
    add: canAddToFolder(user, [...parentChain, f]),
    nf: f.folder_count || 0,
    nn: f.note_count || 0,
})

async function treeData(db: D1Database, user: Viewer, chain: FolderRow[], activeNoteId = 0, knownRoots?: FolderRow[]): Promise<TreeData> {
    const roots = knownRoots || await loadRoots(db)
    const top = [...sortSubjects(roots.filter((f) => f.kind === 'subject')), ...(isAdmin(user) ? roots.filter((f) => f.kind === 'trash') : [])]
    const ids = chain.map((f) => f.id)
    const children: TreeData['children'] = {}
    if (ids.length) {
        const [folders, notes] = await Promise.all([rows(db, treeFoldersQuery(ids)), rows(db, treeNotesQuery(ids))])
        chain.forEach((f, i) => {
            const upTo = chain.slice(0, i + 1)
            children[f.id] = {
                folders: folders.filter((x) => x.parent_id === f.id).map((x) => treeFolder(user, upTo, x)),
                notes: notes.filter((n) => n.folder_id === f.id).map((n) => ({ id: n.id, title: n.title })),
            }
        })
    }
    return {
        // A subject always has its seven sections; the trash is only known to be expandable.
        roots: top.map((f) => treeFolder(user, [], { ...f, folder_count: 1, note_count: 0 })),
        children,
        path: ids,
        activeFolder: activeNoteId ? 0 : ids[ids.length - 1] || 0,
        activeNote: activeNoteId,
    }
}

app.get('/resources/tree/:id{[0-9]+}', async (c) => {
    const user = await getUser(c) as Viewer
    const db = c.env.DB
    const id = parseId(c.req.param('id'))
    const chain = await loadChain(db, id)
    if (chain.length === 0 || !canSeeChain(user, chain)) return c.json({ folders: [], notes: [] }, 404)
    const [folders, notes] = await Promise.all([rows(db, treeFoldersQuery([id])), rows(db, treeNotesQuery([id]))])
    c.header('cache-control', 'private, no-store')
    return c.json({
        folders: folders.map((f) => treeFolder(user, chain, f)),
        notes: notes.map((n) => ({ id: n.id, title: n.title })),
    })
})

// Inline <script> JSON: "<" is escaped so a title can never close the script element.
const scriptJson = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c')

const TREE_STYLE = `
.res-tw { transition: transform .12s; }
.res-tw.res-open { transform: rotate(90deg); }
.res-bar { background: currentColor; }
details.res-row > summary::-webkit-details-marker { display: none; }
details.res-row .res-chevron { transition: transform .12s; }
details.res-row[open] .res-chevron { transform: rotate(90deg); }
.htree, .htree ul { list-style: none; margin: 0; padding: 0; }
.htree li { display: flex; align-items: center; position: relative; padding: 3px 0 3px 18px; }
.htree ul { display: flex; flex-direction: column; position: relative; margin-left: 18px; }
.htree ul::before { content: ''; position: absolute; left: -18px; top: 50%; width: 18px; border-top: 1.5px solid currentColor; }
.htree li::before { content: ''; position: absolute; left: 0; top: 50%; width: 18px; border-top: 1.5px solid currentColor; }
.htree li::after { content: ''; position: absolute; left: 0; top: 0; bottom: 0; border-left: 1.5px solid currentColor; }
.htree li:first-child::after { top: 50%; }
.htree li:last-child::after { bottom: 50%; }
.htree > li { padding-left: 0; }
.htree ul[hidden] { display: none; }
button[data-branch][aria-expanded="true"] .res-branch-chev { transform: rotate(90deg); }
.res-branch-chev { transition: transform .12s; }
.htree > li::before, .htree > li::after { display: none; }
/* The front page's diagram is tall, so its root sits at the top instead of half-way down. */
.htree-top > li { align-items: flex-start; }
.htree-top > li > ul::before { top: 16px; }
.htree-top > li > ul > li:first-child::after { top: 16px; }
`

const TREE_SCRIPT = String.raw`
(function () {
    var data = window.__resTree || { roots: [], children: {}, path: [] };
    var cache = data.children || {};
    var pending = {};
    var EMPTY = { folders: [], notes: [] };
    var SVG = {
        chevron: '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>',
        folder: '<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">${FOLDER_ART}</svg>',
        note: '<svg class="w-4 h-4" viewBox="0 0 20 20">${NOTE_ART}</svg>',
        lock: '<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>',
        trash: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>',
        check: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path></svg>'
    };
    var ROW = 'relative flex items-center gap-1.5 h-8 pr-2 rounded-md text-sm text-gray-700 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-700';
    var ACTIVE = ['res-active', 'bg-gray-100', 'dark:bg-neutral-700', 'font-semibold'];
    var PICKED = ['bg-blue-50', 'dark:bg-blue-900/30', 'font-semibold'];

    function load(id) {
        if (cache[id]) return Promise.resolve(cache[id]);
        if (!pending[id]) {
            pending[id] = fetch('/resources/tree/' + id, { credentials: 'same-origin' })
                .then(function (r) { return r.ok ? r.json() : EMPTY; })
                .catch(function () { return EMPTY; })
                .then(function (d) { cache[id] = d; return d; });
        }
        return pending[id];
    }
    function el(tag, cls, label) {
        var e = document.createElement(tag);
        if (cls) e.className = cls;
        if (label !== undefined) e.textContent = label;
        return e;
    }
    function icon(name, cls) {
        var s = el('span', 'shrink-0 ' + (cls || ''));
        s.innerHTML = SVG[name];
        return s;
    }

    function mount(root) {
        var pick = root.getAttribute('data-mode') === 'pick';
        var open = {};
        (data.path || []).forEach(function (id) { open[id] = true; });
        if (!pick) {
            try { JSON.parse(sessionStorage.getItem('resTreeOpen') || '[]').forEach(function (id) { open[id] = true; }); } catch (e) {}
        }
        function remember() {
            if (pick) return;
            var ids = Object.keys(open).filter(function (k) { return open[k]; }).map(Number);
            try { sessionStorage.setItem('resTreeOpen', JSON.stringify(ids.slice(-40))); } catch (e) {}
        }
        var selected = pick ? Number(root.getAttribute('data-selected')) || 0 : 0;
        var pickedRow = null;

        function choose(f, row, trail) {
            if (pickedRow) {
                PICKED.forEach(function (c) { pickedRow.classList.remove(c); });
                var old = pickedRow.querySelector('.res-check');
                if (old) old.remove();
            }
            pickedRow = row;
            PICKED.forEach(function (c) { row.classList.add(c); });
            row.appendChild(icon('check', 'res-check ml-auto text-blue-600 dark:text-blue-400'));
            var input = document.getElementById(root.getAttribute('data-input'));
            if (input) input.value = f.id;
            var label = document.getElementById(root.getAttribute('data-label'));
            if (label) label.textContent = trail.join(' › ');
            var submit = document.getElementById(root.getAttribute('data-submit'));
            if (submit) { submit.disabled = false; submit.classList.remove('opacity-50', 'cursor-not-allowed'); }
        }

        function markActive(row) {
            ACTIVE.forEach(function (c) { row.classList.add(c); });
            row.appendChild(el('span', 'res-bar absolute left-0 top-1 bottom-1 w-[3px] rounded-full text-blue-500 dark:text-blue-400'));
        }

        function folderNode(f, depth, trail) {
            var here = trail.concat(f.name);
            var canOpen = pick ? f.nf > 0 : f.nf + f.nn > 0;
            var wrap = el('div');
            var row = el('div', ROW);
            row.style.paddingLeft = depth * 16 + 4 + 'px';
            var twist = el('button', 'res-tw shrink-0 w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 dark:hover:text-neutral-200');
            twist.type = 'button';
            twist.title = 'Expand';
            twist.innerHTML = SVG.chevron;
            if (!canOpen) twist.style.visibility = 'hidden';
            var box = el('div');
            box.hidden = true;
            var loaded = false;
            function setOpen(on) {
                open[f.id] = on;
                remember();
                twist.classList.toggle('res-open', on);
                box.hidden = !on;
                if (on && !loaded) {
                    loaded = true;
                    load(f.id).then(function (d) { fill(box, d, depth + 1, here); });
                }
            }
            twist.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                setOpen(box.hidden);
            });
            row.appendChild(twist);
            row.appendChild(icon(f.kind === 'trash' ? 'trash' : 'folder', f.tone));

            if (pick) {
                var label = el('span', 'min-w-0 truncate ' + (f.add || f.kind !== 'folder' ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-neutral-500'), f.name);
                row.appendChild(label);
                if (f.locked) row.appendChild(icon('lock', 'text-gray-400'));
                row.style.cursor = 'pointer';
                if (!f.add && f.kind === 'folder') row.title = 'Only the owner can add to this folder';
                row.addEventListener('click', function () {
                    if (f.add) {
                        choose(f, row, here);
                        if (canOpen && box.hidden) setOpen(true);
                    } else if (canOpen) {
                        setOpen(box.hidden);
                    }
                });
                if (f.add && f.id === selected) choose(f, row, here);
            } else {
                var link = el('a', 'min-w-0 truncate hover:underline text-gray-900 dark:text-white', f.name);
                link.href = '/resources/folder/' + f.id;
                row.appendChild(link);
                if (f.locked) row.appendChild(icon('lock', 'text-gray-400'));
                if (f.id === data.activeFolder) markActive(row);
            }
            wrap.appendChild(row);
            wrap.appendChild(box);
            if (canOpen && open[f.id]) setOpen(true);
            return wrap;
        }

        function noteNode(n, depth) {
            var row = el('div', ROW);
            row.style.paddingLeft = depth * 16 + 30 + 'px';
            row.appendChild(icon('note', '${NOTE_TONE}'));
            var link = el('a', 'min-w-0 truncate hover:underline', n.title);
            link.href = '/resources/view/' + n.id;
            row.appendChild(link);
            if (n.id === data.activeNote) markActive(row);
            return row;
        }

        function fill(box, d, depth, trail) {
            (d.folders || []).forEach(function (f) {
                if (pick && f.kind === 'trash') return;
                box.appendChild(folderNode(f, depth, trail));
            });
            if (!pick) (d.notes || []).forEach(function (n) { box.appendChild(noteNode(n, depth)); });
        }

        fill(root, { folders: data.roots || [], notes: [] }, 0, []);
        if (!pick) {
            setTimeout(function () {
                var active = root.querySelector('.res-active');
                var pane = document.getElementById('res-side');
                if (active && pane && pane.scrollHeight > pane.clientHeight) pane.scrollTop = Math.max(0, active.offsetTop - pane.clientHeight / 2);
            }, 60);
        }
    }

    document.querySelectorAll('[data-res-tree]').forEach(mount);

    // Panels (New note, New folder), the sidebar toggle on phones, and the in-folder filter.
    document.querySelectorAll('[data-panel]').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var id = btn.getAttribute('data-panel');
            document.querySelectorAll('.res-panel').forEach(function (p) {
                if (p.id === id) p.classList.toggle('hidden'); else p.classList.add('hidden');
            });
            var panel = document.getElementById(id);
            if (panel && !panel.classList.contains('hidden')) {
                var input = panel.querySelector('input[type=text]');
                if (input) input.focus();
            }
        });
    });
    var side = document.getElementById('res-side');
    var sideBtn = document.getElementById('res-side-toggle');
    if (side && sideBtn) sideBtn.addEventListener('click', function () { side.classList.toggle('hidden'); });
    var filter = document.getElementById('res-filter');
    if (filter) filter.addEventListener('input', function () {
        var term = filter.value.trim().toLowerCase();
        var shown = 0;
        document.querySelectorAll('.res-row').forEach(function (row) {
            var match = (row.getAttribute('data-name') || '').indexOf(term) !== -1;
            row.hidden = !match;
            if (match) shown++;
        });
        var empty = document.getElementById('res-filter-empty');
        if (empty) empty.hidden = shown !== 0;
    });
})();
`

// ---------------------------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------------------------

const folderHref = (id: number) => `/resources/folder/${id}`
const noteHref = (id: number) => `/resources/view/${id}`
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

const initials = (first?: string | null, last?: string | null) => `${first?.charAt(0) || ''}${last?.charAt(0) || ''}`.toUpperCase()

// Uploader name, following the note's display preference.
const renderUploaderName = (r: any) => {
    const display = r.uploader_display || 'initials';
    if (display === 'anonymous' || !r.first_name) return 'Anonymous';
    if (display === 'initials') return initials(r.first_name, r.last_name);
    return `${r.first_name} ${r.last_name || ''}`.trim();
};

const ownerName = (f: any, user: Viewer) => {
    if (user && f.creator_id === user.id) return 'you'
    return initials(f.first_name, f.last_name) || 'someone'
}

const ICONS = {
    note: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    file: 'M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13',
    lock: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
    trash: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
    pencil: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
    move: 'M17 8l4 4m0 0l-4 4m4-4H3',
    chevron: 'M9 5l7 7-7 7',
    download: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4',
    restore: 'M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6',
    plus: 'M12 4v16m8-8H4',
    search: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
    upload: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12',
    menu: 'M4 6h16M4 12h16M4 18h7',
    list: 'M4 6h16M4 12h16M4 18h16',
    branch: 'M6 4v16m0-10h6a4 4 0 004-4V4m-10 8h8a4 4 0 014 4v4',
}

const Icon = ({ name, cls }: { name: keyof typeof ICONS; cls?: string }) => (
    <svg class={cls || 'w-4 h-4'} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={ICONS[name]}></path>
    </svg>
)

// Pass the folder row as `f` for its own colour, or just a `kind`.
const FolderIcon = ({ f, kind, cls }: { f?: { kind?: string; subject?: string | null }; kind?: string; cls?: string }) => {
    const of = f || { kind: kind || 'folder' }
    return of.kind === 'trash' ? (
        <span class={`shrink-0 ${folderTone(of)}`}><Icon name="trash" cls={cls || 'w-4 h-4'} /></span>
    ) : (
        <svg class={`shrink-0 ${folderTone(of)} ${cls || 'w-4 h-4'}`} fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">{raw(FOLDER_ART)}</svg>
    )
}

const NoteIcon = ({ cls }: { cls?: string }) => (
    <svg class={`shrink-0 ${NOTE_TONE} ${cls || 'w-4 h-4'}`} viewBox="0 0 20 20" aria-hidden="true">{raw(NOTE_ART)}</svg>
)

// An attached file, coloured by type.
const FILE_TONES: Record<string, string> = {
    pdf: 'text-rose-500 dark:text-rose-400',
    image: 'text-emerald-500 dark:text-emerald-400',
    doc: 'text-indigo-500 dark:text-indigo-400',
    sheet: 'text-green-600 dark:text-green-400',
    slides: 'text-orange-500 dark:text-orange-400',
    media: 'text-purple-500 dark:text-purple-400',
    archive: 'text-yellow-600 dark:text-yellow-400',
    text: 'text-slate-500 dark:text-slate-400',
    other: 'text-slate-400 dark:text-slate-500',
}
const FileIcon = ({ name, cls }: { name: string; cls?: string }) => (
    <svg class={`shrink-0 ${FILE_TONES[fileKind(name)]} ${cls || 'w-4 h-4'}`} viewBox="0 0 20 20" aria-hidden="true">{raw(FILE_ART)}</svg>
)

const Dot = () => <span class="text-gray-300 dark:text-neutral-600">•</span>

const BTN = 'inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-sm font-medium transition-colors whitespace-nowrap'
const BTN_PRIMARY = `${BTN} bg-red-600 hover:bg-red-700 text-white`
const BTN_SECONDARY = `${BTN} bg-gray-100 dark:bg-neutral-700 hover:bg-gray-200 dark:hover:bg-neutral-600 text-gray-700 dark:text-neutral-200`
const BTN_DANGER = `${BTN} text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20`
const ROW_ACTION = 'p-1 rounded text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-200 dark:hover:bg-neutral-600 transition-colors'
const ROW_ACTION_DANGER = 'p-1 rounded text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-200 dark:hover:bg-neutral-600 transition-colors'
const INPUT = 'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm'
const LABEL = 'block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1'
const PANEL = 'bg-white dark:bg-neutral-800 rounded-lg shadow-sm'
// Every listing row is one line, 36px high, with no rule between rows.
const ROW = 'flex items-center gap-2 h-9 px-2 rounded-md hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors'
const ROW_NAME = 'min-w-0 truncate text-sm text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 hover:underline'
const ROW_META = 'ml-auto pl-3 shrink-0 flex items-center gap-2.5 text-xs text-gray-500 dark:text-neutral-400 whitespace-nowrap'
const CHOICE = 'flex items-center gap-2 cursor-pointer bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-600 rounded-lg px-4 py-2.5 hover:border-blue-400 dark:hover:border-blue-500 transition-colors has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50 dark:has-[:checked]:bg-blue-900/30'

// Resources / subject / … / folder. `hrefFor` lets the move picker reuse it; `trailing` adds a
// last, unlinked crumb (a note's title).
const Breadcrumbs = ({ chain, trailing, hrefFor, rootHref, rootLabel }: {
    chain: FolderRow[]; trailing?: string; hrefFor?: (id: number) => string; rootHref?: string; rootLabel?: string
}) => {
    const href = hrefFor || folderHref
    const Sep = () => <span class="text-gray-300 dark:text-neutral-600">/</span>
    const link = 'text-blue-600 dark:text-blue-400 hover:underline'
    const current = 'font-semibold text-gray-900 dark:text-white'
    return (
        <nav aria-label="Breadcrumb" class="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm min-w-0">
            {chain.length === 0 && !trailing
                ? <span class={current}>{rootLabel || 'Resources'}</span>
                : <a href={rootHref || '/resources'} class={link}>{rootLabel || 'Resources'}</a>}
            {chain.map((f, i) => (
                <>
                    <Sep />
                    {i === chain.length - 1 && !trailing
                        ? <span class={current}>{folderLabel(f)}</span>
                        : <a href={href(f.id)} class={link}>{folderLabel(f)}</a>}
                </>
            ))}
            {trailing && (
                <>
                    <Sep />
                    <span class={`${current} break-words min-w-0`}>{trailing}</span>
                </>
            )}
        </nav>
    )
}

const DisplayChoices = ({ value, user }: { value?: string; user: User }) => {
    const current = value || 'initials'
    const options = [
        { value: 'anonymous', label: 'Anonymous', hint: '' },
        { value: 'initials', label: 'Initials', hint: `ie "${initials(user.first_name, user.last_name)}"` },
        { value: 'full', label: 'Full Name', hint: `ie "${user.first_name} ${user.last_name}"` },
    ]
    return (
        <div>
            <span class={LABEL}>Display Name</span>
            <div class="flex flex-wrap gap-3">
                {options.map((o) => (
                    <label class={CHOICE}>
                        <input type="radio" name="uploader_display" value={o.value} checked={current === o.value} class="text-blue-600 focus:ring-blue-500" />
                        <div>
                            <span class="text-sm font-medium text-gray-700 dark:text-neutral-200">{o.label}</span>
                            {o.hint && <p class="text-xs text-gray-400 dark:text-neutral-500">{o.hint}</p>}
                        </div>
                    </label>
                ))}
            </div>
        </div>
    )
}

const AccessChoices = ({ value }: { value?: string }) => (
    <div>
        <span class={LABEL}>Who can add resources to this folder?</span>
        <div class="flex flex-wrap gap-3">
            <label class={CHOICE}>
                <input type="radio" name="access" value="everyone" checked={value !== 'owner'} class="text-blue-600 focus:ring-blue-500" />
                <div>
                    <span class="text-sm font-medium text-gray-700 dark:text-neutral-200">Everyone</span>
                    <p class="text-xs text-gray-400 dark:text-neutral-500">Anyone can add notes and folders</p>
                </div>
            </label>
            <label class={CHOICE}>
                <input type="radio" name="access" value="owner" checked={value === 'owner'} class="text-blue-600 focus:ring-blue-500" />
                <div>
                    <span class="text-sm font-medium text-gray-700 dark:text-neutral-200">Only me</span>
                    <p class="text-xs text-gray-400 dark:text-neutral-500">Others can still open what's inside</p>
                </div>
            </label>
        </div>
    </div>
)

// `max` is how many more files this note can take.
const FilesInput = ({ max }: { max: number }) => {
    const allowance = max === MAX_FILES_PER_NOTE ? `up to ${max} files` : `${max} more file${max === 1 ? '' : 's'}`
    return (
        <div>
            <label class={LABEL} for="res-files">Files <span class="font-normal text-gray-400 dark:text-neutral-500">(optional)</span></label>
            <input id="res-files" type="file" name="files" multiple
                onchange={`var t=0;for(var i=0;i<this.files.length;i++){if(this.files[i].size>52428800){alert('Each file can be at most 50 MB.');this.value='';return}t+=this.files[i].size}if(this.files.length>${max}){alert('You can attach ${allowance} to this note.');this.value=''}else if(t>94371840){alert('Those files are over 90 MB together. Upload some now and add the rest afterwards.');this.value=''}`}
                class="block w-full text-sm text-gray-500 dark:text-neutral-400 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 dark:file:bg-neutral-700 dark:file:text-neutral-200" />
            <p class="text-xs text-gray-500 dark:text-neutral-400 mt-1">Attach {allowance} — PDFs, images, documents, 50 MB each.</p>
        </div>
    )
}

// The page frame: navigation tree on the left, breadcrumbs and New note along the top of the main
// pane. `chain` is where the page is (it opens the tree there); `compose` turns the New note
// button on and says which folder the location picker starts on.
const Shell = (props: {
    c: Ctx; user: Viewer; title: string; tree: TreeData; chain: FolderRow[]; trailing?: string
    compose?: { selected: number } | false; narrow?: boolean; children?: any
}) => {
    const { c, user, tree, chain } = props
    const canCompose = !!props.compose && !!user && canUploadResource(user)
    return (
        <Layout title={props.title} user={user}>
            <div class="lg:flex lg:items-start lg:gap-8">
                <aside id="res-side" class="hidden lg:block w-full lg:w-72 shrink-0 max-h-80 lg:max-h-[calc(100vh-2rem)] overflow-y-auto lg:sticky lg:top-4 mb-4 lg:mb-0">
                    <a href="/resources" class="flex items-center gap-1.5 h-8 px-1 text-sm font-semibold text-gray-900 dark:text-white hover:underline">Resources</a>
                    <div data-res-tree data-mode="browse"></div>
                </aside>

                <div class={`flex-1 min-w-0 space-y-4 ${props.narrow ? 'max-w-3xl' : ''}`}>
                    <div class="flex flex-wrap items-center gap-2 min-h-8">
                        <button type="button" id="res-side-toggle" class={`${BTN_SECONDARY} lg:hidden`} title="Browse folders"><Icon name="menu" />Folders</button>
                        {/* On phones the breadcrumbs drop to their own line under the buttons. */}
                        <div class="order-last basis-full lg:order-none lg:basis-0 lg:flex-1 min-w-0"><Breadcrumbs chain={chain} trailing={props.trailing} /></div>
                        {props.compose && (
                            canCompose
                                ? <button type="button" data-panel="new-note" class={`${BTN_PRIMARY} ml-auto`}><Icon name="plus" />New note</button>
                                : !user
                                    ? <a href={loginRedirect(c)} class={`${BTN_SECONDARY} ml-auto`}>Sign in to share notes</a>
                                    : <a href="/about#application" class={`${BTN_SECONDARY} ml-auto`}>Agree to the guidelines to share notes</a>
                        )}
                    </div>

                    {canCompose && user && props.compose && (
                        <div id="new-note" class={`res-panel hidden ${PANEL} p-4 sm:p-5`}>
                            <h2 class="text-base font-bold text-gray-900 dark:text-white mb-3">New note</h2>
                            <form action="/resources/notes" method="post" enctype="multipart/form-data" class="space-y-4">
                                <input type="hidden" name="folder_id" id="res-folder-id" value="" />
                                <div class="grid gap-4 md:grid-cols-2">
                                    <div class="space-y-4">
                                        <div>
                                            <label class={LABEL} for="res-note-title">Title - e.g. My Notes on Differentiation!</label>
                                            <input id="res-note-title" type="text" name="title" required maxlength={MAX_NOTE_TITLE} class={INPUT} />
                                        </div>
                                        <div>
                                            <label class={LABEL} for="res-note-desc">Description - e.g. Some class notes from my math class 11MAX2 && my personal tips!</label>
                                            <textarea id="res-note-desc" name="description" rows={5} class={`${INPUT} resize-y`}></textarea>
                                        </div>
                                        <FilesInput max={MAX_FILES_PER_NOTE} />
                                    </div>
                                    <div>
                                        <span class={LABEL}>Where should it go?</span>
                                        <div class="rounded-lg bg-gray-50 dark:bg-neutral-900 p-1.5 h-64 overflow-y-auto" data-res-tree data-mode="pick" data-selected={String(props.compose.selected)}
                                            data-input="res-folder-id" data-label="res-location" data-submit="res-note-submit"></div>
                                        <p class="mt-2 text-xs text-gray-500 dark:text-neutral-400">
                                            Open a subject and pick Task 1–4, Trial, HSC, Unfiled or a folder inside one.
                                        </p>
                                        <p class="mt-1 flex items-center gap-1.5 text-sm text-gray-700 dark:text-neutral-300">
                                            <FolderIcon /><span id="res-location" class="min-w-0 break-words font-medium">No folder chosen yet</span>
                                        </p>
                                    </div>
                                </div>
                                <DisplayChoices user={user} />
                                <p class="text-xs text-gray-400 dark:text-neutral-500">Note: inappropiate content will be removed & you may be banned :/</p>
                                <button type="submit" id="res-note-submit" disabled class={`${BTN_PRIMARY} opacity-50 cursor-not-allowed`}><Icon name="upload" />Share note</button>
                            </form>
                        </div>
                    )}

                    {props.children}
                </div>
            </div>
            <style dangerouslySetInnerHTML={{ __html: TREE_STYLE }} />
            <script dangerouslySetInnerHTML={{ __html: `window.__resTree = ${scriptJson(tree)};` }} />
            <script dangerouslySetInnerHTML={{ __html: TREE_SCRIPT }} />
        </Layout>
    )
}

// A refused or failed action: say why, and offer the way back.
const fail = (c: Ctx, user: Viewer, status: 400 | 403 | 404 | 500, message: string, back?: { href: string; label: string }) =>
    c.html(
        <Layout title="Resources" user={user}>
            <div class="max-w-xl mx-auto">
                <div class={`${PANEL} p-6`}>
                    <h1 class="text-xl font-bold text-gray-900 dark:text-white mb-2">That didn't work</h1>
                    <p class="text-sm text-gray-700 dark:text-neutral-300">{message}</p>
                    <a href={back?.href || '/resources'} class="inline-block mt-4 text-sm text-blue-600 dark:text-blue-400 hover:underline">← {back?.label || 'Back to Resources'}</a>
                </div>
            </div>
        </Layout>,
        status
    )

// A note in a search result or the recently-added list.
const NoteResult = ({ r }: { r: any }) => (
    <div class={ROW}>
        <NoteIcon />
        <a href={noteHref(r.id)} class={ROW_NAME}>{r.title}</a>
        <div class={ROW_META}>
            <SubjectBadge subject={r.subject} />
            {r.folder_name && r.folder_kind !== 'subject' && <span class="hidden sm:inline truncate max-w-[12rem]">/ {r.folder_name}</span>}
            <span class="hidden md:inline">{renderUploaderName(r)}</span>
            <span class="hidden sm:inline local-date" data-timestamp={r.created_at}>{formatDate(r.created_at)}</span>
        </div>
    </div>
)

// The branch diagram: a folder and everything under it, drawn left to right, with its notes as the
// leaves. At most BRANCH_NOTES notes are drawn per folder; the rest become one "+N more" leaf.
// Subjects and sections are drawn open; student folders start closed (unless they lead to the
// folder being viewed) and BRANCH_SCRIPT fetches their contents from /resources/branch/:id.
const BRANCH_NOTES = 6
type BranchNode = FolderBranch<any> & { notes: { id: number; title: string }[]; more: number; weight: number }
type BranchView = { pathIds: Set<number>; currentId: number; treeLinks: boolean }

// Hang each folder's notes on it and weigh it: how many notes and student-made folders it holds.
// A folder's own note count comes from its row's note_count when the query gave one, so a closed
// folder is weighed right even though its notes were not loaded.
function growBranches(node: FolderBranch<any>, notes: { id: number; folder_id: number; title: string }[]): BranchNode {
    const byFolder = new Map<number, { id: number; title: string }[]>()
    for (const n of notes) byFolder.set(n.folder_id, [...(byFolder.get(n.folder_id) || []), n])
    const grow = (f: FolderBranch<any>): BranchNode => {
        const own = byFolder.get(f.id) || []
        const ownCount = typeof f.note_count === 'number' ? f.note_count : own.length
        const children = f.children.map(grow)
        return {
            ...f,
            children,
            notes: own.slice(0, BRANCH_NOTES),
            more: Math.max(0, ownCount - BRANCH_NOTES),
            weight: ownCount + (f.kind === 'folder' ? 1 : 0) + children.reduce((sum: number, c: BranchNode) => sum + c.weight, 0),
        }
    }
    return grow(node)
}

const branchHref = (id: number, view: BranchView) => (view.treeLinks ? `${folderHref(id)}?view=tree` : folderHref(id))
// What a folder holds, not counting itself.
const branchItems = (node: BranchNode) => node.weight - (node.kind === 'folder' ? 1 : 0)
const branchOpen = (node: BranchNode, view: BranchView) => node.kind !== 'folder' || view.pathIds.has(node.id)

// A folder's contents: its sub-folders, then its notes.
const BranchChildren = ({ node, view }: { node: BranchNode; view: BranchView }) => (
    <ul>
        {node.children.map((child: BranchNode) => <Branch node={child} view={view} />)}
        {node.notes.map((n: { id: number; title: string }) => (
            <li>
                <a href={noteHref(n.id)} class="inline-flex items-center gap-1.5 h-7 px-2 rounded-md text-xs whitespace-nowrap text-gray-600 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors">
                    <NoteIcon cls="w-3.5 h-3.5" />
                    <span class="max-w-[14rem] truncate">{n.title}</span>
                </a>
            </li>
        ))}
        {node.more > 0 && (
            <li><a href={folderHref(node.id)} class="inline-flex items-center h-7 px-2 rounded-md text-xs whitespace-nowrap text-blue-600 dark:text-blue-400 hover:underline">+{node.more} more</a></li>
        )}
    </ul>
)

const Branch = ({ node, view }: { node: BranchNode; view: BranchView }) => {
    const here = node.id === view.currentId
    const onPath = view.pathIds.has(node.id)
    const empty = node.weight === 0 && node.kind !== 'root'
    const items = branchItems(node)
    const open = branchOpen(node, view)
    return (
        <li>
            <a href={node.kind === 'root' ? '/resources' : branchHref(node.id, view)} title={node.kind === 'folder' && node.access === 'owner' ? 'Only the owner can add to this folder' : undefined}
                class={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-sm whitespace-nowrap transition-colors ${here
                    ? 'bg-blue-50 dark:bg-blue-900/30 font-semibold text-gray-900 dark:text-white'
                    : onPath
                        ? 'bg-gray-100 dark:bg-neutral-700 font-medium text-gray-900 dark:text-white'
                        : `${empty ? 'text-gray-400 dark:text-neutral-500' : 'text-gray-800 dark:text-neutral-200'} hover:bg-gray-100 dark:hover:bg-neutral-700`}`}>
                <span class={empty ? 'opacity-60' : ''}><FolderIcon f={node} /></span>
                <span>{folderLabel(node)}</span>
                {node.kind === 'folder' && node.access === 'owner' && <span class="text-gray-400"><Icon name="lock" cls="w-3 h-3" /></span>}
            </a>
            {!open && items > 0 && (
                <button type="button" data-branch={node.id} data-tree={view.treeLinks ? '1' : undefined} aria-expanded="false"
                    title={`Show what is in this folder (${plural(items, 'item')})`}
                    class="relative z-10 inline-flex items-center gap-0.5 h-6 ml-0.5 px-1.5 rounded text-xs text-gray-500 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-700 hover:text-gray-800 dark:hover:text-neutral-200">
                    <svg class="res-branch-chev w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7" /></svg>
                    {items}
                </button>
            )}
            {open && (node.children.length > 0 || node.notes.length > 0) && <BranchChildren node={node} view={view} />}
        </li>
    )
}

// Opens and closes student folders in a branch diagram, fetching a folder's contents the first time.
const BRANCH_SCRIPT = `
document.addEventListener('click', async (e) => {
    const btn = e.target.closest && e.target.closest('button[data-branch]');
    if (!btn) return;
    e.preventDefault();
    const li = btn.parentElement;
    let list = li.querySelector(':scope > ul');
    if (btn.getAttribute('aria-expanded') === 'true') {
        if (list) list.hidden = true;
        btn.setAttribute('aria-expanded', 'false');
        return;
    }
    if (!list) {
        if (btn.dataset.loading) return;
        btn.dataset.loading = '1';
        try {
            const res = await fetch('/resources/branch/' + btn.dataset.branch + (btn.dataset.tree ? '?view=tree' : ''));
            if (!res.ok) throw new Error(String(res.status));
            li.insertAdjacentHTML('beforeend', await res.text());
            list = li.querySelector(':scope > ul');
        } catch (err) {
            btn.title = 'Could not load this folder. Try again.';
            return;
        } finally {
            delete btn.dataset.loading;
        }
    }
    if (list) list.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
});
`

// What BRANCH_SCRIPT inserts when a closed folder is opened: that folder's contents, with its own
// sub-folders closed.
app.get('/resources/branch/:id{[0-9]+}', async (c) => {
    const user = await getUser(c) as Viewer
    const db = c.env.DB
    const id = parseId(c.req.param('id'))
    const chain = await loadChain(db, id)
    if (chain.length === 0 || !canSeeChain(user, chain)) return c.text('That folder does not exist.', 404)
    const [folders, notes] = await Promise.all([rows(db, subtreeFoldersQuery(id)), rows(db, treeNotesQuery([id]))])
    const nested = buildFolderTree(folders, id)
    if (!nested) return c.text('That folder does not exist.', 404)
    const view: BranchView = { pathIds: new Set(), currentId: 0, treeLinks: c.req.query('view') === 'tree' }
    c.header('cache-control', 'private, no-store')
    return c.html(<BranchChildren node={growBranches(nested, notes)} view={view} />)
})

const viewTab = (on: boolean) => `inline-flex items-center gap-1.5 h-7 px-2.5 rounded text-xs font-medium transition-colors ${on
    ? 'bg-white dark:bg-neutral-800 text-gray-900 dark:text-white shadow-sm'
    : 'text-gray-500 dark:text-neutral-400 hover:text-gray-700 dark:hover:text-neutral-200'}`

// ---------------------------------------------------------------------------------------------
// Browsing
// ---------------------------------------------------------------------------------------------

app.get('/resources', async (c) => {
    const user = await getUser(c) as Viewer
    const db = c.env.DB
    const roots = await loadRoots(db)

    // Old links: /resources?subject=Physics
    const subjectParam = c.req.query('subject')
    if (subjectParam) {
        const match = roots.find((f) => f.kind === 'subject' && f.subject === subjectParam)
        if (match) return c.redirect(folderHref(match.id))
    }

    const search = (c.req.query('q') || '').trim().slice(0, 100)
    const subjects = sortSubjects(roots.filter((f) => f.kind === 'subject'))
    const trash = roots.find((f) => f.kind === 'trash')
    const admin = isAdmin(user)

    // The front page opens on the branch diagram of everything; ?view=list gives the plain subject list.
    const treeView = !search && c.req.query('view') !== 'list'
    const [counts, notes, removed, tree, liveFolders, liveNotes] = await Promise.all([
        db.prepare(SUBJECT_COUNTS_SQL).all<{ subject: string; notes: number }>(),
        rows(db, notesQuery(search ? { search, limit: 100 } : { limit: 8 })),
        admin && trash
            ? db.prepare('SELECT (SELECT COUNT(*) FROM resource_folders WHERE parent_id = ?) + (SELECT COUNT(*) FROM resources WHERE folder_id = ?) AS n')
                .bind(trash.id, trash.id).first<{ n: number }>()
            : null,
        treeData(db, user, [], 0, roots),
        treeView ? db.prepare(LIVE_FOLDERS_SQL).all<any>().then((r) => r.results) : Promise.resolve([] as any[]),
        treeView ? db.prepare(LIVE_TOP_NOTES_SQL).all<any>().then((r) => r.results) : Promise.resolve([] as any[]),
    ])
    const noteCount = new Map(counts.results.map((r) => [r.subject, r.notes]))

    // One root, "Resources", with the subjects as its first branches: those holding something
    // first and fully drawn, the empty ones after them as bare ends.
    let branches: BranchNode | null = null
    if (treeView) {
        const rootRow = { id: 0, parent_id: null, name: 'Resources', kind: 'root', subject: null }
        const nested = buildFolderTree([rootRow, ...liveFolders.map((f) => ({ ...f, parent_id: f.parent_id ?? 0 }))], 0)
        if (nested) {
            branches = growBranches(nested, liveNotes)
            const order = new Map(subjects.map((f, i) => [f.id, i]))
            branches.children = branches.children
                .map((subject: BranchNode) => (subject.weight === 0 ? { ...subject, children: [] } : subject))
                .sort((a: BranchNode, b: BranchNode) => Number(b.weight > 0) - Number(a.weight > 0) || (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
        }
    }

    return c.html(
        <Shell c={c} user={user} title="Resources" tree={tree} chain={[]} compose={{ selected: 0 }}>
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Resources</h1>
                    <p class="text-sm text-gray-500 dark:text-neutral-400">Notes shared by students, filed by subject and assessment task.</p>
                </div>
                <form action="/resources" method="get" class="relative w-full sm:w-72">
                    <input type="search" name="q" value={search} placeholder="Search all notes..." class={`${INPUT} pl-9`} />
                    <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Icon name="search" /></span>
                </form>
            </div>

            {search ? (
                <div>
                    <div class="flex items-center justify-between gap-3 h-9 px-2 text-sm text-gray-500 dark:text-neutral-400">
                        <span>{plural(notes.length, 'note')} matching "{search}"</span>
                        <a href="/resources" class="text-blue-600 dark:text-blue-400 hover:underline">Clear search</a>
                    </div>
                    {notes.length === 0
                        ? <div class="py-10 text-center text-sm text-gray-500 dark:text-neutral-400">No notes match that search.</div>
                        : notes.map((r) => <NoteResult r={r} />)}
                </div>
            ) : (
                <>
                    <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
                        <div class="inline-flex items-center gap-0.5 p-0.5 rounded-md bg-gray-100 dark:bg-neutral-900">
                            <a href="/resources" class={viewTab(treeView)}><Icon name="branch" cls="w-3.5 h-3.5" />Tree</a>
                            <a href="/resources?view=list" class={viewTab(!treeView)}><Icon name="list" cls="w-3.5 h-3.5" />List</a>
                        </div>
                        <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-neutral-400">
                            <span class="inline-flex items-center gap-1"><FolderIcon kind="section" />Task folder</span>
                            <span class="inline-flex items-center gap-1"><FolderIcon kind="folder" />Student folder</span>
                            <span class="inline-flex items-center gap-1"><NoteIcon />Note</span>
                        </div>
                    </div>

                    {treeView && branches ? (
                        <div class="overflow-x-auto pb-3">
                            <ul class="htree htree-top w-max text-gray-300 dark:text-neutral-600">
                                <Branch node={branches} view={{ pathIds: new Set([0]), currentId: 0, treeLinks: false }} />
                            </ul>
                            <script dangerouslySetInnerHTML={{ __html: BRANCH_SCRIPT }} />
                        </div>
                    ) : (
                    <div>
                        <div class="flex items-center justify-between gap-3 h-9 px-2">
                            <h2 class="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-neutral-400">Subjects</h2>
                            <input type="search" id="res-filter" placeholder="Filter subjects..." class="w-40 sm:w-56 h-7 px-2.5 rounded-md border border-gray-300 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white text-sm outline-none focus:border-blue-500" />
                        </div>
                        {subjects.map((f) => {
                            const n = noteCount.get(f.subject || '') || 0
                            return (
                                <div class="res-row" data-name={folderLabel(f).toLowerCase()}>
                                    <a href={folderHref(f.id)} class={ROW}>
                                        <FolderIcon f={f} />
                                        <span class="min-w-0 truncate text-sm text-gray-900 dark:text-white">{folderLabel(f)}</span>
                                        <span class={`ml-auto pl-3 shrink-0 text-xs ${n ? 'text-gray-600 dark:text-neutral-300' : 'text-gray-400 dark:text-neutral-500'}`}>{n ? plural(n, 'note') : 'Empty'}</span>
                                    </a>
                                </div>
                            )
                        })}
                        {admin && trash && (
                            <div class="res-row" data-name="removed">
                                <a href={folderHref(trash.id)} class={ROW}>
                                    <FolderIcon kind="trash" />
                                    <span class="min-w-0 truncate text-sm text-gray-900 dark:text-white">Removed</span>
                                    <span class="ml-auto pl-3 shrink-0 text-xs text-gray-500 dark:text-neutral-400">{plural(removed?.n || 0, 'item')} · admins only</span>
                                </a>
                            </div>
                        )}
                        <div id="res-filter-empty" hidden class="py-8 text-center text-sm text-gray-500 dark:text-neutral-400">No subjects match.</div>
                    </div>
                    )}

                    <div>
                        <h2 class="h-9 px-2 flex items-center text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-neutral-400">Recently added</h2>
                        {notes.length === 0
                            ? <div class="py-8 text-center text-sm text-gray-500 dark:text-neutral-400">Nothing has been shared yet.</div>
                            : notes.map((r) => <NoteResult r={r} />)}
                    </div>
                </>
            )}
        </Shell>
    )
})

app.get('/resources/removed', async (c) => {
    const user = await getUser(c) as Viewer
    if (!user) return c.redirect(loginRedirect(c))
    if (!isAdmin(user)) return c.notFound()
    return c.redirect(folderHref(await trashId(c.env.DB)))
})

app.get('/resources/folder/:id{[0-9]+}', async (c) => {
    const user = await getUser(c) as Viewer
    const db = c.env.DB
    const id = parseId(c.req.param('id'))
    const chain = await loadChain(db, id)
    if (chain.length === 0 || !canSeeChain(user, chain)) return c.notFound()

    const folder = chain[chain.length - 1]
    const treeView = c.req.query('view') === 'tree'
    const [folders, notes, files, tree, branchRows, branchNotes] = await Promise.all([
        rows(db, childFoldersQuery(id)),
        rows(db, folderNotesQuery(id)),
        rows(db, folderFilesQuery(id)),
        treeData(db, user, chain),
        treeView ? rows(db, subtreeFoldersQuery(chain[0].id)) : Promise.resolve([] as any[]),
        treeView ? rows(db, subtreeNotesQuery(chain[0].id)) : Promise.resolve([] as any[]),
    ])
    const filesByNote = new Map<number, any[]>()
    for (const f of files) filesByNote.set(f.resource_id, [...(filesByNote.get(f.resource_id) || []), f])
    const nested = treeView ? buildFolderTree(branchRows, chain[0].id) : null
    const branches = nested ? growBranches(nested, branchNotes) : null

    const inTrash = chainInTrash(chain)
    const isTrash = folder.kind === 'trash'
    const addError = addToFolderError(user, chain)
    const owner = folder.kind === 'folder'
        ? await db.prepare('SELECT first_name, last_name FROM users WHERE id = ?').bind(folder.creator_id).first<any>()
        : null
    const count = folders.length + notes.length

    return c.html(
        <Shell c={c} user={user} title={`${folderLabel(folder)} - Resources`} tree={tree} chain={chain} compose={inTrash ? false : { selected: addError ? 0 : id }}>
            <div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                <div class="min-w-0">
                    <h1 class="flex items-center gap-2 text-xl font-bold text-gray-900 dark:text-white">
                        <FolderIcon f={folder} cls="w-6 h-6" />
                        <span class="break-words min-w-0">{folderLabel(folder)}</span>
                    </h1>
                    <p class="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500 dark:text-neutral-400">
                        {isTrash && <span>Removed notes and folders. Only admins can see this folder.</span>}
                        {inTrash && !isTrash && <span class="font-bold uppercase tracking-wide text-red-600 dark:text-red-400">Removed</span>}
                        {folder.kind === 'folder' && <><span>Folder by {ownerName({ ...folder, ...owner }, user)}</span><Dot /></>}
                        {folder.kind === 'folder' && folder.access === 'owner' && (
                            <><span class="inline-flex items-center gap-1"><Icon name="lock" cls="w-3.5 h-3.5" />Only the owner can add here</span><Dot /></>
                        )}
                        {!isTrash && <span>{count === 0 ? 'Empty' : [folders.length && plural(folders.length, 'folder'), notes.length && plural(notes.length, 'note')].filter(Boolean).join(', ')}</span>}
                    </p>
                </div>
                <div class="flex flex-wrap items-center gap-1.5">
                    {!addError && <button type="button" data-panel="new-folder" class={BTN_SECONDARY}><Icon name="plus" />New folder</button>}
                    {canEditFolder(user, chain) && <a href={`/resources/folders/${id}/edit`} class={BTN_SECONDARY}><Icon name="pencil" />Rename</a>}
                    {canMoveFolder(user, chain) && <a href={`/resources/move/folder/${id}`} class={BTN_SECONDARY}><Icon name="move" />Move</a>}
                    {removeFolderError(user, chain, 0) === null && (
                        <form action={`/resources/folders/${id}/remove`} method="post" onsubmit="return confirm('Remove this folder and everything in it?')">
                            <button type="submit" class={BTN_DANGER}><Icon name="trash" />Remove</button>
                        </form>
                    )}
                </div>
            </div>

            {!addError && user && (
                <div id="new-folder" class={`res-panel hidden ${PANEL} p-4 sm:p-5`}>
                    <h2 class="text-base font-bold text-gray-900 dark:text-white mb-3">New folder in {folderLabel(folder)}</h2>
                    <form action={`/resources/folder/${id}/folders`} method="post" class="space-y-4">
                        <div>
                            <label class={LABEL} for="res-folder-name">Name</label>
                            <input id="res-folder-name" type="text" name="name" required maxlength={MAX_FOLDER_NAME} placeholder={`e.g. ${user.first_name}'s folder`} class={INPUT} />
                        </div>
                        <AccessChoices />
                        <p class="text-xs text-gray-500 dark:text-neutral-400">You can have one empty folder at a time, so add something to this one before making another.</p>
                        <button type="submit" class={BTN_PRIMARY}>Create folder</button>
                    </form>
                </div>
            )}

            <div class="flex flex-wrap items-center justify-between gap-2">
                <div class="inline-flex items-center gap-0.5 p-0.5 rounded-md bg-gray-100 dark:bg-neutral-900">
                    <a href={folderHref(id)} class={viewTab(!treeView)}><Icon name="list" cls="w-3.5 h-3.5" />List</a>
                    <a href={`${folderHref(id)}?view=tree`} class={viewTab(treeView)}><Icon name="branch" cls="w-3.5 h-3.5" />Tree</a>
                </div>
                {!treeView && count > 5 && (
                    <input type="search" id="res-filter" placeholder="Filter this folder..." class="w-full sm:w-56 h-7 px-2.5 rounded-md border border-gray-300 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white text-sm outline-none focus:border-blue-500" />
                )}
            </div>

            {treeView && branches ? (
                <div class="overflow-x-auto pb-3">
                    <ul class="htree w-max text-gray-300 dark:text-neutral-600">
                        <Branch node={branches} view={{ pathIds: new Set(chain.map((f) => f.id)), currentId: id, treeLinks: true }} />
                    </ul>
                    <script dangerouslySetInnerHTML={{ __html: BRANCH_SCRIPT }} />
                </div>
            ) : count === 0 ? (
                <div class="py-10 px-4 text-center text-sm text-gray-500 dark:text-neutral-400">
                    {isTrash ? 'Nothing has been removed.' : addError ? 'This folder is empty.' : 'This folder is empty. Add a note or a folder to get it started.'}
                </div>
            ) : (
                <div>
                    {folders.map((f: any) => {
                        const childChain = [...chain, f as FolderRow]
                        const holds = [f.folder_count && plural(f.folder_count, 'folder'), f.note_count && plural(f.note_count, 'note')].filter(Boolean).join(', ') || 'Empty'
                        return (
                            <div class="res-row" data-name={String(f.name).toLowerCase()}>
                                <div class={ROW}>
                                    {notes.length > 0 && <span class="w-4 shrink-0"></span>}
                                    <FolderIcon f={f} />
                                    <a href={folderHref(f.id)} class={ROW_NAME}>{f.name}</a>
                                    {f.kind === 'folder' && f.access === 'owner' && (
                                        <span class="shrink-0 text-gray-400" title="Only the owner can add to this folder"><Icon name="lock" cls="w-3 h-3" /></span>
                                    )}
                                    <div class={ROW_META}>
                                        {isTrash && <span class="hidden md:inline">removed from {f.removed_from_name || 'a deleted folder'}</span>}
                                        {f.kind === 'folder' && <span class="hidden sm:inline">by {ownerName(f, user)}</span>}
                                        <span>{holds}</span>
                                        <div class="flex items-center">
                                            {isTrash && (
                                                <form action={`/resources/folders/${f.id}/restore`} method="post" class="flex">
                                                    <button type="submit" class={ROW_ACTION} title="Restore"><Icon name="restore" /></button>
                                                </form>
                                            )}
                                            {canEditFolder(user, childChain) && <a href={`/resources/folders/${f.id}/edit`} class={ROW_ACTION} title="Rename"><Icon name="pencil" /></a>}
                                            {canMoveFolder(user, childChain) && <a href={`/resources/move/folder/${f.id}`} class={ROW_ACTION} title="Move"><Icon name="move" /></a>}
                                            {removeFolderError(user, childChain, 0) === null && (
                                                <form action={`/resources/folders/${f.id}/remove`} method="post" class="flex" onsubmit="return confirm('Remove this folder and everything in it?')">
                                                    <button type="submit" class={ROW_ACTION_DANGER} title="Remove"><Icon name="trash" /></button>
                                                </form>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                    {notes.map((r: any) => {
                        const attached = filesByNote.get(r.id) || []
                        return (
                            <details class="res-row" data-name={String(r.title).toLowerCase()}>
                                <summary class={`${ROW} cursor-pointer list-none`}>
                                    <span class={`res-chevron w-4 shrink-0 text-gray-400 ${attached.length ? '' : 'invisible'}`} title="Show attached files"><Icon name="chevron" /></span>
                                    <NoteIcon />
                                    <a href={noteHref(r.id)} class={ROW_NAME}>{r.title}</a>
                                    <div class={ROW_META}>
                                        {isTrash && <span class="hidden md:inline">removed from {r.removed_from_name || 'a deleted folder'}</span>}
                                        <span class="hidden sm:inline">{renderUploaderName(r)}</span>
                                        <span class="hidden md:inline local-date" data-timestamp={r.created_at}>{formatDate(r.created_at)}</span>
                                        <span>{plural(attached.length, 'file')}</span>
                                        <div class="flex items-center">
                                            {isTrash && (
                                                <form action={`/resources/${r.id}/restore`} method="post" class="flex">
                                                    <button type="submit" class={ROW_ACTION} title="Restore"><Icon name="restore" /></button>
                                                </form>
                                            )}
                                            {canEditNote(user, r, chain) && <a href={`/resources/${r.id}/edit`} class={ROW_ACTION} title="Edit"><Icon name="pencil" /></a>}
                                            {canMoveNote(user, r, chain) && <a href={`/resources/move/note/${r.id}`} class={ROW_ACTION} title="Move"><Icon name="move" /></a>}
                                            {canRemoveNote(user, r, chain) && (
                                                <form action={`/resources/${r.id}/delete`} method="post" class="flex" onsubmit="return confirm('Remove this note?')">
                                                    <button type="submit" class={ROW_ACTION_DANGER} title="Remove"><Icon name="trash" /></button>
                                                </form>
                                            )}
                                        </div>
                                    </div>
                                </summary>
                                {attached.map((f: any) => (
                                    <a href={`/download/${f.file_key}?id=${r.id}`} target="_blank" class={`${ROW} pl-14`}>
                                        <FileIcon name={f.file_name} />
                                        <span class="min-w-0 truncate text-sm text-gray-700 dark:text-neutral-300">{f.file_name}</span>
                                        <span class="ml-auto pl-3 shrink-0 text-xs text-gray-400 dark:text-neutral-500">{formatBytes(f.size)}</span>
                                    </a>
                                ))}
                            </details>
                        )
                    })}
                    <div id="res-filter-empty" hidden class="py-8 text-center text-sm text-gray-500 dark:text-neutral-400">Nothing in this folder matches.</div>
                </div>
            )}
        </Shell>
    )
})

// ---------------------------------------------------------------------------------------------
// Folders: create, rename, remove, restore
// ---------------------------------------------------------------------------------------------

app.post('/resources/folder/:id{[0-9]+}/folders', async (c) => {
    const user = await getUser(c) as Viewer
    if (!user) return c.redirect(loginRedirect(c))
    const db = c.env.DB
    const parentId = parseId(c.req.param('id'))
    const chain = await loadChain(db, parentId)
    if (chain.length === 0 || !canSeeChain(user, chain)) return c.notFound()
    const back = { href: folderHref(parentId), label: `Back to ${folderLabel(chain[chain.length - 1])}` }

    const addError = addToFolderError(user, chain)
    if (addError) return fail(c, user, 403, addError, back)
    if (chain.length + 1 > MAX_CHAIN) return fail(c, user, 400, 'Folders cannot be nested that deeply.', back)

    const body = await c.req.parseBody()
    const cleaned = cleanFolderName(body['name'])
    if ('error' in cleaned) return fail(c, user, 400, cleaned.error, back)

    const res = await stmt(db, createFolderStatement({ parentId, name: cleaned.name, access: cleanAccess(body['access']), userId: user.id })).run()
    if (!res.meta.changes) {
        const [empty] = await rows<{ id: number; name: string }>(db, emptyFoldersQuery(user.id))
        return fail(
            c, user, 400,
            `You already have an empty folder${empty ? ` ("${empty.name}")` : ''}. Add something to it, or remove it, before creating another.`,
            empty ? { href: folderHref(empty.id), label: `Open ${empty.name}` } : back
        )
    }

    const newId = Number(res.meta.last_row_id)
    await logAction(db, user.id, 'CREATE_RESOURCE_FOLDER', `Created folder '${cleaned.name}' in folder ${parentId}`, newId, 'resource_folders')
    return c.redirect(folderHref(newId))
})

app.get('/resources/folders/:id{[0-9]+}/edit', async (c) => {
    const user = await getUser(c) as Viewer
    if (!user) return c.redirect(loginRedirect(c))
    const id = parseId(c.req.param('id'))
    const chain = await loadChain(c.env.DB, id)
    if (chain.length === 0 || !canSeeChain(user, chain)) return c.notFound()
    const folder = chain[chain.length - 1]
    if (!canEditFolder(user, chain)) {
        return fail(c, user, 403, folder.kind === 'folder' ? 'Only the owner of this folder can rename it.' : 'This folder cannot be renamed.', { href: folderHref(id), label: `Back to ${folderLabel(folder)}` })
    }
    const tree = await treeData(c.env.DB, user, chain)

    return c.html(
        <Shell c={c} user={user} title="Rename folder" tree={tree} chain={chain} narrow>
            <div class={`${PANEL} p-5 sm:p-8`}>
                <h1 class="text-xl font-bold text-gray-900 dark:text-white mb-6">Rename folder</h1>
                <form action={`/resources/folders/${id}/edit`} method="post" class="space-y-5">
                    <div>
                        <label class={LABEL} for="res-folder-name">Name</label>
                        <input id="res-folder-name" type="text" name="name" value={folder.name} required maxlength={MAX_FOLDER_NAME} class={INPUT} />
                    </div>
                    <AccessChoices value={folder.access} />
                    <div class="flex gap-3 pt-2">
                        <a href={folderHref(id)} class={BTN_SECONDARY}>Cancel</a>
                        <button type="submit" class={BTN_PRIMARY}>Save changes</button>
                    </div>
                </form>
            </div>
        </Shell>
    )
})

app.post('/resources/folders/:id{[0-9]+}/edit', async (c) => {
    const user = await getUser(c) as Viewer
    if (!user) return c.redirect(loginRedirect(c))
    const db = c.env.DB
    const id = parseId(c.req.param('id'))
    const chain = await loadChain(db, id)
    if (chain.length === 0 || !canSeeChain(user, chain)) return c.notFound()
    const folder = chain[chain.length - 1]
    const back = { href: folderHref(id), label: `Back to ${folderLabel(folder)}` }
    if (!canEditFolder(user, chain)) {
        return fail(c, user, 403, folder.kind === 'folder' ? 'Only the owner of this folder can rename it.' : 'This folder cannot be renamed.', back)
    }

    const body = await c.req.parseBody()
    const cleaned = cleanFolderName(body['name'])
    if ('error' in cleaned) return fail(c, user, 400, cleaned.error, { href: `/resources/folders/${id}/edit`, label: 'Back' })

    await db.prepare(`UPDATE resource_folders SET name = ?, access = ? WHERE id = ? AND kind = 'folder'`)
        .bind(cleaned.name, cleanAccess(body['access']), id).run()
    await logAction(db, user.id, 'EDIT_RESOURCE_FOLDER', `Renamed folder '${folder.name}' to '${cleaned.name}' (${id})`, id, 'resource_folders')
    return c.redirect(folderHref(id))
})

app.post('/resources/folders/:id{[0-9]+}/remove', async (c) => {
    const user = await getUser(c) as Viewer
    if (!user) return c.redirect(loginRedirect(c))
    const db = c.env.DB
    const id = parseId(c.req.param('id'))
    const chain = await loadChain(db, id)
    if (chain.length === 0 || !canSeeChain(user, chain)) return c.notFound()
    const folder = chain[chain.length - 1]

    const [stats] = await rows<{ foreign_folders: number; foreign_notes: number }>(db, subtreeStatsQuery(id, user.id))
    const error = removeFolderError(user, chain, (stats?.foreign_folders || 0) + (stats?.foreign_notes || 0))
    if (error) return fail(c, user, 403, error, { href: folderHref(id), label: `Back to ${folderLabel(folder)}` })

    await stmt(db, removeFolderStatement(id, await trashId(db), user.id)).run()
    await logAction(db, user.id, 'DELETE_RESOURCE_FOLDER', `Removed folder '${folder.name}' (${id})`, id, 'resource_folders')
    return c.redirect(folder.parent_id ? folderHref(folder.parent_id) : '/resources')
})

app.post('/resources/folders/:id{[0-9]+}/restore', async (c) => {
    const user = await getUser(c) as Viewer
    if (!user) return c.redirect(loginRedirect(c))
    if (!isAdmin(user)) return c.notFound()
    const db = c.env.DB
    const id = parseId(c.req.param('id'))
    const chain = await loadChain(db, id)
    const folder = chain[chain.length - 1]
    if (!folder || folder.kind !== 'folder') return c.notFound()
    const back = { href: folderHref(id), label: `Back to ${folder.name}` }
    if (!chainInTrash(chain)) return fail(c, user, 400, 'This folder has not been removed.', back)

    const row = await db.prepare('SELECT removed_from_id FROM resource_folders WHERE id = ?').bind(id).first<{ removed_from_id: number | null }>()
    const destChain = row?.removed_from_id ? await loadChain(db, row.removed_from_id) : []
    if (destChain.length === 0 || chainInTrash(destChain)) {
        return fail(c, user, 400, 'The folder this came from has been removed too. Use Move to put it somewhere else.', { href: `/resources/move/folder/${id}`, label: 'Choose a folder' })
    }

    const dest = destChain[destChain.length - 1]
    await db.batch(moveFolderStatements(id, dest.id, chainSubject(destChain)).map((s) => stmt(db, s)))
    await logAction(db, user.id, 'RESTORE_RESOURCE_FOLDER', `Restored folder '${folder.name}' (${id}) to folder ${dest.id}`, id, 'resource_folders')
    return c.redirect(folderHref(dest.id))
})

// ---------------------------------------------------------------------------------------------
// Moving notes and folders
// ---------------------------------------------------------------------------------------------

// What is being moved, and whether this user may move it at all.
async function loadMovable(db: D1Database, user: Viewer, kind: string, id: number) {
    if (kind === 'note') {
        const note = await loadNote(db, id)
        if (!note) return null
        const chain = note.folder_id ? await loadChain(db, note.folder_id) : []
        if (!canSeeChain(user, chain)) return null
        return {
            kind: 'note' as const, id, name: note.title as string, fromId: (note.folder_id ?? null) as number | null, fromChain: chain,
            removedFromId: (note.removed_from_id ?? null) as number | null, allowed: canMoveNote(user, note, chain), href: noteHref(id), height: 1,
        }
    }
    const chain = await loadChain(db, id)
    const folder = chain[chain.length - 1]
    if (!folder || !canSeeChain(user, chain)) return null
    const [row, stats] = await Promise.all([
        db.prepare('SELECT removed_from_id FROM resource_folders WHERE id = ?').bind(id).first<{ removed_from_id: number | null }>(),
        rows<{ height: number }>(db, subtreeStatsQuery(id, user?.id || 0)),
    ])
    return {
        kind: 'folder' as const, id, name: folderLabel(folder), fromId: folder.parent_id, fromChain: chain.slice(0, -1),
        removedFromId: row?.removed_from_id ?? null, allowed: canMoveFolder(user, chain), href: folderHref(id), height: stats[0]?.height || 1,
    }
}

app.get('/resources/move/:kind{note|folder}/:id{[0-9]+}', async (c) => {
    const user = await getUser(c) as Viewer
    if (!user) return c.redirect(loginRedirect(c))
    const db = c.env.DB
    const item = await loadMovable(db, user, c.req.param('kind'), parseId(c.req.param('id')))
    if (!item) return c.notFound()
    const back = { href: item.href, label: `Back to ${item.name}` }
    if (!item.allowed) return fail(c, user, 403, `You cannot move this ${item.kind}.`, back)

    // Start where the item is now; a removed item starts where it was removed from.
    const removed = chainInTrash(item.fromChain)
    const atParam = c.req.query('at')
    let at = atParam !== undefined ? parseId(atParam) : (removed ? item.removedFromId : item.fromId) || 0
    let atChain = at ? await loadChain(db, at) : []
    if (atChain.length === 0 || chainInTrash(atChain)) {
        at = 0
        atChain = []
    }

    const [folders, tree] = await Promise.all([
        at
            ? rows(db, childFoldersQuery(at)).then((list) => list.filter((f: any) => !(item.kind === 'folder' && f.id === item.id)))
            : loadRoots(db).then((roots) => sortSubjects(roots.filter((f) => f.kind === 'subject')) as any[]),
        treeData(db, user, item.fromChain, item.kind === 'note' ? item.id : 0),
    ])
    const error = at
        ? moveError({ user, kind: item.kind, itemId: item.id, fromFolderId: item.fromId, destChain: atChain, subtreeHeight: item.height })
        : 'Open a subject, then choose a folder inside it.'
    const pickHref = (folderId: number) => `/resources/move/${item.kind}/${item.id}?at=${folderId}`

    return c.html(
        <Shell c={c} user={user} title={`Move ${item.name}`} tree={tree} chain={item.fromChain} trailing={item.name} narrow>
            <div>
                <h1 class="flex items-center gap-2 text-xl font-bold text-gray-900 dark:text-white">
                    {item.kind === 'folder' ? <FolderIcon cls="w-6 h-6" /> : <NoteIcon cls="w-6 h-6" />}
                    <span class="break-words min-w-0">Move "{item.name}"</span>
                </h1>
                <p class="mt-0.5 text-xs text-gray-500 dark:text-neutral-400">Open the folder you want it in, then choose Move here.</p>
            </div>

            <div>
                <div class="flex items-center h-9 px-2">
                    <Breadcrumbs chain={atChain} hrefFor={pickHref} rootHref={`/resources/move/${item.kind}/${item.id}?at=0`} rootLabel="All subjects" />
                </div>
                {folders.length === 0
                    ? <div class="py-8 text-center text-sm text-gray-500 dark:text-neutral-400">No folders in here.</div>
                    : folders.map((f: any) => (
                        <a href={pickHref(f.id)} class={ROW}>
                            <FolderIcon f={f} />
                            <span class="min-w-0 truncate text-sm text-gray-900 dark:text-white">{folderLabel(f)}</span>
                            {f.kind === 'folder' && f.access === 'owner' && <span class="shrink-0 text-gray-400" title="Only the owner can add to this folder"><Icon name="lock" cls="w-3 h-3" /></span>}
                            <span class="ml-auto shrink-0 text-gray-300 dark:text-neutral-600"><Icon name="chevron" /></span>
                        </a>
                    ))}
            </div>

            <form action={`/resources/move/${item.kind}/${item.id}`} method="post" class="flex flex-wrap items-center gap-3">
                <input type="hidden" name="dest" value={String(at)} />
                <a href={item.href} class={BTN_SECONDARY}>Cancel</a>
                <button type="submit" disabled={!!error} class={`${BTN_PRIMARY} ${error ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    <Icon name="move" />Move here{at ? ` (${folderLabel(atChain[atChain.length - 1])})` : ''}
                </button>
                {error && <span class="text-xs text-gray-500 dark:text-neutral-400">{error}</span>}
            </form>
        </Shell>
    )
})

app.post('/resources/move/:kind{note|folder}/:id{[0-9]+}', async (c) => {
    const user = await getUser(c) as Viewer
    if (!user) return c.redirect(loginRedirect(c))
    const db = c.env.DB
    const item = await loadMovable(db, user, c.req.param('kind'), parseId(c.req.param('id')))
    if (!item) return c.notFound()
    const back = { href: `/resources/move/${item.kind}/${item.id}`, label: 'Choose another folder' }
    if (!item.allowed) return fail(c, user, 403, `You cannot move this ${item.kind}.`, { href: item.href, label: `Back to ${item.name}` })

    const body = await c.req.parseBody()
    const destId = parseId(body['dest'])
    const destChain = destId ? await loadChain(db, destId) : []
    const error = moveError({ user, kind: item.kind, itemId: item.id, fromFolderId: item.fromId, destChain, subtreeHeight: item.height })
    if (error) return fail(c, user, 400, error, back)

    const subject = chainSubject(destChain)
    if (item.kind === 'note') {
        await stmt(db, moveNoteStatement(item.id, destId, subject)).run()
        await logAction(db, user.id, 'MOVE_RESOURCE', `Moved resource '${item.name}' (${item.id}) from folder ${item.fromId} to folder ${destId}`, item.id, 'resources')
    } else {
        await db.batch(moveFolderStatements(item.id, destId, subject).map((s) => stmt(db, s)))
        await logAction(db, user.id, 'MOVE_RESOURCE_FOLDER', `Moved folder '${item.name}' (${item.id}) from folder ${item.fromId} to folder ${destId}`, item.id, 'resource_folders')
    }
    return c.redirect(folderHref(destId))
})

// ---------------------------------------------------------------------------------------------
// Notes: create, view, edit, files, remove, restore
// ---------------------------------------------------------------------------------------------

// Store uploaded files in R2 and return the rows to insert for them.
async function storeFiles(c: Ctx, files: File[], noteId: number, userId: number): Promise<Statement[]> {
    const now = Date.now()
    const inserts: Statement[] = []
    for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const key = fileKey(file.name, now, i)
        await c.env.BUCKET.put(key, file, { httpMetadata: { contentType: file.type || 'application/octet-stream' } })
        inserts.push({
            sql: 'INSERT INTO resource_files (resource_id, file_key, file_name, size, uploader_id) VALUES (?, ?, ?, ?, ?)',
            params: [noteId, key, file.name.slice(0, 200), file.size, userId],
        })
    }
    return inserts
}

const displayChoice = (raw: unknown) => (raw === 'anonymous' || raw === 'full' ? raw : 'initials')

// The New note form, from any resources page. The folder comes from its location picker.
app.post('/resources/notes', async (c) => {
    const user = await getUser(c) as Viewer
    if (!user) return c.redirect(loginRedirect(c))
    const db = c.env.DB

    try {
        const body = await c.req.parseBody({ all: true })
        const folderId = parseId(body['folder_id'])
        const chain = folderId ? await loadChain(db, folderId) : []
        if (chain.length === 0 || !canSeeChain(user, chain)) return fail(c, user, 400, 'Choose a folder for the note.')
        const back = { href: folderHref(folderId), label: `Back to ${folderLabel(chain[chain.length - 1])}` }

        const addError = addToFolderError(user, chain)
        if (addError) return fail(c, user, 403, addError, back)

        const title = text(body['title']).trim().slice(0, MAX_NOTE_TITLE)
        const description = text(body['description'])
        const files = uploadedFiles(body['files'])
        if (!title) return fail(c, user, 400, 'Give the note a title.', back)
        const filesError = uploadError(files)
        if (filesError) return fail(c, user, 400, filesError, back)

        const subject = chainSubject(chain) || 'Other'
        const res = await db.prepare('INSERT INTO resources (title, description, file_key, subject, uploader_id, type, uploader_display, folder_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
            .bind(title, description, '', subject, user.id, 'resource', displayChoice(body['uploader_display']), folderId)
            .run()
        const noteId = Number(res.meta.last_row_id)
        if (files.length) await db.batch((await storeFiles(c, files, noteId, user.id)).map((s) => stmt(db, s)))

        await logAction(db, user.id, 'CREATE_RESOURCE', `Uploaded resource '${title}' in ${subject} (folder ${folderId}, ${plural(files.length, 'file')})`, noteId, 'resources');
        await updatePoints(user.id, 3, db);
        return c.redirect(noteHref(noteId))
    } catch (e: any) {
        return fail(c, user, 500, `Upload failed: ${e.message}`)
    }
})

app.get('/resources/view/:id{[0-9]+}', async (c) => {
    const user = await getUser(c) as Viewer
    const db = c.env.DB
    const id = parseId(c.req.param('id'))
    const resource = await loadNote(db, id)
    if (!resource) return c.notFound();
    const chain = resource.folder_id ? await loadChain(db, resource.folder_id) : []
    if (!canSeeChain(user, chain)) return c.notFound();

    const removed = chainInTrash(chain)
    const [files, tree] = await Promise.all([rows(db, noteFilesQuery(id)), treeData(db, user, chain, id)])
    const folder = chain[chain.length - 1]

    // The file shown in the preview: the one asked for, else the first that can be previewed.
    const asked = parseId(c.req.query('file'))
    const previewed = files.find((f: any) => f.id === asked && previewKind(f.file_name)) || files.find((f: any) => previewKind(f.file_name))
    const kind = previewed ? previewKind(previewed.file_name) : null

    return c.html(
        <Shell c={c} user={user} title={`${resource.title} - ${subjectLabel(resource.subject)}`} tree={tree} chain={chain} trailing={resource.title}
            compose={removed ? false : { selected: folder && canAddToFolder(user, chain) ? folder.id : 0 }}>
            <div class="max-w-4xl">
                <div class="flex items-start justify-between gap-4">
                    <h1 class="flex items-start gap-2 text-2xl font-medium text-gray-900 dark:text-white leading-snug min-w-0">
                        <span class="mt-1"><NoteIcon cls="w-6 h-6" /></span>
                        <span class="break-words min-w-0">{resource.title}</span>
                    </h1>
                    {removed && <span class="shrink-0 text-xs font-bold uppercase tracking-wide text-red-600 border border-red-300 px-2 py-1">Removed</span>}
                </div>

                {/* Meta line */}
                <p class="text-xs text-gray-500 dark:text-neutral-400 mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span>Submitted</span>
                    <span class="local-date" data-format="datetime" data-timestamp={resource.created_at}>{formatDate(resource.created_at)}</span>
                    <span>by</span>
                    <b class="text-gray-700 dark:text-neutral-200">{renderUploaderName(resource)}</b>
                    {resource.uploader_display !== 'anonymous' && <span dangerouslySetInnerHTML={{ __html: renderTags(resource.tags) }}></span>}
                    <span>to</span>
                    <SubjectBadge subject={resource.subject} tab="resource" />
                    <Dot />
                    <span><b class="text-gray-700 dark:text-neutral-200">{resource.download_count || 0}</b> downloads</span>
                </p>

                {/* Actions */}
                <div class="mt-3 flex items-center gap-1.5 flex-wrap">
                    {removed && isAdmin(user) && folder?.kind === 'trash' && (
                        <form action={`/resources/${id}/restore`} method="post">
                            <button type="submit" class={BTN_SECONDARY}><Icon name="restore" />Restore</button>
                        </form>
                    )}
                    {canEditNote(user, resource, chain) && <a href={`/resources/${id}/edit`} class={BTN_SECONDARY}><Icon name="pencil" />Edit</a>}
                    {canMoveNote(user, resource, chain) && <a href={`/resources/move/note/${id}`} class={BTN_SECONDARY}><Icon name="move" />Move</a>}
                    {canRemoveNote(user, resource, chain) && (
                        <form action={`/resources/${id}/delete`} method="post" onsubmit="return confirm('Remove this note?')">
                            <button type="submit" class={BTN_DANGER}><Icon name="trash" />Remove</button>
                        </form>
                    )}
                </div>

                {/* Description */}
                <div class="mt-5 text-sm text-gray-800 dark:text-neutral-200 whitespace-pre-wrap leading-relaxed break-words">
                    {resource.description || <span class="italic text-gray-400 dark:text-neutral-500">No description provided.</span>}
                </div>

                {/* Attached files */}
                {files.length > 0 && (
                    <div class="mt-6">
                        <h2 class="h-8 px-2 flex items-center text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-neutral-400">{plural(files.length, 'attached file')}</h2>
                        {files.map((f: any) => {
                            const canPreview = !!previewKind(f.file_name)
                            const active = previewed && previewed.id === f.id
                            return (
                                <div class={`${ROW} ${active ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                                    <FileIcon name={f.file_name} />
                                    <a href={canPreview ? `${noteHref(id)}?file=${f.id}#preview` : `/download/${f.file_key}?id=${id}`} target={canPreview ? undefined : '_blank'} class={ROW_NAME}>{f.file_name}</a>
                                    <div class={ROW_META}>
                                        <span>{formatBytes(f.size)}</span>
                                        <a href={`/download/${f.file_key}?id=${id}`} target="_blank" class={ROW_ACTION} title="Download"><Icon name="download" /></a>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}

                {/* File Preview */}
                {previewed && (
                    <div id="preview" class="mt-4 scroll-mt-20">
                        <div class="flex items-center justify-between gap-3 h-8 px-2">
                            <span class="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-neutral-400 truncate">{kind === 'pdf' ? 'PDF' : kind === 'image' ? 'Image' : 'Text'} Preview{files.length > 1 ? ` — ${previewed.file_name}` : ''}</span>
                            <a href={`/download/${previewed.file_key}`} target="_blank" class="shrink-0 text-xs text-blue-600 hover:underline">open in new tab →</a>
                        </div>
                        {(kind === 'pdf' || kind === 'text') && (
                            <iframe
                                src={`/download/${previewed.file_key}`}
                                class="w-full h-[700px] rounded-md bg-white"
                                title="File Preview">
                            </iframe>
                        )}
                        {kind === 'image' && (
                            <img
                                src={`/download/${previewed.file_key}`}
                                alt={previewed.file_name}
                                class="max-w-full max-h-[700px] rounded-md"
                            />
                        )}
                    </div>
                )}
            </div>
        </Shell>
    )
})

// A note plus its chain, for the handlers that change it. Null when it does not exist or is hidden.
async function loadEditable(c: Ctx, user: Viewer) {
    const id = parseId(c.req.param('id'))
    const note = await loadNote(c.env.DB, id)
    if (!note) return null
    const chain = note.folder_id ? await loadChain(c.env.DB, note.folder_id) : []
    if (!canSeeChain(user, chain)) return null
    return { id, note, chain, back: { href: noteHref(id), label: 'Back to the note' } }
}

app.get('/resources/:id{[0-9]+}/edit', async (c) => {
    const user = await getUser(c) as Viewer
    if (!user) return c.redirect(loginRedirect(c))
    const found = await loadEditable(c, user)
    if (!found) return c.notFound()
    const { id, note: resource, chain, back } = found
    if (!canEditNote(user, resource, chain)) return fail(c, user, 403, 'Only the person who uploaded this note can edit it.', back)
    const [files, tree] = await Promise.all([rows(c.env.DB, noteFilesQuery(id)), treeData(c.env.DB, user, chain, id)])
    const room = MAX_FILES_PER_NOTE - files.length

    return c.html(
        <Shell c={c} user={user} title="Edit Resource" tree={tree} chain={chain} trailing={resource.title} narrow>
            <div class={`${PANEL} p-5 sm:p-8`}>
                <h1 class="text-xl font-bold text-gray-900 dark:text-white mb-6">Edit Resource</h1>

                <form action={`/resources/${id}/edit`} method="post" class="space-y-5">
                    <div>
                        <label class={LABEL} for="res-note-title">Title</label>
                        <input id="res-note-title" type="text" name="title" value={resource.title} required maxlength={MAX_NOTE_TITLE} class={INPUT} />
                    </div>

                    <div>
                        <label class={LABEL} for="res-note-desc">Description</label>
                        <textarea id="res-note-desc" name="description" rows={4} class={`${INPUT} resize-y`}>{resource.description || ''}</textarea>
                    </div>

                    <DisplayChoices value={resource.uploader_display} user={user} />

                    <div class="flex gap-3 pt-2">
                        <a href={noteHref(id)} class={BTN_SECONDARY}>Cancel</a>
                        <button type="submit" class={BTN_PRIMARY}>Save Changes</button>
                    </div>
                </form>
            </div>

            <div class={`${PANEL} p-5 sm:p-8`}>
                <h2 class="text-lg font-bold text-gray-900 dark:text-white mb-2">Attached files <span class="text-sm font-normal text-gray-500 dark:text-neutral-400">{files.length} of {MAX_FILES_PER_NOTE}</span></h2>
                <div class="mb-4">
                    {files.length === 0 && <p class="h-9 px-2 flex items-center text-sm italic text-gray-400 dark:text-neutral-500">No files attached.</p>}
                    {files.map((f: any) => (
                        <div class={ROW}>
                            <FileIcon name={f.file_name} />
                            <a href={`/download/${f.file_key}`} target="_blank" class={ROW_NAME}>{f.file_name}</a>
                            <div class={ROW_META}>
                                <span>{formatBytes(f.size)}</span>
                                <form action={`/resources/files/${f.id}/remove`} method="post" class="flex" onsubmit="return confirm('Remove this file from the note?')">
                                    <button type="submit" class={ROW_ACTION_DANGER} title="Remove file"><Icon name="trash" /></button>
                                </form>
                            </div>
                        </div>
                    ))}
                </div>

                {room > 0 ? (
                    <form action={`/resources/${id}/files`} method="post" enctype="multipart/form-data" class="space-y-4">
                        <FilesInput max={room} />
                        <button type="submit" class={BTN_SECONDARY}><Icon name="upload" />Add files</button>
                    </form>
                ) : (
                    <p class="text-xs text-gray-500 dark:text-neutral-400">A note holds up to {MAX_FILES_PER_NOTE} files. Remove one to attach another.</p>
                )}
            </div>
        </Shell>
    )
})

app.post('/resources/:id{[0-9]+}/edit', async (c) => {
    const user = await getUser(c) as Viewer
    if (!user) return c.redirect(loginRedirect(c))
    const found = await loadEditable(c, user)
    if (!found) return c.notFound()
    const { id, note, chain, back } = found
    if (!canEditNote(user, note, chain)) return fail(c, user, 403, 'Only the person who uploaded this note can edit it.', back)

    const body = await c.req.parseBody()
    const title = text(body['title']).trim().slice(0, MAX_NOTE_TITLE)
    if (!title) return fail(c, user, 400, 'Give the note a title.', { href: `/resources/${id}/edit`, label: 'Back' })

    await c.env.DB.prepare('UPDATE resources SET title = ?, description = ?, uploader_display = ? WHERE id = ?')
        .bind(title, text(body['description']), displayChoice(body['uploader_display']), id)
        .run()
    await logAction(c.env.DB, user.id, 'EDIT_RESOURCE', `Edited resource '${title}' (${id})`, id, 'resources');
    return c.redirect(noteHref(id))
})

app.post('/resources/:id{[0-9]+}/files', async (c) => {
    const user = await getUser(c) as Viewer
    if (!user) return c.redirect(loginRedirect(c))
    const found = await loadEditable(c, user)
    if (!found) return c.notFound()
    const { id, note, chain } = found
    const back = { href: `/resources/${id}/edit`, label: 'Back' }
    if (!canEditNote(user, note, chain)) return fail(c, user, 403, 'Only the person who uploaded this note can add files to it.', found.back)

    try {
        const db = c.env.DB
        const body = await c.req.parseBody({ all: true })
        const files = uploadedFiles(body['files'])
        if (files.length === 0) return fail(c, user, 400, 'Choose a file to add.', back)
        const existing = await rows(db, noteFilesQuery(id))
        const filesError = uploadError(files, existing.length)
        if (filesError) return fail(c, user, 400, filesError, back)

        await db.batch((await storeFiles(c, files, id, user.id)).map((s) => stmt(db, s)))
        await logAction(db, user.id, 'ADD_RESOURCE_FILE', `Added ${plural(files.length, 'file')} to resource '${note.title}' (${id})`, id, 'resources')
        return c.redirect(`/resources/${id}/edit`)
    } catch (e: any) {
        return fail(c, user, 500, `Upload failed: ${e.message}`, back)
    }
})

app.post('/resources/files/:fileId{[0-9]+}/remove', async (c) => {
    const user = await getUser(c) as Viewer
    if (!user) return c.redirect(loginRedirect(c))
    const db = c.env.DB
    const fileId = parseId(c.req.param('fileId'))
    const file = await db.prepare('SELECT id, resource_id, file_name FROM resource_files WHERE id = ? AND is_deleted = 0').bind(fileId).first<any>()
    const note = file ? await loadNote(db, file.resource_id) : null
    if (!file || !note) return c.notFound()
    const chain = note.folder_id ? await loadChain(db, note.folder_id) : []
    if (!canSeeChain(user, chain)) return c.notFound()
    if (!canEditNote(user, note, chain)) return fail(c, user, 403, 'Only the person who uploaded this note can remove its files.', { href: noteHref(note.id), label: 'Back to the note' })

    await db.prepare('UPDATE resource_files SET is_deleted = 1 WHERE id = ?').bind(fileId).run()
    await logAction(db, user.id, 'REMOVE_RESOURCE_FILE', `Removed file '${file.file_name}' from resource '${note.title}' (${note.id})`, note.id, 'resources')
    return c.redirect(`/resources/${note.id}/edit`)
})

app.post('/resources/:id{[0-9]+}/delete', async (c) => {
    const user = await getUser(c) as Viewer
    if (!user) return c.redirect(loginRedirect(c))
    const found = await loadEditable(c, user)
    if (!found) return c.notFound()
    const { id, note, chain, back } = found
    if (!canRemoveNote(user, note, chain)) {
        return fail(c, user, 403, chainInTrash(chain) ? 'This note has already been removed.' : 'Only the person who uploaded this note can remove it.', back)
    }

    const db = c.env.DB
    await stmt(db, removeNoteStatement(id, await trashId(db), user.id)).run()
    await logAction(db, user.id, 'DELETE_RESOURCE', `Removed resource '${note.title}' (${id})`, id, 'resources');
    return c.redirect(note.folder_id ? folderHref(note.folder_id) : '/resources')
})

app.post('/resources/:id{[0-9]+}/restore', async (c) => {
    const user = await getUser(c) as Viewer
    if (!user) return c.redirect(loginRedirect(c))
    if (!isAdmin(user)) return c.notFound()
    const found = await loadEditable(c, user)
    if (!found) return c.notFound()
    const { id, note, chain, back } = found
    if (!chainInTrash(chain)) return fail(c, user, 400, 'This note has not been removed.', back)

    const db = c.env.DB
    const destChain = note.removed_from_id ? await loadChain(db, note.removed_from_id) : []
    if (destChain.length === 0 || chainInTrash(destChain)) {
        return fail(c, user, 400, 'The folder this came from has been removed too. Use Move to put it somewhere else.', { href: `/resources/move/note/${id}`, label: 'Choose a folder' })
    }

    const dest = destChain[destChain.length - 1]
    await stmt(db, moveNoteStatement(id, dest.id, chainSubject(destChain))).run()
    await logAction(db, user.id, 'RESTORE_RESOURCE', `Restored resource '${note.title}' (${id}) to folder ${dest.id}`, id, 'resources')
    return c.redirect(noteHref(id))
})

// ---------------------------------------------------------------------------------------------
// Downloads
// ---------------------------------------------------------------------------------------------

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

const parseRangeHeader = (header: string | undefined): R2Range | undefined => {
    if (!header) return undefined;
    const match = header.match(/^bytes=(\d*)-(\d*)$/);
    if (!match) return undefined;
    const [, startRaw, endRaw] = match;
    if (startRaw === '' && endRaw === '') return undefined;
    if (startRaw === '') {
        const suffix = parseInt(endRaw, 10);
        if (!Number.isFinite(suffix) || suffix <= 0) return undefined;
        return { suffix };
    }
    const offset = parseInt(startRaw, 10);
    if (!Number.isFinite(offset)) return undefined;
    if (endRaw === '') return { offset };
    const length = parseInt(endRaw, 10) - offset + 1;
    if (!Number.isFinite(length) || length <= 0) return undefined;
    return { offset, length };
};

app.get('/download/*', async (c) => {
    try {
        const user = await getUser(c)
        if (!user) return c.redirect(loginRedirect(c))

        const path = c.req.path;
        const prefix = '/download/';
        const key = path.slice(prefix.length);
        // Handwritten answers are private to their owner and have their own checked route
        // (pastPapers/drawings.tsx); this route hands any key to any signed-in user.
        if (key.replace(/^\/+/, '').startsWith(DRAWING_KEY_PREFIX)) return c.text('File not found', 404);
        const rangeHeader = c.req.header('range');
        const range = parseRangeHeader(rangeHeader);
        const object = await c.env.BUCKET.get(key, {
            range,
            onlyIf: c.req.header('if-none-match') ? { etagMatches: c.req.header('if-none-match')! } : undefined
        });

        if (object === null) {
            if (c.req.header('if-none-match')) return new Response(null, { status: 304 });
            return c.text('File not found', 404);
        }

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

        const cacheHeaders: Record<string, string> = {
            'etag': object.httpEtag,
            'Content-Type': contentType,
            'Content-Disposition': 'inline',
            'cache-control': 'private, max-age=86400',
            'accept-ranges': 'bytes',
        };

        if (range && object.range && 'offset' in object.range && typeof object.range.offset === 'number') {
            const offset: number = object.range.offset;
            const size = object.range.length ?? object.size - offset;
            return new Response(object.body, {
                status: 206,
                headers: {
                    ...cacheHeaders,
                    'Content-Length': String(size),
                    'content-range': `bytes ${offset}-${offset + size - 1}/${object.size}`,
                }
            });
        }

        return new Response(object.body, { headers: cacheHeaders });
    } catch (e: any) {
        return c.text(`Download Failed: ${e.message}`, 500);
    }
})

export default app
