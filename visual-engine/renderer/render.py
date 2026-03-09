"""
Visual Engine — Playwright Screenshot Renderer
Takes rendered HTML and produces PNG images.
"""

import os
import asyncio
import hashlib
from pathlib import Path
from typing import Optional

OUTPUT_DIR = Path(__file__).parent.parent / "output"


async def screenshot_html(
    html_content: str,
    output_path: Optional[str] = None,
    width: int = 1080,
    height: int = 1080,
) -> str:
    """
    Take a screenshot of rendered HTML using Playwright.

    Args:
        html_content: Full HTML string to render
        output_path: Where to save the PNG. Auto-generated if None.
        width: Viewport width (default 1080)
        height: Viewport height (default 1080)

    Returns:
        Absolute path to the generated PNG file
    """
    from playwright.async_api import async_playwright

    if not output_path:
        content_hash = hashlib.md5(html_content.encode()).hexdigest()[:10]
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        output_path = str(OUTPUT_DIR / f"slide_{content_hash}.png")

    # Ensure output directory exists
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            args=["--no-sandbox", "--disable-setuid-sandbox"]
        )
        page = await browser.new_page(
            viewport={"width": width, "height": height},
            device_scale_factor=2,  # 2x for retina quality
        )

        await page.set_content(html_content, wait_until="networkidle")

        # Wait for fonts to load
        await page.wait_for_timeout(500)

        await page.screenshot(path=output_path, type="png")
        await browser.close()

    return output_path


async def render_slides(
    html_slides: list[str],
    output_dir: str,
    width: int = 1080,
    height: int = 1080,
) -> list[str]:
    """
    Render multiple slides efficiently using a single browser instance.

    Args:
        html_slides: List of HTML strings, one per slide
        output_dir: Directory to save PNGs
        width: Viewport width
        height: Viewport height

    Returns:
        List of absolute paths to generated PNG files
    """
    from playwright.async_api import async_playwright

    Path(output_dir).mkdir(parents=True, exist_ok=True)
    output_paths = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            args=["--no-sandbox", "--disable-setuid-sandbox"]
        )

        for i, html in enumerate(html_slides):
            page = await browser.new_page(
                viewport={"width": width, "height": height},
                device_scale_factor=2,
            )

            await page.set_content(html, wait_until="networkidle")
            await page.wait_for_timeout(500)

            path = str(Path(output_dir) / f"slide_{i}.png")
            await page.screenshot(path=path, type="png")
            output_paths.append(path)

            await page.close()

        await browser.close()

    return output_paths


def render_slides_sync(
    html_slides: list[str],
    output_dir: str,
    width: int = 1080,
    height: int = 1080,
) -> list[str]:
    """Synchronous wrapper for render_slides."""
    return asyncio.run(render_slides(html_slides, output_dir, width, height))
