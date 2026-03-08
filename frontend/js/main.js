// Main Application Initialization

// Global app cache
const appCache = {
  tasks: [],
  projects: [],
  scheduleBlocks: [],
  domains: [],
  contacts: [],
  notes: [],
  learningCourses: [],
  agentActivities: [],
  todaysBriefing: null,
  lastUpdated: null
};

// App state
let currentView = 'home';

// Initialize app on page load
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[APP] Initializing JadiSatu OS...');

  // Initialize Lucide icons
  lucide.createIcons();

  // Check authentication
  const isAuth = await initAuth();
  if (!isAuth) return;

  // Load dashboard data
  await loadDashboard();

  // Setup real-time subscriptions
  setupRealtimeSubscriptions();

  // Setup event listeners
  setupEventListeners();

  // Check if should show morning briefing
  checkMorningBriefing();

  console.log('[APP] Initialization complete');
});

// Load all dashboard data
async function loadDashboard() {
  console.log('[APP] Loading dashboard...');
  showLoading('Loading your dashboard...');

  try {
    const data = await DataService.loadDashboardData();

    if (data) {
      // Update cache
      Object.assign(appCache, data);
      appCache.lastUpdated = new Date();

      // Update UI
      updateUserProfile();
      updateLifeBalance();

      // Render initial view
      ViewManager.switchView('home');

      console.log('[APP] Dashboard loaded successfully');
    }

  } catch (error) {
    await handleError(error, 'Failed to load dashboard');
  } finally {
    hideLoading();
  }
}

// Update user profile in sidebar
function updateUserProfile() {
  const user = getCurrentUser();
  if (!user) return;

  const profileName = document.getElementById('profile-name');
  const profileEmail = document.getElementById('profile-email');
  const profileInitials = document.getElementById('profile-initials');

  if (profileName) {
    const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';
    profileName.textContent = name;
  }

  if (profileEmail) {
    profileEmail.textContent = user.email;
  }

  if (profileInitials) {
    const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'U';
    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    profileInitials.textContent = initials;
  }
}

// Update life balance indicator
function updateLifeBalance() {
  const domains = appCache.domains;
  if (!domains || domains.length === 0) return;

  const container = document.getElementById('life-balance-bar');
  const percentageEl = document.getElementById('life-balance-percentage');

  if (!container) return;

  // Calculate percentages based on task completion
  const totalTasks = appCache.tasks.length;
  if (totalTasks === 0) return;

  const domainStats = domains.map(d => {
    const domainTasks = appCache.tasks.filter(t => t.domain === d.name);
    const completedTasks = domainTasks.filter(t => t.status === 'done').length;
    const progress = domainTasks.length > 0 ? (completedTasks / domainTasks.length) * 100 : 0;
    const percentage = (domainTasks.length / totalTasks) * 100;

    return {
      name: d.name,
      percentage,
      progress,
      color: d.name
    };
  });

  // Overall balance (average progress across domains)
  const avgProgress = domainStats.reduce((sum, d) => sum + d.progress, 0) / domainStats.length;

  if (percentageEl) {
    percentageEl.textContent = Math.round(avgProgress) + '%';
  }

  // Render bar
  container.innerHTML = domainStats.map(d => `
    <div class="h-full bg-${d.color}" style="width: ${d.percentage}%"></div>
  `).join('');
}

// Setup real-time subscriptions
function setupRealtimeSubscriptions() {
  console.log('[REALTIME] Setting up subscriptions...');

  const userId = getCurrentUser()?.id;
  if (!userId) return;

  // Tasks subscription
  supabase
    .channel('tasks-changes')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'tasks', filter: `user_id=eq.${userId}` },
      (payload) => handleTaskChange(payload)
    )
    .subscribe();

  // Agent activities subscription
  supabase
    .channel('agent-activities')
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'agent_activities', filter: `user_id=eq.${userId}` },
      (payload) => handleNewAgentActivity(payload.new)
    )
    .subscribe();

  // Contacts subscription
  supabase
    .channel('contacts-changes')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'contacts', filter: `user_id=eq.${userId}` },
      (payload) => handleContactChange(payload)
    )
    .subscribe();

  console.log('[REALTIME] Subscriptions active');
}

// Handle task change from realtime
function handleTaskChange(payload) {
  console.log('[REALTIME] Task change:', payload.eventType);

  if (payload.eventType === 'INSERT') {
    appCache.tasks.unshift(payload.new);
  } else if (payload.eventType === 'UPDATE') {
    const index = appCache.tasks.findIndex(t => t.id === payload.new.id);
    if (index !== -1) appCache.tasks[index] = payload.new;
  } else if (payload.eventType === 'DELETE') {
    appCache.tasks = appCache.tasks.filter(t => t.id !== payload.old.id);
  }

  // Re-render if on relevant view
  if (['home', 'kanban', 'focus'].includes(currentView)) {
    ViewManager.renderView(currentView);
  }

  updateLifeBalance();
}

// Handle new agent activity
function handleNewAgentActivity(activity) {
  console.log('[REALTIME] New agent activity:', activity.agent_name);

  appCache.agentActivities.unshift(activity);

  // Show toast notification
  showToast(`${activity.agent_name}: ${activity.action}`, 'info');

  // Re-render if on home or agents view
  if (currentView === 'home' || currentView === 'agents') {
    ViewManager.renderView(currentView);
  }
}

// Handle contact change
function handleContactChange(payload) {
  console.log('[REALTIME] Contact change:', payload.eventType);

  if (payload.eventType === 'INSERT') {
    appCache.contacts.unshift(payload.new);
  } else if (payload.eventType === 'UPDATE') {
    const index = appCache.contacts.findIndex(c => c.id === payload.new.id);
    if (index !== -1) appCache.contacts[index] = payload.new;
  } else if (payload.eventType === 'DELETE') {
    appCache.contacts = appCache.contacts.filter(c => c.id !== payload.old.id);
  }

  // Re-render if on CRM view
  if (currentView === 'crm') {
    ViewManager.renderView(currentView);
  }
}

// Setup global event listeners
function setupEventListeners() {
  // Logout button
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => signOut());
  }

  // Morning briefing close
  const briefingClose = document.getElementById('briefing-close');
  if (briefingClose) {
    briefingClose.addEventListener('click', () => closeMorningBriefing());
  }

  // Command bar (Cmd+K)
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      toggleCommandBar();
    }

    // Escape to close modals
    if (e.key === 'Escape') {
      closeModal();
      closeMorningBriefing();
    }
  });
}

// Check if should show morning briefing
async function checkMorningBriefing() {
  const today = new Date().toDateString();
  const lastBriefing = localStorage.getItem('briefingDate');

  if (lastBriefing === today) {
    console.log('[BRIEFING] Already completed today');
    return;
  }

  // Check if already saved in database today
  const briefing = await safeAsync(() => DataService.getTodaysBriefing());

  if (!briefing) {
    // Show morning briefing modal
    showMorningBriefingModal();
  } else {
    localStorage.setItem('briefingDate', today);
  }
}

// Show morning briefing modal
function showMorningBriefingModal() {
  const modal = document.getElementById('morning-briefing');
  if (modal) {
    modal.classList.remove('hidden');
  }
}

// Close morning briefing
function closeMorningBriefing() {
  const modal = document.getElementById('morning-briefing');
  if (modal) {
    modal.classList.add('hidden');
  }
}

// Toggle command bar
function toggleCommandBar() {
  const commandBar = document.getElementById('command-bar');
  if (commandBar) {
    commandBar.classList.toggle('hidden');

    if (!commandBar.classList.contains('hidden')) {
      const input = document.getElementById('command-input');
      if (input) input.focus();
    }
  }
}

// Refresh dashboard data
async function refreshDashboard() {
  console.log('[APP] Refreshing dashboard...');
  await loadDashboard();
  showToast('Dashboard refreshed', 'success');
}

// Global error handler
window.addEventListener('error', (event) => {
  console.error('[GLOBAL ERROR]', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[UNHANDLED REJECTION]', event.reason);
});
