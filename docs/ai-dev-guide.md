# AI Development Guide for JadisatuOS

> Panduan ini WAJIB dibaca oleh AI agent sebelum melakukan perubahan apapun.

## Golden Rule

**AI TIDAK BOLEH langsung memodifikasi file di VPS.**

Semua perubahan HARUS melalui:
1. Edit kode di repository
2. Commit dan push ke branch `main`
3. GitHub Actions otomatis deploy ke VPS

## Sebelum Mulai

Baca file-file ini untuk konteks:
1. `docs/system-context.md` — arsitektur, tech stack, file map
2. `docs/current-roadmap.md` — prioritas development
3. `docs/deployment.md` — cara deployment bekerja

## Development Workflow

```
AI Agent
  │
  ├── 1. Baca docs/ untuk konteks
  ├── 2. Edit file yang relevan
  ├── 3. Commit dengan pesan yang jelas
  ├── 4. Push ke main
  │
  ▼
GitHub Actions auto-deploy
  │
  ▼
Live di jadisatu.cloud
```

## Panduan Per Komponen

### Frontend (Static HTML/JS)
- **Lokasi:** `frontend/`
- **Edit:** Langsung edit file HTML/JS
- **Build:** Tidak perlu build step
- **Deploy:** Auto-rsync ke nginx root
- **Test lokal:** Buka HTML files di browser

### Next.js Dashboard
- **Lokasi:** `nextjs-app/src/`
- **Pages:** `nextjs-app/src/app/*/page.tsx`
- **API routes:** `nextjs-app/src/app/api/*/route.ts`
- **Components:** `nextjs-app/src/components/`
- **Supabase client:** `nextjs-app/src/lib/supabase*.ts`
- **Build:** Otomatis saat deploy (`npm run build`)
- **Test lokal:** `cd nextjs-app && npm run dev`

### Hunter Agent (Python)
- **Lokasi:** `hunter-agent/backend/`
- **API server:** `api.py` (FastAPI)
- **Dependencies:** `requirements.txt`
- **Test lokal:** `cd hunter-agent/backend && uvicorn api:app --reload`

### Database Changes
- Tambah file SQL baru ke `sql/`
- Jalankan migration manual via Supabase Dashboard
- JANGAN taruh credentials di SQL files

## Commit Conventions

Format: `<type>: <description>`

| Type | Kapan digunakan |
|------|----------------|
| `feat:` | Fitur baru |
| `fix:` | Bug fix |
| `docs:` | Perubahan dokumentasi |
| `chore:` | Maintenance, config |
| `refactor:` | Restructuring tanpa ubah behavior |
| `style:` | CSS/UI changes |
| `deploy:` | Deployment config changes |

Contoh:
```
feat: add carousel generator page
fix: task completion not saving to Supabase
docs: update roadmap with new priorities
```

## Yang TIDAK BOLEH Dilakukan

- JANGAN SSH ke VPS untuk edit file
- JANGAN taruh secrets/credentials di kode (gunakan .env)
- JANGAN modify `deploy/deploy.sh` kecuali diminta
- JANGAN gunakan `git reset --hard` atau `git push --force`
- JANGAN commit: `node_modules/`, `.next/`, `__pycache__/`, `.env` files
- JANGAN hapus file yang tidak kamu pahami fungsinya

## Setelah Push

1. Cek tab GitHub Actions — workflow harus berjalan
2. Output Actions menunjukkan full deployment log
3. Jika deploy gagal, baca error di Actions output dan fix di kode

## Mengupdate Dokumentasi

Setiap kali ada perubahan arsitektur, update docs yang relevan:
- Service baru? → Update `system-context.md`
- Fitur selesai? → Update `current-roadmap.md`
- Perubahan deploy? → Update `deployment.md`

## Context Recovery

Jika AI session di-reset dan kehilangan konteks:
1. Baca `docs/system-context.md` untuk arsitektur
2. Baca `docs/current-roadmap.md` untuk status terkini
3. Baca `README.md` untuk overview
4. Cek `git log --oneline -10` untuk perubahan terakhir
