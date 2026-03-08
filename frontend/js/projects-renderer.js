/**
 * Projects Renderer - Renders projects into #projects-list-container
 * Depends on: projectService, loadProjects (global)
 */

/**
 * Render projects in the UI
 * @param {Array} projects - Array of project objects from database
 */
function renderProjects(projects) {
    const container = document.getElementById('projects-list-container');
    if (!container) return;

    if (!projects || projects.length === 0) {
        container.innerHTML = getProjectsEmptyStateHTML();
        return;
    }

    container.innerHTML = projects.map(project => getProjectHTML(project)).join('');
}

/**
 * Render domain-specific projects into the dashboard containers
 * Target containers: #{domain}-active-projects
 */
function renderDomainProjects(domain, projects) {
    const container = document.getElementById(`${domain}-active-projects`);
    if (!container) return;

    // Sort projects to show active ones, limited to 4
    const activeProjects = projects.filter(p => p.status !== 'completed').slice(0, 4);

    if (activeProjects.length === 0) {
        container.innerHTML = `<p class="text-sm text-gray-500 col-span-full">Tidak ada project aktif</p>`;
        return;
    }

    container.innerHTML = activeProjects.map(project => {
        const titleSafe = escapeHtml(project.title || '');
        const progress = project.progress || 0;
        const tasksCompleted = project.tasks_completed || 0;
        const tasksTotal = project.tasks_total || 0;
        const statusStr = escapeHtml((project.status || 'Active').toUpperCase());

        return `
            <div onclick="if(typeof setCurrentProject === 'function') setCurrentProject('${escapeHtml(project.id)}')" class="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-${domain}/40 transition-all group cursor-pointer hover-lift">
                <div class="flex justify-between items-start mb-4">
                    <h4 class="text-sm font-medium text-white group-hover:text-${domain}-light transition-colors">
                        ${titleSafe}</h4>
                    <span class="px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider bg-${domain}/20 text-${domain}-light">${statusStr}</span>
                </div>
                <div class="h-1.5 w-full bg-black/40 rounded-full overflow-hidden mb-2">
                    <div class="h-full bg-${domain} rounded-full" style="width: ${progress}%"></div>
                </div>
                <div class="flex justify-between text-[11px] text-gray-500 font-medium">
                    <span>${tasksCompleted}/${tasksTotal} Tasks Done</span>
                    <span class="text-white">${progress}%</span>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Domain → Tailwind classes
 */
const PROJECT_DOMAIN_CLASSES = {
    work: 'bg-work/10 border-work/30',
    learn: 'bg-learn/10 border-learn/30',
    business: 'bg-business/10 border-business/30',
    personal: 'bg-personal/10 border-personal/30'
};

function getProjectDomainClass(domain) {
    return PROJECT_DOMAIN_CLASSES[domain] || PROJECT_DOMAIN_CLASSES.work;
}

function escapeHtml(str) {
    if (str == null) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Generate HTML for a single project card
 * @param {object} project - Project object { id, title, description, domain, progress, status, ... }
 * @returns {string} HTML string
 */
function getProjectHTML(project) {
    const domainClass = getProjectDomainClass(project.domain || 'work');
    const titleSafe = escapeHtml(project.title || '');
    const descSafe = escapeHtml((project.description || '').slice(0, 100));
    const descSuffix = (project.description || '').length > 100 ? '...' : '';
    const progress = project.progress || 0;
    const tasksCompleted = project.tasks_completed || 0;
    const tasksTotal = project.tasks_total || 0;

    return `
        <div class="glass rounded-2xl p-5 hover-lift transition-all cursor-pointer border ${domainClass}" data-project-id="${escapeHtml(project.id)}" onclick="if (!event.target.closest('button') && typeof setCurrentProject === 'function') setCurrentProject('${escapeHtml(project.id)}')" title="Klik untuk filter Kanban, Notes, CRM by project ini">
            <div class="flex items-center justify-between mb-4">
                <div class="flex items-center gap-2">
                    <div class="w-10 h-10 rounded-xl ${domainClass} flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                        </svg>
                    </div>
                    <div>
                        <h3 class="font-semibold text-white">${titleSafe}</h3>
                        <p class="text-xs text-gray-400">${escapeHtml((project.domain || 'work').charAt(0).toUpperCase() + (project.domain || 'work').slice(1))}</p>
                    </div>
                </div>
                <button type="button" onclick="event.stopPropagation(); deleteProject('${escapeHtml(project.id)}')"
                        class="p-2 rounded-lg text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100" title="Hapus project">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            </div>
            ${project.description ? `<p class="text-sm text-gray-400 mb-4">${descSafe}${descSuffix}</p>` : ''}
            <div class="space-y-2">
                <div class="flex justify-between text-xs text-gray-400">
                    <span>Progress</span>
                    <span>${progress}%</span>
                </div>
                <div class="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div class="h-full bg-gradient-to-r from-work to-work-light transition-all" style="width: ${progress}%"></div>
                </div>
                ${tasksTotal > 0 ? `
                <div class="text-xs text-gray-500 mt-2">
                    ${tasksCompleted} / ${tasksTotal} tasks completed
                </div>
                ` : ''}
            </div>
        </div>
    `;
}

/**
 * Generate HTML for empty state
 * @returns {string} HTML string
 */
function getProjectsEmptyStateHTML() {
    return `
        <div class="glass rounded-2xl p-12 text-center col-span-full border border-white/5">
            <div class="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white/5 mb-6">
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-gray-400">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                </svg>
            </div>
            <h3 class="text-xl font-semibold text-white mb-2">Belum ada project</h3>
            <p class="text-gray-400 mb-6 max-w-sm mx-auto">Buat project pertama Anda untuk mengatur tim dan deliverables.</p>
            <button type="button" onclick="typeof showCreateProjectModal === 'function' && showCreateProjectModal()"
                    class="px-6 py-3 rounded-xl bg-work hover:bg-work-dark transition-colors font-medium inline-flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                Buat Project Pertama
            </button>
        </div>
    `;
}
