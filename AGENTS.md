# AGENTS.md

## Cursor Cloud specific instructions

### Services overview

| Service | Directory | Port | Dev command |
|---|---|---|---|
| **Next.js Dashboard** (primary) | `nextjs-app/` | 3000 | `npm run dev` |
| **Hunter Agent API** (Python/FastAPI) | `hunter-agent/backend/` | 8000 | `python3 -m uvicorn api:app --host 0.0.0.0 --port 8000 --reload` |
| **Hunter Agent Frontend** | `hunter-agent/frontend/` | 3002 (override needed) | `npm run dev -- -p 3002` |
| **JadiSatu Light** | `jadisatu-light/` | 3001 | `npm run dev` |

### Key caveats

- **Supabase credentials required:** Both `nextjs-app` and `jadisatu-light` require Supabase credentials. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_KEY` in each app's `.env.local`. **Important:** `NEXT_PUBLIC_SUPABASE_URL` must be the project URL (`https://xxxx.supabase.co`), NOT a key. The anon key starts with `eyJ...` (JWT) or `sb_publishable_...`, and the service key starts with `eyJ...` or `sb_secret_...`. If secrets are injected as env vars and contain wrong values, you must override them inline when starting the dev server (e.g., `NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co npm run dev`), because OS env vars take precedence over `.env.local`.
- **Hunter Agent missing pip dependency:** `hunter-agent/backend/database.py` imports the `supabase` Python SDK but it is not listed in `requirements.txt`. Install it manually: `pip3 install supabase`.
- **No ESLint config in nextjs-app:** The main Next.js app does not have ESLint configured. Use `npx tsc --noEmit` for type checking instead.
- **Port conflict:** `nextjs-app` runs on 3000, `jadisatu-light` on 3001, and `hunter-agent/frontend` should use 3002 when running all simultaneously.
- **Auth middleware:** All routes in the Next.js app except `/login` and `/auth/*` require authentication (see `nextjs-app/src/middleware.ts`). Without valid Supabase credentials, you will be redirected to `/login`.

### Build & type check

- `cd nextjs-app && npm run build` — full production build
- `cd nextjs-app && npx tsc --noEmit` — TypeScript type check (zero errors expected)
- `cd jadisatu-light && npm run build` — full production build for light mode
- `cd jadisatu-light && npx tsc --noEmit` — TypeScript type check (zero errors expected)
- `cd jadisatu-light && npx next lint` — ESLint check for jadisatu-light
- `cd hunter-agent/frontend && npx tsc --noEmit` — TypeScript type check for hunter frontend

### Testing

No automated test suites exist in the codebase. Manual testing is the primary approach — see `docs/smoke-test-checklist.md` for the smoke test checklist.
