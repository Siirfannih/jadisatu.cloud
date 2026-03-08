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
 * Update Overview header date + greeting so it stays accurate over time.
 * Called on init, every minute, dan saat tab kembali aktif.
 */
function updateDateHeader() {
    if (typeof document === 'undefined') return;
    var now = new Date();
    var dateEl = document.getElementById('overview-today-date');
    if (dateEl) {
        try {
            dateEl.textContent = now.toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });
        } catch (e) {
            // Fallback sederhana kalau locale tidak tersedia
            dateEl.textContent = now.getDate() + '/' + (now.getMonth() + 1) + '/' + now.getFullYear();
        }
    }

    var greetingEl = document.getElementById('greeting-text');
    if (greetingEl) {
        var hour = now.getHours();
        var greeting = 'Selamat Malam';
        if (hour >= 5 && hour < 11) greeting = 'Selamat Pagi';
        else if (hour >= 11 && hour < 15) greeting = 'Selamat Siang';
        else if (hour >= 15 && hour < 19) greeting = 'Selamat Sore';
        greetingEl.textContent = greeting;
    }
}

// Jadwalkan update berkala + saat tab kembali aktif
if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', function () {
        if (!document.hidden) {
            updateDateHeader();
        }
    });
    // Update setiap 1 menit
    setInterval(updateDateHeader, 60000);
}

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
    if (typeof UserProfileService !== 'undefined') {
        window.userProfileService = new UserProfileService(window.supabaseClient);
    }

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
        if (typeof window.syncSidebarMetrics === 'function') {
            window.syncSidebarMetrics();
        }

        // Render domain split tasks for dashboard
        if (typeof renderDomainTasks === 'function') {
            renderDomainTasks('work', window.allTasks.filter(t => t.domain === 'work'));
            renderDomainTasks('business', window.allTasks.filter(t => t.domain === 'business'));
            renderDomainTasks('learn', window.allTasks.filter(t => t.domain === 'learn'));
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

        // Render domain split projects for dashboard
        if (typeof renderDomainProjects === 'function') {
            renderDomainProjects('work', window.allProjects.filter(p => p.domain === 'work'));
            renderDomainProjects('business', window.allProjects.filter(p => p.domain === 'business'));
            renderDomainProjects('learn', window.allProjects.filter(p => p.domain === 'learn'));
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

        // Enrich projects with task counts from allTasks (untuk progress 2/5, navbar, dll)
        if (window.allProjects && window.allTasks) {
            window.allProjects.forEach(function (p) {
                var projectTasks = window.allTasks.filter(function (t) { return t.project_id === p.id; });
                p.tasks_total = projectTasks.length;
                p.tasks_completed = projectTasks.filter(function (t) { var s = (t.status || '').toLowerCase(); return s === 'completed' || s === 'done'; }).length;
                p.progress = p.tasks_total ? Math.round((p.tasks_completed / p.tasks_total) * 100) : 0;
            });
        }
        // Refresh focus and learning views (Overview + Focus/Learn pages)
        if (typeof refreshFocusView === 'function') refreshFocusView();
        if (typeof refreshLearningView === 'function') refreshLearningView();
        if (typeof window.syncSidebarMetrics === 'function') window.syncSidebarMetrics();
        if (typeof renderProjects === 'function' && window.allProjects) renderProjects(window.allProjects);
        if (typeof renderDomainProjects === 'function' && window.allProjects) {
            renderDomainProjects('work', window.allProjects.filter(function (p) { return (p.domain || '').toLowerCase() === 'work'; }));
            renderDomainProjects('learn', window.allProjects.filter(function (p) { return (p.domain || '').toLowerCase() === 'learn'; }));
            renderDomainProjects('business', window.allProjects.filter(function (p) { return (p.domain || '').toLowerCase() === 'business'; }));
        }
        // Isi overview agar tidak tetap "Memuat..."
        if (typeof window.loadOverviewData === 'function') window.loadOverviewData();

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

        if (!window.appCache) {
            window.appCache = { tasks: [], projects: [], contacts: [], notes: [], learningCourses: [], agentActivities: [] };
        }

        // 2. Update user info in UI
        updateUserUI(window.currentUser);

        // 3. Initialize all services (before profile fetch so userProfileService exists)
        if (!initServices()) {
            throw new Error('Failed to initialize services');
        }

        if (typeof MorningBriefingService !== 'undefined' && window.supabaseClient) {
            window.morningBriefingSvc = new MorningBriefingService(window.supabaseClient);
        }
        if (typeof CreativeContentService !== 'undefined' && window.supabaseClient) {
            window.creativeContentSvc = new CreativeContentService(window.supabaseClient);
        }

        // 3b. Update header date + greeting
        updateDateHeader();

        // 4. Load all data in parallel
        await loadAllData();

        if (window.appCache) {
            window.appCache.tasks = window.allTasks || [];
            window.appCache.projects = window.allProjects || [];
            window.appCache.contacts = window.allContacts || [];
            window.appCache.notes = window.allNotes || [];
            window.appCache.agentActivities = window.allAgentActivities || [];
        }
        if (typeof window.renderNotifications === 'function') {
            window.renderNotifications();
        }
        if (!window._notificationIntervalSet) {
            window._notificationIntervalSet = true;
            setInterval(function () {
                if (typeof window.renderNotifications === 'function') window.renderNotifications();
            }, 300000);
            document.addEventListener('visibilitychange', function () {
                if (!document.hidden && typeof window.renderNotifications === 'function') window.renderNotifications();
            });
        }

        // 4b. User profile (Welcome) — pakai display_name di sidebar jika sudah isi; jika belum, tampilkan modal Welcome
        let userProfile = null;
        const nameEl = document.getElementById('sidebar-user-name');
        const avatarEl = document.getElementById('sidebar-user-avatar');
        if (window.userProfileService) {
            try {
                userProfile = await window.userProfileService.getProfile(window.currentUser.id);
            } catch (e) {
                console.warn('Profile fetch failed:', e);
            }
        }
        if (userProfile && userProfile.display_name) {
            if (nameEl) nameEl.textContent = userProfile.display_name;
            if (avatarEl) avatarEl.textContent = (userProfile.display_name.substring(0, 2) || 'U').toUpperCase();
        } else if (nameEl && window.currentUser.email) {
            const name = window.currentUser.email.split('@')[0];
            nameEl.textContent = name.charAt(0).toUpperCase() + name.slice(1).replace(/[0-9]/g, '') || 'User';
            if (avatarEl) avatarEl.textContent = window.currentUser.email.substring(0, 2).toUpperCase();
        }

        // 5. Setup real-time subscriptions
        setupRealtimeSubscriptions();

        // 6. Initialize Lucide icons
        if (typeof lucide !== 'undefined' && lucide.createIcons) {
            lucide.createIcons();
        }

        // Mark as initialized
        dashboardInitialized = true;
        console.log('✅ Dashboard fully initialized');

        // 7. Apply initial view from URL hash (e.g. dashboard.html#kanban -> show Kanban)
        applyInitialViewFromHash();

        // 8. If Overview (home) is visible, load its data from Supabase
        const hash = (typeof location !== 'undefined' && location.hash) ? location.hash.replace(/^#/, '') : '';
        if (hash === '' || hash === 'home') {
            if (typeof window.loadOverviewData === 'function') window.loadOverviewData();
        }

        // 8b. Bind Overview header: domain filter buttons + Quick add + Notifications
        if (typeof window.initOverviewDomainFilter === 'function') window.initOverviewDomainFilter();
        if (typeof window.initOverviewHeaderActions === 'function') window.initOverviewHeaderActions();

        // 9. Welcome user (untuk yang belum isi) atau Morning Briefing (sekali per hari, pertama buka)
        if (!userProfile) {
            if (document.getElementById('welcome-user-modal')) {
                document.getElementById('welcome-user-modal').classList.remove('hidden');
            }
        }
        // Morning Briefing: tampil otomatis pertama kali user buka website di hari tersebut (cek localStorage briefingDate)
        if (typeof window.showMorningBriefing === 'function') {
            setTimeout(window.showMorningBriefing, 500);
        }

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

// ============= HASH-BASED DIRECT VIEW =============

/**
 * When opening dashboard with hash (e.g. dashboard.html#kanban), show that view immediately.
 * Used when navigating from Projects / Notes / etc. so user lands on the correct view.
 * Also run when hash changes (e.g. user clicks Kanban in sidebar while already on dashboard).
 */
function applyInitialViewFromHash() {
    var hash = (typeof location !== 'undefined' && location.hash) ? location.hash.replace(/^#/, '') : '';
    if (!hash) return;
    var viewEl = document.getElementById('view-' + hash);
    if (viewEl && typeof window.switchView === 'function') {
        window.switchView(hash, null);
    }
}

// When URL hash changes (e.g. dashboard.html#kanban -> #crm), switch view without reload
if (typeof window !== 'undefined') {
    window.addEventListener('hashchange', applyInitialViewFromHash);
}

// ============= AUTO-INITIALIZE ON LOAD =============

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDashboard);
} else {
    initDashboard();
}
