"""
Visual Engine — Template Engine
Renders HTML/CSS templates with Jinja2, then screenshots with Playwright.
"""

import os
import json
import asyncio
from pathlib import Path
from typing import Optional
from jinja2 import Environment, FileSystemLoader, select_autoescape

TEMPLATES_DIR = Path(__file__).parent.parent / "templates"
OUTPUT_DIR = Path(__file__).parent.parent / "output"


def get_jinja_env() -> Environment:
    """Create Jinja2 environment with templates directory."""
    return Environment(
        loader=FileSystemLoader(str(TEMPLATES_DIR)),
        autoescape=select_autoescape(["html"]),
    )


def render_html(template_html: str, context: dict) -> str:
    """
    Render an HTML template string with Jinja2 context variables.

    For AI-generated templates (from Smart Extractor v2), the template_html
    is the raw HTML/CSS that Gemini produced. We do minimal Jinja2 substitution
    for brand colors and slide content.

    For built-in templates, we load from file and render with full context.
    """
    env = get_jinja_env()

    # Add templates_dir to context so base.html can resolve file:// paths
    context["templates_dir"] = str(TEMPLATES_DIR)

    # If template_html is a file path, load it
    if template_html.endswith(".html") and not template_html.startswith("<"):
        template = env.get_template(template_html)
        return template.render(**context)

    # Otherwise treat as raw HTML string (AI-generated)
    template = env.from_string(template_html)
    return template.render(**context)


def render_builtin_template(
    template_family: str,
    slide_type: str,
    slide_data: dict,
    brand: dict,
    icon_svg: str = "",
) -> str:
    """Render a built-in template file with slide data."""
    template_path = f"{template_family}/slide-{slide_type}.html"
    context = {
        "slide": slide_data,
        "brand": brand,
        "icon_svg": icon_svg,
    }
    return render_html(template_path, context)


def prepare_ai_template(
    raw_html: str,
    slide_data: dict,
    brand: dict,
    icon_svg: str = "",
    illustration_url: str = "",
) -> str:
    """
    Prepare an AI-generated HTML template by substituting placeholders.

    AI templates use {{placeholder}} syntax. We replace them with actual content.
    This is the bridge between Gemini's HTML output and our rendering pipeline.
    """
    context = {
        "headline": slide_data.get("headline", ""),
        "body": slide_data.get("body", ""),
        "subheadline": slide_data.get("subheadline", ""),
        "number": slide_data.get("number", ""),
        "brand_name": brand.get("name", ""),
        "slide_number": slide_data.get("slide_number", ""),
        "icon": icon_svg,
        "icon_svg": icon_svg,
        "illustration_url": illustration_url,
        "cta_text": slide_data.get("cta_text", ""),
        # Brand colors available for inline styles
        "bg_color": brand.get("colors", {}).get("background", "#ffffff"),
        "primary_color": brand.get("colors", {}).get("primary", "#2563EB"),
        "secondary_color": brand.get("colors", {}).get("secondary", "#1E40AF"),
        "accent_color": brand.get("colors", {}).get("accent", "#F59E0B"),
        "text_color": brand.get("colors", {}).get("text", "#1F2937"),
    }

    return render_html(raw_html, context)
