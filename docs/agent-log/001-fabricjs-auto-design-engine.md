# Plan 001: Fabric.js Auto-Design Engine

**Status:** In Progress
**Created:** 2026-03-09
**Last Updated:** 2026-03-09

## Context & Problem

Sistem carousel generator saat ini menggunakan HTML div + CSS class untuk rendering slide.
Hasilnya sangat terbatas: hanya background color + 1 icon Lucide + text. Meskipun AI sudah
bisa extract design DNA dari referensi dan Content Strategist sudah bisa memilih layout/icon/tone,
output visualnya tetap "flat" dan jauh dari kualitas desain carousel profesional.

### Apa yang sudah ada (Working):
- **Design DNA Extraction** — Gemini Vision extract warna, font, visual mode dari gambar referensi
- **Content Strategist** — Gemini pilih layout type, icon, emotional tone, bg variant per slide
- **Template Presets** — 6 preset warna/style (minimal-dark, bold-gradient, dll)
- **Saved Templates** — User upload referensi → extract → simpan di Supabase
- **Icon Sources** — Lucide icons, NounProject, Gemini generate
- **Ilustrasi** — Gemini bisa generate illustration images

### Apa yang bermasalah:
- Rendering engine hanya bisa: `div` + `text` + `1 icon` + `background color`
- Layout hanya 7 CSS class (`hero-center`, `card-detail`, dll) — bukan pixel-level positioning
- Tidak ada decorative elements (shapes, lines, patterns)
- Tidak ada image/ilustrasi di dalam slide
- Tidak ada gradient/texture yang kaya
- Gap besar antara "apa yang AI tahu tentang desain" vs "apa yang bisa di-render"

### Percobaan sebelumnya:
- **Canva API** — Dicoba, gagal karena 404 error terus saat publish, terjebak di content generate
- Keputusan: Build rendering engine sendiri di dalam Jadisatu

---

## Solution: Fabric.js Canvas Engine

Ganti rendering engine dari HTML/CSS → **Fabric.js** canvas-based rendering.

### Kenapa Fabric.js:
- Canvas 2D rendering — pixel-perfect positioning
- Support image overlay (ilustrasi, icon PNG/SVG)
- Shape primitives (rect, circle, line, polygon, path)
- Rich text (multi-style, custom fonts)
- Built-in export ke PNG/JPG/SVG
- Draggable & editable objects (user bisa adjust setelah AI generate)
- Battle-tested library (dipakai Polotno, Piktochart, dll)
- CDN: `https://cdnjs.cloudflare.com/ajax/libs/fabric.js/5.3.1/fabric.min.js`

---

## Architecture

### New Flow:

```
User upload referensi gambar
        ↓
Gemini Vision Extract → COMPOSITION JSON (detailed)
        ↓
User input konten / Content Hub pipeline
        ↓
Content Strategist (Gemini) → Per-slide decisions + composition hints
        ↓
COMPOSITION ENGINE (new) → Merge design DNA + content + layout rules
        ↓
Fabric.js Canvas → Render semua elements:
  - Background (gradient/solid/pattern/image)
  - Decorative shapes (rounded rect, circles, accent lines)
  - Icon/ilustrasi (SVG/PNG dari NounProject atau Gemini)
  - Text objects (headline, body, caption — styled)
  - Number badge, footer, branding
        ↓
User bisa drag/resize/edit di canvas
        ↓
Export PNG per-slide → Download ZIP
```

### Composition JSON Format (AI Output):

```json
{
  "canvas": {
    "width": 1080,
    "height": 1080,
    "background": {
      "type": "gradient",
      "colors": ["#0f0f11", "#1a1a2e"],
      "direction": "to-bottom-right"
    }
  },
  "elements": [
    {
      "type": "shape",
      "shape": "rounded-rect",
      "x": 40, "y": 40,
      "width": 1000, "height": 1000,
      "rx": 24,
      "fill": "rgba(255,255,255,0.05)",
      "stroke": "rgba(255,255,255,0.1)",
      "strokeWidth": 1
    },
    {
      "type": "icon",
      "name": "zap",
      "source": "lucide",
      "x": 80, "y": 120,
      "size": 64,
      "color": "#8b5cf6",
      "style": "glass-bg"
    },
    {
      "type": "text",
      "role": "headline",
      "content": "Mungkin Ini Tanda dari-Nya?",
      "x": 80, "y": 400,
      "width": 920,
      "fontSize": 48,
      "fontWeight": 700,
      "fontFamily": "Plus Jakarta Sans",
      "fill": "#ffffff",
      "lineHeight": 1.2
    },
    {
      "type": "text",
      "role": "body",
      "content": "Semua upaya terasa sia-sia...",
      "x": 80, "y": 520,
      "width": 920,
      "fontSize": 24,
      "fontWeight": 400,
      "fontFamily": "Plus Jakarta Sans",
      "fill": "rgba(255,255,255,0.7)",
      "lineHeight": 1.5
    },
    {
      "type": "decorative",
      "shape": "circle",
      "x": 900, "y": 100,
      "radius": 120,
      "fill": "rgba(139,92,246,0.15)",
      "blur": 40
    },
    {
      "type": "line",
      "x1": 80, "y1": 480,
      "x2": 200, "y2": 480,
      "stroke": "#8b5cf6",
      "strokeWidth": 3
    },
    {
      "type": "badge",
      "content": "1",
      "x": 80, "y": 950,
      "size": 32,
      "color": "#8b5cf6"
    }
  ]
}
```

---

## Implementation Phases

### Phase 1: Fabric.js Integration (Foundation)
**File:** `frontend/carousel-generator-preview.html`

1. Add Fabric.js CDN script tag
2. Replace HTML canvas preview area with `<canvas id="fabric-canvas">`
3. Create `FabricRenderer` class:
   - `init(canvasElement, width, height)` — initialize Fabric canvas
   - `renderComposition(compositionJSON)` — render from JSON
   - `clear()` — clear canvas
   - `exportPNG()` — export current canvas as PNG
   - `exportAllSlides()` — export all slides as ZIP
4. Keep existing HTML preview as fallback (toggle: "Classic" vs "Fabric" mode)
5. Wire up slide navigation to re-render Fabric canvas per slide

### Phase 2: Composition Engine
**New file:** `frontend/js/composition-engine.js`

1. Convert existing template preset + strategist data → Composition JSON
   - Map `_activePreset` colors → canvas background + element colors
   - Map `_layoutType` → element positions (predefined position maps)
   - Map `_iconName` → icon element
   - Map `headline`/`body` → text elements
2. Predefined composition templates for each layout type:
   - `hero-center` → centered headline, big font, minimal elements
   - `card-detail` → card shape + headline + body inside
   - `split-visual` → icon/image left 40%, text right 60%
   - `quote-highlight` → decorative quotes + centered text
   - `list-bullets` → headline + bullet items stacked
   - `dramatic-closer` → dark overlay + large centered text
   - `text-heavy` → multi-paragraph, compact spacing
3. Add decorative elements based on template preset:
   - Blur circles, accent lines, corner shapes
   - Background patterns/textures

### Phase 3: AI-Powered Composition
**File:** `hunter-agent/backend/api.py`

1. New endpoint: `POST /api/carousel/compose`
   - Input: slide content + design schema + layout type
   - Output: Full Composition JSON per slide
   - Gemini generates pixel-level element positions
2. Upgrade design extraction to output composition hints:
   - Where elements are positioned in reference image
   - What decorative elements exist
   - Spacing patterns, margins, visual hierarchy
3. Upgrade Content Strategist to include composition decisions

### Phase 4: Rich Visual Elements
1. Support image elements (ilustrasi dari Gemini, foto dari user)
2. SVG icon rendering (NounProject API integration)
3. Pattern/texture backgrounds
4. Gradient text effects
5. User can drag/resize elements on Fabric canvas (interactive editing)

### Phase 5: Export & Polish
1. High-quality PNG export (1080x1080, 1080x1350)
2. Multi-slide ZIP download
3. Undo/redo support
4. Save composition to database for re-editing

---

## Key Files to Modify

| File | Changes |
|------|---------|
| `frontend/carousel-generator-preview.html` | Add Fabric.js, create FabricRenderer, toggle between classic/fabric |
| `frontend/js/composition-engine.js` | **NEW** — Convert strategist data → Composition JSON |
| `frontend/js/canvas-editor.js` | May need updates for Fabric.js integration |
| `hunter-agent/backend/api.py` | New `/api/carousel/compose` endpoint |
| `hunter-agent/backend/carousel_processor.py` | Upgrade extraction for composition hints |

---

## Current Progress

- [x] Plan documented
- [x] Phase 1: Fabric.js integration (foundation) — CDN, canvas element, toggle
- [x] Phase 2: Composition engine (convert existing data → Fabric) — 7 layouts, decorations
- [x] Phase 3: AI-powered composition (Gemini generates element positions) — `/api/carousel/compose`
- [x] Phase 4: Rich visual elements (images, SVG icons, patterns, lines)
- [x] Phase 5: Export & polish (undo/redo, interactive editing, clean export)

---

## What Was Built

### Files Created
| File | Purpose |
|------|---------|
| `frontend/js/composition-engine.js` | Converts slide data + template → Composition JSON with pixel positioning |
| `frontend/js/fabric-renderer.js` | Renders Composition JSON to Fabric.js canvas |
| `docs/agent-log/README.md` | Agent log index |
| `docs/agent-log/001-fabricjs-auto-design-engine.md` | This plan document |

### Files Modified
| File | Changes |
|------|---------|
| `frontend/carousel-generator-preview.html` | Fabric.js CDN, canvas element, toggle buttons, AI compose UI, undo/redo, Fabric export path |
| `hunter-agent/backend/api.py` | New `/api/carousel/compose` endpoint for AI composition |

### Features Implemented
1. **Classic/Fabric toggle** — switch between HTML and Fabric.js rendering
2. **7 layout types** with pixel-level positioning (hero-center, card-detail, split-visual, etc.)
3. **Decorative elements** — glow blobs, accent lines, dot patterns, card frames, corner clusters
4. **Pattern backgrounds** — grid dots (even slides), diagonal lines (odd slides)
5. **Icon rendering** — 6 icon styles (glass, solid, glow, outline, warm, neon) with Lucide SVG
6. **Image/illustration support** — base64, URL, and SVG content rendering
7. **AI Compose endpoint** — Gemini generates full composition JSON per slide
8. **AI Compose button** in toolbar — triggers AI auto-design for all slides
9. **Undo/redo** — Ctrl+Z / Ctrl+Y with 30-step history
10. **Interactive editing** — drag, resize, double-click text edit, delete elements
11. **Clean export** — deselects objects before PNG export, Fabric-native export path
12. **Serialize/load** — save and restore canvas state as JSON

---

## Notes for Next Agent

- `carousel-generator-preview.html` is now ~6500 lines — be careful when editing
- `CAROUSEL_AI_BACKEND_URL` must be set for AI Compose to work (currently empty)
- Google Fonts loaded in `<head>` work in Fabric.js via CSS font loading
- Template presets around line 2150+, `renderSlideClean()` around line 2500+
- AI compose stores result in `slide._aiComposition` — persists until page reload
- Pattern overlay dots limited to 80 per slide to avoid performance issues
- Fabric.js v5.3.1 loaded from cdnjs CDN
