# JadiSatu Visual Engine — Implementation Plan
## "Build Your Own Placid.app" for Automated Content Generation

---

## 1. MASALAH SAAT INI (Ringkasan)

| Masalah | Detail |
|---------|--------|
| Frontend monolith | 6,424 baris dalam 1 file HTML (CSS + JS + UI) |
| 5 AI pipeline berbeda | ai-script, map-to-slides, strategist, icon-resolver, compose — saling tumpang tindih |
| 3 rendering engine | Classic DOM, Fabric.js, Composition JSON — tidak ada yang fully works |
| 5 tempat state | localStorage, Supabase, window globals, session storage, JS variables |
| Dead code | Composition engine generate JSON tapi tidak pernah di-render |
| Fragile | Setiap fitur baru menimpa/break fitur yang lain |

**Kesimpulan**: Sistem terlalu complex untuk tujuannya. Perlu dibangun ulang dengan arsitektur yang lebih sederhana dan focused.

---

## 2. ARSITEKTUR BARU: JadiSatu Visual Engine

### Konsep Inti
Seperti Placid.app — template HTML/CSS yang di-render menjadi gambar di server.

```
┌─────────────────────────────────────────────────────────────┐
│                    FLOW BARU (Simplified)                    │
│                                                             │
│  Input          AI Content        Template        Output    │
│  ─────          ──────────        ────────        ──────    │
│                                                             │
│  URL/Topik  ──▶  Gemini API  ──▶  HTML/CSS   ──▶  PNG/JPG  │
│  + Brand       (1 endpoint)     Templates       (Puppeteer) │
│  Config         generates       (server-side      ready to  │
│                 slide JSON      rendering)        post!     │
│                                                             │
│  Frontend: Form input + Image preview + Download            │
│  (NO canvas editor, NO Fabric.js in core flow)              │
└─────────────────────────────────────────────────────────────┘
```

### Prinsip Desain
1. **1 AI endpoint** — bukan 5 yang saling tumpang tindih
2. **Template = HTML/CSS file biasa** — mudah dibuat, di-debug, di-test
3. **Server-side rendering** — Puppeteer screenshot, consistent output
4. **Frontend sesimpel mungkin** — form + preview gambar, bukan canvas editor
5. **Stateless** — tidak perlu sync state di 5 tempat

---

## 3. STRUKTUR FOLDER BARU

```
jadisatu.cloud/
├── visual-engine/                    # ← SISTEM BARU
│   ├── templates/                    # HTML/CSS slide templates
│   │   ├── base.html                 # Base layout (shared head, fonts, icons)
│   │   ├── carousel-modern/          # Template family: Modern
│   │   │   ├── slide-cover.html      # Slide 1 — cover/hook
│   │   │   ├── slide-content.html    # Slide 2-N — content body
│   │   │   ├── slide-cta.html        # Slide terakhir — call to action
│   │   │   └── styles.css            # CSS khusus template ini
│   │   ├── carousel-minimal/         # Template family: Minimal
│   │   │   ├── slide-cover.html
│   │   │   ├── slide-content.html
│   │   │   ├── slide-cta.html
│   │   │   └── styles.css
│   │   ├── carousel-bold/            # Template family: Bold/Gradient
│   │   │   └── ...
│   │   └── shared/                   # Shared assets
│   │       ├── fonts/                # Google Fonts fallback
│   │       ├── icons/                # Lucide SVG icons (local copy)
│   │       └── reset.css             # CSS reset/normalize
│   │
│   ├── renderer/                     # Server-side rendering engine
│   │   ├── render.py                 # Puppeteer/Playwright screenshot
│   │   ├── template_engine.py        # Jinja2 — populate template with data
│   │   └── requirements.txt          # playwright, jinja2
│   │
│   ├── api/                          # REST API endpoints
│   │   ├── app.py                    # FastAPI app (new, clean)
│   │   ├── generate.py               # POST /generate — full pipeline
│   │   ├── preview.py                # GET /preview/:id — preview images
│   │   └── templates_api.py          # GET /templates — list available templates
│   │
│   └── README.md                     # Dokumentasi & contoh API call
│
├── frontend/                         # Frontend BARU (simplified)
│   ├── content-studio.html           # ← Halaman baru, menggantikan carousel-generator
│   ├── js/
│   │   └── content-studio.js         # Logic sederhana: form → API → preview
│   └── css/
│       └── content-studio.css        # Styling halaman
│
├── hunter-agent/                     # Tetap ada (pain point scraper)
│   └── backend/
│       └── api.py                    # Endpoint lama tetap berjalan
│
└── ... (file lain tetap)
```

---

## 4. DATA MODEL

### Input ke AI (dari user):

```json
{
  "topic": "5 Cara Meningkatkan Produktivitas",
  "hook": "Kamu masih kerja 12 jam sehari?",
  "value_points": ["Pomodoro technique", "Deep work blocks", "Eliminate distractions"],
  "cta": "Follow untuk tips produktivitas harian",
  "brand": {
    "name": "JadiSatu",
    "colors": {
      "primary": "#2563EB",
      "secondary": "#1E40AF",
      "accent": "#F59E0B",
      "background": "#FFFFFF",
      "text": "#1F2937"
    },
    "font": "Plus Jakarta Sans"
  },
  "template": "carousel-modern",
  "platform": "instagram",
  "num_slides": 7
}
```

### Output dari AI (JSON slide data):

```json
{
  "slides": [
    {
      "type": "cover",
      "headline": "5 Cara Meningkatkan Produktivitas",
      "subheadline": "Yang jarang orang tahu",
      "icon": "rocket",
      "bg_variant": "gradient"
    },
    {
      "type": "content",
      "number": "01",
      "headline": "Pomodoro Technique",
      "body": "Kerja 25 menit, istirahat 5 menit. Otak butuh reset untuk tetap tajam.",
      "icon": "timer",
      "bg_variant": "solid"
    },
    {
      "type": "content",
      "number": "02",
      "headline": "Deep Work Blocks",
      "body": "Blokir 2-3 jam tanpa gangguan. Matikan notifikasi. Fokus total.",
      "icon": "brain",
      "bg_variant": "solid"
    },
    {
      "type": "cta",
      "headline": "Mau lebih produktif?",
      "body": "Follow @jadisatu untuk tips harian",
      "icon": "arrow-right",
      "bg_variant": "accent"
    }
  ]
}
```

### Template HTML menerima data ini via Jinja2:

```html
<!-- templates/carousel-modern/slide-content.html -->
<div class="slide" style="width:1080px; height:1080px;">
  <div class="slide-number">{{ slide.number }}</div>
  <div class="slide-icon">
    <!-- Lucide icon SVG inline -->
    {% include 'shared/icons/' + slide.icon + '.svg' %}
  </div>
  <h2 class="headline">{{ slide.headline }}</h2>
  <p class="body">{{ slide.body }}</p>
  <div class="brand-footer">
    <span>{{ brand.name }}</span>
  </div>
</div>
```

---

## 5. API ENDPOINTS (Visual Engine)

### `POST /api/visual/generate`
**Input**: topic, hook, value_points, cta, brand, template, platform
**Process**:
1. Gemini API → generate slide JSON (1 call, 1 prompt)
2. Jinja2 → populate HTML templates with slide data
3. Playwright → screenshot each slide → PNG
4. Return array of image URLs

**Output**:
```json
{
  "id": "gen_abc123",
  "slides": [
    {"index": 0, "type": "cover", "image_url": "/output/gen_abc123/slide_0.png", "data": {...}},
    {"index": 1, "type": "content", "image_url": "/output/gen_abc123/slide_1.png", "data": {...}},
    ...
  ]
}
```

### `POST /api/visual/regenerate-slide`
**Input**: generation_id, slide_index, updated_data
**Process**: Re-render 1 slide saja (edit teks → re-screenshot)
**Output**: New image URL

### `GET /api/visual/templates`
**Output**: List template families dengan preview thumbnail

### `POST /api/visual/download`
**Input**: generation_id, format (png/pdf/zip)
**Output**: Download file

---

## 6. CONTOH TEMPLATE HTML/CSS

### Template "Modern" — Slide Content:

```html
<!DOCTYPE html>
<html>
<head>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;800&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    .slide {
      width: 1080px;
      height: 1080px;
      padding: 80px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      background: {{ brand.colors.background }};
      font-family: 'Plus Jakarta Sans', sans-serif;
      position: relative;
    }

    .slide-number {
      font-size: 120px;
      font-weight: 800;
      color: {{ brand.colors.accent }};
      opacity: 0.15;
      position: absolute;
      top: 60px;
      right: 80px;
    }

    .icon-wrapper {
      width: 64px;
      height: 64px;
      background: {{ brand.colors.primary }};
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 32px;
    }

    .icon-wrapper svg {
      width: 32px;
      height: 32px;
      color: white;
    }

    .headline {
      font-size: 48px;
      font-weight: 800;
      color: {{ brand.colors.text }};
      line-height: 1.2;
      margin-bottom: 24px;
    }

    .body {
      font-size: 28px;
      font-weight: 400;
      color: {{ brand.colors.text }};
      opacity: 0.7;
      line-height: 1.6;
    }

    .brand-bar {
      position: absolute;
      bottom: 60px;
      left: 80px;
      right: 80px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .brand-name {
      font-size: 18px;
      font-weight: 600;
      color: {{ brand.colors.primary }};
    }

    .swipe-hint {
      font-size: 16px;
      color: {{ brand.colors.text }};
      opacity: 0.3;
    }
  </style>
</head>
<body>
  <div class="slide">
    <div class="slide-number">{{ slide.number }}</div>

    <div class="icon-wrapper">
      {{ icon_svg }}
    </div>

    <h2 class="headline">{{ slide.headline }}</h2>
    <p class="body">{{ slide.body }}</p>

    <div class="brand-bar">
      <span class="brand-name">{{ brand.name }}</span>
      <span class="swipe-hint">Swipe →</span>
    </div>
  </div>
</body>
</html>
```

---

## 7. IMPLEMENTASI — TAHAPAN

### Phase 1: Foundation (Core Engine)
**Deliverables:**
- [ ] `visual-engine/renderer/template_engine.py` — Jinja2 template renderer
- [ ] `visual-engine/renderer/render.py` — Playwright screenshot engine
- [ ] `visual-engine/templates/carousel-modern/` — 3 template files (cover, content, cta)
- [ ] `visual-engine/templates/shared/` — CSS reset, icon SVGs
- [ ] Test: render 1 slide dari JSON → PNG

**Dependensi:** Playwright install di VPS (`pip install playwright && playwright install chromium`)

### Phase 2: AI Content Generation
**Deliverables:**
- [ ] `visual-engine/api/app.py` — FastAPI app
- [ ] `visual-engine/api/generate.py` — POST /api/visual/generate endpoint
- [ ] 1 clean Gemini prompt (menggantikan 5 prompt lama)
- [ ] Test: topic input → AI JSON → rendered slides PNG

### Phase 3: Frontend (Content Studio)
**Deliverables:**
- [ ] `frontend/content-studio.html` — Clean UI: form + preview
- [ ] `frontend/js/content-studio.js` — API calls + image display
- [ ] Features: input form, template picker, preview gallery, download
- [ ] Edit: click slide → edit text via form → re-render 1 slide

### Phase 4: Template Expansion
**Deliverables:**
- [ ] `carousel-minimal/` — template family #2
- [ ] `carousel-bold/` — template family #3
- [ ] Template picker UI di frontend
- [ ] Brand config persistence (Supabase)

### Phase 5: Integration & Polish
**Deliverables:**
- [ ] Connect content-studio ke existing Creative Hub data
- [ ] Batch generation (multiple topics → multiple carousels)
- [ ] PDF export (multi-slide)
- [ ] Deploy script update

---

## 8. MIGRASI — APA YANG TERJADI DENGAN KODE LAMA?

| File Lama | Keputusan |
|-----------|-----------|
| `carousel-generator-preview.html` (6,424 lines) | **TETAP ADA** sebagai "Advanced Editor" tapi bukan flow utama |
| `frontend/js/fabric-renderer.js` (1,213 lines) | **TETAP ADA** tapi opsional |
| `hunter-agent/backend/api.py` — carousel endpoints | **TETAP ADA** untuk backward compatibility |
| `hunter-agent/backend/carousel_processor.py` | **DEPRECATED** — diganti visual-engine |

**Prinsip**: Tidak menghapus apapun. Sistem baru berjalan paralel. Setelah proven, baru migrate sepenuhnya.

---

## 9. KEUNTUNGAN vs SISTEM SAAT INI

| Aspek | Saat Ini | Visual Engine Baru |
|-------|----------|-------------------|
| Kompleksitas frontend | 6,424 lines monolith | ~300 lines (form + preview) |
| AI pipeline | 5 endpoint tumpang tindih | 1 endpoint clean |
| Rendering | 3 engine (DOM/Fabric/Compose) | 1 engine (Playwright) |
| Template editing | Edit code JS/HTML yang complex | Edit file HTML/CSS biasa |
| Tambah template baru | Modifikasi monolith | Copy folder, edit CSS |
| Output consistency | Beda di tiap browser | Server-render, selalu sama |
| Debugging | DevTools 6,400 lines | File terpisah, testable |
| State management | 5 tempat | Stateless (input → output) |

---

## 10. ESTIMASI TEKNIS

### Yang dibutuhkan di VPS:
- Python 3.9+ (sudah ada)
- Playwright + Chromium (`pip install playwright && playwright install chromium`)
- Jinja2 (`pip install jinja2`)
- FastAPI + Uvicorn (sudah ada)

### Port:
- Visual Engine API: port 8100 (atau lainnya yang available)
- Existing Hunter Agent API: port tetap

---

## KEPUTUSAN YANG PERLU DIAMBIL

1. **Template style pertama**: Modern? Minimal? Bold? → Tentukan 1 untuk Phase 1
2. **Platform target utama**: Instagram (1080x1080)? LinkedIn? Multi? → Tentukan ukuran default
3. **Font**: Plus Jakarta Sans? Inter? Poppins? → Tentukan font default
4. **Playwright vs Puppeteer**: Playwright (Python native) recommended
5. **Port untuk Visual Engine API**: 8100?
