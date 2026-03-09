/**
 * FabricRenderer — Mini Canva Visual Editor Engine
 * Full CRUD canvas editor with selectable objects, copy/paste, nudge,
 * z-ordering, and selection events for property panel integration.
 *
 * Jadisatu.cloud — Auto-Design Engine Phase 2
 */
var FabricRenderer = (function() {
    'use strict';

    var _canvas = null;
    var _canvasEl = null;
    var _isReady = false;
    var _editingEnabled = false;
    var _currentComposition = null;

    // Lucide icon SVG cache
    var _iconSvgCache = {};

    // Element ID counter for unique tracking
    var _elementIdCounter = 0;

    // Clipboard for copy/paste
    var _clipboard = null;

    // Selection event callbacks
    var _onSelectCallback = null;
    var _onDeselectCallback = null;
    var _onModifiedCallback = null;

    // ─── Initialize ─────────────────────────────────────
    function init(canvasElementId, width, height) {
        _canvasEl = document.getElementById(canvasElementId);
        if (!_canvasEl) {
            console.error('[FabricRenderer] Canvas element not found:', canvasElementId);
            return false;
        }

        _canvas = new fabric.Canvas(canvasElementId, {
            width: width || 1080,
            height: height || 1080,
            backgroundColor: '#0f0f11',
            selection: true,
            preserveObjectStacking: true,
            renderOnAddRemove: false
        });

        _isReady = true;
        _elementIdCounter = 0;
        console.log('[FabricRenderer] Initialized', width + 'x' + height);
        return true;
    }

    // ─── Generate unique element ID ─────────────────────
    function generateElementId(type) {
        _elementIdCounter++;
        return (type || 'el') + '_' + _elementIdCounter + '_' + Date.now();
    }

    // ─── Tag a Fabric object with metadata ──────────────
    function tagObject(obj, elementType, compositionElement) {
        if (!obj) return obj;
        obj._elementId = generateElementId(elementType);
        obj._elementType = elementType;
        obj._isBackground = (elementType === 'gradient-bg');
        obj._isDecoration = (elementType === 'decoration');
        // Store original composition data for reference
        if (compositionElement) {
            obj._compositionData = compositionElement;
        }
        return obj;
    }

    // ─── Apply edit-mode properties to object ───────────
    function applyEditability(obj) {
        if (!obj) return obj;
        // Background is never selectable
        if (obj._isBackground) {
            obj.set({ selectable: false, evented: false, hasBorders: false, hasControls: false });
            return obj;
        }
        // All other objects are selectable in edit mode
        obj.set({
            selectable: true,
            evented: true,
            hasBorders: true,
            hasControls: true,
            cornerColor: '#8b5cf6',
            cornerStrokeColor: '#6d28d9',
            cornerSize: 10,
            cornerStyle: 'circle',
            transparentCorners: false,
            borderColor: '#8b5cf6',
            borderScaleFactor: 2,
            padding: 4
        });
        return obj;
    }

    // ─── Get Lucide SVG path ────────────────────────────
    function getLucideSvg(iconName, size, color) {
        if (typeof lucide !== 'undefined' && lucide.icons && lucide.icons[iconName]) {
            var iconData = lucide.icons[iconName];
            var svgStr = '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">';
            if (Array.isArray(iconData)) {
                iconData.forEach(function(node) {
                    if (Array.isArray(node) && node.length >= 2) {
                        var tag = node[0];
                        var attrs = node[1];
                        svgStr += '<' + tag;
                        Object.keys(attrs).forEach(function(k) {
                            svgStr += ' ' + k + '="' + attrs[k] + '"';
                        });
                        svgStr += '/>';
                    }
                });
            }
            svgStr += '</svg>';
            return svgStr;
        }

        var tempDiv = document.createElement('div');
        tempDiv.style.cssText = 'position:absolute;left:-9999px;top:-9999px;';
        tempDiv.innerHTML = '<i data-lucide="' + iconName + '"></i>';
        document.body.appendChild(tempDiv);

        if (typeof lucide !== 'undefined' && lucide.createIcons) {
            lucide.createIcons({ root: tempDiv });
        }

        var svg = tempDiv.querySelector('svg');
        var svgString = '';
        if (svg) {
            svg.setAttribute('width', size);
            svg.setAttribute('height', size);
            svg.setAttribute('stroke', color);
            svgString = svg.outerHTML;
        }
        document.body.removeChild(tempDiv);
        return svgString;
    }

    // ─── Render Gradient Background ─────────────────────
    function renderGradientBg(element) {
        var stops = element.colorStops || [
            { offset: 0, color: '#0f0f11' },
            { offset: 1, color: '#0a0a0d' }
        ];

        var rect = new fabric.Rect({
            left: 0,
            top: 0,
            width: element.width,
            height: element.height,
            selectable: false,
            evented: false
        });

        var gradientCoords;
        if (element.direction === 'to-bottom-right') {
            gradientCoords = { x1: 0, y1: 0, x2: element.width, y2: element.height };
        } else if (element.direction === 'to-bottom') {
            gradientCoords = { x1: 0, y1: 0, x2: 0, y2: element.height };
        } else {
            gradientCoords = { x1: 0, y1: 0, x2: element.width, y2: 0 };
        }

        var colorStops = {};
        stops.forEach(function(s) {
            colorStops[s.offset] = s.color;
        });

        rect.set('fill', new fabric.Gradient({
            type: 'linear',
            coords: gradientCoords,
            colorStops: Object.keys(colorStops).map(function(offset) {
                return { offset: parseFloat(offset), color: colorStops[offset] };
            })
        }));

        tagObject(rect, 'gradient-bg', element);
        return rect;
    }

    // ─── Render Circle ──────────────────────────────────
    function renderCircle(element) {
        var obj = new fabric.Circle({
            left: element.left,
            top: element.top,
            radius: element.radius,
            fill: element.fill || 'transparent',
            stroke: element.stroke || '',
            strokeWidth: element.strokeWidth || 0,
            opacity: element.opacity || 1
        });
        tagObject(obj, element._isDecoration ? 'decoration' : 'circle', element);
        applyEditability(obj);
        return obj;
    }

    // ─── Render Rect ────────────────────────────────────
    function renderRect(element) {
        var obj = new fabric.Rect({
            left: element.left,
            top: element.top,
            width: element.width,
            height: element.height,
            fill: element.fill || 'transparent',
            stroke: element.stroke || '',
            strokeWidth: element.strokeWidth || 0,
            rx: element.rx || 0,
            ry: element.ry || 0,
            opacity: element.opacity || 1
        });
        tagObject(obj, element._isDecoration ? 'decoration' : 'rect', element);
        applyEditability(obj);
        return obj;
    }

    // ─── Render Textbox ─────────────────────────────────
    function renderTextbox(element) {
        var obj = new fabric.Textbox(element.text || '', {
            left: element.left,
            top: element.top,
            width: element.width || 400,
            fontSize: element.fontSize || 24,
            fontWeight: element.fontWeight || '400',
            fontStyle: element.fontStyle || 'normal',
            fontFamily: element.fontFamily || 'Inter, sans-serif',
            fill: element.fill || '#ffffff',
            textAlign: element.textAlign || 'left',
            lineHeight: element.lineHeight || 1.3,
            splitByGrapheme: false
        });
        tagObject(obj, 'textbox', element);
        applyEditability(obj);
        return obj;
    }

    // ─── Render Lucide Icon ─────────────────────────────
    function renderLucideIcon(element, callback) {
        var iconName = element.iconName || 'sparkles';
        var size = element.size || 64;
        var color = element.color || '#8b5cf6';

        var svgString = getLucideSvg(iconName, size, color);
        if (!svgString) {
            var fallback = new fabric.Circle({
                left: element.left,
                top: element.top,
                radius: size / 2,
                fill: CompositionEngine.hexToRgba(color, 0.3)
            });
            tagObject(fallback, 'lucide-icon', element);
            fallback._iconName = iconName;
            applyEditability(fallback);
            if (callback) callback(fallback);
            return fallback;
        }

        fabric.loadSVGFromString(svgString, function(objects, options) {
            var svgGroup = fabric.util.groupSVGElements(objects, options);
            svgGroup.set({
                left: element.left,
                top: element.top,
                scaleX: size / (svgGroup.width || 24),
                scaleY: size / (svgGroup.height || 24)
            });
            tagObject(svgGroup, 'lucide-icon', element);
            svgGroup._iconName = iconName;
            applyEditability(svgGroup);
            if (callback) callback(svgGroup);
        });
    }

    // ─── Render Line ──────────────────────────────────
    function renderLine(element) {
        var obj = new fabric.Line(
            [element.x1 || 0, element.y1 || 0, element.x2 || 100, element.y2 || 0],
            {
                stroke: element.stroke || '#ffffff',
                strokeWidth: element.strokeWidth || 1,
                opacity: element.opacity || 1
            }
        );
        tagObject(obj, element._isDecoration ? 'decoration' : 'line', element);
        applyEditability(obj);
        return obj;
    }

    // ─── Render Image ───────────────────────────────────
    function renderImage(element, callback) {
        var src = element.src || '';

        if (src.indexOf('svg:') === 0) {
            var svgStr = src.substring(4);
            fabric.loadSVGFromString(svgStr, function(objects, options) {
                var svgGroup = fabric.util.groupSVGElements(objects, options);
                svgGroup.set({
                    left: element.left || 0,
                    top: element.top || 0,
                    scaleX: (element.width || 200) / (svgGroup.width || 200),
                    scaleY: (element.height || 200) / (svgGroup.height || 200),
                    opacity: element.opacity || 1
                });
                tagObject(svgGroup, 'image', element);
                applyEditability(svgGroup);
                if (callback) callback(svgGroup);
            });
            return;
        }

        if (src && src !== 'placeholder') {
            fabric.Image.fromURL(src, function(img) {
                if (!img) { if (callback) callback(null); return; }
                img.set({
                    left: element.left || 0,
                    top: element.top || 0,
                    opacity: element.opacity || 1
                });
                if (element.width && img.width) {
                    img.scaleToWidth(element.width);
                }
                if (element.height && img.height) {
                    var currentScaleH = element.height / img.height;
                    if (img.scaleY > currentScaleH) img.scaleToHeight(element.height);
                }
                if (element.rx) {
                    img.set('clipPath', new fabric.Rect({
                        width: img.width,
                        height: img.height,
                        rx: element.rx / (img.scaleX || 1),
                        ry: element.rx / (img.scaleY || 1),
                        originX: 'center',
                        originY: 'center'
                    }));
                }
                tagObject(img, 'image', element);
                applyEditability(img);
                if (callback) callback(img);
            }, { crossOrigin: 'anonymous' });
        } else {
            var placeholder = new fabric.Rect({
                left: element.left || 0,
                top: element.top || 0,
                width: element.width || 200,
                height: element.height || 200,
                fill: 'rgba(139,92,246,0.08)',
                stroke: 'rgba(139,92,246,0.2)',
                strokeWidth: 2,
                strokeDashArray: [8, 4],
                rx: element.rx || 12,
                ry: element.rx || 12,
                selectable: false,
                evented: false
            });
            tagObject(placeholder, 'placeholder', element);
            if (callback) callback(placeholder);
        }
    }

    // ─── Render Full Composition ────────────────────────
    function renderComposition(composition, onComplete) {
        if (!_canvas || !_isReady) {
            console.error('[FabricRenderer] Not initialized');
            return;
        }

        _currentComposition = composition;
        _canvas.clear();

        var elements = composition.elements || [];
        var asyncItems = [];

        elements.forEach(function(el, index) {
            // Tag decorations from composition engine
            if (el._role === 'decoration' || el._role === 'pattern') {
                el._isDecoration = true;
            }

            var fabricObj;

            switch (el.type) {
                case 'gradient-bg':
                    fabricObj = renderGradientBg(el);
                    if (fabricObj) _canvas.add(fabricObj);
                    break;

                case 'circle':
                    fabricObj = renderCircle(el);
                    if (fabricObj) _canvas.add(fabricObj);
                    break;

                case 'rect':
                    fabricObj = renderRect(el);
                    if (fabricObj) _canvas.add(fabricObj);
                    break;

                case 'textbox':
                    fabricObj = renderTextbox(el);
                    if (fabricObj) _canvas.add(fabricObj);
                    break;

                case 'line':
                    fabricObj = renderLine(el);
                    if (fabricObj) _canvas.add(fabricObj);
                    break;

                case 'lucide-icon':
                    asyncItems.push({ _asyncType: 'icon', _el: el });
                    break;

                case 'image':
                    asyncItems.push({ _asyncType: 'image', _el: el });
                    break;

                default:
                    console.warn('[FabricRenderer] Unknown element type:', el.type);
            }
        });

        // Handle async items (icons + images)
        if (asyncItems.length === 0) {
            _canvas.requestRenderAll();
            if (_editingEnabled) saveState();
            if (onComplete) onComplete();
        } else {
            var loaded = 0;
            var total = asyncItems.length;
            function onAsyncDone(obj) {
                if (obj) _canvas.add(obj);
                loaded++;
                if (loaded === total) {
                    _canvas.requestRenderAll();
                    if (_editingEnabled) saveState();
                    if (onComplete) onComplete();
                }
            }
            asyncItems.forEach(function(item) {
                if (item._asyncType === 'icon') {
                    renderLucideIcon(item._el, onAsyncDone);
                } else if (item._asyncType === 'image') {
                    renderImage(item._el, onAsyncDone);
                }
            });
        }
    }

    // ─── Undo/Redo System ─────────────────────────────────
    var _undoStack = [];
    var _redoStack = [];
    var _maxHistory = 50;

    function saveState() {
        if (!_canvas) return;
        var json = JSON.stringify(_canvas.toJSON(['_elementId', '_elementType', '_isBackground', '_isDecoration', '_iconName']));
        _undoStack.push(json);
        if (_undoStack.length > _maxHistory) _undoStack.shift();
        _redoStack = [];
    }

    function undo() {
        if (!_canvas || _undoStack.length === 0) return;
        _redoStack.push(JSON.stringify(_canvas.toJSON(['_elementId', '_elementType', '_isBackground', '_isDecoration', '_iconName'])));
        var prevState = _undoStack.pop();
        _canvas.loadFromJSON(prevState, function() {
            _canvas.requestRenderAll();
            _fireSelectionEvent(null);
        });
    }

    function redo() {
        if (!_canvas || _redoStack.length === 0) return;
        _undoStack.push(JSON.stringify(_canvas.toJSON(['_elementId', '_elementType', '_isBackground', '_isDecoration', '_iconName'])));
        var nextState = _redoStack.pop();
        _canvas.loadFromJSON(nextState, function() {
            _canvas.requestRenderAll();
            _fireSelectionEvent(null);
        });
    }

    // ─── Selection Event System ─────────────────────────
    function _fireSelectionEvent(obj) {
        if (obj && _onSelectCallback) {
            _onSelectCallback(obj);
        } else if (!obj && _onDeselectCallback) {
            _onDeselectCallback();
        }
    }

    function onSelect(callback) { _onSelectCallback = callback; }
    function onDeselect(callback) { _onDeselectCallback = callback; }
    function onModified(callback) { _onModifiedCallback = callback; }

    // ─── Enable Interactive Editing (Mini Canva Mode) ───
    function enableEditing() {
        if (!_canvas || _editingEnabled) return;
        _editingEnabled = true;
        _canvas.selection = true;

        // Make all existing objects editable (except background)
        _canvas.getObjects().forEach(function(obj) {
            applyEditability(obj);
        });

        // Selection events → property panel
        _canvas.on('selection:created', function(e) {
            _fireSelectionEvent(e.selected ? e.selected[0] : null);
        });
        _canvas.on('selection:updated', function(e) {
            _fireSelectionEvent(e.selected ? e.selected[0] : null);
        });
        _canvas.on('selection:cleared', function() {
            _fireSelectionEvent(null);
        });

        // Save state on modifications
        _canvas.on('object:modified', function(e) {
            saveState();
            if (_onModifiedCallback && e.target) {
                _onModifiedCallback(e.target);
            }
        });

        // Double-click to edit text
        _canvas.on('mouse:dblclick', function(e) {
            if (e.target && e.target.type === 'textbox') {
                e.target.enterEditing();
                e.target.selectAll();
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', _handleKeyDown);

        _canvas.requestRenderAll();
        console.log('[FabricRenderer] Mini Canva editing enabled — all objects selectable');
    }

    function disableEditing() {
        if (!_canvas || !_editingEnabled) return;
        _editingEnabled = false;
        _canvas.selection = false;
        _canvas.discardActiveObject();

        _canvas.getObjects().forEach(function(obj) {
            obj.set({ selectable: false, evented: false, hasBorders: false, hasControls: false });
        });

        _canvas.off('selection:created');
        _canvas.off('selection:updated');
        _canvas.off('selection:cleared');
        _canvas.off('object:modified');
        _canvas.off('mouse:dblclick');
        document.removeEventListener('keydown', _handleKeyDown);

        _canvas.requestRenderAll();
        console.log('[FabricRenderer] Editing disabled');
    }

    // ─── Keyboard Handler ───────────────────────────────
    function _handleKeyDown(e) {
        if (!_canvas || !_editingEnabled) return;
        if (_renderEngineRef && _renderEngineRef() !== 'fabric') return;

        // Don't intercept when typing in input/textarea
        var tag = (e.target || {}).tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

        var active = _canvas.getActiveObject();
        // Don't intercept arrow keys, delete, etc. when editing text
        if (active && active.isEditing) return;

        var ctrl = e.ctrlKey || e.metaKey;

        // Undo: Ctrl+Z
        if (ctrl && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            undo();
            return;
        }
        // Redo: Ctrl+Y or Ctrl+Shift+Z
        if (ctrl && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
            e.preventDefault();
            redo();
            return;
        }
        // Copy: Ctrl+C
        if (ctrl && e.key === 'c') {
            if (active) {
                e.preventDefault();
                copySelected();
            }
            return;
        }
        // Paste: Ctrl+V
        if (ctrl && e.key === 'v') {
            e.preventDefault();
            pasteClipboard();
            return;
        }
        // Duplicate: Ctrl+D
        if (ctrl && e.key === 'd') {
            if (active) {
                e.preventDefault();
                duplicateSelected();
            }
            return;
        }
        // Select All: Ctrl+A
        if (ctrl && e.key === 'a') {
            e.preventDefault();
            selectAll();
            return;
        }
        // Delete/Backspace
        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (active && !active._isBackground) {
                e.preventDefault();
                deleteSelected();
            }
            return;
        }
        // Arrow keys: nudge selected object
        var nudge = e.shiftKey ? 10 : 1;
        if (active && !active._isBackground) {
            if (e.key === 'ArrowLeft') { e.preventDefault(); active.set('left', active.left - nudge); active.setCoords(); _canvas.requestRenderAll(); saveState(); }
            else if (e.key === 'ArrowRight') { e.preventDefault(); active.set('left', active.left + nudge); active.setCoords(); _canvas.requestRenderAll(); saveState(); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); active.set('top', active.top - nudge); active.setCoords(); _canvas.requestRenderAll(); saveState(); }
            else if (e.key === 'ArrowDown') { e.preventDefault(); active.set('top', active.top + nudge); active.setCoords(); _canvas.requestRenderAll(); saveState(); }
        }
        // Escape: deselect
        if (e.key === 'Escape') {
            _canvas.discardActiveObject();
            _canvas.requestRenderAll();
        }
    }

    // ─── Object CRUD: Add Elements ──────────────────────

    function addText(options) {
        if (!_canvas) return null;
        var opts = options || {};
        saveState();
        var obj = new fabric.Textbox(opts.text || 'New Text', {
            left: opts.left || 440,
            top: opts.top || 500,
            width: opts.width || 400,
            fontSize: opts.fontSize || 36,
            fontWeight: opts.fontWeight || '600',
            fontFamily: opts.fontFamily || 'Inter, sans-serif',
            fill: opts.fill || '#ffffff',
            textAlign: opts.textAlign || 'center',
            lineHeight: opts.lineHeight || 1.3
        });
        tagObject(obj, 'textbox');
        applyEditability(obj);
        _canvas.add(obj);
        _canvas.setActiveObject(obj);
        _canvas.requestRenderAll();
        return obj;
    }

    function addShape(shapeType, options) {
        if (!_canvas) return null;
        var opts = options || {};
        saveState();
        var obj;

        switch (shapeType) {
            case 'rect':
                obj = new fabric.Rect({
                    left: opts.left || 400,
                    top: opts.top || 400,
                    width: opts.width || 200,
                    height: opts.height || 200,
                    fill: opts.fill || '#8b5cf6',
                    stroke: opts.stroke || '',
                    strokeWidth: opts.strokeWidth || 0,
                    rx: opts.rx || 0,
                    ry: opts.ry || 0,
                    opacity: opts.opacity || 1
                });
                tagObject(obj, 'rect');
                break;

            case 'circle':
                obj = new fabric.Circle({
                    left: opts.left || 440,
                    top: opts.top || 440,
                    radius: opts.radius || 100,
                    fill: opts.fill || '#8b5cf6',
                    stroke: opts.stroke || '',
                    strokeWidth: opts.strokeWidth || 0,
                    opacity: opts.opacity || 1
                });
                tagObject(obj, 'circle');
                break;

            case 'triangle':
                obj = new fabric.Triangle({
                    left: opts.left || 440,
                    top: opts.top || 400,
                    width: opts.width || 200,
                    height: opts.height || 200,
                    fill: opts.fill || '#8b5cf6',
                    stroke: opts.stroke || '',
                    strokeWidth: opts.strokeWidth || 0,
                    opacity: opts.opacity || 1
                });
                tagObject(obj, 'triangle');
                break;

            case 'rounded-rect':
                obj = new fabric.Rect({
                    left: opts.left || 400,
                    top: opts.top || 400,
                    width: opts.width || 200,
                    height: opts.height || 200,
                    fill: opts.fill || '#8b5cf6',
                    rx: opts.rx || 20,
                    ry: opts.ry || 20,
                    opacity: opts.opacity || 1
                });
                tagObject(obj, 'rect');
                break;

            default:
                console.warn('[FabricRenderer] Unknown shape:', shapeType);
                return null;
        }

        applyEditability(obj);
        _canvas.add(obj);
        _canvas.setActiveObject(obj);
        _canvas.requestRenderAll();
        return obj;
    }

    function addLine(options) {
        if (!_canvas) return null;
        var opts = options || {};
        saveState();
        var obj = new fabric.Line(
            [opts.x1 || 340, opts.y1 || 540, opts.x2 || 740, opts.y2 || 540],
            {
                stroke: opts.stroke || '#ffffff',
                strokeWidth: opts.strokeWidth || 2,
                opacity: opts.opacity || 1
            }
        );
        tagObject(obj, 'line');
        applyEditability(obj);
        _canvas.add(obj);
        _canvas.setActiveObject(obj);
        _canvas.requestRenderAll();
        return obj;
    }

    function addIcon(iconName, options) {
        if (!_canvas) return null;
        var opts = options || {};
        saveState();
        var element = {
            iconName: iconName || 'sparkles',
            left: opts.left || 480,
            top: opts.top || 480,
            size: opts.size || 80,
            color: opts.color || '#8b5cf6'
        };
        renderLucideIcon(element, function(obj) {
            if (obj) {
                _canvas.add(obj);
                _canvas.setActiveObject(obj);
                _canvas.requestRenderAll();
            }
        });
    }

    function addImage(src, options) {
        if (!_canvas) return null;
        var opts = options || {};
        saveState();
        var element = {
            src: src,
            left: opts.left || 340,
            top: opts.top || 340,
            width: opts.width || 400,
            height: opts.height || 400,
            rx: opts.rx || 0
        };
        renderImage(element, function(obj) {
            if (obj) {
                _canvas.add(obj);
                _canvas.setActiveObject(obj);
                _canvas.requestRenderAll();
            }
        });
    }

    // ─── Object CRUD: Manipulate ────────────────────────

    function deleteSelected() {
        if (!_canvas) return;
        var active = _canvas.getActiveObject();
        if (!active || active._isBackground) return;
        saveState();
        if (active.type === 'activeSelection') {
            active.forEachObject(function(obj) {
                if (!obj._isBackground) _canvas.remove(obj);
            });
            _canvas.discardActiveObject();
        } else {
            _canvas.remove(active);
        }
        _canvas.requestRenderAll();
    }

    function copySelected() {
        if (!_canvas) return;
        var active = _canvas.getActiveObject();
        if (!active) return;
        active.clone(function(cloned) {
            _clipboard = cloned;
        }, ['_elementType', '_iconName']);
    }

    function pasteClipboard() {
        if (!_canvas || !_clipboard) return;
        saveState();
        _clipboard.clone(function(cloned) {
            _canvas.discardActiveObject();
            cloned.set({
                left: cloned.left + 20,
                top: cloned.top + 20,
                evented: true
            });
            if (cloned.type === 'activeSelection') {
                cloned.canvas = _canvas;
                cloned.forEachObject(function(obj) {
                    tagObject(obj, obj._elementType || 'pasted');
                    applyEditability(obj);
                    _canvas.add(obj);
                });
                cloned.setCoords();
            } else {
                tagObject(cloned, cloned._elementType || 'pasted');
                applyEditability(cloned);
                _canvas.add(cloned);
            }
            _clipboard.top += 20;
            _clipboard.left += 20;
            _canvas.setActiveObject(cloned);
            _canvas.requestRenderAll();
        }, ['_elementType', '_iconName']);
    }

    function duplicateSelected() {
        if (!_canvas) return;
        var active = _canvas.getActiveObject();
        if (!active) return;
        saveState();
        active.clone(function(cloned) {
            cloned.set({
                left: active.left + 20,
                top: active.top + 20
            });
            tagObject(cloned, active._elementType || 'duplicated');
            applyEditability(cloned);
            _canvas.add(cloned);
            _canvas.setActiveObject(cloned);
            _canvas.requestRenderAll();
        }, ['_elementType', '_iconName']);
    }

    function selectAll() {
        if (!_canvas) return;
        var objs = _canvas.getObjects().filter(function(o) { return !o._isBackground; });
        if (objs.length === 0) return;
        _canvas.discardActiveObject();
        var sel = new fabric.ActiveSelection(objs, { canvas: _canvas });
        _canvas.setActiveObject(sel);
        _canvas.requestRenderAll();
    }

    // ─── Z-Ordering ─────────────────────────────────────

    function bringForward() {
        var active = _canvas ? _canvas.getActiveObject() : null;
        if (active && !active._isBackground) {
            _canvas.bringForward(active);
            saveState();
            _canvas.requestRenderAll();
        }
    }

    function sendBackward() {
        var active = _canvas ? _canvas.getActiveObject() : null;
        if (active && !active._isBackground) {
            // Don't send behind background
            var idx = _canvas.getObjects().indexOf(active);
            if (idx > 1) {
                _canvas.sendBackwards(active);
                saveState();
                _canvas.requestRenderAll();
            }
        }
    }

    function bringToFront() {
        var active = _canvas ? _canvas.getActiveObject() : null;
        if (active && !active._isBackground) {
            _canvas.bringToFront(active);
            saveState();
            _canvas.requestRenderAll();
        }
    }

    function sendToBack() {
        var active = _canvas ? _canvas.getActiveObject() : null;
        if (active && !active._isBackground) {
            // Send to index 1 (behind everything except background at 0)
            _canvas.moveTo(active, 1);
            saveState();
            _canvas.requestRenderAll();
        }
    }

    // ─── Object Property Updates ────────────────────────

    function updateSelected(props) {
        if (!_canvas) return;
        var active = _canvas.getActiveObject();
        if (!active) return;
        saveState();
        active.set(props);
        active.setCoords();
        _canvas.requestRenderAll();
    }

    function getSelectedProperties() {
        if (!_canvas) return null;
        var active = _canvas.getActiveObject();
        if (!active) return null;
        return {
            _elementId: active._elementId,
            _elementType: active._elementType,
            type: active.type,
            left: Math.round(active.left),
            top: Math.round(active.top),
            width: Math.round(active.getScaledWidth()),
            height: Math.round(active.getScaledHeight()),
            scaleX: active.scaleX,
            scaleY: active.scaleY,
            angle: Math.round(active.angle),
            opacity: active.opacity,
            fill: active.fill,
            stroke: active.stroke,
            strokeWidth: active.strokeWidth,
            // Text-specific
            text: active.text,
            fontSize: active.fontSize,
            fontWeight: active.fontWeight,
            fontFamily: active.fontFamily,
            fontStyle: active.fontStyle,
            textAlign: active.textAlign,
            lineHeight: active.lineHeight,
            // Shape-specific
            rx: active.rx,
            ry: active.ry,
            radius: active.radius,
            // Icon-specific
            _iconName: active._iconName
        };
    }

    // ─── Get All Canvas Elements (for bridge/learning) ──
    function getAllElements() {
        if (!_canvas) return [];
        return _canvas.getObjects().map(function(obj, index) {
            return {
                index: index,
                _elementId: obj._elementId,
                _elementType: obj._elementType,
                _isBackground: obj._isBackground,
                type: obj.type,
                left: Math.round(obj.left),
                top: Math.round(obj.top),
                width: Math.round(obj.getScaledWidth()),
                height: Math.round(obj.getScaledHeight()),
                angle: Math.round(obj.angle || 0),
                opacity: obj.opacity,
                fill: typeof obj.fill === 'string' ? obj.fill : '(gradient)',
                text: obj.text,
                _iconName: obj._iconName
            };
        });
    }

    // Reference to check render engine state (set from outside)
    var _renderEngineRef = null;
    function setRenderEngineRef(fn) {
        _renderEngineRef = fn;
    }

    // ─── Export to PNG Data URL ──────────────────────────
    function exportPNG(scale) {
        if (!_canvas) return null;
        _canvas.discardActiveObject();
        _canvas.requestRenderAll();
        return _canvas.toDataURL({
            format: 'png',
            quality: 1,
            multiplier: scale || 1
        });
    }

    // ─── Export to Blob ─────────────────────────────────
    function exportBlob(scale, callback) {
        if (!_canvas) { callback(null); return; }
        _canvas.discardActiveObject();
        _canvas.requestRenderAll();
        _canvas.toBlob(function(blob) {
            callback(blob);
        }, 'image/png', { multiplier: scale || 1 });
    }

    // ─── Serialize Current State ────────────────────────
    function serialize() {
        if (!_canvas) return null;
        return _canvas.toJSON(['_elementId', '_elementType', '_isBackground', '_isDecoration', '_iconName']);
    }

    // ─── Load From Serialized State ─────────────────────
    function loadFromJSON(json, onComplete) {
        if (!_canvas) return;
        _canvas.loadFromJSON(json, function() {
            if (_editingEnabled) {
                _canvas.getObjects().forEach(function(obj) {
                    applyEditability(obj);
                });
            }
            _canvas.requestRenderAll();
            if (onComplete) onComplete();
        });
    }

    // ─── Clear Canvas ───────────────────────────────────
    function clear() {
        if (_canvas) {
            _canvas.clear();
            _canvas.requestRenderAll();
        }
    }

    // ─── Dispose ────────────────────────────────────────
    function dispose() {
        if (_canvas) {
            document.removeEventListener('keydown', _handleKeyDown);
            _canvas.dispose();
            _canvas = null;
            _isReady = false;
            _editingEnabled = false;
        }
    }

    // ─── Get Canvas Instance ────────────────────────────
    function getCanvas() {
        return _canvas;
    }

    function isReady() {
        return _isReady;
    }

    function isEditing() {
        return _editingEnabled;
    }

    function canUndo() { return _undoStack.length > 0; }
    function canRedo() { return _redoStack.length > 0; }

    // Public API
    return {
        init: init,
        renderComposition: renderComposition,

        // Editing mode
        enableEditing: enableEditing,
        disableEditing: disableEditing,
        isEditing: isEditing,

        // CRUD: Add elements
        addText: addText,
        addShape: addShape,
        addLine: addLine,
        addIcon: addIcon,
        addImage: addImage,

        // CRUD: Manipulate
        deleteSelected: deleteSelected,
        copySelected: copySelected,
        pasteClipboard: pasteClipboard,
        duplicateSelected: duplicateSelected,
        selectAll: selectAll,

        // Z-ordering
        bringForward: bringForward,
        sendBackward: sendBackward,
        bringToFront: bringToFront,
        sendToBack: sendToBack,

        // Property access
        updateSelected: updateSelected,
        getSelectedProperties: getSelectedProperties,
        getAllElements: getAllElements,

        // Selection events
        onSelect: onSelect,
        onDeselect: onDeselect,
        onModified: onModified,

        // Undo/Redo
        saveState: saveState,
        undo: undo,
        redo: redo,
        canUndo: canUndo,
        canRedo: canRedo,

        // Export
        exportPNG: exportPNG,
        exportBlob: exportBlob,
        serialize: serialize,
        loadFromJSON: loadFromJSON,
        setRenderEngineRef: setRenderEngineRef,

        // Lifecycle
        clear: clear,
        dispose: dispose,
        getCanvas: getCanvas,
        isReady: isReady
    };
})();

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FabricRenderer;
}
