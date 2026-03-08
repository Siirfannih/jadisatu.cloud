/**
 * Auth Helper - Authentication utilities for Supabase
 *
 * Usage:
 * const user = await getCurrentUser();
 * setupAuthGuard(); // Redirects if not authenticated
 */

/**
 * Global Supabase client - must be initialized before using auth helpers
 * Set this in your main HTML file:
 * window.supabaseClient = supabase.createClient(url, key);
 */

/**
 * Get current authenticated user (with forced refresh option)
 * @param {boolean} forceRefresh - Force refresh the session from server
 * @returns {Promise<object|null>} User object or null
 */
async function getCurrentUser(forceRefresh = false) {
    try {
        if (!window.supabaseClient) {
            throw new Error('Supabase client not initialized');
        }

        // Try to refresh session from server if requested
        if (forceRefresh) {
            console.log('🔄 Forcing session refresh from server...');
            const { data, error: refreshError } = await window.supabaseClient.auth.refreshSession();

            if (!refreshError && data.session) {
                console.log('✅ Session refreshed successfully:', data.session.user.email);
                return data.session.user;
            }
            console.log('⚠️ Refresh failed, falling back to getSession');
        }

        const { data: { session }, error } = await window.supabaseClient.auth.getSession();

        if (error) {
            console.error('❌ Auth error:', error);
            return null;
        }

        if (!session) {
            console.log('ℹ️  No active session');
            return null;
        }

        console.log('✅ User authenticated:', session.user.email);
        return session.user;

    } catch (error) {
        console.error('❌ Error getting current user:', error);
        return null;
    }
}

/**
 * Setup auth guard - redirect to login if not authenticated
 * Call this at the start of protected pages
 * @param {string} loginUrl - URL to redirect to if not authenticated (default: /login.html)
 * @param {number} retries - Number of retry attempts (default: 5)
 * @returns {Promise<object>} Current user if authenticated
 */
async function setupAuthGuard(loginUrl = '/login.html', retries = 5) {
    try {
        window.DebugLogger && window.DebugLogger.log('DASHBOARD: Auth guard starting', { loginUrl, retries });

        // Try multiple times with delay to handle session propagation
        for (let attempt = 1; attempt <= retries; attempt++) {
            // First 2 attempts: try force refresh from server
            const forceRefresh = (attempt <= 2);
            const user = await getCurrentUser(forceRefresh);

            if (user) {
                console.log(`✅ Auth guard passed (attempt ${attempt}/${retries})`);
                window.DebugLogger && window.DebugLogger.log('DASHBOARD: Auth guard passed', { attempt, email: user.email });
                return user;
            }

            // If not last attempt, wait before retry with consistent 800ms delay
            if (attempt < retries) {
                const delay = 800; // Consistent 800ms between retries
                console.log(`⏳ Session not ready, retrying in ${delay}ms... (${attempt}/${retries})`);
                window.DebugLogger && window.DebugLogger.log('DASHBOARD: Retrying auth check', { attempt, delay });
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        // All retries failed
        console.log('🔒 Not authenticated after retries, redirecting to login...');
        window.DebugLogger && window.DebugLogger.log('DASHBOARD: No session after retries, redirecting to login');

        // Track redirect with loop breaker
        if (window.LoopBreaker && window.LoopBreaker.track('dashboard.html', 'login.html')) {
            console.error('🚨 Loop detected, stopping redirect');
            return null; // Loop detected, stop
        }

        window.location.replace(loginUrl);
        return null;

    } catch (error) {
        console.error('❌ Auth guard error:', error);
        window.DebugLogger && window.DebugLogger.log('DASHBOARD: Auth guard error', error);

        // Track redirect with loop breaker
        if (window.LoopBreaker && window.LoopBreaker.track('dashboard.html', 'login.html')) {
            console.error('🚨 Loop detected, stopping redirect');
            return null; // Loop detected, stop
        }

        window.location.replace(loginUrl);
        return null;
    }
}

/**
 * Logout current user
 * @param {string} redirectUrl - URL to redirect after logout (default: /login.html)
 * @returns {Promise<boolean>} Success status
 */
async function logout(redirectUrl = '/login.html') {
    try {
        if (!window.supabaseClient) {
            throw new Error('Supabase client not initialized');
        }

        const { error } = await window.supabaseClient.auth.signOut();

        if (error) throw error;

        console.log('✅ Logged out successfully');
        window.location.replace(redirectUrl);
        return true;

    } catch (error) {
        console.error('❌ Logout error:', error);
        alert('Error logging out: ' + error.message);
        return false;
    }
}

/**
 * Setup auth state listener
 * Listens for auth state changes (login, logout, session expired)
 * @param {function} callback - Callback function(event, session)
 */
function setupAuthListener(callback) {
    if (!window.supabaseClient) {
        console.error('❌ Supabase client not initialized');
        return null;
    }

    const { data: { subscription } } = window.supabaseClient.auth.onAuthStateChange((event, session) => {
        console.log('🔔 Auth state changed:', event);

        if (event === 'SIGNED_OUT') {
            window.location.replace('/login.html');
        }

        if (callback) {
            callback(event, session);
        }
    });

    return subscription;
}

/**
 * Update user info in UI
 * Updates elements with specific IDs: user-email, user-name, user-initials
 * @param {object} user - User object from Supabase
 */
function updateUserUI(user) {
    if (!user || !user.email) return;

    // Update email
    const emailEl = document.getElementById('user-email');
    if (emailEl) {
        emailEl.textContent = user.email;
    }

    // Update name (extract from email)
    const nameEl = document.getElementById('user-name');
    if (nameEl && user.email) {
        const emailName = user.email.split('@')[0];
        const displayName = emailName.charAt(0).toUpperCase() +
                          emailName.slice(1).replace(/[0-9]/g, '');
        nameEl.textContent = displayName || 'User';
    }

    // Update initials
    const initialsEl = document.getElementById('user-initials');
    if (initialsEl && user.email) {
        const emailName = user.email.split('@')[0];
        const initials = emailName.substring(0, 2).toUpperCase();
        initialsEl.textContent = initials;
    }

    console.log('✅ User UI updated');
}

/**
 * Check if user is authenticated (synchronous check from localStorage)
 * Note: This is less reliable than async getCurrentUser()
 * @returns {boolean} True if appears to be authenticated
 */
function isAuthenticated() {
    // Check for session in localStorage
    const session = localStorage.getItem('supabase.auth.token');
    return !!session;
}

// Export functions
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getCurrentUser,
        setupAuthGuard,
        logout,
        setupAuthListener,
        updateUserUI,
        isAuthenticated
    };
}
