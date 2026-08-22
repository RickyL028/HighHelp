import { html } from 'hono/html'

export const TimetableConfig = html`
<div id="config-container" class="hidden">
    <div class="divide-y divide-gray-100 dark:divide-neutral-800">
        <!-- Appearance Theme -->
        <div class="py-5">
            <div class="flex items-start justify-between mb-3">
                <div>
                    <h2 class="text-sm font-bold text-gray-900 dark:text-neutral-100">Appearance</h2>
                    <p class="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">Choose how the timetable looks.</p>
                </div>
            </div>
            <div class="flex gap-2">
                <button class="timetable-theme-btn px-4 py-2 rounded-xl text-xs font-semibold transition-all border-2" data-theme="system">
                    <svg class="w-4 h-4 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                    System
                </button>
                <button class="timetable-theme-btn px-4 py-2 rounded-xl text-xs font-semibold transition-all border-2" data-theme="night">
                    <svg class="w-4 h-4 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg>
                    Night
                </button>
                <button class="timetable-theme-btn px-4 py-2 rounded-xl text-xs font-semibold transition-all border-2" data-theme="paper">
                    <svg class="w-4 h-4 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                    Paper
                </button>
                <button class="timetable-theme-btn px-4 py-2 rounded-xl text-xs font-semibold transition-all border-2" data-theme="glass">
                    <svg class="w-4 h-4 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path></svg>
                    Glass
                </button>
            </div>
        </div>

        <!-- Calendar URLs -->
        <div class="py-5">
            <div class="flex items-start justify-between mb-3">
                <div>
                    <h2 class="text-sm font-bold text-gray-900 dark:text-neutral-100">Calendar Feeds</h2>
                    <p class="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">Clipboard auto-syncs when logged in. Add other ICS links below (Canvas, etc.).</p>
                </div>
            </div>
            <textarea id="calendar-urls" rows="2"
                class="w-full text-xs bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-gray-700 dark:text-neutral-300 placeholder-gray-400 dark:placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-red-400 focus:border-red-400 transition resize-y"
                placeholder="https://canvas.instructure.com/calendar/..."></textarea>
            <div class="flex gap-3 mt-2 text-[11px] text-gray-400 dark:text-neutral-500">
                <a href="https://portal.clipboard.app/sbhs/calendar" target="_blank" class="hover:text-red-500 dark:hover:text-red-400 transition-colors">Clipboard →</a>
                <a href="https://sydneyboyshigh.instructure.com/calendar" target="_blank" class="hover:text-red-500 dark:hover:text-red-400 transition-colors">Canvas →</a>
            </div>
        </div>

        <!-- Subject Customisation -->
        <div class="py-5">
            <div class="flex items-start justify-between mb-3">
                <div>
                    <h2 class="text-sm font-bold text-gray-900 dark:text-neutral-100">Subject Colours & Links</h2>
                    <p class="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">Customise colours and Canvas links per subject.</p>
                </div>
            </div>
            <div id="subject-config-list" class="space-y-1 max-h-[360px] overflow-y-auto pr-1 custom-scrollbar">
                <div class="text-center py-6">
                    <div class="animate-pulse flex space-x-3">
                        <div class="flex-1 space-y-3 py-1">
                            <div class="h-3 bg-gray-200 dark:bg-neutral-700 rounded w-3/4"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="flex items-center justify-between mt-5 pt-4 border-t border-gray-100 dark:border-neutral-800">
        <button id="save-config" class="px-4 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold rounded-lg transition-colors">
            Save Changes
        </button>
        <p id="config-status" class="text-green-600 dark:text-green-400 text-xs hidden opacity-0 transition-opacity duration-300">Saved!</p>
    </div>
</div>
<script>
    (function() {
        const urlInput = document.getElementById('calendar-urls');
        const saveBtn = document.getElementById('save-config');
        const statusMsg = document.getElementById('config-status');
        const subjectConfigContainer = document.getElementById('subject-config-list');

        function initThemeButtons() {
            const currentTheme = localStorage.getItem('timetableTheme') || 'system';
            document.querySelectorAll('.timetable-theme-btn[data-theme]').forEach(btn => {
                const theme = btn.getAttribute('data-theme');
                if (theme === currentTheme) {
                    btn.classList.add('border-red-500', 'text-red-500', 'bg-red-50', 'dark:bg-red-500/10', 'dark:border-red-500/40', 'dark:text-red-400');
                    btn.classList.remove('border-gray-200', 'dark:border-neutral-700', 'text-gray-500', 'dark:text-neutral-400');
                } else {
                    btn.classList.remove('border-red-500', 'text-red-500', 'bg-red-50', 'dark:bg-red-500/10', 'dark:border-red-500/40', 'dark:text-red-400');
                    btn.classList.add('border-gray-200', 'dark:border-neutral-700', 'text-gray-500', 'dark:text-neutral-400');
                }
                btn.addEventListener('click', () => {
                    if (btn.disabled) return;
                    localStorage.setItem('timetableTheme', theme);
                    window.dispatchEvent(new CustomEvent('timetableThemeChanged', { detail: { theme } }));
                    initThemeButtons();
                });
            });
        }
        function saveAll() {
            try {
                const urls = urlInput.value.split('\\n').map(u => u.trim()).filter(u => u);
                localStorage.setItem('calendarUrls', JSON.stringify(urls));

                const newConfig = {};
                document.querySelectorAll('.subject-color').forEach(input => {
                    const subject = input.getAttribute('data-subject');
                    const color = input.value.replace('#', '');
                    if (!newConfig[subject]) newConfig[subject] = {};
                    newConfig[subject].color = color;
                });

                document.querySelectorAll('.subject-link').forEach(input => {
                    const subject = input.getAttribute('data-subject');
                    const link = input.value.trim();
                    if (!newConfig[subject]) newConfig[subject] = {};
                    if (link) newConfig[subject].link = link;
                });

                localStorage.setItem('subjectConfig', JSON.stringify(newConfig));
                window.dispatchEvent(new Event('subjectConfigUpdated'));

                statusMsg.textContent = 'Saved!';
                statusMsg.classList.remove('hidden');
                void statusMsg.offsetWidth;
                statusMsg.classList.remove('opacity-0');

                setTimeout(() => {
                    statusMsg.classList.add('opacity-0');
                    setTimeout(() => statusMsg.classList.add('hidden'), 300);
                }, 2000);
            } catch (error) {
                console.error("Save error:", error);
            }
        }

        function loadSubjectConfig() {
            let subjects = [];
            let config = {};

            try {
                const raw = localStorage.getItem('studentData');
                if (raw) {
                    const studentData = JSON.parse(raw);
                    subjects = (studentData && studentData.timetable && studentData.timetable.subjects) ? studentData.timetable.subjects : [];
                }
            } catch(e) {}

            try {
                const rawConfig = localStorage.getItem('subjectConfig');
                if (rawConfig) config = JSON.parse(rawConfig);
            } catch(e) {}

            if (!subjectConfigContainer) return;

            subjectConfigContainer.innerHTML = '';
            if (subjects.length === 0) {
                subjectConfigContainer.innerHTML = '<p class="text-xs text-gray-400 dark:text-neutral-600 italic text-center py-4">No subjects found.</p>';
                return;
            }

            subjects.forEach(subject => {
                const subjectName = subject.title || subject.shortTitle || subject.subject || 'Unknown';
                const currentVal = config[subjectName] || {};
                const defaultColor = subject.colour || '#e5e7eb';

                const div = document.createElement('div');
                div.className = 'flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-900/30 transition-colors';

                div.innerHTML = \`
                    <div class="flex-1 min-w-0">
                        <div class="text-xs font-semibold text-gray-800 dark:text-neutral-200 truncate">\${subjectName}</div>
                        <div class="text-[10px] text-gray-400 dark:text-neutral-500 truncate">\${subject.fullTeacher || subject.teacher || ''}</div>
                    </div>
                    <div class="flex items-center gap-2 flex-shrink-0">
                        <input type="color" class="subject-color w-7 h-7 rounded cursor-pointer bg-transparent border-0 p-0" data-subject="\${subjectName}" value="\${currentVal.color ? '#' + currentVal.color : (defaultColor.startsWith('#') ? defaultColor : '#' + defaultColor)}">
                        <input type="text" class="subject-link w-28 text-[10px] bg-transparent border-0 border-b border-transparent focus:border-red-400 focus:ring-0 py-0.5 text-gray-500 dark:text-neutral-400 placeholder-gray-400 dark:placeholder-neutral-600 transition"
                            data-subject="\${subjectName}" placeholder="Canvas link" value="\${currentVal.link || ''}">
                    </div>
                \`;
                subjectConfigContainer.appendChild(div);
            });
        }

        if (urlInput && saveBtn && subjectConfigContainer) {
            try {
                let savedUrls = [];
                const rawUrls = localStorage.getItem('calendarUrls');
                if (rawUrls) {
                    savedUrls = JSON.parse(rawUrls);
                } else {
                    const oldUrl = localStorage.getItem('clipboardUrl');
                    if (oldUrl) {
                        savedUrls = [oldUrl];
                        localStorage.setItem('calendarUrls', JSON.stringify(savedUrls));
                        localStorage.removeItem('clipboardUrl');
                    }
                }
                urlInput.value = savedUrls.join('\\n');
            } catch (error) {}

            loadSubjectConfig();
            saveBtn.addEventListener('click', saveAll);

            urlInput.addEventListener('keydown', (e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                    saveAll();
                    urlInput.blur();
                }
            });

            subjectConfigContainer.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && e.target.classList.contains('subject-link')) {
                    saveAll();
                    e.target.blur();
                }
            });
        }

        initThemeButtons();
    })();
</script>
`
