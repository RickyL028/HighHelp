import { Hono } from 'hono'
import { Layout } from '../layout'
import { getUser } from '../utils'
import { Bindings } from '../types'
import { TimetableLayout } from '../components/timetable/TimetableLayout'
import { TimetableCore } from '../components/timetable/TimetableCore'
import { TimetableDay } from '../components/timetable/TimetableDay'
import { TimetableCycle } from '../components/timetable/TimetableCycle'
import { TimetableTicker } from '../components/timetable/TimetableTicker'
import { TimetableConfig } from '../components/timetable/TimetableConfig'
import { TimetableModal } from '../components/timetable/TimetableModal'
import { TimetableNotices } from '../components/timetable/TimetableNotices'
import { TimetableEvents } from '../components/timetable/TimetableEvents'
import { TimetableCalendar } from '../components/timetable/TimetableCalendar'
const app = new Hono<{ Bindings: Bindings }>()

app.get('/', async (c) => {
    const user = await getUser(c)
    if (!user) return c.redirect('/login')

    return c.html(
        <Layout title="Classes" user={user}>
            <TimetableLayout>
                {/* Core Logic and State */}
                {TimetableCore}

                {/* View Renderers */}
                {TimetableDay}
                {TimetableCycle}
                {TimetableConfig}
                {TimetableModal}
                {TimetableNotices}
                {TimetableEvents}
                {TimetableCalendar}
                {/* Ticker Logic */}
                {TimetableTicker}

                {/* Hide nav on timetable unless hovered */}
                <style dangerouslySetInnerHTML={{ __html: '.nav-hidden{transform:translateY(-100%);transition:transform .2s ease}.nav-hidden.visible{transform:translateY(0)}.nav-zone-active{pointer-events:none}' }} />

                {/* Initialization Script */}
                <script dangerouslySetInnerHTML={{
                    __html: `
                    window.currentUserPermission = ${user.permission_level || 0};
                    window.currentUserId = ${user.id};
                    (function() {
                        function render() {
                            if (window.location.pathname !== '/timetable') return;
                            activeSubject = null;
                            hoveredPeriodData = null;
                            
                            const tabDay = document.getElementById('tab-day');
                            const tabCycle = document.getElementById('tab-cycle');
                            const tabNotices = document.getElementById('tab-notices');
                            const tabEvents = document.getElementById('tab-events');
                            const tabCalendar = document.getElementById('tab-calendar');
                            const tabConfig = document.getElementById('tab-config');
                            const headerControls = document.querySelector('#content > .flex.items-center.gap-2.mb-6') || document.querySelector('#content > .flex.items-center.gap-2.mb-3');
                            const configContainer = document.getElementById('config-container');
                            const timetableList = document.getElementById('timetable-list');
                            const cycleContainer = document.getElementById('cycle-view');
                            const quickLinksWrapper = document.getElementById('quick-links-wrapper');
                            
                            // Reset tabs
                            [tabDay, tabCycle, tabNotices, tabEvents, tabCalendar, tabConfig].forEach(t => {
                                if(t) {
                                    t.classList.remove('border-red-500', 'text-red-500');
                                    t.classList.add('border-transparent', 'text-gray-500');
                                }
                            });

                            // Show quick links only in day/notices/events views
                            const showQuickLinks = ['day', 'notices', 'events', 'calendar'].includes(currentView);
                            if (quickLinksWrapper) {
                                quickLinksWrapper.style.display = showQuickLinks ? '' : 'none';
                            }

                            if (currentView === 'day') {
                                tabDay.classList.add('border-red-500', 'text-red-500');
                                tabDay.classList.remove('border-transparent', 'text-gray-500');
                                if (headerControls) headerControls.classList.remove('hidden');
                                if (configContainer) configContainer.classList.add('hidden');
                                if (timetableList) timetableList.classList.remove('hidden');
                                renderDay();
                            } else if (currentView === 'cycle') {
                                tabCycle.classList.add('border-red-500', 'text-red-500');
                                tabCycle.classList.remove('border-transparent', 'text-gray-500');
                                if (headerControls) headerControls.classList.add('hidden');
                                if (configContainer) configContainer.classList.add('hidden');
                                if (timetableList) timetableList.classList.remove('hidden');
                                renderCycle();
                            } else if (currentView === 'notices') {
                                if (tabNotices) {
                                    tabNotices.classList.add('border-red-500', 'text-red-500');
                                    tabNotices.classList.remove('border-transparent', 'text-gray-500');
                                }
                                if (headerControls) headerControls.classList.remove('hidden');
                                if (configContainer) configContainer.classList.add('hidden');
                                if (timetableList) timetableList.classList.remove('hidden');
                                if (window.renderNotices) window.renderNotices();
                            } else if (currentView === 'events') {
                                if (tabEvents) {
                                    tabEvents.classList.add('border-red-500', 'text-red-500');
                                    tabEvents.classList.remove('border-transparent', 'text-gray-500');
                                }
                                if (headerControls) headerControls.classList.remove('hidden');
                                if (configContainer) configContainer.classList.add('hidden');
                                if (timetableList) timetableList.classList.remove('hidden');
                                if (window.renderEvents) window.renderEvents();
                            } else if (currentView === 'calendar') {
                                if (tabCalendar) {
                                    tabCalendar.classList.add('border-red-500', 'text-red-500');
                                    tabCalendar.classList.remove('border-transparent', 'text-gray-500');
                                }
                                if (headerControls) headerControls.classList.remove('hidden');
                                if (configContainer) configContainer.classList.add('hidden');
                                if (timetableList) timetableList.classList.remove('hidden');
                                if (window.renderCalendar) window.renderCalendar();
                            } else if (currentView === 'config') {
                                tabConfig.classList.add('border-red-500', 'text-red-500');
                                tabConfig.classList.remove('border-transparent', 'text-gray-500');
                                if (headerControls) headerControls.classList.add('hidden');
                                if (timetableList) timetableList.classList.add('hidden');
                                if (configContainer) configContainer.classList.remove('hidden');
                            }
                        }

                        function changeDate(delta) {
                            const [y, m, day] = currentDateStr.split('-').map(Number);
                            let d = new Date(y, m - 1, day);
                            if (currentView === 'events') {
                                d.setDate(d.getDate() + (delta * 7));
                            } else if (currentView === 'calendar') {
                                if (window.calendarPrevMonth && delta < 0) { window.calendarPrevMonth(); return; }
                                if (window.calendarNextMonth && delta > 0) { window.calendarNextMonth(); return; }
                            } else {
                                let count = 0;
                                while(count < 7) {
                                    d.setDate(d.getDate() + delta);
                                    const dw = d.getDay();
                                    if (dw !== 0 && dw !== 6) break;
                                    count++;
                                }
                            }
                            const year = d.getFullYear();
                            const month = String(d.getMonth() + 1).padStart(2, '0');
                            const dy = String(d.getDate()).padStart(2, '0');
                            currentDateStr = \`\${year}-\${month}-\${dy}\`;
                            render();
                        }

                        window.addEventListener('todayDataRefreshed', (e) => {
                            if (window.location.pathname === '/timetable' && e.detail.date === currentDateStr) render();
                        });

                        document.getElementById('btn-prev').onclick = () => changeDate(-1);
                        document.getElementById('btn-next').onclick = () => changeDate(1);
                        document.getElementById('btn-reset').onclick = () => {
                            currentDateStr = getInitialDate();
                            if (currentView === 'calendar' && window.resetCalendarMonth) window.resetCalendarMonth();
                            render();
                        };
                        document.getElementById('tab-day').onclick = () => { currentView = 'day'; window.location.hash = 'day'; render(); };
                        document.getElementById('tab-cycle').onclick = () => { currentView = 'cycle'; window.location.hash = 'cycle'; render(); };
                        const noticesBtn = document.getElementById('tab-notices');
                        if (noticesBtn) noticesBtn.onclick = () => { currentView = 'notices'; window.location.hash = 'notices'; render(); };
                        const eventsBtn = document.getElementById('tab-events');
                        if (eventsBtn) eventsBtn.onclick = () => { currentView = 'events'; window.location.hash = 'events'; render(); };
                        const calendarBtn = document.getElementById('tab-calendar');
                        if (calendarBtn) calendarBtn.onclick = () => { currentView = 'calendar'; window.location.hash = 'exams'; render(); };
                        document.getElementById('tab-config').onclick = () => { currentView = 'config'; window.location.hash = 'config'; render(); };

                        document.addEventListener('click', (e) => {
                            if (activeSubject && !e.target.closest('.period-card')) {
                                activeSubject = null;
                                const cards = document.querySelectorAll('.period-card');
                                resetCards(cards);
                            }
                        });

                        // --- Quick Links Logic ---
                        function loadQuickLinksUI() {
                            const DEFAULT_LINKS = [
                                { title: 'Portal', url: 'https://student.sbhs.net.au' },
                                { title: 'Gmail', url: 'https://mail.google.com/' },
                                { title: 'Canvas', url: 'https://sydneyboyshigh.instructure.com' },
                                { title: 'Calendar', url: 'https://portal.clipboard.app/sbhs/calendar' }
                            ];

                            let quickLinks = [];
                            try {
                                const raw = localStorage.getItem('quickLinks');
                                if (raw) {
                                    quickLinks = JSON.parse(raw);
                                } else {
                                    // Set defaults on first load
                                    quickLinks = DEFAULT_LINKS;
                                    localStorage.setItem('quickLinks', JSON.stringify(quickLinks));
                                }
                            } catch(e) {
                                quickLinks = DEFAULT_LINKS;
                            }

                            const wrapper = document.getElementById('quick-links-wrapper');
                            let hasAny = false;

                            for (let i = 0; i < 4; i++) {
                                const btn = document.getElementById('ql-btn-' + i);
                                if (!btn) continue;
                                const ql = quickLinks[i];
                                if (ql && ql.title && ql.url) {
                                    btn.classList.remove('hidden');
                                    btn.classList.add('flex');
                                    btn.href = ql.url;
                                    btn.querySelector('.ql-title').textContent = ql.title;
                                    hasAny = true;
                                } else {
                                    btn.classList.add('hidden');
                                    btn.classList.remove('flex');
                                }
                            }

                            if (wrapper) {
                                if (hasAny) wrapper.classList.remove('hidden');
                                else wrapper.classList.add('hidden');
                            }
                        }

                        // Load quick links on init and listen for updates
                        loadQuickLinksUI();
                        window.addEventListener('quickLinksUpdated', loadQuickLinksUI);

                        // Hide nav unless hovered
                        const nav = document.querySelector('nav');
                        if (nav) {
                            const zone = document.createElement('div');
                            zone.style.cssText = 'position:fixed;top:0;left:0;right:0;height:30px;z-index:51';
                            document.body.prepend(zone);
                            nav.classList.add('nav-hidden');
                            nav.style.position = 'fixed';
                            nav.style.top = '0';
                            nav.style.left = '0';
                            nav.style.right = '0';
                            nav.style.zIndex = '50';
                            const show = function() { nav.classList.add('visible'); zone.classList.add('nav-zone-active'); };
                            const hide = function() { nav.classList.remove('visible'); zone.classList.remove('nav-zone-active'); };
                            zone.addEventListener('mouseenter', show);
                            nav.addEventListener('mouseenter', show);
                            nav.addEventListener('mouseleave', hide);
                        }

                        // Make render globally available for sub-components
                        window.render = render;

                        document.getElementById('loader').classList.add('hidden');
                        document.getElementById('content').classList.remove('hidden');
                        render();
                    })();
                    `
                }} />
            </TimetableLayout>
        </Layout>
    )
})

app.get('/notes', async (c) => {
    const user = await getUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const className = c.req.query('class_name');
    const date = c.req.query('date');
    if (!date) return c.json({ error: 'Missing parameters' }, 400);

    try {
        let query = `
            SELECT class_notes.*, users.first_name, users.last_name 
            FROM class_notes 
            JOIN users ON class_notes.user_id = users.id 
            WHERE date = ? 
        `;
        let params: any[] = [date];
        if (className) {
            query += " AND class_name = ?";
            params.push(className);
        }
        query += " ORDER BY created_at ASC";

        const { results } = await c.env.DB.prepare(query).bind(...params).all();
        return c.json({ notes: results });
    } catch (e) {
        console.error(e);
        return c.json({ error: 'Database error' }, 500);
    }
});

app.post('/notes', async (c) => {
    const user = await getUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    if (Number(user.permission_level) < 1) return c.json({ error: 'Forbidden' }, 403);

    const body = await c.req.json();
    const { class_name, date, content } = body;

    if (!class_name || !date || !content) return c.json({ error: 'Missing parameters' }, 400);

    try {
        const { results } = await c.env.DB.prepare(`
            INSERT INTO class_notes (user_id, class_name, date, content)
            VALUES (?, ?, ?, ?)
            RETURNING *
        `).bind(user.id, class_name, date, content).all();

        return c.json({ success: true, note: results[0] });
    } catch (e) {
        console.error(e);
        return c.json({ error: 'Database error' }, 500);
    }
});

app.delete('/notes/:id', async (c) => {
    const user = await getUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const id = c.req.param('id');

    try {
        const note: any = await c.env.DB.prepare('SELECT user_id FROM class_notes WHERE id = ?').bind(id).first();
        if (!note) return c.json({ error: 'Note not found' }, 404);

        if (note.user_id !== user.id && Number(user.permission_level) < 5) {
            return c.json({ error: 'Forbidden' }, 403);
        }

        await c.env.DB.prepare('DELETE FROM class_notes WHERE id = ?').bind(id).run();
        return c.json({ success: true });
    } catch (e) {
        console.error(e);
        return c.json({ error: 'Database error' }, 500);
    }
});

export default app