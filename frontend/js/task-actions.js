/**
 * Task Actions - Toggle complete & delete for tasks
 * Used by task-renderer.js (Kanban + list). Depends: window.taskService, loadTasks, refreshFocusView, showToast
 */

async function toggleTaskComplete(taskId, clickedElement) {
    if (!taskId || !window.taskService) return;
    var card = clickedElement ? (clickedElement.closest && clickedElement.closest('[data-task-id]')) : (document.querySelector('[data-task-id="' + taskId + '"]'));
    var wasCompleted = card && card.classList && card.classList.contains('task-completed');
    if (card && !wasCompleted) {
        card.classList.add('task-completing');
        var btn = card.querySelector('[data-action="toggle-complete"]') || card.querySelector('button');
        var titleEl = card.querySelector('h4');
        if (btn) {
            btn.classList.add('bg-green-500/20', 'border-green-400', 'text-green-400');
            btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>';
        }
        if (titleEl) titleEl.classList.add('line-through', 'text-gray-400');
    }
    try {
        await window.taskService.toggleComplete(taskId);
        if (card && !wasCompleted) {
            card.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
            card.style.opacity = '0';
            card.style.transform = 'scale(0.96) translateX(8px)';
            setTimeout(function () {
                if (typeof loadTasks === 'function') loadTasks();
                if (typeof refreshFocusView === 'function') refreshFocusView();
                if (typeof refreshLearningView === 'function') refreshLearningView();
                if (typeof showToast === 'function') showToast('Tugas selesai.');
            }, 320);
        } else {
            if (typeof loadTasks === 'function') await loadTasks();
            if (typeof refreshFocusView === 'function') refreshFocusView();
            if (typeof refreshLearningView === 'function') refreshLearningView();
            if (typeof showToast === 'function') showToast('Tugas diperbarui.');
        }
    } catch (err) {
        console.error('Error toggling task:', err);
        if (card && !wasCompleted) {
            card.classList.remove('task-completing');
            var btn = card.querySelector('[data-action="toggle-complete"]') || card.querySelector('button');
            var titleEl = card.querySelector('h4');
            if (btn) { btn.classList.remove('bg-green-500/20', 'border-green-400', 'text-green-400'); btn.innerHTML = ''; }
            if (titleEl) titleEl.classList.remove('line-through', 'text-gray-400');
        }
        if (typeof showToast === 'function') showToast('Gagal memperbarui tugas.');
    }
}

async function deleteTask(taskId) {
    if (!taskId || !window.taskService) return;
    if (!confirm('Hapus tugas ini?')) return;
    try {
        await window.taskService.deleteTask(taskId);
        if (typeof loadTasks === 'function') await loadTasks();
        if (typeof refreshFocusView === 'function') refreshFocusView();
        if (typeof refreshLearningView === 'function') refreshLearningView();
        if (typeof showToast === 'function') showToast('Tugas dihapus.');
    } catch (err) {
        console.error('Error deleting task:', err);
        if (typeof showToast === 'function') showToast('Gagal menghapus tugas.');
    }
}
