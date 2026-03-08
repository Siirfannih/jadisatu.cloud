// UI Helper Functions

// ===== TOAST NOTIFICATIONS =====
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `fixed bottom-6 right-6 px-4 py-3 rounded-lg glass-strong animate-slide-up z-50 ${
    type === 'error' ? 'border-l-4 border-danger' :
    type === 'success' ? 'border-l-4 border-success' :
    type === 'warning' ? 'border-l-4 border-warning' :
    'border-l-4 border-work'
  }`;

  const icon = type === 'error' ? 'alert-circle' :
               type === 'success' ? 'check-circle' :
               type === 'warning' ? 'alert-triangle' :
               'info';

  const iconColor = type === 'error' ? 'text-danger' :
                   type === 'success' ? 'text-success' :
                   type === 'warning' ? 'text-warning' :
                   'text-work-light';

  toast.innerHTML = `
    <div class="flex items-center gap-3">
      <i data-lucide="${icon}" class="w-5 h-5 ${iconColor}"></i>
      <span class="text-white text-sm">${message}</span>
    </div>
  `;

  document.body.appendChild(toast);
  lucide.createIcons();

  setTimeout(() => {
    toast.remove();
  }, 4000);
}

// ===== LOADING STATES =====
let loadingOverlay = null;

function showLoading(message = 'Loading...') {
  if (loadingOverlay) return; // Already showing

  loadingOverlay = document.createElement('div');
  loadingOverlay.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50';
  loadingOverlay.innerHTML = `
    <div class="glass-strong rounded-2xl p-8 flex flex-col items-center gap-4">
      <div class="w-12 h-12 border-4 border-work border-t-transparent rounded-full animate-spin"></div>
      <span class="text-white text-sm">${message}</span>
    </div>
  `;

  document.body.appendChild(loadingOverlay);
}

function hideLoading() {
  if (loadingOverlay) {
    loadingOverlay.remove();
    loadingOverlay = null;
  }
}

// ===== MODALS =====
function showModal(title, content, actions = []) {
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4';
  modal.id = 'custom-modal';

  const actionsHTML = actions.map(action => `
    <button onclick="${action.onclick}"
      class="px-4 py-2 rounded-lg ${action.primary ? 'bg-work hover:bg-work-light text-white' : 'bg-white/5 hover:bg-white/10 text-gray-300'} transition-all">
      ${action.label}
    </button>
  `).join('');

  modal.innerHTML = `
    <div class="glass-strong rounded-2xl p-6 max-w-md w-full animate-slide-up">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-white">${title}</h3>
        <button onclick="closeModal()" class="text-gray-400 hover:text-white transition-colors">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </div>
      <div class="text-gray-300 text-sm mb-6">
        ${content}
      </div>
      <div class="flex gap-3 justify-end">
        ${actionsHTML}
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  lucide.createIcons();

  // Close on background click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
}

function closeModal() {
  const modal = document.getElementById('custom-modal');
  if (modal) modal.remove();
}

// ===== CONFIRM DIALOG =====
function confirmDialog(message, onConfirm, onCancel = null) {
  showModal(
    'Confirm Action',
    message,
    [
      {
        label: 'Cancel',
        primary: false,
        onclick: `closeModal(); ${onCancel ? `(${onCancel})()` : ''}`
      },
      {
        label: 'Confirm',
        primary: true,
        onclick: `closeModal(); (${onConfirm})()`
      }
    ]
  );
}

// ===== ERROR HANDLING =====
async function handleError(error, userMessage = 'Something went wrong') {
  console.error('[ERROR]', error);
  showToast(userMessage, 'error');

  // Log to console for debugging
  if (error.message) {
    console.error('Error message:', error.message);
  }
  if (error.stack) {
    console.error('Stack trace:', error.stack);
  }
}

// ===== SAFE ASYNC WRAPPER =====
async function safeAsync(fn, errorMessage = 'Operation failed') {
  try {
    return await fn();
  } catch (error) {
    await handleError(error, errorMessage);
    return null;
  }
}

// ===== FORMAT HELPERS =====
function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function formatDateTime(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatTimeAgo(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateString);
}

// ===== DOMAIN HELPERS =====
function getDomainColor(domain) {
  const colors = {
    work: 'text-work-light',
    learn: 'text-learn-light',
    business: 'text-business-light',
    personal: 'text-personal-light'
  };
  return colors[domain] || 'text-gray-400';
}

function getDomainBgColor(domain) {
  const colors = {
    work: 'bg-work/10 border-work/30',
    learn: 'bg-learn/10 border-learn/30',
    business: 'bg-business/10 border-business/30',
    personal: 'bg-personal/10 border-personal/30'
  };
  return colors[domain] || 'bg-gray-500/10 border-gray-500/30';
}

function getDomainIcon(domain) {
  const icons = {
    work: 'briefcase',
    learn: 'graduation-cap',
    business: 'dollar-sign',
    personal: 'user'
  };
  return icons[domain] || 'circle';
}

// ===== EMPTY STATE =====
function showEmptyState(containerId, icon, title, message, actionLabel = null, actionFn = null) {
  const container = document.getElementById(containerId);
  if (!container) return;

  let actionHTML = '';
  if (actionLabel && actionFn) {
    actionHTML = `
      <button onclick="${actionFn}" class="mt-4 px-4 py-2 bg-work hover:bg-work-light text-white rounded-lg text-sm transition-all">
        ${actionLabel}
      </button>
    `;
  }

  container.innerHTML = `
    <div class="flex flex-col items-center justify-center py-16 text-center">
      <div class="w-16 h-16 rounded-2xl bg-gray-800/50 flex items-center justify-center mb-4">
        <i data-lucide="${icon}" class="w-8 h-8 text-gray-600"></i>
      </div>
      <h3 class="text-lg font-semibold text-white mb-2">${title}</h3>
      <p class="text-sm text-gray-400 max-w-sm">${message}</p>
      ${actionHTML}
    </div>
  `;

  lucide.createIcons();
}

// ===== ESCAPE HTML =====
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ===== DEBOUNCE =====
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
