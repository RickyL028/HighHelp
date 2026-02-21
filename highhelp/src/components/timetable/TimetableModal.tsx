import { html } from 'hono/html'

export const TimetableModal = html`
<div id="class-modal" class="hidden fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-50 transition-opacity">
    <div class="bg-white rounded-2xl w-full max-w-lg mx-4 flex flex-col max-h-[90vh] shadow-2xl overflow-hidden transform transition-transform scale-95 opacity-0" id="class-modal-content">
        <!-- Header -->
        <div class="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
            <div>
                <h3 class="text-xl font-bold text-gray-900" id="modal-subject-name">Subject</h3>
                <p class="text-sm text-gray-500" id="modal-subject-date"></p>
            </div>
            <button id="modal-close-btn" class="text-gray-400 hover:text-gray-600 transition-colors">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
        </div>
        
        <!-- Body -->
        <div class="p-6 overflow-y-auto flex-grow bg-white">
            <div id="modal-link-container" class="mb-6 hidden">
                <a id="modal-subject-link" href="#" target="_blank" class="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 font-medium rounded-xl transition-colors">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                    Open Subject Link
                </a>
            </div>

            <div class="flex items-center justify-between mb-4">
                <h4 class="font-bold text-gray-800 text-lg flex items-center gap-2">
                    <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                    Class Notes
                </h4>
            </div>

            <div id="notes-container" class="space-y-3 mb-6">
                <div class="text-center py-6 text-gray-400">Loading notes...</div>
            </div>

            <!-- Add Note Section -->
            <div id="add-note-section" class="border-t border-gray-100 pt-4 hidden">
                <textarea id="new-note-content" class="w-full border border-gray-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all resize-none h-24 shadow-sm" placeholder="Write a note for this class..."></textarea>
                <div class="mt-3 flex justify-end">
                    <button id="btn-submit-note" class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2 shadow-sm">
                        <span>Post Note</span>
                    </button>
                    <button id="btn-login-note" class="hidden bg-gray-100 border border-gray-200 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium text-sm transition-colors cursor-pointer" onclick="window.location.href='/about'">
                        Request Access to Post Notes
                    </button>
                </div>
            </div>
        </div>
    </div>
</div>

<script>
    window.currentSubjectContext = null;

    function closeClassModal() {
        const modal = document.getElementById('class-modal');
        const content = document.getElementById('class-modal-content');
        if(modal && content) {
            content.classList.remove('scale-100', 'opacity-100');
            content.classList.add('scale-95', 'opacity-0');
            setTimeout(() => {
                modal.classList.add('hidden');
            }, 200);
        }
    }

    document.getElementById('modal-close-btn')?.addEventListener('click', closeClassModal);
    document.getElementById('class-modal')?.addEventListener('click', (e) => {
        if(e.target.id === 'class-modal') closeClassModal();
    });

    async function loadNotes(subjectCode, date) {
        const container = document.getElementById('notes-container');
        container.innerHTML = '<div class="text-center py-6 text-gray-400">Loading notes...</div>';
        
        try {
            const res = await fetch(\`/timetable/notes?class_name=\${encodeURIComponent(subjectCode)}&date=\${date}\`);
            const data = await res.json();
            
            if (data.notes && data.notes.length > 0) {
                container.innerHTML = data.notes.map(note => {
                    const canDelete = window.currentUserId === note.user_id || window.currentUserPermission >= 5;
                    const deleteBtn = canDelete ? \`<button onclick="deleteNote(\${note.id})" class="text-gray-400 hover:text-red-500 transition-colors p-1" title="Delete note"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>\` : '';
                    
                    const dt = new Date(note.created_at);
                    const timeStr = dt.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                    
                    return \`
                        <div class="bg-gray-50 border border-gray-100 rounded-xl p-3.5 group relative" id="note-\${note.id}">
                            <div class="flex justify-between items-start mb-1">
                                <span class="font-semibold text-sm text-gray-800">\${note.first_name} \${note.last_name || ''}</span>
                                <div class="flex items-center gap-2">
                                    <span class="text-xs text-gray-400">\${timeStr}</span>
                                    \${deleteBtn}
                                </div>
                            </div>
                            <p class="text-gray-600 text-sm whitespace-pre-wrap">\${note.content}</p>
                        </div>
                    \`;
                }).join('');
            } else {
                container.innerHTML = '<div class="text-center py-6 text-gray-400 text-sm">No notes for this class yet.</div>';
            }
        } catch (e) {
            console.error(e);
            container.innerHTML = '<div class="text-center py-6 text-red-400 text-sm">Failed to load notes.</div>';
        }
    }

    window.deleteNote = async function(id) {
        if(!confirm('Are you sure you want to delete this note?')) return;
        
        const noteEl = document.getElementById('note-' + id);
        if(noteEl) noteEl.style.opacity = '0.5';
        
        try {
            const res = await fetch(\`/timetable/notes/\${id}\`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                if(window.currentSubjectContext) {
                    loadNotes(window.currentSubjectContext.subjectCode, window.currentSubjectContext.date);
                }
            } else {
                alert(data.error || 'Failed to delete note');
                if(noteEl) noteEl.style.opacity = '1';
            }
        } catch(e) {
            console.error(e);
            alert('Error deleting note');
            if(noteEl) noteEl.style.opacity = '1';
        }
    };

    document.getElementById('btn-submit-note')?.addEventListener('click', async () => {
        const btn = document.getElementById('btn-submit-note');
        const input = document.getElementById('new-note-content');
        const content = input.value.trim();
        if (!content || !window.currentSubjectContext) return;
        
        btn.disabled = true;
        btn.innerHTML = 'Posting...';
        
        try {
            const res = await fetch('/timetable/notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    class_name: window.currentSubjectContext.subjectCode,
                    date: window.currentSubjectContext.date,
                    content: content
                })
            });
            
            const data = await res.json();
            if (data.success) {
                input.value = '';
                loadNotes(window.currentSubjectContext.subjectCode, window.currentSubjectContext.date);
            } else {
                alert(data.error || 'Failed to post note');
            }
        } catch (e) {
            console.error(e);
            alert('Error posting note');
        } finally {
            btn.disabled = false;
            btn.innerHTML = 'Post Note';
        }
    });

    window.openClassModal = function(ctx) {
        window.currentSubjectContext = ctx;
        
        document.getElementById('modal-subject-name').textContent = ctx.subjectName || ctx.subjectCode;
        
        const dDate = new Date(ctx.date);
        const dateStr = dDate.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        document.getElementById('modal-subject-date').textContent = dateStr;
        
        const linkContainer = document.getElementById('modal-link-container');
        const linkElem = document.getElementById('modal-subject-link');
        
        if (ctx.link) {
            linkContainer.classList.remove('hidden');
            linkElem.href = ctx.link;
        } else {
            linkContainer.classList.add('hidden');
        }

        const addSection = document.getElementById('add-note-section');
        const btnSubmit = document.getElementById('btn-submit-note');
        const btnLogin = document.getElementById('btn-login-note');
        
        addSection.classList.remove('hidden');
        if (window.currentUserPermission >= 1) {
            btnSubmit.classList.remove('hidden');
            btnLogin.classList.add('hidden');
            document.getElementById('new-note-content').classList.remove('hidden');
        } else {
            btnSubmit.classList.add('hidden');
            btnLogin.classList.remove('hidden');
            document.getElementById('new-note-content').classList.add('hidden');
        }

        loadNotes(ctx.subjectCode, ctx.date);
        
        const modal = document.getElementById('class-modal');
        const content = document.getElementById('class-modal-content');
        modal.classList.remove('hidden');
        
        void modal.offsetWidth;
        
        content.classList.remove('scale-95', 'opacity-0');
        content.classList.add('scale-100', 'opacity-100');
    };
</script>
`
