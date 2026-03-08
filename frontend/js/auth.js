// Authentication Module
let currentUser = null;

// Initialize authentication on page load
async function initAuth() {
  console.log('[AUTH] Initializing authentication...');

  try {
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) throw error;

    if (!session) {
      console.log('[AUTH] No session found, redirecting to login');
      window.location.href = '/login.html';
      return false;
    }

    currentUser = session.user;
    console.log('[AUTH] User authenticated:', currentUser.email);

    // Set up auth state listener
    setupAuthListener();

    return true;

  } catch (error) {
    console.error('[AUTH] Init error:', error);
    window.location.href = '/login.html';
    return false;
  }
}

// Set up authentication state listener
function setupAuthListener() {
  supabase.auth.onAuthStateChange((event, session) => {
    console.log('[AUTH] State change:', event);

    if (event === 'SIGNED_OUT') {
      currentUser = null;
      window.location.href = '/login.html';
    } else if (event === 'SIGNED_IN' && session) {
      currentUser = session.user;
      console.log('[AUTH] User signed in:', currentUser.email);
    } else if (event === 'TOKEN_REFRESHED') {
      console.log('[AUTH] Token refreshed');
      currentUser = session.user;
    }
  });
}

// Sign out function
async function signOut() {
  console.log('[AUTH] Signing out...');

  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;

    currentUser = null;
    window.location.href = '/login.html';

  } catch (error) {
    console.error('[AUTH] Signout error:', error);
    showToast('Failed to sign out', 'error');
  }
}

// Get current user
function getCurrentUser() {
  return currentUser;
}

// Check if user is authenticated
function isAuthenticated() {
  return currentUser !== null;
}
