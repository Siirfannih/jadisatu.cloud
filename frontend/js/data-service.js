/**
 * TaskService - Supabase CRUD operations for tasks
 *
 * Usage:
 * const taskService = new TaskService(supabaseClient);
 * const tasks = await taskService.getTasks(userId);
 */

class TaskService {
    constructor(supabaseClient) {
        if (!supabaseClient) {
            throw new Error('Supabase client is required');
        }
        this.client = supabaseClient;
    }

    /**
     * Get all tasks for a user
     * @param {string} userId - User ID from Supabase auth
     * @param {object} filters - Optional filters { status, domain, priority }
     * @returns {Promise<Array>} Array of tasks
     */
    async getTasks(userId, filters = {}) {
        try {
            let query = this.client
                .from('tasks')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            // Apply filters
            if (filters.status) {
                query = query.eq('status', filters.status);
            }
            if (filters.domain) {
                query = query.eq('domain', filters.domain);
            }
            if (filters.priority) {
                query = query.eq('priority', filters.priority);
            }
            if (filters.project_id !== undefined && filters.project_id !== null && filters.project_id !== '') {
                query = query.eq('project_id', filters.project_id);
            }

            const { data, error } = await query;

            if (error) throw error;

            console.log(`✅ Loaded ${data?.length || 0} tasks`);
            return data || [];

        } catch (error) {
            console.error('❌ Error loading tasks:', error);
            throw error;
        }
    }

    /**
     * Create a new task
     * @param {string} userId - User ID
     * @param {object} taskData - Task data { title, description, domain, priority, due_date }
     * @returns {Promise<object>} Created task
     */
    async createTask(userId, taskData) {
        try {
            const newTask = {
                user_id: userId,
                title: taskData.title,
                description: taskData.description || null,
                domain: taskData.domain || 'personal',
                priority: taskData.priority || 'medium',
                status: taskData.status || 'todo',
                due_date: taskData.due_date || null,
                project_id: taskData.project_id || null,
                created_at: new Date().toISOString()
            };

            const { data, error } = await this.client
                .from('tasks')
                .insert([newTask])
                .select()
                .single();

            if (error) throw error;

            this._logActivity(data.user_id, 'task_created', 'task', data.id, data.title, data.domain || 'work', null);
            console.log('✅ Task created:', data.title);
            return data;

        } catch (error) {
            console.error('❌ Error creating task:', error);
            throw error;
        }
    }

    /**
     * Update a task
     * @param {string} taskId - Task ID
     * @param {object} updates - Fields to update
     * @returns {Promise<object>} Updated task
     */
    async updateTask(taskId, updates) {
        try {
            const { data, error } = await this.client
                .from('tasks')
                .update({
                    ...updates,
                    updated_at: new Date().toISOString()
                })
                .eq('id', taskId)
                .select()
                .single();

            if (error) throw error;

            var logAction = (updates.status === 'done') ? 'task_completed' : 'task_updated';
            this._logActivity(data.user_id, logAction, 'task', taskId, data.title, data.domain || 'work', null);
            console.log('✅ Task updated:', taskId);
            return data;

        } catch (error) {
            console.error('❌ Error updating task:', error);
            throw error;
        }
    }

    /**
     * Delete a task
     * @param {string} taskId - Task ID
     * @returns {Promise<boolean>} Success status
     */
    async deleteTask(taskId) {
        try {
            var taskRow = null;
            try {
                var r = await this.client.from('tasks').select('id, user_id, title, domain').eq('id', taskId).single();
                taskRow = r.data;
            } catch (_) { }
            const { error } = await this.client
                .from('tasks')
                .delete()
                .eq('id', taskId);

            if (error) throw error;

            if (taskRow) this._logActivity(taskRow.user_id, 'task_deleted', 'task', taskId, taskRow.title, taskRow.domain || 'work', null);
            console.log('✅ Task deleted:', taskId);
            return true;

        } catch (error) {
            console.error('❌ Error deleting task:', error);
            throw error;
        }
    }

    /**
     * Toggle task completion status
     * @param {string} taskId - Task ID
     * @returns {Promise<object>} Updated task
     */
    async toggleComplete(taskId) {
        try {
            // Get current task
            const { data: currentTask, error: fetchError } = await this.client
                .from('tasks')
                .select('status')
                .eq('id', taskId)
                .single();

            if (fetchError) throw fetchError;

            // Toggle status (DB constraint: backlog, todo, in_progress, review, done)
            const isDone = (currentTask.status || '').toLowerCase() === 'done' || (currentTask.status || '').toLowerCase() === 'completed';
            const newStatus = isDone ? 'todo' : 'done';
            const completed_at = newStatus === 'done' ? new Date().toISOString() : null;

            const { data, error } = await this.client
                .from('tasks')
                .update({
                    status: newStatus,
                    completed_at: completed_at,
                    updated_at: new Date().toISOString()
                })
                .eq('id', taskId)
                .select()
                .single();

            if (error) throw error;

            if (newStatus === 'done') this._logActivity(data.user_id, 'task_completed', 'task', taskId, data.title, data.domain || 'work', null);
            console.log(`✅ Task ${newStatus}:`, taskId);
            return data;

        } catch (error) {
            console.error('❌ Error toggling task:', error);
            throw error;
        }
    }

    /**
     * Get task statistics
     * @param {string} userId - User ID
     * @returns {Promise<object>} Stats { total, active, completed, completedToday }
     */
    async getStats(userId) {
        try {
            // Get total count
            const { count: total, error: totalError } = await this.client
                .from('tasks')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId);

            if (totalError) throw totalError;

            // Get active count (status not 'done' - valid: backlog, todo, in_progress, review)
            const { count: active, error: activeError } = await this.client
                .from('tasks')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId)
                .neq('status', 'done');

            if (activeError) throw activeError;

            // Get completed count (status = 'done')
            const { count: completed, error: completedError } = await this.client
                .from('tasks')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId)
                .eq('status', 'done');

            if (completedError) throw completedError;

            // Get completed today
            const today = new Date().toISOString().split('T')[0];
            const { count: completedToday, error: todayError } = await this.client
                .from('tasks')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId)
                .eq('status', 'done')
                .gte('completed_at', today);

            if (todayError) throw todayError;

            const stats = {
                total: total || 0,
                active: active || 0,
                completed: completed || 0,
                completedToday: completedToday || 0,
                completionRate: total > 0 ? Math.round((completed / total) * 100) : 0
            };

            console.log('✅ Stats loaded:', stats);
            return stats;

        } catch (error) {
            console.error('❌ Error loading stats:', error);
            throw error;
        }
    }

    _logActivity(userId, action, entityType, entityId, title, domain, details) {
        if (!userId) return;
        this.client.from('activity_log').insert([{
            user_id: userId,
            action: action,
            entity_type: entityType || 'task',
            entity_id: entityId || null,
            title: title || null,
            domain: domain || null,
            details: details || null,
            created_at: new Date().toISOString()
        }]).then(function () { }).catch(function (err) { console.warn('Activity log insert skipped:', err.message); });
    }
}

/**
 * ProjectService - Supabase CRUD operations for projects
 */
class ProjectService {
    constructor(supabaseClient) {
        if (!supabaseClient) throw new Error('Supabase client is required');
        this.client = supabaseClient;
    }

    async getProjects(userId) {
        try {
            const { data, error } = await this.client
                .from('projects')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            console.log(`✅ Loaded ${data?.length || 0} projects`);
            return data || [];
        } catch (error) {
            console.error('❌ Error loading projects:', error);
            throw error;
        }
    }

    async createProject(userId, projectData) {
        try {
            const newProject = {
                user_id: userId,
                title: projectData.title,
                description: projectData.description || null,
                domain: projectData.domain || 'work',
                status: 'active',
                progress: 0,
                created_at: new Date().toISOString()
            };

            const { data, error } = await this.client
                .from('projects')
                .insert([newProject])
                .select()
                .single();

            if (error) throw error;
            this._logActivity(data.user_id, 'project_created', 'project', data.id, data.title, data.domain || 'work', null);
            console.log('✅ Project created:', data.title);
            return data;
        } catch (error) {
            console.error('❌ Error creating project:', error);
            throw error;
        }
    }

    async updateProject(projectId, updates) {
        try {
            const { data, error } = await this.client
                .from('projects')
                .update({ ...updates, updated_at: new Date().toISOString() })
                .eq('id', projectId)
                .select()
                .single();

            if (error) throw error;
            this._logActivity(data.user_id, 'project_updated', 'project', projectId, data.title, data.domain || 'work', null);
            console.log('✅ Project updated:', projectId);
            return data;
        } catch (error) {
            console.error('❌ Error updating project:', error);
            throw error;
        }
    }

    async deleteProject(projectId) {
        try {
            var projectRow = null;
            try {
                var r = await this.client.from('projects').select('id, user_id, title, domain').eq('id', projectId).single();
                projectRow = r.data;
            } catch (_) { }
            const { error } = await this.client
                .from('projects')
                .delete()
                .eq('id', projectId);

            if (error) throw error;
            if (projectRow) this._logActivity(projectRow.user_id, 'project_deleted', 'project', projectId, projectRow.title, projectRow.domain || 'work', null);
            console.log('✅ Project deleted:', projectId);
            return true;
        } catch (error) {
            console.error('❌ Error deleting project:', error);
            throw error;
        }
    }

    _logActivity(userId, action, entityType, entityId, title, domain, details) {
        if (!userId) return;
        this.client.from('activity_log').insert([{
            user_id: userId,
            action: action,
            entity_type: entityType || 'project',
            entity_id: entityId || null,
            title: title || null,
            domain: domain || null,
            details: details || null,
            created_at: new Date().toISOString()
        }]).then(function () { }).catch(function (err) { console.warn('Activity log insert skipped:', err.message); });
    }
}

/**
 * NoteService - Supabase CRUD operations for notes
 */
class NoteService {
    constructor(supabaseClient) {
        if (!supabaseClient) throw new Error('Supabase client is required');
        this.client = supabaseClient;
    }

    async getNotes(userId, filters = {}) {
        try {
            let query = this.client
                .from('notes')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });
            if (filters.project_id !== undefined && filters.project_id !== null && filters.project_id !== '') {
                query = query.eq('project_id', filters.project_id);
            }
            const { data, error } = await query;

            if (error) throw error;
            console.log(`✅ Loaded ${data?.length || 0} notes`);
            return data || [];
        } catch (error) {
            console.error('❌ Error loading notes:', error);
            throw error;
        }
    }

    async createNote(userId, noteData) {
        try {
            const newNote = {
                user_id: userId,
                title: noteData.title,
                content: noteData.content || null,
                domain: noteData.domain || 'personal',
                tags: noteData.tags || [],
                project_id: noteData.project_id || null,
                created_at: new Date().toISOString()
            };

            const { data, error } = await this.client
                .from('notes')
                .insert([newNote])
                .select()
                .single();

            if (error) throw error;
            this._logActivity(data.user_id, 'note_created', 'note', data.id, data.title, data.domain || 'personal', null);
            console.log('✅ Note created:', data.title);
            return data;
        } catch (error) {
            console.error('❌ Error creating note:', error);
            throw error;
        }
    }

    async updateNote(noteId, updates) {
        try {
            const { data, error } = await this.client
                .from('notes')
                .update({ ...updates, updated_at: new Date().toISOString() })
                .eq('id', noteId)
                .select()
                .single();

            if (error) throw error;
            this._logActivity(data.user_id, 'note_updated', 'note', noteId, data.title, data.domain || 'personal', null);
            console.log('✅ Note updated:', noteId);
            return data;
        } catch (error) {
            console.error('❌ Error updating note:', error);
            throw error;
        }
    }

    async deleteNote(noteId) {
        try {
            var noteRow = null;
            try {
                var r = await this.client.from('notes').select('id, user_id, title, domain').eq('id', noteId).single();
                noteRow = r.data;
            } catch (_) { }
            const { error } = await this.client
                .from('notes')
                .delete()
                .eq('id', noteId);

            if (error) throw error;
            if (noteRow) this._logActivity(noteRow.user_id, 'note_deleted', 'note', noteId, noteRow.title, noteRow.domain || 'personal', null);
            console.log('✅ Note deleted:', noteId);
            return true;
        } catch (error) {
            console.error('❌ Error deleting note:', error);
            throw error;
        }
    }

    _logActivity(userId, action, entityType, entityId, title, domain, details) {
        if (!userId) return;
        this.client.from('activity_log').insert([{
            user_id: userId,
            action: action,
            entity_type: entityType || 'note',
            entity_id: entityId || null,
            title: title || null,
            domain: domain || null,
            details: details || null,
            created_at: new Date().toISOString()
        }]).then(function () { }).catch(function (err) { console.warn('Activity log insert skipped:', err.message); });
    }
}

/**
 * ContactService - Supabase CRUD operations for CRM contacts
 */
class ContactService {
    constructor(supabaseClient) {
        if (!supabaseClient) throw new Error('Supabase client is required');
        this.client = supabaseClient;
    }

    async getContacts(userId, filters = {}) {
        try {
            let query = this.client
                .from('contacts')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });
            if (filters.project_id !== undefined && filters.project_id !== null && filters.project_id !== '') {
                query = query.eq('project_id', filters.project_id);
            }
            const { data, error } = await query;

            if (error) throw error;
            console.log(`✅ Loaded ${data?.length || 0} contacts`);
            return data || [];
        } catch (error) {
            console.error('❌ Error loading contacts:', error);
            throw error;
        }
    }

    async createContact(userId, contactData) {
        try {
            const newContact = {
                user_id: userId,
                name: contactData.name,
                email: contactData.email || null,
                phone: contactData.phone || null,
                company: contactData.company || null,
                role: contactData.role || null,
                status: contactData.status || 'active',
                domain: contactData.domain || 'business',
                project_id: contactData.project_id || null,
                created_at: new Date().toISOString()
            };

            const { data, error } = await this.client
                .from('contacts')
                .insert([newContact])
                .select()
                .single();

            if (error) throw error;
            this._logActivity(data.user_id, 'contact_created', 'contact', data.id, data.name, data.domain || 'business', null);
            console.log('✅ Contact created:', data.name);
            return data;
        } catch (error) {
            console.error('❌ Error creating contact:', error);
            throw error;
        }
    }

    async updateContact(contactId, updates) {
        try {
            const { data, error } = await this.client
                .from('contacts')
                .update({ ...updates, updated_at: new Date().toISOString() })
                .eq('id', contactId)
                .select()
                .single();

            if (error) throw error;
            this._logActivity(data.user_id, 'contact_updated', 'contact', contactId, data.name, data.domain || 'business', null);
            console.log('✅ Contact updated:', contactId);
            return data;
        } catch (error) {
            console.error('❌ Error updating contact:', error);
            throw error;
        }
    }

    async deleteContact(contactId) {
        try {
            var contactRow = null;
            try {
                var r = await this.client.from('contacts').select('id, user_id, name, domain').eq('id', contactId).single();
                contactRow = r.data;
            } catch (_) { }
            const { error } = await this.client
                .from('contacts')
                .delete()
                .eq('id', contactId);

            if (error) throw error;
            if (contactRow) this._logActivity(contactRow.user_id, 'contact_deleted', 'contact', contactId, contactRow.name, contactRow.domain || 'business', null);
            console.log('✅ Contact deleted:', contactId);
            return true;
        } catch (error) {
            console.error('❌ Error deleting contact:', error);
            throw error;
        }
    }

    _logActivity(userId, action, entityType, entityId, title, domain, details) {
        if (!userId) return;
        this.client.from('activity_log').insert([{
            user_id: userId,
            action: action,
            entity_type: entityType || 'contact',
            entity_id: entityId || null,
            title: title || null,
            domain: domain || null,
            details: details || null,
            created_at: new Date().toISOString()
        }]).then(function () { }).catch(function (err) { console.warn('Activity log insert skipped:', err.message); });
    }
}

/**
 * LearningService - Supabase CRUD operations for learning courses
 */
class LearningService {
    constructor(supabaseClient) {
        if (!supabaseClient) throw new Error('Supabase client is required');
        this.client = supabaseClient;
    }

    async getCourses(userId) {
        try {
            const { data, error } = await this.client
                .from('learning_courses')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            console.log(`✅ Loaded ${data?.length || 0} courses`);
            return data || [];
        } catch (error) {
            console.error('❌ Error loading courses:', error);
            throw error;
        }
    }

    async createCourse(userId, courseData) {
        try {
            const newCourse = {
                user_id: userId,
                title: courseData.title,
                description: courseData.description || null,
                type: courseData.type || 'course',
                progress: courseData.progress || 0,
                current_chapter: courseData.current_chapter || null,
                total_chapters: courseData.total_chapters || null,
                domain: 'learn',
                status: 'active',
                created_at: new Date().toISOString()
            };

            const { data, error } = await this.client
                .from('learning_courses')
                .insert([newCourse])
                .select()
                .single();

            if (error) throw error;
            console.log('✅ Course created:', data.title);
            return data;
        } catch (error) {
            console.error('❌ Error creating course:', error);
            throw error;
        }
    }

    async updateCourse(courseId, updates) {
        try {
            const { data, error } = await this.client
                .from('learning_courses')
                .update({ ...updates, updated_at: new Date().toISOString() })
                .eq('id', courseId)
                .select()
                .single();

            if (error) throw error;
            console.log('✅ Course updated:', courseId);
            return data;
        } catch (error) {
            console.error('❌ Error updating course:', error);
            throw error;
        }
    }

    async deleteCourse(courseId) {
        try {
            const { error } = await this.client
                .from('learning_courses')
                .delete()
                .eq('id', courseId);

            if (error) throw error;
            console.log('✅ Course deleted:', courseId);
            return true;
        } catch (error) {
            console.error('❌ Error deleting course:', error);
            throw error;
        }
    }
}

/**
 * AgentActivityService - baca aktivitas agent dari agent_activities
 */
class AgentActivityService {
    constructor(supabaseClient) {
        if (!supabaseClient) throw new Error('Supabase client is required');
        this.client = supabaseClient;
    }
    async getActivities(userId, options = {}) {
        try {
            var query = this.client
                .from('agent_activities')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });
            if (options.limit) query = query.limit(options.limit);
            var res = await query;
            if (res.error) throw res.error;
            return res.data || [];
        } catch (e) {
            console.warn('Agent activities load failed:', e);
            return [];
        }
    }
}

/**
 * ActivityLogService - Log sistem & aktivitas (tugas: buat, edit, hapus, selesai)
 * Tabel: activity_log
 */
class ActivityLogService {
    constructor(supabaseClient) {
        if (!supabaseClient) throw new Error('Supabase client is required');
        this.client = supabaseClient;
    }
    async getActivities(userId, options = {}) {
        try {
            var query = this.client
                .from('activity_log')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });
            if (options.limit) query = query.limit(options.limit);
            var res = await query;
            if (res.error) throw res.error;
            return res.data || [];
        } catch (e) {
            console.warn('Activity log load failed:', e);
            return [];
        }
    }
}

/**
 * ConnectedAgentsService - Agent Control Center: connected_agents + agent_tokens
 */
class ConnectedAgentsService {
    constructor(supabaseClient) {
        if (!supabaseClient) throw new Error('Supabase client is required');
        this.client = supabaseClient;
    }
    async getConnectedAgents(userId) {
        try {
            var res = await this.client
                .from('connected_agents')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });
            if (res.error) throw res.error;
            return res.data || [];
        } catch (e) {
            console.warn('Connected agents load failed:', e);
            return [];
        }
    }
    /**
     * Hubungkan agent ke user. Jika agent dengan agent_key yang sama sudah ada (unique user_id, agent_key),
     * update scopes/channel dan gunakan row yang sama (untuk generate token baru = "reconnect").
     */
    async addConnectedAgent(userId, data) {
        try {
            var row = {
                user_id: userId,
                agent_key: data.agent_key,
                display_name: data.display_name,
                channel_type: data.channel_type || 'realtime',
                status: 'active',
                scopes: data.scopes || ['tasks:read', 'tasks:write', 'projects:read', 'notes:read', 'notes:write']
            };
            var res = await this.client
                .from('connected_agents')
                .upsert([row], { onConflict: 'user_id,agent_key', ignoreDuplicates: false })
                .select()
                .single();
            if (res.error) throw res.error;
            return res.data;
        } catch (e) {
            console.error('Add connected agent failed:', e);
            throw e;
        }
    }
    async updateConnectedAgent(id, updates) {
        try {
            var res = await this.client.from('connected_agents').update(updates).eq('id', id).select().single();
            if (res.error) throw res.error;
            return res.data;
        } catch (e) {
            console.error('Update connected agent failed:', e);
            throw e;
        }
    }
    async deleteConnectedAgent(id) {
        try {
            var res = await this.client.from('connected_agents').delete().eq('id', id);
            if (res.error) throw res.error;
            return true;
        } catch (e) {
            console.error('Delete connected agent failed:', e);
            throw e;
        }
    }
    async createAgentToken(userId, connectedAgentId, tokenHash, tokenPrefix) {
        try {
            var row = {
                user_id: userId,
                connected_agent_id: connectedAgentId,
                token_hash: tokenHash,
                token_prefix: tokenPrefix,
                expires_at: null
            };
            var res = await this.client.from('agent_tokens').insert([row]).select().single();
            if (res.error) throw res.error;
            return res.data;
        } catch (e) {
            console.error('Create agent token failed:', e);
            throw e;
        }
    }
    async getAgentTokens(userId) {
        try {
            var res = await this.client
                .from('agent_tokens')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });
            if (res.error) throw res.error;
            return res.data || [];
        } catch (e) {
            console.warn('Agent tokens load failed:', e);
            return [];
        }
    }
    async revokeAgentToken(id) {
        try {
            var res = await this.client.from('agent_tokens').delete().eq('id', id);
            if (res.error) throw res.error;
            return true;
        } catch (e) {
            console.error('Revoke agent token failed:', e);
            throw e;
        }
    }
}

/**
 * UserProfileService - Welcome user / onboarding (nama, goal 90 hari, what_distracts)
 * Tabel: user_profiles
 *
 * Helper static: UserProfileService.deriveDisplayName(profile, user)
 * Gunakan ini di semua halaman untuk konsistensi fallback:
 *   const name = UserProfileService.deriveDisplayName(profile, currentUser);
 */
class UserProfileService {
    constructor(supabaseClient) {
        if (!supabaseClient) throw new Error('Supabase client is required');
        this.client = supabaseClient;
    }

    /**
     * Derive display name dari profil atau email user.
     * Urutan prioritas: profile.display_name → email prefix → 'User'
     * @param {object|null} profile - hasil dari getProfile()
     * @param {object|null} user - user dari supabase.auth.getSession()
     * @returns {string}
     */
    static deriveDisplayName(profile, user) {
        if (profile && profile.display_name && profile.display_name.trim()) {
            return profile.display_name.trim();
        }
        if (user && user.email) {
            var emailName = user.email.split('@')[0] || '';
            if (emailName) {
                return emailName.charAt(0).toUpperCase() + emailName.slice(1).replace(/[0-9_.-]/g, ' ').trim();
            }
        }
        return 'User';
    }

    async getProfile(userId) {
        try {
            var res = await this.client.from('user_profiles').select('*').eq('user_id', userId).maybeSingle();
            if (res.error) {
                console.error('[UserProfileService] getProfile DB error for userId=' + userId + ':', res.error.message, res.error.code);
                throw res.error;
            }
            if (!res.data) {
                console.warn('[UserProfileService] No profile found for userId=' + userId + '. User may not have completed onboarding.');
            }
            return res.data || null;
        } catch (e) {
            console.warn('[UserProfileService] getProfile failed for userId=' + userId + ':', e && e.message ? e.message : e);
            return null;
        }
    }
    async saveProfile(userId, data) {
        try {
            var row = {
                user_id: userId,
                display_name: (data.display_name || '').trim() || 'User',
                goal_90_days: (data.goal_90_days || '').trim() || null,
                what_distracts: (data.what_distracts || '').trim() || null,
                completed_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            var res = await this.client.from('user_profiles').upsert(row, { onConflict: 'user_id' }).select().single();
            if (res.error) throw res.error;
            return res.data;
        } catch (e) {
            console.error('Save user profile failed:', e);
            throw e;
        }
    }
}

/**
 * UserSettingsService - Pengaturan user (API key, model AI, Google Calendar)
 * Tabel: user_settings
 */
class UserSettingsService {
    constructor(supabaseClient) {
        if (!supabaseClient) throw new Error('Supabase client is required');
        this.client = supabaseClient;
    }
    async getSettings(userId) {
        try {
            var res = await this.client.from('user_settings').select('*').eq('user_id', userId).maybeSingle();
            if (res.error) throw res.error;
            return res.data || null;
        } catch (e) {
            console.warn('User settings load failed:', e);
            return null;
        }
    }
    async saveSettings(userId, data) {
        try {
            var row = {
                user_id: userId,
                updated_at: new Date().toISOString()
            };
            if (data.default_ai_model !== undefined) row.default_ai_model = data.default_ai_model;
            if (data.ai_api_key_encrypted !== undefined) row.ai_api_key_encrypted = data.ai_api_key_encrypted;
            if (data.juru_display_name !== undefined) row.juru_display_name = (data.juru_display_name || 'Juru').trim();
            if (data.juru_use_free_api !== undefined) row.juru_use_free_api = !!data.juru_use_free_api;
            if (data.juru_free_api_base_url !== undefined) row.juru_free_api_base_url = (data.juru_free_api_base_url || '').trim() || null;
            if (data.juru_refresh_token_encrypted !== undefined) row.juru_refresh_token_encrypted = (data.juru_refresh_token_encrypted || '').trim() || null;
            if (data.google_calendar_connected !== undefined) row.google_calendar_connected = !!data.google_calendar_connected;
            if (data.google_calendar_tokens !== undefined) row.google_calendar_tokens = data.google_calendar_tokens;
            var res = await this.client.from('user_settings').upsert(row, { onConflict: 'user_id' }).select().single();
            if (res.error) throw res.error;
            return res.data;
        } catch (e) {
            console.error('Save user settings failed:', e);
            throw e;
        }
    }
}

/**
 * JuruService - Percakapan & pesan Juru (Jadisatu Asisten)
 * Tabel: juru_conversations, juru_messages
 */
class JuruService {
    constructor(supabaseClient) {
        if (!supabaseClient) throw new Error('Supabase client is required');
        this.client = supabaseClient;
    }
    async getConversations(userId) {
        try {
            var res = await this.client.from('juru_conversations').select('*').eq('user_id', userId).order('updated_at', { ascending: false });
            if (res.error) throw res.error;
            return res.data || [];
        } catch (e) {
            console.warn('Juru conversations load failed:', e);
            return [];
        }
    }
    async createConversation(userId, title) {
        try {
            var res = await this.client.from('juru_conversations').insert([{ user_id: userId, title: title || 'Percakapan baru' }]).select().single();
            if (res.error) throw res.error;
            return res.data;
        } catch (e) {
            console.error('Juru create conversation failed:', e);
            throw e;
        }
    }
    async getMessages(conversationId) {
        try {
            var res = await this.client.from('juru_messages').select('*').eq('conversation_id', conversationId).order('created_at', { ascending: true });
            if (res.error) throw res.error;
            return res.data || [];
        } catch (e) {
            console.warn('Juru messages load failed:', e);
            return [];
        }
    }
    async addMessage(conversationId, role, content) {
        try {
            var res = await this.client.from('juru_messages').insert([{ conversation_id: conversationId, role: role, content: content }]).select().single();
            if (res.error) throw res.error;
            await this.client.from('juru_conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId);
            return res.data;
        } catch (e) {
            console.error('Juru add message failed:', e);
            throw e;
        }
    }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TaskService, ProjectService, NoteService, ContactService, LearningService, AgentActivityService, ActivityLogService, ConnectedAgentsService, UserProfileService, UserSettingsService, JuruService };
}
