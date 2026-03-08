/**
 * Task Renderer - Renders task list into #tasks-container or Kanban columns
 * Depends on: taskService, loadTasks (global). Used by dashboard-mvp.html and dashboard.html
 * DB status: backlog, todo, in_progress, review, done (treat 'done' and legacy 'completed' as completed)
 */
function isTaskCompleted(task) {
    const s = (task && task.status || '').toLowerCase();
    return s === 'completed' || s === 'done';
}

function renderTasks(tasks) {
    const container = document.getElementById('tasks-container');
    if (!container) return;
    if (!tasks || tasks.length === 0) {
        container.innerHTML = getEmptyStateHTML();
        return;
    }
    container.innerHTML = tasks.map(task => getTaskHTML(task)).join('');
}

/**
 * Render tasks specifically for domain dashboard containers
 * Target containers: #{domain}-active-tasks
 */
function renderDomainTasks(domain, tasks) {
    const container = document.getElementById(`${domain}-active-tasks`);
    if (!container) return;

    // Sort tasks to show active ones, limited to 5
    const activeTasks = tasks.filter(t => !isTaskCompleted(t)).slice(0, 5);

    if (activeTasks.length === 0) {
        container.innerHTML = `<p class="text-sm text-gray-500">Tidak ada task aktif</p>`;
        return;
    }

    container.innerHTML = activeTasks.map(task => {
        const priorityClass = getPriorityClass(task.priority || 'medium');
        const dueStr = formatDueDate(task.due_date);
        const titleSafe = escapeHtml(task.title || '');
        const projSafe = escapeHtml(task.project_id ? (task.project_title || 'Project') : '');

        return `
            <div class="p-3.5 rounded-xl bg-white/5 border border-white/5 hover:border-${domain}/40 transition-all flex items-start gap-4 border-l-[4px] border-l-${domain}">
                <button type="button" data-action="toggle-complete" onclick="toggleTaskComplete('${escapeHtml(task.id)}', this)"
                    class="mt-0.5 w-5 h-5 rounded border-2 border-gray-600 hover:border-${domain} hover:bg-${domain}/20 transition-colors flex-shrink-0"></button>
                <div class="flex-1 min-w-0">
                    <div class="text-sm font-medium text-white">${titleSafe}</div>
                    <div class="text-xs text-gray-500 mt-1 flex items-center gap-3">
                        ${dueStr ? `<span class="flex items-center gap-1 text-red-400 font-medium"><i data-lucide="clock" class="w-3 h-3"></i> ${escapeHtml(dueStr)}</span><span>•</span>` : ''}
                        ${projSafe ? `<span class="bg-white/10 px-2 py-0.5 rounded text-[10px]">Proj: ${projSafe}</span>` : ''}
                    </div>
                </div>
                <span class="px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wide ${priorityClass}">${escapeHtml((task.priority || 'medium').toUpperCase())}</span>
            </div>
        `;
    }).join('');

    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
    }
}

const DOMAIN_CLASSES = {
    work: 'bg-work/20 text-work border-work/30',
    learn: 'bg-learn/20 text-learn border-learn/30',
    business: 'bg-business/20 text-business border-business/30',
    personal: 'bg-personal/20 text-personal border-personal/30'
};
const PRIORITY_CLASSES = {
    high: 'bg-red-500/10 text-red-400 border-red-500/20',
    medium: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    low: 'bg-green-500/10 text-green-400 border-green-500/20'
};
function getDomainClass(domain) { return DOMAIN_CLASSES[domain] || DOMAIN_CLASSES.personal; }
function getPriorityClass(priority) { return PRIORITY_CLASSES[priority] || PRIORITY_CLASSES.medium; }
function escapeHtml(str) {
    if (str == null) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
function formatDueDate(dueDate) {
    if (!dueDate) return '';
    const d = new Date(dueDate);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return 'Hari ini';
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getTaskHTML(task) {
    const isCompleted = isTaskCompleted(task);
    const domainClass = getDomainClass(task.domain || 'personal');
    const priorityClass = getPriorityClass(task.priority || 'medium');
    const dueStr = formatDueDate(task.due_date);
    const titleSafe = escapeHtml(task.title || '');
    const descSafe = escapeHtml((task.description || '').slice(0, 120));
    const descSuffix = (task.description || '').length > 120 ? '...' : '';
    return `
        <div class="glass rounded-xl border border-white/5 p-4 hover:bg-white/5 transition-colors flex items-start gap-4 ${isCompleted ? 'opacity-75' : ''}" data-task-id="${escapeHtml(task.id)}">
            <button type="button" data-action="toggle-complete" onclick="toggleTaskComplete('${escapeHtml(task.id)}', this)"
                    class="flex-shrink-0 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${isCompleted ? 'bg-green-500/20 border-green-400 text-green-400' : 'border-gray-500 hover:border-blue-400 text-transparent'}">
                ${isCompleted ? '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
            </button>
            <div class="flex-1 min-w-0">
                <h4 class="font-medium ${isCompleted ? 'line-through text-gray-400' : 'text-white'} cursor-pointer hover:text-blue-300 transition-colors" onclick="typeof showEditTaskModal === 'function' && showEditTaskModal('${escapeHtml(task.id)}')" title="Lihat / Edit">${titleSafe}</h4>
                ${task.description ? `<p class="text-sm text-gray-400 mt-1">${descSafe}${descSuffix}</p>` : ''}
                <div class="flex flex-wrap items-center gap-2 mt-2">
                    <span class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${domainClass}">${escapeHtml((task.domain || 'personal').charAt(0).toUpperCase() + (task.domain || 'personal').slice(1))}</span>
                    <span class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${priorityClass}">${escapeHtml((task.priority || 'medium').charAt(0).toUpperCase() + (task.priority || 'medium').slice(1))}</span>
                    ${dueStr ? `<span class="text-xs text-gray-500">${escapeHtml(dueStr)}</span>` : ''}
                </div>
            </div>
            <button type="button" onclick="typeof showEditTaskModal === 'function' && showEditTaskModal('${escapeHtml(task.id)}')"
                    class="flex-shrink-0 p-2 rounded-lg text-gray-400 hover:bg-blue-500/10 hover:text-blue-400 transition-colors" title="Edit tugas">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </button>
            <button type="button" onclick="deleteTask('${escapeHtml(task.id)}')"
                    class="flex-shrink-0 p-2 rounded-lg text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition-colors" title="Hapus tugas">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
            </button>
        </div>
    `;
}

function getEmptyStateHTML() {
    return `
        <div class="glass rounded-xl border border-white/5 p-12 text-center">
            <div class="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white/5 mb-6">
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-gray-400"><path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
            </div>
            <h3 class="text-xl font-semibold text-white mb-2">Belum ada tugas</h3>
            <p class="text-gray-400 mb-6 max-w-sm mx-auto">Buat tugas pertama Anda untuk mengatur pekerjaan, belajar, atau bisnis.</p>
            <button type="button" onclick="typeof showCreateTaskModal === 'function' && showCreateTaskModal()"
                    class="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 transition-colors font-medium inline-flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                Buat Tugas Pertama
            </button>
        </div>
    `;
}

/** Kanban: map task to column. status/stage if valid column, else done/todo/backlog */
var KANBAN_COLUMNS = ['backlog', 'todo', 'in_progress', 'review', 'done'];
function getTaskKanbanColumn(task) {
    var s = (task.stage || task.status || '').toLowerCase();
    if (KANBAN_COLUMNS.indexOf(s) !== -1) return s;
    if (isTaskCompleted(task)) return 'done';
    if (task.due_date) return 'todo';
    return 'backlog';
}

/** Single card HTML for Kanban column */
function getKanbanCardHTML(task) {
    const domainClass = getDomainClass(task.domain || 'personal');
    const priorityClass = getPriorityClass(task.priority || 'medium');
    const dueStr = formatDueDate(task.due_date);
    const titleSafe = escapeHtml(task.title || '');
    const isDone = isTaskCompleted(task);
    return `
        <div class="p-4 rounded-xl bg-white/5 border border-white/5 hover:border-work/30 transition-all cursor-pointer group kanban-card" data-task-id="${escapeHtml(task.id)}">
            <div class="flex items-start justify-between mb-2">
                <span class="px-2 py-0.5 rounded ${domainClass} text-[10px]">${escapeHtml((task.domain || 'personal').charAt(0).toUpperCase() + (task.domain || 'personal').slice(1))}</span>
                <div class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                    <button type="button" onclick="event.stopPropagation(); typeof showEditTaskModal === 'function' && showEditTaskModal('${escapeHtml(task.id)}')" class="p-1 rounded text-gray-500 hover:text-blue-400 hover:bg-blue-500/10" title="Edit"><i data-lucide="pencil" class="w-4 h-4"></i></button>
                    <button type="button" onclick="event.stopPropagation(); deleteTask('${escapeHtml(task.id)}')" class="p-1 rounded text-gray-500 hover:text-red-400 hover:bg-red-500/10" title="Hapus"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                </div>
            </div>
            <h4 class="text-sm font-medium text-white mb-2 cursor-pointer hover:text-blue-300 ${isDone ? 'line-through' : ''}" onclick="event.stopPropagation(); typeof showEditTaskModal === 'function' && showEditTaskModal('${escapeHtml(task.id)}')" title="Lihat / Edit">${titleSafe}</h4>
            <div class="flex items-center justify-between text-xs text-gray-500">
                <span>${dueStr || 'No due date'}</span>
                <button type="button" data-action="toggle-complete" onclick="event.stopPropagation(); toggleTaskComplete('${escapeHtml(task.id)}', this)" class="text-success hover:underline">${isDone ? 'Undo' : 'Done'}</button>
            </div>
        </div>
    `;
}

/** Render tasks into Kanban columns. Columns: backlog, todo, in_progress, review, done */
function renderKanbanTasks(tasks) {
    const columns = ['backlog', 'todo', 'in_progress', 'review', 'done'];
    columns.forEach(colId => {
        const el = document.getElementById('kanban-col-' + colId);
        if (!el) return;
        const list = Array.isArray(tasks) ? tasks.filter(t => getTaskKanbanColumn(t) === colId) : [];
        el.innerHTML = list.map(getKanbanCardHTML).join('');
        const countEl = document.getElementById('kanban-count-' + colId);
        if (countEl) countEl.textContent = list.length;
    });
    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
}
