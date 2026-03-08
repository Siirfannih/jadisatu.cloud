// Complete View Management and Rendering for All 11 Views
// This file will replace views.js with full implementations

const ViewManager = {
  currentView: 'home',

  switchView(viewName) {
    console.log('[VIEW] Switching to:', viewName);
    document.querySelectorAll('[id^="view-"]').forEach(v => v.classList.add('hidden'));

    const viewElement = document.getElementById(`view-${viewName}`);
    if (viewElement) {
      viewElement.classList.remove('hidden');
      this.currentView = viewName;
      this.updateNavigation(viewName);
      this.updatePageTitle(viewName);
      this.renderView(viewName);
    }
  },

  updateNavigation(viewName) {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('bg-white/5', 'text-white');
      item.classList.add('text-gray-400');
    });
    const activeNav = document.querySelector(`[onclick*="'${viewName}'"]`);
    if (activeNav) {
      activeNav.classList.add('bg-white/5', 'text-white');
      activeNav.classList.remove('text-gray-400');
    }
  },

  updatePageTitle(viewName) {
    const titles = {
      home: 'Overview', focus: 'Today\'s Focus', work: 'Work & Career',
      learn: 'Learning', business: 'Business', projects: 'Projects',
      kanban: 'Kanban Board', notes: 'Notes & Ideas', crm: 'CRM & Network',
      agents: 'AI Agents', history: 'Progress & History'
    };
    const pageTitle = document.getElementById('page-title');
    if (pageTitle) pageTitle.textContent = titles[viewName] || 'Dashboard';
  },

  async renderView(viewName) {
    try {
      const renderMap = {
        home: 'renderHomeView', kanban: 'renderKanbanView', crm: 'renderCRMView',
        notes: 'renderNotesView', agents: 'renderAgentsView', projects: 'renderProjectsView',
        focus: 'renderFocusView', history: 'renderHistoryView'
      };

      if (['work', 'learn', 'business'].includes(viewName)) {
        await this.renderDomainView(viewName);
      } else if (renderMap[viewName]) {
        await this[renderMap[viewName]]();
      }

      lucide.createIcons();
    } catch (error) {
      await handleError(error, `Failed to render ${viewName} view`);
    }
  },

  // ============ HOME VIEW ============
  async renderHomeView() {
    await Promise.all([
      this.renderTodaysSchedule(),
      this.renderTodaysFocus(),
      this.renderProjectsPreview(),
      this.renderLearningPreview(),
      this.renderCRMPreview(),
      this.renderAgentActivityPreview()
    ]);
  },

  async renderTodaysSchedule() {
    const container = document.getElementById('todays-schedule-container');
    if (!container) return;

    const blocks = appCache.scheduleBlocks;
    const currentHour = new Date().getHours();
    let html = '';

    for (let hour = 6; hour <= 22; hour++) {
      const block = blocks.find(b => parseInt(b.start_time) === hour);
      const isNow = hour === currentHour;
      html += `
        <div class="flex flex-col items-center gap-2 min-w-[80px] relative">
          <span class="text-[10px] ${isNow ? 'text-accent font-bold' : 'text-gray-500'} font-medium">${hour}:00</span>
          <div class="w-full h-20 rounded-lg ${block ? `bg-${block.domain}/20 border border-${block.domain}/30 p-2` : 'bg-gray-800/30 border border-white/5'}">
            ${block ? `<span class="text-[10px] font-medium text-${block.domain}-light">${escapeHtml(block.title)}</span>` : ''}
          </div>
          ${isNow ? '<div class="absolute -top-1 w-3 h-3 bg-accent rounded-full animate-pulse"></div>' : ''}
        </div>`;
    }
    container.innerHTML = html;
  },

  async renderTodaysFocus() {
    const container = document.getElementById('todays-focus-container');
    if (!container) return;

    const focusTasks = appCache.tasks.filter(t =>
      (t.priority === 'high' || t.priority === 'urgent') && t.status !== 'done'
    ).slice(0, 5);

    if (focusTasks.length === 0) {
      container.innerHTML = '<div class="text-center py-8"><p class="text-gray-500">All priority tasks completed! 🎉</p></div>';
      return;
    }

    container.innerHTML = focusTasks.map(task => `
      <div class="group flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl transition-all">
        <button onclick="toggleTaskComplete('${task.id}', '${task.status}')" class="shrink-0">
          ${task.status === 'done' ?
            '<i data-lucide="check-circle-2" class="w-5 h-5 text-success"></i>' :
            '<i data-lucide="circle" class="w-5 h-5 text-gray-500"></i>'}
        </button>
        <span class="flex-1 text-sm ${task.status === 'done' ? 'line-through text-gray-500' : 'text-white'}">
          ${escapeHtml(task.title)}
        </span>
        <div class="flex gap-2 opacity-0 group-hover:opacity-100">
          <button onclick="updateTaskStatus('${task.id}', 'in-progress')" class="px-3 py-1 bg-work/20 text-work-light text-xs rounded-lg">Dikerjakan</button>
          <button onclick="updateTaskStatus('${task.id}', 'backlog')" class="px-3 py-1 bg-learn/20 text-learn-light text-xs rounded-lg">Ditunda</button>
          <button onclick="deleteTask('${task.id}')" class="p-1.5 bg-danger/20 text-danger rounded-lg"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
        </div>
      </div>
    `).join('');
  },

  async renderProjectsPreview() {
    const container = document.getElementById('projects-preview-container');
    if (!container) return;

    const projects = appCache.projects.filter(p => p.status === 'active').slice(0, 2);
    if (projects.length === 0) {
      container.innerHTML = '<p class="text-sm text-gray-500">No active projects</p>';
      return;
    }

    container.innerHTML = projects.map(p => {
      const progress = p.tasks_total > 0 ? Math.round((p.tasks_completed / p.tasks_total) * 100) : 0;
      return `
        <div class="bg-white/5 border border-white/5 rounded-xl p-4 hover:bg-white/10 transition-all">
          <h4 class="font-semibold text-white mb-2">${escapeHtml(p.name)}</h4>
          <p class="text-xs text-gray-400 mb-3">${p.tasks_completed}/${p.tasks_total} tasks</p>
          <div class="w-full h-2 bg-gray-800 rounded-full"><div class="h-full bg-work" style="width:${progress}%"></div></div>
        </div>`;
    }).join('');
  },

  async renderLearningPreview() {
    const container = document.getElementById('learning-preview-container');
    if (!container) return;

    const courses = appCache.learningCourses.filter(c => c.status === 'active').slice(0, 3);
    if (courses.length === 0) {
      container.innerHTML = '<p class="text-sm text-gray-500">No active courses</p>';
      return;
    }

    container.innerHTML = courses.map(c => `
      <div class="mb-3">
        <div class="flex justify-between mb-1">
          <span class="text-sm text-white">${escapeHtml(c.title)}</span>
          <span class="text-xs text-learn-light font-semibold">${c.progress}%</span>
        </div>
        <div class="w-full h-1.5 bg-gray-800 rounded-full"><div class="h-full bg-learn" style="width:${c.progress}%"></div></div>
      </div>
    `).join('');
  },

  async renderCRMPreview() {
    const container = document.getElementById('crm-preview-container');
    if (!container) return;

    const contacts = appCache.contacts.slice(0, 3);
    if (contacts.length === 0) {
      container.innerHTML = '<p class="text-sm text-gray-500">No contacts yet</p>';
      return;
    }

    container.innerHTML = contacts.map(c => {
      const statusColor = c.status === 'active' ? 'bg-success' : c.status === 'lead' ? 'bg-learn' : 'bg-gray-500';
      return `
        <div class="flex items-center gap-3 p-2 hover:bg-white/5 rounded-lg">
          <div class="w-10 h-10 rounded-full gradient-business flex items-center justify-center text-white font-semibold">${c.initials}</div>
          <div class="flex-1">
            <div class="flex items-center gap-2">
              <p class="text-sm font-medium text-white">${escapeHtml(c.name)}</p>
              <div class="w-2 h-2 rounded-full ${statusColor}"></div>
            </div>
            <p class="text-xs text-gray-400">${escapeHtml(c.company || 'No company')}</p>
          </div>
        </div>`;
    }).join('');
  },

  async renderAgentActivityPreview() {
    const container = document.getElementById('agent-activity-preview-container');
    if (!container) return;

    const activities = appCache.agentActivities.slice(0, 4);
    if (activities.length === 0) {
      container.innerHTML = '<p class="text-sm text-gray-500">No agent activity</p>';
      return;
    }

    container.innerHTML = activities.map(a => `
      <div class="flex gap-3 p-2">
        <div class="w-8 h-8 rounded-lg bg-work/20 flex items-center justify-center"><i data-lucide="bot" class="w-4 h-4 text-work-light"></i></div>
        <div class="flex-1">
          <p class="text-sm text-white font-medium">${escapeHtml(a.agent_name)}</p>
          <p class="text-xs text-gray-400">${escapeHtml(a.action)}</p>
          <p class="text-[10px] text-gray-600 mt-1">${formatTimeAgo(a.created_at)}</p>
        </div>
      </div>
    `).join('');
  },

  // ============ KANBAN VIEW ============
  async renderKanbanView() {
    const statuses = {backlog: 'Backlog', todo: 'To Do', 'in-progress': 'In Progress', review: 'Review', done: 'Done'};

    for (const [status, title] of Object.entries(statuses)) {
      const container = document.getElementById(`kanban-${status}`);
      if (!container) continue;

      const tasks = appCache.tasks.filter(t => t.status === status);
      container.innerHTML = tasks.length === 0 ? '<p class="text-xs text-gray-600 text-center py-4">No tasks</p>' :
        tasks.map(t => `
          <div class="bg-white/5 border border-white/5 rounded-lg p-3 hover:bg-white/10 cursor-pointer" onclick="openTaskDetails('${t.id}')">
            <div class="flex gap-2 mb-2">
              <span class="text-xs px-2 py-0.5 rounded-full bg-${t.domain}/20 text-${t.domain}-light">${t.domain}</span>
              ${t.priority === 'high' || t.priority === 'urgent' ? `<span class="text-xs px-2 py-0.5 rounded-full bg-danger/20 text-danger">${t.priority}</span>` : ''}
            </div>
            <h4 class="text-sm text-white font-medium">${escapeHtml(t.title)}</h4>
            ${t.progress ? `<div class="w-full h-1 bg-gray-800 rounded-full mt-2"><div class="h-full bg-${t.domain}" style="width:${t.progress}%"></div></div>` : ''}
          </div>
        `).join('');
    }
  },

  // ============ CRM VIEW ============
  async renderCRMView() {
    const container = document.getElementById('view-crm');
    if (!container) return;

    const contacts = appCache.contacts;
    const stats = {
      total: contacts.length,
      active: contacts.filter(c => c.status === 'active').length,
      leads: contacts.filter(c => c.status === 'lead').length,
      followUps: contacts.filter(c => c.next_followup_date && new Date(c.next_followup_date) <= new Date()).length
    };

    // Replace static stats
    const statsHTML = `
      <div class="grid grid-cols-4 gap-4 mb-6">
        <div class="glass rounded-xl p-4">
          <p class="text-gray-400 text-xs mb-1">Total Contacts</p>
          <p class="text-2xl font-bold text-white">${stats.total}</p>
        </div>
        <div class="glass rounded-xl p-4">
          <p class="text-gray-400 text-xs mb-1">Active</p>
          <p class="text-2xl font-bold text-success">${stats.active}</p>
        </div>
        <div class="glass rounded-xl p-4">
          <p class="text-gray-400 text-xs mb-1">Leads</p>
          <p class="text-2xl font-bold text-learn">${stats.leads}</p>
        </div>
        <div class="glass rounded-xl p-4">
          <p class="text-gray-400 text-xs mb-1">Follow-ups Due</p>
          <p class="text-2xl font-bold text-danger">${stats.followUps}</p>
        </div>
      </div>
    `;

    const contactsHTML = contacts.map(c => {
      const statusColor = {active: 'bg-success', lead: 'bg-learn', inactive: 'bg-gray-500'}[c.status] || 'bg-gray-500';
      return `
        <div class="glass rounded-xl p-4 hover:bg-white/5 cursor-pointer" onclick="openContactDetails('${c.id}')">
          <div class="flex items-start gap-3">
            <div class="w-12 h-12 rounded-full gradient-business flex items-center justify-center text-white font-bold">${c.initials}</div>
            <div class="flex-1">
              <div class="flex items-center gap-2 mb-1">
                <h4 class="font-semibold text-white">${escapeHtml(c.name)}</h4>
                <div class="w-2 h-2 rounded-full ${statusColor}"></div>
              </div>
              <p class="text-sm text-gray-400">${escapeHtml(c.company || 'No company')} ${c.role ? `• ${escapeHtml(c.role)}` : ''}</p>
              <p class="text-xs text-gray-500 mt-1">Last contact: ${c.last_contact_date ? formatDate(c.last_contact_date) : 'Never'}</p>
            </div>
          </div>
        </div>`;
    }).join('');

    // Find or create contacts grid container
    let contactsContainer = container.querySelector('#crm-contacts-grid');
    if (!contactsContainer) {
      contactsContainer = document.createElement('div');
      contactsContainer.id = 'crm-contacts-grid';
      container.appendChild(contactsContainer);
    }

    contactsContainer.innerHTML = statsHTML + `<div class="grid grid-cols-2 gap-4">${contactsHTML}</div>`;
  },

  // ============ NOTES VIEW ============
  async renderNotesView() {
    const container = document.getElementById('view-notes');
    if (!container) return;

    const notes = appCache.notes;

    const notesHTML = notes.map(n => `
      <div class="glass rounded-xl p-4 hover:bg-white/10 cursor-pointer" onclick="openNoteDetails('${n.id}')">
        <div class="flex items-center gap-2 mb-2">
          <span class="text-xs px-2 py-0.5 rounded-full bg-${n.domain}/20 text-${n.domain}-light">${n.domain || 'general'}</span>
          ${n.is_favorite ? '<i data-lucide="star" class="w-3 h-3 text-warning fill-warning"></i>' : ''}
        </div>
        <h4 class="font-semibold text-white mb-1">${escapeHtml(n.title)}</h4>
        <p class="text-sm text-gray-400 line-clamp-2">${escapeHtml(n.content || '')}</p>
        <div class="flex items-center gap-2 mt-3 text-xs text-gray-500">
          <span>${n.created_by || 'You'}</span>
          <span>•</span>
          <span>${formatTimeAgo(n.created_at)}</span>
        </div>
      </div>
    `).join('');

    let notesContainer = container.querySelector('#notes-grid');
    if (!notesContainer) {
      notesContainer = document.createElement('div');
      notesContainer.id = 'notes-grid';
      container.appendChild(notesContainer);
    }
    notesContainer.innerHTML = `<div class="grid grid-cols-3 gap-4">${notesHTML}</div>`;
  },

  // ============ AGENTS VIEW ============
  async renderAgentsView() {
    const container = document.getElementById('view-agents');
    if (!container) return;

    const activities = appCache.agentActivities || [];
    const agentsMap = {};
    activities.forEach(a => {
      const name = a.agent_name || 'Unknown Agent';
      if (!agentsMap[name]) {
        agentsMap[name] = {
          agent_name: name,
          agent_type: a.agent_type || 'agent',
          last_heartbeat: a.created_at,
          lastAction: a.action,
          domain: a.domain || 'work',
          capabilities: a.action ? [a.action] : []
        };
      } else {
        if (new Date(a.created_at) > new Date(agentsMap[name].last_heartbeat || 0)) {
          agentsMap[name].last_heartbeat = a.created_at;
          agentsMap[name].lastAction = a.action;
        }
        if (a.action && agentsMap[name].capabilities.indexOf(a.action) === -1) {
          agentsMap[name].capabilities.push(a.action);
        }
      }
    });
    const agents = Object.values(agentsMap);

    function timeAgo(dateStr) {
      if (!dateStr) return 'tidak pernah';
      const diff = (Date.now() - new Date(dateStr)) / 60000;
      if (diff < 1) return 'baru saja';
      if (diff < 60) return Math.floor(diff) + ' menit lalu';
      if (diff < 1440) return Math.floor(diff / 60) + ' jam lalu';
      return Math.floor(diff / 1440) + ' hari lalu';
    }

    function statusDot(lastHeartbeat) {
      if (!lastHeartbeat) return { color: 'bg-gray-500', pulse: '' };
      const min = (Date.now() - new Date(lastHeartbeat)) / 60000;
      if (min < 5) return { color: 'bg-success', pulse: 'animate-pulse' };
      if (min < 60) return { color: 'bg-warning', pulse: '' };
      return { color: 'bg-gray-500', pulse: '' };
    }

    function statusBadge(lastHeartbeat) {
      if (!lastHeartbeat) return { text: 'offline', class: 'bg-gray-700 text-gray-400' };
      const min = (Date.now() - new Date(lastHeartbeat)) / 60000;
      if (min < 5) return { text: 'active', class: 'bg-success/20 text-success' };
      if (min < 60) return { text: 'idle', class: 'bg-warning/20 text-warning' };
      return { text: 'offline', class: 'bg-gray-700 text-gray-400' };
    }

    let tableContainer = container.querySelector('#agents-table');
    if (!tableContainer) {
      tableContainer = document.createElement('div');
      tableContainer.id = 'agents-table';
      container.appendChild(tableContainer);
    }

    if (agents.length === 0) {
      tableContainer.innerHTML = `
        <div class="glass rounded-xl p-12 text-center">
          <div class="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
            <i data-lucide="bot" class="w-8 h-8 text-gray-500"></i>
          </div>
          <p class="text-gray-400 mb-1">Belum ada agent terhubung.</p>
          <p class="text-sm text-gray-500">Agent akan muncul saat Juru atau OpenClaw aktif.</p>
        </div>
      `;
    } else {
      const cardsHTML = agents.map(a => {
        const dot = statusDot(a.last_heartbeat);
        const badge = statusBadge(a.last_heartbeat);
        const caps = (a.capabilities || []).slice(0, 5).map(c => 
          `<span class="text-[9px] px-1.5 py-0.5 bg-white/5 rounded text-gray-500">${escapeHtml(c)}</span>`
        ).join('');
        return `
          <div class="p-4 bg-white/5 border border-white/10 rounded-xl">
            <div class="flex items-center gap-3">
              <div class="w-2 h-2 rounded-full ${dot.color} ${dot.pulse} shrink-0"></div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-white">${escapeHtml(a.agent_name)}</p>
                <p class="text-[10px] text-gray-500">${escapeHtml(a.agent_type)} · Last seen: ${timeAgo(a.last_heartbeat)}</p>
              </div>
              <span class="text-[10px] px-2 py-0.5 rounded-full ${badge.class} shrink-0">${badge.text}</span>
            </div>
            <div class="mt-2 flex flex-wrap gap-1">${caps}</div>
          </div>
        `;
      }).join('');

      tableContainer.innerHTML = `<div class="space-y-3">${cardsHTML}</div>`;
    }

    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
  },

  // ============ PROJECTS VIEW ============
  async renderProjectsView() {
    const container = document.getElementById('view-projects');
    if (!container) return;

    const projects = appCache.projects;

    const projectsHTML = projects.map(p => {
      const progress = p.tasks_total > 0 ? Math.round((p.tasks_completed / p.tasks_total) * 100) : 0;
      return `
        <div class="glass rounded-xl p-5 hover:bg-white/5 cursor-pointer" onclick="openProjectDetails('${p.id}')">
          <div class="flex justify-between items-start mb-3">
            <h3 class="text-lg font-semibold text-white">${escapeHtml(p.name)}</h3>
            <span class="text-2xl font-bold text-work">${progress}%</span>
          </div>
          <p class="text-sm text-gray-400 mb-4">${escapeHtml(p.description || 'No description')}</p>
          <div class="flex items-center justify-between text-xs text-gray-500 mb-2">
            <span>${p.tasks_completed} / ${p.tasks_total} tasks</span>
            <span class="px-2 py-1 rounded-full bg-${p.domain}/20 text-${p.domain}-light">${p.domain}</span>
          </div>
          <div class="w-full h-2 bg-gray-800 rounded-full"><div class="h-full bg-work rounded-full" style="width:${progress}%"></div></div>
        </div>`;
    }).join('');

    let projectsContainer = container.querySelector('#projects-grid');
    if (!projectsContainer) {
      projectsContainer = document.createElement('div');
      projectsContainer.id = 'projects-grid';
      container.appendChild(projectsContainer);
    }
    projectsContainer.innerHTML = `<div class="grid grid-cols-2 gap-4">${projectsHTML}</div>`;
  },

  // ============ FOCUS VIEW ============
  async renderFocusView() {
    const container = document.getElementById('view-focus');
    if (!container) return;

    const focusTasks = appCache.tasks.filter(t => t.priority === 'high' || t.priority === 'urgent').filter(t => t.status !== 'done');

    const tasksHTML = focusTasks.map(t => `
      <div class="glass rounded-xl p-4 mb-3 flex items-center gap-4">
        <button onclick="toggleTaskComplete('${t.id}', '${t.status}')" class="shrink-0">
          ${t.status === 'done' ? '<i data-lucide="check-circle-2" class="w-6 h-6 text-success"></i>' : '<i data-lucide="circle" class="w-6 h-6 text-gray-500"></i>'}
        </button>
        <div class="flex-1">
          <h4 class="text-lg font-medium text-white mb-1">${escapeHtml(t.title)}</h4>
          <div class="flex gap-2">
            <span class="text-xs px-2 py-0.5 rounded-full bg-${t.domain}/20 text-${t.domain}-light">${t.domain}</span>
            <span class="text-xs px-2 py-0.5 rounded-full bg-danger/20 text-danger">${t.priority}</span>
          </div>
        </div>
      </div>
    `).join('');

    let focusContainer = container.querySelector('#focus-tasks-list');
    if (!focusContainer) {
      focusContainer = document.createElement('div');
      focusContainer.id = 'focus-tasks-list';
      container.appendChild(focusContainer);
    }
    focusContainer.innerHTML = tasksHTML || '<p class="text-center text-gray-500 py-8">No priority tasks</p>';
  },

  // ============ DOMAIN VIEW ============
  async renderDomainView(domain) {
    const container = document.getElementById(`view-${domain}`);
    if (!container) return;

    const tasks = appCache.tasks.filter(t => t.domain === domain);
    const projects = appCache.projects.filter(p => p.domain === domain);

    const html = `
      <div class="space-y-6">
        <div class="glass rounded-xl p-5">
          <h3 class="text-lg font-semibold text-white mb-4">Tasks (${tasks.length})</h3>
          <div class="space-y-2">
            ${tasks.map(t => `
              <div class="p-3 bg-white/5 rounded-lg flex items-center gap-3">
                <button onclick="toggleTaskComplete('${t.id}', '${t.status}')">
                  ${t.status === 'done' ? '<i data-lucide="check-circle-2" class="w-5 h-5 text-success"></i>' : '<i data-lucide="circle" class="w-5 h-5 text-gray-500"></i>'}
                </button>
                <span class="text-white">${escapeHtml(t.title)}</span>
              </div>
            `).join('') || '<p class="text-gray-500 text-center py-4">No tasks</p>'}
          </div>
        </div>

        <div class="glass rounded-xl p-5">
          <h3 class="text-lg font-semibold text-white mb-4">Projects (${projects.length})</h3>
          <div class="grid grid-cols-2 gap-4">
            ${projects.map(p => `
              <div class="bg-white/5 rounded-lg p-4">
                <h4 class="font-semibold text-white mb-2">${escapeHtml(p.name)}</h4>
                <p class="text-xs text-gray-400">${p.tasks_completed}/${p.tasks_total} tasks</p>
              </div>
            `).join('') || '<p class="text-gray-500 col-span-2 text-center py-4">No projects</p>'}
          </div>
        </div>
      </div>
    `;

    container.innerHTML = html;
  },

  // ============ HISTORY VIEW ============
  async renderHistoryView() {
    const container = document.getElementById('view-history');
    if (!container) return;

    const completedTasks = appCache.tasks
      .filter(t => (t.status === 'done' || t.status === 'completed') && t.completed_at)
      .sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at));

    // Timeline panel
    const timelineHtml = `
      <div class="glass rounded-xl p-5">
        <h3 class="text-lg font-semibold text-white mb-4">Completed Tasks (${completedTasks.length})</h3>
        <div class="space-y-3">
          ${completedTasks.map(t => `
            <div class="flex gap-4">
              <div class="flex flex-col items-center">
                <div class="w-3 h-3 rounded-full bg-success"></div>
                <div class="w-0.5 h-full bg-gray-800"></div>
              </div>
              <div class="flex-1 pb-4">
                <h4 class="font-medium text-white">${escapeHtml(t.title)}</h4>
                <p class="text-xs text-gray-500">${formatDateTime(t.completed_at)}</p>
                <span class="text-xs px-2 py-0.5 rounded-full bg-${t.domain}/20 text-${t.domain}-light inline-block mt-1">${t.domain}</span>
              </div>
            </div>
          `).join('') || '<p class="text-gray-500 text-center py-8">No completed tasks yet</p>'}
        </div>
      </div>
    `;

    let timelineContainer = document.getElementById('history-completed-wrapper');
    if (!timelineContainer) {
      timelineContainer = document.createElement('div');
      timelineContainer.id = 'history-completed-wrapper';
      container.appendChild(timelineContainer);
    }
    timelineContainer.innerHTML = timelineHtml;

    // Weekly Output Chart (last 4 weeks, stacked by domain)
    const canvas = document.getElementById('weekly-output-chart');
    if (!canvas || typeof Chart === 'undefined') {
      return;
    }

    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - 28);

    const domains = ['work', 'learn', 'business'];
    const weeks = [0, 1, 2, 3]; // 0 = current week, 3 = oldest

    const countsByDomainWeek = {};
    domains.forEach(d => {
      countsByDomainWeek[d] = [0, 0, 0, 0];
    });

    completedTasks.forEach(t => {
      const d = (t.domain || '').toLowerCase();
      if (domains.indexOf(d) === -1) return;
      const dt = new Date(t.completed_at || t.created_at || new Date());
      if (dt < start) return;
      const diffDays = Math.floor((now - dt) / 86400000);
      const weekIndex = Math.min(3, Math.max(0, Math.floor(diffDays / 7)));
      countsByDomainWeek[d][3 - weekIndex] += 1; // oldest on left
    });

    const labels = ['Minggu 1', 'Minggu 2', 'Minggu 3', 'Minggu 4'];
    const datasets = [
      {
        label: 'Work',
        data: countsByDomainWeek.work,
        backgroundColor: 'rgba(99, 102, 241, 0.8)'
      },
      {
        label: 'Learn',
        data: countsByDomainWeek.learn,
        backgroundColor: 'rgba(34, 197, 94, 0.8)'
      },
      {
        label: 'Business',
        data: countsByDomainWeek.business,
        backgroundColor: 'rgba(245, 158, 11, 0.8)'
      }
    ];

    if (typeof window._weeklyChart !== 'undefined' && window._weeklyChart) {
      window._weeklyChart.destroy();
    }

    Chart.defaults.color = '#9ca3af';

    const ctx = canvas.getContext('2d');
    window._weeklyChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: {
              color: '#e5e7eb',
              font: { size: 10 }
            }
          }
        },
        scales: {
          x: {
            stacked: true,
            grid: {
              color: '#1f2933'
            }
          },
          y: {
            stacked: true,
            beginAtZero: true,
            grid: {
              color: '#1f2933'
            },
            ticks: {
              stepSize: 1
            }
          }
        }
      }
    });
  }
};

// ===== GLOBAL ACTION FUNCTIONS =====
async function toggleTaskComplete(id, currentStatus) {
  await safeAsync(async () => {
    const task = await DataService.toggleTaskComplete(id, currentStatus);
    showToast(task.status === 'done' ? '✓ Task completed!' : 'Task reopened', 'success');
  }, 'Failed to update task');
}

async function updateTaskStatus(id, newStatus) {
  await safeAsync(async () => {
    await DataService.updateTask(id, { status: newStatus });
    showToast('Task status updated', 'success');
  }, 'Failed to update status');
}

async function deleteTask(id) {
  if (!confirm('Delete this task?')) return;
  await safeAsync(async () => {
    await DataService.deleteTask(id);
    showToast('Task deleted', 'success');
  }, 'Failed to delete task');
}

function openTaskDetails(id) {
  const task = appCache.tasks.find(t => t.id === id);
  if (!task) return;

  showModal(task.title, `
    <div class="space-y-2">
      <p><strong>Domain:</strong> ${task.domain}</p>
      <p><strong>Status:</strong> ${task.status}</p>
      <p><strong>Priority:</strong> ${task.priority || 'Normal'}</p>
      <p><strong>Created:</strong> ${formatDate(task.created_at)}</p>
    </div>
  `, [
    { label: 'Close', primary: false, onclick: 'closeModal()' }
  ]);
}

function openContactDetails(id) {
  const contact = appCache.contacts.find(c => c.id === id);
  if (!contact) return;

  showModal(contact.name, `
    <div class="space-y-2">
      <p><strong>Company:</strong> ${contact.company || 'N/A'}</p>
      <p><strong>Email:</strong> ${contact.email || 'N/A'}</p>
      <p><strong>Phone:</strong> ${contact.phone || 'N/A'}</p>
      <p><strong>Status:</strong> ${contact.status}</p>
      <p><strong>Last Contact:</strong> ${contact.last_contact_date ? formatDate(contact.last_contact_date) : 'Never'}</p>
    </div>
  `, [
    { label: 'Close', primary: false, onclick: 'closeModal()' }
  ]);
}

function openNoteDetails(id) {
  const note = appCache.notes.find(n => n.id === id);
  if (!note) return;

  showModal(note.title, `
    <div class="prose prose-invert max-w-none">
      <p>${escapeHtml(note.content || 'No content')}</p>
      <div class="mt-4 text-xs text-gray-500">
        <p>Created by: ${note.created_by || 'You'}</p>
        <p>Date: ${formatDateTime(note.created_at)}</p>
      </div>
    </div>
  `, [
    { label: 'Close', primary: false, onclick: 'closeModal()' }
  ]);
}

function openProjectDetails(id) {
  const project = appCache.projects.find(p => p.id === id);
  if (!project) return;

  showModal(project.name, `
    <div class="space-y-2">
      <p>${escapeHtml(project.description || 'No description')}</p>
      <p><strong>Domain:</strong> ${project.domain}</p>
      <p><strong>Status:</strong> ${project.status}</p>
      <p><strong>Progress:</strong> ${project.tasks_completed}/${project.tasks_total} tasks</p>
    </div>
  `, [
    { label: 'Close', primary: false, onclick: 'closeModal()' }
  ]);
}

if (typeof window !== 'undefined') {
  window.ViewManager = ViewManager;
}
