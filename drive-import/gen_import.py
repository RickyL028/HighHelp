"""Turn manifest.json into import.sql (D1) and uploads.tsv (R2 key <TAB> local path).

Usage: python3 -I gen_import.py <manifest.json> <drive dir> <out dir> <base timestamp ms>
Each imported file becomes one note owned by user 404, inside a copy of the drive's folder tree
under its subject's HSC or Trial section. Folders are created owner-only so the archive stays sorted.
"""
import json
import os
import re
import sys

MANIFEST, DRIVE, OUT, BASE = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4])
OWNER = 404
IMAGE_EXT = {'jpg', 'jpeg', 'png', 'webp'}
SECTIONS = [('Task 1', 1), ('Task 2', 2), ('Task 3', 3), ('Task 4', 4), ('Trial', 5), ('HSC', 6), ('Unfiled', 7)]
NEW_SUBJECTS = ['Studies of Religion I (HSC)', 'English Extension 2 (HSC)', 'Chinese Continuers (HSC)', 'Latin (HSC)', 'Music Extension (HSC)']


def q(v):
    if v is None:
        return 'NULL'
    if isinstance(v, int):
        return str(v)
    return "'" + str(v).replace("'", "''") + "'"


def safe_key_name(name):  # same as fileKey() in src/resourceFolders.ts
    return re.sub(r'[^a-zA-Z0-9.-]', '_', name)[-120:] or 'file'


# Files dropped after uploading began keep their place in the numbering, so every other file keeps
# the R2 key it was (or will be) uploaded under; they are then left out.
LATE = 'commercial trial or tutoring material (late)'
numbered = [f for f in json.load(open(MANIFEST))['files'] if 'skip' not in f or f['skip'] == LATE]
for i, f in enumerate(numbered):
    f['index'] = i
files = [f for f in numbered if 'skip' not in f]
sql = [
    '-- Import of the SBHS 2026 shared drive. Generated; run once with:',
    '--   npx wrangler d1 execute highhelp-db --remote --file <this file>',
        "UPDATE users SET last_name = '''26' WHERE id = 404 AND first_name = 'SBHS';",
    '-- Root folders for the subjects added to src/constants.ts (the site would also create these on first visit).',
]
for s in NEW_SUBJECTS:
    sql.append(f"INSERT OR IGNORE INTO resource_folders (name, kind, subject) VALUES ({q(s)}, 'subject', {q(s)});")
sections = ', '.join(f'({q(n)}, {p})' for n, p in SECTIONS)
sql.append(
    f"WITH s(name, position) AS (VALUES {sections}) INSERT OR IGNORE INTO resource_folders (parent_id, name, kind, position) "
    "SELECT f.id, s.name, 'section', s.position FROM resource_folders f JOIN s WHERE f.kind = 'subject' ORDER BY f.id, s.position;"
)
sql.append('CREATE TABLE _drive_import_map (k INTEGER PRIMARY KEY, folder_id INTEGER NOT NULL);')

# Folder keys: one per (subject, section, folder path prefix).
keys = {}


def key_for(path):
    if path not in keys:
        keys[path] = len(keys) + 1
    return keys[path]


for f in files:
    for depth in range(len(f['folders']) + 1):
        key_for((f['subject'], f['section'], tuple(f['folders'][:depth])))

for path, k in sorted(keys.items(), key=lambda kv: (len(kv[0][2]), kv[1])):
    subject, section, folders = path
    if not folders:
        sql.append(
            f"INSERT INTO _drive_import_map (k, folder_id) SELECT {k}, s.id FROM resource_folders s JOIN resource_folders p ON p.id = s.parent_id "
            f"WHERE p.kind = 'subject' AND p.subject = {q(subject)} AND s.kind = 'section' AND s.name = {q(section)};"
        )
        continue
    parent = keys[(subject, section, folders[:-1])]
    sql.append(
        f"INSERT INTO resource_folders (parent_id, name, kind, access, creator_id) "
        f"VALUES ((SELECT folder_id FROM _drive_import_map WHERE k = {parent}), {q(folders[-1])}, 'folder', 'owner', {OWNER});"
    )
    sql.append(
        f"INSERT INTO _drive_import_map (k, folder_id) SELECT {k}, MAX(id) FROM resource_folders "
        f"WHERE parent_id = (SELECT folder_id FROM _drive_import_map WHERE k = {parent}) AND name = {q(folders[-1])} AND kind = 'folder' AND creator_id = {OWNER};"
    )

uploads = []
for f in files:
    i = f['index']
    file_name = f['file_name']
    if f['ext'] == 'heic':  # converted to JPEG before upload, so every browser can show it
        file_name = file_name.rsplit('.', 1)[0] + '.jpg'
    key = f'resources/{BASE}-{i}-{safe_key_name(file_name)}'
    # Images are re-encoded without metadata (phone photos carry GPS locations), so their size is unknown here.
    mode = 'heic' if f['ext'] == 'heic' else 'img' if f['ext'] in IMAGE_EXT else '-'
    uploads.append((key, f['path'], mode))
    folder_key = keys[(f['subject'], f['section'], tuple(f['folders']))]
    where = '/'.join(f['path'].split('/')[:-1])
    desc = f'From the SBHS 2026 shared drive: {where}'
    sql.append(
        "INSERT INTO resources (title, description, file_key, subject, type, uploader_id, uploader_display, folder_id) "
        f"VALUES ({q(f['title'])}, {q(desc)}, {q(key)}, {q(f['subject'])}, 'resource', {OWNER}, 'full', "
        f"(SELECT folder_id FROM _drive_import_map WHERE k = {folder_key}));"
    )
    sql.append(
        "INSERT INTO resource_files (resource_id, file_key, file_name, size, uploader_id) "
        f"SELECT id, {q(key)}, {q(file_name)}, {'NULL' if f['ext'] in IMAGE_EXT or f['ext'] == 'heic' else f['size']}, {OWNER} FROM resources WHERE file_key = {q(key)};"
    )

# resources.file_key is legacy ('' on new rows); it was only used above to pair each note with its file.
sql.append(f"UPDATE resources SET file_key = '' WHERE file_key LIKE 'resources/{BASE}-%' AND uploader_id = {OWNER};")
sql.append('DROP TABLE _drive_import_map;')
open(os.path.join(OUT, 'import.sql'), 'w').write('\n'.join(sql) + '\n')
with open(os.path.join(OUT, 'uploads.tsv'), 'w') as out:
    for key, path, mode in uploads:
        out.write(f'{key}\t{path}\t{mode}\n')
print(len(files), 'notes,', len(keys) - len({(s, sec) for s, sec, _ in keys}), 'folders,', len(sql), 'statements')
