/**
 * Sidebar collapse toggle for workspace pages and dashboard.
 * Expects: aside with id="workspace-sidebar" or id="dashboard-sidebar", and a button with id="sidebar-toggle-btn".
 * Uses localStorage key: jadisatu_sidebar_collapsed ('true' | 'false')
 */
(function () {
    var STORAGE_KEY = 'jadisatu_sidebar_collapsed';
    var COLLAPSED_CLASS = 'sidebar-collapsed';

    function getSidebar() {
        return document.getElementById('workspace-sidebar') || document.getElementById('dashboard-sidebar');
    }

    function getToggleBtn() {
        return document.getElementById('sidebar-toggle-btn');
    }

    function isCollapsed() {
        return localStorage.getItem(STORAGE_KEY) === 'true';
    }

    function setCollapsed(collapsed) {
        var sidebar = getSidebar();
        if (!sidebar) return;
        if (collapsed) {
            sidebar.classList.add(COLLAPSED_CLASS);
        } else {
            sidebar.classList.remove(COLLAPSED_CLASS);
        }
        localStorage.setItem(STORAGE_KEY, collapsed ? 'true' : 'false');
        var btn = getToggleBtn();
        if (btn) {
            var icon = btn.querySelector('[data-sidebar-toggle-icon]');
            var label = btn.querySelector('[data-sidebar-toggle-label]');
            if (icon) icon.setAttribute('data-lucide', collapsed ? 'panel-right-open' : 'panel-left-close');
            if (label) label.textContent = collapsed ? 'Expand' : 'Sembunyikan';
            if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
        }
    }

    function toggleSidebar() {
        var sidebar = getSidebar();
        if (!sidebar) return;
        var collapsed = !sidebar.classList.contains(COLLAPSED_CLASS);
        setCollapsed(collapsed);
    }

    function init() {
        var sidebar = getSidebar();
        if (!sidebar) return;
        var collapsed = isCollapsed();
        setCollapsed(collapsed);

        var btn = getToggleBtn();
        if (btn) btn.addEventListener('click', toggleSidebar);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.toggleWorkspaceSidebar = toggleSidebar;
})();
