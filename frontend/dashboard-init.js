/**
 * Dashboard Initialization - Main backend logic for JadiSatu OS
 * Initializes all services, loads all data, manages multi-user state
 */

// ============= GLOBAL STATE =============
window.currentUser = null;
window.currentProjectId = null;

// Data caches
window.allTasks = [];
window.allProjects = [];
window.allNotes = [];
window.allContacts = [];
window.allCourses = [];
window.allAgentActivities = [];

// ============= SERVICE INITIALIZATION =============

/**
 * Initialize all services with Supabase client
 */
function initServices() {
    if (!window.supabaseClient) {
        console.error('❌ Supabase client not initialized');
        return false;
    }

    // Initialize all services
    window.taskService = new TaskService(window.supabaseClient);
    window.projectService = new ProjectService(window.supabaseClient);
    window.noteService = new NoteService(window.supabaseClient);
    window.contactService = new ContactService(window.supabaseClient);
    window.learningService = new LearningService(window.supabaseClient);

    console.log('✅ All services initialized');
    return true;
}

// ============= DATA LOADING FUNCTIONS =============

/**
 * Load all tasks for current user
 */
async function loadTasks() {
    if (!window.currentUser) return;

    try {
        const filters = {};

        // Apply project filter if set
        if (window.currentProjectId) {
            filters.project_id = window.currentProjectId;
        }

        window.allTasks = await window.taskService.getTasks(window.currentUser.id, filters);

        // Render in different views
        if (typeof renderKanbanTasks === 'function') {
            renderKanbanTasks(window.allTasks);
        }
        if (typeof refreshFocusView === 'function') {
            refreshFocusView();
        }
        if (typeof refreshLearningView === 'function') {
            refreshLearningView();
        }

        console.log(`✅ Loaded ${window.allTasks.length} tasks`);
    } catch (err) {
        console.error('❌ Error loading tasks:', err);
    }
}

/**
 * Load all projects for current user
 */
async function loadProjects() {
    if (!window.currentUser) return;

    try {
        window.allProjects = await window.projectService.getProjects(window.currentUser.id);

        // Render projects
        if (typeof renderProjects === 'function') {
            renderProjects(window.allProjects);
        }

        console.log(`✅ Loaded ${window.allProjects.length} projects`);
    } catch (err) {
        console.error('❌ Error loading projects:', err);
    }
}

/**
 * Load all notes for current user
 */
async function loadNotes() {
    if (!window.currentUser) return;

    try {
        window.allNotes = await window.noteService.getNotes(window.currentUser.id);

        // Render notes
        if (typeof renderNotes === 'function') {
            renderNotes(window.allNotes);
        }

        console.log(`✅ Loaded ${window.allNotes.length} notes`);
    } catch (err) {
        console.error('❌ Error loading notes:', err);
    }
}

/**
 * Load all contacts for current user
 */
async function loadContacts() {
    if (!window.currentUser) return;

    try {
        window.allContacts = await window.contactService.getContacts(window.currentUser.id);

        // Render contacts
        if (typeof renderContacts === 'function') {
            renderContacts(window.allContacts);
        }

        console.log(`✅ Loaded ${window.allContacts.length} contacts`);
    } catch (err) {
        console.error('❌ Error loading contacts:', err);
    }
}

/**
 * Load all learning courses for current user
 */
async function loadCourses() {
    if (!window.currentUser) return;

    try {
        window.allCourses = await window.learningService.getCourses(window.currentUser.id);

        // Render courses
        if (typeof renderCourses === 'function') {
            renderCourses(window.allCourses);
        }

        console.log(`✅ Loaded ${window.allCourses.length} courses`);
    } catch (err) {
        console.error('❌ Error loading courses:', err);
    }
}

/**
 * Load agent activities for current user
 */
async function loadAgentActivities() {
    if (!window.currentUser) return;

    try {
        window.allAgentActivities = await getAgentActivities(50);

        // Render agent activities if function exists
        if (typeof renderAgentActivities === 'function') {
            renderAgentActivities(window.allAgentActivities);
        }

        console.log(`✅ Loaded ${window.allAgentActivities.length} agent activities`);
    } catch (err) {
        console.error('❌ Error loading agent activities:', err);
    }
}

/**
 * Load task statistics
 */
async function loadStats() {
    if (!window.currentUser) return;

    try {
        const stats = await window.taskService.getStats(window.currentUser.id);

        // Update stats in UI if elements exist
        const statTotal = document.getElementById('stat-total');
        const statActive = document.getElementById('stat-active');
        const statCompleted = document.getElementById('stat-completed');
        const statRate = document.getElementById('stat-rate');

        if (statTotal) statTotal.textContent = stats.total;
        if (statActive) statActive.textContent = stats.active;
        if (statCompleted) statCompleted.textContent = stats.completed;
        if (statRate) statRate.textContent = stats.completionRate + '%';

        console.log('✅ Stats loaded:', stats);
    } catch (err) {
        console.error('❌ Error loading stats:', err);
    }
}

// ============= COMPREHENSIVE DATA LOAD =============

/**
 * Load all data in parallel for faster initial load
 */
async function loadAllData() {
    console.log('📥 Loading all data...');

    const startTime = Date.now();

    try {
        // Load all data in parallel
        await Promise.all([
            loadTasks(),
            loadProjects(),
            loadNotes(),
            loadContacts(),
            loadCourses(),
            loadAgentActivities(),
            loadStats()
        ]);

        const loadTime = Date.now() - startTime;
        console.log(`✅ All data loaded in ${loadTime}ms`);

        // Show success toast
        if (typeof showToast === 'function') {
            showToast(`✅ Dashboard loaded (${loadTime}ms)`);
        }
    } catch (err) {
        console.error('❌ Error loading data:', err);
        alert('Error loading dashboard data. Please refresh.');
    }
}

// ============= REAL-TIME SUBSCRIPTIONS =============

/**
 * Setup real-time subscriptions for live updates
 */
function setupRealtimeSubscriptions() {
    if (!window.supabaseClient || !window.currentUser) return;

    try {
        // Subscribe to tasks changes
        const tasksChannel = window.supabaseClient
            .channel('tasks-changes')
            .on('postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'tasks',
                    filter: `user_id=eq.${window.currentUser.id}`
                },
                (payload) => {
                    console.log('🔔 Tasks changed:', payload);
                    loadTasks();
                    loadStats();
                }
            )
            .subscribe();

        // Subscribe to projects changes
        const projectsChannel = window.supabaseClient
            .channel('projects-changes')
            .on('postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'projects',
                    filter: `user_id=eq.${window.currentUser.id}`
                },
                (payload) => {
                    console.log('🔔 Projects changed:', payload);
                    loadProjects();
                }
            )
            .subscribe();

        // Subscribe to notes changes
        const notesChannel = window.supabaseClient
            .channel('notes-changes')
            .on('postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'notes',
                    filter: `user_id=eq.${window.currentUser.id}`
                },
                (payload) => {
                    console.log('🔔 Notes changed:', payload);
                    loadNotes();
                }
            )
            .subscribe();

        // Subscribe to contacts changes
        const contactsChannel = window.supabaseClient
            .channel('contacts-changes')
            .on('postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'contacts',
                    filter: `user_id=eq.${window.currentUser.id}`
                },
                (payload) => {
                    console.log('🔔 Contacts changed:', payload);
                    loadContacts();
                }
            )
            .subscribe();

        // Subscribe to learning courses changes
        const coursesChannel = window.supabaseClient
            .channel('courses-changes')
            .on('postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'learning_courses',
                    filter: `user_id=eq.${window.currentUser.id}`
                },
                (payload) => {
                    console.log('🔔 Courses changed:', payload);
                    loadCourses();
                }
            )
            .subscribe();

        // Subscribe to agent activities
        const activitiesChannel = window.supabaseClient
            .channel('activities-changes')
            .on('postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'agent_activities',
                    filter: `user_id=eq.${window.currentUser.id}`
                },
                (payload) => {
                    console.log('🔔 New agent activity:', payload);
                    loadAgentActivities();

                    // Show toast for new activity
                    if (typeof showToast === 'function' && payload.new) {
                        showToast(`🤖 ${payload.new.agent_name}: ${payload.new.action}`);
                    }
                }
            )
            .subscribe();

        console.log('✅ Real-time subscriptions active');

        // Store channels for cleanup
        window.realtimeChannels = {
            tasksChannel,
            projectsChannel,
            notesChannel,
            contactsChannel,
            coursesChannel,
            activitiesChannel
        };

    } catch (err) {
        console.error('❌ Error setting up real-time:', err);
    }
}

/**
 * Cleanup real-time subscriptions
 */
function cleanupRealtimeSubscriptions() {
    if (window.realtimeChannels) {
        Object.values(window.realtimeChannels).forEach(channel => {
            if (channel) channel.unsubscribe();
        });
        console.log('✅ Real-time subscriptions cleaned up');
    }
}

// ============= MAIN INITIALIZATION =============

// Prevent multiple initializations
let dashboardInitialized = false;

/**
 * Initialize the entire dashboard
 */
async function initDashboard() {
    // Prevent double initialization
    if (dashboardInitialized) {
        console.log('⚠️ Dashboard already initialized, skipping');
        return;
    }

    console.log('🚀 JadiSatu OS Dashboard Initializing...');

    try {
        // 1. Auth guard - redirect if not authenticated
        window.currentUser = await setupAuthGuard('login.html');
        if (!window.currentUser) {
            console.log('❌ No authenticated user, redirecting to login');
            return;
        }

        console.log('✅ User authenticated:', window.currentUser.email);

        // 2. Update user info in UI
        updateUserUI(window.currentUser);

        // Update sidebar user info
        const nameEl = document.getElementById('sidebar-user-name');
        const avatarEl = document.getElementById('sidebar-user-avatar');
        if (nameEl && window.currentUser.email) {
            const name = window.currentUser.email.split('@')[0];
            nameEl.textContent = name.charAt(0).toUpperCase() + name.slice(1).replace(/[0-9]/g, '') || 'User';
        }
        if (avatarEl && window.currentUser.email) {
            avatarEl.textContent = window.currentUser.email.substring(0, 2).toUpperCase();
        }

        // 3. Initialize all services
        if (!initServices()) {
            throw new Error('Failed to initialize services');
        }

        // 4. Load all data in parallel
        await loadAllData();

        // 5. Setup real-time subscriptions
        setupRealtimeSubscriptions();

        // 6. Initialize Lucide icons
        if (typeof lucide !== 'undefined' && lucide.createIcons) {
            lucide.createIcons();
        }

        // Mark as initialized
        dashboardInitialized = true;
        console.log('✅ Dashboard fully initialized');

    } catch (err) {
        console.error('❌ Dashboard initialization failed:', err);
        dashboardInitialized = false; // Reset flag on error
        alert('Failed to initialize dashboard. Please try logging in again.');
        window.location.replace('login.html'); // Use replace to avoid back button loop
    }
}

// ============= CLEANUP ON LOGOUT =============

/**
 * Enhanced logout with cleanup
 */
async function logoutDashboard() {
    try {
        // Cleanup real-time subscriptions
        cleanupRealtimeSubscriptions();

        // Clear cached data
        window.allTasks = [];
        window.allProjects = [];
        window.allNotes = [];
        window.allContacts = [];
        window.allCourses = [];
        window.allAgentActivities = [];
        window.currentUser = null;
        window.currentProjectId = null;

        // Call auth logout
        await logout('login.html');

    } catch (err) {
        console.error('Error during logout:', err);
        // Force redirect anyway
        window.location.href = 'login.html';
    }
}

// ============= AUTO-INITIALIZE ON LOAD =============

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDashboard);
} else {
    initDashboard();
}
