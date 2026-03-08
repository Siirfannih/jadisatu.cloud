# Live Canvas Editor — Architecture & Usage

## Overview

The Live Canvas Editor adds a semi-structured editing layer on top of AI-generated carousel templates. Users can correct, customize, and refine generated output without needing a full design tool.

**Key principle:** Edit the SCHEMA, not the DOM. All changes flow through the element data model, and the canvas re-renders from schema.

## Architecture

```
Smart Extractor → template_schema → CanvasEditor.buildFromCanvas()
    → element list [{id, type, visible, text, color, ...}]
    → Inspector Panel (UI for editing)
    → user edits element properties
    → CanvasEditor.updateElement() → applyToDOM() → canvas re-renders
    → FeedbackMemory records all changes
    → edited schema can be saved
```

## Modules

### 1. CanvasEditor (`canvas-editor.js`)

Core element management. Maintains an array of typed elements.

**Element types:**
- `title_block` — Main headline
- `subtitle_block` — Body/subtitle text
- `text_block` — Generic text
- `icon_block` — Lucide icon with size/color
- `diagram_block` — SVG diagram placeholder
- `footer_block` — Footer text
- `divider_block` — Horizontal divider
- `shape_block` — Geometric shape

**Element data model:**
```json
{
  "id": "icon_block_1",
  "type": "icon_block",
  "label": "Ikon",
  "x": 0, "y": 0,
  "visible": true,
  "icon_name": "zap",
  "size": 48,
  "color": "#f59e0b"
}
```

**Key methods:**
- `buildFromCanvas(schema, slideData)` — Parse template schema into elements
- `updateElement(id, updates)` — Update any element property
- `deleteElement(id)` — Remove element
- `toggleVisibility(id)` — Show/hide element
- `addElement(type, overrides)` — Add new element
- `serialize()` — Export element state
- `applyToDOM()` — Render element state to live canvas

### 2. FontRegistry (`font-registry.js`)

Font role abstraction. Maps semantic roles to actual font families.

**Font roles:** `heading`, `body`, `accent`
**Role names:** `serif_editorial`, `sans_clean`, `mono_label`, etc.

**Presets:**
| Preset | Heading | Body | Accent |
|--------|---------|------|--------|
| Editorial | Playfair Display | Inter | IBM Plex Mono |
| Modern Clean | Plus Jakarta Sans | Inter | Manrope |
| Technical | Manrope | JetBrains Mono | IBM Plex Mono |
| Minimal | Inter | Inter | Inter |
| Storytelling Warm | Lora | Inter | Kalam |

### 3. IconEngine (`icon-engine.js`)

Context-aware icon selection with 3 layers:

1. **Keyword → icon candidates** — Scans slide text for keywords
2. **Template family rules** — Respects layout preferences (no icons in diagram layouts)
3. **Fallback set** — Safe defaults when no keyword matches

Also prevents duplicate icons across slides within a session.

### 4. FeedbackMemory (`feedback-memory.js`)

Records all user edit actions as structured data for future learning.

**Tracked actions:**
- add_element, delete_element
- update_text, change_icon
- change_visual_mode, change_font
- change_color, toggle_visibility
- position_adjustment, change_alignment
- change_font_size, apply_font_preset

**Storage:** localStorage (immediate) + Supabase `carousel_edit_feedback` table

## Inspector Panel UI

Located on the left side of the canvas. Toggle with the "Inspector" button in the toolbar.

**Sections:**
1. **Element List** — Shows all elements, click to select, shows visibility status
2. **Properties** — Edit text, color, font size, alignment, icon, size
3. **Action Buttons** — Delete element, toggle visibility
4. **Visual Mode** — Switch between diagram/illustration/icon/none
5. **Font Preset** — Quick font combo selection + individual role overrides
6. **Session Stats** — Shows edit count, save feedback button

## Integration with Smart Extractor

When `applyTemplateToCanvas()` completes, the hook `_afterTemplateApplied()` fires:
1. Infers best font preset from `template_family`
2. Resets icon engine for fresh generation
3. Builds element list from schema + slide data
4. Starts a new feedback session

## Manual Test Steps

1. Upload a reference design to Smart Extractor
2. Wait for template to be generated and applied
3. Click "Inspector" button in canvas toolbar
4. Verify element list shows title, subtitle, icon/diagram, footer
5. Click an element → verify properties panel shows correct values
6. Edit text → verify canvas updates
7. Change color → verify canvas updates
8. Toggle visibility → verify element hides/shows
9. Delete an element → verify it's removed
10. Switch visual mode → verify canvas updates
11. Change font preset → verify fonts change
12. Click "Save Edit Feedback" → verify toast confirmation
13. Check localStorage key `jadisatu_carousel_feedback` for saved data

## Database

New table: `carousel_edit_feedback` (see `sql/carousel-edit-feedback.sql`)

No changes to existing tables.
