"""Classify every file in the SBHS 2026 drive: where it goes on the site, or why it is skipped.

Usage: python3 -I manifest.py <drive dir> <out manifest.json>
Writes {"files": [...], "folders": [...]}; nothing is uploaded.
"""
import hashlib
import json
import os
import re
import sys
import unicodedata

DRIVE, OUT = sys.argv[1], sys.argv[2]
MAX_FILE = 50 * 1024 * 1024
MAX_FOLDER_NAME = 60
MAX_TITLE = 150

SUBJECT = {
    'Ancient History 26': 'Ancient History (HSC)',
    'Biology 26': 'Biology (HSC)',
    'Business Studies 26': 'Business Studies (HSC)',
    'Chemistry 26': 'Chemistry (HSC)',
    'Chinese Continuers 26': 'Chinese Continuers (HSC)',
    'Economics': 'Economics (HSC)',
    'Engineering 26': 'Engineering Studies (HSC)',
    'English Advanced 26': 'English Advanced (HSC)',
    'English Extension 1 26': 'English Extension 1 (HSC)',
    'English Extension 2  26': 'English Extension 2 (HSC)',
    'Geography 26 (new syllabus)': 'Geography (HSC)',
    'HMS 26 (Previously PDHPE)': 'Health & Movement Science (HSC)',
    'Latin 26': 'Latin (HSC)',
    'Legal Studies 26': 'Legal Studies (HSC)',
    'Maths Advanced 26': 'Mathematics 2U (HSC)',
    'Maths Extension 1': 'Mathematics 3U (HSC)',
    'Maths Extension 2': 'Mathematics 4U (HSC)',
    'Modern History 26': 'Modern History (HSC)',
    'Music Extension': 'Music Extension (HSC)',
    'Physics 26': 'Physics (HSC)',
    'SOR I 26': 'Studies of Religion I (HSC)',
    'SOR II 26': 'Studies of Religion II (HSC)',
    'Software': 'Software Engineering (HSC)',
}
# '###SHARED UPLOAD FOLDER/<name>' files join that subject, inside a 'Shared Uploads' folder.
SHARED = '###SHARED UPLOAD FOLDER'
SHARED_SUBJECT = {
    'Ancient History': 'Ancient History 26', 'Biology': 'Biology 26', 'Business': 'Business Studies 26',
    'Chemistry': 'Chemistry 26', 'Economics': 'Economics', 'Engineering': 'Engineering 26',
    'English Advanced': 'English Advanced 26', 'English Extension 1': 'English Extension 1 26',
    'English Extension 2': 'English Extension 2  26', 'Geography': 'Geography 26 (new syllabus)',
    'HMS': 'HMS 26 (Previously PDHPE)', 'Legal Studies': 'Legal Studies 26', 'Math Advanced': 'Maths Advanced 26',
    'Math Extension 1': 'Maths Extension 1', 'Math Extension 2': 'Maths Extension 2', 'Modern History': 'Modern History 26',
    'Physics': 'Physics 26', 'SOR I': 'SOR I 26', 'SOR II': 'SOR II 26', 'Software': 'Software',
}

# Publisher material: textbooks, commercial study guides, commercial recordings.
PUBLISHER_FOLDER = re.compile(
    r'^(textbooks|est textbooks|cambridge worked sols|carrotsticks.*|hoody.?s booklets|strive.*|atar notes|surfing physics'
    r'|ni hao.*|audio excerpts)$', re.I)
PUBLISHER_FILE = re.compile(
    r'textbook|cambridge|jacaranda|pearson|oxford uni|mastering hsc|\bexcel\b|atar ?notes|\bstrive\b|surfing physics'
    r'|carrotsticks|new advanced mathematics|\[lee, ?20|\bnelson\b|success one|edrolo|aouni|rochford|riley ch|dixon unit', re.I)
# Folder names are checked without 'textbook', so e.g. 'Notes + Textbooks' (student notes) is judged file by file.
PUBLISHER_DIR = re.compile(PUBLISHER_FILE.pattern.replace('textbook|', ''), re.I)
# Commercial trial papers and tutoring-college material, checked against every folder name and the file name.
COMMERCIAL = re.compile(
    r'\bcssa\b|\bmatrix\b|\bdr ?du\b|\bace papers?\b|\b4u ace\b|exam ?choice|guthridge|\bpeak\b|\bpem\b|^pem_|\bqat\b|\btec\b'
    r'|total education|\bitute\b|\bneap\b|independent trial|^(19|20)\d\d independent\b|^independent solutions'
    r'|philosophical goose|zhangs? physics|study guide', re.I)
COMMERCIAL_OK = {'Economics/Statistics Dump/The Matrix.xlsx', 'Economics/Guides To Economics/Economics Study Guide.docx'}
JUNK_EXT = {'gdoc', 'gsheet', 'gslides', 'gform', 'gdraw', 'gmap', 'gsite', 'gjam', 'zip', 'html', 'htm', 'ini', 'lnk', 'url', 'tmp'}

# Top-level folders (inside a subject) that hold papers. HSC exam papers go to HSC, the rest to Trial.
TRIAL_FOLDER = re.compile(r'(past|practice) papers|\btrials?\b|trial papers|hard papers|bored of studies', re.I)
HSC_PAPERS = re.compile(r'hsc papers', re.I)


def clean(s):
    s = unicodedata.normalize('NFC', s)
    s = re.sub(r'[\x00-\x1f\x7f]', ' ', s)
    return re.sub(r'\s+', ' ', s).strip()


def short(s, n):
    return s if len(s) <= n else s[: n - 1].rstrip() + '…'


def sha(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''):
            h.update(b)
    return h.hexdigest()


files = []
for root, dirs, names in os.walk(DRIVE):
    dirs.sort()
    for name in sorted(names):
        full = os.path.join(root, name)
        rel = os.path.relpath(full, DRIVE)
        parts = rel.split(os.sep)
        ext = name.rsplit('.', 1)[-1].lower() if '.' in name else ''
        size = os.path.getsize(full)
        rec = {'path': rel, 'size': size}
        files.append(rec)

        # Where it would go.
        top, inner = parts[0], parts[1:-1]
        if top == SHARED and len(parts) > 2 and parts[1] in SHARED_SUBJECT:
            top, inner = SHARED_SUBJECT[parts[1]], ['Shared Uploads'] + parts[2:-1]
        subject = SUBJECT.get(top)

        reason = None
        if name.startswith('.') or name.startswith('~$') or name.lower() == 'desktop.ini':
            reason = 'system file'
        elif subject is None:
            reason = 'not in a subject folder'
        elif ext in JUNK_EXT:
            reason = 'zip bundle' if ext == 'zip' else f'.{ext} (link or web page, no content)'
        elif any(PUBLISHER_FOLDER.match(clean(d)) for d in inner) or PUBLISHER_FILE.search(name) \
                or any(PUBLISHER_DIR.search(d) for d in inner):
            reason = 'publisher material'
        elif rel not in COMMERCIAL_OK and any(COMMERCIAL.search(clean(x)) for x in inner + [name]):
            reason = 'commercial trial or tutoring material'
        elif size == 0:
            reason = 'empty file'
        elif size > MAX_FILE:
            reason = 'over 50 MB'
        if reason:
            rec['skip'] = reason
            continue

        first = clean(inner[0]) if inner else ''
        section = 'HSC' if HSC_PAPERS.search(first) else 'Trial' if (TRIAL_FOLDER.search(first) and not re.search(r'non-trial', first, re.I)) else 'HSC'
        rec.update(subject=subject, section=section, folders=[short(clean(d), MAX_FOLDER_NAME) for d in inner],
                   title=short(clean(name.rsplit('.', 1)[0] if '.' in name else name), MAX_TITLE) or 'Untitled',
                   file_name=clean(name), ext=ext)

# Exact duplicates: keep the first copy (path order), skip the rest.
seen = {}
for rec in files:
    if 'skip' in rec:
        continue
    rec['sha256'] = sha(os.path.join(DRIVE, rec['path']))
    if rec['sha256'] in seen:
        rec['skip'] = 'duplicate of ' + seen[rec['sha256']]
    else:
        seen[rec['sha256']] = rec['path']

json.dump({'files': files}, open(OUT, 'w'), indent=1, ensure_ascii=False)
kept = [f for f in files if 'skip' not in f]
print(len(files), 'files,', len(kept), 'to import,', round(sum(f['size'] for f in kept) / 1e9, 2), 'GB')
