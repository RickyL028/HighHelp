import { html } from 'hono/html'

export const TimetableCore = html`
<script>
    const DEFAULT_BELL_TIMES = [
        { period: "0", startTime: "08:00", endTime: "08:50", label: "Period 0" },
        { period: "RC", startTime: "08:50", endTime: "08:57", label: "Roll Call" },
        { period: "1", startTime: "09:00", endTime: "10:00", label: "Period 1" },
        { period: "2", startTime: "10:05", endTime: "11:05", label: "Period 2" },
        { period: "R", startTime: "11:05", endTime: "11:22", label: "Recess" },
        { period: "3", startTime: "11:25", endTime: "12:25", label: "Period 3" },
        { period: "L1", startTime: "12:25", endTime: "12:45", label: "Lunch 1" },
        { period: "L2", startTime: "12:45", endTime: "13:02", label: "Lunch 2" },
        { period: "4", startTime: "13:05", endTime: "14:05", label: "Period 4" },
        { period: "5", startTime: "14:10", endTime: "15:10", label: "Period 5" },
        { period: "EoD", startTime: "15:10", endTime: "23:59", label: "End of Day" }
    ];

    let studentData = null;
    try {
        const raw = localStorage.getItem('studentData');
        if (raw) studentData = JSON.parse(raw);
    } catch(e) { console.error(e); }

    if (!studentData || !studentData.timetable || !studentData.calendar) {
        const loader = document.getElementById('loader');
        if(loader) loader.classList.add('hidden');
        const err = document.getElementById('error-msg');
        if(err) {
            err.classList.remove('hidden');
            err.innerHTML = 'Timetable data not found. Please <a href="/api/auth/login" class="underline">Log in again</a> to sync.';
        }
    }

    // Recover studentId for old logins that predate the API change
    // Must run before any fetch functions that depend on studentId
    if (studentData?.accessToken && !studentData?.studentId) {
        (async () => {
            try {
                console.log('[auth] studentId missing — attempting recovery from userinfo');
                const res = await fetch('https://student.sbhs.net.au/api/details/userinfo.json', {
                    headers: { 'Authorization': 'Bearer ' + studentData.accessToken }
                });
                if (res.ok) {
                    const userData = await res.json();
                    if (userData.studentId) {
                        console.log('[auth] recovered studentId', userData.studentId);
                        studentData.studentId = userData.studentId;
                        localStorage.setItem('studentData', JSON.stringify(studentData));
                    } else {
                        console.warn('[auth] userinfo returned no studentId', userData);
                        showReauthBanner();
                    }
                } else {
                    console.warn('[auth] userinfo request failed', res.status);
                    showReauthBanner();
                }
            } catch(e) {
                console.error('[auth] studentId recovery failed', e);
                showReauthBanner();
            }
        })();
    }

    // Proactive token refresh — refresh if older than 30 minutes so api.sbhs.net.au never sees an expired token
    async function ensureFreshToken() {
        if (!studentData?.accessToken) return false;
        try {
            var lastRefresh = parseInt(localStorage.getItem('tokenRefreshedAt') || '0', 10);
            var age = Date.now() - lastRefresh;
            if (age < 30 * 60 * 1000) return true; // still fresh
            console.log('[auth] proactive refresh — token age', Math.round(age / 60000), 'min');
            var refreshRes = await fetch('/api/auth/refresh');
            var refreshData = await refreshRes.json();
            if (refreshData.success && refreshData.accessToken) {
                studentData.accessToken = refreshData.accessToken;
                localStorage.setItem('studentData', JSON.stringify(studentData));
                localStorage.setItem('tokenRefreshedAt', String(Date.now()));
                console.log('[auth] proactive refresh succeeded');
                clearReauthBanner();
                return true;
            }
            console.warn('[auth] proactive refresh failed — showing reauth banner');
            showReauthBanner();
            return false;
        } catch(e) {
            console.error('[auth] proactive refresh network error', e);
            return true; // network error — continue, will retry on next fetch
        }
    }

    if (studentData?.accessToken && studentData?.studentId) {
        ensureFreshToken();
    }

    const calendarMap = studentData?.calendar || {}; 
    const daysData = studentData?.timetable?.days || {};
    const subjectsData = studentData?.timetable?.subjects || [];

    const CACHE_TTL = 300000; // 5 minutes (adjustable)

    let currentDateStr = new URLSearchParams(window.location.search).get('date') || getInitialDate();
    const hashView = window.location.hash.replace('#', '');
    const validViews = ['day', 'cycle', 'notices', 'events', 'exams', 'config'];
    let currentView = validViews.includes(hashView) ? (hashView === 'exams' ? 'calendar' : hashView) : 'day';
    let tickerInterval = null;
    let hoveredPeriodData = null;
    let activeSubject = null;
    let bellCache = {};
    let pendingFetches = {};
    let isTickerUpdating = false;
    let loadingCounter = 0;
    let bellsFetchRequested = {}; // track which dates ticker has already tried to fetch

    // Build O(1) subject lookup map
    const subjectMap = {};
    subjectsData.forEach(s => {
        const key = s.shortTitle || s.title || s.subject || '';
        if (key) subjectMap[key] = s;
    });
    

    function showLoadingBar() {
        loadingCounter++;
        const bar = document.getElementById('loading-bar');
        if (bar) {
            bar.classList.remove('hidden');
            requestAnimationFrame(() => bar.classList.remove('opacity-0'));
        }
    }

    function hideLoadingBar() {
        loadingCounter--;
        if (loadingCounter <= 0) {
            loadingCounter = 0;
            const bar = document.getElementById('loading-bar');
            if (bar) {
                bar.classList.add('opacity-0');
                setTimeout(() => {
                    if (loadingCounter === 0) bar.classList.add('hidden');
                }, 200);
            }
        }
    }

    let _reauthBannerShown = false;
    let _reauthBannerTimer = null;
    function showReauthBanner() {
        if (_reauthBannerShown) return;
        if (_reauthBannerTimer) return; // already waiting
        _reauthBannerTimer = setTimeout(() => {
            _reauthBannerTimer = null;
            if (_reauthBannerShown) return;
            _reauthBannerShown = true;
            const container = document.getElementById('content') || document.getElementById('app-container');
            if (!container) return;
            const banner = document.createElement('div');
            banner.id = 'reauth-banner';
            banner.className = 'mb-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 text-sm flex items-center gap-3';
            banner.innerHTML = '<svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>'
                + '<span class="flex-1">Your session has expired. Please re-login to sync timetable data.</span>'
                + '<a href="/api/auth/login" class="flex-shrink-0 px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs transition-colors">Re-login</a>'
                + '<button onclick="this.parentElement.remove()" class="flex-shrink-0 p-1 rounded hover:bg-amber-200 dark:hover:bg-amber-800 transition-colors"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>';
            container.insertBefore(banner, container.firstChild);
        }, 5000);
    }
    function clearReauthBanner() {
        if (_reauthBannerTimer) { clearTimeout(_reauthBannerTimer); _reauthBannerTimer = null; }
    }

    let subjectConfig = {};
    try {
        const raw = localStorage.getItem('subjectConfig');
        if (raw) subjectConfig = JSON.parse(raw);
    } catch(e) { console.error('Error loading subject config', e); }

    window.addEventListener('subjectConfigUpdated', () => {
         try {
            const raw = localStorage.getItem('subjectConfig');
            if (raw) subjectConfig = JSON.parse(raw);
            if (window.render) window.render();
        } catch(e) { console.error('Error reloading subject config', e); }
    });

    function getInitialDate() {
        const now = new Date();
        const isAfterSchool = (now.getHours() > 15) || (now.getHours() === 15 && now.getMinutes() >= 10);
        
        if (isAfterSchool) {
            now.setDate(now.getDate() + 1);
        }
        
        if (now.getDay() === 0) now.setDate(now.getDate() + 1);

         const year = now.getFullYear();
         const month = String(now.getMonth() + 1).padStart(2, '0');
         const day = String(now.getDate()).padStart(2, '0');
         return \`\${year}-\${month}-\${day}\`;
    }

    function enrichPeriod(periodObj) {
        if (!periodObj) return null;
        const subj = subjectMap[periodObj.title] || null;

        let color = subj ? subj.colour : periodObj.colour || periodObj.color || 'e5e7eb';
        let link = null;

        const subjectName = subj ? (subj.title || subj.shortTitle || subj.subject) : (periodObj.title);
        if (subjectName && subjectConfig[subjectName]) {
            if (subjectConfig[subjectName].color) color = subjectConfig[subjectName].color;
            if (subjectConfig[subjectName].link) link = subjectConfig[subjectName].link;
        }

        return {
            ...periodObj,
            color: color,
            link: link,
            fullTeacher: subj ? subj.fullTeacher : periodObj.fullTeacher || periodObj.teacher,
            subjectCode: subj ? (subj.shortTitle || subj.title) : (periodObj.title || 'Unknown')
        };
    }

    function getCachedDayData(date) {
        const cachedRaw = localStorage.getItem('todayData_' + date);
        if (cachedRaw) {
            try {
                const cachedObj = JSON.parse(cachedRaw);
                return cachedObj.data || cachedObj;
            } catch(e) {}
        }
        return null;
    }

    async function fetchDayData(date, forceFetch = false) {
        if (!studentData?.accessToken) return null;
        if (pendingFetches[date] && !forceFetch) return pendingFetches[date];

        const fetchPromise = (async () => {
            const cachedRaw = localStorage.getItem('todayData_' + date);
            let cachedData = null;
            if (cachedRaw) {
                 try {
                    const cachedObj = JSON.parse(cachedRaw);
                    cachedData = cachedObj.data || cachedObj;
                    const now = new Date().getTime();
                    if (!forceFetch && cachedObj.timestamp && (now - cachedObj.timestamp < CACHE_TTL)) { 
                        if (cachedData && (cachedData.status === 'OK' || cachedData.timetable)) {
                             if (cachedData.bells) {
                                bellCache[date] = cachedData.bells.map(b => ({
                                    period: b.period || b.bell,  
                                    startTime: b.startTime || b.time,
                                    endTime: b.endTime || '23:59',
                                    label: b.bellDisplay || b.bell || b.period
                                }));
                            }
                            return cachedData;
                        }
                    }
                } catch(e) { }
            }

            let data = null;
            try {
                await ensureFreshToken();
                showLoadingBar();
                let res = await fetch('/api/proxy/day-data?date=' + date + '&_=' + new Date().getTime(), {
                    headers: { 'Authorization': 'Bearer ' + studentData.accessToken }
                });
                
                if (res.status === 401 || res.status === 403) {
                    const refreshRes = await fetch('/api/auth/refresh');
                    const refreshData = await refreshRes.json();
                    if (refreshData.success && refreshData.accessToken) {
                        studentData.accessToken = refreshData.accessToken;
                        localStorage.setItem('studentData', JSON.stringify(studentData));
                        clearReauthBanner();
                        res = await fetch('/api/proxy/day-data?date=' + date + '&_=' + new Date().getTime(), {
                            headers: { 'Authorization': 'Bearer ' + studentData.accessToken }
                        });
                    } else {
                        throw new Error('AUTH_EXPIRED');
                    }
                }

                if (res.ok) {
                    data = await res.json();
                    if (data && (data.status === 'OK' || data.timetable)) {
                        const cacheObj = { timestamp: new Date().getTime(), data: data };
                        localStorage.setItem('todayData_' + date, JSON.stringify(cacheObj));
                        if (data.bells && data.bells.length > 0) {
                            bellCache[date] = data.bells.map(b => ({
                                period: b.period || b.bell,  
                                startTime: b.startTime || b.time,
                                endTime: b.endTime || '23:59',
                                label: b.bellDisplay || b.bell || b.period
                            }));
                        }
                    }
                    return data;
                }
            } catch(e) {
                if (e.message === 'AUTH_EXPIRED') throw e;
                console.error(e);
            } finally {
                hideLoadingBar();
            }

            return data || cachedData;
        })();

        if (!forceFetch) pendingFetches[date] = fetchPromise;
        try { return await fetchPromise; } finally { if (!forceFetch) delete pendingFetches[date]; }
    }

    let _calendarWeekCache = {};
    let _calendarFetchPromises = {};

    function getWeekRange(dateStr) {
        const d = new Date(dateStr + 'T12:00:00');
        const day = d.getDay();
        const diffToMonday = (day === 0 ? -6 : 1 - day);
        const monday = new Date(d);
        monday.setDate(d.getDate() + diffToMonday);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        const fmt = (dt) => \`\${dt.getFullYear()}-\${String(dt.getMonth() + 1).padStart(2, '0')}-\${String(dt.getDate()).padStart(2, '0')}\`;
        return { from: fmt(monday), to: fmt(sunday), key: fmt(monday) };
    }

    function getCachedCalendarWeek(key) {
        if (_calendarWeekCache[key]) {
            const cached = _calendarWeekCache[key];
            if (Date.now() - cached.timestamp < CACHE_TTL) return cached.events;
            delete _calendarWeekCache[key];
        }
        try {
            const raw = localStorage.getItem('calendarWeek_' + key);
            if (raw) {
                const cached = JSON.parse(raw);
                if (cached.timestamp && (Date.now() - cached.timestamp < CACHE_TTL)) {
                    _calendarWeekCache[key] = cached;
                    return cached.events;
                }
                localStorage.removeItem('calendarWeek_' + key);
            }
        } catch(e) {}
        return null;
    }

    function writeCalendarWeeks(events, now) {
        const buckets = {};
        events.forEach(e => {
            const d = new Date(e.start || e.startDateTime);
            if (isNaN(d)) return;
            const dateStr = d.toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' });
            const { key } = getWeekRange(dateStr);
            if (!buckets[key]) buckets[key] = [];
            buckets[key].push(e);
        });
        Object.keys(buckets).forEach(key => {
            const entry = { timestamp: now, events: buckets[key] };
            _calendarWeekCache[key] = entry;
            try { localStorage.setItem('calendarWeek_' + key, JSON.stringify(entry)); } catch(e) {}
        });
    }

    function getCachedCalendarData(date) {
        const { key } = getWeekRange(date);
        const weekEvents = getCachedCalendarWeek(key);
        if (weekEvents) {
            return weekEvents.filter(e => {
                const d = new Date(e.start || e.startDateTime);
                return d.toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' }) === date;
            });
        }
        try {
            const raw = localStorage.getItem('calendarData_' + date);
            if (raw) {
                const cachedObj = JSON.parse(raw);
                return cachedObj.events || [];
            }
        } catch(e) {}
        return null;
    }

    function getCachedCalendarRange(date) {
        return getCachedCalendarData(date);
    }

    async function fetchCalendarData(date, forceFetch = false) {
        const { key: weekKey } = getWeekRange(date);

        if (!forceFetch) {
            const cached = getCachedCalendarWeek(weekKey);
            if (cached) {
                return cached.filter(e => {
                    const d = new Date(e.start || e.startDateTime);
                    return d.toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' }) === date;
                });
            }
            if (_calendarFetchPromises[weekKey]) return _calendarFetchPromises[weekKey];
        }

        const fetchPromise = (async () => {
            let urls = [];
            const rawUrls = localStorage.getItem('calendarUrls');
            if (rawUrls) {
                try { urls = JSON.parse(rawUrls); } catch(e) {}
            } else {
                const oldUrl = localStorage.getItem('clipboardUrl');
                if (oldUrl) {
                    urls = [oldUrl];
                    localStorage.setItem('calendarUrls', JSON.stringify(urls));
                    localStorage.removeItem('clipboardUrl');
                }
            }
            if (!urls || urls.length === 0) return [];

            // Compute a range: 7 days before to 14 days after the requested date
            const d = new Date(date + 'T12:00:00');
            const fromDate = new Date(d);
            fromDate.setDate(fromDate.getDate() - 7);
            const toDate = new Date(d);
            toDate.setDate(toDate.getDate() + 14);
            const fromStr = fromDate.toISOString().split('T')[0];
            const toStr = toDate.toISOString().split('T')[0];
            
            try {
                showLoadingBar();
                const results = await Promise.all(urls.map(async (url) => {
                    try {
                        const res = await fetch('/api/clipboard/events?url=' + encodeURIComponent(url) + '&from=' + fromStr + '&to=' + toStr + '&date=' + date);
                        if (res.ok) {
                            const data = await res.json();
                            return data.events || [];
                        }
                    } catch (e) { console.error('Failed for url', url, e); }
                    return [];
                }));

                const allEvents = results.flat();
                const now = Date.now();
                // Cache per-day (backward compat)
                try {
                    localStorage.setItem('calendarData_' + date, JSON.stringify({
                        timestamp: now,
                        events: allEvents.filter(e => {
                            const d = new Date(e.start || e.startDateTime);
                            return d.toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' }) === date;
                        })
                    }));
                } catch(e) {}
                // Index all events into Mon–Sun week buckets (main cache)
                writeCalendarWeeks(allEvents, now);
                // Filter to just the requested date for return
                return allEvents.filter(e => {
                    const d = new Date(e.start || e.startDateTime);
                    return d.toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' }) === date;
                });
            } catch (e) {
                console.error('All calendar fetches failed', e);
                return getCachedCalendarData(date) || [];
            } finally {
                hideLoadingBar();
            }
        })();

        if (!forceFetch) _calendarFetchPromises[weekKey] = fetchPromise;
        try { return await fetchPromise; } finally { if (!forceFetch) delete _calendarFetchPromises[weekKey]; }
    }

    let _clipboardSessionsCache = {};       // keyed by "dateAfter_dateBefore" or "global"
    let _clipboardSessionsTimestamps = {};  // keyed the same way
    const CLIPBOARD_SESSIONS_TTL = 3600000; // 1 hour

    function _clipboardCacheKey(dateAfter, dateBefore) {
        return (dateAfter || '') + '_' + (dateBefore || '');
    }

    async function fetchClipboardSessions(forceFetch = false, dateAfter = undefined, dateBefore = undefined) {
        if (!studentData?.accessToken || !studentData?.studentId) {
            console.warn('[clipboard-sessions] skipped: missing accessToken or studentId', { accessToken: !!studentData?.accessToken, studentId: !!studentData?.studentId });
            if (!studentData?.studentId) showReauthBanner();
            return null;
        }

        const cacheKey = _clipboardCacheKey(dateAfter, dateBefore);
        const now = Date.now();
        if (!forceFetch && _clipboardSessionsCache[cacheKey] && (now - _clipboardSessionsTimestamps[cacheKey] < CLIPBOARD_SESSIONS_TTL)) {
            console.log('[clipboard-sessions] serving from memory cache', cacheKey);
            return _clipboardSessionsCache[cacheKey];
        }

        // Check localStorage cache
        if (!forceFetch) {
            try {
                const raw = localStorage.getItem('clipboardSessionsCache_' + cacheKey);
                if (raw) {
                    const cached = JSON.parse(raw);
                    if (cached.timestamp && (now - cached.timestamp < CLIPBOARD_SESSIONS_TTL) && cached.data) {
                        console.log('[clipboard-sessions] serving from localStorage', cacheKey);
                        _clipboardSessionsCache[cacheKey] = cached.data;
                        _clipboardSessionsTimestamps[cacheKey] = cached.timestamp;
                        return cached.data;
                    }
                }
            } catch(e) {}
        }

        try {
            showLoadingBar();
            const context = new Date().getFullYear().toString();
            // Defensive default: always send a bounded window to avoid unbounded page-1 truncation
            if (!dateAfter || !dateBefore) {
                const now = new Date();
                const fallback = new Date(now);
                fallback.setDate(fallback.getDate() - 14);
                const fallback2 = new Date(now);
                fallback2.setDate(fallback2.getDate() + 14);
                if (!dateAfter) dateAfter = fallback.toISOString().split('T')[0];
                if (!dateBefore) dateBefore = fallback2.toISOString().split('T')[0];
            }
            const params = new URLSearchParams({ studentId: studentData.studentId, context });
            params.set('date[after]', dateAfter);
            params.set('date[before]', dateBefore);

            console.log('[clipboard-sessions] fetching', { dateAfter, dateBefore, context, studentId: studentData.studentId });
            await ensureFreshToken();
            let res = await fetch('/api/proxy/clipboard-sessions?' + params.toString(), {
                headers: { 'Authorization': 'Bearer ' + studentData.accessToken }
            });
            console.log('[clipboard-sessions] response', { status: res.status, ok: res.ok });

            if (res.status === 401 || res.status === 403) {
                console.log('[clipboard-sessions] got', res.status, '— attempting refresh');
                const refreshRes = await fetch('/api/auth/refresh');
                const refreshData = await refreshRes.json();
                console.log('[clipboard-sessions] refresh result', { success: refreshData.success, hasToken: !!refreshData.accessToken });
                if (refreshData.success && refreshData.accessToken) {
                    studentData.accessToken = refreshData.accessToken;
                    localStorage.setItem('studentData', JSON.stringify(studentData));
                    clearReauthBanner();
                    res = await fetch('/api/proxy/clipboard-sessions?' + params.toString(), {
                        headers: { 'Authorization': 'Bearer ' + refreshData.accessToken }
                    });
                    console.log('[clipboard-sessions] retry after refresh', { status: res.status, ok: res.ok });
                } else {
                    console.warn('[clipboard-sessions] refresh failed — showing reauth banner');
                    showReauthBanner();
                    return null;
                }
            }

            if (!res.ok) {
                console.warn('[clipboard-sessions] fetch failed', res.status);
                showReauthBanner();
                return null;
            }

            const data = await res.json();
            _clipboardSessionsCache[cacheKey] = data;
            _clipboardSessionsTimestamps[cacheKey] = now;
            try {
                localStorage.setItem('clipboardSessionsCache_' + cacheKey, JSON.stringify({ timestamp: now, data }));
            } catch(e) {}
            return data;
        } catch (e) {
            console.error('[clipboard-sessions] fetch threw', e);
            showReauthBanner();
            return null;
        } finally {
            hideLoadingBar();
        }
    }

    function getCachedClipboardSessions(dateAfter = undefined, dateBefore = undefined) {
        const cacheKey = _clipboardCacheKey(dateAfter, dateBefore);
        if (_clipboardSessionsCache[cacheKey]) return _clipboardSessionsCache[cacheKey];
        try {
            const raw = localStorage.getItem('clipboardSessionsCache_' + cacheKey);
            if (raw) {
                const cached = JSON.parse(raw);
                const now = Date.now();
                if (cached.timestamp && (now - cached.timestamp < CLIPBOARD_SESSIONS_TTL) && cached.data) {
                    _clipboardSessionsCache[cacheKey] = cached.data;
                    _clipboardSessionsTimestamps[cacheKey] = cached.timestamp;
                    return cached.data;
                }
            }
        } catch(e) {}
        return null;
    }

    function getClipboardSessionsForDate(sessions, dateStr) {
        if (!sessions?.member) return [];
        return sessions.member.filter(s => {
            const d = new Date(s.startDateTime);
            const ed = d.toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' });
            return ed === dateStr;
        });
    }

    function formatTime(t) {
        if (!t) return '';
        const [h, m] = t.split(':').map(Number);
        const suffix = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 || 12;
        return \`\${h12}:\${m.toString().padStart(2, '0')} \${suffix}\`;
    }
        function getLocalDateStr(d = new Date()) {
    return \`\${d.getFullYear()}-\${String(d.getMonth() + 1).padStart(2, '0')}-\${String(d.getDate()).padStart(2, '0')}\`;
}

    function paperDateFormat(dateStr) {
        const d = new Date(dateStr + 'T12:00:00');
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const dayName = days[d.getDay()];
        const day = d.getDate();
        const month = months[d.getMonth()];
        const year = d.getFullYear();
        const ord = (n) => { if (n > 3 && n < 21) return 'th'; switch (n % 10) { case 1: return 'st'; case 2: return 'nd'; case 3: return 'rd'; default: return 'th'; } };
        return dayName + ', ' + month + ' ' + day + ord(day) + ', ' + year;
    }

    function isTimePast(dateStr, timeStr) {
        if (!timeStr) return false;
        const t = new Date();
        const todayStr = \`\${t.getFullYear()}-\${String(t.getMonth() + 1).padStart(2, '0')}-\${String(t.getDate()).padStart(2, '0')}\`;
        if (dateStr < todayStr) return true;
        if (dateStr > todayStr) return false;
        const [h, m] = timeStr.split(':').map(Number);
        const now = new Date();
        const check = new Date(now);
        check.setHours(h, m, 0, 0);
        return now > check;
    }

    function attachHoverEffects() {
        const cards = document.querySelectorAll('.period-card');
        cards.forEach(card => {
            const subject = card.getAttribute('data-subject');
            card.addEventListener('click', (e) => {
                e.stopPropagation(); 
                const link = card.getAttribute('data-link');
                const title = card.getAttribute('data-title');
                
                if (window.openClassModal) {
                    window.openClassModal({
                        subjectCode: subject,
                        subjectName: title || subject,
                        link: link,
                        date: currentDateStr
                    });
                }
                
                if (activeSubject === subject) {
                    activeSubject = null;
                    resetCards(cards);
                    return;
                }
                resetCards(cards);
                activeSubject = subject;
                highlightCards(cards, subject, card);
            });
            card.addEventListener('mouseenter', () => {
                if (activeSubject) return; 
                highlightCards(cards, subject, card);
            });
            card.addEventListener('mouseleave', () => {
                if (activeSubject) return; 
                resetCards(cards);
            });
        });
    }

    function highlightCards(cards, subject, sourceCard) {
        const wrapper = sourceCard.closest('.flex.items-center');
        if(wrapper) {
            wrapper.style.zIndex = '50';
            wrapper.style.position = 'relative';
        }
        
        document.querySelectorAll('.tooltip-content').forEach(t => t.style.display = 'none');
        const tooltip = sourceCard.querySelector('.tooltip-content');
        if (tooltip) {
            tooltip.style.display = 'block';
        }

        const start = sourceCard.getAttribute('data-start');
        const end = sourceCard.getAttribute('data-end');
        const title = sourceCard.getAttribute('data-title');
        const teacher = sourceCard.getAttribute('data-teacher');
        const room = sourceCard.getAttribute('data-room');
        const link = sourceCard.getAttribute('data-link');
        if(start) {
            hoveredPeriodData = { start, end, title, teacher, room, link };
            if (window.updateTicker) window.updateTicker();
        }
        
        if (!subject) return;
        
        cards.forEach(c => {
            if (c.getAttribute('data-subject') === subject) {
                c.classList.add('opacity-100', 'ring-2', 'ring-offset-1', 'ring-gray-300');
                c.style.transform = 'scale(1.02)';
                c.style.zIndex = '10';
            } else {
                c.classList.add('opacity-25');
                c.classList.remove('opacity-100', 'ring-2', 'ring-offset-1', 'ring-gray-300');
                c.style.transform = '';
                c.style.zIndex = '';
            }
        });
    }

    function resetCards(cards) {
        hoveredPeriodData = null;
        if (window.updateTicker) window.updateTicker();
        cards.forEach(c => {
            const wrapper = c.closest('.flex.items-center');
            if(wrapper) {
                wrapper.style.zIndex = '';
                wrapper.style.position = '';
            }
            c.classList.remove('opacity-25', 'opacity-100', 'ring-2', 'ring-offset-1', 'ring-gray-300');
            c.style.transform = '';
            c.style.zIndex = '';
        });
        document.querySelectorAll('.tooltip-content').forEach(t => t.style.display = 'none');
    }

    function getMiniCycleHtml(subjectCode, color) {
        if (!subjectCode) return '';
        const t = new Date();
        const tStr = \`\${t.getFullYear()}-\${String(t.getMonth() + 1).padStart(2, '0')}-\${String(t.getDate()).padStart(2, '0')}\`;
        const todayInfo = calendarMap[tStr];
        const todayNum = todayInfo ? todayInfo.dayNumber : null;
        let htmlContent = '<div class="grid grid-cols-5 gap-1 gap-y-2">';
        for (let week=0; week<2; week++) {
            for (let day=1; day<=5; day++) {
                const dayNum = (week*5) + day;
                const dData = daysData[dayNum.toString()];
                let hasSubject = false;
                if (dData && dData.periods) {
                    Object.values(dData.periods).forEach(p => {
                        if (!p) return;
                        const e = enrichPeriod(p);
                        if (e && e.subjectCode === subjectCode) hasSubject = true;
                    });
                }
                const bgClass = hasSubject ? '' : 'bg-gray-700';
                const style = hasSubject ? \`background-color: \${color};\` : '';
                let extraClass = '';
                if (todayNum && dayNum.toString() === todayNum) {
                    extraClass = 'ring-2 ring-white ring-offset-1 ring-offset-gray-800'; 
                }
                htmlContent += \`<div class="h-1.5 rounded-full w-full \${bgClass} \${extraClass}" style="\${style}"></div>\`;
            }
        }
        htmlContent += '</div>';
        return htmlContent;
    }

    function getNextSubjectOccurrence(subjectCode, currentDateStr, currentPeriodId) {
        if (!subjectCode) return '';
        const pOrder = ['0', '1', '2', '3', '4', '5'];
        let pInd = pOrder.indexOf(currentPeriodId);
        const [y, m, d] = currentDateStr.split('-').map(Number);
        let searchDate = new Date(y, m - 1, d);
        let checkFromIndex = pInd + 1;
        for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
            if (dayOffset > 0) {
                searchDate.setDate(searchDate.getDate() + 1);
                checkFromIndex = 0; 
            }
            const dy = searchDate.getFullYear();
            const dm = String(searchDate.getMonth() + 1).padStart(2, '0');
            const dd = String(searchDate.getDate()).padStart(2, '0');
            const sStr = \`\${dy}-\${dm}-\${dd}\`;
            const dInfo = calendarMap[sStr];
            if (dInfo && daysData[dInfo.dayNumber]) {
                const dayP = daysData[dInfo.dayNumber].periods;
                for (let i = checkFromIndex; i < pOrder.length; i++) {
                    const pId = pOrder[i];
                    const pData = dayP[pId];
                    if (pData) {
                        const enriched = enrichPeriod(pData);
                        if (enriched && enriched.subjectCode === subjectCode) {
                            let dayLabel = '';
                            if (dayOffset === 0) dayLabel = 'Today';
                            else if (dayOffset === 1) dayLabel = 'Next Day';
                            else {
                                const dName = dInfo.dayName || '';
                                dayLabel = dName.replace(/[AB]$/, '');
                            }
                            return \`Next: \${dayLabel} P\${pId}\`;
                        }
                    }
                }
            }
        }
        return '/';
    }

    document.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            let targetLink = hoveredPeriodData?.link;
            if (!targetLink && activeSubject) {
                // Find first card matching activeSubject to get link
                const cards = document.querySelectorAll('.period-card');
                for (let i = 0; i < cards.length; i++) {
                    if (cards[i].getAttribute('data-subject') === activeSubject) {
                        targetLink = cards[i].getAttribute('data-link');
                        if (targetLink) break;
                    }
                }
            }

            if (targetLink) {
                e.preventDefault();
                window.open(targetLink, '_blank');
            }
        }
    });

    function getTermInfo(dateStr) {
        const d = new Date(dateStr + 'T12:00:00');
        const dTime = d.getTime();
        const termStarts = [
            { term: 1, start: new Date('2026-02-02T12:00:00').getTime() },
            { term: 2, start: new Date('2026-04-20T12:00:00').getTime() },
            { term: 3, start: new Date('2026-07-19T12:00:00').getTime() },
            { term: 4, start: new Date('2026-10-12T12:00:00').getTime() }
        ];

        for (let i = termStarts.length - 1; i >= 0; i--) {
            if (dTime >= termStarts[i].start) {
                const weekDiff = Math.floor((dTime - termStarts[i].start) / (7 * 24 * 60 * 60 * 1000));
                return { term: termStarts[i].term, week: weekDiff + 1 };
            }
        }
        return null;
    }

    function getTermLabel(dateStr) {
        const info = getTermInfo(dateStr);
        if (!info) return '';
        return ' [Term ' + info.term + ' Week ' + info.week + ']';
    }

    (function() {
        const style = document.createElement('style');
        style.textContent = '@keyframes loading-bar-indeterminate{0%{transform:translateX(-100%)}100%{transform:translateX(350%)}}.animate-loading-bar{animation:loading-bar-indeterminate 1.2s ease-in-out infinite}';
        document.head.appendChild(style);
    })();

</script>`