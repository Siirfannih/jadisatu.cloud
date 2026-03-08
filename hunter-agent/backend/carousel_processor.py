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
    "bold_modern": {
        "description": "Bold sans typography, accent color keywords, card-based layouts, modern SaaS aesthetic",
        "components": ["icon-card", "feature-card", "stats-block", "accent-text"],
        "style_signals": ["bold", "modern", "clean", "professional", "tech", "startup"],
        "visual_signals": ["card", "icon", "stats", "badge", "accent"],
        "color_signal": "any",
    },
    "storytelling_editorial": {
        "description": "Long text blocks, serif headings, narrative flow, quote layout",
        "components": ["quote-block", "serif-headline", "long-body-text"],
        "style_signals": ["editorial", "storytelling", "narrative", "warm", "philosophical"],
        "visual_signals": ["quote", "text", "serif", "long-form"],
        "color_signal": "any",
    },
    "technical_diagram": {
        "description": "Heavy diagram usage with labeled nodes, connections, data visualization",
        "components": ["diagram-arc", "node-points", "flowchart", "timeline", "hub-spoke"],
        "style_signals": ["technical", "diagram", "structured", "data", "process"],
        "visual_signals": ["diagram", "node", "flow", "chart", "hub", "spoke", "arrow", "connection"],
        "color_signal": "any",
    },
}

# ─── Gemini Vision Prompt ─────────────────────────────────────────────────────
DESIGN_EXTRACTION_PROMPT = """You are a senior design analyst AI. Analyze the provided screenshot(s) of a design, slide, or carousel card.

Extract a SPECIFIC, ACCURATE Design Schema JSON. Return ONLY valid JSON — no markdown, no code fences, no explanations.

Study the actual colors, fonts, layout, and components visible in the image.

CRITICAL: You are extracting the VISUAL DESIGN STYLE and STRUCTURE — NOT the actual text content.
- DO NOT copy headlines, body text, or content from the images
- DO NOT include the brand name, company name, or author name from the images
- For diagram_data: describe the STRUCTURE (number of nodes, layout pattern, connection style) using generic placeholder labels like "Node 1", "Node 2", "Topic A", "Topic B"
- For branding: set logo_text to "" (empty), footer_left/right to "" (empty) — the user's own brand will be applied later
- For component_blocks: use generic labels like "Feature 1", "Category A" — NOT the actual text from the image
- For text_highlights: describe the STYLE (color, bold/italic) but use generic placeholder phrases like "keyword" or "highlight"

Return this exact structure:

{
  "template_family": "<exactly one of: dark_editorial_diagram | warm_photo_editorial | minimal_educational | bold_modern | storytelling_editorial | technical_diagram>",
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
  "diagram_type": "<only when visual_mode is diagram: hub_spoke | flowchart | arc | cycle | comparison | timeline | coherence_arc | funnel | none>",
  "diagram_data": null,
  "diagram_style": {
    "NOTE": "Only include when visual_mode is diagram. Describes the VISUAL STYLE of diagrams, not content.",
    "node_style": "<filled_dark or filled_accent or outline or glass>",
    "connection_style": "<dashed or solid or none>",
    "has_axis": "<true or false — whether diagram has a visible axis/divider line>",
    "has_center_node": "<true or false — whether diagram has a prominent center node>",
    "node_shape": "<circle or rounded_rect or hexagon>",
    "node_count": "<approximate number of nodes visible>"
  },
  "text_highlights": [
    {"phrase": "<exact word or phrase that has different color or style>", "color": "<hex color>", "style": "<italic or bold or bold_italic or normal>"}
  ],
  "component_blocks": [
    {
      "type": "<icon_card or feature_card or stat_block or quote_block or icon_grid>",
      "items": [
        {"icon": "<lucide icon name>", "label": "Label", "title": "Title", "description": "", "color": "<accent color hex>", "style": "<light or dark or accent or elevated>"}
      ],
      "item_count": "<total number of items/cards visible>",
      "layout": "<horizontal or vertical or grid>",
      "position": "<top or center or bottom>"
    }
  ],
  "decorative_elements": {
    "geometric_lines": <true or false>,
    "background_pattern": "<dots or grid or triangles or none>",
    "divider_style": "<short_colored or full_dashed or none>",
    "divider_color": "<hex>"
  },
  "branding": {
    "logo_position": "<top_left or top_center or none>",
    "logo_text": "",
    "footer_left": "",
    "footer_right": "",
    "pagination": "<true or false>",
    "pagination_style": "<dots or numbers or fraction>"
  },
  "typography": {
    "heading_font": "<font name, e.g. Inter, Playfair Display, Space Mono>",
    "body_font": "<font name>",
    "heading_weight": "<700 or 800 or 900>",
    "body_weight": "<400 or 500>",
    "heading_size_scale": "<large or medium or small>",
    "body_size_scale": "<small or medium>",
    "letter_spacing": "<tight or normal or wide>",
    "line_height": "<tight or normal or relaxed>"
  },
  "layout_structure": {
    "type": "<center_stack or split_horizontal or list_vertical or hero_text or fullbleed or text_top_visual_bottom or visual_center_text_around>",
    "alignment": "<center or left or right>",
    "text_alignment": "<center or left or right>",
    "padding": 64,
    "gap": 24,
    "visual_position": "<top or center or bottom or left or right or none or background>",
    "has_slide_number": true,
    "has_footer": true,
    "has_logo_area": true,
    "grid_columns": 1
  },
  "visual_components": ["<list actual components visible>"],
  "style_traits": ["<list style descriptors>"],
  "content_genre": "<educational or storytelling or promotional or tutorial or motivational or brand>"
}

TEMPLATE FAMILY CLASSIFICATION:
- dark_editorial_diagram: Dark bg (#000-#1a1a2e), geometric shapes, diagram arcs, node graphs, technical annotations, monospace/sans fonts, high contrast
- warm_photo_editorial: Warm palette, photo areas, gradient overlays, serif fonts, hand-drawn decorations
- minimal_educational: Light/neutral bg, clean layout, numbered steps, bullet lists, icon-based structure
- bold_modern: Light OR dark bg, bold sans typography, accent colors on keywords, card-based layouts, modern SaaS/tech aesthetic
- storytelling_editorial: Dark or warm bg, serif headings, long text blocks, quote-style layout, narrative flow
- technical_diagram: Any bg, heavy diagram usage (flowcharts, process maps, data viz), labeled nodes, connecting arrows

CRITICAL RULES:

1. Colors — Extract REAL hex colors. For dark designs use TRUE dark (#050505, #0a0a0f), NOT approximated grays.

2. text_highlights — Scan the heading and body text carefully. If ANY word or phrase uses a DIFFERENT color than surrounding text, or is italic when others are not, list it. Examples: "here." in green, "entire" in green italic, "miss it." in purple italic. If no highlights exist, return empty array [].

3. diagram_style — Only populate when visual_mode=diagram. Describe the VISUAL AESTHETIC of the diagram: node fill style (dark, accent, outline, glass), connection style (dashed, solid), whether there's a center node, and the node shape. Do NOT extract any text labels or content from the diagram. Set diagram_data to null always — content will be populated from slide text at render time.

4. component_blocks — Detect card groups, stat displays, icon grids. Count the items and note their layout pattern. Use generic placeholder labels, NOT the actual text from the image. Capture: icon name (closest Lucide icon), accent color, and style. Lucide icon names use lowercase-kebab-case: mail, bot, calendar, code, file-text, dollar-sign, message-square, monitor, etc.

5. decorative_elements — Note geometric line patterns in background (thin triangles, dots, grids). These are subtle overlay decorations, not main content.

6. branding — Detect the POSITION and STYLE of branding elements (logo placement, footer placement, pagination style). Do NOT copy the actual brand name or text — leave logo_text, footer_left, footer_right as empty strings.

7. visual_mode classification:
   - diagram: design has charts, node graphs, flow diagrams, hub-spoke, arc curves, connected elements
   - illustration: design has large hero visual, scene, photo, or decorative artwork
   - icon: design uses small supporting symbols/icons as accents
   - none: design is purely typography and spacing

8. diagram_type expanded options:
   - hub_spoke: center node connected to surrounding satellite nodes (like a spider/radial diagram)
   - flowchart: sequential boxes/nodes connected by arrows
   - arc / coherence_arc: U-shaped or curved path with stage points
   - cycle: circular path with nodes
   - comparison: side-by-side elements
   - timeline: linear horizontal or vertical sequence
   - funnel: progressively narrowing stages"""


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
            print(f"  visual_mode={schema['visual_mode']} | diagram_type={schema['diagram_type']}")
            dd = schema.get("diagram_data")
            if dd and dd.get("nodes"):
                print(f"  diagram_data: {len(dd['nodes'])} nodes, center={dd.get('center')}")
            th = schema.get("text_highlights", [])
            if th:
                print(f"  text_highlights: {len(th)} highlights — {[h['phrase'] for h in th[:3]]}")
            cb = schema.get("component_blocks", [])
            if cb:
                print(f"  component_blocks: {len(cb)} blocks — types={[b['type'] for b in cb]}")
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


    def _extract_single_image(self, img_b64: str, image_index: int = 0) -> Dict:
        """
        Extract schema from a SINGLE image.
        Used by extract_design_schemas_per_image for per-image analysis.
        """
        try:
            parts = [DESIGN_EXTRACTION_PROMPT]

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
            parts.append({"mime_type": mime, "data": img_bytes})

            response = self.model.generate_content(parts)
            raw = response.text.strip()

            if raw.startswith("```json"):
                raw = raw[7:]
            elif raw.startswith("```"):
                raw = raw[3:]
            if raw.endswith("```"):
                raw = raw[:-3]
            raw = raw.strip()

            gemini_schema = json.loads(raw)

            family = gemini_schema.get("template_family", "")
            if family not in TEMPLATE_FAMILIES:
                classifier = TemplateFamilyClassifier()
                family = classifier.classify(
                    style_traits=gemini_schema.get("style_traits", []),
                    color_palette=gemini_schema.get("color_palette", {}),
                    visual_components=gemini_schema.get("visual_components", []),
                )
                gemini_schema["template_family"] = family

            schema = build_complete_schema(gemini_schema)
            print(f"  [Image {image_index + 1}] ✅ {schema['template_family']} | "
                  f"visual_mode={schema['visual_mode']} | bg={schema['color_palette']['background']}")
            return {"success": True, "schema": schema}

        except json.JSONDecodeError as e:
            print(f"  [Image {image_index + 1}] ❌ JSON parse error: {e}")
            return {"success": False, "error": f"JSON parse error: {str(e)}"}
        except Exception as e:
            print(f"  [Image {image_index + 1}] ❌ Error: {e}")
            return {"success": False, "error": str(e)}

    def extract_design_schemas_per_image(self, images_b64: List[str]) -> Dict:
        """
        Analyze each image SEPARATELY with individual Gemini calls.
        Returns N schemas (styles) + shared brand derived from first image.
        """
        print(f"🔄 Extracting {len(images_b64)} images (per-image mode)...")
        schemas = []

        for i, img_b64 in enumerate(images_b64[:5]):  # Max 5 images
            print(f"  Processing image {i + 1}/{min(len(images_b64), 5)}...")
            result = self._extract_single_image(img_b64, i)
            if result.get("success"):
                schemas.append({
                    "index": i,
                    "name": f"Style {i + 1}",
                    "schema": result["schema"]
                })
            else:
                print(f"  [Image {i + 1}] Skipped: {result.get('error', 'unknown error')}")

        if not schemas:
            return {"success": False, "error": "No images could be analyzed"}

        # Derive shared brand from first image (canonical)
        first = schemas[0]["schema"]
        shared_brand = {
            "color_palette": first.get("color_palette", {}),
            "typography": first.get("typography", {}),
            "canvas": first.get("canvas", {"width": 1080, "height": 1080, "aspect_ratio": "1:1"})
        }

        print(f"✅ Per-image extraction complete: {len(schemas)} styles")
        for s in schemas:
            sc = s["schema"]
            print(f"   Style {s['index'] + 1}: {sc.get('template_family')} | "
                  f"visual_mode={sc.get('visual_mode')} | "
                  f"diagram_type={sc.get('diagram_type', 'n/a')}")

        return {
            "success": True,
            "styles": schemas,
            "shared_brand": shared_brand,
            "style_count": len(schemas)
        }

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
            "bold_modern": 0,
            "storytelling_editorial": 0,
            "technical_diagram": 0,
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

        # ── bold_modern ──────────────────────────────────────
        for t in TEMPLATE_FAMILIES["bold_modern"]["style_signals"]:
            if t in traits_lower:
                scores["bold_modern"] += 2
        for signal in TEMPLATE_FAMILIES["bold_modern"]["visual_signals"]:
            if any(signal in c for c in comps_lower):
                scores["bold_modern"] += 3

        # ── storytelling_editorial ──────────────────────────────
        for t in TEMPLATE_FAMILIES["storytelling_editorial"]["style_signals"]:
            if t in traits_lower:
                scores["storytelling_editorial"] += 2
        for signal in TEMPLATE_FAMILIES["storytelling_editorial"]["visual_signals"]:
            if any(signal in c for c in comps_lower):
                scores["storytelling_editorial"] += 3

        # ── technical_diagram ───────────────────────────────────
        for t in TEMPLATE_FAMILIES["technical_diagram"]["style_signals"]:
            if t in traits_lower:
                scores["technical_diagram"] += 2
        for signal in TEMPLATE_FAMILIES["technical_diagram"]["visual_signals"]:
            if any(signal in c for c in comps_lower):
                scores["technical_diagram"] += 3

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
VALID_DIAGRAM_TYPES = ("hub_spoke", "flowchart", "arc", "cycle", "comparison", "timeline", "coherence_arc", "funnel", "none")


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




def _build_diagram_style(raw_schema: Dict) -> Optional[Dict]:
    """Build diagram visual style (no content). Content comes from slide text at render time."""
    ds = raw_schema.get("diagram_style", {})
    if not ds or not isinstance(ds, dict):
        ds = {}

    return {
        "node_style": ds.get("node_style", "filled_dark"),
        "connection_style": ds.get("connection_style", "dashed"),
        "has_axis": bool(ds.get("has_axis", False)),
        "has_center_node": bool(ds.get("has_center_node", True)),
        "node_shape": ds.get("node_shape", "circle"),
        "node_count": int(ds.get("node_count", 6)) if ds.get("node_count") else 6,
    }


def _build_diagram_data(raw_schema: Dict) -> Optional[Dict]:
    """Legacy: returns None. Diagram content is now generated from slide text."""
    return None


def _build_text_highlights(raw_highlights) -> list:
    """Build validated text highlight list."""
    if not raw_highlights or not isinstance(raw_highlights, list):
        return []
    result = []
    for h in raw_highlights:
        if isinstance(h, dict) and h.get("phrase"):
            result.append({
                "phrase": str(h["phrase"]),
                "color": h.get("color", "#ffffff"),
                "style": h.get("style", "normal") if h.get("style") in ("italic", "bold", "bold_italic", "normal") else "normal",
            })
    return result


def _build_component_blocks(raw_blocks) -> list:
    """Build validated component blocks list."""
    if not raw_blocks or not isinstance(raw_blocks, list):
        return []
    VALID_BLOCK_TYPES = ("icon_card", "feature_card", "stat_block", "quote_block", "icon_grid")
    result = []
    for block in raw_blocks:
        if not isinstance(block, dict):
            continue
        btype = block.get("type", "")
        if btype not in VALID_BLOCK_TYPES:
            continue
        items = []
        for item in block.get("items", []):
            if isinstance(item, dict):
                items.append({
                    "icon": item.get("icon", "circle"),
                    "label": item.get("label", ""),
                    "title": item.get("title", ""),
                    "description": item.get("description", ""),
                    "color": item.get("color", ""),
                    "style": item.get("style", "light"),
                })
        result.append({
            "type": btype,
            "items": items,
            "layout": block.get("layout", "horizontal"),
            "position": block.get("position", "center"),
        })
    return result


def _build_decorative(raw_deco: Dict) -> Dict:
    """Build validated decorative elements."""
    if not isinstance(raw_deco, dict):
        return {"geometric_lines": False, "background_pattern": "none",
                "divider_style": "none", "divider_color": ""}
    return {
        "geometric_lines": bool(raw_deco.get("geometric_lines", False)),
        "background_pattern": raw_deco.get("background_pattern", "none"),
        "divider_style": raw_deco.get("divider_style", "none"),
        "divider_color": raw_deco.get("divider_color", ""),
    }


def _build_branding(raw_brand: Dict) -> Dict:
    """Build validated branding info."""
    if not isinstance(raw_brand, dict):
        return {"logo_position": "none", "logo_text": "", "footer_left": "",
                "footer_right": "", "pagination": False, "pagination_style": "dots"}
    return {
        "logo_position": raw_brand.get("logo_position", "none"),
        "logo_text": raw_brand.get("logo_text", ""),
        "footer_left": raw_brand.get("footer_left", ""),
        "footer_right": raw_brand.get("footer_right", ""),
        "pagination": bool(raw_brand.get("pagination", False)),
        "pagination_style": raw_brand.get("pagination_style", "dots"),
    }

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
        # ── Diagram structured data ───────────────────────────────
        "diagram_data": None,  # Content-driven: populated from slide text at render time
        "diagram_style": _build_diagram_style(raw_schema) if _validate_visual_mode(raw_schema.get("visual_mode", "none")) == "diagram" else None,
        # ── Text highlights (inline accent colors) ────────────────
        "text_highlights": _build_text_highlights(raw_schema.get("text_highlights", [])),
        # ── Component blocks (cards, stats, icon grids) ───────────
        "component_blocks": _build_component_blocks(raw_schema.get("component_blocks", [])),
        # ── Decorative elements ───────────────────────────────────
        "decorative_elements": _build_decorative(raw_schema.get("decorative_elements", {})),
        # ── Branding info ─────────────────────────────────────────
        "branding": _build_branding(raw_schema.get("branding", {})),
    }
