/**
 * Icon Relevance Engine
 * Context-aware icon selection for JadisatuOS Carousel Generator.
 *
 * 3 layers:
 *   Layer 1: keyword → icon candidates  (content-driven)
 *   Layer 2: template_family rules      (layout-driven)
 *   Layer 3: fallback constrained set   (safe defaults)
 *
 * Also prevents icon duplication across slides.
 */
(function () {
    'use strict';

    // ─── Layer 1: Keyword → Icon Candidates ─────────────────────────
    var KEYWORD_ICON_MAP = {
        // Indonesian + English keywords
        'ide':        ['lightbulb', 'sparkles', 'file-text'],
        'idea':       ['lightbulb', 'sparkles', 'file-text'],
        'konten':     ['pen-tool', 'notebook', 'layout-template'],
        'content':    ['pen-tool', 'notebook', 'layout-template'],
        'ai':         ['cpu', 'sparkles', 'bot'],
        'artificial': ['cpu', 'sparkles', 'bot'],
        'framework':  ['workflow', 'git-branch', 'network'],
        'writing':    ['pen', 'keyboard', 'file-text'],
        'menulis':    ['pen', 'keyboard', 'file-text'],
        'bisnis':     ['briefcase', 'trending-up', 'bar-chart-3'],
        'business':   ['briefcase', 'trending-up', 'bar-chart-3'],
        'marketing':  ['megaphone', 'target', 'bar-chart-3'],
        'pemasaran':  ['megaphone', 'target', 'bar-chart-3'],
        'sosial':     ['share-2', 'users', 'heart'],
        'social':     ['share-2', 'users', 'heart'],
        'media':      ['play-circle', 'image', 'film'],
        'desain':     ['palette', 'pen-tool', 'layers'],
        'design':     ['palette', 'pen-tool', 'layers'],
        'coding':     ['code', 'terminal', 'braces'],
        'kode':       ['code', 'terminal', 'braces'],
        'data':       ['database', 'bar-chart-3', 'pie-chart'],
        'analisis':   ['search', 'bar-chart-3', 'trending-up'],
        'analysis':   ['search', 'bar-chart-3', 'trending-up'],
        'belajar':    ['book-open', 'graduation-cap', 'brain'],
        'learn':      ['book-open', 'graduation-cap', 'brain'],
        'tips':       ['lightbulb', 'check-circle', 'star'],
        'strategi':   ['target', 'compass', 'map'],
        'strategy':   ['target', 'compass', 'map'],
        'langkah':    ['footprints', 'list-ordered', 'arrow-right'],
        'step':       ['footprints', 'list-ordered', 'arrow-right'],
        'tools':      ['wrench', 'settings', 'hammer'],
        'alat':       ['wrench', 'settings', 'hammer'],
        'uang':       ['banknote', 'wallet', 'coins'],
        'money':      ['banknote', 'wallet', 'coins'],
        'finance':    ['banknote', 'wallet', 'trending-up'],
        'keuangan':   ['banknote', 'wallet', 'trending-up'],
        'waktu':      ['clock', 'timer', 'calendar'],
        'time':       ['clock', 'timer', 'calendar'],
        'produktif':  ['zap', 'rocket', 'timer'],
        'productive': ['zap', 'rocket', 'timer'],
        'growth':     ['trending-up', 'sprout', 'rocket'],
        'tumbuh':     ['trending-up', 'sprout', 'rocket'],
        'komunitas':  ['users', 'message-circle', 'heart'],
        'community':  ['users', 'message-circle', 'heart'],
        'brand':      ['badge', 'star', 'award'],
        'merek':      ['badge', 'star', 'award'],
        'carousel':   ['layout-grid', 'image', 'layers'],
        'email':      ['mail', 'inbox', 'send'],
        'website':    ['globe', 'monitor', 'link'],
        'seo':        ['search', 'globe', 'trending-up'],
        'video':      ['play-circle', 'film', 'camera'],
        'foto':       ['camera', 'image', 'aperture'],
        'photo':      ['camera', 'image', 'aperture'],
        'podcast':    ['mic', 'headphones', 'radio'],
        'musik':      ['music', 'headphones', 'speaker'],
        'health':     ['heart-pulse', 'shield', 'activity'],
        'kesehatan':  ['heart-pulse', 'shield', 'activity'],
        'travel':     ['plane', 'map-pin', 'compass'],
        'perjalanan': ['plane', 'map-pin', 'compass'],
        'food':       ['utensils', 'chef-hat', 'coffee'],
        'makanan':    ['utensils', 'chef-hat', 'coffee'],
        'pendidikan': ['book-open', 'graduation-cap', 'school'],
        'education':  ['book-open', 'graduation-cap', 'school'],
        'hook':       ['zap', 'sparkles', 'flame'],
        'cta':        ['arrow-right', 'mouse-pointer-click', 'send'],
        'closing':    ['check-circle', 'flag', 'award']
    };

    // ─── Layer 2: Template Family Visual Rules ──────────────────────
    var FAMILY_RULES = {
        'dark_editorial_diagram': {
            preferred_visual: ['diagram', 'none'],
            icon_allowed: false,
            reason: 'Diagram-driven layout — icons clutter the design'
        },
        'warm_photo_editorial': {
            preferred_visual: ['illustration', 'none'],
            icon_allowed: false,
            reason: 'Photo-driven editorial — icons conflict with imagery'
        },
        'minimal_educational': {
            preferred_visual: ['icon', 'none'],
            icon_allowed: true,
            reason: 'Educational layout — small supporting icons welcome'
        },
        'storytelling_editorial': {
            preferred_visual: ['illustration', 'none'],
            icon_allowed: false,
            reason: 'Storytelling flow — prefer imagery over icons'
        },
        'technical_diagram': {
            preferred_visual: ['diagram', 'none'],
            icon_allowed: false,
            reason: 'Technical diagram layout — avoid icons'
        },
        'bold_modern': {
            preferred_visual: ['icon', 'none'],
            icon_allowed: true,
            reason: 'Bold modern layout — icons as accents allowed'
        }
    };

    // ─── Layer 3: Fallback Icon Set ─────────────────────────────────
    var FALLBACK_ICONS = ['zap', 'sparkles', 'star', 'lightbulb', 'target', 'check-circle', 'arrow-right', 'bookmark'];

    // ─── Icon Engine ────────────────────────────────────────────────
    function IconEngine() {
        this._usedIcons = {};  // track icons used per session to avoid duplication
        this._log = [];
    }

    /**
     * Select the best icon for a slide based on context.
     *
     * @param {Object} opts
     * @param {string} opts.text           - Slide text content (headline + body)
     * @param {string} opts.slideType      - 'hook', 'value', 'cta'
     * @param {string} opts.templateFamily - e.g. 'dark_editorial_diagram'
     * @param {string} opts.visualMode     - Current visual_mode
     * @param {string} opts.slideId        - Unique ID for dedup tracking
     * @returns {{ icon: string, visual_mode: string, reason: string }}
     */
    IconEngine.prototype.selectIcon = function (opts) {
        opts = opts || {};
        var text           = (opts.text || '').toLowerCase();
        var slideType      = opts.slideType || 'value';
        var templateFamily = opts.templateFamily || '';
        var visualMode     = opts.visualMode || null;
        var slideId        = opts.slideId || ('slide_' + Date.now());

        var entry = {
            slideId: slideId,
            input: { text: text.substring(0, 60), slideType: slideType, templateFamily: templateFamily, visualMode: visualMode },
            layers: {}
        };

        // ── Layer 2: Family rules ─────────────────────────────────────
        var familyRule = FAMILY_RULES[templateFamily] || null;
        if (familyRule && !visualMode) {
            // If no explicit visual_mode requested, use family default
            visualMode = familyRule.preferred_visual[0] || 'icon';
            entry.layers.family = { rule: familyRule, chosenMode: visualMode };
        }

        // If visual mode is diagram or none, skip icon selection entirely
        if (visualMode === 'diagram' || visualMode === 'none') {
            var result = { icon: null, visual_mode: visualMode, reason: 'visual_mode=' + visualMode + ' — no icon needed' };
            if (familyRule) result.reason += ' (family: ' + templateFamily + ')';
            entry.result = result;
            this._log.push(entry);
            console.log('[IconEngine]', slideId, '→', result.reason);
            return result;
        }

        // If visual mode is illustration, skip icon
        if (visualMode === 'illustration') {
            var result = { icon: null, visual_mode: 'illustration', reason: 'illustration mode — icon skipped' };
            entry.result = result;
            this._log.push(entry);
            console.log('[IconEngine]', slideId, '→', result.reason);
            return result;
        }

        // Family says no icons
        if (familyRule && !familyRule.icon_allowed) {
            var fallbackMode = familyRule.preferred_visual[0] || 'none';
            var result = { icon: null, visual_mode: fallbackMode, reason: familyRule.reason };
            entry.result = result;
            this._log.push(entry);
            console.log('[IconEngine]', slideId, '→', result.reason);
            return result;
        }

        // ── Layer 1: Keyword matching ─────────────────────────────────
        var candidates = [];
        var matchedKeywords = [];

        // Check slide type first
        if (KEYWORD_ICON_MAP[slideType]) {
            candidates = candidates.concat(KEYWORD_ICON_MAP[slideType]);
            matchedKeywords.push(slideType);
        }

        // Scan text for keyword hits
        for (var kw in KEYWORD_ICON_MAP) {
            if (text.indexOf(kw) !== -1) {
                var icons = KEYWORD_ICON_MAP[kw];
                for (var i = 0; i < icons.length; i++) {
                    if (candidates.indexOf(icons[i]) === -1) candidates.push(icons[i]);
                }
                matchedKeywords.push(kw);
            }
        }

        entry.layers.keyword = { matchedKeywords: matchedKeywords, candidates: candidates.slice(0, 8) };

        // ── Deduplication ─────────────────────────────────────────────
        var chosen = null;
        for (var j = 0; j < candidates.length; j++) {
            if (!this._usedIcons[candidates[j]]) {
                chosen = candidates[j];
                break;
            }
        }

        // ── Layer 3: Fallback ─────────────────────────────────────────
        if (!chosen) {
            for (var k = 0; k < FALLBACK_ICONS.length; k++) {
                if (!this._usedIcons[FALLBACK_ICONS[k]]) {
                    chosen = FALLBACK_ICONS[k];
                    break;
                }
            }
        }
        if (!chosen) chosen = FALLBACK_ICONS[0]; // absolute fallback

        // Track usage
        this._usedIcons[chosen] = slideId;
        entry.layers.dedup = { usedBefore: Object.keys(this._usedIcons) };

        var reason = matchedKeywords.length > 0
            ? 'keyword match: [' + matchedKeywords.join(', ') + '] → ' + chosen
            : 'fallback icon → ' + chosen;

        var result = { icon: chosen, visual_mode: 'icon', reason: reason };
        entry.result = result;
        this._log.push(entry);
        console.log('[IconEngine]', slideId, '→', chosen, '(' + reason + ')');
        return result;
    };

    /**
     * Reset tracking (call when starting a new carousel generation)
     */
    IconEngine.prototype.reset = function () {
        this._usedIcons = {};
        this._log = [];
    };

    /**
     * Release a specific icon (when user deletes a slide)
     */
    IconEngine.prototype.releaseIcon = function (iconName) {
        delete this._usedIcons[iconName];
    };

    /**
     * Get full decision log for debugging
     */
    IconEngine.prototype.getLog = function () {
        return this._log.slice();
    };

    /**
     * Get keyword map (for UI display)
     */
    IconEngine.prototype.getKeywordMap = function () {
        return KEYWORD_ICON_MAP;
    };

    /**
     * Get all available Lucide icons for icon picker (curated subset)
     */
    IconEngine.prototype.getPickerIcons = function () {
        var all = {};
        // Collect from keyword map
        for (var kw in KEYWORD_ICON_MAP) {
            KEYWORD_ICON_MAP[kw].forEach(function (ic) { all[ic] = true; });
        }
        // Add fallbacks
        FALLBACK_ICONS.forEach(function (ic) { all[ic] = true; });
        return Object.keys(all).sort();
    };

    window.IconEngine = IconEngine;
    window.ICON_FAMILY_RULES = FAMILY_RULES;
})();
