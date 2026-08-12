/* Student Attendance dashboard — fetches /api/proxy/attendance (SBHS Clipboard) and renders filters, KPIs, timeline/table, audit drawer and explain modal. */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (m) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[m]));

  const SYDNEY = 'Australia/Sydney';

  let allRecords = [];
  let activityFilter = 'all';
  let loading = false;
  let hasLoaded = false;

  function normalize(data) {
    let arr = [];
    if (Array.isArray(data)) arr = data;
    else if (data) arr = data.member || data.data || data.records || data.results || data.items || [];
    return arr.map((r) => ({
      id: r.id,
      absent: !!r.absent,
      explained: !!r.explained,
      comment: r.comment || '',
      session: r.session || {},
      team: r.team || {},
      attendanceFlags: Array.isArray(r.attendanceFlags) ? r.attendanceFlags : [],
      roll: r.roll || {},
    }));
  }

  function act(r) {
    return (r.session.activity && r.session.activity.name) || 'Unknown activity';
  }
  function dept(r) {
    return (r.session.activity && r.session.activity.department && r.session.activity.department.name) || 'Other';
  }
  function colour(r) {
    let h = (r.session.activity && r.session.activity.hexColour) || '';
    h = String(h).replace(/^#/, '');
    if (!/^[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(h)) return '#6b7280';
    return '#' + h;
  }
  function flagNames(r) {
    return r.attendanceFlags.map((f) => (f && f.name) || '').filter(Boolean);
  }
  function isLate(r) {
    return flagNames(r).some((n) => n.toLowerCase().includes('arrived late'));
  }
  // absent statuses win over the "Arrived late" flag
  function statusOf(r) {
    if (r.absent && !r.explained) return 'unexplained';
    if (r.absent && r.explained) return 'explained';
    if (isLate(r)) return 'late';
    return 'present';
  }

  // all times rendered in school (Sydney) local time
  function parseISO(iso) {
    if (!iso) return null;
    const d = new Date(iso);
    return isNaN(d.getTime()) ? null : d;
  }
  function sydneyDateStr(iso) {
    const d = parseISO(iso);
    return d ? d.toLocaleDateString('en-CA', { timeZone: SYDNEY }) : '';
  }
  function fmtTime(iso) {
    const d = parseISO(iso);
    if (!d) return '—';
    return d.toLocaleTimeString('en-AU', { timeZone: SYDNEY, hour: 'numeric', minute: '2-digit' });
  }
  function fmtDateHeader(iso) {
    const d = parseISO(iso);
    if (!d) return 'Unknown date';
    return d.toLocaleDateString('en-US', { timeZone: SYDNEY, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }
  function fmtDateTime(iso) {
    const d = parseISO(iso);
    if (!d) return '—';
    return d.toLocaleString('en-AU', { timeZone: SYDNEY, day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  }
  function fmtDuration(startIso, endIso) {
    const s = parseISO(startIso);
    const e = parseISO(endIso);
    if (!s || !e) return '';
    const mins = Math.max(0, Math.round((e.getTime() - s.getTime()) / 60000));
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h && m) return h + 'h ' + m + 'm';
    if (h) return h + 'h';
    return m + 'm';
  }
  function relativeDay(iso) {
    const d = parseISO(iso);
    if (!d) return '';
    const t = new Date();
    const today = t.toLocaleDateString('en-CA', { timeZone: SYDNEY });
    const yest = new Date(t);
    yest.setDate(t.getDate() - 1);
    const yStr = yest.toLocaleDateString('en-CA', { timeZone: SYDNEY });
    const ds = sydneyDateStr(iso);
    if (ds === today) return 'Today';
    if (ds === yStr) return 'Yesterday';
    return '';
  }

  // readable foreground for the dynamic activity tag colour
  function readableText(hex) {
    const h = String(hex).replace('#', '');
    const full = h.length === 3 ? h.split('').map((x) => x + x).join('') : h;
    const r = parseInt(full.substr(0, 2), 16);
    const g = parseInt(full.substr(2, 2), 16);
    const b = parseInt(full.substr(4, 2), 16);
    if ([r, g, b].some((n) => isNaN(n))) return '#ffffff';
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return lum > 0.6 ? '#1f2937' : '#ffffff';
  }

  function getStudentData() {
    try {
      const raw = localStorage.getItem('studentData');
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return null;
  }

  // portal token refresh, same as the Timetable
  let _refreshPromise = null;
  async function doRefresh() {
    if (_refreshPromise) return _refreshPromise;
    _refreshPromise = (async () => {
      try {
        const res = await fetch('/api/auth/refresh');
        const data = await res.json();
        if (data && data.success && data.accessToken) {
          const sd = getStudentData() || {};
          sd.accessToken = data.accessToken;
          localStorage.setItem('studentData', JSON.stringify(sd));
          localStorage.setItem('tokenRefreshedAt', String(Date.now()));
          return data.accessToken;
        }
      } catch (e) {}
      return null;
    })();
    try {
      return await _refreshPromise;
    } finally {
      _refreshPromise = null;
    }
  }

  async function fetchAttendance() {
    const sd = getStudentData();
    if (!sd || !sd.accessToken || !sd.studentId) throw new Error('NO_SESSION');

    const now = new Date();
    const d = (x) => x.toISOString().split('T')[0];
    const after = new Date(now);
    after.setDate(after.getDate() - 400);
    const before = new Date(now);
    before.setDate(before.getDate() + 30);

    const params = new URLSearchParams({ studentId: sd.studentId, context: String(now.getFullYear()) });
    params.set('date[after]', d(after));
    params.set('date[before]', d(before));

    let res = await fetch('/api/proxy/attendance?' + params.toString(), {
      headers: { Authorization: 'Bearer ' + sd.accessToken },
    });
    if (res.status === 401 || res.status === 403) {
      const token = await doRefresh();
      if (!token) throw new Error('AUTH_EXPIRED');
      res = await fetch('/api/proxy/attendance?' + params.toString(), {
        headers: { Authorization: 'Bearer ' + token },
      });
    }
    if (!res.ok) throw new Error('FETCH_FAILED:' + res.status);
    return normalize(await res.json());
  }

  function computeStats(records) {
    const total = records.length;
    const absent = records.filter((r) => r.absent).length;
    const unexplained = records.filter((r) => r.absent && !r.explained).length;
    const late = records.filter((r) => !r.absent && isLate(r)).length;
    const present = total - absent;
    const rate = total ? (present / total) * 100 : 0;

    const map = new Map();
    records.forEach((r) => {
      const name = act(r);
      let a = map.get(name);
      if (!a) {
        a = { name, department: dept(r), colour: colour(r), total: 0, absent: 0, unexplained: 0, late: 0 };
        map.set(name, a);
      }
      a.total++;
      if (r.absent) {
        a.absent++;
        if (!r.explained) a.unexplained++;
      }
      if (!r.absent && isLate(r)) a.late++;
    });
    const activities = Array.from(map.values())
      .map((a) => ({ ...a, rate: a.total ? Math.round(((a.total - a.absent) / a.total) * 100) : 0 }))
      .sort((a, b) => b.total - a.total);
    const departments = Array.from(new Set(records.map(dept))).sort();

    return { total, absent, unexplained, late, present, rate: Math.round(rate * 10) / 10, activities, departments };
  }

  function getFiltered() {
    return allRecords.filter((r) => {
      if (activityFilter !== 'all' && act(r) !== activityFilter) return false;
      return true;
    });
  }

  function rateColor(pct) {
    return pct >= 95 ? '#22c55e' : pct >= 90 ? '#f59e0b' : '#ef4444';
  }
  function activityTag(r) {
    const c = colour(r);
    return `<span class="text-[11px] font-bold px-2 py-0.5 rounded" style="background:${c};color:${readableText(c)}">${esc(act(r))}</span>`;
  }
  function statusBadge(r, compact) {
    const s = statusOf(r);
    if (s === 'unexplained') {
      const badge = `<span class="text-[11px] font-semibold text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-500/15 rounded px-2 py-1">Unexplained absence</span>`;
      return compact
        ? badge
        : badge +
          `<button type="button" data-action="explain" class="add-reason-btn text-[11px] font-semibold px-2 py-1 rounded bg-red-600 hover:bg-red-700 text-white">Add reason</button>`;
    }
    if (s === 'explained') {
      return `<span class="text-[11px] font-semibold text-gray-400 dark:text-neutral-500">Explained absence</span>`;
    }
    if (s === 'late') {
      return `<span class="text-[11px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/15 rounded px-2 py-1">Arrived late</span>`;
    }
    return `<span class="text-[11px] font-semibold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-500/15 rounded px-2 py-1">Present</span>`;
  }

  function renderBreakdown(stats) {
    const el = $('activity-breakdown');
    if (!stats.total) {
      el.innerHTML = '<p class="text-sm text-gray-400 dark:text-neutral-600 sm:col-span-2">No sessions recorded.</p>';
      return;
    }
    el.innerHTML = stats.activities
      .map((a) => {
        const active = activityFilter === a.name;
        return `
          <button type="button" data-activity="${esc(a.name)}" class="activity-pill text-left flex items-center gap-2.5 py-1 px-1.5 rounded ${active ? 'bg-blue-50 dark:bg-blue-500/10' : 'hover:bg-gray-50 dark:hover:bg-neutral-700/50'}">
            <span class="w-2 h-2 rounded-full flex-shrink-0" style="background:${a.colour}"></span>
            <span class="text-xs font-medium text-gray-700 dark:text-neutral-300 truncate flex-1 min-w-0">${esc(a.name)}</span>
            <span class="hidden sm:block flex-1 max-w-[80px] h-1.5 rounded-full bg-gray-100 dark:bg-neutral-700 overflow-hidden">
              <span class="block h-full rounded-full" style="width:${a.rate}%;background:${rateColor(a.rate)}"></span>
            </span>
            <span class="text-xs font-bold text-gray-900 dark:text-white w-9 text-right">${a.rate}%</span>
          </button>`;
      })
      .join('');
  }

  function emptyHTML(noDataAtAll) {
    const icon = noDataAtAll ? 'calendar-check' : 'filter';
    const title = noDataAtAll ? 'No attendance records yet' : 'No sessions match these filters';
    const sub = noDataAtAll
      ? 'Your Clipboard attendance will appear here once roll is marked.'
      : 'Try a different combination of department, activity and status.';
    return `<div class="text-center py-16"><div class="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-neutral-600"><i data-lucide="${icon}" class="w-12 h-12"></i></div><p class="text-sm font-semibold text-gray-700 dark:text-neutral-200">${title}</p><p class="text-xs text-gray-400 dark:text-neutral-500 mt-1">${sub}</p>${
      noDataAtAll ? '' : '<button data-action="reset-filters" class="mt-3 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline">Reset filters</button>'
    }</div>`;
  }

  function recordCardHTML(r) {
    const timeStr = [fmtTime(r.session.startDateTime), fmtTime(r.session.endDateTime)].filter((t) => t !== '—').join(' – ');
    const teamName = (r.team && r.team.name) || '';
    const teamCat = (r.team && r.team.category) || '';
    return `
      <article data-id="${r.id}" class="record-card group cursor-pointer">
        <div class="flex">
          <div class="w-1 flex-shrink-0" style="background:${colour(r)}"></div>
          <div class="flex-1 min-w-0 py-4 pl-3">
            <div class="flex flex-wrap items-center gap-2 mb-1.5">${activityTag(r)}${statusBadge(r)}</div>
            <h4 class="text-sm font-semibold text-gray-900 dark:text-white leading-snug">${esc(r.session.title || 'Untitled session')}</h4>
            <p class="text-xs text-gray-500 dark:text-neutral-400 mt-1">${teamName ? esc(teamName) + (teamCat ? ' · ' + esc(teamCat) : '') : teamCat ? esc(teamCat) : ''}</p>
            <p class="text-xs text-gray-400 dark:text-neutral-500 mt-2">${esc(timeStr || 'Time not recorded')}${timeStr && fmtDuration(r.session.startDateTime, r.session.endDateTime) ? ' · ' + esc(fmtDuration(r.session.startDateTime, r.session.endDateTime)) : ''}</p>
          </div>
        </div>
      </article>`;
  }

  function renderTimeline(filtered, skeleton) {
    const container = $('timeline-container');

    if (skeleton) {
      container.innerHTML = '<p class="text-sm text-gray-400 dark:text-neutral-500 py-8 text-center">Loading…</p>';
      return;
    }
    if (!filtered.length) {
      container.innerHTML = emptyHTML(!allRecords.length);
      return;
    }

    const groups = {};
    filtered.forEach((r) => {
      const ds = sydneyDateStr(r.session.startDateTime) || 'Unknown date';
      (groups[ds] = groups[ds] || []).push(r);
    });
    const dates = Object.keys(groups).sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));

    container.innerHTML = dates
      .map((ds) => {
        const items = groups[ds].slice().sort((a, b) => {
          const ta = a.session.startDateTime || '';
          const tb = b.session.startDateTime || '';
          return ta < tb ? -1 : ta > tb ? 1 : 0;
        });
        const rel = relativeDay(ds);
        return `
          <section class="space-y-3">
            <div class="flex items-center gap-2">
              <h3 class="text-sm font-bold text-gray-900 dark:text-white">${esc(fmtDateHeader(ds))}</h3>
              ${rel ? `<span class="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${rel === 'Today' ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300' : 'bg-gray-100 dark:bg-neutral-700 text-gray-500 dark:text-neutral-400'}">${rel}</span>` : ''}
              <span class="text-xs text-gray-400 dark:text-neutral-500">· ${items.length}</span>
            </div>
            ${items.map(recordCardHTML).join('')}
          </section>`;
      })
      .join('');
  }

  function openDrawer(id) {
    const r = allRecords.find((x) => String(x.id) === String(id));
    if (!r) return;
    renderDrawer(r);
    $('drawer-backdrop').classList.remove('hidden');
    $('audit-drawer').classList.remove('translate-x-full');
    document.body.style.overflow = 'hidden';
  }
  function closeDrawer() {
    $('drawer-backdrop').classList.add('hidden');
    $('audit-drawer').classList.add('translate-x-full');
    document.body.style.overflow = '';
  }

  function renderDrawer(r) {
    const s = statusOf(r);
    const flags = flagNames(r);
    const teamName = (r.team && r.team.name) || '—';
    const teamCat = (r.team && r.team.category) || '';
    const when = [fmtTime(r.session.startDateTime), fmtTime(r.session.endDateTime)].filter((t) => t !== '—').join(' – ');
    const duration = fmtDuration(r.session.startDateTime, r.session.endDateTime);
    const rollMarked = r.roll && r.roll.timeMarked ? fmtDateTime(r.roll.timeMarked) : '—';
    let markedBy = r.roll && r.roll.markedByUser;
    if (markedBy && typeof markedBy === 'object') {
      markedBy = [markedBy.firstName, markedBy.lastName].filter(Boolean).join(' ') || markedBy.id || markedBy.userId || JSON.stringify(markedBy);
    }
    markedBy = markedBy || '—';
    const outcome = s === 'present' ? 'Attended' : s === 'late' ? 'Attended (late)' : s === 'explained' ? 'Explained absence' : 'Unexplained absence';

    $('drawer-content').innerHTML = `
      <div class="flex items-center justify-between mb-5">
        <h3 class="text-lg font-bold text-gray-900 dark:text-white">Session audit</h3>
        <button id="drawer-close" class="p-1 rounded hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-400" aria-label="Close"><i data-lucide="x" class="w-4 h-4"></i></button>
      </div>
      <div class="flex flex-wrap items-center gap-2 mb-3">${activityTag(r)}${statusBadge(r, true)}</div>
      <h4 class="text-base font-semibold text-gray-900 dark:text-white leading-snug mb-2">${esc(r.session.title || 'Untitled session')}</h4>

      <div class="divide-y divide-gray-100 dark:divide-neutral-800">
        <div class="py-3">
          <p class="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-neutral-500">Team</p>
          <p class="text-sm text-gray-800 dark:text-neutral-200 mt-0.5">${esc(teamName)}</p>
          ${teamCat ? `<p class="text-xs text-gray-400 dark:text-neutral-500">${esc(teamCat)}</p>` : ''}
        </div>
        <div class="py-3">
          <p class="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-neutral-500">Department</p>
          <p class="text-sm text-gray-800 dark:text-neutral-200 mt-0.5">${esc(dept(r))}</p>
        </div>
        <div class="py-3">
          <p class="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-neutral-500">When</p>
          <p class="text-sm text-gray-800 dark:text-neutral-200 mt-0.5">${esc(fmtDateHeader(r.session.startDateTime))}</p>
          <p class="text-xs text-gray-400 dark:text-neutral-500">${esc(when)}${duration ? ' · ' + esc(duration) : ''}</p>
        </div>
        <div class="py-3">
          <p class="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-neutral-500">Flags</p>
          ${flags.length ? `<div class="flex flex-wrap gap-1.5 mt-1">${flags.map((f) => `<span class="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-300">${esc(f)}</span>`).join('')}</div>` : '<p class="text-sm text-gray-400 dark:text-neutral-500 mt-0.5">None</p>'}
        </div>
        ${r.comment ? `<div class="py-3"><p class="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-neutral-500">Comment</p><p class="text-sm text-gray-800 dark:text-neutral-200 mt-0.5">${esc(r.comment)}</p></div>` : ''}
      </div>

      <div class="mt-5 pt-4 border-t border-gray-100 dark:border-neutral-800">
        <p class="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-neutral-500 mb-3">Roll audit trail</p>
        <div class="grid grid-cols-2 gap-y-3 gap-x-4">
          <div>
            <p class="text-[11px] text-gray-400 dark:text-neutral-500">Roll marked</p>
            <p class="text-sm font-medium text-gray-800 dark:text-neutral-200">${esc(rollMarked)}</p>
          </div>
          <div>
            <p class="text-[11px] text-gray-400 dark:text-neutral-500">Marked by</p>
            <p class="text-sm font-medium text-gray-800 dark:text-neutral-200">${esc(String(markedBy))}</p>
          </div>
          <div>
            <p class="text-[11px] text-gray-400 dark:text-neutral-500">Record ID</p>
            <p class="text-sm font-mono text-gray-800 dark:text-neutral-200">${esc(r.id)}</p>
          </div>
          <div>
            <p class="text-[11px] text-gray-400 dark:text-neutral-500">Outcome</p>
            <p class="text-sm font-medium text-gray-800 dark:text-neutral-200">${esc(outcome)}</p>
          </div>
        </div>
      </div>
    `;
    refreshIcons();
    $('drawer-close').onclick = closeDrawer;
  }

  function openExplainModal() {
    const list = allRecords
      .filter((r) => r.absent && !r.explained)
      .slice()
      .sort((a, b) => {
        const ta = a.session.startDateTime || '';
        const tb = b.session.startDateTime || '';
        return ta < tb ? 1 : ta > tb ? -1 : 0;
      });
    $('explain-intro').textContent =
      'You have ' + list.length + ' unexplained ' + (list.length === 1 ? 'absence' : 'absences') + ' — record a reason in the school portal for each session below.';
    $('explain-list').innerHTML = list.length
      ? list
          .map(
            (r) => `
          <div class="flex items-center gap-3 rounded border border-red-100 dark:border-red-500/20 bg-red-50/60 dark:bg-red-500/5 px-3 py-2.5">
            <span class="w-2 h-2 rounded-full flex-shrink-0" style="background:${colour(r)}"></span>
            <div class="flex-1 min-w-0">
              <p class="text-xs font-semibold text-gray-900 dark:text-white truncate">${esc(r.session.title || 'Untitled session')}</p>
              <p class="text-[11px] text-gray-500 dark:text-neutral-400 mt-0.5">${esc(fmtDateHeader(r.session.startDateTime))} · ${esc([fmtTime(r.session.startDateTime), fmtTime(r.session.endDateTime)].filter((t) => t !== '—').join(' – '))}</p>
            </div>
            <span class="text-[10px] font-bold uppercase tracking-wider text-red-500 flex-shrink-0">Unjustified</span>
          </div>`
          )
          .join('')
      : '<p class="text-sm text-gray-400 dark:text-neutral-500">Nothing to explain.</p>';
    refreshIcons();
    const bd = $('explain-backdrop');
    bd.classList.remove('hidden');
    bd.classList.add('flex');
    document.body.style.overflow = 'hidden';
  }
  function closeExplainModal() {
    const bd = $('explain-backdrop');
    bd.classList.add('hidden');
    bd.classList.remove('flex');
    document.body.style.overflow = '';
  }

  function showError(type) {
    const state = $('error-state');
    state.classList.remove('hidden');
    const tl = $('timeline-container');
    tl.classList.add('hidden');
    tl.innerHTML = '';

    const icon = state.querySelector('#error-icon');
    const title = $('error-title');
    const msg = $('error-message');
    const actEl = $('error-action');

    if (type === 'no-session') {
      if (icon) icon.setAttribute('data-lucide', 'user-x');
      title.textContent = 'Attendance needs your school portal session';
      msg.textContent = 'HighHelp needs the same student portal login the Timetable uses to read your attendance. Log in again to re-sync.';
      actEl.href = '/api/auth/login';
      actEl.onclick = null;
      actEl.innerHTML = 'Log in to sync <i data-lucide="arrow-right" class="w-4 h-4"></i>';
    } else {
      if (icon) icon.setAttribute('data-lucide', 'cloud-off');
      title.textContent = 'Could not load your attendance';
      msg.textContent = 'Something went wrong fetching from the school portal. Check your connection and try again.';
      actEl.href = '#';
      actEl.onclick = (ev) => {
        ev.preventDefault();
        state.classList.add('hidden');
        loadAndRender(true);
      };
      actEl.innerHTML = 'Try again <i data-lucide="refresh-cw" class="w-4 h-4"></i>';
    }
    refreshIcons();
  }

  function setLoadingUI(on) {
    const btn = $('btn-refresh');
    if (btn) btn.disabled = on;
    const icon = btn && btn.querySelector('[data-lucide]');
    if (icon) icon.classList.toggle('animate-spin', on);
  }

  function renderAll() {
    const stats = computeStats(allRecords);
    renderBreakdown(stats);

    const summary = $('result-summary');
    const filtered = getFiltered();

    if (loading && !hasLoaded) {
      summary.textContent = 'Loading…';
      renderTimeline(filtered, true);
      return;
    }
    if (!hasLoaded) {
      summary.textContent = '';
      return;
    }
    if (!allRecords.length) {
      summary.textContent = 'No attendance records yet';
      renderTimeline(filtered, false);
      return;
    }

    summary.textContent =
      'Showing ' + filtered.length + ' of ' + allRecords.length + ' sessions' + (activityFilter !== 'all' ? ' · ' + activityFilter : '');

    renderTimeline(filtered, false);
  }

  async function loadAndRender(force) {
    loading = true;
    hasLoaded = false;
    setLoadingUI(true);
    $('error-state').classList.add('hidden');
    try {
      const records = await fetchAttendance();
      allRecords = records;
      hasLoaded = true;
      loading = false;
      renderAll();
    } catch (e) {
      loading = false;
      setLoadingUI(false);
      if (e && (e.message === 'NO_SESSION' || e.message === 'AUTH_EXPIRED')) showError('no-session');
      else {
        console.error('[attendance] load failed', e);
        showError('fetch');
      }
    } finally {
      setLoadingUI(false);
    }
  }

  function refreshIcons() {
    if (window.lucide && window.lucide.createIcons) {
      try {
        window.lucide.createIcons();
      } catch (e) {
        console.warn('[attendance] lucide failed', e);
      }
    }
  }

  function bindStatic() {
    $('btn-refresh').addEventListener('click', () => {
      if (!loading) loadAndRender(true);
    });
    $('btn-close-explain').addEventListener('click', closeExplainModal);
    $('btn-explain-close').addEventListener('click', closeExplainModal);
    $('explain-backdrop').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) closeExplainModal();
    });
    $('drawer-backdrop').addEventListener('click', closeDrawer);

    document.addEventListener('click', (e) => {
      const reason = e.target.closest('.add-reason-btn');
      if (reason) {
        e.stopPropagation();
        openExplainModal();
        return;
      }
      const card = e.target.closest('.record-card');
      if (card) {
        openDrawer(card.getAttribute('data-id'));
        return;
      }
      const ap = e.target.closest('.activity-pill');
      if (ap) {
        activityFilter = ap.getAttribute('data-activity');
        renderAll();
        return;
      }
      const reset = e.target.closest('[data-action="reset-filters"]');
      if (reset) {
        activityFilter = 'all';
        renderAll();
      }
    });
  }

  function init() {
    if (!$('timeline-container')) return;
    refreshIcons();
    bindStatic();

    const sd = getStudentData();
    if (!sd || !sd.accessToken || !sd.studentId) {
      showError('no-session');
      return;
    }
    loadAndRender(false);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
