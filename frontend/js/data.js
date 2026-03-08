// Data Service - Supabase CRUD Operations
const DataService = {

  // ===== LOAD ALL DASHBOARD DATA =====
  async loadDashboardData() {
    if (!currentUser) {
      console.error('[DATA] No user logged in');
      return null;
    }

    console.log('[DATA] Loading dashboard data for user:', currentUser.id);

    try {
      const [
        tasksRes,
        projectsRes,
        scheduleRes,
        domainsRes,
        contactsRes,
        notesRes,
        coursesRes,
        activitiesRes,
        briefingRes
      ] = await Promise.all([
        supabase.from('tasks').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false }),
        supabase.from('projects').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false }),
        supabase.from('schedule_blocks').select('*').eq('user_id', currentUser.id),
        supabase.from('domains').select('*').eq('user_id', currentUser.id),
        supabase.from('contacts').select('*').eq('user_id', currentUser.id).order('last_contact_date', { ascending: false }),
        supabase.from('notes').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false }).limit(50),
        supabase.from('learning_courses').select('*').eq('user_id', currentUser.id),
        supabase.from('agent_activities').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false }).limit(20),
        supabase.from('morning_briefings').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false }).limit(1)
      ]);

      const data = {
        tasks: tasksRes.data || [],
        projects: projectsRes.data || [],
        scheduleBlocks: scheduleRes.data || [],
        domains: domainsRes.data || [],
        contacts: contactsRes.data || [],
        notes: notesRes.data || [],
        learningCourses: coursesRes.data || [],
        agentActivities: activitiesRes.data || [],
        todaysBriefing: briefingRes.data?.[0] || null
      };

      console.log('[DATA] Dashboard data loaded:', {
        tasks: data.tasks.length,
        projects: data.projects.length,
        contacts: data.contacts.length,
        notes: data.notes.length
      });

      return data;

    } catch (error) {
      console.error('[DATA] Load error:', error);
      throw error;
    }
  },

  // ===== TASKS =====
  async getTasks(filters = {}) {
    const query = supabase.from('tasks').select('*').eq('user_id', currentUser.id);

    if (filters.domain) query.eq('domain', filters.domain);
    if (filters.status) query.eq('status', filters.status);
    if (filters.priority) query.eq('priority', filters.priority);

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async createTask(taskData) {
    const { data, error } = await supabase
      .from('tasks')
      .insert([{ ...taskData, user_id: currentUser.id }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateTask(id, updates) {
    const { data, error } = await supabase
      .from('tasks')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', currentUser.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteTask(id) {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id)
      .eq('user_id', currentUser.id);

    if (error) throw error;
  },

  async toggleTaskComplete(id, currentStatus) {
    const newStatus = currentStatus === 'done' ? 'todo' : 'done';
    const completedAt = newStatus === 'done' ? new Date().toISOString() : null;

    return await this.updateTask(id, {
      status: newStatus,
      completed_at: completedAt,
      progress: newStatus === 'done' ? 100 : 0
    });
  },

  // ===== PROJECTS =====
  async getProjects(filters = {}) {
    const query = supabase.from('projects').select('*').eq('user_id', currentUser.id);

    if (filters.domain) query.eq('domain', filters.domain);
    if (filters.status) query.eq('status', filters.status);

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async createProject(projectData) {
    const { data, error } = await supabase
      .from('projects')
      .insert([{ ...projectData, user_id: currentUser.id }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateProject(id, updates) {
    const { data, error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', id)
      .eq('user_id', currentUser.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteProject(id) {
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id)
      .eq('user_id', currentUser.id);

    if (error) throw error;
  },

  // ===== CONTACTS =====
  async getContacts(filters = {}) {
    const query = supabase.from('contacts').select('*').eq('user_id', currentUser.id);

    if (filters.status) query.eq('status', filters.status);
    if (filters.domain) query.eq('domain', filters.domain);

    const { data, error } = await query.order('last_contact_date', { ascending: false });
    if (error) throw error;
    return data;
  },

  async createContact(contactData) {
    // Generate initials
    const initials = contactData.name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

    const { data, error } = await supabase
      .from('contacts')
      .insert([{ ...contactData, initials, user_id: currentUser.id }])
      .select()
      .single();

    if (error) throw error;

    // Log interaction
    await this.logContactInteraction(data.id, 'note', 'Contact created');

    return data;
  },

  async updateContact(id, updates) {
    const { data, error } = await supabase
      .from('contacts')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', currentUser.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteContact(id) {
    const { error } = await supabase
      .from('contacts')
      .delete()
      .eq('id', id)
      .eq('user_id', currentUser.id);

    if (error) throw error;
  },

  async logContactInteraction(contactId, type, description) {
    const { data, error } = await supabase
      .from('contact_interactions')
      .insert([{
        contact_id: contactId,
        user_id: currentUser.id,
        type,
        description
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getContactInteractions(contactId) {
    const { data, error } = await supabase
      .from('contact_interactions')
      .select('*')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  // ===== NOTES =====
  async getNotes(filters = {}) {
    const query = supabase.from('notes').select('*').eq('user_id', currentUser.id);

    if (filters.domain) query.eq('domain', filters.domain);
    if (filters.is_favorite) query.eq('is_favorite', true);

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async createNote(noteData) {
    const { data, error } = await supabase
      .from('notes')
      .insert([{
        ...noteData,
        user_id: currentUser.id,
        created_by: noteData.created_by || 'You'
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateNote(id, updates) {
    const { data, error } = await supabase
      .from('notes')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', currentUser.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteNote(id) {
    const { error } = await supabase
      .from('notes')
      .delete()
      .eq('id', id)
      .eq('user_id', currentUser.id);

    if (error) throw error;
  },

  async toggleNoteFavorite(id, currentStatus) {
    return await this.updateNote(id, { is_favorite: !currentStatus });
  },

  // ===== LEARNING COURSES =====
  async getLearningCourses(filters = {}) {
    const query = supabase.from('learning_courses').select('*').eq('user_id', currentUser.id);

    if (filters.status) query.eq('status', filters.status);

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async createCourse(courseData) {
    const { data, error } = await supabase
      .from('learning_courses')
      .insert([{ ...courseData, user_id: currentUser.id }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateCourse(id, updates) {
    const { data, error } = await supabase
      .from('learning_courses')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', currentUser.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateCourseProgress(id, progress) {
    const status = progress >= 100 ? 'completed' : 'active';
    return await this.updateCourse(id, { progress, status });
  },

  async deleteCourse(id) {
    const { error} = await supabase
      .from('learning_courses')
      .delete()
      .eq('id', id)
      .eq('user_id', currentUser.id);

    if (error) throw error;
  },

  // ===== AGENT ACTIVITIES =====
  async getAgentActivities(filters = {}) {
    const query = supabase.from('agent_activities').select('*').eq('user_id', currentUser.id);

    if (filters.agent_name) query.eq('agent_name', filters.agent_name);
    if (filters.domain) query.eq('domain', filters.domain);

    const { data, error } = await query.order('created_at', { ascending: false }).limit(filters.limit || 20);
    if (error) throw error;
    return data;
  },

  // ===== MORNING BRIEFING =====
  async saveMorningBriefing(briefingData) {
    const { data, error } = await supabase
      .from('morning_briefings')
      .insert([{ ...briefingData, user_id: currentUser.id }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getTodaysBriefing() {
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('morning_briefings')
      .select('*')
      .eq('user_id', currentUser.id)
      .gte('created_at', today)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows returned
    return data;
  },

  // ===== DOMAINS =====
  async getDomains() {
    const { data, error } = await supabase
      .from('domains')
      .select('*')
      .eq('user_id', currentUser.id);

    if (error) throw error;
    return data;
  },

  // ===== SCHEDULE BLOCKS =====
  async getScheduleBlocks(date = null) {
    const query = supabase.from('schedule_blocks').select('*').eq('user_id', currentUser.id);

    if (date) {
      query.eq('date', date);
    }

    const { data, error } = await query.order('start_time');
    if (error) throw error;
    return data;
  },

  async createScheduleBlock(blockData) {
    const { data, error } = await supabase
      .from('schedule_blocks')
      .insert([{ ...blockData, user_id: currentUser.id }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateScheduleBlock(id, updates) {
    const { data, error } = await supabase
      .from('schedule_blocks')
      .update(updates)
      .eq('id', id)
      .eq('user_id', currentUser.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteScheduleBlock(id) {
    const { error } = await supabase
      .from('schedule_blocks')
      .delete()
      .eq('id', id)
      .eq('user_id', currentUser.id);

    if (error) throw error;
  }
};
