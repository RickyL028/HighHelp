"""Plan moving HSC notes into Task 1-4 by module/topic, and maths notes to the right course.

Usage: python3 -I plan.py <notes.json> <folders.json> <out plan.json>
Only notes in an HSC subject's 'HSC' or 'Unfiled' section are considered; Trial and Task sections
are left alone. A note moves only when its folder names and title point to exactly one task.
"""
import json
import re
import sys
from collections import defaultdict

NOTES, FOLDERS, OUT = sys.argv[1:4]
notes = json.load(open(NOTES))[0]['results']
folders = {f['id']: f for f in json.load(open(FOLDERS))[0]['results']}

N = r'(?<![a-z0-9])'
PAPER = re.compile(r'\btrials?\b|hsc (exam|paper)|past (hsc|paper)|examination|exam paper|\bthsc\b', re.I)


def science(text):
    found = set()
    for a, b in re.findall(N + r'(?:mod(?:ule)?s?|m)[ _.-]?([5-8])(?:\s*(?:-|–|to|&|and|,)\s*(?:mod(?:ule)?|m)?\s*([5-8]))?(?![0-9])', text, re.I):
        lo, hi = int(a), int(b or a)
        found.update(range(min(lo, hi), max(lo, hi) + 1))
    return {m - 4 for m in found}


def economics(text):
    return {int(t) for t in re.findall(N + r'topic[ _~:.-]*([1-4])(?![0-9])', text, re.I)}


def legal(text):
    return {int(t) for t in re.findall(N + r'topic[ _~:.-]*([1-3])(?![0-9])', text, re.I)}


def modern(text):
    t = set()
    if re.search(r'indochina', text, re.I): t.add(1)
    if re.search(r'civil rights', text, re.I): t.add(2)
    if re.search(r'power and authority', text, re.I): t.add(3)
    return t


def english(text):
    t = set()
    if re.search(r'common module', text, re.I): t.add(1)
    for m in re.findall(r'(?<![a-z])mod(?:ule)?[ _.-]?([abc])(?![a-z])', text, re.I):
        t.add({'a': 2, 'b': 3, 'c': 4}[m.lower()])
    return t


def business(text):
    t = set()
    if re.search(r'marketing', text, re.I): t.add(1)
    if re.search(r'operations', text, re.I): t.add(2)
    if re.search(r'financ', text, re.I): t.add(3)
    if re.search(r'human resource|(?<![a-z])hr(?![a-z])', text, re.I): t.add(4)
    return t


RULES = {
    'Biology (HSC)': science, 'Chemistry (HSC)': science, 'Physics (HSC)': science,
    'Economics (HSC)': economics, 'Legal Studies (HSC)': legal, 'Modern History (HSC)': modern,
    'English Advanced (HSC)': english, 'Business Studies (HSC)': business,
}

# Maths: a note that names another course moves to that course, same section and folder path.
MATHS = {'Mathematics 2U (HSC)', 'Mathematics 3U (HSC)', 'Mathematics 4U (HSC)'}
EXT2 = re.compile(N + r'(ext(ension)?[ _.-]?2|x2|4u|me ?2)(?![a-z0-9])', re.I)
EXT1 = re.compile(N + r'(ext(ension)?[ _.-]?1|x1|3u|me ?1)(?![a-z0-9])', re.I)
ADV = re.compile(N + r'(2u|maths? adv(anced)?|mathematics advanced|adv(anced)? maths?)(?![a-z0-9])', re.I)


def maths_course(text):
    c = set()
    if EXT2.search(text): c.add('Mathematics 4U (HSC)')
    if EXT1.search(text): c.add('Mathematics 3U (HSC)')
    if ADV.search(text): c.add('Mathematics 2U (HSC)')
    return c


def chain(fid):
    out = []
    while fid:
        out.append(folders[fid])
        fid = folders[fid]['parent_id']
    return list(reversed(out))


plan = []  # (note id, from folder, subject, section, rel folder names, target subject, target section)
for n in notes:
    ch = chain(n['folder_id'])
    subject, section = ch[0]['subject'], ch[1]['name']
    if section not in ('HSC', 'Unfiled'):
        continue
    rel = [f['name'] for f in ch[2:]]
    text = ' / '.join(rel + [n['title']])
    if subject in RULES:
        # A note in a folder named for one module follows its folder (module question sets included);
        # one placed only by its own title stays put if it looks like a full trial or HSC paper.
        from_folders = RULES[subject](' / '.join(rel))
        from_title = RULES[subject](n['title'])
        if from_folders:
            # A title naming one module wins over its folder (notes dumped in the wrong topic folder);
            # a title naming several leaves the note where it is.
            tasks = from_title if from_title else from_folders
        elif PAPER.search(text):
            continue
        else:
            tasks = from_title
        if len(tasks) == 1:
            plan.append(dict(note=n['id'], title=n['title'], uploader=n['uploader_id'], src_folder=n['folder_id'], subject=subject, section=section,
                             rel=[f['id'] for f in ch[2:]], to_subject=subject, to_section=f'Task {tasks.pop()}'))
    elif subject in MATHS:
        courses = maths_course(text)
        if len(courses) == 1 and subject not in courses:
            plan.append(dict(note=n['id'], title=n['title'], uploader=n['uploader_id'], src_folder=n['folder_id'], subject=subject, section=section,
                             rel=[f['id'] for f in ch[2:]], to_subject=courses.pop(), to_section=section))

json.dump(plan, open(OUT, 'w'), indent=1, ensure_ascii=False)
# Which task each folder's own name points to, so a note leaving it for another task does not carry
# that folder's name along (Task 1 / Topic 4 ~ ... would be confusing).
folder_tasks = {}
for fid, f in folders.items():
    if f['kind'] != 'folder':
        continue
    top = chain(fid)[0]
    if top.get('subject') in RULES:
        t = RULES[top['subject']](f['name'])
        if t:
            folder_tasks[fid] = sorted(t)
json.dump(folder_tasks, open(OUT.replace('plan.json', 'folder_tasks.json'), 'w'))
summary = defaultdict(int)
for p in plan:
    summary[(p['subject'], p['to_subject'], p['to_section'])] += 1
for k, v in sorted(summary.items()):
    print(f'{v:4}  {k[0]} -> {k[1] if k[1] != k[0] else ""} {k[2]}')
print(len(plan), 'notes to move')
