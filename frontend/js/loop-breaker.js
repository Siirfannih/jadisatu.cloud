/**
 * Loop Breaker - Prevents infinite redirect loops
 * Tracks redirects and stops after threshold
 */

const LoopBreaker = {
    KEY: 'jadisatu_redirect_count',
    THRESHOLD: 3, // Max redirects in 10 seconds
    WINDOW: 10000, // 10 seconds

    track(from, to) {
        const now = Date.now();
        const entry = { from, to, timestamp: now };

        // Get existing redirects
        let redirects = [];
        try {
            const stored = localStorage.getItem(this.KEY);
            if (stored) redirects = JSON.parse(stored);
        } catch (e) {
            redirects = [];
        }

        // Add new redirect
        redirects.push(entry);

        // Remove old redirects (outside time window)
        const cutoff = now - this.WINDOW;
        redirects = redirects.filter(r => r.timestamp > cutoff);

        // Save back
        localStorage.setItem(this.KEY, JSON.stringify(redirects));

        // Check if loop detected
        if (redirects.length >= this.THRESHOLD) {
            this.handleLoop(redirects);
            return true; // Loop detected
        }

        return false; // OK to continue
    },

    handleLoop(redirects) {
        console.error('🚨 REDIRECT LOOP DETECTED!');
        console.error('Redirects:', redirects);

        // Clear the redirect tracking
        localStorage.removeItem(this.KEY);

        // Show error page
        document.body.innerHTML = `
            <div style="
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                background: linear-gradient(135deg, #0f0f11 0%, #1a1a2e 100%);
                color: white;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                padding: 20px;
            ">
                <div style="max-width: 600px; text-align: center;">
                    <div style="font-size: 64px; margin-bottom: 20px;">🔄</div>
                    <h1 style="font-size: 32px; margin-bottom: 16px;">Redirect Loop Detected</h1>
                    <p style="color: #9ca3af; margin-bottom: 32px;">
                        The system detected a redirect loop and stopped it to prevent infinite loading.
                    </p>
                    <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); padding: 16px; border-radius: 8px; margin-bottom: 24px; text-align: left;">
                        <h3 style="margin-bottom: 8px; color: #f87171;">Recent Redirects:</h3>
                        <pre style="color: #fca5a5; font-size: 12px; overflow-x: auto;">${JSON.stringify(redirects, null, 2)}</pre>
                    </div>
                    <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
                        <button onclick="LoopBreaker.clearAndRetry()" style="
                            padding: 12px 24px;
                            background: #3b82f6;
                            color: white;
                            border: none;
                            border-radius: 8px;
                            cursor: pointer;
                            font-size: 14px;
                            font-weight: 600;
                        ">
                            Clear Session & Retry Login
                        </button>
                        <button onclick="LoopBreaker.showDebugLogs()" style="
                            padding: 12px 24px;
                            background: rgba(255,255,255,0.1);
                            color: white;
                            border: 1px solid rgba(255,255,255,0.2);
                            border-radius: 8px;
                            cursor: pointer;
                            font-size: 14px;
                            font-weight: 600;
                        ">
                            Show Debug Logs
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Stop execution
        throw new Error('Redirect loop - execution stopped');
    },

    clearAndRetry() {
        // Clear all session data
        localStorage.clear();
        sessionStorage.clear();

        // Go to login
        window.location.href = '/login.html';
    },

    showDebugLogs() {
        if (window.DebugLogger) {
            window.DebugLogger.printLogs();
        } else {
            console.log('Debug logger not available');
        }

        // Copy logs to clipboard
        const logs = localStorage.getItem('jadisatu_debug_log');
        if (logs) {
            navigator.clipboard.writeText(logs).then(() => {
                alert('Debug logs copied to clipboard! Paste in a text editor to view.');
            }).catch(() => {
                console.log('Logs:', logs);
                alert('Could not copy to clipboard. Check console for logs.');
            });
        }
    },

    reset() {
        localStorage.removeItem(this.KEY);
        console.log('Loop breaker reset');
    }
};

// Make globally available
window.LoopBreaker = LoopBreaker;
