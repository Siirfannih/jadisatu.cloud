"""
Visual Engine — FastAPI Application
Clean API for the new visual content generation system.

Endpoints:
    POST /api/visual/extract-templates   — Smart Extractor v2 (image → HTML/CSS)
    POST /api/visual/generate            — Full pipeline (topic → slides → PNG)
    POST /api/visual/render-slide        — Render single slide from template
    GET  /api/visual/templates           — List available template folders
    GET  /api/visual/templates/{id}      — Get template folder details
    DELETE /api/visual/templates/{id}    — Delete template folder
"""

import os
import sys
import json
import uuid
import asyncio
from pathlib import Path
from typing import Optional
from datetime import datetime

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from renderer.smart_extractor import SmartExtractorV2
from renderer.template_engine import render_html, prepare_ai_template
from renderer.template_store import TemplateFolder, TemplateStore, SlideStyleSelector
from renderer.render import screenshot_html, render_slides

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

app = FastAPI(
    title="JadiSatu Visual Engine",
    version="2.0.0",
    description="HTML/CSS template-based visual content generation",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

OUTPUT_DIR = Path(__file__).parent.parent / "output"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Serve generated images
app.mount("/output", StaticFiles(directory=str(OUTPUT_DIR)), name="output")

# Initialize services
extractor = SmartExtractorV2()
store = TemplateStore()


# ---------------------------------------------------------------------------
# Request/Response models
# ---------------------------------------------------------------------------

class ExtractTemplatesRequest(BaseModel):
    """Extract HTML/CSS templates from reference design images."""
    images: list[str] = Field(..., description="Base64-encoded images (1-5)")
    folder_name: str = Field(default="My Templates", description="Name for the template folder")
    user_id: Optional[str] = Field(default=None, description="User ID for storage")


class ExtractTemplatesResponse(BaseModel):
    success: bool
    folder_id: str
    folder_name: str
    template_count: int
    templates: list[dict]


class RenderSlideRequest(BaseModel):
    """Render a single slide using a template from a folder."""
    folder_id: str = Field(..., description="Template folder ID")
    template_index: int = Field(default=0, description="Which template style to use (0-based)")
    template_name: Optional[str] = Field(default=None, description="Or select by name")
    slide_data: dict = Field(..., description="Slide content: headline, body, icon_name, etc.")
    brand: dict = Field(default={}, description="Brand config override")


class RenderSlideResponse(BaseModel):
    success: bool
    image_url: str
    slide_data: dict


class GenerateCarouselRequest(BaseModel):
    """Generate a full carousel using template folder + AI content."""
    folder_id: str = Field(..., description="Template folder ID")
    topic: str = Field(..., description="Carousel topic")
    hook: Optional[str] = Field(default=None, description="Opening hook")
    value_points: list[str] = Field(default=[], description="Key points to cover")
    cta: Optional[str] = Field(default=None, description="Call to action")
    brand: dict = Field(default={}, description="Brand config")
    num_slides: int = Field(default=7, ge=3, le=15)
    style_assignments: Optional[dict[str, int]] = Field(
        default=None,
        description="Map of slide_index → template_index. If not set, uses first template for all."
    )


class GenerateCarouselResponse(BaseModel):
    success: bool
    generation_id: str
    slides: list[dict]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/api/visual/health")
async def health_check():
    return {"status": "ok", "engine": "visual-engine-v2", "version": "2.0.0"}


@app.post("/api/visual/extract-templates", response_model=ExtractTemplatesResponse)
async def extract_templates(req: ExtractTemplatesRequest):
    """
    Smart Extractor v2: Convert reference images into HTML/CSS templates.

    - 1 image → 1 template
    - 3 images → 3 templates in a folder
    - Max 5 images

    Each template is a complete HTML/CSS file that replicates the reference design's
    visual style, with placeholders for content.
    """
    if not req.images:
        raise HTTPException(status_code=400, detail="At least 1 image required")
    if len(req.images) > 5:
        raise HTTPException(status_code=400, detail="Maximum 5 images allowed")

    try:
        # Extract templates from images
        result = await extractor.create_template_folder(
            images_base64=req.images,
            folder_name=req.folder_name,
            user_id=req.user_id,
        )

        # Create folder and save
        folder = TemplateFolder(
            name=result["folder_name"],
            templates=result["templates"],
            user_id=req.user_id,
        )
        saved = await store.save_folder(folder)

        # Generate preview thumbnails for each template
        previews = []
        for i, template in enumerate(result["templates"]):
            preview_dir = OUTPUT_DIR / "previews" / folder.id
            preview_dir.mkdir(parents=True, exist_ok=True)

            try:
                preview_path = await screenshot_html(
                    template["html"],
                    output_path=str(preview_dir / f"preview_{i}.png"),
                    width=1080,
                    height=1080,
                )
                template["preview_url"] = f"/output/previews/{folder.id}/preview_{i}.png"
            except Exception:
                template["preview_url"] = None

            previews.append(template)

        return ExtractTemplatesResponse(
            success=True,
            folder_id=folder.id,
            folder_name=folder.name,
            template_count=len(result["templates"]),
            templates=previews,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)}")


@app.post("/api/visual/render-slide", response_model=RenderSlideResponse)
async def render_slide(req: RenderSlideRequest):
    """
    Render a single slide using a template from a folder.

    The template HTML has placeholders ({{headline}}, {{body}}, etc.)
    which get replaced with the provided slide_data.
    """
    folder_data = await store.get_folder(req.folder_id)
    if not folder_data:
        raise HTTPException(status_code=404, detail="Template folder not found")

    templates = folder_data.get("templates", [])

    # Select template by name or index
    template = None
    if req.template_name:
        for t in templates:
            if t.get("name") == req.template_name:
                template = t
                break
    if template is None and 0 <= req.template_index < len(templates):
        template = templates[req.template_index]

    if template is None:
        raise HTTPException(status_code=400, detail="Template not found")

    try:
        # Render template with slide data
        html = prepare_ai_template(
            raw_html=template["html"],
            slide_data=req.slide_data,
            brand=req.brand,
            icon_svg=req.slide_data.get("icon_svg", ""),
            illustration_url=req.slide_data.get("illustration_url", ""),
        )

        # Screenshot
        gen_id = str(uuid.uuid4())[:8]
        output_path = str(OUTPUT_DIR / "renders" / f"slide_{gen_id}.png")

        await screenshot_html(html, output_path=output_path)

        return RenderSlideResponse(
            success=True,
            image_url=f"/output/renders/slide_{gen_id}.png",
            slide_data=req.slide_data,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Render failed: {str(e)}")


@app.post("/api/visual/generate", response_model=GenerateCarouselResponse)
async def generate_carousel(req: GenerateCarouselRequest):
    """
    Full pipeline: Generate carousel slides using template folder + AI content.

    1. Load template folder
    2. Generate slide content via Gemini AI
    3. Apply content to templates (with per-slide style selection)
    4. Render all slides via Playwright
    5. Return image URLs
    """
    folder_data = await store.get_folder(req.folder_id)
    if not folder_data:
        raise HTTPException(status_code=404, detail="Template folder not found")

    try:
        # Step 1: Generate AI content for slides
        slide_contents = await _generate_slide_content(
            topic=req.topic,
            hook=req.hook,
            value_points=req.value_points,
            cta=req.cta,
            num_slides=req.num_slides,
        )

        # Step 2: Create style selector
        folder = TemplateFolder(
            name=folder_data["name"],
            templates=folder_data["templates"],
            folder_id=folder_data["id"],
        )
        selector = SlideStyleSelector(folder)

        # Apply style assignments
        if req.style_assignments:
            for slide_idx_str, template_idx in req.style_assignments.items():
                slide_idx = int(slide_idx_str)
                template = folder.get_template(template_idx)
                if template:
                    selector.assign(slide_idx, template["name"])
        else:
            # Default: use first template for all
            if folder.templates:
                selector.assign_all(folder.templates[0]["name"], req.num_slides)

        # Step 3: Render each slide
        gen_id = str(uuid.uuid4())[:8]
        gen_dir = OUTPUT_DIR / "generations" / gen_id
        gen_dir.mkdir(parents=True, exist_ok=True)

        html_slides = []
        for i, slide_data in enumerate(slide_contents):
            template = selector.get_template_for_slide(i)
            if template:
                html = prepare_ai_template(
                    raw_html=template["html"],
                    slide_data=slide_data,
                    brand=req.brand,
                )
                html_slides.append(html)

        # Step 4: Batch render
        output_paths = await render_slides(html_slides, str(gen_dir))

        # Step 5: Build response
        slides = []
        for i, (path, slide_data) in enumerate(zip(output_paths, slide_contents)):
            slides.append({
                "index": i,
                "type": slide_data.get("type", "content"),
                "image_url": f"/output/generations/{gen_id}/slide_{i}.png",
                "data": slide_data,
                "template_used": selector.assignments.get(i, folder.templates[0]["name"] if folder.templates else ""),
            })

        return GenerateCarouselResponse(
            success=True,
            generation_id=gen_id,
            slides=slides,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")


@app.get("/api/visual/templates")
async def list_templates(user_id: Optional[str] = None):
    """List all template folders for a user."""
    folders = await store.list_folders(user_id)
    return {"folders": folders}


@app.get("/api/visual/templates/{folder_id}")
async def get_template_folder(folder_id: str):
    """Get template folder details including all template HTMLs."""
    folder = await store.get_folder(folder_id)
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    return folder


@app.delete("/api/visual/templates/{folder_id}")
async def delete_template_folder(folder_id: str):
    """Delete a template folder."""
    deleted = await store.delete_folder(folder_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Folder not found")
    return {"success": True}


# ---------------------------------------------------------------------------
# AI Content Generation (internal)
# ---------------------------------------------------------------------------

async def _generate_slide_content(
    topic: str,
    hook: Optional[str],
    value_points: list[str],
    cta: Optional[str],
    num_slides: int,
) -> list[dict]:
    """
    Generate slide content using Gemini AI.

    Returns list of slide data dicts with:
    headline, body, subheadline, type, icon_name, slide_number
    """
    import google.generativeai as genai

    api_key = os.environ.get("GEMINI_API_KEY", "")
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel("gemini-2.5-flash")

    points_text = "\n".join(f"- {p}" for p in value_points) if value_points else ""

    prompt = f"""Generate content for a {num_slides}-slide Instagram carousel about: {topic}

{"Hook/Opening: " + hook if hook else ""}
{"Key points:" + chr(10) + points_text if points_text else ""}
{"Call to action: " + cta if cta else ""}

Return a JSON array with {num_slides} slides. Each slide must have:
{{
  "type": "cover" | "content" | "cta",
  "headline": "short punchy headline",
  "body": "1-2 sentences of supporting text",
  "subheadline": "optional subtitle",
  "icon_name": "lucide icon name (lowercase, e.g. rocket, brain, target, heart, zap)",
  "slide_number": "01"
}}

Rules:
- Slide 1 = cover (hook/attention grabber)
- Last slide = cta
- Middle slides = content (one key point per slide)
- Headlines: max 8 words, punchy
- Body: max 25 words, clear
- Icon names must be valid Lucide icons

Return ONLY the JSON array."""

    response = await model.generate_content_async(
        prompt,
        generation_config={"temperature": 0.7, "max_output_tokens": 4096},
    )

    text = response.text.strip()
    if text.startswith("```json"):
        text = text[7:]
    if text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]

    slides = json.loads(text.strip())

    # Ensure slide numbers
    for i, slide in enumerate(slides):
        slide["slide_number"] = f"{i+1:02d}"

    return slides


# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8100)
