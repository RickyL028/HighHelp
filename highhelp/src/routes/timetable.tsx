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
                {/* Ticker Logic */}
                {TimetableTicker}

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
                            const tabConfig = document.getElementById('tab-config');
                            const headerControls = document.querySelector('#content > .flex.items-center.gap-2.mb-6') || document.querySelector('#content > .flex.items-center.gap-2.mb-3');
                            const configContainer = document.getElementById('config-container');
                            const timetableList = document.getElementById('timetable-list');
                            const cycleContainer = document.getElementById('cycle-view');
                            
                            // Reset tabs
                            [tabDay, tabCycle, tabNotices, tabEvents, tabConfig].forEach(t => {
                                if(t) {
                                    t.classList.remove('border-red-500', 'text-red-500');
                                    t.classList.add('border-transparent', 'text-gray-500');
                                }
                            });

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
                            let count = 0;
                            while(count < 7) {
                                d.setDate(d.getDate() + delta);
                                const dw = d.getDay();
                                if (dw !== 0 && dw !== 6) break;
                                count++;
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
                        document.getElementById('btn-reset').onclick = () => { currentDateStr = getInitialDate(); render(); };
                        document.getElementById('tab-day').onclick = () => { currentView = 'day'; render(); };
                        document.getElementById('tab-cycle').onclick = () => { currentView = 'cycle'; render(); };
                        const noticesBtn = document.getElementById('tab-notices');
                        if (noticesBtn) noticesBtn.onclick = () => { currentView = 'notices'; render(); };
                        const eventsBtn = document.getElementById('tab-events');
                        if (eventsBtn) eventsBtn.onclick = () => { currentView = 'events'; render(); };
                        document.getElementById('tab-config').onclick = () => { currentView = 'config'; render(); };

                        document.addEventListener('click', (e) => {
                            if (activeSubject && !e.target.closest('.period-card')) {
                                activeSubject = null;
                                const cards = document.querySelectorAll('.period-card');
                                resetCards(cards);
                            }
                        });

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