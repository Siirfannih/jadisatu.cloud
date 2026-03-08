# Smart Extractor Schema Reference

## Overview

The Smart Extractor uses Gemini Vision to analyze uploaded design screenshots and produce a structured Design Schema JSON. This schema drives the carousel preview renderer.

## Schema Fields

### color_palette (legacy, still supported)

8 generic color keys for backward compatibility:

| Key | Description |
|-----|-------------|
| background | Canvas background color |
| primary | Dominant brand/accent color |
| secondary | Secondary accent color |
| accent | Highlight or CTA color |
| text_primary | Main text color |
| text_secondary | Body text color |
| text_muted | Muted/caption text |
| surface | Card/panel surface color |

### color_roles (semantic, preferred)

7 semantic color roles that map to specific rendering purposes:

| Key | Description | Fallback |
|-----|-------------|----------|
| background | Exact canvas background | color_palette.background |
| surface | Card/panel surface | color_palette.surface |
| text_primary | Main heading/text | color_palette.text_primary |
| text_secondary | Body/subtitle text | color_palette.text_secondary |
| accent | Highlight/CTA | color_palette.accent |
| line | Lines, borders, dividers, diagram strokes | color_palette.primary |
| muted_line | Subtle background lines, grids | color_palette.text_muted |

**Why color_roles?** The generic `color_palette` doesn't distinguish between "accent for headings" and "color for diagram strokes". Dark editorial designs need precise line colors to render diagram components correctly instead of falling back to generic primary purple.

### visual_mode

Classifies the reference design's dominant visual type:

| Mode | Description | Renderer behavior |
|------|-------------|-------------------|
| diagram | Charts, node graphs, flow diagrams, arc curves | Renders diagram SVG placeholders using color_roles.line |
| illustration | Large hero visual, scene, photo | Shows image placeholder area |
| icon | Small supporting symbols only | Shows icon wrap with Lucide icon |
| none | Purely typography and spacing | Hides visual area entirely |

### diagram_type (only when visual_mode = diagram)

| Type | Description |
|------|-------------|
| flowchart | Connected rectangular nodes with arrows |
| arc / coherence_arc | Concentric arc paths with node points |
| cycle | Circular path with connected nodes |
| comparison | Side-by-side comparison boxes |
| timeline | Horizontal line with point markers |
| none | Generic diagram |

### visual_components

Array of specific visual elements detected in the design:
- diagram-arc, node-points, dashed-divider, annotation-labels
- hero-photo, overlay-gradient, serif-headline, decorative-doodles
- numbered-steps, icon-bullets, clean-divider, caption-box
- progress-bar, quote-block, stats-block, icon-grid, timeline

## Rendering Rules

### Dark editorial diagram designs
- Background = solid extracted dark color (no gradient overlay)
- Blur elements hidden (they wash out dark designs)
- Diagram components rendered using color_roles.line for strokes
- No irrelevant icons or illustrations

### Warm photo editorial designs
- Blur elements shown for glow effect
- Gradient overlay at bottom
- Illustration/photo area visible

### Minimal educational designs
- Light background, blur elements shown
- Step indicators and clean dividers
- Icon area visible for small symbols

## Fallback Behavior

| Missing Field | Fallback |
|---------------|----------|
| color_roles | Derived from color_palette |
| visual_mode | Defaults to "icon" (backward compat) |
| diagram_type | Defaults to "none" |
| color_roles.line | Falls back to color_palette.primary |
| color_roles.muted_line | Falls back to color_palette.text_muted |

Templates saved before this update (without color_roles/visual_mode) will render exactly as before.

## Element Schema (Live Editor)

When the Live Editor is active, the template schema is decomposed into editable elements:

### Element types

| Type | Description | Editable properties |
|------|-------------|-------------------|
| title_block | Main headline | text, color, font_size, font_weight, alignment, font_role |
| subtitle_block | Body/subtitle text | text, color, font_size, font_weight, alignment, font_role |
| text_block | Generic text block | text, color, font_size, font_weight, alignment, font_role |
| icon_block | Lucide icon | icon_name, size, color |
| diagram_block | SVG diagram | diagram_type, stroke_color, muted_color |
| footer_block | Footer text | text, color, font_size |
| divider_block | Horizontal divider | style (solid/dashed), color, thickness |
| shape_block | Geometric shape | shape, width, height, fill, stroke |

### Font roles

Font roles map semantic names to actual font families via the FontRegistry:

| Role key | Example role name | Resolved family |
|----------|-----------------|-----------------|
| heading | serif_editorial | Playfair Display |
| body | sans_clean | Inter |
| accent | mono_label | IBM Plex Mono |

### Icon Engine layers

1. Keyword → icon candidates (content-driven)
2. Template family rules (layout-driven)
3. Fallback constrained set

See `/docs/live-editor.md` for full architecture details.
