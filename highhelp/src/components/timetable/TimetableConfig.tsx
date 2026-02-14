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

        if (urlInput && saveBtn && statusMsg) {
            // Load saved URL
            const savedUrl = localStorage.getItem('clipboardUrl');
            if (savedUrl) urlInput.value = savedUrl;

            saveBtn.addEventListener('click', () => {
                const url = urlInput.value.trim();
                localStorage.setItem('clipboardUrl', url);
                
                statusMsg.textContent = 'Configuration saved!';
                statusMsg.classList.remove('hidden');
                // Trigger reflow
                void statusMsg.offsetWidth;
                statusMsg.classList.remove('opacity-0');
                
                setTimeout(() => {
                    statusMsg.classList.add('opacity-0');
                    setTimeout(() => statusMsg.classList.add('hidden'), 300);
                }, 2000);
            });
        }
    })();
</script>`