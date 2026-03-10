"""
Visual Engine — Smart Extractor v2
Converts reference design images into HTML/CSS templates using Gemini Vision.

KEY DIFFERENCE from v1:
- v1: Image → JSON schema (50+ fields) → Fabric.js interpreter → maybe works
- v2: Image → HTML/CSS directly → Playwright screenshot → always works

Supports:
- Single image → single template
- Multiple images → template folder (1 template per image)
- Icons (Lucide SVG), illustrations (CSS/SVG), decorative elements (CSS)
"""

import os
import base64
import asyncio
from pathlib import Path
from typing import Optional
from datetime import datetime

# ---------------------------------------------------------------------------
# Gemini Vision prompt — the heart of Smart Extractor v2
# ---------------------------------------------------------------------------

EXTRACT_TEMPLATE_PROMPT = """You are an expert frontend developer specializing in converting visual designs into pixel-perfect HTML/CSS.

TASK: Convert this design screenshot into a single, self-contained HTML file.

REQUIREMENTS:
1. Output a complete HTML file with ALL CSS inline in a <style> tag
2. Canvas size: 1080px × 1080px (fixed, no responsive)
3. Use Google Fonts via @import (pick fonts that match the design)
4. Match colors, spacing, typography, and layout as closely as possible

PLACEHOLDER SYSTEM — Use these exact placeholders:
- {{headline}} — main headline text
- {{body}} — body/description text
- {{subheadline}} — optional subtitle
- {{brand_name}} — brand name in header/footer
- {{slide_number}} — slide number (e.g., "01", "02")
- {{cta_text}} — call to action text (if applicable)

ICON SUPPORT — For icons in the design:
- Use Lucide icons via CDN: <script src="https://unpkg.com/lucide@latest"></script>
- Place icons with: <i data-lucide="icon-name"></i>
- Then initialize: <script>lucide.createIcons()</script>
- Use a placeholder comment where the main icon should go:
  <div class="icon-area"><!-- ICON:{{icon_name}} --><i data-lucide="{{icon_name}}" style="width:48px;height:48px"></i></div>
- Choose appropriate Lucide icon names that match what you see (e.g., "rocket", "brain", "target", "heart", "zap", "star")

ILLUSTRATION / IMAGE AREAS — For photos, illustrations, or large visual areas:
- Use a placeholder div with a CSS background:
  <div class="illustration-area" style="background: linear-gradient(135deg, var(--primary), var(--accent)); width: 100%; height: 300px; border-radius: 16px; display: flex; align-items: center; justify-content: center;">
    <i data-lucide="{{icon_name}}" style="width:80px;height:80px;color:white;opacity:0.5"></i>
  </div>
- For photo backgrounds, use a gradient placeholder with a comment: <!-- PHOTO_AREA: description of what image should be here -->
- For decorative illustrations, recreate them with CSS shapes, gradients, or SVG

DECORATIVE ELEMENTS — Recreate with CSS:
- Geometric shapes → CSS shapes with ::before/::after pseudo-elements
- Gradient overlays → CSS gradients
- Dot patterns → CSS radial-gradient patterns
- Lines/dividers → CSS borders or pseudo-elements
- Circles/blobs → border-radius: 50% with gradients

BRAND COLORS — Use CSS variables at :root level:
  :root {
    --bg: [extracted background color];
    --primary: [extracted primary/accent color];
    --secondary: [extracted secondary color];
    --accent: [extracted highlight/accent color];
    --text: [extracted text color];
    --text-muted: [extracted muted text color];
    --surface: [extracted card/surface color];
  }

RULES:
- DO NOT copy actual text content from the image — use placeholders instead
- DO extract and replicate the exact visual STYLE (colors, fonts, layout, spacing)
- The HTML must render correctly at exactly 1080x1080px
- All styling must be in the <style> tag (no external CSS files except Google Fonts)
- Include the Lucide CDN script tag for icons
- Make the design look professional and pixel-perfect
- Keep the HTML clean and well-structured

OUTPUT: Return ONLY the HTML code. No explanations, no markdown code fences.
Start with <!DOCTYPE html> and end with </html>."""


EXTRACT_TEMPLATE_PROMPT_MULTI = """You are an expert frontend developer. I'm sending you {count} design screenshots.

For EACH design, create a SEPARATE complete HTML file that replicates its visual style.

IMPORTANT: Output a JSON array with one entry per design image, in the same order as the images.

```json
[
  {{
    "name": "descriptive-style-name",
    "description": "Brief description of the design style",
    "html": "<!DOCTYPE html>..."
  }},
  {{
    "name": "another-style-name",
    "description": "Brief description",
    "html": "<!DOCTYPE html>..."
  }}
]
```

For EACH HTML template, follow these rules:

1. Complete HTML with ALL CSS inline in <style> tag
2. Canvas: 1080px × 1080px (fixed)
3. Google Fonts via @import
4. Match colors, spacing, typography exactly

PLACEHOLDER SYSTEM:
- {{{{headline}}}} — main headline
- {{{{body}}}} — body text
- {{{{subheadline}}}} — subtitle
- {{{{brand_name}}}} — brand name
- {{{{slide_number}}}} — slide number
- {{{{cta_text}}}} — call to action
- {{{{icon_name}}}} — Lucide icon name

ICONS: Use Lucide CDN
- <script src="https://unpkg.com/lucide@latest"></script>
- <i data-lucide="{{{{icon_name}}}}"></i>
- <script>lucide.createIcons()</script>

ILLUSTRATION AREAS: Use gradient placeholders
- <div class="illustration-area" style="background: linear-gradient(...);">
    <i data-lucide="{{{{icon_name}}}}" style="width:80px;height:80px;color:white;opacity:0.5"></i>
  </div>

BRAND COLORS as CSS variables:
  :root {{
    --bg: [extracted color];
    --primary: [extracted color];
    --secondary: [extracted color];
    --accent: [extracted color];
    --text: [extracted color];
    --text-muted: [extracted color];
    --surface: [extracted color];
  }}

RULES:
- DO NOT copy text from images — use placeholders
- DO replicate exact visual STYLE
- Each HTML must be self-contained and complete
- Include Lucide CDN for icons
- Decorative elements → CSS (shapes, gradients, patterns)

OUTPUT: Return ONLY the JSON array. No markdown fences, no explanations."""


# ---------------------------------------------------------------------------
# Smart Extractor v2 class
# ---------------------------------------------------------------------------

class SmartExtractorV2:
    """
    Converts reference design images into HTML/CSS templates via Gemini Vision.

    Single image → single template HTML
    Multiple images → array of template HTMLs (one per image)
    """

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY", "")
        self.model = "gemini-2.5-flash"

    async def extract_single(self, image_base64: str) -> dict:
        """
        Extract a single template from one reference image.

        Returns:
            {
                "name": "style-name",
                "description": "...",
                "html": "<!DOCTYPE html>...",
                "colors": { extracted CSS variables },
                "created_at": "..."
            }
        """
        import google.generativeai as genai

        genai.configure(api_key=self.api_key)
        model = genai.GenerativeModel(self.model)

        # Decode image
        image_data = base64.b64decode(image_base64)

        response = await model.generate_content_async(
            [
                EXTRACT_TEMPLATE_PROMPT,
                {"mime_type": "image/png", "data": image_data},
            ],
            generation_config={
                "temperature": 0.2,  # Low temp for accurate reproduction
                "max_output_tokens": 8192,
            },
        )

        html = response.text.strip()

        # Clean up if AI wrapped in code fences
        if html.startswith("```html"):
            html = html[7:]
        if html.startswith("```"):
            html = html[3:]
        if html.endswith("```"):
            html = html[:-3]
        html = html.strip()

        # Extract CSS variables from the generated HTML
        colors = self._extract_css_variables(html)

        # Generate a name from the design
        name = self._generate_template_name(html, colors)

        return {
            "name": name,
            "description": f"AI-extracted template from reference design",
            "html": html,
            "colors": colors,
            "created_at": datetime.utcnow().isoformat(),
        }

    async def extract_multiple(self, images_base64: list[str]) -> list[dict]:
        """
        Extract multiple templates from multiple reference images.
        Each image is processed individually for reliability — embedding
        HTML inside JSON strings from LLM output causes frequent parse errors.

        Returns: List of template dicts (same format as extract_single)
        """
        # Process each image individually — much more reliable than asking
        # Gemini to return a JSON array with embedded HTML strings
        tasks = [self.extract_single(img) for img in images_base64]
        templates = await asyncio.gather(*tasks, return_exceptions=True)

        results = []
        for i, t in enumerate(templates):
            if isinstance(t, Exception):
                print(f"  [Image {i+1}] FAILED: {t}")
                results.append({
                    "name": f"error-{i+1}",
                    "description": f"Extraction failed: {str(t)[:100]}",
                    "html": "",
                    "colors": {},
                    "created_at": datetime.utcnow().isoformat(),
                })
            else:
                print(f"  [Image {i+1}] OK: {t.get('name', 'unknown')}")
                results.append(t)

        return results

    async def create_template_folder(
        self,
        images_base64: list[str],
        folder_name: str,
        user_id: Optional[str] = None,
    ) -> dict:
        """
        Full pipeline: extract templates from images → create folder.

        Returns:
            {
                "folder_name": "My Design Styles",
                "template_count": 3,
                "templates": [
                    { "name": "...", "html": "...", "colors": {...} },
                    ...
                ]
            }
        """
        templates = await self.extract_multiple(images_base64)

        return {
            "folder_name": folder_name,
            "template_count": len(templates),
            "templates": templates,
            "user_id": user_id,
            "created_at": datetime.utcnow().isoformat(),
        }

    def _extract_css_variables(self, html: str) -> dict:
        """Extract CSS custom properties (--var) from HTML."""
        import re
        colors = {}
        pattern = r"--(\w[\w-]*)\s*:\s*([^;]+);"
        matches = re.findall(pattern, html)
        for name, value in matches:
            colors[name] = value.strip()
        return colors

    def _generate_template_name(self, html: str, colors: dict) -> str:
        """Generate a descriptive name based on design characteristics."""
        bg = colors.get("bg", "#ffffff").lower()

        # Determine if dark or light
        is_dark = bg in ("#000", "#000000", "#111", "#1a1a1a", "#0a0a0a") or \
                  bg.startswith("#0") or bg.startswith("#1") or bg.startswith("#2")

        theme = "dark" if is_dark else "light"

        # Check for serif fonts
        has_serif = any(
            font in html.lower()
            for font in ["playfair", "georgia", "merriweather", "lora", "cormorant"]
        )

        style = "editorial" if has_serif else "modern"

        return f"{theme}-{style}"
