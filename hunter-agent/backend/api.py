"""
FastAPI Server for Hunter Agent Dashboard + Carousel AI Processor
Provides REST API endpoints for the frontend
"""

import os
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
from pydantic import BaseModel
from database import Database
import json
import re

app = FastAPI(title="Hunter Agent API", version="1.0.0")

# CORS middleware for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health_check():
    """Health check endpoint for deployment verification."""
    import datetime
    return {
        "status": "ok",
        "service": "hunter-agent",
        "timestamp": datetime.datetime.now().isoformat(),
        "endpoints": [
            "/api/health",
            "/api/carousel/extract-template",
            "/api/carousel/map-to-slides",
            "/api/carousel/template-families",
            "/api/carousel/resolve-icons"
        ]
    }

# Initialize database
db = Database()

# Response models
class PainPoint(BaseModel):
    id: str
    source: str
    platform: Optional[str]
    subreddit: Optional[str]
    title: str
    body: Optional[str]
    url: Optional[str]
    upvotes: int
    comments: int
    pain_score: int
    category: Optional[str]
    opportunity_level: Optional[str]
    jadisatu_solution: Optional[str]
    target_market: Optional[str]
    estimated_value: int
    urgency: Optional[str]
    scraped_at: str
    status: Optional[str] = "new"

class StatusUpdate(BaseModel):
    status: str

class Stats(BaseModel):
    total_collected: int
    today_new: int
    high_opportunity: int
    avg_pain_score: float
    categories: dict
    sources_active: int
    keywords_tracked: int

@app.get("/")
def root():
    """Health check"""
    return {
        "status": "running",
        "service": "Hunter Agent API",
        "version": "1.0.0"
    }

@app.get("/api/stats", response_model=Stats)
def get_stats():
    """Get dashboard statistics"""
    try:
        stats = db.get_stats()
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/problems")
def get_problems(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    category: Optional[str] = None,
    search: Optional[str] = None
):
    """
    Get pain points with optional filtering
    
    - **limit**: Number of results (1-500)
    - **offset**: Pagination offset
    - **category**: Filter by category
    - **search**: Search in title/body
    """
    try:
        if search:
            problems = db.search(search, limit=limit)
        elif category and category != "All":
            problems = db.get_by_category(category, limit=limit)
        else:
            problems = db.get_all(limit=limit, offset=offset)
        
        # Parse JSON fields
        for p in problems:
            if p.get('matching_keywords'):
                try:
                    p['matching_keywords'] = json.loads(p['matching_keywords'])
                except:
                    p['matching_keywords'] = []
            
            if p.get('keywords_extracted'):
                try:
                    p['keywords_extracted'] = json.loads(p['keywords_extracted'])
                except:
                    p['keywords_extracted'] = []
        
        return {
            "total": len(problems),
            "limit": limit,
            "offset": offset,
            "data": problems
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/problems/{problem_id}")
def get_problem(problem_id: str):
    """Get a single pain point by ID"""
    try:
        problems = db.search(problem_id, limit=1)
        
        if not problems:
            raise HTTPException(status_code=404, detail="Problem not found")
        
        problem = problems[0]
        
        # Parse JSON fields
        if problem.get('matching_keywords'):
            try:
                problem['matching_keywords'] = json.loads(problem['matching_keywords'])
            except:
                problem['matching_keywords'] = []
        
        if problem.get('keywords_extracted'):
            try:
                problem['keywords_extracted'] = json.loads(problem['keywords_extracted'])
            except:
                problem['keywords_extracted'] = []
        
        return problem
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/problems/{problem_id}/status")
def update_status(problem_id: str, update: StatusUpdate):
    """Update problem status"""
    try:
        success = db.update_status(problem_id, update.status)
        if not success:
            raise HTTPException(status_code=404, detail="Problem not found")
        return {"status": "success", "new_status": update.status}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/categories")
def get_categories():
    """Get list of all categories with counts"""
    try:
        stats = db.get_stats()
        return {
            "categories": stats.get("categories", {}),
            "total_categories": len(stats.get("categories", {}))
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/trigger-scrape")
def trigger_scrape():
    """
    Manually trigger a scrape cycle
    (In production, this would be protected with auth)
    """
    try:
        from hunter_agent import HunterAgent
        
        agent = HunterAgent(
            gemini_api_key=os.environ.get("GEMINI_API_KEY", ""),
            apify_token=os.environ.get("APIFY_TOKEN", "")
        )
        
        agent.run_full_cycle()
        
        return {
            "status": "success",
            "message": "Scrape cycle completed",
            "stats": db.get_stats()
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ─── Carousel AI Endpoints ────────────────────────────────────────────────────

class ExtractTemplateRequest(BaseModel):
    images: List[str]  # List of base64-encoded image strings (max 3)

class MapSlidesRequest(BaseModel):
    value_text: Optional[str] = ""
    full_script: Optional[str] = ""
    hook: Optional[str] = ""

@app.post("/api/carousel/extract-template")
async def extract_template(req: ExtractTemplateRequest):
    """
    Analyze screenshot(s) with Gemini Vision and return a structured Design Schema JSON.

    Pipeline:
    1. Receive base64 image(s)
    2. Send to Gemini Vision with design extraction prompt
    3. Parse response into Design Schema JSON
    4. Classify template_family
    5. Return complete schema to frontend renderer
    """
    gemini_key = os.environ.get("GEMINI_API_KEY", "")
    if not gemini_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured")

    if not req.images:
        raise HTTPException(status_code=400, detail="No images provided")

    try:
        from carousel_processor import CarouselDesignExtractor

        extractor = CarouselDesignExtractor(api_key=gemini_key)
        result = extractor.extract_design_schema(req.images)

        if not result.get("success"):
            return {
                "success": False,
                "error": result.get("error", "Extraction failed"),
                "template_schema": None,
                "pipeline": "gemini-vision-v1",
                "images_processed": len(req.images),
            }

        schema = result["schema"]
        return {
            "success": True,
            "template_schema": schema,
            "pipeline": "gemini-vision-v1",
            "images_processed": len(req.images),
            # Keep these fields for frontend backward compat
            "extracted_style": {
                "template_family": schema.get("template_family"),
                "color_palette": schema.get("color_palette"),
                "typography": schema.get("typography"),
                "style_traits": schema.get("style_traits", []),
            },
            "asset_plan": {
                "visual_components": schema.get("visual_components", []),
                "layout_type": schema.get("layout_structure", {}).get("type"),
            },
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/carousel/map-to-slides")
async def map_to_slides(req: MapSlidesRequest):
    """
    Map creative content text into structured carousel slides using Gemini.
    """
    gemini_key = os.environ.get("GEMINI_API_KEY", "")
    if not gemini_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured")

    import google.generativeai as genai

    genai.configure(api_key=gemini_key)
    model = genai.GenerativeModel("gemini-1.5-flash")

    value_text = req.value_text or ""
    hook = req.hook or ""
    full_script = req.full_script or ""

    prompt = f"""You are a carousel content strategist. Convert the following content into structured carousel slides.

Hook: {hook}
Value Points: {value_text}
Full Script: {full_script}

Return JSON with this structure:
{{
  "slides": [
    {{
      "slide_number": 1,
      "type": "hook",
      "headline": "Short punchy headline (max 8 words)",
      "body": "Supporting text (max 20 words)",
      "cta": ""
    }},
    {{
      "slide_number": 2,
      "type": "value",
      "headline": "...",
      "body": "...",
      "cta": ""
    }}
  ]
}}

Create 5-8 slides. Last slide should be CTA. Return ONLY valid JSON."""

    try:
        response = model.generate_content(
            contents=prompt,
            generation_config={"temperature": 0.7, "max_output_tokens": 8192}
        )
        raw = response.text.strip()
        if raw.startswith("```json"):
            raw = raw[7:]
        elif raw.startswith("```"):
            raw = raw[3:]
        if raw.endswith("```"):
            raw = raw[:-3]
        data = json.loads(raw.strip())
        return {"success": True, "slides": data.get("slides", [])}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))




class ExtractTemplateFolderRequest(BaseModel):
    images: List[str]

@app.post("/api/carousel/extract-template-folder")
async def extract_template_folder(req: ExtractTemplateFolderRequest):
    """
    Analyze each image SEPARATELY.
    Returns N schemas (styles) + shared brand for template folder system.
    """
    gemini_key = os.environ.get("GEMINI_API_KEY", "")
    if not gemini_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured")
    if not req.images:
        raise HTTPException(status_code=400, detail="No images provided")
    if len(req.images) > 5:
        raise HTTPException(status_code=400, detail="Maximum 5 images allowed")

    from carousel_processor import CarouselDesignExtractor
    extractor = CarouselDesignExtractor(api_key=gemini_key)

    if len(req.images) == 1:
        # Single image — use existing extraction, wrap in folder format
        result = extractor.extract_design_schema(req.images)
        if not result.get("success"):
            raise HTTPException(status_code=500, detail=result.get("error", "Extraction failed"))
        schema = result["schema"]
        return {
            "success": True,
            "styles": [{"index": 0, "name": "Style 1", "schema": schema}],
            "shared_brand": {
                "color_palette": schema.get("color_palette", {}),
                "typography": schema.get("typography", {}),
                "canvas": schema.get("canvas", {})
            },
            "style_count": 1,
            "pipeline": "gemini-vision-single-v1"
        }

    # Multiple images — per-image extraction
    result = extractor.extract_design_schemas_per_image(req.images)
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Extraction failed"))

    return {
        "success": True,
        "styles": result["styles"],
        "shared_brand": result["shared_brand"],
        "style_count": result["style_count"],
        "pipeline": "gemini-vision-per-image-v1"
    }

@app.get("/api/carousel/template-families")
def get_template_families():
    """Returns available template families and their component sets."""
    from carousel_processor import TEMPLATE_FAMILIES
    return {"families": TEMPLATE_FAMILIES}




# ────────────────────────────────────────────────────
# Content Strategist Agent (Multi-phase pipeline)
# ────────────────────────────────────────────────────
class StrategistRequest(BaseModel):
    full_script: str = ""
    design_schema: dict = {}
    platform: str = "instagram"

@app.post("/api/carousel/strategize")
async def strategize_content(req: StrategistRequest):
    """
    Phase 2 of Gemini's ideal pipeline: Content Strategist Agent.
    Analyzes full_script and design_schema, returns per-slide decisions:
    - layout_type: hero-center | card-detail | text-heavy | dramatic-closer | split-visual | quote-highlight | list-bullets
    - visual_mode: diagram | icon | illustration | none
    - headline & body (cleaned, optimized)
    - emotional_tone: impact | educational | reflective | dramatic
    - visual_hint: what kind of visual fits this slide
    """
    gemini_key = os.environ.get("GEMINI_API_KEY", "")
    if not gemini_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured")

    if not req.full_script.strip():
        raise HTTPException(status_code=400, detail="full_script is required")

    import google.generativeai as genai
    genai.configure(api_key=gemini_key)
    model = genai.GenerativeModel("gemini-2.5-flash")

    # Extract design context from schema
    design_context = ""
    if req.design_schema:
        ds = req.design_schema
        design_context = f"""
DESIGN DNA dari referensi:
- Template family: {ds.get('template_family', 'unknown')}
- Color palette: {json.dumps(ds.get('color_palette', {}))}
- Font: {ds.get('font_style', 'sans-serif')}
- Visual mode default: {ds.get('visual_mode', 'icon')}
- Style traits: {ds.get('style_traits', [])}
"""

    prompt = f"""Kamu adalah Content Strategist Agent untuk carousel {req.platform}.

FULL SCRIPT:
{req.full_script}

{design_context}

TUGAS: Analisis script di atas dan buat keputusan PER-SLIDE. Setiap slide harus dioptimalkan untuk engagement sosial media.

ATURAN PENTING:
1. Setiap "Hal N:" adalah 1 slide
2. Slide pertama = HOOK (harus paling menarik, singkat, impactful)
3. Slide terakhir = CTA (ajakan bertindak)
4. Slide tengah = VALUE (edukasi/insight)
5. Headline MAKSIMAL 8-10 kata (potong jika terlalu panjang)
6. Body mendukung headline, bukan mengulang
7. ICON HARUS BERBEDA untuk setiap slide — jangan gunakan icon yang sama dua kali!
8. Konten bahasa Indonesia — terjemahkan konsep ke icon yang tepat (misal "uang" → banknote, "waktu" → clock)

LAYOUT TYPES (7 opsi):
- "hero-center": Headline besar di tengah, tanpa body. Untuk kalimat pendek & impactful. Cocok untuk hook.
- "card-detail": Headline + body dalam card bergaris. Untuk slide dengan penjelasan detail.
- "text-heavy": Multi-paragraf bertumpuk. Untuk narasi panjang (pecah jadi poin-poin).
- "dramatic-closer": Background gelap, teks besar centered. Untuk penutup/punchline/CTA.
- "split-visual": Icon/visual di kiri, teks di kanan. Untuk keseimbangan visual-teks. Bagus untuk value slides.
- "quote-highlight": Teks besar gaya kutipan dengan tanda kutip dekoratif. Untuk insight, wisdom, atau quote powerful.
- "list-bullets": Headline + poin-poin list (pakai • atau nomor di body). Untuk tips, langkah-langkah, checklist.

VISUAL MODES:
- "icon": Icon tunggal yang relevan dengan konten
- "diagram": Diagram/chart jika ada data/perbandingan/proses
- "none": Tanpa visual, teks saja (untuk slide teks panjang)

EMOTIONAL TONES:
- "impact": Mengejutkan, eye-catching (untuk hook)
- "educational": Informatif, insight (untuk value)
- "reflective": Kontemplatif, emosional (untuk narasi personal)
- "dramatic": Kuat, final, berkesan (untuk CTA/penutup)

Balas HANYA dalam format JSON array berikut (tanpa markdown, tanpa penjelasan):
[
  {{
    "slide_number": 1,
    "slide_type": "hook",
    "layout_type": "hero-center",
    "visual_mode": "icon",
    "visual_hint": "deskripsi singkat visual yang cocok",
    "icon_name": "nama icon lucide yang relevan",
    "headline": "Headline yang sudah dioptimalkan",
    "body": "Body text (kosongkan jika layout hero-center)",
    "emotional_tone": "impact",
    "bg_variant": "light"
  }}
]

bg_variant: "light" (latar terang) atau "dark" (latar gelap) — variasikan untuk ritme visual.
icon_name: WAJIB UNIK per slide — jangan ulangi icon yang sama! Gunakan nama icon dari Lucide icons.
Contoh icon: alert-triangle, heart, target, zap, compass, brain, lightbulb, shield, star, sparkles, flame, eye, hand, users, clock, map-pin, award, trending-up, check-circle, x-circle, rocket, send, key, lock, globe, bar-chart-3, layers, code, briefcase, wallet, banknote, book-open, graduation-cap, wrench, search, filter, crown, diamond, gem, thumbs-up, message-circle, camera, play-circle, megaphone, palette, pen-tool, cpu, bot, shopping-cart, tag, calculator, calendar, bell, bookmark, clipboard.
"""

    try:
        response = model.generate_content(prompt)
        raw_text = response.text.strip()

        # Clean markdown fences if present
        if raw_text.startswith("```"):
            raw_text = re.sub(r'^```(?:json)?\s*', '', raw_text)
            raw_text = re.sub(r'```\s*$', '', raw_text)

        slides = json.loads(raw_text)
        if not isinstance(slides, list):
            raise ValueError("Response is not a JSON array")

        return {
            "success": True,
            "slides": slides,
            "slide_count": len(slides)
        }
    except json.JSONDecodeError as e:
        # Return raw text for debugging
        return {
            "success": False,
            "error": f"JSON parse failed: {str(e)}",
            "raw": raw_text[:1000] if 'raw_text' in dir() else ""
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Strategist failed: {str(e)}")


# ────────────────────────────────────────────────────
# AI Script Writer (Copywriter & Social Media Strategist)
# ────────────────────────────────────────────────────
class AIScriptRequest(BaseModel):
    title: str = ""
    hook: str = ""
    value: str = ""
    cta: str = ""
    existing_script: str = ""
    platforms: list = []

@app.post("/api/ai-script")
async def ai_script_writer(req: AIScriptRequest):
    gemini_key = os.environ.get("GEMINI_API_KEY", "")
    if not gemini_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured")

    import google.generativeai as genai
    genai.configure(api_key=gemini_key)
    model = genai.GenerativeModel("gemini-2.5-flash")

    platform_str = ", ".join(req.platforms) if req.platforms else "Instagram"

    prompt = f"""Kamu adalah AI Copywriter & Social Media Strategist profesional.
Tugas: Buat FULL SCRIPT carousel konten untuk platform {platform_str}.

KONTEKS:
- Judul/Topik: {req.title or '(tidak ada)'}
- Hook (pembuka): {req.hook or '(belum ada)'}
- Value points: {req.value or '(belum ada)'}
- CTA (penutup): {req.cta or '(belum ada)'}
- Script yang sudah ada: {req.existing_script[:500] if req.existing_script else '(belum ada)'}

INSTRUKSI:
1. Buat script carousel dengan 7-10 slide
2. Gunakan format "Hal N:" untuk memisahkan setiap slide
3. Hal 1 = HOOK yang powerful (3 detik pertama harus menarik)
4. Hal 2-8 = VALUE (edukasi, insight, tips, atau storytelling)
5. Slide terakhir = CTA yang jelas
6. Setiap slide:
   - Baris pertama = HEADLINE (maks 10 kata, impactful)
   - Baris selanjutnya = BODY (deskripsi 1-3 kalimat)
7. Gunakan bahasa sehari-hari Indonesia (casual tapi bermakna)
8. Jika sudah ada script/hook/value, TINGKATKAN kualitasnya (lebih engaging, hook lebih kuat, value lebih tajam)

FORMAT OUTPUT (HANYA script, tanpa penjelasan tambahan):
Hal 1:
[hook headline]
[hook body]

Hal 2:
[value headline]
[value body]

...dst"""

    try:
        response = model.generate_content(prompt)
        script_text = response.text.strip()
        slide_count = len(re.findall(r'^Hal\s*\d+\s*:', script_text, re.MULTILINE | re.IGNORECASE))
        return {
            "success": True,
            "full_script": script_text,
            "slide_count": slide_count
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI generation failed: {str(e)}")


# ────────────────────────────────────────────────────
# Icon Resolver (Gemini-powered icon selection)
# ────────────────────────────────────────────────────
class ResolveIconsRequest(BaseModel):
    slides: list  # [{ "headline": "...", "body": "...", "slide_type": "hook" }, ...]

@app.post("/api/carousel/resolve-icons")
async def resolve_icons(req: ResolveIconsRequest):
    """
    Resolve the best Lucide icon for each slide using Gemini.
    Used as fallback when Content Strategist is skipped,
    or when user edits slide text and needs icon refresh.
    """
    gemini_key = os.environ.get("GEMINI_API_KEY", "")
    if not gemini_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured")

    if not req.slides:
        return {"success": True, "icons": []}

    import google.generativeai as genai
    genai.configure(api_key=gemini_key)
    model = genai.GenerativeModel("gemini-2.5-flash")

    slides_text = ""
    for i, s in enumerate(req.slides[:15]):
        headline = s.get("headline", "")
        body = s.get("body", "")
        slide_type = s.get("slide_type", "value")
        slides_text += f"Slide {i+1} ({slide_type}): {headline} — {body}\n"

    prompt = f"""Kamu adalah icon specialist. Pilih 1 Lucide icon yang PALING COCOK untuk setiap slide carousel.

SLIDES:
{slides_text}

ATURAN:
1. Icon harus RELEVAN dengan makna/konteks headline & body
2. Gunakan HANYA nama icon dari Lucide icons (lowercase-kebab-case)
3. Jangan ulangi icon yang sama — setiap slide harus icon berbeda
4. Konten dalam bahasa Indonesia — terjemahkan konteksnya ke konsep visual yang tepat
5. Untuk slide hook: pilih icon yang eye-catching (zap, flame, sparkles, eye, alert-triangle)
6. Untuk slide CTA: pilih icon yang action-oriented (arrow-right, send, mouse-pointer-click, rocket)
7. Untuk slide value: pilih icon yang match topik spesifik

CONTOH ICON YANG TERSEDIA:
lightbulb, brain, target, compass, map, trophy, shield, heart, users, clock,
trending-up, bar-chart-3, pie-chart, workflow, git-branch, layers, palette,
pen-tool, code, terminal, database, globe, monitor, camera, play-circle,
megaphone, briefcase, wallet, banknote, book-open, graduation-cap, wrench,
settings, search, filter, check-circle, x-circle, alert-triangle, info,
star, award, badge, crown, diamond, gem, flame, zap, sparkles, eye,
hand, thumbs-up, message-circle, mail, phone, share-2, link, download,
upload, cloud, lock, unlock, key, cpu, bot, rocket, plane, map-pin,
home, building, store, shopping-cart, tag, percent, calculator, calendar,
timer, bell, flag, bookmark, clipboard, file-text, folder, image, film,
mic, headphones, speaker, music, heart-pulse, activity, footprints,
arrow-right, arrow-up-right, mouse-pointer-click, send, external-link

Balas HANYA dalam format JSON array (tanpa markdown):
[
  {{"slide": 1, "icon": "nama-icon", "reason": "alasan singkat"}}
]"""

    try:
        response = model.generate_content(prompt)
        raw_text = response.text.strip()

        if raw_text.startswith("```"):
            raw_text = re.sub(r'^```(?:json)?\s*', '', raw_text)
            raw_text = re.sub(r'```\s*$', '', raw_text)

        icons = json.loads(raw_text)
        if not isinstance(icons, list):
            raise ValueError("Response is not a JSON array")

        return {
            "success": True,
            "icons": icons
        }
    except json.JSONDecodeError as e:
        return {
            "success": False,
            "error": f"JSON parse failed: {str(e)}",
            "icons": []
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Icon resolver failed: {str(e)}")


# ────────────────────────────────────────────────────
# AI Composition Engine — Gemini generates Fabric.js element positions
# ────────────────────────────────────────────────────
class ComposeRequest(BaseModel):
    slides: list = []           # [{headline, body, slide_type, layout_type, icon_name, visual_mode, emotional_tone, bg_variant}]
    design_schema: dict = {}    # From extract-template
    template_preset: str = ""   # e.g. "minimal-dark", "bold-gradient"
    canvas_size: str = "1080x1080"

@app.post("/api/carousel/compose")
async def compose_slides(req: ComposeRequest):
    """
    AI Composition Engine — generates pixel-level Fabric.js element positioning.
    Input: slides with content + design context
    Output: per-slide Composition JSON with exact x,y,w,h for every element
    """
    gemini_key = os.environ.get("GEMINI_API_KEY", "")
    if not gemini_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured")

    if not req.slides:
        raise HTTPException(status_code=400, detail="slides array is required")

    import google.generativeai as genai
    genai.configure(api_key=gemini_key)

    # Parse canvas dimensions (needed for system instruction)
    try:
        cw, ch = req.canvas_size.split("x")
        canvas_w, canvas_h = int(cw), int(ch)
    except:
        canvas_w, canvas_h = 1080, 1080

    # Build design context
    design_ctx = ""
    if req.design_schema:
        ds = req.design_schema
        design_ctx = f"""
DESIGN DNA:
- Template family: {ds.get('template_family', 'unknown')}
- Colors: {json.dumps(ds.get('color_palette', {}))}
- Typography: {json.dumps(ds.get('typography', {}))}
- Visual mode: {ds.get('visual_mode', 'icon')}
- Decorative elements: {json.dumps(ds.get('decorative_elements', {}))}
- Style traits: {ds.get('style_traits', [])}
"""

    slides_json = json.dumps(req.slides, ensure_ascii=False, indent=2)

    # ── System instruction: expert visual composer ──
    system_instruction = f"""Kamu adalah SENIOR VISUAL DESIGNER AI untuk carousel sosial media profesional.
Kamu merancang layout pixel-perfect yang siap render di Fabric.js canvas.

PRINSIP DESAIN:
- Whitespace adalah elemen desain — jangan penuhi canvas
- Hierarki visual yang jelas: mata pembaca mengalir dari headline → icon → body → footer
- Konsistensi spacing: gunakan kelipatan 8px (8, 16, 24, 32, 40, 48, 64, 80)
- Kontras warna minimal 4.5:1 untuk teks agar mudah dibaca
- Setiap slide harus punya focal point yang jelas

CANVAS: {canvas_w}x{canvas_h} pixels
SAFE ZONE: 64px padding dari semua edge (konten di area {canvas_w - 128}x{canvas_h - 128} di tengah)"""

    model = genai.GenerativeModel("gemini-2.5-flash", system_instruction=system_instruction)

    prompt = f"""{design_ctx}

TEMPLATE PRESET: {req.template_preset or 'minimal-dark'}

TEMPLATE COLOR GUIDE:
- "minimal-dark": bg=#0f0f11, accent=#8b5cf6 (purple), text=#ffffff, surface=rgba(255,255,255,0.04)
- "bold-gradient": bg=#1a0533, accent=#f59e0b (amber), text=#ffffff, gradients lebih dramatis
- "minimal-light": bg=#fafafa, accent=#3b82f6 (blue), text=#1a1a1a, clean & bright
- "professional": bg=#0f172a, accent=#0ea5e9 (sky), text=#f1f5f9, corporate feel
- "warm-earth": bg=#1c1917, accent=#d97706 (warm), text=#fef3c7, organic tones
- "neon-dark": bg=#0a0a0a, accent=#22d3ee (cyan), text=#ffffff, glow effects

SLIDES DATA:
{slides_json}

TUGAS: Generate Composition JSON untuk SETIAP slide.

ELEMENT TYPES (gunakan PERSIS format ini):

1. "gradient-bg" — WAJIB ada sebagai elemen pertama
   Properties: width, height, colorStops: [{{offset, color}}], direction: "to-bottom"|"to-bottom-right"|"to-right"

2. "circle" — Dekoratif glow/blur blobs
   Properties: left, top, radius(100-250), fill: "rgba(accent, 0.06-0.12)"

3. "rect" — Shapes, cards, icon backgrounds
   Properties: left, top, width, height, fill, stroke, strokeWidth, rx, ry, opacity

4. "textbox" — Teks (headline, body, badge, footer)
   Properties: left, top, width(max {canvas_w - 128}), text, fontSize, fontWeight("400"-"900"), fontFamily("Inter, sans-serif"), fill, textAlign, lineHeight(1.2-1.7)

5. "lucide-icon" — Icon dari Lucide (kebab-case: "sparkles", "zap", "brain", "target", dll)
   Properties: iconName(kebab-case), left, top, size(48-96), color

6. "line" — Garis dekoratif/divider
   Properties: x1, y1, x2, y2, stroke, strokeWidth(1-3)

7. "image" — Placeholder gambar
   Properties: left, top, width, height, src("placeholder"), rx, opacity

ATURAN LAYOUT per layout_type:

"hero-center": Headline centered fontSize 52-64 fontWeight 800, Icon centered di atas size 80-96 dengan rect bg, Tanpa body, Accent line pendek
"card-detail": Rect card frame surface color rx 24, Icon top-left size 64, Headline fontSize 40-48, Body fontSize 22-26
"split-visual": Divider vertikal di 42%, Kiri icon besar/image, Kanan headline+body
"quote-highlight": Tanda kutip dekoratif fontSize 120 opacity 0.15, Headline centered italic fontSize 44-52, Body attribution fontSize 20
"list-bullets": Headline top fontSize 36-42, Body bullet list dengan newline "• " prefix, Icon top-left size 56-64
"dramatic-closer": Dark overlay rect rgba(0,0,0,0.4), Headline centered fontSize 56-64 fontWeight 900, Body centered, Tanpa icon
"text-heavy": Headline top-left fontSize 38-44, Body below fontSize 22-26 lineHeight 1.7, Tanpa icon

ATURAN WAJIB:
1. SETIAP slide: gradient-bg → decorations → content → footer
2. Minimal 2 circle glow blobs per slide (radius 120-220, opacity 0.05-0.12)
3. Minimal 1 accent line per slide
4. VARIASI posisi decorations antar slide — jangan copy-paste
5. Footer WAJIB: textbox "@jadisatu.cloud" left:80 top:{canvas_h - 70} + progress circle dots
6. Icon WAJIB kebab-case: "sparkles", "zap", "brain", "target", "heart", "lightbulb", "rocket"
7. Semua left/top/width/height = integer bulat. fontFamily SELALU "Inter, sans-serif"
8. Setiap elemen WAJIB punya "id" unik (contoh: "bg", "deco-glow-1", "headline", "body", "icon-main", "footer-brand")

Balas HANYA JSON array. Tanpa markdown fences. Tanpa penjelasan.
[{{"slide_index":0,"canvas":{{"width":{canvas_w},"height":{canvas_h}}},"elements":[...]}}]
"""

    try:
        response = model.generate_content(
            contents=prompt,
            generation_config={"temperature": 0.7, "max_output_tokens": 8192}
        )
        raw_text = response.text.strip()

        # Clean markdown fences if present
        if raw_text.startswith("```"):
            raw_text = re.sub(r'^```(?:json)?\s*', '', raw_text)
            raw_text = re.sub(r'```\s*$', '', raw_text)

        compositions = json.loads(raw_text)
        if not isinstance(compositions, list):
            raise ValueError("Response is not a JSON array")

        # Post-process: ensure all elements have required fields
        for comp in compositions:
            for el in comp.get("elements", []):
                if "id" not in el:
                    el["id"] = el.get("type", "el") + "-auto"

        return {
            "success": True,
            "compositions": compositions,
            "slide_count": len(compositions),
            "canvas": {"width": canvas_w, "height": canvas_h}
        }
    except json.JSONDecodeError as e:
        return {
            "success": False,
            "error": f"JSON parse failed: {str(e)}",
            "raw": raw_text[:2000] if 'raw_text' in dir() else "",
            "compositions": []
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Compose failed: {str(e)}")


# ── Visual Engine Proxy ──────────────────────────────────────────────
# Forward /api/visual/* to the visual-engine service on port 8100.
# This allows the frontend to reach the visual-engine through the existing
# nginx /api/ → port 8000 proxy, even if the dedicated nginx /api/visual/
# proxy block is not yet configured.

import httpx
from fastapi import Request
from fastapi.responses import StreamingResponse, Response

VISUAL_ENGINE_BASE = os.getenv("VISUAL_ENGINE_URL", "http://127.0.0.1:8100")

@app.api_route("/api/visual/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
async def proxy_visual_engine(path: str, request: Request):
    """Reverse-proxy all /api/visual/* requests to the visual-engine service."""
    target_url = f"{VISUAL_ENGINE_BASE}/api/visual/{path}"

    headers = dict(request.headers)
    headers.pop("host", None)

    body = await request.body()

    async with httpx.AsyncClient(timeout=120.0) as client:
        try:
            resp = await client.request(
                method=request.method,
                url=target_url,
                headers=headers,
                content=body,
                params=dict(request.query_params),
            )
        except httpx.ConnectError:
            raise HTTPException(
                status_code=502,
                detail="Visual Engine service is not running. Start it with: pm2 start ecosystem.config.js --only visual-engine"
            )

    return Response(
        content=resp.content,
        status_code=resp.status_code,
        headers=dict(resp.headers),
        media_type=resp.headers.get("content-type"),
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
