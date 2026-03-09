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

                case 'lucide-icon':
                    // Async — SVG loading
                    asyncItems.push(el);
                    break;

                default:
                    console.warn('[FabricRenderer] Unknown element type:', el.type);
            }
        });

        // Handle async icon loading
        if (asyncItems.length === 0) {
            _canvas.requestRenderAll();
            if (onComplete) onComplete();
        } else {
            var loaded = 0;
            asyncItems.forEach(function(el) {
                renderLucideIcon(el, function(obj) {
                    if (obj) _canvas.add(obj);
                    loaded++;
                    if (loaded === asyncItems.length) {
                        _canvas.requestRenderAll();
                        if (onComplete) onComplete();
                    }
                });
            });
        }
    }

    // ─── Export to PNG Data URL ──────────────────────────
    function exportPNG(scale) {
        if (!_canvas) return null;
        return _canvas.toDataURL({
            format: 'png',
            quality: 1,
            multiplier: scale || 1
        });
    }

    // ─── Export to Blob ─────────────────────────────────
    function exportBlob(scale, callback) {
        if (!_canvas) { callback(null); return; }
        _canvas.toBlob(function(blob) {
            callback(blob);
        }, 'image/png', { multiplier: scale || 1 });
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

    // Public API
    return {
        init: init,
        renderComposition: renderComposition,
        exportPNG: exportPNG,
        exportBlob: exportBlob,
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
