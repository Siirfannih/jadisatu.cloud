/**
 * App Actions - Delete (and optional create) for Projects, Notes, CRM, Learning
 * Depends on: projectService, noteService, contactService, learningService (global)
 * and loadProjects, loadNotes, loadContacts, loadCourses (global)
 */

async function deleteProject(projectId) {
    if (!projectId) return;
    if (!confirm('Hapus project ini?')) return;
    try {
        await projectService.deleteProject(projectId);
        if (typeof loadProjects === 'function') await loadProjects();
        if (typeof showToast === 'function') showToast('Project dihapus.');
    } catch (e) {
        console.error('Delete project error:', e);
        alert('Gagal menghapus project: ' + (e.message || ''));
    }
}

async function deleteNote(noteId) {
    if (!noteId) return;
    if (!confirm('Hapus catatan ini?')) return;
    try {
        await noteService.deleteNote(noteId);
        if (typeof loadNotes === 'function') await loadNotes();
        if (typeof showToast === 'function') showToast('Catatan dihapus.');
    } catch (e) {
        console.error('Delete note error:', e);
        alert('Gagal menghapus catatan: ' + (e.message || ''));
    }
}

async function deleteContact(contactId) {
    if (!contactId) return;
    if (!confirm('Hapus kontak ini?')) return;
    try {
        await contactService.deleteContact(contactId);
        if (typeof loadContacts === 'function') await loadContacts();
        if (typeof showToast === 'function') showToast('Kontak dihapus.');
    } catch (e) {
        console.error('Delete contact error:', e);
        alert('Gagal menghapus kontak: ' + (e.message || ''));
    }
}

async function deleteCourse(courseId) {
    if (!courseId) return;
    if (!confirm('Hapus kursus ini?')) return;
    try {
        await learningService.deleteCourse(courseId);
        if (typeof loadCourses === 'function') await loadCourses();
        if (typeof showToast === 'function') showToast('Kursus dihapus.');
    } catch (e) {
        console.error('Delete course error:', e);
        alert('Gagal menghapus kursus: ' + (e.message || ''));
    }
}
