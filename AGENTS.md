# AGENTS.md

## Cursor Cloud specific instructions

### Services overview

| Service | Directory | Port | Dev command |
|---|---|---|---|
| **Next.js Dashboard** (primary) | `nextjs-app/` | 3000 | `npm run dev` |
| **Hunter Agent API** (Python/FastAPI) | `hunter-agent/backend/` | 8000 | `python3 -m uvicorn api:app --host 0.0.0.0 --port 8000 --reload` |
| **Hunter Agent Frontend** | `hunter-agent/frontend/` | 3001 (override needed) | `npm run dev -- -p 3001` |

### Key caveats

- **Supabase credentials required:** The Next.js app and Hunter Agent both require Supabase credentials to function beyond the login page. Without them, the Next.js app will serve the login page but auth flows will fail. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_KEY` in `nextjs-app/.env.local`.
- **Hunter Agent missing pip dependency:** `hunter-agent/backend/database.py` imports the `supabase` Python SDK but it is not listed in `requirements.txt`. Install it manually: `pip3 install supabase`.
- **No ESLint config in nextjs-app:** The main Next.js app does not have ESLint configured. Use `npx tsc --noEmit` for type checking instead.
- **Port conflict:** Both `nextjs-app` and `hunter-agent/frontend` default to port 3000. Run the hunter frontend on a different port (e.g., 3001) if running both simultaneously.
- **Auth middleware:** All routes in the Next.js app except `/login` and `/auth/*` require authentication (see `nextjs-app/src/middleware.ts`). Without valid Supabase credentials, you will be redirected to `/login`.

### Build & type check

- `cd nextjs-app && npm run build` — full production build
- `cd nextjs-app && npx tsc --noEmit` — TypeScript type check (zero errors expected)
- `cd hunter-agent/frontend && npx tsc --noEmit` — TypeScript type check for hunter frontend

### Testing

No automated test suites exist in the codebase. Manual testing is the primary approach — see `docs/smoke-test-checklist.md` for the smoke test checklist.
