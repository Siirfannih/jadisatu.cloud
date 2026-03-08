# Smoke Test Checklist

Run after every deployment. All items must pass before considering deploy successful.

## Infrastructure

- [ ] `pm2 status` shows both `jadisatu-nextjs` (online) and `hunter-agent` (online)
- [ ] `curl -s http://localhost:3000` returns HTML (Next.js dashboard)
- [ ] `curl -s http://localhost:8000/api/health` returns `{"status": "ok"}`
- [ ] `nginx -t` shows syntax OK
- [ ] No error entries in `pm2 logs --lines 20`

## Carousel Content Generator (Smart Extractor)

- [ ] Open `https://jadisatu.cloud/carousel-generator-preview.html` - page loads without JS errors
- [ ] Select a template family from the dropdown - preview updates
- [ ] Paste a URL and click "Extract" - loading indicator appears
- [ ] Extraction completes with template schema (or meaningful error message)
- [ ] Generated carousel slides display correctly in preview
- [ ] Export button produces downloadable output

## API Endpoints

- [ ] `GET /api/health` → 200 OK
- [ ] `POST /api/carousel/extract-template` with valid URL → 200 + template_schema
- [ ] `GET /api/carousel/template-families` → 200 + families list
- [ ] `POST /api/carousel/map-to-slides` with valid data → 200 + slides

## Security

- [ ] No hardcoded API keys in frontend source (view-source check)
- [ ] `.env` files are in `.gitignore` and NOT in repo
- [ ] Frontend uses relative URLs for API calls (no `http://IP:port`)
- [ ] HTTPS is enforced (HTTP redirects to HTTPS)

## Quick Automated Check

```bash
# Run this on VPS after deploy:
bash /root/jadisatu.cloud/deploy/check-status.sh
```
