import { html } from 'hono/html'

export const TimetableConfig = html`
<div id="config-container" class="hidden">
    <div class="divide-y divide-gray-100 dark:divide-neutral-800">
        <!-- Calendar URLs -->
        <div class="py-5">
            <div class="flex items-start justify-between mb-3">
                <div>
                    <h2 class="text-sm font-bold text-gray-900 dark:text-neutral-100">Calendar Feeds</h2>
                    <p class="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">ICS links from Clipboard, Canvas, etc.</p>
                </div>
            </div>
            <textarea id="calendar-urls" rows="2"
                class="w-full text-xs bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-gray-700 dark:text-neutral-300 placeholder-gray-400 dark:placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-red-400 focus:border-red-400 transition resize-y"
                placeholder="https://internal-api.clipboard.app/..."></textarea>
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

        <!-- Quick Links -->
        <div class="py-5">
            <div class="flex items-start justify-between mb-3">
                <div>
                    <h2 class="text-sm font-bold text-gray-900 dark:text-neutral-100">Quick Links</h2>
                    <p class="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">Up to 4 shortcuts shown on Day, Notices & Events views.</p>
                </div>
            </div>
            <div id="quick-links-config" class="space-y-1.5">
                ${[1, 2, 3, 4].map(i => html`
                    <div class="flex items-center gap-2.5 px-3 py-2 bg-gray-50 dark:bg-neutral-900/50 rounded-lg">
                        <span class="text-[10px] font-bold text-gray-400 dark:text-neutral-500 w-4 text-right flex-shrink-0">${i}</span>
                        <input type="text" class="quick-link-title flex-1 min-w-0 text-xs bg-transparent border-0 border-b border-transparent focus:border-red-400 focus:ring-0 py-0.5 text-gray-700 dark:text-neutral-300 placeholder-gray-400 dark:placeholder-neutral-600 transition"
                            data-index="${i - 1}" placeholder="Title" maxlength="20">
                        <input type="text" class="quick-link-url flex-[2] min-w-0 text-xs bg-transparent border-0 border-b border-transparent focus:border-red-400 focus:ring-0 py-0.5 text-gray-700 dark:text-neutral-300 placeholder-gray-400 dark:placeholder-neutral-600 transition"
                            data-index="${i - 1}" placeholder="https://...">
                    </div>
                `)}
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

                const quickLinks = [];
                document.querySelectorAll('.quick-link-title').forEach(input => {
                    const idx = parseInt(input.getAttribute('data-index'));
                    const title = input.value.trim();
                    const urlInput = document.querySelector('.quick-link-url[data-index="' + idx + '"]');
                    const url = urlInput ? urlInput.value.trim() : '';
                    quickLinks[idx] = { title, url };
                });
                localStorage.setItem('quickLinks', JSON.stringify(quickLinks));
                window.dispatchEvent(new Event('quickLinksUpdated'));

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

        function loadQuickLinks() {
            const DEFAULT_LINKS = [
                { title: 'Portal', url: 'https://student.sbhs.net.au' },
                { title: 'Gmail', url: 'https://mail.google.com/' },
                { title: 'Canvas', url: 'https://sydneyboyshigh.instructure.com' },
                { title: 'Calendar', url: 'https://portal.clipboard.app/sbhs/calendar' }
            ];

            let quickLinks = [{}, {}, {}, {}];
            try {
                const raw = localStorage.getItem('quickLinks');
                if (raw) {
                    quickLinks = JSON.parse(raw);
                } else {
                    quickLinks = DEFAULT_LINKS;
                }
            } catch(e) {
                quickLinks = DEFAULT_LINKS;
            }
            document.querySelectorAll('.quick-link-title').forEach(input => {
                const idx = parseInt(input.getAttribute('data-index'));
                if (quickLinks[idx] && quickLinks[idx].title) input.value = quickLinks[idx].title;
            });
            document.querySelectorAll('.quick-link-url').forEach(input => {
                const idx = parseInt(input.getAttribute('data-index'));
                if (quickLinks[idx] && quickLinks[idx].url) input.value = quickLinks[idx].url;
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
            loadQuickLinks();
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
    })();
</script>
`
