/**
 * Persistent Debug Logger
 * Logs survive page reloads - stored in localStorage
 */

const DebugLogger = {
    KEY: 'jadisatu_debug_log',
    MAX_LOGS: 50,

    log(message, data = null) {
        const timestamp = new Date().toISOString();
        const entry = {
            time: timestamp,
            page: window.location.pathname,
            message,
            data
        };

        // Get existing logs
        let logs = [];
        try {
            const stored = localStorage.getItem(this.KEY);
            if (stored) logs = JSON.parse(stored);
        } catch (e) {
            console.error('Failed to parse debug logs:', e);
        }

        // Add new entry
        logs.push(entry);

        // Keep only last MAX_LOGS
        if (logs.length > this.MAX_LOGS) {
            logs = logs.slice(-this.MAX_LOGS);
        }

        // Save back
        try {
            localStorage.setItem(this.KEY, JSON.stringify(logs));
        } catch (e) {
            console.error('Failed to save debug log:', e);
        }

        // Also console log
        console.log(`[DEBUG] ${message}`, data || '');
    },

    getLogs() {
        try {
            const stored = localStorage.getItem(this.KEY);
            return stored ? JSON.parse(stored) : [];
        } catch (e) {
            return [];
        }
    },

    printLogs() {
        const logs = this.getLogs();
        console.log('=== PERSISTENT DEBUG LOGS ===');
        logs.forEach((entry, index) => {
            console.log(`${index + 1}. [${entry.time}] ${entry.page}: ${entry.message}`, entry.data || '');
        });
        console.log('=== END LOGS ===');
    },

    clear() {
        localStorage.removeItem(this.KEY);
        console.log('Debug logs cleared');
    },

    // Check for redirect loops
    checkLoop() {
        const logs = this.getLogs();
        const recent = logs.slice(-10); // Last 10 logs

        // Count redirects in last 10 logs
        const redirects = recent.filter(log =>
            log.message.includes('redirect') || log.message.includes('Redirecting')
        );

        if (redirects.length >= 5) {
            console.error('🚨 REDIRECT LOOP DETECTED!');
            console.log('Recent activity:', recent);
            return true;
        }

        return false;
    }
};

// Make globally available
window.DebugLogger = DebugLogger;

// Auto-print logs on load
if (window.location.search.includes('debug=1')) {
    setTimeout(() => {
        DebugLogger.printLogs();
    }, 1000);
}
