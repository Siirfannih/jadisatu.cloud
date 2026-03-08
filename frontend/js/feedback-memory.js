/**
 * Feedback Memory — Structured edit action logger
 * Persists user corrections on AI-generated carousel templates
 * so the system can learn from edits in the future.
 *
 * Storage: localStorage (immediate) + Supabase (when available)
 */
(function () {
    'use strict';

    var STORAGE_KEY = 'jadisatu_carousel_feedback';
    var TABLE = 'carousel_edit_feedback';

    // Valid action types
    var ACTIONS = [
        'add_element',
        'delete_element',
        'update_text',
        'change_icon',
        'change_visual_mode',
        'change_font',
        'change_color',
        'toggle_visibility',
        'position_adjustment',
        'change_alignment',
        'change_font_size',
        'apply_font_preset',
        'apply_template'
    ];

    function FeedbackMemory(supabaseClient, userId) {
        this._client = supabaseClient || null;
        this._userId = userId || null;
        this._session = {
            session_id: 'session_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
            template_id: null,
            template_family: null,
            original_visual_mode: null,
            final_visual_mode: null,
            original_font_preset: null,
            final_font_preset: null,
            changes: [],
            started_at: new Date().toISOString(),
            saved: false
        };
    }

    /**
     * Start a new editing session for a template
     */
    FeedbackMemory.prototype.startSession = function (templateId, templateFamily, visualMode, fontPreset) {
        this._session = {
            session_id: 'session_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
            template_id: templateId || null,
            template_family: templateFamily || null,
            original_visual_mode: visualMode || null,
            final_visual_mode: visualMode || null,
            original_font_preset: fontPreset || null,
            final_font_preset: fontPreset || null,
            changes: [],
            started_at: new Date().toISOString(),
            saved: false
        };
        console.log('[FeedbackMemory] Session started:', this._session.session_id);
    };

    /**
     * Record an edit action
     * @param {string} action - One of ACTIONS
     * @param {string} target - Element ID or role (e.g. 'icon_block_1', 'title_block')
     * @param {*} oldValue - Previous value
     * @param {*} newValue - New value
     */
    FeedbackMemory.prototype.record = function (action, target, oldValue, newValue) {
        if (ACTIONS.indexOf(action) === -1) {
            console.warn('[FeedbackMemory] Unknown action:', action);
        }
        var entry = {
            action: action,
            target: target || null,
            old_value: oldValue !== undefined ? oldValue : null,
            new_value: newValue !== undefined ? newValue : null,
            timestamp: new Date().toISOString()
        };
        this._session.changes.push(entry);

        // Track visual_mode and font changes at session level
        if (action === 'change_visual_mode') {
            this._session.final_visual_mode = newValue;
        }
        if (action === 'apply_font_preset') {
            this._session.final_font_preset = newValue;
        }

        console.log('[FeedbackMemory] Recorded:', action, target, '→', newValue);
    };

    /**
     * Get current session summary
     */
    FeedbackMemory.prototype.getSession = function () {
        return Object.assign({}, this._session);
    };

    /**
     * Get change count for current session
     */
    FeedbackMemory.prototype.getChangeCount = function () {
        return this._session.changes.length;
    };

    /**
     * Save current session to storage
     */
    FeedbackMemory.prototype.save = async function () {
        if (this._session.changes.length === 0) {
            console.log('[FeedbackMemory] No changes to save.');
            return false;
        }
        if (this._session.saved) {
            console.log('[FeedbackMemory] Session already saved.');
            return true;
        }

        var payload = {
            session_id: this._session.session_id,
            template_id: this._session.template_id,
            template_family: this._session.template_family,
            original_visual_mode: this._session.original_visual_mode,
            final_visual_mode: this._session.final_visual_mode,
            original_font_preset: this._session.original_font_preset,
            final_font_preset: this._session.final_font_preset,
            changes: this._session.changes,
            change_count: this._session.changes.length,
            started_at: this._session.started_at,
            ended_at: new Date().toISOString()
        };

        // Always save to localStorage
        try {
            var existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
            existing.push(payload);
            // Keep last 50 sessions max
            if (existing.length > 50) existing = existing.slice(-50);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
            console.log('[FeedbackMemory] Saved to localStorage (' + payload.change_count + ' changes)');
        } catch (e) {
            console.warn('[FeedbackMemory] localStorage save failed:', e);
        }

        // Try Supabase if available
        if (this._client && this._userId) {
            try {
                var row = Object.assign({ user_id: this._userId }, payload);
                var res = await this._client.from(TABLE).insert(row);
                if (res.error) {
                    console.warn('[FeedbackMemory] Supabase save failed:', res.error);
                } else {
                    console.log('[FeedbackMemory] Saved to Supabase');
                }
            } catch (e) {
                console.warn('[FeedbackMemory] Supabase save error:', e);
            }
        }

        this._session.saved = true;
        return true;
    };

    /**
     * Load past sessions from localStorage (for analysis)
     */
    FeedbackMemory.prototype.loadHistory = function () {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        } catch (e) {
            return [];
        }
    };

    /**
     * Get aggregated stats from past sessions
     */
    FeedbackMemory.prototype.getStats = function () {
        var sessions = this.loadHistory();
        var stats = {
            total_sessions: sessions.length,
            total_changes: 0,
            action_counts: {},
            visual_mode_overrides: 0,
            font_preset_overrides: 0
        };
        sessions.forEach(function (s) {
            stats.total_changes += (s.change_count || 0);
            if (s.original_visual_mode !== s.final_visual_mode) stats.visual_mode_overrides++;
            if (s.original_font_preset !== s.final_font_preset) stats.font_preset_overrides++;
            (s.changes || []).forEach(function (c) {
                stats.action_counts[c.action] = (stats.action_counts[c.action] || 0) + 1;
            });
        });
        return stats;
    };

    window.FeedbackMemory = FeedbackMemory;
})();
