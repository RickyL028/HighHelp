import { html } from 'hono/html'

export const TimetableConfig = html`
<div id="config-container" class="hidden">
    <div class="bg-white dark:bg-neutral-800 rounded-2xl p-6 border border-gray-200 dark:border-neutral-700 shadow-sm">
        <h2 class="text-xl font-bold text-gray-800 dark:text-neutral-100 mb-4">Calendar Linking</h2>
        <div class="mb-4">
            <label class="block text-gray-700 dark:text-neutral-300 text-sm font-bold mb-2" for="calendar-urls">
                Calendar URLs (ICS - One per line)
            </label>
            <textarea class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 dark:text-white dark:bg-neutral-900 leading-tight focus:outline-none focus:shadow-outline transition-all duration-200 border-gray-300 dark:border-neutral-600 focus:border-red-500 focus:ring-1 focus:ring-red-500 resize-y" 
                   id="calendar-urls" rows="3" placeholder="https://internal-api.clipboard.app/student-guardian-api/calendar/123456789...&#10;https://sydneyboyshigh.instructure.com/feeds/calendars/123456789...&#10;Apple/Outlook Calendar also accepted"></textarea>
            <p class="text-gray-800 dark:text-neutral-300 text-ms mt-1">If including Clipboard:</p>
            <ol class="text-gray-800 dark:text-neutral-300 text-ms mt-1">
                <li>1. Go to <a href="https://portal.clipboard.app/sbhs/calendar" target="_blank" class="text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300">Clipboard</a></li>
                <li>2. On the upper right corner, click <a class="text-gray-900 dark:text-neutral-100 font-bold">"Add to Calendar"</a></li>
                <li>3. Copy the Calendar URL and paste it above</li>
            </ol>
            <br></br>
            <p class="text-gray-800 dark:text-neutral-300 text-ms mt-1">If including Canvas:</p>
            <ol class="text-gray-800 dark:text-neutral-300 text-ms mt-1">
                <li>1. Go to <a href="https://sydneyboyshigh.instructure.com/calendar" target="_blank" class="text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300">Canvas</a></li>
                <li>2. On the right panel, click <a class="text-gray-900 dark:text-neutral-100 font-bold">"Calendar Feed"</a></li>
                <li>3. Copy the Calendar URL and paste it above</li>
            </ol>
        </div>

        <h2 class="text-xl font-bold text-gray-800 dark:text-neutral-100 mb-4 border-t border-gray-200 dark:border-neutral-700 pt-4">Subject Customisation</h2>
        <div class="mb-4">
            <p class="text-gray-600 dark:text-neutral-400 text-sm mb-3">Customise colours and add links subjects (canvas).</p>
            <div id="subject-config-list" class="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                <div class="text-center py-4">
                    <div class="animate-pulse flex space-x-4">
                        <div class="flex-1 space-y-4 py-1">
                            <div class="h-4 bg-gray-200 dark:bg-neutral-700 rounded w-3/4"></div>
                            <div class="space-y-2">
                                <div class="h-4 bg-gray-200 dark:bg-neutral-700 rounded"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <button id="save-config" class="bg-blue-500 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition-colors duration-200">
            Sync
        </button>
        <p id="config-status" class="text-green-500 text-sm mt-2 hidden opacity-0 transition-opacity duration-300">Configuration saved!</p>
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
                // FIXED: Use \\n so the browser receives standard \n
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

                statusMsg.textContent = 'Configuration saved!';
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
                    // Safe access without using TypeScript 'as' keywords
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
                subjectConfigContainer.innerHTML = '<p class="text-gray-500 dark:text-neutral-500 italic">No subjects found to configure.</p>';
                return;
            }

            subjects.forEach(subject => {
                const subjectName = subject.title || subject.shortTitle || subject.subject || 'Unknown';
                const currentVal = config[subjectName] || {};
                const defaultColor = subject.colour || '#e5e7eb';
                
                const div = document.createElement('div');
                div.className = 'flex items-center gap-4 p-3 bg-gray-50 dark:bg-neutral-900/50 rounded-lg border border-gray-100 dark:border-neutral-700';
                
                div.innerHTML = \`
                    <div class="flex-grow">
                        <h4 class="font-bold text-gray-800 dark:text-neutral-100 text-sm">\${subjectName}</h4>
                        <p class="text-xs text-gray-500 dark:text-neutral-400">\${subject.fullTeacher || subject.teacher || ''}</p>
                    </div>
                    <div class="flex flex-col gap-2 w-1/2">
                        <div class="flex items-center gap-2">
                            <label class="text-xs text-gray-600 dark:text-neutral-400 w-12">Colour:</label>
                            <input type="color" class="subject-color h-8 w-14 rounded cursor-pointer bg-transparent border-0" data-subject="\${subjectName}" value="\${currentVal.color ? '#' + currentVal.color : (defaultColor.startsWith('#') ? defaultColor : '#' + defaultColor)}">
                        </div>
                        <div class="flex items-center gap-2">
                            <label class="text-xs text-gray-600 dark:text-neutral-400 w-12">Canvas:</label>
                            <input type="text" class="subject-link shadow appearance-none border dark:border-neutral-600 rounded w-full py-1 px-2 text-gray-700 dark:text-white dark:bg-neutral-800 text-xs leading-tight focus:outline-none focus:shadow-outline"
                                data-subject="\${subjectName}"
                                placeholder="https://..."
                                value="\${currentVal.link || ''}">
                        </div>
                    </div>\`;
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
                // FIXED: Use \\n for the join method as well
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
    })();
</script>
`