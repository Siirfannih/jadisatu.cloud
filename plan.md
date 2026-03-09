# Mini Canva — Full Visual Editor Implementation Plan

## Overview
Upgrade the Fabric.js canvas from "view + text edit only" to a full CRUD visual editor (mini Canva). Two workflows:
1. **AI Import**: AI generates carousel → renders on canvas (existing)
2. **User Edit**: User does CRUD on ALL objects → saves → system learns user's design preferences

## Architecture

### Current State
- `fabric-renderer.js` — renders compositions, objects mostly non-selectable
- `composition-engine.js` — converts slide data → element positions
- `canvas-editor.js` — schema-based CRUD (but only maps to DOM, not Fabric canvas)
- Undo/redo exists but basic

### Target State
- All canvas objects are selectable, moveable, resizable, editable
- Visual toolbar to add new objects (text, shapes, icons, images, lines)
- Property panel for selected object (color, font, size, opacity, etc.)
- Bridge between canvas-editor schema and Fabric canvas (two-way sync)
- Design preference learning system

---

## Implementation Steps

### Phase 1: Canvas Editor Toolbar (new file: `canvas-toolbar.js`)
Create a left-side toolbar panel with:
- **Add Text** — adds Textbox to canvas
- **Add Shape** — submenu: Rectangle, Circle, Triangle, Line
- **Add Icon** — icon picker (Lucide icons grid)
- **Add Image** — file upload or URL input
- **Divider/Line** — horizontal/vertical lines

Each "add" action:
1. Creates Fabric object at canvas center
2. Sets `selectable: true, evented: true`
3. Saves state for undo
4. Selects the new object

HTML: Add toolbar panel to `carousel-generator-preview.html` (left side of canvas area)

### Phase 2: Make ALL Rendered Objects Editable (`fabric-renderer.js`)
- Change `renderComposition()` to set ALL objects as `selectable: true, evented: true`
- Add custom property `_elementId` to each Fabric object (links back to composition element)
- Add `object:selected` event handler to show property panel
- Add `object:deselected` event handler to hide property panel
- Keep background gradient non-selectable

### Phase 3: Property Panel (new file: `canvas-properties.js`)
Right-side panel that appears when an object is selected:
- **Common**: Position (x, y), Size (w, h), Rotation, Opacity, Z-index (bring forward/back)
- **Text**: Font family, Font size, Font weight, Color, Alignment, Line height
- **Shape**: Fill color, Stroke color, Stroke width, Corner radius
- **Icon**: Icon name (picker), Color, Size
- **Image**: Scale, Fit mode, Corner radius, Opacity

Panel updates live as user changes values. Changes trigger `saveState()` for undo.

HTML: Add collapsible property panel to right side of canvas in `carousel-generator-preview.html`

### Phase 4: Two-Way Sync Bridge (`canvas-bridge.js`)
Bridge between CanvasEditor schema and Fabric canvas:
- `schemaToFabric(elements)` — convert schema elements → Fabric objects
- `fabricToSchema(canvas)` — extract Fabric objects → schema elements
- On user edit (move, resize, recolor): sync Fabric → schema
- On AI regenerate: sync schema → Fabric
- Each Fabric object stores `_schemaId` linking to canvas-editor element

### Phase 5: Design Preference Learning (`design-learner.js`)
Record and learn from user edits:
- **Edit Tracker**: Log every user modification (move, resize, recolor, delete, add)
- **Preference Extraction**: After user saves, analyze edits:
  - Preferred font sizes (headline/body)
  - Preferred colors (accent, bg, text)
  - Preferred layout positions (where they move elements)
  - Element spacing patterns
  - Which elements they always delete/add
- **Storage**: Save preferences to localStorage + optionally to backend
- **Apply on Next Generation**: When AI generates next carousel, apply user preferences:
  - Adjust CompositionEngine defaults with learned values
  - Pass preferences to AI prompt for smarter generation

### Phase 6: UI Integration in `carousel-generator-preview.html`
- Add toolbar HTML to left side of canvas
- Add property panel HTML to right side of canvas
- Update toolbar buttons: "Edit Mode" toggle → enables/disables all CRUD
- Add "Save Design" button → triggers learning + saves state
- Add keyboard shortcuts:
  - `Ctrl+C/V` — copy/paste objects
  - `Ctrl+D` — duplicate selected
  - `Arrow keys` — nudge selected object
  - `Shift+Arrow` — nudge by 10px

### Phase 7: Icon Picker Component
- Grid modal showing all Lucide icons (searchable)
- Click icon → adds to canvas or updates selected icon
- Categories: arrows, media, devices, shapes, etc.
- Search by name

---

## File Changes Summary

### New Files
1. `frontend/js/canvas-toolbar.js` — Toolbar logic + add element functions
2. `frontend/js/canvas-properties.js` — Property panel logic
3. `frontend/js/canvas-bridge.js` — Schema ↔ Fabric two-way sync
4. `frontend/js/design-learner.js` — Preference learning system

### Modified Files
1. `frontend/js/fabric-renderer.js` — Make all objects selectable, add _elementId, selection events
2. `frontend/js/canvas-editor.js` — Add Fabric-aware methods
3. `frontend/js/composition-engine.js` — Accept learned preferences as overrides
4. `frontend/carousel-generator-preview.html` — Add toolbar panel, property panel, new script tags, keyboard shortcuts

---

## Implementation Order
1. Phase 2 first (make objects editable) — quickest visible impact
2. Phase 1 (toolbar) — lets users add new objects
3. Phase 3 (property panel) — lets users fine-tune objects
4. Phase 6 (UI integration) — wire everything together in HTML
5. Phase 4 (bridge) — proper two-way sync
6. Phase 5 (learning) — record & learn from edits
7. Phase 7 (icon picker) — polish
