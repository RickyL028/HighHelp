import { Hono } from 'hono'
import { Layout } from '../layout'
import { getUser } from '../utils'
import { Bindings } from '../types'
import { TimetableLayout } from '../components/timetable/TimetableLayout'
import { TimetableCore } from '../components/timetable/TimetableCore'
import { TimetableDay } from '../components/timetable/TimetableDay'
import { TimetableCycle } from '../components/timetable/TimetableCycle'
import { TimetableTicker } from '../components/timetable/TimetableTicker'

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

                {/* Ticker Logic */}
                {TimetableTicker}

                {/* Initialization Script */}
                <script dangerouslySetInnerHTML={{
                    __html: `
                    (function() {
                        function render() {
                            activeSubject = null;
                            hoveredPeriodData = null;
                            
                            const tabDay = document.getElementById('tab-day');
                            const tabCycle = document.getElementById('tab-cycle');
                            const headerControls = document.querySelector('#content > .flex.items-center.gap-2.mb-6');

                            if (currentView === 'day') {
                                tabDay.classList.add('border-red-500', 'text-red-500');
                                tabDay.classList.remove('border-transparent', 'text-gray-500');
                                tabCycle.classList.remove('border-red-500', 'text-red-500');
                                tabCycle.classList.add('border-transparent', 'text-gray-500');
                                if (headerControls) headerControls.classList.remove('hidden');
                                renderDay();
                            } else {
                                tabCycle.classList.add('border-red-500', 'text-red-500');
                                tabCycle.classList.remove('border-transparent', 'text-gray-500');
                                tabDay.classList.remove('border-red-500', 'text-red-500');
                                tabDay.classList.add('border-transparent', 'text-gray-500');
                                if (headerControls) headerControls.classList.add('hidden');
                                renderCycle();
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
                            if (e.detail.date === currentDateStr) render();
                        });

                        document.getElementById('btn-prev').onclick = () => changeDate(-1);
                        document.getElementById('btn-next').onclick = () => changeDate(1);
                        document.getElementById('btn-reset').onclick = () => { currentDateStr = getInitialDate(); render(); };
                        document.getElementById('tab-day').onclick = () => { currentView = 'day'; render(); };
                        document.getElementById('tab-cycle').onclick = () => { currentView = 'cycle'; render(); };

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

export default app