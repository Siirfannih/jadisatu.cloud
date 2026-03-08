"""
Carousel Design Schema Processor
Extracts structured Design Schema JSON from screenshots using Gemini Vision.
Classifies designs into template families for the component-based renderer.
"""

import google.generativeai as genai
import json
import base64
from typing import List, Dict, Optional

# ─── Template Family Definitions ─────────────────────────────────────────────
TEMPLATE_FAMILIES = {
    "dark_editorial_diagram": {
        "description": "Dark background with geometric diagrams, arcs, node points, technical annotations",
        "components": ["diagram-arc", "node-points", "dashed-divider", "annotation-labels"],
        "style_signals": ["dark", "geometric", "editorial", "minimal", "technical", "bold", "futuristic"],
        "visual_signals": ["diagram", "arc", "chart", "node", "flow", "graph", "arrow", "infographic"],
        "color_signal": "dark_bg",
    },
    "warm_photo_editorial": {
        "description": "Warm color palette with photo elements, serif typography, editorial aesthetic",
        "components": ["hero-photo", "overlay-gradient", "serif-headline", "decorative-doodles"],
        "style_signals": ["warm", "editorial", "photo", "organic", "earthy", "vintage", "textured"],
        "visual_signals": ["photo", "image", "gradient", "overlay", "texture", "doodle", "serif"],
        "color_signal": "warm_colors",
    },
    "minimal_educational": {
        "description": "Clean minimal layout with steps, bullets, icons for educational content",
        "components": ["numbered-steps", "icon-bullets", "clean-divider", "caption-box"],
        "style_signals": ["minimal", "clean", "educational", "structured", "simple", "instructional"],
        "visual_signals": ["steps", "bullets", "list", "numbered", "checklist", "caption", "icons"],
        "color_signal": "neutral_bg",
    },
}

# ─── Gemini Vision Prompt ─────────────────────────────────────────────────────
DESIGN_EXTRACTION_PROMPT = """You are a senior design analyst AI. Analyze the provided screenshot(s) of a design, slide, or carousel card.

Extract a SPECIFIC, ACCURATE Design Schema JSON. Return ONLY valid JSON — no markdown, no code fences, no explanations.

Study the actual colors, fonts, layout, and components visible in the image.

Return this exact structure:

{
  "template_family": "<exactly one of: dark_editorial_diagram | warm_photo_editorial | minimal_educational>",
  "canvas": {
    "width": 1080,
    "height": 1080,
    "aspect_ratio": "1:1"
  },
  "color_palette": {
    "background": "<hex of main canvas background color>",
    "primary": "<hex of dominant brand/accent color>",
    "secondary": "<hex of secondary accent color>",
    "accent": "<hex of highlight or CTA color>",
    "text_primary": "<hex of main text color>",
    "text_secondary": "<hex of body text color>",
    "text_muted": "<hex of muted/caption text>",
    "surface": "<hex of card/panel surface color>"
  },
  "color_roles": {
    "background": "<exact hex of canvas background — must match what you see>",
    "surface": "<hex of card/panel surface>",
    "text_primary": "<hex of main heading/text color>",
    "text_secondary": "<hex of body/subtitle text>",
    "accent": "<hex of highlight/CTA color>",
    "line": "<hex of lines, borders, dividers, diagram strokes visible in design>",
    "muted_line": "<hex of subtle background lines, grids, secondary strokes>"
  },
  "visual_mode": "<exactly one of: diagram | illustration | icon | none>",
  "diagram_type": "<only when visual_mode is diagram: flowchart | arc | cycle | comparison | timeline | coherence_arc | none>",
  "typography": {
    "heading_font": "<font name, e.g. Inter, Playfair Display, Roboto>",
    "body_font": "<font name>",
    "heading_weight": "<700 or 800 or 900>",
    "body_weight": "<400 or 500>",
    "heading_size_scale": "<large or medium or small>",
    "body_size_scale": "<small or medium>",
    "letter_spacing": "<tight or normal or wide>",
    "line_height": "<tight or normal or relaxed>"
  },
  "layout_structure": {
    "type": "<center_stack or split_horizontal or list_vertical or hero_text or fullbleed>",
    "alignment": "<center or left or right>",
    "text_alignment": "<center or left or right>",
    "padding": 64,
    "gap": 24,
    "visual_position": "<top or bottom or left or right or none or background>",
    "has_slide_number": true,
    "has_footer": false,
    "has_logo_area": false,
    "grid_columns": 1
  },
  "visual_components": ["<list actual components visible: diagram-arc, node-points, dashed-divider, annotation-labels, hero-photo, overlay-gradient, serif-headline, decorative-doodles, numbered-steps, icon-bullets, clean-divider, caption-box, progress-bar, quote-block, stats-block, icon-grid, timeline>"],
  "style_traits": ["<list style descriptors: dark, light, minimal, editorial, warm, cool, geometric, organic, bold, subtle, modern, retro, playful, professional, educational, storytelling>"],
  "content_genre": "<educational or storytelling or promotional or tutorial or motivational or brand>"
}

Template Family Classification Guide:
- dark_editorial_diagram: Dark background (very dark grey or black), geometric SVG shapes, diagram arcs, node graphs, dashed lines, technical annotations, sans-serif fonts, high contrast
- warm_photo_editorial: Warm palette (browns, oranges, creams, earth tones), photo areas, gradient overlays, serif fonts, hand-drawn doodles/decorations, organic feel
- minimal_educational: Light or neutral background (white, light grey, beige), clean layout, numbered steps, bullet lists, icon-based structure, lots of whitespace

IMPORTANT: Extract REAL hex colors from the image. Do not use generic placeholder values.

CRITICAL color rules:
- For dark designs: background MUST be the TRUE dark color you see (e.g. #050505, #0a0a0f, #1a1a2e), NOT approximated grays like #333 or #666
- line = color of actual visible lines, borders, dividers, or diagram strokes in the image
- muted_line = very subtle secondary line color for grids or background strokes
- If no lines are visible, set line to the primary color and muted_line to text_muted

Visual mode classification:
- diagram: design contains charts, node graphs, flow diagrams, arc curves, connected elements, data visualization
- illustration: design has a large hero visual, scene, photo, or decorative artwork
- icon: design uses small supporting symbols/icons only
- none: design is purely typography and spacing with no visual elements"""


# ─── Gemini Vision Extractor ──────────────────────────────────────────────────
class CarouselDesignExtractor:
    def __init__(self, api_key: str):
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel("gemini-2.5-flash")

    def extract_design_schema(self, images_b64: List[str]) -> Dict:
        """
        Analyze screenshots with Gemini Vision.
        Returns a structured Design Schema JSON.
        """
        try:
            parts = [DESIGN_EXTRACTION_PROMPT]

            for img_b64 in images_b64[:3]:  # Limit to 3 images
                # Strip data URI header if present (data:image/jpeg;base64,...)
                if "," in img_b64:
                    header, data = img_b64.split(",", 1)
                    mime = (
                        header.split(":")[1].split(";")[0]
                        if ":" in header
                        else "image/jpeg"
                    )
                else:
                    data = img_b64
                    mime = "image/jpeg"

                img_bytes = base64.b64decode(data)
                parts.append(
                    {"mime_type": mime, "data": img_bytes}
                )

            response = self.model.generate_content(parts)
            raw = response.text.strip()

            # Strip markdown code fences if Gemini wraps in them
            if raw.startswith("```json"):
                raw = raw[7:]
            elif raw.startswith("```"):
                raw = raw[3:]
            if raw.endswith("```"):
                raw = raw[:-3]
            raw = raw.strip()

            gemini_schema = json.loads(raw)

            # Validate and normalize template_family
            family = gemini_schema.get("template_family", "")
            if family not in TEMPLATE_FAMILIES:
                classifier = TemplateFamilyClassifier()
                family = classifier.classify(
                    style_traits=gemini_schema.get("style_traits", []),
                    color_palette=gemini_schema.get("color_palette", {}),
                    visual_components=gemini_schema.get("visual_components", []),
                )
                gemini_schema["template_family"] = family

            # Build complete normalized schema
            schema = build_complete_schema(gemini_schema)

            print(
                f"✅ Design schema extracted: {schema['template_family']} | "
                f"bg={schema['color_palette']['background']} | "
                f"primary={schema['color_palette']['primary']} | "
                f"visual_mode={schema['visual_mode']} | "
                f"diagram_type={schema['diagram_type']}"
            )
            cr = schema.get("color_roles", {})
            print(
                f"  color_roles: bg={cr.get('background')} line={cr.get('line')} "
                f"muted_line={cr.get('muted_line')}"
            )
            return {"success": True, "schema": schema}

        except json.JSONDecodeError as e:
            print(f"❌ JSON parse error: {e}")
            return {
                "success": False,
                "error": f"JSON parse error: {str(e)}",
                "raw": raw[:500] if "raw" in dir() else "",
            }
        except Exception as e:
            print(f"❌ Extraction error: {e}")
            return {"success": False, "error": str(e)}


# ─── Template Family Classifier ───────────────────────────────────────────────
class TemplateFamilyClassifier:
    """
    Classifies extracted design traits into one of 3 template families.
    Uses a scoring system: more matching signals → higher score → wins.
    """

    def classify(
        self,
        style_traits: List[str],
        color_palette: Dict,
        visual_components: List[str],
    ) -> str:
        scores = {
            "dark_editorial_diagram": 0,
            "warm_photo_editorial": 0,
            "minimal_educational": 0,
        }

        traits_lower = [t.lower() for t in style_traits]
        comps_lower = [c.lower() for c in visual_components]
        bg = color_palette.get("background", "#ffffff")
        primary = color_palette.get("primary", "#000000")

        # ── dark_editorial_diagram ──────────────────────────────
        for t in TEMPLATE_FAMILIES["dark_editorial_diagram"]["style_signals"]:
            if t in traits_lower:
                scores["dark_editorial_diagram"] += 2
        for signal in TEMPLATE_FAMILIES["dark_editorial_diagram"]["visual_signals"]:
            if any(signal in c for c in comps_lower):
                scores["dark_editorial_diagram"] += 3
        if self._is_dark_color(bg):
            scores["dark_editorial_diagram"] += 4  # Strong signal

        # ── warm_photo_editorial ────────────────────────────────
        for t in TEMPLATE_FAMILIES["warm_photo_editorial"]["style_signals"]:
            if t in traits_lower:
                scores["warm_photo_editorial"] += 2
        for signal in TEMPLATE_FAMILIES["warm_photo_editorial"]["visual_signals"]:
            if any(signal in c for c in comps_lower):
                scores["warm_photo_editorial"] += 3
        if self._is_warm_color(primary):
            scores["warm_photo_editorial"] += 3
        if self._is_warm_color(bg) and not self._is_dark_color(bg):
            scores["warm_photo_editorial"] += 2

        # ── minimal_educational ─────────────────────────────────
        for t in TEMPLATE_FAMILIES["minimal_educational"]["style_signals"]:
            if t in traits_lower:
                scores["minimal_educational"] += 2
        for signal in TEMPLATE_FAMILIES["minimal_educational"]["visual_signals"]:
            if any(signal in c for c in comps_lower):
                scores["minimal_educational"] += 3
        if not self._is_dark_color(bg) and not self._is_warm_color(bg):
            scores["minimal_educational"] += 2  # Neutral/light bg

        winner = max(scores, key=scores.get)
        print(f"🏷️ Template family classified: {winner} | scores={scores}")
        return winner

    def _is_dark_color(self, hex_color: str) -> bool:
        """True if luminance < 0.35 (dark color)."""
        try:
            h = hex_color.lstrip("#")
            if len(h) == 3:
                h = "".join(c * 2 for c in h)
            r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
            return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.35
        except Exception:
            return False

    def _is_warm_color(self, hex_color: str) -> bool:
        """True if red channel significantly dominates (warm hue)."""
        try:
            h = hex_color.lstrip("#")
            if len(h) == 3:
                h = "".join(c * 2 for c in h)
            r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
            return r > g + 20 and r > b + 20
        except Exception:
            return False


# ─── Helpers ─────────────────────────────────────────────────────────────────

VALID_VISUAL_MODES = ("diagram", "illustration", "icon", "none")
VALID_DIAGRAM_TYPES = ("flowchart", "arc", "cycle", "comparison", "timeline", "coherence_arc", "none")


def _validate_visual_mode(mode: str) -> str:
    return mode if mode in VALID_VISUAL_MODES else "none"


def _build_color_roles(raw_schema: Dict, cp: Dict) -> Dict:
    """Build semantic color roles from Gemini extraction, falling back to color_palette."""
    cr = raw_schema.get("color_roles", {})
    roles = {
        "background": cr.get("background", cp.get("background", "#0f0f11")),
        "surface": cr.get("surface", cp.get("surface", cp.get("background", "#18181b"))),
        "text_primary": cr.get("text_primary", cp.get("text_primary", "#ffffff")),
        "text_secondary": cr.get("text_secondary", cp.get("text_secondary", "#d1d5db")),
        "accent": cr.get("accent", cp.get("accent", "#f59e0b")),
        "line": cr.get("line", cp.get("primary", "#8b5cf6")),
        "muted_line": cr.get("muted_line", cp.get("text_muted", "#9ca3af")),
    }
    return roles


# ─── Schema Builder ───────────────────────────────────────────────────────────
def build_complete_schema(raw_schema: Dict) -> Dict:
    """
    Normalizes the Gemini-extracted schema into a complete, validated
    Design Schema JSON that the renderer can consume directly.

    Color mapping semantics:
      background → canvas background
      primary    → heading text + accent elements
      secondary  → body text + secondary elements
      accent     → highlights + decorations + CTAs
    """
    family = raw_schema.get("template_family", "minimal_educational")
    if family not in TEMPLATE_FAMILIES:
        family = "minimal_educational"

    cp = raw_schema.get("color_palette", {})
    typo = raw_schema.get("typography", {})
    layout = raw_schema.get("layout_structure", {})
    canvas = raw_schema.get("canvas", {})

    # Merge visual_components: extracted first, then family defaults
    extracted_comps = raw_schema.get("visual_components", [])
    family_defaults = TEMPLATE_FAMILIES[family]["components"]
    merged_comps = list(extracted_comps)
    for c in family_defaults:
        if c not in merged_comps:
            merged_comps.append(c)

    return {
        "template_family": family,
        "canvas": {
            "width": int(canvas.get("width", 1080)),
            "height": int(canvas.get("height", 1080)),
            "aspect_ratio": canvas.get("aspect_ratio", "1:1"),
        },
        # ── Correct semantic color mapping ──────────────────────
        # background → canvas background (set on canvas element)
        # primary    → heading text / primary accent
        # secondary  → body text / secondary UI
        # accent     → highlights, decorations, CTA
        "color_palette": {
            "background": cp.get("background", "#0f0f11"),
            "primary": cp.get("primary", "#8b5cf6"),
            "secondary": cp.get("secondary", "#6366f1"),
            "accent": cp.get("accent", "#f59e0b"),
            "text_primary": cp.get("text_primary", "#ffffff"),
            "text_secondary": cp.get("text_secondary", "#d1d5db"),
            "text_muted": cp.get("text_muted", "#9ca3af"),
            "surface": cp.get("surface", cp.get("background", "#18181b")),
        },
        "typography": {
            "heading_font": typo.get("heading_font", "Inter"),
            "body_font": typo.get("body_font", "Inter"),
            "heading_weight": str(typo.get("heading_weight", "700")),
            "body_weight": str(typo.get("body_weight", "400")),
            "heading_size_scale": typo.get("heading_size_scale", "large"),
            "body_size_scale": typo.get("body_size_scale", "small"),
            "letter_spacing": typo.get("letter_spacing", "normal"),
            "line_height": typo.get("line_height", "normal"),
        },
        "layout_structure": {
            "type": layout.get("type", "center_stack"),
            "alignment": layout.get("alignment", "center"),
            "text_alignment": layout.get("text_alignment", "center"),
            "padding": int(layout.get("padding", 64)),
            "gap": int(layout.get("gap", 24)),
            "visual_position": layout.get("visual_position", "none"),
            "has_slide_number": bool(layout.get("has_slide_number", True)),
            "has_footer": bool(layout.get("has_footer", False)),
            "has_logo_area": bool(layout.get("has_logo_area", False)),
            "grid_columns": int(layout.get("grid_columns", 1)),
        },
        "visual_components": merged_comps,
        "style_traits": raw_schema.get("style_traits", []),
        "content_genre": raw_schema.get("content_genre", "educational"),
        # ── Semantic color roles (for accurate rendering) ─────────
        "color_roles": _build_color_roles(raw_schema, cp),
        # ── Visual mode classification ────────────────────────────
        "visual_mode": _validate_visual_mode(raw_schema.get("visual_mode", "none")),
        "diagram_type": raw_schema.get("diagram_type", "none") if _validate_visual_mode(raw_schema.get("visual_mode", "none")) == "diagram" else "none",
    }
