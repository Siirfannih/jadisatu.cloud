/**
 * FabricRenderer — Renders Composition JSON to a Fabric.js canvas
 * Produces pixel-perfect, export-ready carousel slides with rich visuals.
 *
 * Jadisatu.cloud — Auto-Design Engine Phase 1
 */
var FabricRenderer = (function() {
    'use strict';

    var _canvas = null;
    var _canvasEl = null;
    var _isReady = false;
    var _currentComposition = null;

    // Lucide icon SVG cache
    var _iconSvgCache = {};

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
            selection: false,
            preserveObjectStacking: true,
            renderOnAddRemove: false // batch render for performance
        });

        _isReady = true;
        console.log('[FabricRenderer] Initialized', width + 'x' + height);
        return true;
    }

    // ─── Get Lucide SVG path ────────────────────────────
    function getLucideSvg(iconName, size, color) {
        // Try to get SVG from lucide's icon data
        if (typeof lucide !== 'undefined' && lucide.icons && lucide.icons[iconName]) {
            var iconData = lucide.icons[iconName];
            var svgStr = '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">';
            if (Array.isArray(iconData)) {
                // lucide v0.x format: array of [tag, attrs]
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

        // Fallback: create a temporary element and extract
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

        return rect;
    }

    // ─── Render Circle ──────────────────────────────────
    function renderCircle(element) {
        return new fabric.Circle({
            left: element.left,
            top: element.top,
            radius: element.radius,
            fill: element.fill || 'transparent',
            stroke: element.stroke || '',
            strokeWidth: element.strokeWidth || 0,
            selectable: element.selectable || false,
            evented: element.evented || false,
            opacity: element.opacity || 1
        });
    }

    // ─── Render Rect ────────────────────────────────────
    function renderRect(element) {
        return new fabric.Rect({
            left: element.left,
            top: element.top,
            width: element.width,
            height: element.height,
            fill: element.fill || 'transparent',
            stroke: element.stroke || '',
            strokeWidth: element.strokeWidth || 0,
            rx: element.rx || 0,
            ry: element.ry || 0,
            selectable: element.selectable || false,
            evented: element.evented || false,
            opacity: element.opacity || 1
        });
    }

    // ─── Render Textbox ─────────────────────────────────
    function renderTextbox(element) {
        var textObj = new fabric.Textbox(element.text || '', {
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
            selectable: element.selectable !== false,
            evented: element.evented !== false,
            splitByGrapheme: false,
            // Prevent Fabric from adding interaction borders in export
            hasBorders: element.selectable !== false,
            hasControls: element.selectable !== false
        });
        return textObj;
    }

    // ─── Render Lucide Icon ─────────────────────────────
    function renderLucideIcon(element, callback) {
        var iconName = element.iconName || 'sparkles';
        var size = element.size || 64;
        var color = element.color || '#8b5cf6';

        var svgString = getLucideSvg(iconName, size, color);
        if (!svgString) {
            // Fallback: render a colored circle
            var fallback = new fabric.Circle({
                left: element.left,
                top: element.top,
                radius: size / 2,
                fill: CompositionEngine.hexToRgba(color, 0.3),
                selectable: false,
                evented: false
            });
            if (callback) callback(fallback);
            return fallback;
        }

        fabric.loadSVGFromString(svgString, function(objects, options) {
            var svgGroup = fabric.util.groupSVGElements(objects, options);
            svgGroup.set({
                left: element.left,
                top: element.top,
                scaleX: size / (svgGroup.width || 24),
                scaleY: size / (svgGroup.height || 24),
                selectable: false,
                evented: false
            });
            if (callback) callback(svgGroup);
        });
    }

    // ─── Render Line ──────────────────────────────────
    function renderLine(element) {
        return new fabric.Line(
            [element.x1 || 0, element.y1 || 0, element.x2 || 100, element.y2 || 0],
            {
                stroke: element.stroke || '#ffffff',
                strokeWidth: element.strokeWidth || 1,
                selectable: element.selectable || false,
                evented: element.evented || false,
                opacity: element.opacity || 1
            }
        );
    }

    // ─── Render Image ───────────────────────────────────
    function renderImage(element, callback) {
        var src = element.src || '';

        // Handle SVG content inline
        if (src.indexOf('svg:') === 0) {
            var svgStr = src.substring(4);
            fabric.loadSVGFromString(svgStr, function(objects, options) {
                var svgGroup = fabric.util.groupSVGElements(objects, options);
                svgGroup.set({
                    left: element.left || 0,
                    top: element.top || 0,
                    scaleX: (element.width || 200) / (svgGroup.width || 200),
                    scaleY: (element.height || 200) / (svgGroup.height || 200),
                    selectable: element.selectable !== false,
                    evented: element.evented !== false,
                    opacity: element.opacity || 1
                });
                if (callback) callback(svgGroup);
            });
            return;
        }

        // Handle base64 or URL images
        if (src && src !== 'placeholder') {
            fabric.Image.fromURL(src, function(img) {
                if (!img) { if (callback) callback(null); return; }
                img.set({
                    left: element.left || 0,
                    top: element.top || 0,
                    selectable: element.selectable !== false,
                    evented: element.evented !== false,
                    opacity: element.opacity || 1
                });
                // Scale to fit requested dimensions
                if (element.width && img.width) {
                    img.scaleToWidth(element.width);
                }
                if (element.height && img.height) {
                    var currentScaleH = element.height / img.height;
                    if (img.scaleY > currentScaleH) img.scaleToHeight(element.height);
                }
                // Apply rounded corners via clipPath
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
                if (callback) callback(img);
            }, { crossOrigin: 'anonymous' });
        } else {
            // Placeholder rect
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

        elements.forEach(function(el) {
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
                    // Async — SVG loading
                    asyncItems.push({ _asyncType: 'icon', _el: el });
                    break;

                case 'image':
                    // Async — image loading
                    asyncItems.push({ _asyncType: 'image', _el: el });
                    break;

                default:
                    console.warn('[FabricRenderer] Unknown element type:', el.type);
            }
        });

        // Handle async items (icons + images)
        if (asyncItems.length === 0) {
            _canvas.requestRenderAll();
            if (onComplete) onComplete();
        } else {
            var loaded = 0;
            var total = asyncItems.length;
            function onAsyncDone(obj) {
                if (obj) _canvas.add(obj);
                loaded++;
                if (loaded === total) {
                    _canvas.requestRenderAll();
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
    var _maxHistory = 30;

    function saveState() {
        if (!_canvas) return;
        var json = JSON.stringify(_canvas.toJSON());
        _undoStack.push(json);
        if (_undoStack.length > _maxHistory) _undoStack.shift();
        _redoStack = []; // clear redo on new action
    }

    function undo() {
        if (!_canvas || _undoStack.length === 0) return;
        _redoStack.push(JSON.stringify(_canvas.toJSON()));
        var prevState = _undoStack.pop();
        _canvas.loadFromJSON(prevState, function() {
            _canvas.requestRenderAll();
        });
    }

    function redo() {
        if (!_canvas || _redoStack.length === 0) return;
        _undoStack.push(JSON.stringify(_canvas.toJSON()));
        var nextState = _redoStack.pop();
        _canvas.loadFromJSON(nextState, function() {
            _canvas.requestRenderAll();
        });
    }

    // ─── Enable Interactive Editing ─────────────────────
    function enableEditing() {
        if (!_canvas) return;
        _canvas.selection = true;

        // Save state on object modification
        _canvas.on('object:modified', function() {
            saveState();
        });

        // Double-click to edit text
        _canvas.on('mouse:dblclick', function(e) {
            if (e.target && e.target.type === 'textbox') {
                e.target.enterEditing();
                e.target.selectAll();
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', function(e) {
            // Only handle when fabric canvas is focused/active
            if (_renderEngineRef && _renderEngineRef() !== 'fabric') return;

            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                undo();
            } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
                e.preventDefault();
                redo();
            } else if (e.key === 'Delete' || e.key === 'Backspace') {
                var active = _canvas.getActiveObject();
                if (active && !active.isEditing) {
                    e.preventDefault();
                    saveState();
                    _canvas.remove(active);
                    _canvas.requestRenderAll();
                }
            }
        });

        console.log('[FabricRenderer] Interactive editing enabled');
    }

    // Reference to check render engine state (set from outside)
    var _renderEngineRef = null;
    function setRenderEngineRef(fn) {
        _renderEngineRef = fn;
    }

    // ─── Export to PNG Data URL ──────────────────────────
    function exportPNG(scale) {
        if (!_canvas) return null;
        // Deselect all before export for clean output
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
        return _canvas.toJSON();
    }

    // ─── Load From Serialized State ─────────────────────
    function loadFromJSON(json, onComplete) {
        if (!_canvas) return;
        _canvas.loadFromJSON(json, function() {
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
            _canvas.dispose();
            _canvas = null;
            _isReady = false;
        }
    }

    // ─── Get Canvas Instance ────────────────────────────
    function getCanvas() {
        return _canvas;
    }

    function isReady() {
        return _isReady;
    }

    function canUndo() { return _undoStack.length > 0; }
    function canRedo() { return _redoStack.length > 0; }

    // Public API
    return {
        init: init,
        renderComposition: renderComposition,
        exportPNG: exportPNG,
        exportBlob: exportBlob,
        serialize: serialize,
        loadFromJSON: loadFromJSON,
        enableEditing: enableEditing,
        setRenderEngineRef: setRenderEngineRef,
        saveState: saveState,
        undo: undo,
        redo: redo,
        canUndo: canUndo,
        canRedo: canRedo,
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
