/**
 * Canvas Editor — Schema-backed element editing layer
 * for JadisatuOS Carousel Generator.
 *
 * Flow:
 *   Extractor output → template schema → render canvas
 *   → user edits schema-backed elements → canvas re-renders
 *   → edited schema can be saved
 *
 * Element types: title_block, subtitle_block, text_block,
 *   icon_block, diagram_block, footer_block, divider_block, shape_block
 */
(function () {
    'use strict';

    // ─── Default element factories ───────────────────────────────────
    var ELEMENT_DEFAULTS = {
        title_block: function (id, overrides) {
            return Object.assign({
                id: id || 'title_block_1',
                type: 'title_block',
                label: 'Judul',
                x: 0, y: 0,
                visible: true,
                text: 'Judul Slide',
                font_role: 'heading',
                font_size: 48,
                font_weight: '700',
                color: '#ffffff',
                alignment: 'center'
            }, overrides || {});
        },
        subtitle_block: function (id, overrides) {
            return Object.assign({
                id: id || 'subtitle_block_1',
                type: 'subtitle_block',
                label: 'Subjudul',
                x: 0, y: 0,
                visible: true,
                text: 'Subjudul',
                font_role: 'body',
                font_size: 24,
                font_weight: '400',
                color: '#d1d5db',
                alignment: 'center'
            }, overrides || {});
        },
        text_block: function (id, overrides) {
            return Object.assign({
                id: id || 'text_block_1',
                type: 'text_block',
                label: 'Teks',
                x: 0, y: 0,
                visible: true,
                text: 'Teks konten',
                font_role: 'body',
                font_size: 20,
                font_weight: '400',
                color: '#d1d5db',
                alignment: 'center'
            }, overrides || {});
        },
        icon_block: function (id, overrides) {
            return Object.assign({
                id: id || 'icon_block_1',
                type: 'icon_block',
                label: 'Ikon',
                x: 0, y: 0,
                visible: true,
                icon_name: 'zap',
                size: 48,
                color: '#f59e0b'
            }, overrides || {});
        },
        diagram_block: function (id, overrides) {
            return Object.assign({
                id: id || 'diagram_block_1',
                type: 'diagram_block',
                label: 'Diagram',
                x: 0, y: 0,
                visible: true,
                diagram_type: 'flowchart',
                stroke_color: '#ffffff',
                muted_color: '#9ca3af'
            }, overrides || {});
        },
        footer_block: function (id, overrides) {
            return Object.assign({
                id: id || 'footer_block_1',
                type: 'footer_block',
                label: 'Footer',
                x: 0, y: 0,
                visible: true,
                text: '@jadisatu.cloud',
                font_role: 'accent',
                font_size: 14,
                color: '#9ca3af'
            }, overrides || {});
        },
        divider_block: function (id, overrides) {
            return Object.assign({
                id: id || 'divider_block_1',
                type: 'divider_block',
                label: 'Pembatas',
                x: 0, y: 0,
                visible: true,
                style: 'dashed',
                color: '#9ca3af',
                thickness: 1
            }, overrides || {});
        },
        shape_block: function (id, overrides) {
            return Object.assign({
                id: id || 'shape_block_1',
                type: 'shape_block',
                label: 'Bentuk',
                x: 0, y: 0,
                visible: true,
                shape: 'rectangle',
                width: 80,
                height: 56,
                fill: 'transparent',
                stroke: '#ffffff',
                stroke_width: 2
            }, overrides || {});
        }
    };

    // ─── CanvasEditor ────────────────────────────────────────────────
    function CanvasEditor(opts) {
        opts = opts || {};
        this._elements = [];
        this._selectedId = null;
        this._visualMode = 'icon';
        this._templateFamily = '';
        this._feedbackMemory = opts.feedbackMemory || null;
        this._fontRegistry = opts.fontRegistry || null;
        this._iconEngine = opts.iconEngine || null;
        this._onUpdate = opts.onUpdate || null;   // callback when schema changes
        this._onSelect = opts.onSelect || null;   // callback when selection changes
        this._idCounter = 0;
    }

    // ─── Schema management ───────────────────────────────────────────

    /**
     * Build element list from current canvas state.
     * Called after Smart Extractor generates a template.
     */
    CanvasEditor.prototype.buildFromCanvas = function (schema, slideData) {
        this._elements = [];
        this._idCounter = 0;
        this._visualMode = (schema && schema.visual_mode) || 'icon';
        this._templateFamily = (schema && schema.template_family) || '';

        var cp = (schema && schema.color_palette) || {};
        var cr = (schema && schema.color_roles) || {};
        var typo = (schema && schema.typography) || {};

        // Title block (from headline)
        this._elements.push(ELEMENT_DEFAULTS.title_block(this._nextId('title_block'), {
            text: (slideData && slideData.headline) || 'Judul',
            color: cp.text_primary || '#ffffff',
            font_size: parseInt(typo.heading_size) || 48,
            font_weight: typo.heading_weight || '700'
        }));

        // Body/subtitle block
        this._elements.push(ELEMENT_DEFAULTS.subtitle_block(this._nextId('subtitle_block'), {
            text: (slideData && slideData.body) || '',
            color: cp.text_secondary || '#d1d5db',
            font_size: parseInt(typo.body_size) || 24,
            font_weight: typo.body_weight || '400'
        }));

        // Icon or Diagram block based on visual_mode
        if (this._visualMode === 'icon') {
            var iconName = 'zap';
            if (this._iconEngine && slideData) {
                var result = this._iconEngine.selectIcon({
                    text: (slideData.headline || '') + ' ' + (slideData.body || ''),
                    slideType: slideData.type || 'value',
                    templateFamily: this._templateFamily,
                    visualMode: this._visualMode,
                    slideId: slideData.id || 'slide_0'
                });
                if (result.icon) iconName = result.icon;
                if (result.visual_mode !== 'icon') this._visualMode = result.visual_mode;
            }
            if (this._visualMode === 'icon') {
                this._elements.push(ELEMENT_DEFAULTS.icon_block(this._nextId('icon_block'), {
                    icon_name: iconName,
                    color: cp.accent || '#f59e0b',
                    size: 48
                }));
            }
        }

        if (this._visualMode === 'diagram') {
            this._elements.push(ELEMENT_DEFAULTS.diagram_block(this._nextId('diagram_block'), {
                diagram_type: (schema && schema.diagram_type) || 'flowchart',
                stroke_color: cr.line || cp.primary || '#ffffff',
                muted_color: cr.muted_line || cp.text_muted || '#9ca3af'
            }));
        }

        // Footer block
        this._elements.push(ELEMENT_DEFAULTS.footer_block(this._nextId('footer_block'), {
            text: '@jadisatu.cloud',
            color: cp.text_muted || '#9ca3af'
        }));

        // Divider block (if visual_components include it)
        var vc = (schema && schema.visual_components) || [];
        if (vc.indexOf('dashed-divider') !== -1 || vc.indexOf('clean-divider') !== -1) {
            this._elements.push(ELEMENT_DEFAULTS.divider_block(this._nextId('divider_block'), {
                color: cr.muted_line || cp.text_muted || '#9ca3af',
                style: vc.indexOf('dashed-divider') !== -1 ? 'dashed' : 'solid'
            }));
        }

        this._selectedId = null;
        console.log('[CanvasEditor] Built', this._elements.length, 'elements from schema');
        return this._elements;
    };

    CanvasEditor.prototype._nextId = function (prefix) {
        this._idCounter++;
        return prefix + '_' + this._idCounter;
    };

    // ─── Element CRUD ────────────────────────────────────────────────

    CanvasEditor.prototype.getElements = function () {
        return this._elements.slice();
    };

    CanvasEditor.prototype.getVisibleElements = function () {
        return this._elements.filter(function (el) { return el.visible; });
    };

    CanvasEditor.prototype.getElementById = function (id) {
        return this._elements.find(function (el) { return el.id === id; }) || null;
    };

    CanvasEditor.prototype.getSelectedElement = function () {
        if (!this._selectedId) return null;
        return this.getElementById(this._selectedId);
    };

    CanvasEditor.prototype.getSelectedId = function () {
        return this._selectedId;
    };

    CanvasEditor.prototype.select = function (id) {
        this._selectedId = id;
        if (this._onSelect) this._onSelect(this.getSelectedElement());
    };

    CanvasEditor.prototype.deselect = function () {
        this._selectedId = null;
        if (this._onSelect) this._onSelect(null);
    };

    /**
     * Update element properties
     */
    CanvasEditor.prototype.updateElement = function (id, updates) {
        var el = this.getElementById(id);
        if (!el) return null;

        var oldValues = {};
        for (var key in updates) {
            if (updates.hasOwnProperty(key) && key !== 'id' && key !== 'type') {
                oldValues[key] = el[key];
                el[key] = updates[key];
            }
        }

        // Record feedback
        if (this._feedbackMemory) {
            var actionType = this._inferAction(updates);
            this._feedbackMemory.record(actionType, id, oldValues, updates);
        }

        this._notifyUpdate();
        console.log('[CanvasEditor] Updated', id, updates);
        return el;
    };

    /**
     * Toggle element visibility
     */
    CanvasEditor.prototype.toggleVisibility = function (id) {
        var el = this.getElementById(id);
        if (!el) return;
        var oldVis = el.visible;
        el.visible = !el.visible;
        if (this._feedbackMemory) {
            this._feedbackMemory.record('toggle_visibility', id, oldVis, el.visible);
        }
        this._notifyUpdate();
        return el.visible;
    };

    /**
     * Delete an element
     */
    CanvasEditor.prototype.deleteElement = function (id) {
        var idx = -1;
        for (var i = 0; i < this._elements.length; i++) {
            if (this._elements[i].id === id) { idx = i; break; }
        }
        if (idx === -1) return false;

        var removed = this._elements.splice(idx, 1)[0];
        if (this._selectedId === id) this._selectedId = null;

        // Release icon from engine if it was an icon block
        if (removed.type === 'icon_block' && this._iconEngine && removed.icon_name) {
            this._iconEngine.releaseIcon(removed.icon_name);
        }

        if (this._feedbackMemory) {
            this._feedbackMemory.record('delete_element', id, removed, null);
        }
        this._notifyUpdate();
        console.log('[CanvasEditor] Deleted', id);
        return true;
    };

    /**
     * Add a new element of given type
     */
    CanvasEditor.prototype.addElement = function (type, overrides) {
        var factory = ELEMENT_DEFAULTS[type];
        if (!factory) {
            console.warn('[CanvasEditor] Unknown element type:', type);
            return null;
        }
        var el = factory(this._nextId(type), overrides);
        this._elements.push(el);
        if (this._feedbackMemory) {
            this._feedbackMemory.record('add_element', el.id, null, el);
        }
        this._notifyUpdate();
        console.log('[CanvasEditor] Added', el.id);
        return el;
    };

    // ─── Visual mode ─────────────────────────────────────────────────

    CanvasEditor.prototype.getVisualMode = function () {
        return this._visualMode;
    };

    CanvasEditor.prototype.setVisualMode = function (mode) {
        var oldMode = this._visualMode;
        this._visualMode = mode;
        if (this._feedbackMemory) {
            this._feedbackMemory.record('change_visual_mode', 'canvas', oldMode, mode);
        }
        this._notifyUpdate();
        console.log('[CanvasEditor] Visual mode:', oldMode, '→', mode);
    };

    CanvasEditor.prototype.getTemplateFamily = function () {
        return this._templateFamily;
    };

    // ─── Serialize to schema ─────────────────────────────────────────

    /**
     * Export current element state as a partial schema that
     * can be merged back into the template_schema.
     */
    CanvasEditor.prototype.serialize = function () {
        return {
            visual_mode: this._visualMode,
            template_family: this._templateFamily,
            elements: this._elements.map(function (el) {
                return Object.assign({}, el);
            })
        };
    };

    /**
     * Restore elements from serialized state
     */
    CanvasEditor.prototype.restore = function (data) {
        if (!data) return;
        if (data.visual_mode) this._visualMode = data.visual_mode;
        if (data.template_family) this._templateFamily = data.template_family;
        if (Array.isArray(data.elements)) {
            this._elements = data.elements.map(function (el) { return Object.assign({}, el); });
        }
        this._notifyUpdate();
    };

    // ─── Helpers ─────────────────────────────────────────────────────

    CanvasEditor.prototype._inferAction = function (updates) {
        if (updates.text !== undefined) return 'update_text';
        if (updates.icon_name !== undefined) return 'change_icon';
        if (updates.font_role !== undefined || updates.font_size !== undefined) return 'change_font';
        if (updates.color !== undefined || updates.stroke_color !== undefined || updates.fill !== undefined) return 'change_color';
        if (updates.alignment !== undefined) return 'change_alignment';
        if (updates.x !== undefined || updates.y !== undefined) return 'position_adjustment';
        if (updates.font_size !== undefined) return 'change_font_size';
        return 'update_text';
    };

    CanvasEditor.prototype._notifyUpdate = function () {
        if (this._onUpdate) this._onUpdate(this.serialize());
    };

    /**
     * Apply element state to the live canvas DOM.
     * Maps element schema fields → actual DOM elements.
     */
    CanvasEditor.prototype.applyToDOM = function () {
        var elements = this._elements;
        var fontRegistry = this._fontRegistry;

        elements.forEach(function (el) {
            if (el.type === 'title_block') {
                var dom = document.getElementById('carousel-preview-headline');
                if (!dom) return;
                dom.style.display = el.visible ? '' : 'none';
                if (el.text) dom.textContent = el.text;
                if (el.color) dom.style.color = el.color;
                if (el.font_size) dom.style.fontSize = el.font_size + 'px';
                if (el.font_weight) dom.style.fontWeight = el.font_weight;
                if (el.alignment) dom.style.textAlign = el.alignment;
                if (el.font_role && fontRegistry) {
                    dom.style.fontFamily = fontRegistry.resolveRole(
                        fontRegistry.getCurrentRoles()[el.font_role === 'heading' ? 'heading' : 'body']
                    ) + ', sans-serif';
                }
            }

            if (el.type === 'subtitle_block' || el.type === 'text_block') {
                var dom = document.getElementById('carousel-preview-body');
                if (!dom) return;
                dom.style.display = el.visible ? '' : 'none';
                if (el.text) dom.textContent = el.text;
                if (el.color) dom.style.color = el.color;
                if (el.font_size) dom.style.fontSize = el.font_size + 'px';
                if (el.font_weight) dom.style.fontWeight = el.font_weight;
                if (el.alignment) dom.style.textAlign = el.alignment;
                if (el.font_role && fontRegistry) {
                    dom.style.fontFamily = fontRegistry.resolveRole(
                        fontRegistry.getCurrentRoles()['body']
                    ) + ', sans-serif';
                }
            }

            if (el.type === 'icon_block') {
                var wrap = document.getElementById('carousel-preview-icon-wrap');
                if (!wrap) return;
                wrap.style.display = el.visible ? '' : 'none';
                var iconEl = wrap.querySelector('[data-lucide]');
                if (iconEl && el.icon_name) {
                    iconEl.setAttribute('data-lucide', el.icon_name);
                    if (el.color) iconEl.style.color = el.color;
                    if (el.size) {
                        iconEl.style.width = el.size + 'px';
                        iconEl.style.height = el.size + 'px';
                    }
                }
            }

            if (el.type === 'footer_block') {
                var footerText = document.querySelector('#carousel-live-canvas [data-color-editable="footer-text"]');
                if (!footerText) return;
                var parentEl = footerText.closest('[data-color-editable="footer"]') || footerText.parentElement;
                if (parentEl) parentEl.style.display = el.visible ? '' : 'none';
                if (el.text) footerText.textContent = el.text;
                if (el.color) footerText.style.color = el.color;
                if (el.font_size) footerText.style.fontSize = el.font_size + 'px';
            }

            if (el.type === 'divider_block') {
                // Look for existing dashed divider in overlay
                var overlay = document.getElementById('carousel-component-overlay');
                if (overlay) {
                    var dividers = overlay.querySelectorAll('[style*="border-top"]');
                    dividers.forEach(function (d) {
                        d.style.display = el.visible ? '' : 'none';
                        if (el.color) d.style.borderTopColor = el.color;
                    });
                }
            }

            if (el.type === 'diagram_block') {
                var container = document.getElementById('carousel-diagram-container');
                if (container) {
                    container.style.display = el.visible ? '' : 'none';
                }
            }
        });

        // Refresh Lucide icons
        if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
    };

    /**
     * Sync element text from the DOM back to schema
     * (used after contenteditable changes)
     */
    CanvasEditor.prototype.syncFromDOM = function () {
        var headlineEl = document.getElementById('carousel-preview-headline');
        var bodyEl = document.getElementById('carousel-preview-body');

        this._elements.forEach(function (el) {
            if (el.type === 'title_block' && headlineEl) {
                var domText = headlineEl.textContent || headlineEl.innerText || '';
                if (domText !== el.text) el.text = domText;
            }
            if ((el.type === 'subtitle_block' || el.type === 'text_block') && bodyEl) {
                var domText = bodyEl.textContent || bodyEl.innerText || '';
                if (domText !== el.text) el.text = domText;
            }
        });
    };

    window.CanvasEditor = CanvasEditor;
    window.CANVAS_ELEMENT_DEFAULTS = ELEMENT_DEFAULTS;
})();
