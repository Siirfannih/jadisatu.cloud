/**
 * Visual Engine — Programmatic SVG + HTML component renderer
 * for JadisatuOS Carousel Generator.
 *
 * Renders visual elements based on Smart Extractor schema:
 *   - Diagrams (hub_spoke, arc, coherence_arc, flowchart, timeline, cycle, comparison, funnel)
 *   - Component blocks (icon_cards, feature_cards, stat_blocks)
 *   - Text highlights (inline accent colors)
 *   - Decorative elements (geometric lines, dividers)
 *   - Branding (logo, footer, pagination)
 *
 * All rendering is data-driven: schema in → HTML/SVG out.
 * Colors come from color_roles, fonts from typography.
 */
(function () {
    'use strict';

    // ═════════════════════════════════════════════════════════════════
    // DIAGRAM ENGINE — SVG generators from semantic data
    // ═════════════════════════════════════════════════════════════════

    var DiagramEngine = {};

    /**
     * Main entry: render diagram SVG string from schema.
     * @param {object} schema - Full template schema with diagram_type, diagram_data, color_roles
     * @param {number} width - Canvas width (default 500)
     * @param {number} height - Canvas height (default 400)
     * @returns {string} SVG markup string
     */
    /**
     * Populate diagram data with slide content (keywords, headline).
     * Replaces generic placeholder labels with actual slide text.
     */
    DiagramEngine._populateWithSlideContent = function (data, slideContext) {
        if (!slideContext || !data) return data;
        var populated = JSON.parse(JSON.stringify(data)); // deep clone
        var keywords = slideContext.keywords || [];
        var headline = slideContext.headline || '';
        var body = slideContext.body || '';

        // Extract meaningful words from headline/body as fallback labels
        var words = [];
        if (keywords.length > 0) {
            words = keywords;
        } else if (headline) {
            words = headline.replace(/[^a-zA-Z0-9\s]/g, '').split(/\s+/).filter(function(w) { return w.length > 3; });
        }

        // Populate center node
        if (populated.center && populated.center.label) {
            if (headline && headline.length < 30) {
                populated.center.label = headline;
            } else if (words.length > 0) {
                populated.center.label = words[0];
            }
        }

        // Populate satellite nodes with keywords
        if (populated.nodes && populated.nodes.length > 0) {
            for (var i = 0; i < populated.nodes.length; i++) {
                if (words.length > 0) {
                    populated.nodes[i].label = words[(i + 1) % words.length] || populated.nodes[i].label;
                }
            }
        }

        // Populate arc/timeline labels
        if (words.length >= 2) {
            if (populated.start_label) populated.start_label = words[0];
            if (populated.end_label) populated.end_label = words[words.length - 1];
        }
        if (headline && populated.center_text) {
            populated.center_text = headline.length < 25 ? headline : (words[0] || populated.center_text);
        }

        // Populate axis
        if (populated.axis) {
            if (words.length >= 2 && populated.axis.label_top) populated.axis.label_top = words[0];
            if (words.length >= 2 && populated.axis.label_bottom) populated.axis.label_bottom = words[1];
        }

        return populated;
    };

    DiagramEngine.render = function (schema, width, height, slideContext) {
        width = width || 500;
        height = height || 400;
        var type = (schema && schema.diagram_type) || 'flowchart';
        var data = (schema && schema.diagram_data) || {};
        var cr = (schema && schema.color_roles) || {};
        var cp = (schema && schema.color_palette) || {};

        // Populate diagram with slide content instead of reference image text
        if (slideContext) {
            data = DiagramEngine._populateWithSlideContent(data, slideContext);
        }

        var colors = {
            stroke: cr.line || cp.primary || '#ffffff',
            muted: cr.muted_line || cp.text_muted || '#9ca3af',
            text: cr.text_primary || cp.text_primary || '#ffffff',
            textSec: cr.text_secondary || cp.text_secondary || '#d1d5db',
            accent: cr.accent || cp.accent || '#f59e0b',
            bg: cr.background || cp.background || '#0f0f11',
            surface: cr.surface || cp.surface || '#18181b'
        };

        var renderer = DiagramEngine._renderers[type] || DiagramEngine._renderers['flowchart'];
        return renderer(data, colors, width, height);
    };

    // ─── Hub-Spoke Diagram ───────────────────────────────────────────
    DiagramEngine._renderHubSpoke = function (data, colors, w, h) {
        var nodes = data.nodes || [];
        var center = data.center || { label: '', style: 'filled_dark' };
        var connStyle = data.connection_style || 'dashed';
        var cx = w / 2;
        var cy = h / 2;
        var radius = Math.min(w, h) * 0.35;
        var centerR = Math.min(w, h) * 0.08;
        var nodeR = Math.min(w, h) * 0.055;
        var n = nodes.length || 1;

        var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h + '" width="100%" height="100%">';

        // Connection lines
        for (var i = 0; i < n; i++) {
            var angle = (2 * Math.PI * i / n) - Math.PI / 2;
            var nx = cx + radius * Math.cos(angle);
            var ny = cy + radius * Math.sin(angle);
            var dashAttr = connStyle === 'dashed' ? ' stroke-dasharray="6,4"' : '';
            svg += '<line x1="' + cx + '" y1="' + cy + '" x2="' + nx + '" y2="' + ny + '"'
                + ' stroke="' + colors.muted + '" stroke-width="1.5"' + dashAttr + ' opacity="0.6"/>';
        }

        // Center node
        var centerFill = center.style === 'filled_accent' ? colors.accent
            : center.style === 'outline' ? 'none'
            : colors.bg;
        var centerStroke = center.style === 'outline' ? colors.stroke : 'none';
        svg += '<circle cx="' + cx + '" cy="' + cy + '" r="' + centerR + '"'
            + ' fill="' + centerFill + '" stroke="' + centerStroke + '" stroke-width="2"/>';
        if (center.label) {
            svg += '<text x="' + cx + '" y="' + (cy + 5) + '" text-anchor="middle"'
                + ' fill="' + colors.text + '" font-size="14" font-weight="700"'
                + ' font-family="Inter, sans-serif">' + _escSvg(center.label) + '</text>';
        }

        // Satellite nodes
        for (var i = 0; i < n; i++) {
            var angle = (2 * Math.PI * i / n) - Math.PI / 2;
            var nx = cx + radius * Math.cos(angle);
            var ny = cy + radius * Math.sin(angle);
            var node = nodes[i] || {};

            // Node circle
            svg += '<circle cx="' + nx + '" cy="' + ny + '" r="' + nodeR + '"'
                + ' fill="none" stroke="' + colors.muted + '" stroke-width="1.5" opacity="0.8"/>';

            // Icon placeholder (Lucide icon name as text for now — will be replaced by Lucide render)
            var iconName = node.icon || 'circle';
            svg += '<text x="' + nx + '" y="' + (ny + 2) + '" text-anchor="middle"'
                + ' fill="' + colors.textSec + '" font-size="18" font-family="Inter, sans-serif"'
                + ' data-lucide-svg="' + _escSvg(iconName) + '">'
                + _getLucideChar(iconName) + '</text>';

            // Label below node
            if (node.label) {
                svg += '<text x="' + nx + '" y="' + (ny + nodeR + 16) + '" text-anchor="middle"'
                    + ' fill="' + colors.textSec + '" font-size="10" font-weight="600"'
                    + ' font-family="Inter, sans-serif" letter-spacing="0.05em" text-transform="uppercase">'
                    + _escSvg(node.label.toUpperCase()) + '</text>';
            }
        }

        svg += '</svg>';
        return svg;
    };

    // ─── Arc / Coherence Arc Diagram ─────────────────────────────────
    DiagramEngine._renderArc = function (data, colors, w, h) {
        var nodes = data.nodes || [];
        var axis = data.axis || {};
        var startLabel = data.start_label || '';
        var endLabel = data.end_label || '';
        var centerText = data.center_text || '';
        var n = nodes.length;

        // U-shape bezier: start top-left, curve down to bottom, back up to top-right
        var padX = w * 0.12;
        var padTop = h * 0.1;
        var padBot = h * 0.08;
        var startX = padX;
        var startY = padTop;
        var endX = w - padX;
        var endY = padTop;
        var bottomY = h - padBot;
        var midX = w / 2;

        // Control points for U-curve
        var cp1x = startX;
        var cp1y = bottomY;
        var cp2x = endX;
        var cp2y = bottomY;

        var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h + '" width="100%" height="100%">';

        // Hatch pattern for "hidden" area
        svg += '<defs>'
            + '<pattern id="diag-hatch" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">'
            + '<line x1="0" y1="0" x2="0" y2="8" stroke="' + colors.muted + '" stroke-width="0.8" opacity="0.3"/>'
            + '</pattern>'
            + '</defs>';

        // Axis line (dashed horizontal)
        var axisY = padTop + (bottomY - padTop) * 0.35;
        if (axis.style !== 'none') {
            svg += '<line x1="' + (padX - 20) + '" y1="' + axisY + '" x2="' + (w - padX + 20) + '" y2="' + axisY + '"'
                + ' stroke="' + colors.muted + '" stroke-width="1" stroke-dasharray="8,5" opacity="0.5"/>';
        }

        // Axis labels
        if (axis.label_top) {
            svg += '<text x="' + (padX - 25) + '" y="' + (axisY - 12) + '"'
                + ' fill="' + colors.textSec + '" font-size="11" font-weight="700"'
                + ' font-family="Inter, sans-serif">' + _escSvg(axis.label_top) + '</text>';
        }
        if (axis.label_bottom) {
            svg += '<text x="' + (padX - 25) + '" y="' + (axisY + 22) + '"'
                + ' fill="' + colors.textSec + '" font-size="11" font-weight="700"'
                + ' font-family="Inter, sans-serif">' + _escSvg(axis.label_bottom) + '</text>';
        }

        // Hatch fill area (below axis, within curve)
        svg += '<path d="M ' + startX + ' ' + axisY + ' C ' + cp1x + ' ' + bottomY + ' ' + cp2x + ' ' + bottomY + ' ' + endX + ' ' + axisY + ' Z"'
            + ' fill="url(#diag-hatch)" opacity="0.5"/>';

        // Center text in hatch area
        if (centerText) {
            svg += '<text x="' + midX + '" y="' + (axisY + (bottomY - axisY) * 0.45) + '"'
                + ' text-anchor="middle" fill="' + colors.text + '" font-size="16" font-weight="700"'
                + ' font-family="Inter, sans-serif">' + _escSvg(centerText) + '</text>';
        }

        // Main U-curve path
        svg += '<path d="M ' + startX + ' ' + startY + ' C ' + cp1x + ' ' + cp1y + ' ' + cp2x + ' ' + cp2y + ' ' + endX + ' ' + endY + '"'
            + ' fill="none" stroke="' + colors.stroke + '" stroke-width="2"/>';

        // Start/end nodes
        svg += '<circle cx="' + startX + '" cy="' + startY + '" r="5" fill="none" stroke="' + colors.stroke + '" stroke-width="1.5"/>';
        svg += '<circle cx="' + endX + '" cy="' + endY + '" r="5" fill="none" stroke="' + colors.stroke + '" stroke-width="1.5"/>';

        // Start/end labels
        if (startLabel) {
            svg += '<text x="' + startX + '" y="' + (startY - 14) + '"'
                + ' fill="' + colors.text + '" font-size="12" font-weight="700"'
                + ' font-family="Inter, sans-serif">' + _escSvg(startLabel) + '</text>';
        }
        if (endLabel) {
            svg += '<text x="' + endX + '" y="' + (endY - 14) + '" text-anchor="end"'
                + ' fill="' + colors.text + '" font-size="12" font-weight="700"'
                + ' font-family="Inter, sans-serif">' + _escSvg(endLabel) + '</text>';
        }

        // Stage nodes along curve
        if (n > 0) {
            for (var i = 0; i < n; i++) {
                var t = (n === 1) ? 0.5 : i / (n - 1);
                var pt = _bezierPoint(startX, startY, cp1x, cp1y, cp2x, cp2y, endX, endY, t);
                var nd = nodes[i] || {};

                svg += '<circle cx="' + pt.x + '" cy="' + pt.y + '" r="4.5"'
                    + ' fill="' + colors.stroke + '" stroke="none"/>';

                // Label — position based on which side of curve
                var labelX = pt.x;
                var labelY = pt.y;
                var anchor = 'start';
                var offsetX = 10;
                var offsetY = 0;

                if (t < 0.3) {
                    // Left descent — label to the right
                    offsetX = 10;
                    offsetY = -5;
                    anchor = 'start';
                } else if (t > 0.7) {
                    // Right ascent — label to the right
                    offsetX = 10;
                    offsetY = -5;
                    anchor = 'start';
                } else {
                    // Bottom — label below
                    offsetX = 0;
                    offsetY = 18;
                    anchor = 'middle';
                }

                if (nd.label) {
                    svg += '<text x="' + (labelX + offsetX) + '" y="' + (labelY + offsetY) + '"'
                        + ' text-anchor="' + anchor + '" fill="' + colors.text + '" font-size="10"'
                        + ' font-family="Inter, sans-serif">' + _escSvg(nd.label) + '</text>';
                }
            }
        }

        svg += '</svg>';
        return svg;
    };

    // ─── Flowchart Diagram ───────────────────────────────────────────
    DiagramEngine._renderFlowchart = function (data, colors, w, h) {
        var nodes = data.nodes || [];
        var n = nodes.length || 3;
        var connStyle = data.connection_style || 'solid';

        var boxW = Math.min(140, (w - 80) / Math.min(n, 3) - 20);
        var boxH = 50;
        var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h + '" width="100%" height="100%">';

        // Layout: if <=4 nodes, horizontal. Otherwise wrap to grid.
        var cols = Math.min(n, 4);
        var rows = Math.ceil(n / cols);
        var gapX = (w - cols * boxW) / (cols + 1);
        var gapY = (h - rows * boxH) / (rows + 1);

        var positions = [];
        for (var i = 0; i < n; i++) {
            var col = i % cols;
            var row = Math.floor(i / cols);
            var x = gapX + col * (boxW + gapX);
            var y = gapY + row * (boxH + gapY);
            positions.push({ x: x, y: y, cx: x + boxW / 2, cy: y + boxH / 2 });
        }

        // Arrows between sequential nodes
        for (var i = 0; i < n - 1; i++) {
            var from = positions[i];
            var to = positions[i + 1];
            var dashAttr = connStyle === 'dashed' ? ' stroke-dasharray="6,4"' : '';
            if (Math.floor(i / cols) === Math.floor((i + 1) / cols)) {
                // Same row — horizontal arrow
                svg += '<line x1="' + (from.x + boxW) + '" y1="' + from.cy + '"'
                    + ' x2="' + to.x + '" y2="' + to.cy + '"'
                    + ' stroke="' + colors.muted + '" stroke-width="1.5"' + dashAttr + '/>';
                // Arrowhead
                svg += '<polygon points="' + to.x + ',' + to.cy + ' ' + (to.x - 8) + ',' + (to.cy - 4) + ' ' + (to.x - 8) + ',' + (to.cy + 4) + '"'
                    + ' fill="' + colors.muted + '"/>';
            } else {
                // Different row — vertical arrow
                svg += '<line x1="' + from.cx + '" y1="' + (from.y + boxH) + '"'
                    + ' x2="' + to.cx + '" y2="' + to.y + '"'
                    + ' stroke="' + colors.muted + '" stroke-width="1.5"' + dashAttr + '/>';
                svg += '<polygon points="' + to.cx + ',' + to.y + ' ' + (to.cx - 4) + ',' + (to.y - 8) + ' ' + (to.cx + 4) + ',' + (to.y - 8) + '"'
                    + ' fill="' + colors.muted + '"/>';
            }
        }

        // Boxes
        for (var i = 0; i < n; i++) {
            var pos = positions[i];
            var nd = nodes[i] || {};
            svg += '<rect x="' + pos.x + '" y="' + pos.y + '" width="' + boxW + '" height="' + boxH + '"'
                + ' rx="8" fill="' + colors.surface + '" stroke="' + colors.muted + '" stroke-width="1"/>';
            svg += '<text x="' + pos.cx + '" y="' + (pos.cy + 4) + '" text-anchor="middle"'
                + ' fill="' + colors.text + '" font-size="11" font-weight="600"'
                + ' font-family="Inter, sans-serif">' + _escSvg(nd.label || ('Step ' + (i + 1))) + '</text>';
        }

        svg += '</svg>';
        return svg;
    };

    // ─── Timeline Diagram ────────────────────────────────────────────
    DiagramEngine._renderTimeline = function (data, colors, w, h) {
        var nodes = data.nodes || [];
        var n = nodes.length || 3;
        var padX = w * 0.1;
        var lineY = h * 0.45;

        var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h + '" width="100%" height="100%">';

        // Main line
        svg += '<line x1="' + padX + '" y1="' + lineY + '" x2="' + (w - padX) + '" y2="' + lineY + '"'
            + ' stroke="' + colors.muted + '" stroke-width="2"/>';

        // Arrow at end
        svg += '<polygon points="' + (w - padX) + ',' + lineY + ' ' + (w - padX - 10) + ',' + (lineY - 5) + ' ' + (w - padX - 10) + ',' + (lineY + 5) + '"'
            + ' fill="' + colors.muted + '"/>';

        // Nodes
        for (var i = 0; i < n; i++) {
            var x = padX + (i / (n - 1 || 1)) * (w - 2 * padX);
            var nd = nodes[i] || {};

            svg += '<circle cx="' + x + '" cy="' + lineY + '" r="6"'
                + ' fill="' + colors.stroke + '" stroke="none"/>';

            // Label alternating above/below
            var above = i % 2 === 0;
            var labelY = above ? lineY - 22 : lineY + 30;

            if (nd.label) {
                svg += '<text x="' + x + '" y="' + labelY + '" text-anchor="middle"'
                    + ' fill="' + colors.text + '" font-size="11" font-weight="600"'
                    + ' font-family="Inter, sans-serif">' + _escSvg(nd.label) + '</text>';
            }
        }

        svg += '</svg>';
        return svg;
    };

    // ─── Cycle Diagram ───────────────────────────────────────────────
    DiagramEngine._renderCycle = function (data, colors, w, h) {
        var nodes = data.nodes || [];
        var n = nodes.length || 4;
        var cx = w / 2;
        var cy = h / 2;
        var radius = Math.min(w, h) * 0.32;

        var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h + '" width="100%" height="100%">';

        // Circular path
        svg += '<circle cx="' + cx + '" cy="' + cy + '" r="' + radius + '"'
            + ' fill="none" stroke="' + colors.muted + '" stroke-width="1.5" stroke-dasharray="6,4" opacity="0.5"/>';

        // Nodes on circle + arrows
        for (var i = 0; i < n; i++) {
            var angle = (2 * Math.PI * i / n) - Math.PI / 2;
            var nx = cx + radius * Math.cos(angle);
            var ny = cy + radius * Math.sin(angle);
            var nd = nodes[i] || {};

            svg += '<circle cx="' + nx + '" cy="' + ny + '" r="6"'
                + ' fill="' + colors.stroke + '" stroke="none"/>';

            // Arrow to next node
            var nextAngle = (2 * Math.PI * ((i + 1) % n) / n) - Math.PI / 2;
            var midAngle = angle + (nextAngle - angle) / 2;
            if (nextAngle < angle) midAngle = angle + (nextAngle + 2 * Math.PI - angle) / 2;
            var ax = cx + (radius + 12) * Math.cos(midAngle);
            var ay = cy + (radius + 12) * Math.sin(midAngle);
            var arrowAngle = midAngle + Math.PI / 2;
            svg += '<polygon points="'
                + ax + ',' + ay + ' '
                + (ax - 5 * Math.cos(arrowAngle - 0.5)) + ',' + (ay - 5 * Math.sin(arrowAngle - 0.5)) + ' '
                + (ax - 5 * Math.cos(arrowAngle + 0.5)) + ',' + (ay - 5 * Math.sin(arrowAngle + 0.5))
                + '" fill="' + colors.muted + '" opacity="0.6"/>';

            // Label outside
            var lx = cx + (radius + 28) * Math.cos(angle);
            var ly = cy + (radius + 28) * Math.sin(angle);
            if (nd.label) {
                svg += '<text x="' + lx + '" y="' + (ly + 4) + '" text-anchor="middle"'
                    + ' fill="' + colors.text + '" font-size="10" font-weight="600"'
                    + ' font-family="Inter, sans-serif">' + _escSvg(nd.label) + '</text>';
            }
        }

        svg += '</svg>';
        return svg;
    };

    // ─── Comparison Diagram ──────────────────────────────────────────
    DiagramEngine._renderComparison = function (data, colors, w, h) {
        var nodes = data.nodes || [];
        var leftNodes = [];
        var rightNodes = [];
        for (var i = 0; i < nodes.length; i++) {
            if (i < Math.ceil(nodes.length / 2)) leftNodes.push(nodes[i]);
            else rightNodes.push(nodes[i]);
        }

        var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h + '" width="100%" height="100%">';

        // Vertical divider
        svg += '<line x1="' + (w / 2) + '" y1="' + (h * 0.1) + '" x2="' + (w / 2) + '" y2="' + (h * 0.9) + '"'
            + ' stroke="' + colors.muted + '" stroke-width="1" stroke-dasharray="6,4" opacity="0.4"/>';

        // Left side header
        if (data.start_label) {
            svg += '<text x="' + (w * 0.25) + '" y="' + (h * 0.08) + '" text-anchor="middle"'
                + ' fill="' + colors.text + '" font-size="13" font-weight="700"'
                + ' font-family="Inter, sans-serif">' + _escSvg(data.start_label) + '</text>';
        }
        // Right side header
        if (data.end_label) {
            svg += '<text x="' + (w * 0.75) + '" y="' + (h * 0.08) + '" text-anchor="middle"'
                + ' fill="' + colors.text + '" font-size="13" font-weight="700"'
                + ' font-family="Inter, sans-serif">' + _escSvg(data.end_label) + '</text>';
        }

        // Left items
        var itemH = 40;
        var startY = h * 0.15;
        leftNodes.forEach(function (nd, i) {
            var y = startY + i * (itemH + 10);
            svg += '<rect x="' + (w * 0.05) + '" y="' + y + '" width="' + (w * 0.4) + '" height="' + itemH + '"'
                + ' rx="6" fill="' + colors.surface + '" stroke="' + colors.muted + '" stroke-width="0.5"/>';
            svg += '<text x="' + (w * 0.25) + '" y="' + (y + itemH / 2 + 4) + '" text-anchor="middle"'
                + ' fill="' + colors.text + '" font-size="11" font-family="Inter, sans-serif">'
                + _escSvg(nd.label || '') + '</text>';
        });

        // Right items
        rightNodes.forEach(function (nd, i) {
            var y = startY + i * (itemH + 10);
            svg += '<rect x="' + (w * 0.55) + '" y="' + y + '" width="' + (w * 0.4) + '" height="' + itemH + '"'
                + ' rx="6" fill="' + colors.surface + '" stroke="' + colors.muted + '" stroke-width="0.5"/>';
            svg += '<text x="' + (w * 0.75) + '" y="' + (y + itemH / 2 + 4) + '" text-anchor="middle"'
                + ' fill="' + colors.text + '" font-size="11" font-family="Inter, sans-serif">'
                + _escSvg(nd.label || '') + '</text>';
        });

        svg += '</svg>';
        return svg;
    };

    // ─── Funnel Diagram ──────────────────────────────────────────────
    DiagramEngine._renderFunnel = function (data, colors, w, h) {
        var nodes = data.nodes || [];
        var n = nodes.length || 3;
        var padX = w * 0.08;
        var padY = h * 0.08;
        var stepH = (h - 2 * padY) / n;

        var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h + '" width="100%" height="100%">';

        for (var i = 0; i < n; i++) {
            var topWidth = w - 2 * padX - (i * (w * 0.12));
            var botWidth = w - 2 * padX - ((i + 1) * (w * 0.12));
            var y = padY + i * stepH;
            var topX = (w - topWidth) / 2;
            var botX = (w - botWidth) / 2;
            var nd = nodes[i] || {};

            svg += '<path d="M ' + topX + ' ' + y + ' L ' + (topX + topWidth) + ' ' + y
                + ' L ' + (botX + botWidth) + ' ' + (y + stepH) + ' L ' + botX + ' ' + (y + stepH) + ' Z"'
                + ' fill="' + colors.surface + '" stroke="' + colors.muted + '" stroke-width="1" opacity="' + (0.5 + 0.5 * (1 - i / n)) + '"/>';

            svg += '<text x="' + (w / 2) + '" y="' + (y + stepH / 2 + 4) + '" text-anchor="middle"'
                + ' fill="' + colors.text + '" font-size="12" font-weight="600"'
                + ' font-family="Inter, sans-serif">' + _escSvg(nd.label || ('Stage ' + (i + 1))) + '</text>';
        }

        svg += '</svg>';
        return svg;
    };

    // Renderer map
    DiagramEngine._renderers = {
        'hub_spoke': DiagramEngine._renderHubSpoke,
        'arc': DiagramEngine._renderArc,
        'coherence_arc': DiagramEngine._renderArc,
        'flowchart': DiagramEngine._renderFlowchart,
        'timeline': DiagramEngine._renderTimeline,
        'cycle': DiagramEngine._renderCycle,
        'comparison': DiagramEngine._renderComparison,
        'funnel': DiagramEngine._renderFunnel
    };


    // ═════════════════════════════════════════════════════════════════
    // COMPONENT RENDERER — HTML generators for cards, stats, etc.
    // ═════════════════════════════════════════════════════════════════

    var ComponentRenderer = {};

    /**
     * Render component blocks from schema.
     * @param {Array} blocks - component_blocks array from schema
     * @param {object} colors - color_roles + color_palette merged
     * @returns {string} HTML string
     */
    ComponentRenderer.render = function (blocks, schema) {
        if (!blocks || !blocks.length) return '';
        var cr = (schema && schema.color_roles) || {};
        var cp = (schema && schema.color_palette) || {};

        var html = '';
        blocks.forEach(function (block) {
            var renderer = ComponentRenderer._renderers[block.type];
            if (renderer) {
                html += '<div class="ve-component-block ve-block-' + block.type + '"'
                    + ' style="display:flex; justify-content:center; padding:12px 0;">'
                    + renderer(block, cr, cp)
                    + '</div>';
            }
        });
        return html;
    };

    // ─── Icon Cards ──────────────────────────────────────────────────
    ComponentRenderer._renderIconCards = function (block, cr, cp) {
        var items = block.items || [];
        var layout = block.layout || 'horizontal';
        var direction = layout === 'vertical' ? 'column' : 'row';

        var html = '<div style="display:flex; flex-direction:' + direction
            + '; gap:12px; align-items:flex-end; justify-content:center;">';

        items.forEach(function (item, idx) {
            var bgColor = item.style === 'dark' ? (cr.background || '#0f0f11')
                : item.style === 'accent' ? (item.color || cr.accent || cp.accent || '#4ade80')
                : (cr.surface || cp.surface || '#e5e5e5');
            var textColor = item.style === 'dark' ? (item.color || cr.accent || '#4ade80')
                : item.style === 'accent' ? '#ffffff'
                : (cr.text_secondary || cp.text_secondary || '#374151');
            var scale = item.style === 'elevated' || item.style === 'dark' ? 'transform:scale(1.08); z-index:2;' : '';
            var size = item.style === 'elevated' || item.style === 'dark' ? '90px' : '80px';

            html += '<div style="width:' + size + '; height:' + size + '; border-radius:14px;'
                + ' background:' + bgColor + '; display:flex; flex-direction:column;'
                + ' align-items:center; justify-content:center; gap:6px; ' + scale + '">'
                + '<i data-lucide="' + _escHtml(item.icon || 'circle') + '"'
                + ' style="width:28px; height:28px; color:' + textColor + ';"></i>'
                + '<span style="font-size:8px; font-weight:700; letter-spacing:0.08em;'
                + ' color:' + textColor + '; text-transform:uppercase;'
                + ' font-family:\'IBM Plex Mono\', monospace;">'
                + _escHtml((item.label || '').toUpperCase()) + '</span>'
                + '</div>';
        });

        html += '</div>';
        return html;
    };

    // ─── Feature Cards ───────────────────────────────────────────────
    ComponentRenderer._renderFeatureCards = function (block, cr, cp) {
        var items = block.items || [];
        var html = '<div style="display:flex; gap:14px; justify-content:center; flex-wrap:wrap;">';

        items.forEach(function (item) {
            var accentColor = item.color || cr.accent || cp.accent || '#4ade80';
            var bgColor = cr.surface || cp.surface || '#18181b';
            var textColor = cr.text_primary || cp.text_primary || '#ffffff';
            var textSecColor = cr.text_secondary || cp.text_secondary || '#d1d5db';

            html += '<div style="width:180px; padding:16px; border-radius:12px;'
                + ' background:' + bgColor + '; border-top:3px solid ' + accentColor + ';">'
                + '<div style="width:36px; height:36px; border-radius:8px;'
                + ' background:' + accentColor + '22; display:flex; align-items:center; justify-content:center; margin-bottom:10px;">'
                + '<i data-lucide="' + _escHtml(item.icon || 'circle') + '"'
                + ' style="width:18px; height:18px; color:' + accentColor + ';"></i>'
                + '</div>'
                + '<div style="font-size:13px; font-weight:700; color:' + textColor + ';'
                + ' font-family:\'IBM Plex Mono\', monospace; margin-bottom:6px;">'
                + _escHtml(item.title || item.label || '') + '</div>'
                + '<div style="font-size:11px; color:' + textSecColor + ';'
                + ' font-family:Inter, sans-serif; line-height:1.4;">'
                + _escHtml(item.description || '') + '</div>'
                + '</div>';
        });

        html += '</div>';
        return html;
    };

    // ─── Stat Blocks ─────────────────────────────────────────────────
    ComponentRenderer._renderStatBlocks = function (block, cr, cp) {
        var items = block.items || [];
        var html = '<div style="display:flex; gap:24px; justify-content:center; align-items:baseline;">';

        items.forEach(function (item) {
            var accentColor = item.color || cr.accent || cp.accent || '#4ade80';
            var textColor = cr.text_primary || cp.text_primary || '#ffffff';
            html += '<div style="text-align:center;">'
                + '<div style="font-size:48px; font-weight:900; color:' + textColor + ';'
                + ' font-family:Inter, sans-serif; line-height:1;">'
                + _escHtml(item.title || item.label || '') + '</div>'
                + '<div style="font-size:13px; color:' + (cr.text_secondary || cp.text_secondary || '#9ca3af') + ';'
                + ' font-family:Inter, sans-serif; margin-top:4px;">'
                + _escHtml(item.description || '') + '</div>'
                + '</div>';
        });

        html += '</div>';
        return html;
    };

    // ─── Icon Grid ───────────────────────────────────────────────────
    ComponentRenderer._renderIconGrid = function (block, cr, cp) {
        var items = block.items || [];
        var html = '<div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(60px, 1fr));'
            + ' gap:16px; justify-items:center; max-width:320px; margin:0 auto;">';

        items.forEach(function (item) {
            var color = item.color || cr.text_secondary || cp.text_secondary || '#9ca3af';
            html += '<div style="text-align:center;">'
                + '<i data-lucide="' + _escHtml(item.icon || 'circle') + '"'
                + ' style="width:24px; height:24px; color:' + color + '; display:block; margin:0 auto 4px;"></i>'
                + '<span style="font-size:9px; color:' + color + '; font-family:Inter, sans-serif;">'
                + _escHtml(item.label || '') + '</span>'
                + '</div>';
        });

        html += '</div>';
        return html;
    };

    ComponentRenderer._renderers = {
        'icon_card': ComponentRenderer._renderIconCards,
        'feature_card': ComponentRenderer._renderFeatureCards,
        'stat_block': ComponentRenderer._renderStatBlocks,
        'icon_grid': ComponentRenderer._renderIconGrid,
        'quote_block': function (block, cr, cp) {
            var item = (block.items && block.items[0]) || {};
            return '<div style="font-size:18px; font-style:italic; color:' + (cr.text_primary || '#fff') + ';'
                + ' font-family:\'Playfair Display\', serif; text-align:center; max-width:400px; margin:0 auto;'
                + ' border-left:3px solid ' + (cr.accent || '#f59e0b') + '; padding-left:16px;">'
                + _escHtml(item.description || item.title || '') + '</div>';
        }
    };


    // ═════════════════════════════════════════════════════════════════
    // TEXT HIGHLIGHT RENDERER — Inline accent colors on text
    // ═════════════════════════════════════════════════════════════════

    var TextHighlighter = {};

    /**
     * Apply text highlights to a string.
     * Returns HTML with <span> tags for highlighted phrases.
     * @param {string} text - Original text
     * @param {Array} highlights - text_highlights array from schema
     * @returns {string} HTML string with highlight spans
     */
    TextHighlighter.apply = function (text, highlights) {
        if (!text || !highlights || !highlights.length) return _escHtml(text || '');

        // Sort highlights by phrase length (longest first) to avoid partial matches
        var sorted = highlights.slice().sort(function (a, b) {
            return (b.phrase || '').length - (a.phrase || '').length;
        });

        // Build a map of replacements
        var result = text;
        var placeholders = [];

        sorted.forEach(function (h, idx) {
            if (!h.phrase) return;
            var placeholder = '##HL' + idx + '##';
            var escapedPhrase = h.phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            var regex = new RegExp(escapedPhrase, 'gi');
            result = result.replace(regex, function (match) {
                placeholders.push({
                    placeholder: placeholder,
                    html: '<span style="color:' + (h.color || '#ffffff') + ';'
                        + (h.style === 'italic' || h.style === 'bold_italic' ? ' font-style:italic;' : '')
                        + (h.style === 'bold' || h.style === 'bold_italic' ? ' font-weight:700;' : '')
                        + '">' + _escHtml(match) + '</span>'
                });
                return placeholder;
            });
        });

        // Escape remaining text, then replace placeholders with HTML
        var escaped = _escHtml(result);
        placeholders.forEach(function (p) {
            escaped = escaped.replace(p.placeholder, p.html);
        });

        return escaped;
    };


    // ═════════════════════════════════════════════════════════════════
    // DECORATIVE RENDERER — Geometric backgrounds, dividers
    // ═════════════════════════════════════════════════════════════════

    var DecorativeRenderer = {};

    /**
     * Generate decorative SVG overlay for canvas background.
     * @param {object} deco - decorative_elements from schema
     * @param {object} colors - color roles
     * @param {number} w - canvas width
     * @param {number} h - canvas height
     * @returns {string} SVG string (positioned as absolute overlay)
     */
    DecorativeRenderer.renderBackground = function (deco, colors, w, h) {
        if (!deco || !deco.geometric_lines) return '';
        w = w || 1080;
        h = h || 1080;
        var c = colors.muted || '#9ca3af';

        var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h
            + '" width="100%" height="100%" style="position:absolute;top:0;left:0;pointer-events:none;z-index:1;">';

        // Subtle geometric lines in corners
        // Top-right triangle
        svg += '<path d="M ' + (w * 0.85) + ' ' + (h * 0.03) + ' L ' + (w * 0.95) + ' ' + (h * 0.03) + ' L ' + (w * 0.92) + ' ' + (h * 0.10) + ' Z"'
            + ' fill="none" stroke="' + c + '" stroke-width="0.5" opacity="0.3"/>';
        // Top-right small dots
        svg += '<circle cx="' + (w * 0.88) + '" cy="' + (h * 0.05) + '" r="1.5" fill="' + c + '" opacity="0.2"/>';
        svg += '<circle cx="' + (w * 0.93) + '" cy="' + (h * 0.08) + '" r="1.5" fill="' + c + '" opacity="0.2"/>';

        // Bottom-left geometric
        svg += '<path d="M ' + (w * 0.04) + ' ' + (h * 0.88) + ' L ' + (w * 0.10) + ' ' + (h * 0.92) + '"'
            + ' fill="none" stroke="' + c + '" stroke-width="0.5" opacity="0.25"/>';
        svg += '<path d="M ' + (w * 0.06) + ' ' + (h * 0.93) + ' L ' + (w * 0.12) + ' ' + (h * 0.90) + '"'
            + ' fill="none" stroke="' + c + '" stroke-width="0.5" opacity="0.25"/>';

        // Bottom-right angle
        svg += '<path d="M ' + (w * 0.88) + ' ' + (h * 0.90) + ' L ' + (w * 0.94) + ' ' + (h * 0.88) + ' L ' + (w * 0.92) + ' ' + (h * 0.95) + '"'
            + ' fill="none" stroke="' + c + '" stroke-width="0.5" opacity="0.2"/>';

        // Scattered small dots
        var dotPositions = [
            [0.15, 0.12], [0.82, 0.25], [0.08, 0.55], [0.92, 0.60],
            [0.20, 0.85], [0.78, 0.82], [0.50, 0.05], [0.55, 0.95]
        ];
        dotPositions.forEach(function (pos) {
            svg += '<circle cx="' + (w * pos[0]) + '" cy="' + (h * pos[1]) + '" r="1" fill="' + c + '" opacity="0.15"/>';
        });

        svg += '</svg>';
        return svg;
    };

    /**
     * Render a short colored divider.
     * @returns {string} HTML div
     */
    DecorativeRenderer.renderDivider = function (deco, colors) {
        if (!deco || deco.divider_style === 'none') return '';
        var color = deco.divider_color || colors.accent || '#f59e0b';
        if (deco.divider_style === 'short_colored') {
            return '<div style="width:40px; height:3px; background:' + color + '; margin:8px auto; border-radius:2px;"></div>';
        }
        if (deco.divider_style === 'full_dashed') {
            return '<div style="width:80%; max-width:400px; height:0; border-top:1px dashed ' + color + '; margin:12px auto; opacity:0.5;"></div>';
        }
        return '';
    };


    // ═════════════════════════════════════════════════════════════════
    // BRANDING RENDERER
    // ═════════════════════════════════════════════════════════════════

    var BrandingRenderer = {};

    /**
     * Render branding overlay (logo, footer, pagination).
     * @returns {string} HTML string (positioned absolute)
     */
    BrandingRenderer.render = function (branding, colors) {
        if (!branding) return '';
        var c = colors || {};
        var textColor = c.text_muted || c.text_secondary || '#9ca3af';
        var html = '';

        // Logo area
        if (branding.logo_text && branding.logo_position !== 'none') {
            html += '<div style="position:absolute; top:20px;'
                + (branding.logo_position === 'top_center' ? ' left:50%; transform:translateX(-50%);' : ' left:24px;')
                + ' font-size:11px; font-weight:700; letter-spacing:0.15em; color:' + textColor + ';'
                + ' font-family:Inter, sans-serif; text-transform:uppercase; z-index:5;">'
                + _escHtml(branding.logo_text) + '</div>';
        }

        // Footer left
        if (branding.footer_left) {
            html += '<div style="position:absolute; bottom:20px; left:24px;'
                + ' font-size:10px; color:' + textColor + '; font-family:Inter, sans-serif; z-index:5; opacity:0.7;">'
                + _escHtml(branding.footer_left) + '</div>';
        }

        // Footer right
        if (branding.footer_right) {
            html += '<div style="position:absolute; bottom:20px; right:24px;'
                + ' font-size:10px; color:' + textColor + '; font-family:Inter, sans-serif; z-index:5; opacity:0.7;">'
                + _escHtml(branding.footer_right) + '</div>';
        }

        // Pagination
        if (branding.pagination) {
            html += '<div style="position:absolute; bottom:12px; left:50%; transform:translateX(-50%);'
                + ' display:flex; gap:4px; z-index:5;">';
            for (var i = 0; i < 8; i++) {
                html += '<div style="width:6px; height:6px; border-radius:50%;'
                    + ' background:' + textColor + '; opacity:' + (i === 0 ? '1' : '0.3') + ';"></div>';
            }
            html += '</div>';
        }

        return html;
    };


    // ═════════════════════════════════════════════════════════════════
    // MAIN VISUAL ENGINE — Orchestrator
    // ═════════════════════════════════════════════════════════════════

    function VisualEngine() {
        this._currentSchema = null;
    }

    /**
     * Render all visual elements for a slide based on schema.
     * Returns { diagramHtml, componentHtml, decorativeHtml, brandingHtml }
     */
    VisualEngine.prototype.renderAll = function (schema, slideContext) {
        this._currentSchema = schema || {};
        var cr = schema.color_roles || {};
        var cp = schema.color_palette || {};
        var colors = {
            stroke: cr.line || cp.primary || '#ffffff',
            muted: cr.muted_line || cp.text_muted || '#9ca3af',
            text: cr.text_primary || cp.text_primary || '#ffffff',
            textSec: cr.text_secondary || cp.text_secondary || '#d1d5db',
            accent: cr.accent || cp.accent || '#f59e0b',
            bg: cr.background || cp.background || '#0f0f11',
            surface: cr.surface || cp.surface || '#18181b',
            text_muted: cp.text_muted || '#9ca3af'
        };

        var result = {
            diagramHtml: '',
            componentHtml: '',
            decorativeHtml: '',
            brandingHtml: '',
            dividerHtml: ''
        };

        // Diagram
        if (schema.visual_mode === 'diagram' && schema.diagram_data) {
            result.diagramHtml = DiagramEngine.render(schema, 480, 380, slideContext);
        }

        // Component blocks
        if (schema.component_blocks && schema.component_blocks.length) {
            result.componentHtml = ComponentRenderer.render(schema.component_blocks, schema);
        }

        // Decorative background
        if (schema.decorative_elements) {
            result.decorativeHtml = DecorativeRenderer.renderBackground(schema.decorative_elements, colors, 500, 500);
            result.dividerHtml = DecorativeRenderer.renderDivider(schema.decorative_elements, colors);
        }

        // Branding
        if (schema.branding) {
            result.brandingHtml = BrandingRenderer.render(schema.branding, colors);
        }

        return result;
    };

    /**
     * Apply text highlights to a text string.
     */
    VisualEngine.prototype.highlightText = function (text, highlights) {
        return TextHighlighter.apply(text, highlights);
    };

    /**
     * Get available diagram types.
     */
    VisualEngine.prototype.getDiagramTypes = function () {
        return Object.keys(DiagramEngine._renderers);
    };


    // ═════════════════════════════════════════════════════════════════
    // HELPERS
    // ═════════════════════════════════════════════════════════════════

    function _escSvg(str) {
        return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function _escHtml(str) {
        return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function _bezierPoint(x0, y0, x1, y1, x2, y2, x3, y3, t) {
        var u = 1 - t;
        return {
            x: u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
            y: u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3
        };
    }

    function _getLucideChar(iconName) {
        // Return a simple unicode placeholder for SVG text elements
        // Actual Lucide icons will be rendered by the DOM post-process
        var map = {
            'mail': '\u2709', 'code': '\u2039\u203A', 'calendar': '\u25A1',
            'message-square': '\u25A1', 'file-text': '\u25A1', 'dollar-sign': '$',
            'bot': '\u2699', 'monitor': '\u25A1', 'search': '\u26B2',
            'circle': '\u25CB'
        };
        return map[iconName] || '\u25CB';
    }


    // ═════════════════════════════════════════════════════════════════
    // EXPORTS
    // ═════════════════════════════════════════════════════════════════

    window.VisualEngine = VisualEngine;
    window.DiagramEngine = DiagramEngine;
    window.ComponentRenderer = ComponentRenderer;
    window.TextHighlighter = TextHighlighter;
    window.DecorativeRenderer = DecorativeRenderer;
    window.BrandingRenderer = BrandingRenderer;

})();
