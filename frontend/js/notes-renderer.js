/**
 * Notes Renderer - Renders notes into #notes-list-container
 * Depends on: noteService, loadNotes (global)
 */

/**
 * Render notes in the UI
 * @param {Array} notes - Array of note objects from database
 */
function renderNotes(notes) {
    const container = document.getElementById('notes-list-container');
    if (!container) return;

    if (!notes || notes.length === 0) {
        container.innerHTML = getNotesEmptyStateHTML();
        return;
    }

    container.innerHTML = notes.map(note => getNoteHTML(note)).join('');
}

/**
 * Domain → Border classes for notes
 */
const NOTE_DOMAIN_CLASSES = {
    work: 'border-work',
    learn: 'border-learn',
    business: 'border-business',
    personal: 'border-personal'
};

function getNoteDomainClass(domain) {
    return NOTE_DOMAIN_CLASSES[domain] || NOTE_DOMAIN_CLASSES.personal;
}

function escapeHtml(str) {
    if (str == null) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function formatNoteDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

/**
 * Generate HTML for a single note card
 * @param {object} note - Note object { id, title, content, domain, tags, created_at, ... }
 * @returns {string} HTML string
 */
function getNoteHTML(note) {
    const domainClass = getNoteDomainClass(note.domain || 'personal');
    const titleSafe = escapeHtml(note.title || 'Untitled');
    const contentSafe = escapeHtml((note.content || '').slice(0, 150));
    const contentSuffix = (note.content || '').length > 150 ? '...' : '';
    const dateStr = formatNoteDate(note.created_at);
    const tags = Array.isArray(note.tags) ? note.tags : [];

    return `
        <div class="glass rounded-xl p-5 hover-lift cursor-pointer group border-l-4 ${domainClass} transition-all" data-note-id="${escapeHtml(note.id)}">
            <div class="flex items-start justify-between mb-3">
                <h4 class="font-semibold text-white flex-1">${titleSafe}</h4>
                <button type="button" onclick="event.stopPropagation(); deleteNote('${escapeHtml(note.id)}')"
                        class="p-1.5 rounded-lg text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100" title="Hapus note">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            </div>
            ${note.content ? `<p class="text-sm text-gray-400 mb-3 line-clamp-3">${contentSafe}${contentSuffix}</p>` : ''}
            <div class="flex items-center justify-between text-xs">
                <div class="flex flex-wrap gap-1">
                    ${tags.slice(0, 3).map(tag => `<span class="px-2 py-0.5 rounded-md bg-white/5 text-gray-400">#${escapeHtml(tag)}</span>`).join('')}
                    ${tags.length > 3 ? `<span class="px-2 py-0.5 text-gray-500">+${tags.length - 3}</span>` : ''}
                </div>
                <span class="text-gray-500">${dateStr}</span>
            </div>
        </div>
    `;
}

/**
 * Generate HTML for empty state
 * @returns {string} HTML string
 */
function getNotesEmptyStateHTML() {
    return `
        <div class="glass rounded-xl p-12 text-center col-span-full border border-white/5">
            <div class="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white/5 mb-6">
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-gray-400">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="12" y1="18" x2="12" y2="12"></line>
                    <line x1="9" y1="15" x2="15" y2="15"></line>
                </svg>
            </div>
            <h3 class="text-xl font-semibold text-white mb-2">Belum ada catatan</h3>
            <p class="text-gray-400 mb-6 max-w-sm mx-auto">Tulis ide, refleksi, atau catatan penting Anda di sini.</p>
            <button type="button" onclick="typeof showCreateNoteModal === 'function' && showCreateNoteModal()"
                    class="px-6 py-3 rounded-xl bg-personal hover:bg-personal-dark transition-colors font-medium inline-flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                Buat Catatan Pertama
            </button>
        </div>
    `;
}
