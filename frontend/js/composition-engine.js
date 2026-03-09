/**
 * CompositionEngine — Converts slide data + template preset → Composition JSON
 * for Fabric.js rendering. This replaces the simple HTML/CSS layout system
 * with pixel-level element positioning and rich decorative elements.
 *
 * Jadisatu.cloud — Auto-Design Engine Phase 1
 */
var CompositionEngine = (function() {
    'use strict';

    var CANVAS_W = 1080;
    var CANVAS_H = 1080;
    var PAD = 80; // standard padding from edges

    // ─── Color Utilities ────────────────────────────────
    function hexToRgba(hex, alpha) {
        if (!hex) return 'rgba(0,0,0,' + alpha + ')';
        hex = hex.replace('#', '');
        if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
        var r = parseInt(hex.substring(0, 2), 16);
        var g = parseInt(hex.substring(2, 4), 16);
        var b = parseInt(hex.substring(4, 6), 16);
        return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
    }

    function lightenColor(hex, amount) {
        hex = hex.replace('#', '');
        var r = Math.min(255, parseInt(hex.substring(0, 2), 16) + amount);
        var g = Math.min(255, parseInt(hex.substring(2, 4), 16) + amount);
        var b = Math.min(255, parseInt(hex.substring(4, 6), 16) + amount);
        return '#' + r.toString(16).padStart(2,'0') + g.toString(16).padStart(2,'0') + b.toString(16).padStart(2,'0');
    }

    function darkenColor(hex, amount) {
        hex = hex.replace('#', '');
        var r = Math.max(0, parseInt(hex.substring(0, 2), 16) - amount);
        var g = Math.max(0, parseInt(hex.substring(2, 4), 16) - amount);
        var b = Math.max(0, parseInt(hex.substring(4, 6), 16) - amount);
        return '#' + r.toString(16).padStart(2,'0') + g.toString(16).padStart(2,'0') + b.toString(16).padStart(2,'0');
    }

    function isDarkBg(hex) {
        if (!hex) return true;
        hex = hex.replace('#', '');
        var r = parseInt(hex.substring(0, 2), 16);
        var g = parseInt(hex.substring(2, 4), 16);
        var b = parseInt(hex.substring(4, 6), 16);
        return (r * 0.299 + g * 0.587 + b * 0.114) < 128;
    }

    // ─── Resolve effective colors from template + slide ──
    function resolveColors(tpl, slide) {
        var bgVariant = slide._bgVariant || 'default';
        var darkTemplates = ['minimal-dark', 'bold-gradient', 'neon-dark'];
        var lightTemplates = ['minimal-light', 'professional', 'warm-earth'];
        var presetName = tpl._presetName || '';
        var isDarkTpl = darkTemplates.indexOf(presetName) !== -1;
        var isLightTpl = lightTemplates.indexOf(presetName) !== -1;

        var bg = tpl.bg || '#0f0f11';
        var headline = tpl.headline_color || '#ffffff';
        var body = tpl.body_color || 'rgba(255,255,255,0.7)';
        var accent = tpl.accent || '#8b5cf6';
        var accentLight = tpl.accent_light || hexToRgba(accent, 0.15);
        var surface = tpl.surface || hexToRgba(bg, 0.6);
        var invertedToLight = false;
        var invertedToDark = false;

        if (bgVariant === 'dark' && isLightTpl) {
            bg = '#0f0f11'; headline = '#ffffff'; body = 'rgba(255,255,255,0.7)';
            invertedToDark = true;
        } else if (bgVariant === 'light' && isDarkTpl) {
            bg = '#f5f5f0'; headline = '#1a1a1a'; body = 'rgba(26,26,26,0.7)';
            invertedToLight = true;
        }

        var layoutType = slide._layoutType || 'default';
        if ((layoutType === 'dramatic-closer' || layoutType === 'quote-highlight') && invertedToLight) {
            bg = tpl.bg || '#0f0f11';
            headline = tpl.headline_color || '#ffffff';
            body = tpl.body_color || 'rgba(255,255,255,0.7)';
            invertedToLight = false;
        }

        return {
            bg: bg,
            headline: headline,
            body: body,
            accent: accent,
            accentLight: accentLight,
            surface: surface,
            isDark: isDarkBg(bg.replace(/rgba?\([^)]+\)/, '#0f0f11')),
            invertedToLight: invertedToLight,
            invertedToDark: invertedToDark
        };
    }

    // ─── Decorative Elements Generator ──────────────────
    function generateDecorations(colors, layoutType, tpl, slideIndex) {
        var elements = [];
        var accent = colors.accent;
        var isDark = colors.isDark;

        // Accent glow blob — top right
        elements.push({
            type: 'circle',
            id: 'deco-glow-1',
            left: CANVAS_W - 200,
            top: -60,
            radius: 180,
            fill: hexToRgba(accent, isDark ? 0.12 : 0.08),
            selectable: false,
            evented: false
        });

        // Secondary glow blob — bottom left
        elements.push({
            type: 'circle',
            id: 'deco-glow-2',
            left: -80,
            top: CANVAS_H - 300,
            radius: 160,
            fill: hexToRgba(accent, isDark ? 0.08 : 0.05),
            selectable: false,
            evented: false
        });

        // Accent line — varies by layout
        if (layoutType === 'hero-center') {
            // Short accent line below center
            elements.push({
                type: 'rect',
                id: 'deco-accent-line',
                left: CANVAS_W / 2 - 40,
                top: CANVAS_H / 2 + 80,
                width: 80,
                height: 4,
                fill: accent,
                rx: 2, ry: 2,
                selectable: false,
                evented: false
            });
        } else if (layoutType === 'card-detail' || layoutType === 'split-visual') {
            // Vertical accent line on left
            elements.push({
                type: 'rect',
                id: 'deco-accent-line',
                left: PAD - 16,
                top: CANVAS_H * 0.3,
                width: 4,
                height: 120,
                fill: accent,
                rx: 2, ry: 2,
                selectable: false,
                evented: false
            });
        } else if (layoutType === 'quote-highlight') {
            // Decorative quote mark
            elements.push({
                type: 'textbox',
                id: 'deco-quote-mark',
                left: PAD - 10,
                top: CANVAS_H * 0.25,
                text: '\u201C',
                fontSize: 200,
                fontFamily: 'Georgia, serif',
                fill: hexToRgba(accent, 0.2),
                selectable: false,
                evented: false
            });
        }

        // Corner dot cluster (subtle decorative)
        if (layoutType !== 'dramatic-closer') {
            var dotY = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
            for (var row = 0; row < 4; row++) {
                for (var col = 0; col < 4; col++) {
                    elements.push({
                        type: 'circle',
                        id: 'deco-dot-' + row + '-' + col,
                        left: CANVAS_W - 160 + col * 20,
                        top: CANVAS_H - 160 + row * 20,
                        radius: 2,
                        fill: dotY,
                        selectable: false,
                        evented: false
                    });
                }
            }
        }

        // Subtle border frame for card-detail
        if (layoutType === 'card-detail') {
            elements.push({
                type: 'rect',
                id: 'deco-card-frame',
                left: PAD - 20,
                top: CANVAS_H * 0.2,
                width: CANVAS_W - (PAD - 20) * 2,
                height: CANVAS_H * 0.55,
                fill: 'transparent',
                stroke: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                strokeWidth: 1,
                rx: 16, ry: 16,
                selectable: false,
                evented: false
            });
        }

        // Slide number watermark (large, faded)
        if (layoutType !== 'hero-center' && layoutType !== 'dramatic-closer') {
            elements.push({
                type: 'textbox',
                id: 'deco-slide-number',
                left: CANVAS_W - PAD - 60,
                top: PAD - 20,
                text: String(slideIndex + 1),
                fontSize: 120,
                fontWeight: '900',
                fontFamily: tpl.font || 'Inter, sans-serif',
                fill: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                textAlign: 'right',
                selectable: false,
                evented: false
            });
        }

        return elements;
    }

    // ─── Layout Position Maps ───────────────────────────
    // Each layout returns positions for: icon, headline, body, badge, footer

    var LAYOUTS = {
        'hero-center': function(colors, hasIcon) {
            return {
                icon: hasIcon ? { left: CANVAS_W / 2 - 48, top: CANVAS_H * 0.3, size: 96 } : null,
                headline: {
                    left: PAD, top: hasIcon ? CANVAS_H * 0.42 : CANVAS_H * 0.35,
                    width: CANVAS_W - PAD * 2,
                    fontSize: 64, fontWeight: '700',
                    textAlign: 'center'
                },
                body: null, // hero-center hides body
                badge: { left: CANVAS_W / 2 - 16, top: CANVAS_H * 0.82, size: 32 }
            };
        },
        'card-detail': function(colors, hasIcon) {
            var cardTop = CANVAS_H * 0.22;
            var cardLeft = PAD;
            var cardW = CANVAS_W - PAD * 2;
            return {
                icon: hasIcon ? { left: cardLeft + 24, top: cardTop + 24, size: 72 } : null,
                headline: {
                    left: cardLeft + 24,
                    top: hasIcon ? cardTop + 120 : cardTop + 24,
                    width: cardW - 48,
                    fontSize: 44, fontWeight: '700',
                    textAlign: 'left'
                },
                body: {
                    left: cardLeft + 24,
                    top: hasIcon ? cardTop + 220 : cardTop + 120,
                    width: cardW - 48,
                    fontSize: 26, fontWeight: '400',
                    textAlign: 'left',
                    lineHeight: 1.5
                },
                badge: { left: PAD, top: PAD, size: 28 }
            };
        },
        'text-heavy': function(colors, hasIcon) {
            return {
                icon: null, // text-heavy hides visual
                headline: {
                    left: PAD, top: CANVAS_H * 0.15,
                    width: CANVAS_W - PAD * 2,
                    fontSize: 40, fontWeight: '700',
                    textAlign: 'left'
                },
                body: {
                    left: PAD, top: CANVAS_H * 0.3,
                    width: CANVAS_W - PAD * 2,
                    fontSize: 24, fontWeight: '400',
                    textAlign: 'left',
                    lineHeight: 1.6
                },
                badge: { left: PAD, top: PAD - 20, size: 28 }
            };
        },
        'dramatic-closer': function(colors, hasIcon) {
            return {
                icon: null,
                headline: {
                    left: PAD, top: CANVAS_H * 0.35,
                    width: CANVAS_W - PAD * 2,
                    fontSize: 60, fontWeight: '800',
                    textAlign: 'center'
                },
                body: {
                    left: PAD + 60, top: CANVAS_H * 0.58,
                    width: CANVAS_W - PAD * 2 - 120,
                    fontSize: 24, fontWeight: '400',
                    textAlign: 'center',
                    lineHeight: 1.5
                },
                badge: null
            };
        },
        'split-visual': function(colors, hasIcon) {
            var splitX = CANVAS_W * 0.42; // visual takes 42%, text takes 58%
            return {
                icon: hasIcon ? { left: splitX / 2 - 56, top: CANVAS_H * 0.38, size: 112 } : null,
                headline: {
                    left: splitX + 24, top: CANVAS_H * 0.3,
                    width: CANVAS_W - splitX - PAD - 24,
                    fontSize: 42, fontWeight: '700',
                    textAlign: 'left'
                },
                body: {
                    left: splitX + 24, top: CANVAS_H * 0.48,
                    width: CANVAS_W - splitX - PAD - 24,
                    fontSize: 22, fontWeight: '400',
                    textAlign: 'left',
                    lineHeight: 1.5
                },
                badge: { left: splitX + 24, top: PAD, size: 28 }
            };
        },
        'quote-highlight': function(colors, hasIcon) {
            return {
                icon: null,
                headline: {
                    left: PAD + 40, top: CANVAS_H * 0.3,
                    width: CANVAS_W - PAD * 2 - 80,
                    fontSize: 48, fontWeight: '600',
                    fontStyle: 'italic',
                    textAlign: 'center',
                    lineHeight: 1.4
                },
                body: {
                    left: PAD + 60, top: CANVAS_H * 0.62,
                    width: CANVAS_W - PAD * 2 - 120,
                    fontSize: 22, fontWeight: '400',
                    textAlign: 'center',
                    lineHeight: 1.5
                },
                badge: null
            };
        },
        'list-bullets': function(colors, hasIcon) {
            return {
                icon: hasIcon ? { left: PAD, top: PAD + 10, size: 64 } : null,
                headline: {
                    left: hasIcon ? PAD + 80 : PAD,
                    top: PAD + 10,
                    width: hasIcon ? CANVAS_W - PAD * 2 - 80 : CANVAS_W - PAD * 2,
                    fontSize: 38, fontWeight: '700',
                    textAlign: 'left'
                },
                body: {
                    left: PAD, top: CANVAS_H * 0.2,
                    width: CANVAS_W - PAD * 2,
                    fontSize: 26, fontWeight: '400',
                    textAlign: 'left',
                    lineHeight: 1.7
                },
                badge: { left: PAD, top: CANVAS_H - PAD - 40, size: 28 }
            };
        }
    };

    // Default layout fallback
    LAYOUTS['default'] = LAYOUTS['split-visual'];

    // ─── Icon Background Shape ──────────────────────────
    function buildIconElements(pos, iconName, colors, tpl) {
        if (!pos) return [];
        var accent = colors.accent;
        var isDark = colors.isDark;
        var iconStyle = tpl.icon_style || 'glass';
        var elements = [];
        var bgSize = pos.size + 32;

        // Icon background shape
        var bgProps = {
            type: 'rect',
            id: 'icon-bg',
            left: pos.left - 16,
            top: pos.top - 16,
            width: bgSize,
            height: bgSize,
            selectable: false,
            evented: false
        };

        if (iconStyle === 'glass') {
            bgProps.fill = hexToRgba(accent, 0.12);
            bgProps.stroke = hexToRgba(accent, 0.25);
            bgProps.strokeWidth = 1;
            bgProps.rx = 20; bgProps.ry = 20;
        } else if (iconStyle === 'solid') {
            bgProps.fill = hexToRgba(accent, 0.18);
            bgProps.stroke = hexToRgba(accent, 0.3);
            bgProps.strokeWidth = 2;
            bgProps.rx = 16; bgProps.ry = 16;
        } else if (iconStyle === 'glow') {
            bgProps.fill = 'transparent';
            bgProps.rx = bgSize / 2; bgProps.ry = bgSize / 2;
            // Add glow circle behind
            elements.push({
                type: 'circle',
                id: 'icon-glow',
                left: pos.left + pos.size / 2 - bgSize,
                top: pos.top + pos.size / 2 - bgSize,
                radius: bgSize,
                fill: hexToRgba(accent, 0.1),
                selectable: false,
                evented: false
            });
        } else if (iconStyle === 'outline') {
            bgProps.fill = 'transparent';
            bgProps.stroke = hexToRgba(accent, 0.4);
            bgProps.strokeWidth = 2;
            bgProps.rx = bgSize / 2; bgProps.ry = bgSize / 2;
        } else if (iconStyle === 'warm') {
            bgProps.fill = hexToRgba(accent, 0.15);
            bgProps.rx = 24; bgProps.ry = 24;
        } else if (iconStyle === 'neon') {
            bgProps.fill = 'rgba(0,0,0,0.3)';
            bgProps.stroke = accent;
            bgProps.strokeWidth = 1;
            bgProps.rx = bgSize / 2; bgProps.ry = bgSize / 2;
        }

        elements.push(bgProps);

        // Icon SVG placeholder — actual Lucide SVG rendered by FabricRenderer
        elements.push({
            type: 'lucide-icon',
            id: 'icon-main',
            iconName: iconName || 'sparkles',
            left: pos.left,
            top: pos.top,
            size: pos.size,
            color: accent,
            selectable: false,
            evented: false
        });

        return elements;
    }

    // ─── Footer Elements ────────────────────────────────
    function buildFooter(colors, slideIndex, totalSlides) {
        var accent = colors.accent;
        var isDark = colors.isDark;
        var footerY = CANVAS_H - PAD + 10;
        var elements = [];

        // Brand text
        elements.push({
            type: 'textbox',
            id: 'footer-brand',
            left: PAD,
            top: footerY,
            text: '@jadisatu.cloud',
            fontSize: 16,
            fontWeight: '500',
            fontFamily: 'Inter, sans-serif',
            fill: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)',
            selectable: false,
            evented: false
        });

        // Slide progress dots
        var dotStartX = CANVAS_W - PAD - (totalSlides * 16);
        for (var i = 0; i < totalSlides; i++) {
            elements.push({
                type: 'rect',
                id: 'footer-dot-' + i,
                left: dotStartX + i * 16,
                top: footerY + 5,
                width: i === slideIndex ? 20 : 6,
                height: 6,
                rx: 3, ry: 3,
                fill: i === slideIndex ? accent : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)'),
                selectable: false,
                evented: false
            });
        }

        return elements;
    }

    // ─── Main Compose Function ──────────────────────────
    function compose(slide, slideIndex, tpl, totalSlides) {
        var colors = resolveColors(tpl, slide);
        var layoutType = slide._layoutType || 'default';
        var layoutFn = LAYOUTS[layoutType] || LAYOUTS['default'];
        var visualMode = slide._visualMode || 'icon';
        var hasIcon = visualMode === 'icon';
        var positions = layoutFn(colors, hasIcon);

        // Build background
        var bgElement;
        var bgHex = colors.bg.replace(/rgba?\([^)]+\)/, '#0f0f11');
        if (colors.isDark) {
            bgElement = {
                type: 'gradient-bg',
                id: 'background',
                width: CANVAS_W,
                height: CANVAS_H,
                colorStops: [
                    { offset: 0, color: bgHex },
                    { offset: 1, color: darkenColor(bgHex.length >= 7 ? bgHex : '#0f0f11', 15) }
                ],
                direction: 'to-bottom-right'
            };
        } else {
            bgElement = {
                type: 'gradient-bg',
                id: 'background',
                width: CANVAS_W,
                height: CANVAS_H,
                colorStops: [
                    { offset: 0, color: bgHex },
                    { offset: 1, color: lightenColor(bgHex.length >= 7 ? bgHex : '#f5f5f0', 8) }
                ],
                direction: 'to-bottom-right'
            };
        }

        // Collect all elements
        var elements = [];

        // 1. Background
        elements.push(bgElement);

        // 2. Decorative elements
        var decos = generateDecorations(colors, layoutType, tpl, slideIndex);
        elements = elements.concat(decos);

        // 3. Split-visual divider
        if (layoutType === 'split-visual') {
            var splitX = CANVAS_W * 0.42;
            elements.push({
                type: 'rect',
                id: 'split-divider-bg',
                left: 0,
                top: 0,
                width: splitX,
                height: CANVAS_H,
                fill: hexToRgba(colors.accent, colors.isDark ? 0.05 : 0.04),
                selectable: false,
                evented: false
            });
            elements.push({
                type: 'rect',
                id: 'split-divider-line',
                left: splitX - 1,
                top: CANVAS_H * 0.15,
                width: 2,
                height: CANVAS_H * 0.7,
                fill: hexToRgba(colors.accent, 0.15),
                selectable: false,
                evented: false
            });
        }

        // 4. Icon
        if (hasIcon && positions.icon) {
            var iconEls = buildIconElements(positions.icon, slide._iconName, colors, tpl);
            elements = elements.concat(iconEls);
        }

        // 5. Headline
        if (positions.headline && slide.headline) {
            elements.push({
                type: 'textbox',
                id: 'headline',
                left: positions.headline.left,
                top: positions.headline.top,
                width: positions.headline.width,
                text: slide.headline,
                fontSize: positions.headline.fontSize,
                fontWeight: positions.headline.fontWeight || '700',
                fontStyle: positions.headline.fontStyle || 'normal',
                fontFamily: tpl.font || 'Plus Jakarta Sans, Inter, sans-serif',
                fill: colors.headline,
                textAlign: positions.headline.textAlign || 'left',
                lineHeight: positions.headline.lineHeight || 1.2,
                selectable: true,
                evented: true
            });
        }

        // 6. Body
        if (positions.body && slide.body) {
            var bodyText = slide.body;
            if (layoutType === 'list-bullets' && bodyText) {
                var lines = bodyText.split('\n').filter(function(l) { return l.trim(); });
                bodyText = lines.map(function(line) {
                    var trimmed = line.trim();
                    if (/^[\u2022\u2023\u25E6\u2022\-\d]+[\.\)\s]/.test(trimmed)) return trimmed;
                    return '\u2022 ' + trimmed;
                }).join('\n');
            }
            elements.push({
                type: 'textbox',
                id: 'body',
                left: positions.body.left,
                top: positions.body.top,
                width: positions.body.width,
                text: bodyText,
                fontSize: positions.body.fontSize,
                fontWeight: positions.body.fontWeight || '400',
                fontFamily: tpl.font || 'Plus Jakarta Sans, Inter, sans-serif',
                fill: colors.body,
                textAlign: positions.body.textAlign || 'left',
                lineHeight: positions.body.lineHeight || 1.4,
                selectable: true,
                evented: true
            });
        }

        // 7. Number badge
        if (positions.badge) {
            elements.push({
                type: 'textbox',
                id: 'badge',
                left: positions.badge.left,
                top: positions.badge.top,
                text: String(slideIndex + 1),
                fontSize: positions.badge.size,
                fontWeight: '700',
                fontFamily: tpl.font || 'Inter, sans-serif',
                fill: colors.accent,
                selectable: false,
                evented: false
            });
        }

        // 8. Footer
        var footerEls = buildFooter(colors, slideIndex, totalSlides);
        elements = elements.concat(footerEls);

        return {
            canvas: { width: CANVAS_W, height: CANVAS_H },
            colors: colors,
            elements: elements
        };
    }

    // Public API
    return {
        compose: compose,
        resolveColors: resolveColors,
        hexToRgba: hexToRgba,
        CANVAS_W: CANVAS_W,
        CANVAS_H: CANVAS_H
    };
})();

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CompositionEngine;
}
