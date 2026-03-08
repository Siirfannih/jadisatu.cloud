// View Management and Rendering

const ViewManager = {
  currentView: 'home',

  // Switch between views
  switchView(viewName) {
    console.log('[VIEW] Switching to:', viewName);

    // Hide all views
    document.querySelectorAll('[id^="view-"]').forEach(v => {
      v.classList.add('hidden');
    });

    // Show selected view
    const viewElement = document.getElementById(`view-${viewName}`);
    if (viewElement) {
      viewElement.classList.remove('hidden');
      this.currentView = viewName;

      // Update navigation active state
      this.updateNavigation(viewName);

      // Update page title
      this.updatePageTitle(viewName);

      // Render view content
      this.renderView(viewName);
    } else {
      console.error('[VIEW] View not found:', viewName);
    }
  },

  // Update navigation active state
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

  // Update page title
  updatePageTitle(viewName) {
    const titles = {
      home: 'Overview',
      focus: 'Today\'s Focus',
      work: 'Work & Career',
      learn: 'Learning',
      business: 'Business',
      projects: 'Projects',
      kanban: 'Kanban Board',
      notes: 'Notes & Ideas',
      crm: 'CRM & Network',
      agents: 'AI Agents',
      history: 'Progress & History'
    };

    const pageTitle = document.getElementById('page-title');
    if (pageTitle) {
      pageTitle.textContent = titles[viewName] || 'Dashboard';
    }
  },

  // Render view content
  async renderView(viewName) {
    try {
      switch (viewName) {
        case 'home':
          await this.renderHomeView();
          break;
        case 'kanban':
          await this.renderKanbanView();
          break;
        case 'crm':
          await this.renderCRMView();
          break;
        case 'notes':
          await this.renderNotesView();
          break;
        case 'agents':
          await this.renderAgentsView();
          break;
        case 'projects':
          await this.renderProjectsView();
          break;
        case 'focus':
          await this.renderFocusView();
          break;
        case 'work':
        case 'learn':
        case 'business':
          await this.renderDomainView(viewName);
          break;
        case 'history':
          await this.renderHistoryView();
          break;
        default:
          console.warn('[VIEW] No render function for:', viewName);
      }

      // Reinitialize icons
      lucide.createIcons();

    } catch (error) {
      await handleError(error, `Failed to render ${viewName} view`);
    }
  },

  // === HOME VIEW ===
  async renderHomeView() {
    console.log('[VIEW] Rendering home view...');

    // Render today's schedule
    await this.renderTodaysSchedule();

    // Render today's focus tasks
    await this.renderTodaysFocus();

    // Render active projects preview
    await this.renderProjectsPreview();

    // Render learning progress
    await this.renderLearningPreview();

    // Render CRM preview
    await this.renderCRMPreview();

    // Render agent activity
    await this.renderAgentActivityPreview();
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
          <span class="text-[10px] ${isNow ? 'text-accent font-bold' : 'text-gray-500'} font-medium">
            ${hour}:00
          </span>
          <div class="w-full h-20 rounded-lg ${
            block
              ? `bg-${block.domain}/20 border border-${block.domain}/30 p-2 flex flex-col justify-center`
              : 'bg-gray-800/30 border border-white/5'
          }">
            ${block ? `
              <span class="text-[10px] font-medium text-${block.domain}-light">${escapeHtml(block.title)}</span>
              <span class="text-[9px] text-${block.domain}-light/70">${escapeHtml(block.description || '')}</span>
            ` : ''}
          </div>
          ${isNow ? `
            <div class="absolute -top-1 w-3 h-3 bg-accent rounded-full shadow-[0_0_10px_rgba(236,72,153,0.5)] animate-pulse"></div>
          ` : ''}
        </div>
      `;
    }

    container.innerHTML = html;
  },

  async renderTodaysFocus() {
    const container = document.getElementById('todays-focus-container');
    if (!container) return;

    const focusTasks = appCache.tasks
      .filter(t => t.priority === 'high' || t.priority === 'urgent')
      .filter(t => t.status !== 'done')
      .slice(0, 5);

    if (focusTasks.length === 0) {
      showEmptyState(
        'todays-focus-container',
        'target',
        'No priority tasks',
        'All your high-priority tasks are completed! 🎉'
      );
      return;
    }

    const html = focusTasks.map(task => `
      <div class="group flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl transition-all">
        <button onclick="toggleTaskComplete('${task.id}', '${task.status}')" class="shrink-0">
          ${task.status === 'done'
            ? '<i data-lucide="check-circle-2" class="w-5 h-5 text-success"></i>'
            : '<i data-lucide="circle" class="w-5 h-5 text-gray-500 hover:text-accent"></i>'
          }
        </button>

        <span class="flex-1 text-sm ${task.status === 'done' ? 'line-through text-gray-500' : 'text-white'}">
          ${escapeHtml(task.title)}
        </span>

        <div class="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onclick="updateTaskStatus('${task.id}', 'in-progress')"
            class="px-3 py-1 bg-work/20 hover:bg-work/30 text-work-light text-xs rounded-lg">
            Dikerjakan
          </button>
          <button onclick="updateTaskStatus('${task.id}', 'backlog')"
            class="px-3 py-1 bg-learn/20 hover:bg-learn/30 text-learn-light text-xs rounded-lg">
            Ditunda
          </button>
          <button onclick="deleteTask('${task.id}')"
            class="p-1.5 bg-danger/20 hover:bg-danger/30 text-danger rounded-lg">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </div>
      </div>
    `).join('');

    container.innerHTML = html;
  },

  async renderProjectsPreview() {
    const container = document.getElementById('projects-preview-container');
    if (!container) return;

    const activeProjects = appCache.projects
      .filter(p => p.status === 'active' || p.status === 'in-progress')
      .slice(0, 2);

    if (activeProjects.length === 0) {
      container.innerHTML = '<p class="text-sm text-gray-500">No active projects</p>';
      return;
    }

    const html = activeProjects.map(project => {
      const progress = project.tasks_total > 0
        ? Math.round((project.tasks_completed / project.tasks_total) * 100)
        : 0;

      return `
        <div class="bg-white/5 border border-white/5 rounded-xl p-4 hover:bg-white/10 transition-all cursor-pointer">
          <h4 class="font-semibold text-white mb-2">${escapeHtml(project.name)}</h4>
          <p class="text-xs text-gray-400 mb-3">${project.tasks_completed}/${project.tasks_total} tasks</p>
          <div class="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
            <div class="h-full bg-work" style="width: ${progress}%"></div>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = html;
  },

  async renderLearningPreview() {
    const container = document.getElementById('learning-preview-container');
    if (!container) return;

    const activeCourses = appCache.learningCourses
      .filter(c => c.status === 'active')
      .slice(0, 3);

    if (activeCourses.length === 0) {
      container.innerHTML = '<p class="text-sm text-gray-500">No active courses</p>';
      return;
    }

    const html = activeCourses.map(course => `
      <div class="flex items-center gap-3 mb-3">
        <div class="flex-1">
          <div class="flex items-center justify-between mb-1">
            <span class="text-sm text-white">${escapeHtml(course.title)}</span>
            <span class="text-xs text-learn-light font-semibold">${course.progress}%</span>
          </div>
          <div class="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div class="h-full bg-learn" style="width: ${course.progress}%"></div>
          </div>
        </div>
      </div>
    `).join('');

    container.innerHTML = html;
  },

  async renderCRMPreview() {
    const container = document.getElementById('crm-preview-container');
    if (!container) return;

    const recentContacts = appCache.contacts.slice(0, 3);

    if (recentContacts.length === 0) {
      container.innerHTML = '<p class="text-sm text-gray-500">No contacts yet</p>';
      return;
    }

    const html = recentContacts.map(contact => {
      const statusColor = contact.status === 'active' ? 'bg-success' :
                         contact.status === 'lead' ? 'bg-learn' :
                         'bg-gray-500';

      return `
        <div class="flex items-center gap-3 p-2 hover:bg-white/5 rounded-lg transition-all">
          <div class="w-10 h-10 rounded-full gradient-business flex items-center justify-center text-white font-semibold text-sm">
            ${contact.initials || 'XX'}
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <p class="text-sm font-medium text-white truncate">${escapeHtml(contact.name)}</p>
              <div class="w-2 h-2 rounded-full ${statusColor}"></div>
            </div>
            <p class="text-xs text-gray-400 truncate">${escapeHtml(contact.company || 'No company')}</p>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = html;
  },

  async renderAgentActivityPreview() {
    const container = document.getElementById('agent-activity-preview-container');
    if (!container) return;

    const recentActivities = appCache.agentActivities.slice(0, 4);

    if (recentActivities.length === 0) {
      container.innerHTML = '<p class="text-sm text-gray-500">No agent activity yet</p>';
      return;
    }

    const html = recentActivities.map(activity => `
      <div class="flex items-start gap-3 p-2">
        <div class="w-8 h-8 rounded-lg bg-work/20 flex items-center justify-center shrink-0">
          <i data-lucide="bot" class="w-4 h-4 text-work-light"></i>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm text-white font-medium">${escapeHtml(activity.agent_name)}</p>
          <p class="text-xs text-gray-400">${escapeHtml(activity.action)}</p>
          <p class="text-[10px] text-gray-600 mt-1">${formatTimeAgo(activity.created_at)}</p>
        </div>
      </div>
    `).join('');

    container.innerHTML = html;
  },

  // === KANBAN VIEW ===
  async renderKanbanView() {
    console.log('[VIEW] Rendering kanban view...');

    const statuses = ['backlog', 'todo', 'in-progress', 'review', 'done'];
    const columns = {
      backlog: 'Backlog',
      todo: 'To Do',
      'in-progress': 'In Progress',
      review: 'Review',
      done: 'Done'
    };

    for (const [status, title] of Object.entries(columns)) {
      const container = document.getElementById(`kanban-${status}`);
      if (!container) continue;

      const tasks = appCache.tasks.filter(t => t.status === status);

      if (tasks.length === 0) {
        container.innerHTML = `<p class="text-xs text-gray-600 text-center py-4">No tasks</p>`;
        continue;
      }

      const html = tasks.map(task => `
        <div class="bg-white/5 border border-white/5 rounded-lg p-3 hover:bg-white/10 transition-all cursor-pointer"
             onclick="openTaskDetails('${task.id}')">
          <div class="flex items-center gap-2 mb-2">
            <span class="text-xs px-2 py-0.5 rounded-full bg-${task.domain}/20 text-${task.domain}-light">
              ${task.domain}
            </span>
            ${task.priority === 'high' || task.priority === 'urgent' ? `
              <span class="text-xs px-2 py-0.5 rounded-full bg-danger/20 text-danger">
                ${task.priority}
              </span>
            ` : ''}
          </div>
          <h4 class="text-sm text-white font-medium mb-2">${escapeHtml(task.title)}</h4>
          ${task.progress ? `
            <div class="w-full h-1 bg-gray-800 rounded-full overflow-hidden mb-2">
              <div class="h-full bg-${task.domain}" style="width: ${task.progress}%"></div>
            </div>
          ` : ''}
        </div>
      `).join('');

      container.innerHTML = html;
    }
  },

  // === CRM VIEW ===
  async renderCRMView() {
    console.log('[VIEW] Rendering CRM view...');
    // Implementation similar to preview but full version
    // (Full implementation would go here - keeping brief for file size)
  },

  // === NOTES VIEW ===
  async renderNotesView() {
    console.log('[VIEW] Rendering notes view...');
    // Full notes grid implementation
    // (Full implementation would go here)
  },

  // === AGENTS VIEW ===
  async renderAgentsView() {
    console.log('[VIEW] Rendering agents view...');
    // Full agent activity table
    // (Full implementation would go here)
  },

  // === PROJECTS VIEW ===
  async renderProjectsView() {
    console.log('[VIEW] Rendering projects view...');
    // Full projects grid
    // (Full implementation would go here)
  },

  // === FOCUS VIEW ===
  async renderFocusView() {
    console.log('[VIEW] Rendering focus view...');
    // Distraction-free task list
    // (Full implementation would go here)
  },

  // === DOMAIN VIEW ===
  async renderDomainView(domain) {
    console.log('[VIEW] Rendering domain view:', domain);
    // Filter everything by domain
    // (Full implementation would go here)
  },

  // === HISTORY VIEW ===
  async renderHistoryView() {
    console.log('[VIEW] Rendering history view...');
    // Timeline of completed tasks and progress
    // (Full implementation would go here)
  }
};

// ===== TASK ACTIONS =====
async function toggleTaskComplete(id, currentStatus) {
  await safeAsync(async () => {
    const updatedTask = await DataService.toggleTaskComplete(id, currentStatus);
    showToast(
      updatedTask.status === 'done' ? '✓ Task completed!' : 'Task marked incomplete',
      'success'
    );
  }, 'Failed to update task');
}

async function updateTaskStatus(id, newStatus) {
  await safeAsync(async () => {
    await DataService.updateTask(id, { status: newStatus });
    showToast('Task status updated', 'success');
  }, 'Failed to update status');
}

async function deleteTask(id) {
  if (!confirm('Are you sure you want to delete this task?')) return;

  await safeAsync(async () => {
    await DataService.deleteTask(id);
    showToast('Task deleted', 'success');
  }, 'Failed to delete task');
}

function openTaskDetails(id) {
  const task = appCache.tasks.find(t => t.id === id);
  if (!task) return;

  showModal(
    task.title,
    `
      <div class="space-y-2">
        <p class="text-sm"><strong>Domain:</strong> ${task.domain}</p>
        <p class="text-sm"><strong>Status:</strong> ${task.status}</p>
        <p class="text-sm"><strong>Priority:</strong> ${task.priority || 'Normal'}</p>
        <p class="text-sm"><strong>Created:</strong> ${formatDate(task.created_at)}</p>
      </div>
    `,
    [
      { label: 'Close', primary: false, onclick: 'closeModal()' },
      { label: 'Edit', primary: true, onclick: `editTask('${task.id}')` }
    ]
  );
}
