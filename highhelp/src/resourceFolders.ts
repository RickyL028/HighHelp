// The Resources folder tree: who may do what, and the SQL the routes run (src/routes/resources.tsx).
//
//   subject folder            kind 'subject'  one per subject, parent_id NULL
//     Task 1 … HSC, Unfiled   kind 'section'  seven per subject
//       user folders          kind 'folder'   any depth
//         notes               resources.folder_id
//           attached files    resource_files
//   Removed                   kind 'trash'    parent_id NULL, admins only
//
// A "chain" is a folder's path from its top-level ancestor down to the folder itself. Everything
// about where an item lives is read off the chain: its subject is the chain's first folder, and it
// is removed exactly when that first folder is the trash. Removing is a move into the trash;
// restoring is a move back out.
//
// Everything here is pure (rules) or builds { sql, params } (queries), so it can be tested without
// the route handlers. D1 counts parameter occurrences, so each `?` is bound once, in order.

import { SUBJECTS } from './constants';
import { PermissionLevel, canModerateSubject, canUploadResource } from './permissions';
import { User } from './types';

export const SECTION_NAMES = ['Task 1', 'Task 2', 'Task 3', 'Task 4', 'Trial', 'HSC', 'Unfiled'] as const;
export const TRASH_NAME = 'Removed';
export const MAX_FOLDER_NAME = 60;
export const MAX_NOTE_TITLE = 150;
// Longest allowed chain: subject + section + ten levels of user folders.
export const MAX_CHAIN = 12;
// A note carries zero to three attached files.
export const MAX_FILES_PER_NOTE = 3;
export const MAX_FILE_SIZE = 50 * 1024 * 1024;

export type FolderKind = 'subject' | 'section' | 'folder' | 'trash';
export type FolderAccess = 'everyone' | 'owner';

export interface FolderRow {
	id: number;
	parent_id: number | null;
	name: string;
	kind: FolderKind;
	subject: string | null;
	access: FolderAccess;
	creator_id: number | null;
}

export interface NoteRow {
	id: number;
	folder_id: number | null;
	uploader_id: number | null;
	subject: string;
}

export type Statement = { sql: string; params: (string | number | null)[] };

type Actor = User | null | undefined;

// ---------------------------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------------------------

export const isAdmin = (user: Actor): boolean => !!user && Number(user.permission_level) >= PermissionLevel.ADMIN;

// Subject folders, their seven sections and the trash: never renamed, moved or removed.
export const isRootFolder = (folder: Pick<FolderRow, 'kind'>): boolean => folder.kind !== 'folder';

export const chainInTrash = (chain: FolderRow[]): boolean => chain[0]?.kind === 'trash';
export const chainSubject = (chain: FolderRow[]): string | null => (chain[0]?.kind === 'subject' ? chain[0].subject : null);

// The Removed folder and everything in it is for admins only.
export const canSeeChain = (user: Actor, chain: FolderRow[]): boolean => !chainInTrash(chain) || isAdmin(user);

// "The creator of a folder can also move resources out of their folder": true when the user made
// any of the user folders in this chain.
const ownsFolderInChain = (user: User, chain: FolderRow[]): boolean => chain.some((f) => f.kind === 'folder' && f.creator_id === user.id);

// Why the user cannot create (or move) something into the last folder of `chain`, or null if they can.
export function addToFolderError(user: Actor, chain: FolderRow[]): string | null {
	const folder = chain[chain.length - 1];
	if (!folder) return 'That folder does not exist.';
	if (!user) return 'Sign in to add resources.';
	if (!canUploadResource(user)) return 'Agree to the website guidelines before adding resources.';
	if (chainInTrash(chain)) return 'Nothing can be added to the Removed folder.';
	// A subject only ever holds its seven sections; notes and folders go inside one of those.
	if (folder.kind === 'subject') return 'Open one of the folders inside this subject first, such as Task 1 or Unfiled.';
	if (isAdmin(user)) return null;
	if (folder.access === 'owner' && folder.creator_id !== user.id) return 'Only the owner of this folder can add to it.';
	return null;
}

export const canAddToFolder = (user: Actor, chain: FolderRow[]): boolean => addToFolderError(user, chain) === null;

// `chain` is the chain of the folder the note sits in.
export function canEditNote(user: Actor, note: NoteRow, chain: FolderRow[]): boolean {
	if (!user) return false;
	if (isAdmin(user)) return true;
	return !chainInTrash(chain) && note.uploader_id === user.id;
}

export function canMoveNote(user: Actor, note: NoteRow, chain: FolderRow[]): boolean {
	if (!user) return false;
	if (isAdmin(user)) return true;
	if (chainInTrash(chain)) return false;
	return note.uploader_id === user.id || ownsFolderInChain(user, chain);
}

// Removal keeps the old moderation rule: the uploader, or anyone who moderates the subject.
export function canRemoveNote(user: Actor, note: NoteRow, chain: FolderRow[]): boolean {
	if (!user || chainInTrash(chain)) return false;
	return note.uploader_id === user.id || canModerateSubject(user, note.subject);
}

// `chain` ends with the folder itself. Rename and the who-can-add switch.
export function canEditFolder(user: Actor, chain: FolderRow[]): boolean {
	const folder = chain[chain.length - 1];
	if (!user || !folder || isRootFolder(folder)) return false;
	if (isAdmin(user)) return true;
	return !chainInTrash(chain) && folder.creator_id === user.id;
}

export function canMoveFolder(user: Actor, chain: FolderRow[]): boolean {
	const folder = chain[chain.length - 1];
	if (!user || !folder || isRootFolder(folder)) return false;
	if (isAdmin(user)) return true;
	if (chainInTrash(chain)) return false;
	return folder.creator_id === user.id || ownsFolderInChain(user, chain.slice(0, -1));
}

// Why the user cannot remove the last folder of `chain`, or null if they can. `foreignItems` is how
// many folders and notes inside it belong to someone else (subtreeStatsQuery): an owner has to move
// those out first, so one student cannot take other people's work down with their folder.
export function removeFolderError(user: Actor, chain: FolderRow[], foreignItems: number): string | null {
	const folder = chain[chain.length - 1];
	if (!folder) return 'That folder does not exist.';
	if (!user) return 'Sign in first.';
	if (isRootFolder(folder)) return 'This folder cannot be removed.';
	if (chainInTrash(chain)) return 'This folder has already been removed.';
	if (canModerateSubject(user, chainSubject(chain) || '')) return null;
	if (folder.creator_id !== user.id) return 'Only the owner of this folder can remove it.';
	if (foreignItems > 0) return 'This folder holds other people\'s resources. Move them out before removing it.';
	return null;
}

// Why an item the user is allowed to move cannot go into the last folder of `destChain`, or null.
// `subtreeHeight` is how many folder levels a moved folder brings with it (1 for a folder with no
// sub-folders); leave it out for notes.
export function moveError(opts: {
	user: Actor;
	kind: 'note' | 'folder';
	itemId: number;
	fromFolderId: number | null;
	destChain: FolderRow[];
	subtreeHeight?: number;
}): string | null {
	const { user, kind, itemId, fromFolderId, destChain } = opts;
	const dest = destChain[destChain.length - 1];
	if (!dest) return 'Choose a folder to move it into.';
	if (chainInTrash(destChain)) return 'To remove something, use Remove.';
	if (kind === 'folder' && destChain.some((f) => f.id === itemId)) return 'A folder cannot be moved into itself.';
	if (dest.id === fromFolderId) return 'It is already in this folder.';
	const addError = addToFolderError(user, destChain);
	if (addError) return addError;
	if (kind === 'folder' && destChain.length + (opts.subtreeHeight || 1) > MAX_CHAIN) return 'Folders cannot be nested that deeply.';
	return null;
}

// Tidy a folder name, or say why it is not allowed.
export function cleanFolderName(raw: unknown): { name: string } | { error: string } {
	const name = String(raw ?? '')
		.replace(/[\u0000-\u001f\u007f]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
	if (!name) return { error: 'Give the folder a name.' };
	if (name.length > MAX_FOLDER_NAME) return { error: `Folder names can be at most ${MAX_FOLDER_NAME} characters.` };
	return { name };
}

export const cleanAccess = (raw: unknown): FolderAccess => (raw === 'owner' ? 'owner' : 'everyone');

// The files worth keeping from an upload field: browsers send one empty File when nothing is chosen.
export function uploadedFiles(field: unknown): File[] {
	const list = Array.isArray(field) ? field : [field];
	return list.filter((f): f is File => typeof f === 'object' && f !== null && 'size' in f && 'name' in f && (f as File).size > 0);
}

// `existing` is how many files the note already has.
export function uploadError(files: File[], existing = 0): string | null {
	if (existing + files.length > MAX_FILES_PER_NOTE) {
		return existing
			? `A note can hold at most ${MAX_FILES_PER_NOTE} files, and this one already has ${existing}.`
			: `A note can hold at most ${MAX_FILES_PER_NOTE} files.`;
	}
	const tooBig = files.find((f) => f.size > MAX_FILE_SIZE);
	if (tooBig) return `"${tooBig.name}" is too large. The maximum size is 50 MB per file.`;
	return null;
}

// The R2 key for an uploaded file. `index` keeps files uploaded in the same millisecond apart.
export function fileKey(fileName: string, now: number, index: number): string {
	const safe = fileName.replace(/[^a-zA-Z0-9.-]/g, '_').slice(-120) || 'file';
	return `resources/${now}-${index}-${safe}`;
}

export function formatBytes(size: number | null | undefined): string {
	if (size === null || size === undefined) return '';
	if (size < 1024) return `${size} B`;
	if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
	return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export type PreviewKind = 'pdf' | 'image' | 'text' | null;
export function previewKind(fileName: string): PreviewKind {
	const ext = fileName.split('.').pop()?.toLowerCase() || '';
	if (ext === 'pdf') return 'pdf';
	if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image';
	if (['txt', 'csv', 'md'].includes(ext)) return 'text';
	return null;
}

// What sort of file this is, for its icon.
export type FileKind = 'pdf' | 'image' | 'doc' | 'sheet' | 'slides' | 'media' | 'archive' | 'text' | 'other';
const FILE_KINDS: Record<string, FileKind> = {
	pdf: 'pdf',
	jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', webp: 'image', heic: 'image', svg: 'image',
	doc: 'doc', docx: 'doc', pages: 'doc', odt: 'doc', rtf: 'doc',
	xls: 'sheet', xlsx: 'sheet', csv: 'sheet', numbers: 'sheet',
	ppt: 'slides', pptx: 'slides', key: 'slides',
	mp4: 'media', mov: 'media', mp3: 'media', m4a: 'media', wav: 'media',
	zip: 'archive', rar: 'archive', '7z': 'archive',
	txt: 'text', md: 'text',
};
export function fileKind(fileName: string): FileKind {
	const dot = fileName.lastIndexOf('.');
	return (dot === -1 ? undefined : FILE_KINDS[fileName.slice(dot + 1).toLowerCase()]) || 'other';
}

// ---------------------------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------------------------

const FOLDER_COLUMNS = 'id, parent_id, name, kind, subject, access, creator_id';

// Every folder under the trash, for "is not removed" filters: `folder_id NOT IN (SELECT id FROM removed)`.
export const REMOVED_CTE = `removed(id) AS (
	SELECT id FROM resource_folders WHERE kind = 'trash'
	UNION ALL
	SELECT f.id FROM resource_folders f JOIN removed r ON f.parent_id = r.id
)`;

// A folder and everything under it. Binds one parameter: the folder id.
const TREE_CTE = `tree(id, level) AS (
	SELECT id, 1 FROM resource_folders WHERE id = ?
	UNION ALL
	SELECT f.id, t.level + 1 FROM resource_folders f JOIN tree t ON f.parent_id = t.id WHERE t.level < 64
)`;

// The chain of a folder: its top-level ancestor first, the folder itself last.
export function folderChainQuery(folderId: number): Statement {
	return {
		sql: `WITH RECURSIVE chain(${FOLDER_COLUMNS}, hops) AS (
			SELECT ${FOLDER_COLUMNS}, 0 FROM resource_folders WHERE id = ?
			UNION ALL
			SELECT ${FOLDER_COLUMNS.split(', ')
				.map((c) => `f.${c}`)
				.join(', ')}, c.hops + 1
			FROM resource_folders f JOIN chain c ON f.id = c.parent_id
			WHERE c.hops < 64
		)
		SELECT ${FOLDER_COLUMNS} FROM chain ORDER BY hops DESC`,
		params: [folderId],
	};
}

// Sub-folders of a folder, with what each holds and who made it. Sections keep their fixed order.
export function childFoldersQuery(parentId: number): Statement {
	return {
		sql: `SELECT f.*, u.first_name, u.last_name, src.name AS removed_from_name,
			(SELECT COUNT(*) FROM resource_folders c WHERE c.parent_id = f.id) AS folder_count,
			(SELECT COUNT(*) FROM resources r WHERE r.folder_id = f.id) AS note_count
		FROM resource_folders f
		LEFT JOIN users u ON u.id = f.creator_id
		LEFT JOIN resource_folders src ON src.id = f.removed_from_id
		WHERE f.parent_id = ?
		ORDER BY f.position, f.name COLLATE NOCASE, f.id`,
		params: [parentId],
	};
}

// Notes directly inside a folder.
export function folderNotesQuery(folderId: number): Statement {
	return {
		sql: `SELECT r.*, u.first_name, u.last_name, u.tags, src.name AS removed_from_name,
			(SELECT COUNT(*) FROM resource_files rf WHERE rf.resource_id = r.id AND rf.is_deleted = 0) AS file_count
		FROM resources r
		LEFT JOIN users u ON u.id = r.uploader_id
		LEFT JOIN resource_folders src ON src.id = r.removed_from_id
		WHERE r.folder_id = ?
		ORDER BY r.title COLLATE NOCASE, r.id`,
		params: [folderId],
	};
}

// The attached files of every note directly inside a folder, for the expandable rows.
export function folderFilesQuery(folderId: number): Statement {
	return {
		sql: `SELECT rf.id, rf.resource_id, rf.file_key, rf.file_name, rf.size
		FROM resource_files rf
		JOIN resources r ON r.id = rf.resource_id
		WHERE r.folder_id = ? AND rf.is_deleted = 0
		ORDER BY rf.id`,
		params: [folderId],
	};
}

export function noteFilesQuery(noteId: number): Statement {
	return {
		sql: `SELECT id, resource_id, file_key, file_name, size FROM resource_files WHERE resource_id = ? AND is_deleted = 0 ORDER BY id`,
		params: [noteId],
	};
}

const placeholders = (ids: number[]) => ids.map(() => '?').join(', ');

// For the navigation tree: the sub-folders of several folders at once, with what each holds.
export function treeFoldersQuery(parentIds: number[]): Statement {
	return {
		sql: `SELECT f.id, f.parent_id, f.name, f.kind, f.subject, f.access, f.creator_id,
			(SELECT COUNT(*) FROM resource_folders c WHERE c.parent_id = f.id) AS folder_count,
			(SELECT COUNT(*) FROM resources r WHERE r.folder_id = f.id) AS note_count
		FROM resource_folders f
		WHERE f.parent_id IN (${placeholders(parentIds)})
		ORDER BY f.position, f.name COLLATE NOCASE, f.id`,
		params: parentIds,
	};
}

// … and the notes directly inside them.
export function treeNotesQuery(folderIds: number[]): Statement {
	return {
		sql: `SELECT id, folder_id, title FROM resources WHERE folder_id IN (${placeholders(folderIds)}) ORDER BY title COLLATE NOCASE, id`,
		params: folderIds,
	};
}

// Every folder from `rootId` down, parents before children, for the branch diagram.
export function subtreeFoldersQuery(rootId: number): Statement {
	return {
		sql: `WITH RECURSIVE ${TREE_CTE}
		SELECT f.id, f.parent_id, f.name, f.kind, f.subject, f.access, f.creator_id,
			(SELECT COUNT(*) FROM resources r WHERE r.folder_id = f.id) AS note_count
		FROM resource_folders f JOIN tree t ON t.id = f.id
		ORDER BY t.level, f.position, f.name COLLATE NOCASE, f.id`,
		params: [rootId],
	};
}

// … and every note in those folders.
export function subtreeNotesQuery(rootId: number): Statement {
	return {
		sql: `WITH RECURSIVE ${TREE_CTE}
		SELECT r.id, r.folder_id, r.title FROM resources r JOIN tree t ON t.id = r.folder_id ORDER BY r.title COLLATE NOCASE, r.id`,
		params: [rootId],
	};
}

// The same two lists for the whole site, minus the trash and everything in it (the front page's diagram).
export const LIVE_FOLDERS_SQL = `WITH RECURSIVE ${REMOVED_CTE}
SELECT f.id, f.parent_id, f.name, f.kind, f.subject, f.access, f.creator_id,
	(SELECT COUNT(*) FROM resources r WHERE r.folder_id = f.id) AS note_count
FROM resource_folders f
WHERE f.id NOT IN (SELECT id FROM removed)
ORDER BY f.position, f.name COLLATE NOCASE, f.id`;

export const LIVE_NOTES_SQL = `WITH RECURSIVE ${REMOVED_CTE}
SELECT r.id, r.folder_id, r.title
FROM resources r
WHERE r.folder_id IS NOT NULL AND r.folder_id NOT IN (SELECT id FROM removed)
ORDER BY r.title COLLATE NOCASE, r.id`;

// Only the notes the front page's diagram draws straight away: those sitting directly in a subject
// or a section. Student folders start closed there, and their notes are fetched when one is opened.
export const LIVE_TOP_NOTES_SQL = `WITH RECURSIVE ${REMOVED_CTE}
SELECT r.id, r.folder_id, r.title
FROM resources r
JOIN resource_folders f ON f.id = r.folder_id
WHERE f.kind IN ('subject', 'section') AND r.folder_id NOT IN (SELECT id FROM removed)
ORDER BY r.title COLLATE NOCASE, r.id`;

export type FolderBranch<T> = T & { children: FolderBranch<T>[] };

// Nest the rows of subtreeFoldersQuery under `rootId`, keeping their order. Rows whose parent is
// not among them are dropped.
export function buildFolderTree<T extends { id: number; parent_id: number | null }>(rows: T[], rootId: number): FolderBranch<T> | null {
	const byId = new Map<number, FolderBranch<T>>();
	for (const row of rows) byId.set(row.id, { ...row, children: [] });
	for (const row of rows) {
		if (row.id === rootId || row.parent_id === null) continue;
		byId.get(row.parent_id)?.children.push(byId.get(row.id)!);
	}
	return byId.get(rootId) || null;
}

// "A user can only have one empty folder at a time": the user's folders that hold nothing and have
// not been removed. Checked before they create another.
export function emptyFoldersQuery(userId: number): Statement {
	return {
		sql: `WITH RECURSIVE ${REMOVED_CTE}
		SELECT f.id, f.name
		FROM resource_folders f
		WHERE f.creator_id = ? AND f.kind = 'folder'
			AND f.id NOT IN (SELECT id FROM removed)
			AND NOT EXISTS (SELECT 1 FROM resource_folders c WHERE c.parent_id = f.id)
			AND NOT EXISTS (SELECT 1 FROM resources r WHERE r.folder_id = f.id)
		ORDER BY f.id
		LIMIT 1`,
		params: [userId],
	};
}

// Creates a folder, unless its creator already has an empty one: the check and the insert are one
// statement, so two quick submissions cannot both get through. `meta.changes` is 0 when refused.
export function createFolderStatement(opts: { parentId: number; name: string; access: FolderAccess; userId: number }): Statement {
	return {
		sql: `WITH RECURSIVE ${REMOVED_CTE}
		INSERT INTO resource_folders (parent_id, name, kind, access, creator_id)
		SELECT ?, ?, 'folder', ?, ?
		WHERE NOT EXISTS (
			SELECT 1 FROM resource_folders f
			WHERE f.creator_id = ? AND f.kind = 'folder'
				AND f.id NOT IN (SELECT id FROM removed)
				AND NOT EXISTS (SELECT 1 FROM resource_folders c WHERE c.parent_id = f.id)
				AND NOT EXISTS (SELECT 1 FROM resources r WHERE r.folder_id = f.id)
		)`,
		params: [opts.parentId, opts.name, opts.access, opts.userId, opts.userId],
	};
}

// For a folder: how many folder levels it spans (1 when it has no sub-folders), and how many of the
// folders and notes inside it were made by someone other than `userId`.
export function subtreeStatsQuery(folderId: number, userId: number): Statement {
	return {
		sql: `WITH RECURSIVE ${TREE_CTE}
		SELECT
			(SELECT MAX(level) FROM tree) AS height,
			(SELECT COUNT(*) FROM resource_folders f JOIN tree t ON t.id = f.id WHERE t.level > 1 AND COALESCE(f.creator_id, -1) != ?) AS foreign_folders,
			(SELECT COUNT(*) FROM resources r JOIN tree t ON t.id = r.folder_id WHERE COALESCE(r.uploader_id, -1) != ?) AS foreign_notes`,
		params: [folderId, userId, userId],
	};
}

// Move a note. `subject` is the destination chain's subject, or null to keep the note's own (it
// only is when the destination is not under a subject, which the rules never allow).
export function moveNoteStatement(noteId: number, destFolderId: number, subject: string | null): Statement {
	return {
		sql: `UPDATE resources
		SET folder_id = ?, subject = COALESCE(?, subject), removed_from_id = NULL, removed_by = NULL, removed_at = NULL
		WHERE id = ?`,
		params: [destFolderId, subject, noteId],
	};
}

// Move a folder, and re-label every note under it with the destination's subject.
export function moveFolderStatements(folderId: number, destFolderId: number, subject: string | null): Statement[] {
	return [
		{
			sql: `UPDATE resource_folders
			SET parent_id = ?, removed_from_id = NULL, removed_by = NULL, removed_at = NULL
			WHERE id = ? AND kind = 'folder'`,
			params: [destFolderId, folderId],
		},
		{
			sql: `WITH RECURSIVE ${TREE_CTE}
			UPDATE resources SET subject = COALESCE(?, subject) WHERE folder_id IN (SELECT id FROM tree)`,
			params: [folderId, subject],
		},
	];
}

// Removing is a move into the trash that remembers where the item was.
export function removeNoteStatement(noteId: number, trashId: number, userId: number): Statement {
	return {
		sql: `UPDATE resources
		SET removed_from_id = folder_id, folder_id = ?, removed_by = ?, removed_at = CURRENT_TIMESTAMP
		WHERE id = ?`,
		params: [trashId, userId, noteId],
	};
}

export function removeFolderStatement(folderId: number, trashId: number, userId: number): Statement {
	return {
		sql: `UPDATE resource_folders
		SET removed_from_id = parent_id, parent_id = ?, removed_by = ?, removed_at = CURRENT_TIMESTAMP
		WHERE id = ? AND kind = 'folder'`,
		params: [trashId, userId, folderId],
	};
}

// Root folders that should exist but do not: canonical subjects without a folder, and the trash.
export function missingRoots(existing: Pick<FolderRow, 'kind' | 'subject'>[]): { subjects: string[]; trash: boolean } {
	const have = new Set(existing.filter((f) => f.kind === 'subject').map((f) => f.subject));
	return {
		subjects: SUBJECTS.filter((s) => !have.has(s)),
		trash: !existing.some((f) => f.kind === 'trash'),
	};
}

// Creates the given subject folders, the trash, and any missing section of any subject. Safe to
// run twice: the unique indexes on resource_folders turn repeats into no-ops.
export function createRootsStatements(subjects: readonly string[]): Statement[] {
	// A VALUES list rather than UNION ALL: D1 caps a compound SELECT at five terms.
	const sections = SECTION_NAMES.map((name, i) => `('${name}', ${i + 1})`).join(', ');
	return [
		...subjects.map((s) => ({
			sql: `INSERT OR IGNORE INTO resource_folders (name, kind, subject) VALUES (?, 'subject', ?)`,
			params: [s, s],
		})),
		{ sql: `INSERT OR IGNORE INTO resource_folders (name, kind) VALUES ('${TRASH_NAME}', 'trash')`, params: [] },
		{
			sql: `WITH s(name, position) AS (VALUES ${sections})
			INSERT OR IGNORE INTO resource_folders (parent_id, name, kind, position)
			SELECT f.id, s.name, 'section', s.position
			FROM resource_folders f JOIN s
			WHERE f.kind = 'subject'
			ORDER BY f.id, s.position`,
			params: [],
		},
	];
}

// Top-level folders: the subjects and the trash.
export const ROOT_FOLDERS_SQL = `SELECT ${FOLDER_COLUMNS} FROM resource_folders WHERE parent_id IS NULL ORDER BY id`;

// Notes per subject, not counting removed ones.
export const SUBJECT_COUNTS_SQL = `WITH RECURSIVE ${REMOVED_CTE}
SELECT subject, COUNT(*) AS notes
FROM resources
WHERE folder_id IS NOT NULL AND folder_id NOT IN (SELECT id FROM removed)
GROUP BY subject`;

const escapeLike = (term: string) => term.replace(/[\\%_]/g, (ch) => `\\${ch}`);

// Notes that are not removed, newest first; with `search`, only those whose title or description
// contains it. `uploaderId` narrows to one person's notes (the profile page).
export function notesQuery(opts: { search?: string; uploaderId?: number; limit: number }): Statement {
	const where = ['r.folder_id IS NOT NULL', 'r.folder_id NOT IN (SELECT id FROM removed)'];
	const params: (string | number)[] = [];
	const term = (opts.search || '').trim();
	if (term) {
		where.push(`(r.title LIKE ? ESCAPE '\\' OR r.description LIKE ? ESCAPE '\\')`);
		const like = `%${escapeLike(term)}%`;
		params.push(like, like);
	}
	if (opts.uploaderId !== undefined) {
		where.push('r.uploader_id = ?');
		params.push(opts.uploaderId);
	}
	params.push(opts.limit);
	return {
		sql: `WITH RECURSIVE ${REMOVED_CTE}
		SELECT r.*, u.first_name, u.last_name, u.tags, f.name AS folder_name, f.kind AS folder_kind,
			(SELECT COUNT(*) FROM resource_files rf WHERE rf.resource_id = r.id AND rf.is_deleted = 0) AS file_count
		FROM resources r
		LEFT JOIN users u ON u.id = r.uploader_id
		LEFT JOIN resource_folders f ON f.id = r.folder_id
		WHERE ${where.join(' AND ')}
		ORDER BY r.created_at DESC, r.id DESC
		LIMIT ?`,
		params,
	};
}
