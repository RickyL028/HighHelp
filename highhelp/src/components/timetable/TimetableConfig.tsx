import { html } from 'hono/html'

export const TimetableConfig = html`
<div id="config-container" class="hidden">
    <div class="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
        <h2 class="text-xl font-bold text-gray-800 mb-4">Clipboard Linking</h2>
        <div class="mb-4">
            <label class="block text-gray-700 text-sm font-bold mb-2" for="clipboard-url">
                Clipboard Calendar URL (ICS)
            </label>
            <input class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline transition-all duration-200 border-gray-300 focus:border-red-500 focus:ring-1 focus:ring-red-500" 
                   id="clipboard-url" type="text" placeholder="https://internal-api.clipboard.app/student-guardian-api/calendar/...">
            <p class="text-gray-800 text-ms mt-1">Follow the following steps to get your Clipboard calendar URL:</p>
            <ol class="text-gray-800 text-ms mt-1">
                <li>1. Go to <a href="https://portal.clipboard.app/sbhs/calendar" target="_blank" class="text-blue-500 hover:text-blue-600">Clipboard</a></li>
                <li>2. On the upper right corner, click <a class="text-gray-900 font-bold">"Add to Calendar"</a></li>
                <li>3. Copy the Calendar URL</li>
            </ol>
        </div>

        <h2 class="text-xl font-bold text-gray-800 mb-4 border-t border-gray-200 pt-4">Subject Customisation</h2>
        <div class="mb-4">
            <p class="text-gray-600 text-sm mb-3">Customise colours and add links subjects (canvas).</p>
            <div id="subject-config-list" class="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                <div class="text-center py-4">
                    <div class="animate-pulse flex space-x-4">
                        <div class="flex-1 space-y-4 py-1">
                            <div class="h-4 bg-gray-200 rounded w-3/4"></div>
                            <div class="space-y-2">
                                <div class="h-4 bg-gray-200 rounded"></div>
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
        const urlInput = document.getElementById('clipboard-url');
        const saveBtn = document.getElementById('save-config');
        const statusMsg = document.getElementById('config-status');
        const subjectConfigContainer = document.getElementById('subject-config-list');

        function saveAll() {
            // Save Clipboard URL
            const url = urlInput.value.trim();
            localStorage.setItem('clipboardUrl', url);
            
            // Save Subject Config
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
            
            // Notify other components
            window.dispatchEvent(new Event('subjectConfigUpdated'));

            // UI Feedback
            statusMsg.textContent = 'Configuration saved!';
            statusMsg.classList.remove('hidden');
            void statusMsg.offsetWidth; // Trigger reflow
            statusMsg.classList.remove('opacity-0');
            
            setTimeout(() => {
                statusMsg.classList.add('opacity-0');
                setTimeout(() => statusMsg.classList.add('hidden'), 300);
            }, 2000);
        }

        function loadSubjectConfig() {
            let studentData = null;
            try {
                const raw = localStorage.getItem('studentData');
                if (raw) studentData = JSON.parse(raw);
            } catch(e) { console.error(e); }

            const subjects = studentData?.timetable?.subjects || [];
            
            let config = {};
            try {
                const rawConfig = localStorage.getItem('subjectConfig');
                if (rawConfig) config = JSON.parse(rawConfig);
            } catch(e) {}

            if (subjectConfigContainer) {
                subjectConfigContainer.innerHTML = '';
                if (subjects.length === 0) {
                    subjectConfigContainer.innerHTML = '<p class="text-gray-500 italic">No subjects found to configure.</p>';
                    return;
                }

                subjects.forEach(subject => {
                    const subjectName = subject.title || subject.shortTitle || subject.subject || 'Unknown';
                    const currentVal = config[subjectName] || {};
                    const defaultColor = subject.colour || '#e5e7eb';
                    
                    const div = document.createElement('div');
                    div.className = 'flex items-center gap-4 p-3 bg-gray-50 rounded-lg border border-gray-100';
                    div.innerHTML = \`
                        <div class="flex-grow">
                            <h4 class="font-bold text-gray-800 text-sm">\${subjectName}</h4>
                            <p class="text-xs text-gray-500">\${subject.fullTeacher || subject.teacher || ''}</p>
                        </div>
                        <div class="flex flex-col gap-2 w-1/2">
                            <div class="flex items-center gap-2">
                                <label class="text-xs text-gray-600 w-12">Colour:</label>
                                <input type="color" class="subject-color h-8 w-14 rounded cursor-pointer" data-subject="\${subjectName}" value="\${currentVal.color ? '#' + currentVal.color : (defaultColor.startsWith('#') ? defaultColor : '#' + defaultColor)}">
                            </div>
                            <div class="flex items-center gap-2">
                                <label class="text-xs text-gray-600 w-12">Canvas:</label>
                                <input type="text" class="subject-link shadow appearance-none border rounded w-full py-1 px-2 text-gray-700 text-xs leading-tight focus:outline-none focus:shadow-outline"
                                    data-subject="\${subjectName}"
                                    placeholder="https://..."
                                    value="\${currentVal.link || ''}">
                            </div>
                        </div>\`;
                    subjectConfigContainer.appendChild(div);
                });
            }
        }

        if (urlInput && saveBtn) {
            // Initial Load
            const savedUrl = localStorage.getItem('clipboardUrl');
            if (savedUrl) urlInput.value = savedUrl;
            loadSubjectConfig();

            // Click listener
            saveBtn.addEventListener('click', saveAll);

            // "Enter" listener for Clipboard URL
            urlInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    saveAll();
                    urlInput.blur(); // Optional: remove focus after saving
                }
            });

            // "Enter" listener for dynamic Subject Link inputs (Event Delegation)
            subjectConfigContainer.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && e.target.classList.contains('subject-link')) {
                    saveAll();
                    e.target.blur(); // Optional: remove focus after saving
                }
            });
        }
    })();
</script>
`