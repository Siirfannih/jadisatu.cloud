/**
 * Task Form - Modal Create Task & submit handler
 * Depends on: taskService, currentUser, loadTasks, loadStats (global). Optional: allProjects, currentProjectId, showToast
 */

function showCreateTaskModal() {
    var idEl = document.getElementById('task-edit-id');
    if (idEl) idEl.value = '';
    var titleEl = document.getElementById('create-task-modal-title');
    if (titleEl) titleEl.textContent = 'Buat Tugas';
    var btn = document.getElementById('create-task-submit-btn');
    if (btn) btn.textContent = 'Buat Tugas';
    var modal = document.getElementById('create-task-modal');
    if (modal) modal.classList.remove('hidden');
    fillTaskProjectSelect();
}

function showEditTaskModal(taskId) {
    var task = (window.allTasks || []).find(function (t) { return t.id === taskId; });
    if (!task) {
        if (typeof window.showToast === 'function') window.showToast('Tugas tidak ditemukan.');
        return;
    }
    var idEl = document.getElementById('task-edit-id');
    if (idEl) idEl.value = taskId;
    var titleEl = document.getElementById('create-task-modal-title');
    if (titleEl) titleEl.textContent = 'Edit Tugas';
    var btn = document.getElementById('create-task-submit-btn');
    if (btn) btn.textContent = 'Simpan';
    var form = document.getElementById('create-task-form');
    if (form) {
        (form.querySelector('[name="title"]') || document.getElementById('task-title')).value = task.title || '';
        (form.querySelector('[name="description"]') || document.getElementById('task-description')).value = task.description || '';
        (form.querySelector('[name="domain"]') || document.getElementById('task-domain')).value = task.domain || 'work';
        (form.querySelector('[name="priority"]') || document.getElementById('task-priority')).value = task.priority || 'medium';
        var dueEl = form.querySelector('[name="due_date"]') || document.getElementById('task-due_date');
        if (dueEl && task.due_date) dueEl.value = task.due_date.split('T')[0]; else if (dueEl) dueEl.value = '';
        var projEl = form.querySelector('[name="project_id"]') || document.getElementById('task-project_id');
        if (projEl) projEl.value = task.project_id || '';
    }
    fillTaskProjectSelect();
    var modal = document.getElementById('create-task-modal');
    if (modal) modal.classList.remove('hidden');
}

function fillTaskProjectSelect() {
    var projectSelect = document.getElementById('task-project_id');
    if (projectSelect && typeof window.allProjects !== 'undefined' && Array.isArray(window.allProjects)) {
        projectSelect.innerHTML = '<option value="">Semua / Tanpa project</option>';
        window.allProjects.forEach(function (p) {
            var opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = p.title || p.id;
            if (window.currentProjectId && p.id === window.currentProjectId) opt.selected = true;
            projectSelect.appendChild(opt);
        });
    }
}

function hideCreateTaskModal() {
    var modal = document.getElementById('create-task-modal');
    if (modal) modal.classList.add('hidden');
    var form = document.getElementById('create-task-form');
    if (form) form.reset();
    var idEl = document.getElementById('task-edit-id');
    if (idEl) idEl.value = '';
    var titleEl = document.getElementById('create-task-modal-title');
    if (titleEl) titleEl.textContent = 'Buat Tugas';
    var btn = document.getElementById('create-task-submit-btn');
    if (btn) btn.textContent = 'Buat Tugas';
}

function handleCreateTask(event) {
    event.preventDefault();
    var form = event.target;
    var title = (form.querySelector('[name="title"]') || document.getElementById('task-title')).value.trim();
    var description = (form.querySelector('[name="description"]') || document.getElementById('task-description')).value.trim();
    var domain = (form.querySelector('[name="domain"]') || document.getElementById('task-domain')).value || 'personal';
    var priority = (form.querySelector('[name="priority"]') || document.getElementById('task-priority')).value || 'medium';
    var due_dateEl = form.querySelector('[name="due_date"]') || document.getElementById('task-due_date');
    var due_date = due_dateEl && due_dateEl.value ? due_dateEl.value : null;
    var project_idEl = form.querySelector('[name="project_id"]') || document.getElementById('task-project_id');
    var project_id = project_idEl && project_idEl.value ? project_idEl.value : null;

    if (!title) {
        alert('Judul tugas wajib diisi.');
        return;
    }
    if (!window.currentUser || !window.currentUser.id) {
        alert('Sesi habis. Silakan login lagi.');
        return;
    }

    var taskIdEl = form.querySelector('[name="task_id"]') || document.getElementById('task-edit-id');
    var taskId = taskIdEl && taskIdEl.value ? taskIdEl.value.trim() : null;
    var taskData = { title: title, description: description || null, domain: domain, priority: priority, due_date: due_date, project_id: project_id || null };

    if (taskId) {
        window.taskService.updateTask(taskId, taskData)
            .then(function () {
                hideCreateTaskModal();
                if (typeof loadTasks === 'function') return loadTasks();
            })
            .then(function () {
                if (typeof loadStats === 'function') loadStats();
                if (typeof refreshFocusView === 'function') refreshFocusView();
                if (typeof refreshLearningView === 'function') refreshLearningView();
            })
            .then(function () {
                if (typeof window.showToast === 'function') window.showToast('Tugas berhasil disimpan.');
            })
            .catch(function (err) {
                console.error('Error updating task:', err);
                alert('Gagal menyimpan tugas: ' + (err.message || 'Coba lagi.'));
            });
    } else {
        window.taskService.createTask(window.currentUser.id, taskData)
            .then(function () {
                hideCreateTaskModal();
                if (typeof loadTasks === 'function') return loadTasks();
            })
            .then(function () {
                if (typeof loadStats === 'function') return loadStats();
            })
            .then(function () {
                if (typeof window.showToast === 'function') window.showToast('Tugas berhasil dibuat.');
            })
            .catch(function (err) {
                console.error('Error creating task:', err);
                alert('Gagal membuat tugas: ' + (err.message || 'Coba lagi.'));
            });
    }
}

(function () {
    var form = document.getElementById('create-task-form');
    if (form) form.addEventListener('submit', handleCreateTask);
})();
