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
            "/api/carousel/template-families"
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
        response = model.generate_content(prompt)
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


@app.get("/api/carousel/template-families")
def get_template_families():
    """Returns available template families and their component sets."""
    from carousel_processor import TEMPLATE_FAMILIES
    return {"families": TEMPLATE_FAMILIES}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
