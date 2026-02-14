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
                            const tabConfig = document.getElementById('tab-config');
                            const headerControls = document.querySelector('#content > .flex.items-center.gap-2.mb-6');
                            const configContainer = document.getElementById('config-container');
                            const timetableList = document.getElementById('timetable-list');
                            const cycleContainer = document.getElementById('cycle-view'); // Assuming cycle view has an ID or handle it via visibility toggle if inside timetable-list. 
                            // Actually cycle view renders into same container or replaces content? 
                            // renderCycle uses #timetable-list too usually but let's check.
                            // renderDay clears #timetable-list. renderCycle likely does too.
                            
                            // Let's check how renderCycle works. It probably renders into #timetable-list.
                            // But config container is separate div.
                            
                            // Reset tabs
                            [tabDay, tabCycle, tabConfig].forEach(t => {
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
                                if (dw !== 0) break;
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

export default app