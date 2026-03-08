# Reliability Protocol - Smart Extractor & Carousel System

## How Smart Extractor Works

```
User uploads screenshot → Frontend JS sends POST to /api/carousel/extract-template
    → Nginx proxies to localhost:8000
    → FastAPI receives request in api.py
    → CarouselDesignExtractor calls Gemini 2.5 Flash Vision API
    → Gemini extracts: color_palette, color_roles, visual_mode, diagram_type, layout, typography
    → build_complete_schema normalizes + validates + adds defaults
    → Returns template_schema JSON with semantic color roles
    → Frontend applies colors (solid bg, no gradient for dark/diagram)
    → Frontend renders visual mode (diagram SVG / illustration / icon / none)
    → Family-specific overlays use color_roles.line for strokes
```

## Critical Endpoints

| Endpoint | Method | Purpose | Expected Response |
|----------|--------|---------|-------------------|
| `/api/health` | GET | Service health check | `{"status": "ok", "service": "hunter-agent"}` |
| `/api/carousel/extract-template` | POST | Extract design from screenshot | `{"success": true, "template_schema": {color_palette, color_roles, visual_mode, ...}}` |
| `/api/carousel/map-to-slides` | POST | Map content to slides | `{"success": true, "slides": [...]}` |
| `/api/carousel/template-families` | GET | List available templates | `{"families": [...]}` |

## Environment Variables Required

**hunter-agent/backend/.env:**
| Variable | Purpose |
|----------|---------|
| `GEMINI_API_KEY` | Google Gemini API for AI extraction |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Supabase service role key |
| `APIFY_TOKEN` | Apify web scraping (optional) |

## Common Failure Modes

| Symptom | Root Cause | Fix |
|---------|-----------|-----|
| "Failed to fetch" | Backend unreachable or mixed content (HTTP/HTTPS) | Check PM2 status, ensure frontend uses relative URL (not direct IP) |
| "Backend unreachable" | hunter-agent process crashed | `pm2 restart hunter-agent && pm2 logs hunter-agent` |
| SyntaxError in database.py | Broken line continuations | Check for `\` followed by spaces instead of newlines |
| 502 Bad Gateway | Nginx can't reach backend | Check PM2 status, verify port 8000 is listening |
| Empty template_schema | Gemini API key missing/invalid | Check `.env` file, verify `GEMINI_API_KEY` |
| Colors look washed out | Canvas gradient override or blur elements | Check visual_mode in console; blur should be hidden for diagram/none |
| Wrong visual (icon instead of diagram) | visual_mode not extracted correctly | Check `pm2 logs hunter-agent` for visual_mode value |
| Missing color_roles | Old template or Gemini didn't extract | Falls back to color_palette values automatically |

## Debug: Checking color_roles and visual_mode

In browser DevTools console, look for:
```
[Smart Extractor] Gemini Vision Pipeline Response
  color_roles: {background: "#050505", line: "#F2F2F2", ...}
  visual_mode: "diagram"
  diagram_type: "coherence_arc"
```

In PM2 logs (`pm2 logs hunter-agent --lines 10`):
```
✅ Design schema extracted: dark_editorial_diagram | visual_mode=diagram | diagram_type=arc
  color_roles: bg=#050505 line=#F2F2F2 muted_line=#8A8A8A
```

## Manual Test Steps

1. **Check backend is running:**
   ```bash
   pm2 status
   curl -s http://localhost:8000/api/health | python3 -m json.tool
   ```

2. **Test extract-template endpoint directly:**
   ```bash
   curl -s -X POST http://localhost:8000/api/carousel/extract-template \
     -H "Content-Type: application/json" \
     -d '{"url": "https://example.com", "platform": "instagram"}' | python3 -m json.tool
   ```

3. **Test via nginx proxy (like browser would):**
   ```bash
   curl -s -X POST https://jadisatu.cloud/api/carousel/extract-template \
     -H "Content-Type: application/json" \
     -d '{"url": "https://example.com", "platform": "instagram"}' | python3 -m json.tool
   ```

4. **Check for mixed content issues:**
   - Open browser DevTools → Console tab
   - Look for "Mixed Content" warnings
   - Frontend should use relative URLs (no `http://IP:port`)

## Troubleshooting Flowchart

```
Error in browser?
    │
    ├── "Backend unreachable" → pm2 status → restart if errored
    │
    ├── "Invalid response" → pm2 logs hunter-agent → check Python errors
    │
    ├── 502 Bad Gateway → nginx -t → pm2 status → check port 8000
    │
    └── No error but no result → Check Gemini API key → Check .env file
```
