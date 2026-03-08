/**
 * CRM Renderer - Renders contacts into #crm-contacts-list
 * Depends on: contactService, loadContacts (global)
 */

/**
 * Render contacts in the UI
 * @param {Array} contacts - Array of contact objects from database
 */
function renderContacts(contacts) {
    const container = document.getElementById('crm-contacts-list');
    if (!container) return;

    if (!contacts || contacts.length === 0) {
        container.innerHTML = getContactsEmptyStateHTML();
        return;
    }

    container.innerHTML = contacts.map(contact => getContactHTML(contact)).join('');
}

/**
 * Get initials from name
 */
function getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

/**
 * Domain → Avatar background classes
 */
const CONTACT_DOMAIN_CLASSES = {
    work: 'bg-work/20 text-work',
    learn: 'bg-learn/20 text-learn',
    business: 'bg-business/20 text-business',
    personal: 'bg-personal/20 text-personal'
};

function getContactDomainClass(domain) {
    return CONTACT_DOMAIN_CLASSES[domain] || CONTACT_DOMAIN_CLASSES.business;
}

function escapeHtml(str) {
    if (str == null) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function formatContactDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Generate HTML for a single contact
 * @param {object} contact - Contact object { id, name, email, company, role, status, last_contact_date, ... }
 * @returns {string} HTML string
 */
function getContactHTML(contact) {
    const domainClass = getContactDomainClass(contact.domain || 'business');
    const nameSafe = escapeHtml(contact.name || 'Unknown');
    const initials = getInitials(contact.name);
    const company = contact.company || '';
    const role = contact.role || '';
    const lastContact = contact.last_contact_date ? formatContactDate(contact.last_contact_date) : 'Belum ada kontak';

    return `
        <div class="flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 transition-all cursor-pointer group" data-contact-id="${escapeHtml(contact.id)}">
            <div class="w-10 h-10 rounded-full ${domainClass} flex items-center justify-center font-semibold flex-shrink-0">
                ${initials}
            </div>
            <div class="flex-1 min-w-0">
                <div class="font-medium text-white truncate">${nameSafe}</div>
                <div class="text-xs text-gray-400 truncate">
                    ${company && role ? `${escapeHtml(role)} at ${escapeHtml(company)}` : company || role || escapeHtml(contact.email || '')}
                </div>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
                <div class="text-xs text-gray-500 hidden md:block">${lastContact}</div>
                <button type="button" onclick="event.stopPropagation(); deleteContact('${escapeHtml(contact.id)}')"
                        class="p-2 rounded-lg text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100" title="Hapus kontak">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            </div>
        </div>
    `;
}

/**
 * Generate HTML for empty state
 * @returns {string} HTML string
 */
function getContactsEmptyStateHTML() {
    return `
        <div class="glass rounded-xl p-12 text-center border border-white/5">
            <div class="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white/5 mb-6">
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-gray-400">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
            </div>
            <h3 class="text-xl font-semibold text-white mb-2">Belum ada kontak</h3>
            <p class="text-gray-400 mb-6 max-w-sm mx-auto">Tambahkan kontak bisnis, klien, atau networking Anda.</p>
            <button type="button" onclick="typeof showCreateContactModal === 'function' && showCreateContactModal()"
                    class="px-6 py-3 rounded-xl bg-business hover:bg-business-dark transition-colors font-medium inline-flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                Tambah Kontak Pertama
            </button>
        </div>
    `;
}
