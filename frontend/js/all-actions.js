/**
 * All Actions - Delete and action handlers for Projects, Notes, CRM, Learning
 * Depends on: projectService, noteService, contactService, learningService,
 *             loadProjects, loadNotes, loadContacts, loadCourses (global)
 */

// ============= PROJECT ACTIONS =============

/**
 * Delete project with confirmation
 * @param {string} projectId - Project ID
 */
async function deleteProject(projectId) {
    if (!projectId) return;
    if (!confirm('Hapus project ini? Semua data terkait akan hilang.')) return;

    try {
        await window.projectService.deleteProject(projectId);
        if (typeof loadProjects === 'function') await loadProjects();
        if (typeof showToast === 'function') showToast('🗑️ Project dihapus.');
    } catch (err) {
        console.error('Error deleting project:', err);
        alert('Gagal menghapus project.');
    }
}

/**
 * Set current project filter (for Kanban, Notes, CRM filtering)
 * @param {string} projectId - Project ID
 */
function setCurrentProject(projectId) {
    window.currentProjectId = projectId;
    console.log('📁 Current project set to:', projectId);

    // Filter tasks in Kanban if available
    if (typeof loadTasks === 'function') {
        loadTasks();
    }

    // Show toast notification
    const project = window.allProjects?.find(p => p.id === projectId);
    if (project && typeof showToast === 'function') {
        showToast(`📁 Filter: ${project.title}`);
    }
}

/**
 * Clear project filter
 */
function clearProjectFilter() {
    window.currentProjectId = null;
    console.log('📁 Project filter cleared');
    if (typeof loadTasks === 'function') loadTasks();
    if (typeof showToast === 'function') showToast('📁 Filter dihapus - tampilkan semua');
}

// ============= NOTE ACTIONS =============

/**
 * Delete note with confirmation
 * @param {string} noteId - Note ID
 */
async function deleteNote(noteId) {
    if (!noteId) return;
    if (!confirm('Hapus catatan ini?')) return;

    try {
        await window.noteService.deleteNote(noteId);
        if (typeof loadNotes === 'function') await loadNotes();
        if (typeof showToast === 'function') showToast('🗑️ Catatan dihapus.');
    } catch (err) {
        console.error('Error deleting note:', err);
        alert('Gagal menghapus catatan.');
    }
}

/**
 * Toggle note favorite
 * @param {string} noteId - Note ID
 */
async function toggleNoteFavorite(noteId) {
    if (!noteId) return;

    try {
        const note = window.allNotes?.find(n => n.id === noteId);
        if (!note) return;

        const isFavorite = !note.is_favorite;
        await window.noteService.updateNote(noteId, { is_favorite: isFavorite });
        if (typeof loadNotes === 'function') await loadNotes();
        if (typeof showToast === 'function') {
            showToast(isFavorite ? '⭐ Ditambahkan ke favorit' : 'Dihapus dari favorit');
        }
    } catch (err) {
        console.error('Error toggling favorite:', err);
        alert('Gagal mengubah status favorit.');
    }
}

// ============= CRM/CONTACT ACTIONS =============

/**
 * Delete contact with confirmation
 * @param {string} contactId - Contact ID
 */
async function deleteContact(contactId) {
    if (!contactId) return;
    if (!confirm('Hapus kontak ini?')) return;

    try {
        await window.contactService.deleteContact(contactId);
        if (typeof loadContacts === 'function') await loadContacts();
        if (typeof showToast === 'function') showToast('🗑️ Kontak dihapus.');
    } catch (err) {
        console.error('Error deleting contact:', err);
        alert('Gagal menghapus kontak.');
    }
}

/**
 * Update last contact date to today
 * @param {string} contactId - Contact ID
 */
async function updateLastContact(contactId) {
    if (!contactId) return;

    try {
        await window.contactService.updateContact(contactId, {
            last_contact_date: new Date().toISOString()
        });
        if (typeof loadContacts === 'function') await loadContacts();
        if (typeof showToast === 'function') showToast('📅 Tanggal kontak diperbarui');
    } catch (err) {
        console.error('Error updating contact:', err);
        alert('Gagal memperbarui tanggal kontak.');
    }
}

// ============= LEARNING/COURSE ACTIONS =============

/**
 * Delete course with confirmation
 * @param {string} courseId - Course ID
 */
async function deleteCourse(courseId) {
    if (!courseId) return;
    if (!confirm('Hapus kursus ini dari daftar?')) return;

    try {
        await window.learningService.deleteCourse(courseId);
        if (typeof loadCourses === 'function') await loadCourses();
        if (typeof showToast === 'function') showToast('🗑️ Kursus dihapus.');
    } catch (err) {
        console.error('Error deleting course:', err);
        alert('Gagal menghapus kursus.');
    }
}

/**
 * Update course progress
 * @param {string} courseId - Course ID
 * @param {number} newProgress - New progress percentage (0-100)
 */
async function updateCourseProgress(courseId, newProgress) {
    if (!courseId) return;

    // Ensure progress is between 0 and 100
    const progress = Math.max(0, Math.min(100, newProgress));

    try {
        await window.learningService.updateCourse(courseId, { progress });
        if (typeof loadCourses === 'function') await loadCourses();
        if (typeof showToast === 'function') {
            showToast(`📚 Progress diperbarui: ${progress}%`);
        }
    } catch (err) {
        console.error('Error updating course progress:', err);
        alert('Gagal memperbarui progress.');
    }
}

/**
 * Mark course as completed
 * @param {string} courseId - Course ID
 */
async function completeCourse(courseId) {
    if (!courseId) return;

    try {
        await window.learningService.updateCourse(courseId, {
            progress: 100,
            status: 'completed'
        });
        if (typeof loadCourses === 'function') await loadCourses();
        if (typeof showToast === 'function') showToast('🎉 Kursus selesai! Selamat!');
    } catch (err) {
        console.error('Error completing course:', err);
        alert('Gagal menyelesaikan kursus.');
    }
}

// ============= MORNING BRIEFING ACTIONS =============

/**
 * Save morning briefing to database
 * @param {object} briefingData - Briefing data { clarity, priority, blockers }
 */
async function saveMorningBriefing(briefingData) {
    if (!window.currentUser) return;

    try {
        const briefing = {
            user_id: window.currentUser.id,
            clarity_level: briefingData.clarity || 3,
            priority_task: briefingData.priority || '',
            blockers: briefingData.blockers || [],
            created_at: new Date().toISOString()
        };

        const { data, error } = await window.supabaseClient
            .from('morning_briefings')
            .insert([briefing])
            .select()
            .single();

        if (error) throw error;

        console.log('✅ Morning briefing saved:', data);

        // Store in localStorage to prevent showing again today
        localStorage.setItem('briefingDate', new Date().toDateString());

        return data;
    } catch (err) {
        console.error('Error saving morning briefing:', err);
        // Don't alert - briefing is optional
    }
}

/**
 * Get today's briefing
 */
async function getTodaysBriefing() {
    if (!window.currentUser) return null;

    try {
        const today = new Date().toISOString().split('T')[0];

        const { data, error } = await window.supabaseClient
            .from('morning_briefings')
            .select('*')
            .eq('user_id', window.currentUser.id)
            .gte('created_at', today)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows

        return data;
    } catch (err) {
        console.error('Error getting briefing:', err);
        return null;
    }
}

// ============= AGENT ACTIVITY LOGGING =============

/**
 * Log agent activity (for AI Agent tracking)
 * @param {string} agentName - Agent name
 * @param {string} action - Action performed
 * @param {string} domain - Domain (work/learn/business/personal)
 * @param {string} details - Additional details
 */
async function logAgentActivity(agentName, action, domain, details) {
    if (!window.currentUser) return;

    try {
        const activity = {
            user_id: window.currentUser.id,
            agent_name: agentName,
            action: action,
            domain: domain || null,
            details: details || null,
            created_at: new Date().toISOString()
        };

        const { data, error } = await window.supabaseClient
            .from('agent_activities')
            .insert([activity])
            .select()
            .single();

        if (error) throw error;

        console.log('✅ Agent activity logged:', data);

        // Optionally refresh agent activities view
        if (typeof loadAgentActivities === 'function') {
            loadAgentActivities();
        }

        return data;
    } catch (err) {
        console.error('Error logging agent activity:', err);
    }
}

/**
 * Get recent agent activities
 * @param {number} limit - Number of activities to fetch
 */
async function getAgentActivities(limit = 20) {
    if (!window.currentUser) return [];

    try {
        const { data, error } = await window.supabaseClient
            .from('agent_activities')
            .select('*')
            .eq('user_id', window.currentUser.id)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;

        console.log(`✅ Loaded ${data?.length || 0} agent activities`);
        return data || [];
    } catch (err) {
        console.error('Error loading agent activities:', err);
        return [];
    }
}
