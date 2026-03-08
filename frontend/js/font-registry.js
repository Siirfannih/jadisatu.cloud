/**
 * Font Registry + Font Role System
 * Central font management for JadisatuOS Carousel Generator.
 *
 * Architecture:
 *   template schema uses font_roles (e.g. "heading": "serif_editorial")
 *   → FontRegistry resolves role → actual font family
 *   → CSS variables applied to canvas
 *
 * Users can override via preset or individual role selectors.
 */
(function () {
    'use strict';

    // ─── Font Catalog ────────────────────────────────────────────────
    var FONT_CATALOG = {
        // Sans
        'Inter':               { category: 'sans',       label: 'Inter',               weight: '300;400;500;600;700' },
        'Plus Jakarta Sans':   { category: 'sans',       label: 'Plus Jakarta Sans',   weight: '300;400;500;600;700' },
        'Manrope':             { category: 'sans',       label: 'Manrope',             weight: '300;400;500;600;700' },
        // Serif
        'Playfair Display':    { category: 'serif',      label: 'Playfair Display',    weight: '400;600;700' },
        'Cormorant Garamond':  { category: 'serif',      label: 'Cormorant Garamond',  weight: '300;400;500;600;700' },
        'Lora':                { category: 'serif',      label: 'Lora',                weight: '400;500;600;700' },
        // Mono / technical
        'IBM Plex Mono':       { category: 'mono',       label: 'IBM Plex Mono',       weight: '300;400;500;600' },
        'JetBrains Mono':      { category: 'mono',       label: 'JetBrains Mono',      weight: '300;400;500;600;700' },
        // Handwritten / accent
        'Caveat':              { category: 'handwritten', label: 'Caveat',              weight: '400;500;600;700' },
        'Kalam':               { category: 'handwritten', label: 'Kalam',               weight: '300;400;700' }
    };

    // ─── Font Role → Family Mapping (abstract roles) ────────────────
    var ROLE_MAP = {
        'serif_editorial':   'Playfair Display',
        'serif_classic':     'Cormorant Garamond',
        'serif_readable':    'Lora',
        'sans_clean':        'Inter',
        'sans_modern':       'Plus Jakarta Sans',
        'sans_geometric':    'Manrope',
        'mono_label':        'IBM Plex Mono',
        'mono_code':         'JetBrains Mono',
        'hand_accent':       'Caveat',
        'hand_warm':         'Kalam'
    };

    // ─── Presets ─────────────────────────────────────────────────────
    var FONT_PRESETS = {
        'editorial': {
            label: 'Editorial',
            roles: { heading: 'serif_editorial', body: 'sans_clean',    accent: 'mono_label' }
        },
        'modern_clean': {
            label: 'Modern Clean',
            roles: { heading: 'sans_modern',     body: 'sans_clean',    accent: 'sans_geometric' }
        },
        'technical': {
            label: 'Technical',
            roles: { heading: 'sans_geometric',  body: 'mono_code',     accent: 'mono_label' }
        },
        'minimal': {
            label: 'Minimal',
            roles: { heading: 'sans_clean',      body: 'sans_clean',    accent: 'sans_clean' }
        },
        'storytelling_warm': {
            label: 'Storytelling Warm',
            roles: { heading: 'serif_readable',  body: 'sans_clean',    accent: 'hand_warm' }
        }
    };

    // ─── Google Fonts URL Builder ────────────────────────────────────
    function buildGoogleFontsUrl(families) {
        if (!families || families.length === 0) return null;
        var seen = {};
        var params = [];
        families.forEach(function (name) {
            if (seen[name]) return;
            seen[name] = true;
            var entry = FONT_CATALOG[name];
            if (!entry) return;
            var encodedName = name.replace(/ /g, '+');
            params.push('family=' + encodedName + ':wght@' + entry.weight);
        });
        if (params.length === 0) return null;
        return 'https://fonts.googleapis.com/css2?' + params.join('&') + '&display=swap';
    }

    // ─── Loaded fonts tracker ────────────────────────────────────────
    var _loadedFontsUrl = null;

    function ensureFontsLoaded(families) {
        var url = buildGoogleFontsUrl(families);
        if (!url || url === _loadedFontsUrl) return;
        _loadedFontsUrl = url;
        // Remove old dynamic link
        var old = document.getElementById('jadisatu-dynamic-fonts');
        if (old) old.remove();
        var link = document.createElement('link');
        link.id = 'jadisatu-dynamic-fonts';
        link.rel = 'stylesheet';
        link.href = url;
        document.head.appendChild(link);
        console.log('[FontRegistry] Loading fonts:', families.join(', '));
    }

    // ─── FontRegistry class ─────────────────────────────────────────
    function FontRegistry() {
        // Current active roles (can be overridden by user)
        this._currentRoles = {
            heading: 'sans_clean',
            body:    'sans_clean',
            accent:  'sans_clean'
        };
        this._currentPreset = 'minimal';
    }

    FontRegistry.prototype.getCatalog = function () { return FONT_CATALOG; };
    FontRegistry.prototype.getRoleMap = function () { return ROLE_MAP; };
    FontRegistry.prototype.getPresets = function () { return FONT_PRESETS; };
    FontRegistry.prototype.getCurrentRoles = function () { return Object.assign({}, this._currentRoles); };
    FontRegistry.prototype.getCurrentPreset = function () { return this._currentPreset; };

    /**
     * Resolve a font role name to an actual font family string
     */
    FontRegistry.prototype.resolveRole = function (roleName) {
        return ROLE_MAP[roleName] || 'Inter';
    };

    /**
     * Get the families currently in use (for Google Fonts loading)
     */
    FontRegistry.prototype.getActiveFamilies = function () {
        var self = this;
        var families = [];
        ['heading', 'body', 'accent'].forEach(function (key) {
            var family = self.resolveRole(self._currentRoles[key]);
            if (families.indexOf(family) === -1) families.push(family);
        });
        return families;
    };

    /**
     * Apply a preset by name
     */
    FontRegistry.prototype.applyPreset = function (presetName) {
        var preset = FONT_PRESETS[presetName];
        if (!preset) {
            console.warn('[FontRegistry] Unknown preset:', presetName);
            return false;
        }
        this._currentPreset = presetName;
        this._currentRoles = Object.assign({}, preset.roles);
        this._applyToCanvas();
        console.log('[FontRegistry] Applied preset:', presetName, this._currentRoles);
        return true;
    };

    /**
     * Override a single role (heading/body/accent) with a role name
     */
    FontRegistry.prototype.setRole = function (roleKey, roleName) {
        if (!this._currentRoles.hasOwnProperty(roleKey)) return false;
        if (!ROLE_MAP[roleName]) {
            console.warn('[FontRegistry] Unknown role name:', roleName);
            return false;
        }
        this._currentRoles[roleKey] = roleName;
        this._currentPreset = 'custom';
        this._applyToCanvas();
        console.log('[FontRegistry] Set', roleKey, '→', roleName, '(' + this.resolveRole(roleName) + ')');
        return true;
    };

    /**
     * Override a single role with a direct font family name
     */
    FontRegistry.prototype.setRoleDirect = function (roleKey, fontFamily) {
        if (!this._currentRoles.hasOwnProperty(roleKey)) return false;
        // Find the role name that maps to this family
        var foundRole = null;
        for (var rn in ROLE_MAP) {
            if (ROLE_MAP[rn] === fontFamily) { foundRole = rn; break; }
        }
        if (!foundRole) {
            console.warn('[FontRegistry] Font not in catalog:', fontFamily);
            return false;
        }
        return this.setRole(roleKey, foundRole);
    };

    /**
     * Initialize from template schema font_roles
     */
    FontRegistry.prototype.initFromSchema = function (schemaFontRoles) {
        if (!schemaFontRoles) return;
        var self = this;
        ['heading', 'body', 'accent'].forEach(function (key) {
            if (schemaFontRoles[key] && ROLE_MAP[schemaFontRoles[key]]) {
                self._currentRoles[key] = schemaFontRoles[key];
            }
        });
        // Try to detect preset
        for (var pn in FONT_PRESETS) {
            var pr = FONT_PRESETS[pn].roles;
            if (pr.heading === self._currentRoles.heading &&
                pr.body === self._currentRoles.body &&
                pr.accent === self._currentRoles.accent) {
                self._currentPreset = pn;
                break;
            }
        }
        this._applyToCanvas();
    };

    /**
     * Infer best preset from template_family
     */
    FontRegistry.prototype.inferFromFamily = function (templateFamily) {
        var map = {
            'dark_editorial_diagram':  'editorial',
            'warm_photo_editorial':    'storytelling_warm',
            'minimal_educational':     'modern_clean',
            'storytelling_editorial':  'storytelling_warm',
            'technical_diagram':       'technical',
            'bold_modern':             'modern_clean'
        };
        var preset = map[templateFamily] || 'minimal';
        this.applyPreset(preset);
        return preset;
    };

    /**
     * Apply current roles to canvas CSS variables
     */
    FontRegistry.prototype._applyToCanvas = function () {
        var headingFont = this.resolveRole(this._currentRoles.heading);
        var bodyFont    = this.resolveRole(this._currentRoles.body);
        var accentFont  = this.resolveRole(this._currentRoles.accent);

        // Ensure fonts are loaded
        ensureFontsLoaded([headingFont, bodyFont, accentFont]);

        var canvas = document.getElementById('carousel-live-canvas');
        if (canvas) {
            canvas.style.setProperty('--font-heading', headingFont + ', sans-serif');
            canvas.style.setProperty('--font-body',    bodyFont + ', sans-serif');
            canvas.style.setProperty('--font-accent',  accentFont + ', sans-serif');
        }

        // Apply to specific elements
        var headlineEl = document.getElementById('carousel-preview-headline');
        var bodyEl     = document.getElementById('carousel-preview-body');
        var footerEl   = document.getElementById('carousel-preview-footer');
        if (headlineEl) headlineEl.style.fontFamily = headingFont + ', sans-serif';
        if (bodyEl)     bodyEl.style.fontFamily     = bodyFont + ', sans-serif';
        if (footerEl)   footerEl.style.fontFamily   = accentFont + ', sans-serif';
    };

    /**
     * Get serializable state for saving/feedback
     */
    FontRegistry.prototype.serialize = function () {
        return {
            preset: this._currentPreset,
            roles: Object.assign({}, this._currentRoles),
            resolved: {
                heading: this.resolveRole(this._currentRoles.heading),
                body:    this.resolveRole(this._currentRoles.body),
                accent:  this.resolveRole(this._currentRoles.accent)
            }
        };
    };

    window.FontRegistry = FontRegistry;
    window.FONT_CATALOG = FONT_CATALOG;
    window.FONT_PRESETS = FONT_PRESETS;
    window.FONT_ROLE_MAP = ROLE_MAP;
})();
