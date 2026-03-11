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
import re
import base64
import asyncio
from pathlib import Path
from typing import Optional
from datetime import datetime

# ---------------------------------------------------------------------------
# Gemini Vision prompt — the heart of Smart Extractor v2
# ---------------------------------------------------------------------------

EXTRACT_TEMPLATE_PROMPT = """You are an elite frontend developer who converts design screenshots into pixel-perfect HTML/CSS.

TASK: Convert this design screenshot into a single, self-contained HTML file that replicates the EXACT visual style.

CRITICAL REQUIREMENTS:
1. Output a COMPLETE HTML file — must start with <!DOCTYPE html> and end with </html>
2. Canvas size: exactly 1080px × 1080px (fixed, no responsive, no scrollbar)
3. Use Google Fonts via @import (pick fonts that closely match the design)
4. Match colors, spacing, typography, and layout as closely as possible
5. ALL CSS must be inside a <style> tag in the <head> — no external CSS files
6. The output HTML must be COMPLETE and VALID — never cut it short

PLACEHOLDER SYSTEM — Use these EXACT Jinja2 placeholders for dynamic content:
- {{headline}} — main headline text (the biggest, boldest text)
- {{body}} — body/description text (supporting paragraph)
- {{subheadline}} — optional subtitle or label above the headline
- {{brand_name}} — brand name in header/footer area
- {{slide_number}} — slide number (e.g., "01", "02")
- {{cta_text}} — call to action text (if applicable)
- {{icon_name}} — Lucide icon name for dynamic icons

ICON SUPPORT — For icons in the design:
- Include Lucide CDN in <head>: <script src="https://unpkg.com/lucide@latest"></script>
- Place icons: <i data-lucide="{{icon_name}}" style="width:48px;height:48px"></i>
- Initialize at end of body: <script>lucide.createIcons()</script>
- For SPECIFIC icons visible in the design (not dynamic), use the actual Lucide name directly:
  <i data-lucide="mail" ...></i>  (for email icon)
  <i data-lucide="code" ...></i>  (for code icon)
  <i data-lucide="calendar" ...></i>  (for calendar icon)

VISUAL ELEMENTS — Recreate design elements with CSS:

For 3D / raised card effects:
  .card-3d {
    background: var(--surface);
    border-radius: 16px;
    box-shadow: 0 4px 0 rgba(0,0,0,0.15), 0 8px 20px rgba(0,0,0,0.1);
    transform: perspective(500px) rotateX(2deg);
  }

For hub/circle diagrams:
  .hub-circle {
    width: 80px; height: 80px;
    border-radius: 50%;
    border: 2px solid var(--secondary);
    display: flex; align-items: center; justify-content: center;
  }

For gradient overlays, dot patterns, decorative shapes:
  Use CSS ::before/::after pseudo-elements, gradients, border-radius

For highlighted/italic keywords in headlines:
  <span class="highlight">keyword</span>
  .highlight { color: var(--accent); font-style: italic; }

BRAND COLORS — Extract and define as CSS variables:
  :root {
    --bg: [background color from design];
    --primary: [main accent/brand color];
    --secondary: [secondary color];
    --accent: [highlight color, often used on keywords];
    --text: [main text color];
    --text-muted: [lighter/muted text color];
    --surface: [card/container background color];
  }

LAYOUT STRUCTURE:
  body {
    margin: 0; padding: 0;
    width: 1080px; height: 1080px;
    overflow: hidden;
    background: var(--bg);
    font-family: 'Inter', sans-serif;
  }
  .slide {
    width: 1080px; height: 1080px;
    padding: 60px 72px;
    box-sizing: border-box;
    display: flex; flex-direction: column;
    justify-content: center;
    position: relative;
  }

FOOTER — If the design has a footer with brand handle + "Swipe →":
  .footer {
    position: absolute; bottom: 40px; left: 72px; right: 72px;
    display: flex; justify-content: space-between;
    font-size: 13px; color: var(--text-muted);
  }
  Use {{brand_name}} placeholder for the handle.

RULES:
- DO NOT copy actual text content from the image — use {{placeholders}} instead
- DO extract and replicate the exact visual STYLE (colors, fonts, layout, spacing)
- Recreate ALL decorative elements (circles, cards, shapes, patterns) with CSS
- The design MUST look professional and match the reference closely
- ENSURE the HTML is COMPLETE — always close all tags and end with </html>

OUTPUT: Return ONLY the complete HTML code.
Start with <!DOCTYPE html> and end with </html>.
Do NOT wrap in markdown code fences. Do NOT add explanations."""


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
        self.max_retries = 2

    def _validate_html(self, html: str) -> bool:
        """Check if HTML is complete and valid enough to render."""
        if not html or len(html) < 500:
            return False
        if not html.strip().startswith("<!DOCTYPE html>") and not html.strip().startswith("<html"):
            return False
        if "</html>" not in html:
            return False
        if "</style>" not in html:
            return False
        if "</body>" not in html:
            return False
        return True

    def _clean_html(self, raw: str) -> str:
        """Clean Gemini response: strip code fences and whitespace."""
        html = raw.strip()
        # Remove markdown code fences
        if html.startswith("```html"):
            html = html[7:]
        elif html.startswith("```"):
            html = html[3:]
        if html.endswith("```"):
            html = html[:-3]
        html = html.strip()

        # If HTML doesn't start properly, try to find the start
        doctype_idx = html.find("<!DOCTYPE html>")
        if doctype_idx == -1:
            doctype_idx = html.find("<html")
        if doctype_idx > 0:
            html = html[doctype_idx:]

        return html

    async def extract_single(self, image_base64: str) -> dict:
        """
        Extract a single template from one reference image.
        Includes validation and retry for truncated HTML.

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

        image_data = base64.b64decode(image_base64)

        html = ""
        for attempt in range(1, self.max_retries + 1):
            print(f"  [Extraction attempt {attempt}/{self.max_retries}]")

            response = await model.generate_content_async(
                [
                    EXTRACT_TEMPLATE_PROMPT,
                    {"mime_type": "image/png", "data": image_data},
                ],
                generation_config={
                    "temperature": 0.2,
                    "max_output_tokens": 16384,  # 16K tokens for complete HTML
                },
            )

            html = self._clean_html(response.text)

            if self._validate_html(html):
                print(f"  [Extraction OK] {len(html)} chars, valid HTML")
                break
            else:
                print(f"  [Extraction INCOMPLETE] {len(html)} chars, "
                      f"has </html>: {'</html>' in html}")
                if attempt < self.max_retries:
                    print(f"  [Retrying...]")

        # If still invalid after retries, try to salvage
        if not self._validate_html(html):
            html = self._salvage_html(html)
            print(f"  [Salvaged] {len(html)} chars")

        # Extract CSS variables from the generated HTML
        colors = self._extract_css_variables(html)
        name = self._generate_template_name(html, colors)

        return {
            "name": name,
            "description": "AI-extracted template from reference design",
            "html": html,
            "colors": colors,
            "created_at": datetime.utcnow().isoformat(),
        }

    def _salvage_html(self, html: str) -> str:
        """Try to fix incomplete HTML by closing missing tags."""
        if not html:
            return self._fallback_template()

        # Close unclosed tags
        if "</style>" not in html and "<style" in html:
            html += "\n    </style>"
        if "</head>" not in html and "<head" in html:
            html += "\n</head>"
        if "<body" not in html:
            html += "\n<body>\n<div class='slide'>\n<h1>{{headline}}</h1>\n<p>{{body}}</p>\n</div>"
        if "</body>" not in html:
            html += "\n</body>"
        if "</html>" not in html:
            html += "\n</html>"
        return html

    def _fallback_template(self) -> str:
        """Minimal fallback template when extraction completely fails."""
        return """<!DOCTYPE html>
<html><head>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
:root { --bg: #f5f4f0; --primary: #111; --accent: #66CC99; --text: #333; --text-muted: #999; --surface: #fff; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { width: 1080px; height: 1080px; overflow: hidden; background: var(--bg); font-family: 'Inter', sans-serif; }
.slide { width: 1080px; height: 1080px; padding: 80px; display: flex; flex-direction: column; justify-content: center; }
h1 { font-size: 64px; font-weight: 700; color: var(--primary); line-height: 1.1; margin-bottom: 24px; }
.highlight { color: var(--accent); font-style: italic; }
p { font-size: 22px; color: var(--text-muted); line-height: 1.6; }
.footer { position: absolute; bottom: 40px; left: 80px; right: 80px; display: flex; justify-content: space-between; font-size: 13px; color: var(--text-muted); }
</style>
</head><body>
<div class="slide">
<h1>{{headline}}</h1>
<p>{{body}}</p>
<div class="footer"><span>{{brand_name}}</span><span>{{cta_text}}</span></div>
</div>
</body></html>"""

    async def extract_multiple(self, images_base64: list[str]) -> list[dict]:
        """
        Extract multiple templates from multiple reference images.
        Each image is processed individually for reliability.
        """
        tasks = [self.extract_single(img) for img in images_base64]
        templates = await asyncio.gather(*tasks, return_exceptions=True)

        results = []
        for i, t in enumerate(templates):
            if isinstance(t, Exception):
                print(f"  [Image {i+1}] FAILED: {t}")
                results.append({
                    "name": f"error-{i+1}",
                    "description": f"Extraction failed: {str(t)[:100]}",
                    "html": self._fallback_template(),
                    "colors": {"bg": "#f5f4f0", "primary": "#111", "accent": "#66CC99"},
                    "created_at": datetime.utcnow().isoformat(),
                })
            else:
                print(f"  [Image {i+1}] OK: {t.get('name', 'unknown')} "
                      f"({len(t.get('html', ''))} chars)")
                results.append(t)

        return results

    async def create_template_folder(
        self,
        images_base64: list[str],
        folder_name: str,
        user_id: Optional[str] = None,
    ) -> dict:
        """Full pipeline: extract templates from images → create folder."""
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
        colors = {}
        pattern = r"--(\w[\w-]*)\s*:\s*([^;]+);"
        matches = re.findall(pattern, html)
        for name, value in matches:
            colors[name] = value.strip()
        return colors

    def _generate_template_name(self, html: str, colors: dict) -> str:
        """Generate a descriptive name based on design characteristics."""
        bg = colors.get("bg", "#ffffff").lower().strip()

        # Determine if dark or light based on hex brightness
        is_dark = False
        if bg.startswith("#"):
            hex_clean = bg.lstrip("#")
            if len(hex_clean) >= 6:
                r, g, b = int(hex_clean[0:2], 16), int(hex_clean[2:4], 16), int(hex_clean[4:6], 16)
                brightness = (r * 299 + g * 587 + b * 114) / 1000
                is_dark = brightness < 128
            elif len(hex_clean) == 3:
                r, g, b = int(hex_clean[0]*2, 16), int(hex_clean[1]*2, 16), int(hex_clean[2]*2, 16)
                brightness = (r * 299 + g * 587 + b * 114) / 1000
                is_dark = brightness < 128

        theme = "dark" if is_dark else "light"

        # Check for serif fonts
        has_serif = any(
            font in html.lower()
            for font in ["playfair", "georgia", "merriweather", "lora", "cormorant"]
        )

        # Check for monospace / code fonts
        has_mono = any(
            font in html.lower()
            for font in ["fira code", "jetbrains", "source code", "ibm plex mono"]
        )

        if has_serif:
            style = "editorial"
        elif has_mono:
            style = "technical"
        else:
            style = "modern"

        return f"{theme}-{style}"
