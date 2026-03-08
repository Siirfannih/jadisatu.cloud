/**
 * Sidebar metrics (Life Balance bar + domain labels) for all workspace pages.
 * Expects: window.allTasks (array). Call syncSidebarMetrics() after tasks are loaded.
 * Sidebar HTML must have IDs: sidebar-life-balance-pct, sidebar-bar-work, sidebar-bar-learn,
 * sidebar-bar-business, sidebar-domain-work, sidebar-domain-learn, sidebar-domain-business.
 */
(function () {
    function syncSidebarMetrics() {
        var tasks = window.allTasks || [];
        var active = tasks.filter(function (t) { var s = (t.status || '').toLowerCase(); return s !== 'completed' && s !== 'done'; });
        var total = active.length;

        var countWork = active.filter(function (t) { return (t.domain || '').toLowerCase() === 'work'; }).length;
        var countLearn = active.filter(function (t) { return (t.domain || '').toLowerCase() === 'learn'; }).length;
        var countBusiness = active.filter(function (t) { return (t.domain || '').toLowerCase() === 'business'; }).length;

        var pctWork = total ? Math.round((countWork / total) * 100) : 0;
        var pctLearn = total ? Math.round((countLearn / total) * 100) : 0;
        var pctBusiness = total ? Math.round((countBusiness / total) * 100) : 0;

        var pctEl = document.getElementById('sidebar-life-balance-pct');
        if (pctEl) pctEl.textContent = total;

        var barWork = document.getElementById('sidebar-bar-work');
        var barLearn = document.getElementById('sidebar-bar-learn');
        var barBusiness = document.getElementById('sidebar-bar-business');
        if (barWork) barWork.style.width = pctWork + '%';
        if (barLearn) barLearn.style.width = pctLearn + '%';
        if (barBusiness) barBusiness.style.width = pctBusiness + '%';

        function latestTaskForDomain(domain) {
            var list = active.filter(function (t) { return (t.domain || '').toLowerCase() === domain; });
            list.sort(function (a, b) { return new Date(b.created_at || 0) - new Date(a.created_at || 0); });
            return list[0] || null;
        }
        function truncate(s, len) {
            if (s == null) return '';
            s = String(s).trim();
            return s.length <= (len || 12) ? s : s.substring(0, len) + '…';
        }

        var labelWork = document.getElementById('sidebar-domain-work');
        var labelLearn = document.getElementById('sidebar-domain-learn');
        var labelBusiness = document.getElementById('sidebar-domain-business');
        if (labelWork) {
            var tw = latestTaskForDomain('work');
            labelWork.textContent = tw ? truncate(tw.title, 12) : '';
            labelWork.title = tw ? (tw.title || '') : '';
        }
        if (labelLearn) {
            var tl = latestTaskForDomain('learn');
            labelLearn.textContent = tl ? truncate(tl.title, 12) : '';
            labelLearn.title = tl ? (tl.title || '') : '';
        }
        if (labelBusiness) {
            var tb = latestTaskForDomain('business');
            labelBusiness.textContent = tb ? truncate(tb.title, 12) : '';
            labelBusiness.title = tb ? (tb.title || '') : '';
        }
        var crmBadge = document.getElementById('sidebar-crm-badge');
        if (crmBadge && window.allContacts) {
            var leadsCount = (window.allContacts || []).filter(function (c) { return (c.status || '').toLowerCase() === 'lead'; }).length;
            if (leadsCount > 0) {
                crmBadge.textContent = leadsCount;
                crmBadge.classList.remove('hidden');
            } else {
                crmBadge.classList.add('hidden');
            }
        }
        var agentBadge = document.getElementById('sidebar-agent-badge');
        if (agentBadge) {
            var agentPending = (window.agentPendingCount || 0);
            if (agentPending > 0) {
                agentBadge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-success animate-pulse"></span><span class="text-[10px] text-success">' + agentPending + '</span>';
                agentBadge.classList.remove('hidden');
            } else {
                agentBadge.classList.add('hidden');
            }
        }
        updateStreakDisplay();
    }

    function updateStreakDisplay() {
        var countEl = document.getElementById('streak-count');
        var dotsEl = document.getElementById('streak-dots');
        if (!countEl || !dotsEl) return;

        var userId = window.currentUser && window.currentUser.id;
        var streak = 0;
        var historyDays = [];

        function done() {
            countEl.textContent = streak + ' hari';
            var today = new Date();
            var dotsHtml = '';
            for (var i = 6; i >= 0; i--) {
                var d = new Date(today);
                d.setDate(d.getDate() - i);
                var dateStr = d.toISOString().split('T')[0];
                var hasBriefing = historyDays.indexOf(dateStr) !== -1;
                dotsHtml += '<div class="w-3 h-3 rounded-full ' + (hasBriefing ? 'bg-accent' : 'bg-gray-700') + '" title="' + dateStr + '"></div>';
            }
            dotsEl.innerHTML = dotsHtml;
        }

        if (window.morningBriefingSvc && userId) {
            window.morningBriefingSvc.getStreak(userId).then(function (n) {
                streak = n;
                return window.morningBriefingSvc.getHistory(userId, 7);
            }).then(function (rows) {
                if (rows && rows.length) {
                    historyDays = rows.map(function (r) { return r.briefing_date; });
                }
                done();
            }).catch(function () {
                var lsDate = localStorage.getItem('briefingDate');
                streak = (lsDate === new Date().toDateString()) ? 1 : 0;
                if (streak) historyDays = [new Date().toISOString().split('T')[0]];
                done();
            });
        } else {
            var lsDate = localStorage.getItem('briefingDate');
            streak = (lsDate === new Date().toDateString()) ? 1 : 0;
            if (streak) historyDays = [new Date().toISOString().split('T')[0]];
            done();
        }
    }

    window.syncSidebarMetrics = syncSidebarMetrics;
    window.updateStreakDisplay = updateStreakDisplay;
})();
