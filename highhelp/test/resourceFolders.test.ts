import { env } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';
import { SUBJECTS } from '../src/constants';
import {
	MAX_CHAIN,
	MAX_FILE_SIZE,
	MAX_FILES_PER_NOTE,
	LIVE_FOLDERS_SQL,
	LIVE_NOTES_SQL,
	ROOT_FOLDERS_SQL,
	SECTION_NAMES,
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
	isRootFolder,
	missingRoots,
	moveError,
	moveFolderStatements,
	moveNoteStatement,
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
	type FolderRow,
	type NoteRow,
	type Statement,
} from '../src/resourceFolders';
import type { User } from '../src/types';

const person = (id: number, level: number): User => ({
	id,
	student_id: String(id),
	first_name: `User${id}`,
	last_name: 'Test',
	email: `${id}@example.com`,
	role: 'student',
	permission_level: level,
	created_at: '',
	points: 0,
});

const NICKLAS = person(1, 1);
const RICKY = person(2, 1);
const UNVERIFIED = person(3, 0);
const MOD = person(4, 3);
const ADMIN = person(5, 5);

const folder = (id: number, kind: FolderRow['kind'], extra: Partial<FolderRow> = {}): FolderRow => ({
	id,
	parent_id: null,
	name: `Folder ${id}`,
	kind,
	subject: kind === 'subject' ? 'English Advanced' : null,
	access: 'everyone',
	creator_id: null,
	...extra,
});

const SUBJECT = folder(10, 'subject');
const TASK1 = folder(11, 'section', { parent_id: 10, name: 'Task 1' });
const TRASH = folder(99, 'trash', { name: 'Removed' });
const NICKLAS_OPEN = folder(20, 'folder', { parent_id: 11, creator_id: NICKLAS.id });
const NICKLAS_PRIVATE = folder(21, 'folder', { parent_id: 11, creator_id: NICKLAS.id, access: 'owner' });
const RICKY_IN_NICKLAS = folder(22, 'folder', { parent_id: 20, creator_id: RICKY.id });

const note = (id: number, uploaderId: number, folderId: number): NoteRow => ({ id, folder_id: folderId, uploader_id: uploaderId, subject: 'English Advanced' });

describe('resource folder rules', () => {
	it('treats subjects, sections and the trash as root folders', () => {
		expect(isRootFolder(SUBJECT)).toBe(true);
		expect(isRootFolder(TASK1)).toBe(true);
		expect(isRootFolder(TRASH)).toBe(true);
		expect(isRootFolder(NICKLAS_OPEN)).toBe(false);
	});

	it('reads the subject and removed state off the chain', () => {
		expect(chainSubject([SUBJECT, TASK1, NICKLAS_OPEN])).toBe('English Advanced');
		expect(chainInTrash([SUBJECT, TASK1])).toBe(false);
		expect(chainInTrash([TRASH, NICKLAS_OPEN])).toBe(true);
		expect(chainSubject([TRASH, NICKLAS_OPEN])).toBe(null);
		expect(chainSubject([])).toBe(null);
	});

	it('shows the Removed folder and its contents to admins only', () => {
		expect(canSeeChain(null, [SUBJECT, TASK1])).toBe(true);
		expect(canSeeChain(null, [TRASH])).toBe(false);
		expect(canSeeChain(NICKLAS, [TRASH, NICKLAS_OPEN])).toBe(false);
		expect(canSeeChain(MOD, [TRASH])).toBe(false);
		expect(canSeeChain(ADMIN, [TRASH, NICKLAS_OPEN])).toBe(true);
	});

	it('lets verified users add under the seven sections and open folders', () => {
		expect(canAddToFolder(NICKLAS, [SUBJECT, TASK1])).toBe(true);
		expect(canAddToFolder(RICKY, [SUBJECT, TASK1, NICKLAS_OPEN])).toBe(true);
		expect(addToFolderError(null, [SUBJECT, TASK1])).toMatch(/Sign in/);
		expect(addToFolderError(UNVERIFIED, [SUBJECT, TASK1])).toMatch(/guidelines/);
		expect(addToFolderError(NICKLAS, [])).toMatch(/does not exist/);
	});

	it('lets nobody add directly under a subject, only inside its sections', () => {
		expect(addToFolderError(NICKLAS, [SUBJECT])).toMatch(/inside this subject/);
		expect(canAddToFolder(MOD, [SUBJECT])).toBe(false);
		expect(canAddToFolder(ADMIN, [SUBJECT])).toBe(false);
		const base = { user: ADMIN, itemId: 1, fromFolderId: TASK1.id, destChain: [SUBJECT] };
		expect(moveError({ ...base, kind: 'note' })).toMatch(/inside this subject/);
		expect(moveError({ ...base, kind: 'folder' })).toMatch(/inside this subject/);
	});

	it('keeps an owner-only folder to its owner and admins', () => {
		const chain = [SUBJECT, TASK1, NICKLAS_PRIVATE];
		expect(canAddToFolder(NICKLAS, chain)).toBe(true);
		expect(addToFolderError(RICKY, chain)).toMatch(/Only the owner/);
		expect(canAddToFolder(MOD, chain)).toBe(false);
		expect(canAddToFolder(ADMIN, chain)).toBe(true);
	});

	it('never lets anything be added to the Removed folder', () => {
		expect(canAddToFolder(ADMIN, [TRASH])).toBe(false);
		expect(canAddToFolder(ADMIN, [TRASH, NICKLAS_OPEN])).toBe(false);
	});

	it('lets only the uploader or an admin edit a note', () => {
		const n = note(1, RICKY.id, NICKLAS_OPEN.id);
		const chain = [SUBJECT, TASK1, NICKLAS_OPEN];
		expect(canEditNote(RICKY, n, chain)).toBe(true);
		expect(canEditNote(NICKLAS, n, chain)).toBe(false); // folder owner: move only
		expect(canEditNote(MOD, n, chain)).toBe(false);
		expect(canEditNote(ADMIN, n, chain)).toBe(true);
		expect(canEditNote(null, n, chain)).toBe(false);
		// Once removed, only an admin can still touch it.
		expect(canEditNote(RICKY, n, [TRASH])).toBe(false);
		expect(canEditNote(ADMIN, n, [TRASH])).toBe(true);
	});

	it('lets the uploader, an enclosing folder owner or an admin move a note', () => {
		const n = note(1, RICKY.id, RICKY_IN_NICKLAS.id);
		const other = person(6, 1);
		expect(canMoveNote(RICKY, n, [SUBJECT, TASK1, NICKLAS_OPEN, RICKY_IN_NICKLAS])).toBe(true);
		// Nicklas owns a folder further up the chain, so he can move it out.
		expect(canMoveNote(NICKLAS, n, [SUBJECT, TASK1, NICKLAS_OPEN, RICKY_IN_NICKLAS])).toBe(true);
		expect(canMoveNote(other, n, [SUBJECT, TASK1, NICKLAS_OPEN, RICKY_IN_NICKLAS])).toBe(false);
		expect(canMoveNote(MOD, n, [SUBJECT, TASK1, NICKLAS_OPEN])).toBe(false);
		expect(canMoveNote(ADMIN, n, [SUBJECT, TASK1])).toBe(true);
		// Nobody owns a root folder.
		expect(canMoveNote(NICKLAS, n, [SUBJECT, TASK1])).toBe(false);
		// Removed: admins only.
		expect(canMoveNote(RICKY, n, [TRASH])).toBe(false);
		expect(canMoveNote(ADMIN, n, [TRASH])).toBe(true);
	});

	it('lets the uploader or a moderator remove a note', () => {
		const n = note(1, RICKY.id, NICKLAS_OPEN.id);
		const chain = [SUBJECT, TASK1, NICKLAS_OPEN];
		expect(canRemoveNote(RICKY, n, chain)).toBe(true);
		expect(canRemoveNote(NICKLAS, n, chain)).toBe(false);
		expect(canRemoveNote(MOD, n, chain)).toBe(true);
		expect(canRemoveNote(ADMIN, n, chain)).toBe(true);
		expect(canRemoveNote(ADMIN, n, [TRASH])).toBe(false); // already removed
	});

	it('rejects rename, move and removal of root folders, even for admins', () => {
		for (const chain of [[SUBJECT], [SUBJECT, TASK1], [TRASH]]) {
			expect(canEditFolder(ADMIN, chain)).toBe(false);
			expect(canMoveFolder(ADMIN, chain)).toBe(false);
			expect(removeFolderError(ADMIN, chain, 0)).toMatch(/cannot be removed/);
		}
	});

	it('lets a folder be renamed by its creator or an admin', () => {
		const chain = [SUBJECT, TASK1, NICKLAS_OPEN];
		expect(canEditFolder(NICKLAS, chain)).toBe(true);
		expect(canEditFolder(RICKY, chain)).toBe(false);
		expect(canEditFolder(MOD, chain)).toBe(false);
		expect(canEditFolder(ADMIN, chain)).toBe(true);
		expect(canEditFolder(NICKLAS, [TRASH, NICKLAS_OPEN])).toBe(false);
	});

	it('lets a folder be moved by its creator, an enclosing folder owner or an admin', () => {
		const chain = [SUBJECT, TASK1, NICKLAS_OPEN, RICKY_IN_NICKLAS];
		expect(canMoveFolder(RICKY, chain)).toBe(true);
		expect(canMoveFolder(NICKLAS, chain)).toBe(true);
		expect(canMoveFolder(person(6, 1), chain)).toBe(false);
		expect(canMoveFolder(ADMIN, chain)).toBe(true);
		expect(canMoveFolder(RICKY, [SUBJECT, TASK1, NICKLAS_OPEN])).toBe(false);
		expect(canMoveFolder(NICKLAS, [TRASH, NICKLAS_OPEN])).toBe(false);
	});

	it('only lets an owner remove a folder that holds nobody else\'s work', () => {
		const chain = [SUBJECT, TASK1, NICKLAS_OPEN];
		expect(removeFolderError(NICKLAS, chain, 0)).toBe(null);
		expect(removeFolderError(NICKLAS, chain, 2)).toMatch(/other people/);
		expect(removeFolderError(RICKY, chain, 0)).toMatch(/Only the owner/);
		expect(removeFolderError(MOD, chain, 2)).toBe(null);
		expect(removeFolderError(ADMIN, chain, 2)).toBe(null);
		expect(removeFolderError(null, chain, 0)).toMatch(/Sign in/);
		expect(removeFolderError(ADMIN, [TRASH, NICKLAS_OPEN], 0)).toMatch(/already been removed/);
	});

	it('checks where an item is being moved to', () => {
		const base = { user: RICKY, kind: 'note' as const, itemId: 1, fromFolderId: TASK1.id };
		expect(moveError({ ...base, destChain: [SUBJECT, TASK1, NICKLAS_OPEN] })).toBe(null);
		expect(moveError({ ...base, destChain: [] })).toMatch(/Choose a folder/);
		expect(moveError({ ...base, destChain: [SUBJECT, TASK1] })).toMatch(/already in this folder/);
		expect(moveError({ ...base, destChain: [SUBJECT, TASK1, NICKLAS_PRIVATE] })).toMatch(/Only the owner/);
		expect(moveError({ ...base, user: ADMIN, destChain: [SUBJECT, TASK1, NICKLAS_PRIVATE] })).toBe(null);
		expect(moveError({ ...base, user: ADMIN, destChain: [TRASH] })).toMatch(/use Remove/);
	});

	it('never moves a folder into itself or one of its own sub-folders', () => {
		const base = { user: NICKLAS, kind: 'folder' as const, itemId: NICKLAS_OPEN.id, fromFolderId: TASK1.id };
		expect(moveError({ ...base, destChain: [SUBJECT, TASK1, NICKLAS_OPEN] })).toMatch(/into itself/);
		expect(moveError({ ...base, destChain: [SUBJECT, TASK1, NICKLAS_OPEN, RICKY_IN_NICKLAS] })).toMatch(/into itself/);
		expect(moveError({ ...base, destChain: [SUBJECT, folder(12, 'section', { parent_id: 10, name: 'Task 2' })] })).toBe(null);
		// A note may share an id with a folder in the destination chain.
		expect(moveError({ ...base, kind: 'note', destChain: [SUBJECT, TASK1, NICKLAS_OPEN] })).toBe(null);
	});

	it('caps how deep a moved folder can end up', () => {
		const deep = Array.from({ length: MAX_CHAIN - 1 }, (_, i) => folder(100 + i, i === 0 ? 'subject' : 'folder'));
		const base = { user: ADMIN, kind: 'folder' as const, itemId: 500, fromFolderId: 1 };
		expect(moveError({ ...base, destChain: deep, subtreeHeight: 1 })).toBe(null);
		expect(moveError({ ...base, destChain: deep, subtreeHeight: 2 })).toMatch(/nested that deeply/);
	});

	it('tidies and validates folder names', () => {
		expect(cleanFolderName("  Nicklas'   folder\n")).toEqual({ name: "Nicklas' folder" });
		expect(cleanFolderName('')).toEqual({ error: 'Give the folder a name.' });
		expect(cleanFolderName(undefined)).toHaveProperty('error');
		expect(cleanFolderName('x'.repeat(61))).toHaveProperty('error');
		expect(cleanFolderName('x'.repeat(60))).toEqual({ name: 'x'.repeat(60) });
	});

	it('defaults folder access to everyone', () => {
		expect(cleanAccess('owner')).toBe('owner');
		expect(cleanAccess('everyone')).toBe('everyone');
		expect(cleanAccess('admin')).toBe('everyone');
		expect(cleanAccess(undefined)).toBe('everyone');
	});

	it('picks real files out of an upload field and limits them', () => {
		const a = new File(['abc'], 'a.pdf');
		const empty = new File([], '');
		expect(uploadedFiles([a, empty, 'text'])).toEqual([a]);
		expect(uploadedFiles(a)).toEqual([a]);
		expect(uploadedFiles(undefined)).toEqual([]);
		// Zero to three files per note.
		expect(uploadError([])).toBe(null);
		expect(uploadError([a, a, a])).toBe(null);
		expect(uploadError(Array(MAX_FILES_PER_NOTE + 1).fill(a))).toMatch(/at most 3 files/);
		expect(uploadError([a], 2)).toBe(null);
		expect(uploadError([a, a], 2)).toMatch(/already has 2/);
		expect(uploadError([], 3)).toBe(null);
		const big = { name: 'big.pdf', size: MAX_FILE_SIZE + 1 } as File;
		expect(uploadError([big])).toMatch(/too large/);
	});

	it('builds safe, distinct file keys', () => {
		expect(fileKey('Week 1 (final).pdf', 1700000000000, 0)).toBe('resources/1700000000000-0-Week_1__final_.pdf');
		expect(fileKey('a.pdf', 1, 0)).not.toBe(fileKey('a.pdf', 1, 1));
		expect(fileKey('../../etc/passwd', 1, 0)).toBe('resources/1-0-.._.._etc_passwd');
	});

	it('formats sizes and picks a preview type', () => {
		expect(formatBytes(null)).toBe('');
		expect(formatBytes(512)).toBe('512 B');
		expect(formatBytes(2048)).toBe('2 KB');
		expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
		expect(previewKind('Notes.PDF')).toBe('pdf');
		expect(previewKind('photo.jpeg')).toBe('image');
		expect(previewKind('readme.md')).toBe('text');
		expect(previewKind('slides.pptx')).toBe(null);
	});

	it('sorts files into kinds for their icons', () => {
		expect(fileKind('Notes.PDF')).toBe('pdf');
		expect(fileKind('scan.final.jpeg')).toBe('image');
		expect(fileKind('essay.docx')).toBe('doc');
		expect(fileKind('marks.xlsx')).toBe('sheet');
		expect(fileKind('Slides.pptx')).toBe('slides');
		expect(fileKind('lesson.mp4')).toBe('media');
		expect(fileKind('all.zip')).toBe('archive');
		expect(fileKind('readme.md')).toBe('text');
		expect(fileKind('mystery.xyz')).toBe('other');
		expect(fileKind('no extension')).toBe('other');
	});

	it('nests folder rows into a tree, in the order given', () => {
		const rows = [
			{ id: 1, parent_id: null, name: 'Subject' },
			{ id: 2, parent_id: 1, name: 'Task 1' },
			{ id: 3, parent_id: 1, name: 'Task 2' },
			{ id: 4, parent_id: 2, name: 'B' },
			{ id: 5, parent_id: 2, name: 'A' },
			{ id: 6, parent_id: 99, name: 'Orphan' },
		];
		const tree = buildFolderTree(rows, 1)!;
		expect(tree.name).toBe('Subject');
		expect(tree.children.map((c) => c.name)).toEqual(['Task 1', 'Task 2']);
		expect(tree.children[0].children.map((c) => c.name)).toEqual(['B', 'A']);
		expect(tree.children[1].children).toEqual([]);
		expect(buildFolderTree(rows, 2)!.children).toHaveLength(2);
		expect(buildFolderTree(rows, 42)).toBe(null);
	});

	it('lists the canonical subjects and trash that have no folder yet', () => {
		expect(missingRoots([])).toEqual({ subjects: [...SUBJECTS], trash: true });
		const have = [{ kind: 'subject' as const, subject: 'Physics' }, { kind: 'trash' as const, subject: null }];
		const missing = missingRoots(have);
		expect(missing.trash).toBe(false);
		expect(missing.subjects).not.toContain('Physics');
		expect(missing.subjects).toHaveLength(SUBJECTS.length - 1);
	});
});

// ---------------------------------------------------------------------------------------------
// SQL, against a seeded D1. No migrations are applied to the test database, so the tables are
// created here; keep them in step with migrations/029_resource_folders.sql.
// ---------------------------------------------------------------------------------------------

const run = (s: Statement) => env.DB.prepare(s.sql).bind(...s.params);
const all = async <T = any>(s: Statement) => (await run(s).all<T>()).results;
const exec = async (statements: Statement[]) => {
	await env.DB.batch(statements.map(run));
};

async function folderId(name: string, parentName?: string): Promise<number> {
	const row = parentName
		? await env.DB.prepare(
				'SELECT f.id FROM resource_folders f JOIN resource_folders p ON p.id = f.parent_id WHERE f.name = ? AND p.name = ?',
			)
				.bind(name, parentName)
				.first<{ id: number }>()
		: await env.DB.prepare('SELECT id FROM resource_folders WHERE name = ? ORDER BY id LIMIT 1').bind(name).first<{ id: number }>();
	if (!row) throw new Error(`no folder ${name}`);
	return row.id;
}

async function addFolder(name: string, parentId: number, creatorId: number, access = 'everyone'): Promise<number> {
	const res = await env.DB.prepare("INSERT INTO resource_folders (parent_id, name, kind, access, creator_id) VALUES (?, ?, 'folder', ?, ?)")
		.bind(parentId, name, access, creatorId)
		.run();
	return res.meta.last_row_id as number;
}

async function addNote(title: string, folder: number, uploaderId: number, subject: string, description = ''): Promise<number> {
	const res = await env.DB.prepare(
		"INSERT INTO resources (title, description, file_key, subject, uploader_id, folder_id) VALUES (?, ?, '', ?, ?, ?)",
	)
		.bind(title, description, subject, uploaderId, folder)
		.run();
	return res.meta.last_row_id as number;
}

const chainNames = async (id: number) => (await all<FolderRow>(folderChainQuery(id))).map((f) => f.name);

describe('resource folder queries', () => {
	let task1: number;
	let unfiled: number;
	let physicsTask2: number;
	let trash: number;
	let nicklas: number;
	let week1: number;
	let week2: number;

	beforeAll(async () => {
		await env.DB.batch(
			[
				`CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, first_name TEXT, last_name TEXT, tags TEXT)`,
				`CREATE TABLE resource_folders (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					parent_id INTEGER,
					name TEXT NOT NULL,
					kind TEXT NOT NULL DEFAULT 'folder',
					subject TEXT,
					access TEXT NOT NULL DEFAULT 'everyone',
					creator_id INTEGER,
					position INTEGER NOT NULL DEFAULT 0,
					removed_from_id INTEGER,
					removed_by INTEGER,
					removed_at TIMESTAMP,
					created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
				)`,
				`CREATE UNIQUE INDEX idx_resource_folders_subject ON resource_folders (subject) WHERE kind = 'subject'`,
				`CREATE UNIQUE INDEX idx_resource_folders_section ON resource_folders (parent_id, name) WHERE kind = 'section'`,
				`CREATE UNIQUE INDEX idx_resource_folders_trash ON resource_folders (kind) WHERE kind = 'trash'`,
				`CREATE TABLE resources (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					title TEXT NOT NULL,
					description TEXT,
					file_key TEXT NOT NULL,
					subject TEXT NOT NULL,
					type TEXT DEFAULT 'resource',
					uploader_id INTEGER,
					created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
					is_deleted BOOLEAN DEFAULT 0,
					download_count INTEGER DEFAULT 0,
					uploader_display TEXT DEFAULT 'initials',
					folder_id INTEGER,
					removed_from_id INTEGER,
					removed_by INTEGER,
					removed_at TIMESTAMP
				)`,
				`CREATE TABLE resource_files (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					resource_id INTEGER NOT NULL,
					file_key TEXT NOT NULL,
					file_name TEXT NOT NULL,
					size INTEGER,
					uploader_id INTEGER,
					is_deleted BOOLEAN DEFAULT 0,
					created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
				)`,
				`INSERT INTO users (id, first_name, last_name) VALUES (1, 'Nicklas', 'N'), (2, 'Ricky', 'L')`,
			].map((s) => env.DB.prepare(s)),
		);

		// English Advanced
		//   Task 1
		//     Nicklas' folder        (Nicklas, open)
		//       Week 1 Notes         (Nicklas)     -> note "Week 1" with two files
		//       Week 2 Notes         (Ricky)       -> note "Week 2" by Ricky
		//     note "Some Discrete note" by Ricky
		await exec(createRootsStatements(['English Advanced', 'Physics']));
		task1 = await folderId('Task 1', 'English Advanced');
		unfiled = await folderId('Unfiled', 'English Advanced');
		physicsTask2 = await folderId('Task 2', 'Physics');
		trash = await folderId('Removed');
		nicklas = await addFolder("Nicklas' folder", task1, 1);
		week1 = await addFolder('Week 1 Notes', nicklas, 1);
		week2 = await addFolder('Week 2 Notes', nicklas, 2);
		const n1 = await addNote('Week 1', week1, 1, 'English Advanced', 'Opening scenes');
		await addNote('Week 2', week2, 2, 'English Advanced');
		await addNote('Some Discrete note', task1, 2, 'English Advanced', '100% of the syllabus');
		await env.DB.prepare(
			`INSERT INTO resource_files (resource_id, file_key, file_name, size, is_deleted) VALUES
				(?, 'resources/1-0-a.pdf', 'PDF 1.pdf', 1000, 0),
				(?, 'resources/1-1-b.pdf', 'PDF 2.pdf', 2000, 0),
				(?, 'resources/1-2-c.pdf', 'Old.pdf', 3000, 1)`,
		)
			.bind(n1, n1, n1)
			.run();
	});

	it('creates each subject with its seven sections, and the trash, exactly once', async () => {
		await exec(createRootsStatements(['English Advanced', 'Physics'])); // a second run changes nothing
		const roots = (await env.DB.prepare(ROOT_FOLDERS_SQL).all<FolderRow>()).results;
		expect(roots.map((f) => f.name)).toEqual(['English Advanced', 'Physics', 'Removed']);
		expect(roots.map((f) => f.kind)).toEqual(['subject', 'subject', 'trash']);
		const english = roots[0].id;
		const sections = await all<FolderRow>(childFoldersQuery(english));
		expect(sections.map((f) => f.name)).toEqual([...SECTION_NAMES]);
		expect(sections.every((f) => f.kind === 'section' && f.access === 'everyone' && f.creator_id === null)).toBe(true);
		const { n } = (await env.DB.prepare("SELECT COUNT(*) AS n FROM resource_folders WHERE kind = 'section'").first<{ n: number }>())!;
		expect(n).toBe(14);
	});

	it('returns a chain from the subject down to the folder', async () => {
		expect(await chainNames(week1)).toEqual(['English Advanced', 'Task 1', "Nicklas' folder", 'Week 1 Notes']);
		expect(await chainNames(trash)).toEqual(['Removed']);
		expect(await chainNames(123456)).toEqual([]);
		const chain = await all<FolderRow>(folderChainQuery(week1));
		expect(chainSubject(chain)).toBe('English Advanced');
		expect(chain[2].creator_id).toBe(1);
	});

	it('lists a folder\'s sub-folders and notes with their counts', async () => {
		const folders = await all<any>(childFoldersQuery(task1));
		expect(folders.map((f) => f.name)).toEqual(["Nicklas' folder"]);
		expect(folders[0]).toMatchObject({ folder_count: 2, note_count: 0, first_name: 'Nicklas' });
		const notes = await all<any>(folderNotesQuery(task1));
		expect(notes.map((n) => n.title)).toEqual(['Some Discrete note']);
		expect(notes[0]).toMatchObject({ file_count: 0, first_name: 'Ricky' });

		const weekNotes = await all<any>(folderNotesQuery(week1));
		expect(weekNotes[0]).toMatchObject({ title: 'Week 1', file_count: 2 });
		const files = await all<any>(folderFilesQuery(week1));
		expect(files.map((f) => f.file_name)).toEqual(['PDF 1.pdf', 'PDF 2.pdf']); // the deleted one is left out
	});

	it('loads tree children for several folders at once', async () => {
		const english = await folderId('English Advanced');
		const folders = await all<any>(treeFoldersQuery([english, task1, nicklas]));
		expect(folders.filter((f) => f.parent_id === english).map((f) => f.name)).toEqual([...SECTION_NAMES]);
		expect(folders.find((f) => f.id === task1)).toMatchObject({ kind: 'section', folder_count: 1, note_count: 1 });
		expect(folders.find((f) => f.id === nicklas)).toMatchObject({ kind: 'folder', creator_id: 1, folder_count: 2, note_count: 0 });
		expect(folders.filter((f) => f.parent_id === nicklas).map((f) => f.name)).toEqual(['Week 1 Notes', 'Week 2 Notes']);

		const notes = await all<any>(treeNotesQuery([task1, week1]));
		expect(notes.map((n) => [n.folder_id, n.title])).toEqual([
			[task1, 'Some Discrete note'],
			[week1, 'Week 1'],
		]);
	});

	it('returns a whole subject as rows that nest into branches', async () => {
		const english = await folderId('English Advanced');
		const rows = await all<any>(subtreeFoldersQuery(english));
		expect(rows[0]).toMatchObject({ id: english, kind: 'subject' });
		const tree = buildFolderTree(rows, english)!;
		expect(tree.children.map((c) => c.name)).toEqual([...SECTION_NAMES]);
		const t1 = tree.children[0];
		expect(t1).toMatchObject({ name: 'Task 1', note_count: 1 });
		expect(t1.children.map((c) => c.name)).toEqual(["Nicklas' folder"]);
		expect(t1.children[0].children.map((c) => [c.name, c.note_count])).toEqual([
			['Week 1 Notes', 1],
			['Week 2 Notes', 1],
		]);
		// Other subjects and the trash are not part of it.
		expect(rows.some((r) => r.name === 'Removed' || r.subject === 'Physics')).toBe(false);
	});

	it('lists the notes under a subject, and everything live for the front page', async () => {
		const english = await folderId('English Advanced');
		const notes = await all<any>(subtreeNotesQuery(english));
		expect(notes.map((n) => n.title)).toEqual(['Some Discrete note', 'Week 1', 'Week 2']);
		expect(await all(subtreeNotesQuery(week1))).toHaveLength(1);

		const folders = (await env.DB.prepare(LIVE_FOLDERS_SQL).all<any>()).results;
		expect(folders.some((f) => f.kind === 'trash')).toBe(false);
		expect(folders.filter((f) => f.kind === 'subject').map((f) => f.name)).toEqual(['English Advanced', 'Physics']);
		expect(folders.find((f) => f.id === week1)).toMatchObject({ parent_id: nicklas, note_count: 1 });
		const live = (await env.DB.prepare(LIVE_NOTES_SQL).all<any>()).results;
		expect(live.map((n) => n.title)).toEqual(['Some Discrete note', 'Week 1', 'Week 2']);
	});

	it('finds a user\'s empty folder, which blocks them creating another', async () => {
		expect(await all(emptyFoldersQuery(1))).toEqual([]);
		expect(await all(emptyFoldersQuery(2))).toEqual([]);
		const empty = await addFolder('Empty', unfiled, 1);
		expect(await all(emptyFoldersQuery(1))).toEqual([{ id: empty, name: 'Empty' }]);
		expect(await all(emptyFoldersQuery(2))).toEqual([]); // someone else's empty folder does not count

		// A sub-folder makes it non-empty, though the sub-folder itself is now the empty one.
		const inner = await addFolder('Inner', empty, 1);
		expect(await all(emptyFoldersQuery(1))).toEqual([{ id: inner, name: 'Inner' }]);

		// Removed folders do not count, however deep in the trash they sit.
		await exec([removeFolderStatement(empty, trash, 1)]);
		expect(await all(emptyFoldersQuery(1))).toEqual([]);
		expect(await chainNames(inner)).toEqual(['Removed', 'Empty', 'Inner']);
	});

	it('creates a folder only while its creator has no empty one', async () => {
		const create = (name: string, parentId: number, userId: number) =>
			run(createFolderStatement({ parentId, name, access: 'owner', userId })).run();

		const first = await create('First', unfiled, 7);
		expect(first.meta.changes).toBe(1);
		const firstId = first.meta.last_row_id as number;
		const row = await env.DB.prepare('SELECT parent_id, name, kind, access, creator_id FROM resource_folders WHERE id = ?').bind(firstId).first();
		expect(row).toEqual({ parent_id: unfiled, name: 'First', kind: 'folder', access: 'owner', creator_id: 7 });

		// Refused while "First" is empty, wherever the new one would go ...
		expect((await create('Second', task1, 7)).meta.changes).toBe(0);
		expect((await create('Second', firstId, 7)).meta.changes).toBe(0);
		// ... but another user is unaffected.
		expect((await create('Theirs', firstId, 8)).meta.changes).toBe(1);

		// "First" now holds a folder, so user 7 may create again.
		expect((await create('Second', task1, 7)).meta.changes).toBe(1);
		expect((await create('Third', task1, 7)).meta.changes).toBe(0);

		// Putting a note in the empty one, or removing it, frees them up too.
		const second = await folderId('Second', 'Task 1');
		const noteId = await addNote('Filler', second, 7, 'English Advanced');
		expect((await create('Third', task1, 7)).meta.changes).toBe(1);
		const third = await folderId('Third', 'Task 1');
		expect((await create('Fourth', task1, 7)).meta.changes).toBe(0);
		await exec([removeFolderStatement(third, trash, 7)]);
		expect((await create('Fourth', task1, 7)).meta.changes).toBe(1);

		// Tidy up so later tests see the tree they expect.
		await env.DB.prepare('DELETE FROM resources WHERE id = ?').bind(noteId).run();
		await env.DB.prepare('DELETE FROM resource_folders WHERE creator_id IN (7, 8)').run();
	});

	it('measures a folder\'s depth and counts other people\'s items inside it', async () => {
		const [mine] = await all<any>(subtreeStatsQuery(nicklas, 1));
		// Ricky's "Week 2 Notes" folder and his note inside it.
		expect(mine).toEqual({ height: 2, foreign_folders: 1, foreign_notes: 1 });
		const [leaf] = await all<any>(subtreeStatsQuery(week1, 1));
		expect(leaf).toEqual({ height: 1, foreign_folders: 0, foreign_notes: 0 });
		const [asRicky] = await all<any>(subtreeStatsQuery(week1, 2));
		expect(asRicky).toEqual({ height: 1, foreign_folders: 0, foreign_notes: 1 });
	});

	it('moves a note and relabels its subject', async () => {
		const id = await addNote('Movable', task1, 2, 'English Advanced');
		await exec([moveNoteStatement(id, physicsTask2, 'Physics')]);
		const moved = await env.DB.prepare('SELECT folder_id, subject FROM resources WHERE id = ?').bind(id).first();
		expect(moved).toEqual({ folder_id: physicsTask2, subject: 'Physics' });
	});

	it('moves a folder with everything under it', async () => {
		const top = await addFolder('Movable folder', task1, 2);
		const sub = await addFolder('Sub', top, 2);
		const inTop = await addNote('In top', top, 2, 'English Advanced');
		const inSub = await addNote('In sub', sub, 2, 'English Advanced');
		const outside = await addNote('Outside', task1, 2, 'English Advanced');

		await exec(moveFolderStatements(top, physicsTask2, 'Physics'));
		expect(await chainNames(sub)).toEqual(['Physics', 'Task 2', 'Movable folder', 'Sub']);
		const subjects = await env.DB.prepare('SELECT id, subject FROM resources WHERE id IN (?, ?, ?) ORDER BY id').bind(inTop, inSub, outside).all();
		expect(subjects.results).toEqual([
			{ id: inTop, subject: 'Physics' },
			{ id: inSub, subject: 'Physics' },
			{ id: outside, subject: 'English Advanced' },
		]);

		// Root folders are never moved, even if a handler forgot to check.
		await exec(moveFolderStatements(task1, physicsTask2, 'Physics'));
		expect(await chainNames(task1)).toEqual(['English Advanced', 'Task 1']);
	});

	it('removes into the trash, remembers the origin, and restores', async () => {
		const id = await addNote('Doomed', task1, 2, 'English Advanced');
		await exec([removeNoteStatement(id, trash, 5)]);
		const removed = await env.DB.prepare('SELECT folder_id, removed_from_id, removed_by, removed_at IS NOT NULL AS stamped FROM resources WHERE id = ?')
			.bind(id)
			.first();
		expect(removed).toEqual({ folder_id: trash, removed_from_id: task1, removed_by: 5, stamped: 1 });
		const inTrash = await all<any>(folderNotesQuery(trash));
		expect(inTrash.find((n) => n.id === id)).toMatchObject({ removed_from_name: 'Task 1' });

		// Restoring is a move back to where it came from.
		await exec([moveNoteStatement(id, task1, 'English Advanced')]);
		const restored = await env.DB.prepare('SELECT folder_id, removed_from_id, removed_by, removed_at FROM resources WHERE id = ?').bind(id).first();
		expect(restored).toEqual({ folder_id: task1, removed_from_id: null, removed_by: null, removed_at: null });

		const f = await addFolder('Doomed folder', task1, 2);
		await addNote('Inside doomed', f, 2, 'English Advanced');
		await exec([removeFolderStatement(f, trash, 5)]);
		expect(await chainNames(f)).toEqual(['Removed', 'Doomed folder']);
		const row = await env.DB.prepare('SELECT removed_from_id, removed_by FROM resource_folders WHERE id = ?').bind(f).first();
		expect(row).toEqual({ removed_from_id: task1, removed_by: 5 });

		// Root folders are never removed, even if a handler forgot to check.
		await exec([removeFolderStatement(task1, trash, 5)]);
		expect(await chainNames(task1)).toEqual(['English Advanced', 'Task 1']);
	});

	it('leaves removed notes out of counts, search and recent lists', async () => {
		const f = await addFolder('Hidden folder', task1, 2);
		const hidden = await addNote('Hidden zebra', f, 2, 'English Advanced');
		const direct = await addNote('Removed zebra', task1, 2, 'English Advanced');
		const kept = await addNote('Visible zebra', task1, 2, 'English Advanced');
		await exec([removeFolderStatement(f, trash, 5), removeNoteStatement(direct, trash, 5)]);

		const found = await all<any>(notesQuery({ search: 'zebra', limit: 50 }));
		expect(found.map((n) => n.id)).toEqual([kept]);
		expect(found[0]).toMatchObject({ folder_name: 'Task 1', folder_kind: 'section', first_name: 'Ricky' });

		const recent = await all<any>(notesQuery({ limit: 200 }));
		expect(recent.map((n) => n.id)).not.toContain(hidden);
		expect(recent.map((n) => n.id)).not.toContain(direct);

		const before = (await env.DB.prepare(SUBJECT_COUNTS_SQL).all<any>()).results.find((r) => r.subject === 'English Advanced').notes;
		await exec([removeNoteStatement(kept, trash, 5)]);
		const after = (await env.DB.prepare(SUBJECT_COUNTS_SQL).all<any>()).results.find((r) => r.subject === 'English Advanced').notes;
		expect(after).toBe(before - 1);
	});

	it('searches titles and descriptions, treating % and _ literally', async () => {
		expect((await all<any>(notesQuery({ search: 'discrete', limit: 10 }))).map((n) => n.title)).toEqual(['Some Discrete note']);
		expect((await all<any>(notesQuery({ search: 'opening scenes', limit: 10 }))).map((n) => n.title)).toEqual(['Week 1']);
		expect((await all<any>(notesQuery({ search: '100%', limit: 10 }))).map((n) => n.title)).toEqual(['Some Discrete note']);
		expect(await all(notesQuery({ search: '1_0', limit: 10 }))).toEqual([]);
		expect(await all(notesQuery({ search: '%', limit: 1 }))).toHaveLength(1);
	});

	it('narrows to one uploader and honours the limit', async () => {
		const mine = await all<any>(notesQuery({ uploaderId: 1, limit: 50 }));
		expect(mine.map((n) => n.title)).toEqual(['Week 1']);
		expect(await all(notesQuery({ limit: 2 }))).toHaveLength(2);
	});
});
