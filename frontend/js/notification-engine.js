/**
 * Notification engine sederhana berbasis appCache.* dan localStorage.
 * Semua fungsi global (window scope), ES5-compatible.
 */
(function () {
    function todayIso() {
        return new Date().toISOString().split('T')[0];
    }

    function isSameDateIso(d1, d2) {
        return String(d1).split('T')[0] === String(d2).split('T')[0];
    }

    function generateNotifications() {
        var notifications = [];
        var tasks = (window.appCache && window.appCache.tasks) || (window.allTasks) || [];
        var contacts = (window.appCache && window.appCache.contacts) || (window.allContacts) || [];
        var today = todayIso();

        // Task Overdue
        tasks.forEach(function (t) {
            if (!t.due_date || !t.status) return;
            var status = String(t.status).toLowerCase();
            if (status === 'done' || status === 'completed') return;
            var due = String(t.due_date).split('T')[0];
            if (due < today) {
                notifications.push({
                    type: 'warning',
                    icon: 'alert-triangle',
                    title: 'Task Overdue',
                    message: '"' + (t.title || 'Untitled task') + '" sudah lewat deadline'
                });
            }
        });

        // Task Due Today
        tasks.forEach(function (t) {
            if (!t.due_date || !t.status) return;
            var status = String(t.status).toLowerCase();
            if (status === 'done' || status === 'completed') return;
            var due = String(t.due_date).split('T')[0];
            if (due === today) {
                notifications.push({
                    type: 'info',
                    icon: 'clock',
                    title: 'Deadline Hari Ini',
                    message: '"' + (t.title || 'Untitled task') + '" harus selesai hari ini'
                });
            }
        });

        // Follow-up Reminder (contacts.follow_up_date / next_followup_date)
        contacts.forEach(function (c) {
            var follow = c.follow_up_date || c.next_followup_date;
            if (!follow) return;
            var d = String(follow).split('T')[0];
            if (d <= today) {
                notifications.push({
                    type: 'info',
                    icon: 'user-check',
                    title: 'Follow-up Reminder',
                    message: 'Waktunya follow-up ' + (c.name || 'kontak tanpa nama')
                });
            }
        });

        // No Briefing Today
        try {
            var lsDate = window.localStorage ? localStorage.getItem('briefingDate') : null;
            if (lsDate !== new Date().toDateString()) {
                notifications.push({
                    type: 'reminder',
                    icon: 'sun',
                    title: 'Morning Briefing',
                    message: 'Belum isi morning briefing hari ini'
                });
            }
        } catch (e) {
        }

        return notifications;
    }

    function renderNotifications() {
        var listEl = document.getElementById('notifications-list');
        var dotEl = document.getElementById('header-notifications-dot');
        if (!listEl) return;

        var notifs = generateNotifications();
        if (!notifs.length) {
            listEl.innerHTML = '<p class="text-xs text-gray-500 text-center py-4">Tidak ada notifikasi baru.</p>';
            if (dotEl) dotEl.classList.add('hidden');
        } else {
            var html = notifs.map(function (n) {
                var style = '';
                var iconColor = 'text-accent';
                if (n.type === 'warning') {
                    style = 'border-l-2 border-warning bg-warning/5';
                    iconColor = 'text-warning';
                } else if (n.type === 'info') {
                    style = 'border-l-2 border-accent bg-accent/5';
                    iconColor = 'text-accent';
                } else if (n.type === 'reminder') {
                    style = 'border-l-2 border-learn bg-learn/5';
                    iconColor = 'text-learn-light';
                }
                return '' +
                    '<div class="p-3 rounded-lg ' + style + ' flex items-start gap-3">' +
                    '  <i data-lucide="' + (n.icon || 'info') + '" class="w-4 h-4 mt-0.5 ' + iconColor + '"></i>' +
                    '  <div>' +
                    '    <p class="text-xs font-semibold text-white">' + (n.title || '') + '</p>' +
                    '    <p class="text-[11px] text-gray-400 mt-0.5">' + (n.message || '') + '</p>' +
                    '  </div>' +
                    '</div>';
            }).join('');
            listEl.innerHTML = html;
            if (dotEl) dotEl.classList.remove('hidden');
        }

        if (typeof lucide !== 'undefined' && lucide.createIcons) {
            lucide.createIcons();
        }
    }

    // Global exports
    window.generateNotifications = generateNotifications;
    window.renderNotifications = renderNotifications;

    // Clear button handler (if exists)
    if (typeof document !== 'undefined') {
        var btn = document.getElementById('notifications-clear-btn');
        if (btn) {
            btn.addEventListener('click', function () {
                var listEl = document.getElementById('notifications-list');
                if (listEl) {
                    listEl.innerHTML = '<p class="text-xs text-gray-500 text-center py-4">Tidak ada notifikasi baru.</p>';
                }
                var dotEl = document.getElementById('header-notifications-dot');
                if (dotEl) dotEl.classList.add('hidden');
            });
        }
    }
})();

