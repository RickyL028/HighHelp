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
  let monthOffset = 0;
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
  function fmtFullDate(iso) {
    const d = parseISO(iso);
    if (!d) return '';
    return d.toLocaleDateString('en-AU', { timeZone: SYDNEY, day: 'numeric', month: 'short', year: 'numeric' });
  }
  function fmtRange(startIso, endIso) {
    const sStr = sydneyDateStr(startIso);
    const eStr = sydneyDateStr(endIso);
    if (!sStr || !eStr) return '';
    if (sStr === eStr) return fmtFullDate(startIso);
    return fmtFullDate(startIso) + ' – ' + fmtFullDate(endIso);
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

  async function fetchPreExplained() {
    const sd = getStudentData();
    if (!sd || !sd.accessToken || !sd.studentId) throw new Error('NO_SESSION');

    const params = new URLSearchParams({ studentId: sd.studentId, context: String(new Date().getFullYear()) });

    let res = await fetch('/api/proxy/pre-explained-absences?' + params.toString(), {
      headers: { Authorization: 'Bearer ' + sd.accessToken },
    });
    if (res.status === 401 || res.status === 403) {
      const token = await doRefresh();
      if (!token) throw new Error('AUTH_EXPIRED');
      res = await fetch('/api/proxy/pre-explained-absences?' + params.toString(), {
        headers: { Authorization: 'Bearer ' + token },
      });
    }
    if (!res.ok) throw new Error('FETCH_FAILED:' + res.status);
    const data = await res.json();
    return Array.isArray(data) ? data : data.member || [];
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
    return `<span class="text-[11px] font-bold" style="color:${c}">${esc(act(r))}</span>`;
  }
  function statusBadge(r) {
    const s = statusOf(r);
    if (s === 'unexplained') {
      return `<span class="text-[11px] font-semibold text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-500/15 rounded px-2 py-1">Unexplained absence</span>`;
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

  function sydneyTodayStr() {
    return sydneyDateStr(new Date().toISOString());
  }
  function monthAnchor() {
    const [y, m] = sydneyTodayStr().split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1, 1));
    d.setUTCMonth(d.getUTCMonth() + monthOffset);
    return d;
  }
  function monthLabel() {
    return monthAnchor().toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', year: 'numeric' });
  }
  function monthGrid() {
    const anchor = monthAnchor();
    const [y, m] = [anchor.getUTCFullYear(), anchor.getUTCMonth()];
    const first = new Date(Date.UTC(y, m, 1));
    const firstDow = first.getUTCDay();
    const lead = (firstDow + 6) % 7;
    const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const total = Math.ceil((lead + daysInMonth) / 7) * 7;
    const start = new Date(first);
    start.setUTCDate(start.getUTCDate() - lead);
    const dates = [];
    for (let i = 0; i < total; i++) {
      const d = new Date(start);
      d.setUTCDate(d.getUTCDate() + i);
      dates.push(d.toISOString().slice(0, 10));
    }
    return dates;
  }
  function dayStatus(records) {
    if (records.some((r) => statusOf(r) === 'unexplained')) return 'unexplained';
    if (records.some((r) => statusOf(r) === 'explained')) return 'explained';
    if (records.length) return 'present';
    return 'none';
  }
  function dayClass(status) {
    switch (status) {
      case 'unexplained':
        return 'bg-red-500 text-white';
      case 'explained':
        return 'bg-orange-500 text-white';
      case 'present':
        return 'bg-green-500 text-white';
      default:
        return 'bg-gray-100 dark:bg-neutral-700 text-gray-400 dark:text-neutral-500';
    }
  }

  function renderCalendar(filtered, skeleton) {
    const container = $('calendar-container');
    if (skeleton) {
      container.innerHTML = '<p class="text-sm text-gray-400 dark:text-neutral-500 py-8 text-center">Loading…</p>';
      return;
    }
    if (!allRecords.length) {
      container.innerHTML = emptyHTML(true);
      return;
    }
    const groups = {};
    filtered.forEach((r) => {
      const ds = sydneyDateStr(r.session.startDateTime) || 'Unknown date';
      (groups[ds] = groups[ds] || []).push(r);
    });
    const dates = monthGrid();
    const today = sydneyTodayStr();
    const anchor = monthAnchor();
    const [viewY, viewM] = [anchor.getUTCFullYear(), anchor.getUTCMonth()];
    const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const inView = (ds) => {
      const [y, m] = ds.split('-').map(Number);
      return y === viewY && m === viewM;
    };
    const dayCells = dates
      .map((ds) => {
        const recs = groups[ds] || [];
        const status = dayStatus(recs);
        const [, , d] = ds.split('-').map(Number);
        const isToday = ds === today;
        const dim = inView(ds);
        return `
          <button type="button" data-date="${ds}" class="calendar-day flex flex-col items-center justify-center rounded-lg py-1 aspect-square transition-opacity ${recs.length ? 'cursor-pointer hover:opacity-80' : 'cursor-default'} ${dim ? 'opacity-40' : ''} ${dayClass(status)} ${isToday ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-neutral-900' : ''}">
            <span class="text-sm font-bold leading-tight">${d}</span>
            <span class="text-[9px] mt-0.5">${recs.length ? recs.length + ' session' + (recs.length > 1 ? 's' : '') : '—'}</span>
          </button>`;
      })
      .join('');
    container.innerHTML = `
      <div class="flex items-center justify-between mb-3">
        <button type="button" data-nav="-1" class="cal-nav p-1.5 rounded hover:bg-gray-100 dark:hover:bg-neutral-700 text-gray-500 dark:text-neutral-400" aria-label="Previous month"><i data-lucide="chevron-left" class="w-4 h-4"></i></button>
        <h3 class="text-sm font-bold text-gray-900 dark:text-white">${esc(monthLabel())}</h3>
        <button type="button" data-nav="1" class="cal-nav p-1.5 rounded hover:bg-gray-100 dark:hover:bg-neutral-700 text-gray-500 dark:text-neutral-400" aria-label="Next month"><i data-lucide="chevron-right" class="w-4 h-4"></i></button>
      </div>
      <div class="grid grid-cols-7 gap-1.5 mb-1">
        ${weekdays.map((w) => `<div class="text-center text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-neutral-500">${w}</div>`).join('')}
      </div>
      <div class="grid grid-cols-7 gap-1.5">
        ${dayCells}
      </div>`;
    refreshIcons();
  }

  function openDayDrawer(dateStr) {
    const records = getFiltered().filter((r) => sydneyDateStr(r.session.startDateTime) === dateStr);
    if (!records.length) return;
    renderDayDrawer(dateStr, records);
    $('drawer-backdrop').classList.remove('hidden');
    $('audit-drawer').classList.remove('translate-x-full');
    document.body.style.overflow = 'hidden';
  }
  function closeDrawer() {
    $('drawer-backdrop').classList.add('hidden');
    $('audit-drawer').classList.add('translate-x-full');
    document.body.style.overflow = '';
  }

  function sessionAuditBlock(r) {
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

    return `
      <div class="py-4 border-t border-gray-100 dark:border-neutral-800 first:border-0 first:pt-0">
        <div class="flex flex-wrap items-center gap-2 mb-2">${activityTag(r)}${statusBadge(r)}</div>
        <h4 class="text-sm font-semibold text-gray-900 dark:text-white leading-snug mb-2">${esc(r.session.title || 'Untitled session')}</h4>

        <div class="grid grid-cols-2 gap-x-4 gap-y-3">
          <div>
            <p class="text-[11px] text-gray-400 dark:text-neutral-500">When</p>
            <p class="text-sm text-gray-800 dark:text-neutral-200 mt-0.5">${esc(when)}${duration ? ' · ' + esc(duration) : ''}</p>
          </div>
          <div>
            <p class="text-[11px] text-gray-400 dark:text-neutral-500">Team</p>
            <p class="text-sm text-gray-800 dark:text-neutral-200 mt-0.5">${esc(teamName)}${teamCat ? ' · ' + esc(teamCat) : ''}</p>
          </div>
          <div>
            <p class="text-[11px] text-gray-400 dark:text-neutral-500">Department</p>
            <p class="text-sm text-gray-800 dark:text-neutral-200 mt-0.5">${esc(dept(r))}</p>
          </div>
          <div>
            <p class="text-[11px] text-gray-400 dark:text-neutral-500">Outcome</p>
            <p class="text-sm font-medium text-gray-800 dark:text-neutral-200">${esc(outcome)}</p>
          </div>
          <div>
            <p class="text-[11px] text-gray-400 dark:text-neutral-500">Flags</p>
            ${flags.length ? `<div class="flex flex-wrap gap-1.5 mt-1">${flags.map((f) => `<span class="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-300">${esc(f)}</span>`).join('')}</div>` : '<p class="text-sm text-gray-400 dark:text-neutral-500 mt-0.5">None</p>'}
          </div>
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
        </div>
        ${r.comment ? `<p class="text-xs text-gray-500 dark:text-neutral-400 mt-3"><span class="font-semibold">Comment:</span> ${esc(r.comment)}</p>` : ''}
      </div>`;
  }

  function renderDayDrawer(dateStr, records) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    const title = dt.toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    const rel = relativeDay(dateStr);

    $('drawer-content').innerHTML = `
      <div class="flex items-center justify-between mb-5">
        <div>
          <h3 class="text-lg font-bold text-gray-900 dark:text-white">Session audit</h3>
          <p class="text-sm text-gray-500 dark:text-neutral-400 mt-0.5">${esc(title)}${rel ? ' · ' + esc(rel) : ''}</p>
        </div>
        <button id="drawer-close" class="p-1 rounded hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-400" aria-label="Close"><i data-lucide="x" class="w-4 h-4"></i></button>
      </div>
      ${records.map(sessionAuditBlock).join('')}
    `;
    refreshIcons();
    $('drawer-close').onclick = closeDrawer;
  }

  function showError(type) {
    const state = $('error-state');
    state.classList.remove('hidden');
    const cal = $('calendar-container');
    cal.classList.add('hidden');
    cal.innerHTML = '';

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

  function renderPreExplained(items) {
    const container = $('pre-explained-container');
    if (!container) return;
    if (!items.length) {
      container.innerHTML = '';
      return;
    }
    container.innerHTML = `
      <section class="mt-10">
        <h2 class="text-xs uppercase  text-gray-400 dark:text-neutral-500 mb-3">Pre-explained</h2>
        <ul class="divide-y divide-gray-100 dark:divide-neutral-800">
          ${items
            .map((item) => {
              const range = fmtRange(item.startDateTime, item.endDateTime);
              const school = !!item.isAbsenceFromSchool;
              const explained = !!item.isExplained;
              return `
                <li class="py-2.5 flex flex-wrap items-center justify-between gap-2">
                  <p class="text-sm font-medium text-gray-800 dark:text-neutral-200">${esc(range)}</p>
                  <span class="flex items-center gap-1.5">
                    ${school ? '<span class="text-[11px] font-semibold px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400">School</span>' : '<span class="text-[11px] font-semibold px-2 py-0.5 rounded bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-300">Co-curricular</span>'}
                    ${explained ? '<span class="text-[11px] font-semibold px-2 py-0.5 rounded bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400">👍</span>' : ''}
                  </span>
                </li>`;
            })
            .join('')}
        </ul>
      </section>`;
  }

  function renderAll() {
    const stats = computeStats(allRecords);
    renderBreakdown(stats);

    const filtered = getFiltered();

    if (loading && !hasLoaded) {
      renderCalendar(filtered, true);
      return;
    }
    if (!hasLoaded) {
      return;
    }

    renderCalendar(filtered, false);
  }

  async function loadAndRender(force) {
    loading = true;
    hasLoaded = false;
    setLoadingUI(true);
    $('error-state').classList.add('hidden');
    try {
      const [records, preExplained] = await Promise.all([
        fetchAttendance(),
        fetchPreExplained().catch((e) => {
          console.warn('[attendance] pre-explained absences failed', e);
          return [];
        }),
      ]);
      allRecords = records;
      hasLoaded = true;
      loading = false;
      renderAll();
      renderPreExplained(preExplained);
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
    $('drawer-backdrop').addEventListener('click', closeDrawer);

    document.addEventListener('click', (e) => {
      const day = e.target.closest('.calendar-day');
      if (day) {
        openDayDrawer(day.getAttribute('data-date'));
        return;
      }
      const nav = e.target.closest('.cal-nav');
      if (nav) {
        monthOffset += Number(nav.getAttribute('data-nav')) || 0;
        renderAll();
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
    if (!$('calendar-container')) return;
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
