"""Turn plan.json into moves.sql, keeping each note's folder path under its new section.

Usage: python3 -I gen_moves.py <plan.json> <notes.json> <folders.json> <out dir>
A folder whose every note goes to the same place moves whole; other notes move one by one into a
copy of their folder path. Import-owned folders (creator 404) left empty afterwards are deleted.
Every statement is guarded by the row's current parent, so anything changed on production since the
snapshot is left alone.
"""
import json
import os
import sys
from collections import defaultdict

PLAN, NOTES, FOLDERS, OUT = sys.argv[1:5]
plan = {p['note']: p for p in json.load(open(PLAN))}
notes = json.load(open(NOTES))[0]['results']
folders = {f['id']: f for f in json.load(open(FOLDERS))[0]['results']}
IMPORT_OWNER = 404

children = defaultdict(list)
for f in folders.values():
    if f['parent_id']:
        children[f['parent_id']].append(f['id'])
notes_in = defaultdict(list)
for n in notes:
    notes_in[n['folder_id']].append(n['id'])


def section_of(fid):
    while folders[fid]['kind'] == 'folder':
        fid = folders[fid]['parent_id']
    return fid


def dest_key(n):
    p = plan.get(n)
    return (p['to_subject'], p['to_section']) if p else None


def subtree_targets(fid):
    t = {dest_key(n) for n in notes_in[fid]}
    for c in children[fid]:
        t |= subtree_targets(c)
    return t


def subtree_has_notes(fid):
    return bool(notes_in[fid]) or any(subtree_has_notes(c) for c in children[fid])


# Section ids by (subject, section name).
sections = {}
for f in folders.values():
    if f['kind'] == 'section':
        sections[(folders[f['parent_id']]['subject'], f['name'])] = f['id']

# Walk each affected section top-down: move uniform folders whole, notes elsewhere one by one.
folder_moves, note_moves = [], []  # (folder id, dest key, rel names) / (note id, dest key, rel folder ids)


def walk(fid, rel):
    for n in notes_in[fid]:
        if n in plan:
            note_moves.append((n, dest_key(n), rel))
    for c in children[fid]:
        t = subtree_targets(c)
        if len(t) == 1 and None not in t and subtree_has_notes(c):
            folder_moves.append((c, next(iter(t)), rel))
        else:
            walk(c, rel + [c])


for sid in {section_of(plan[n]['src_folder']) for n in plan}:
    walk(sid, [])

# Destination folder paths: reuse an existing folder of the same name, else create one.
existing = {(f['parent_id'], f['name']): f['id'] for f in folders.values() if f['kind'] == 'folder'}
new_folders = []  # (key, parent ref, name, access, creator)
created = {}


def ref(r):
    return str(r) if isinstance(r, int) else f'(SELECT folder_id FROM _retask_map WHERE k = {r[1]})'


FOLDER_TASKS = {int(k): v for k, v in json.load(open(os.path.join(os.path.dirname(PLAN), 'folder_tasks.json'))).items()}


def ensure(dest, rel):
    parent = sections[dest]
    if dest[1].startswith('Task '):
        task = int(dest[1].split()[1])
        rel = [r for r in rel if not (FOLDER_TASKS.get(r) and task not in FOLDER_TASKS[r])]
    for src in rel:
        f = folders[src]
        if isinstance(parent, int) and (parent, f['name']) in existing:
            parent = existing[(parent, f['name'])]
            continue
        key = (dest, tuple(rel[: rel.index(src) + 1]))  # rel already filtered
        if key not in created:
            created[key] = ('new', len(created) + 1)
            new_folders.append((created[key][1], parent, f['name'], f['access'], f['creator_id']))
        parent = created[key]
    return parent


def q(v):
    return 'NULL' if v is None else str(v) if isinstance(v, int) else "'" + str(v).replace("'", "''") + "'"


sql = ['-- Move HSC notes into Task 1-4 by module/topic, and maths notes to the course they name. Generated.',
       'CREATE TABLE _retask_map (k INTEGER PRIMARY KEY, folder_id INTEGER NOT NULL);']
plans_f = [(fid, dest, rel, ensure(dest, rel)) for fid, dest, rel in folder_moves]
plans_n = [(nid, dest, rel, ensure(dest, rel)) for nid, dest, rel in note_moves]
for k, parent, name, access, creator in new_folders:
    sql.append(f"INSERT INTO resource_folders (parent_id, name, kind, access, creator_id) VALUES ({ref(parent)}, {q(name)}, 'folder', {q(access)}, "
               f"(SELECT id FROM users WHERE id = {q(creator)}));")
    sql.append(f"INSERT INTO _retask_map (k, folder_id) SELECT {k}, MAX(id) FROM resource_folders WHERE parent_id = {ref(parent)} AND name = {q(name)} AND kind = 'folder';")
for fid, dest, rel, parent in plans_f:
    f = folders[fid]
    if isinstance(parent, int) and (parent, f['name']) in existing:
        raise SystemExit(f'name clash moving folder {fid} {f["name"]}')
    sql.append(f"UPDATE resource_folders SET parent_id = {ref(parent)} WHERE id = {fid} AND parent_id = {f['parent_id']};")
for nid, dest, rel, parent in plans_n:
    sql.append(f"UPDATE resources SET folder_id = {ref(parent)} WHERE id = {nid} AND folder_id = {plan[nid]['src_folder']};")

# Keep resources.subject in step with the root of each note's folder chain (maths notes changed course).
sql.append("""WITH RECURSIVE ch(id, subject) AS (
    SELECT id, subject FROM resource_folders WHERE kind = 'subject'
    UNION ALL SELECT f.id, ch.subject FROM resource_folders f JOIN ch ON f.parent_id = ch.id
)
UPDATE resources SET subject = (SELECT subject FROM ch WHERE ch.id = resources.folder_id)
WHERE folder_id IN (SELECT id FROM ch) AND subject != (SELECT subject FROM ch WHERE ch.id = resources.folder_id);""")

# Import folders emptied by the moves, deepest first (simulated on the snapshot; guarded in SQL).
moved_folders = {fid for fid, *_ in folder_moves}
moved_notes = {nid for nid, *_ in note_moves}


def empty_after(fid):
    if fid in moved_folders:
        return False
    if any(n not in moved_notes for n in notes_in[fid]):
        return False
    return all(c in moved_folders or empty_after(c) for c in children[fid])


def depth(fid):
    d = 0
    while folders[fid]['parent_id']:
        fid = folders[fid]['parent_id']
        d += 1
    return d


touched = {fid for _, _, rel in folder_moves + note_moves for fid in rel} | {folders[fid]['parent_id'] for fid in moved_folders}
deletes = sorted((f for f in touched if folders[f]['kind'] == 'folder' and folders[f]['creator_id'] == IMPORT_OWNER and empty_after(f)), key=depth, reverse=True)
for fid in deletes:
    sql.append(f"DELETE FROM resource_folders WHERE id = {fid} AND kind = 'folder' AND creator_id = {IMPORT_OWNER} "
               "AND NOT EXISTS (SELECT 1 FROM resource_folders c WHERE c.parent_id = resource_folders.id OR c.removed_from_id = resource_folders.id) "
               "AND NOT EXISTS (SELECT 1 FROM resources r WHERE r.folder_id = resource_folders.id OR r.removed_from_id = resource_folders.id);")
sql.append('DROP TABLE _retask_map;')
open(os.path.join(OUT, 'moves.sql'), 'w').write('\n'.join(sql) + '\n')

# A readable list of what moves where.
def path(fid):
    out = []
    while fid:
        f = folders[fid]
        out.append(f['subject'] if f['kind'] == 'subject' else f['name'])
        fid = f['parent_id']
    return ' / '.join(reversed(out))


lines = []
for fid, dest, rel, _ in plans_f:
    count = sum(1 for n in plan if path(plan[n]['src_folder']).startswith(path(fid)))
    lines.append((dest, f"folder  {path(fid)}  ({count} notes)"))
for nid, dest, rel, _ in plans_n:
    lines.append((dest, f"note    {path(plan[nid]['src_folder'])} / {plan[nid]['title']}"))
with open(os.path.join(OUT, 'moves.txt'), 'w') as out:
    for dest, line in sorted(lines):
        out.write(f'{dest[0]} → {dest[1]}  ::  {line}\n')
print(len(folder_moves), 'folders moved whole,', len(note_moves), 'notes moved singly,', len(new_folders), 'folders created,', len(deletes), 'emptied folders deleted')
