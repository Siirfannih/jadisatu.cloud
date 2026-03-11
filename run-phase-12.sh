#!/bin/bash
# Phase 12: Dual Personality Polish + Dark Mode Feature Backport
# Ensure Dark Mode also gets features from Light Mode (Narrative Engine, etc.)
# Polish both personalities to feel distinct and intentional.
set -e

cd /workspaces/jadisatu.cloud

echo "========================================="
echo "  Phase 12: Dual Personality Polish + Backport"
echo "  $(date)"
echo "========================================="

# =========================================
# STEP 1: Claude polishes both personalities
# =========================================
echo ""
echo ">>> Step 1: Claude polishing dual personality system..."
echo "========================================="

PROMPT='Read /workspaces/jadisatu.cloud/CLAUDE.md for project context.

## CONTEXT

Phase 10 unified the database. Phase 11 ported missing features to Light Mode with Creator personality.

### CRITICAL FIXES ALREADY APPLIED (DO NOT REVERT):
- Database unified: Both modes now use `contents` table (NOT `creative_content`)
- Dark mode creative-hub-service.js updated to use `contents` table with column mapping
- Auth session bridge created at /light/auth/bridge for cross-mode session sync
- Dark mode "Light Mode" link now goes to /light/auth/bridge
- Light mode sidebar uses handleSwitchToMonkMode for session sync
- Creative Studio in Light mode rebuilt with 3-panel layout (list + editor + production panel) + @dnd-kit drag & drop
- Performance: removed framer-motion & recharts (unused), fixed Cache-Control headers, lazy-loaded JuruCopilot
- SQL migration: sql/unify-creative-tables.sql must be run on Supabase

### REMAINING TASKS:
1. Backport Light-only features to Dark Mode
2. Polish the Dark Mode "Monk Mode" personality
3. Final validation of both modes

## THE TWO PERSONALITIES

### Dark Mode = "Monk Mode" 🧘
Philosophy: Deep focus, calm, minimal distractions.
Visual language:
- Dark backgrounds (#0f0f0f, #1a1a2e, #16213e)
- Muted accent colors (soft blue, soft purple)
- Minimal animations — only functional transitions
- Dense information display (no wasted space)
- Monospace or clean sans-serif typography
- Microcopy: Direct, concise, no fluff
  - "3 tasks remaining" (not "You have 3 amazing tasks waiting!")
  - "Focus." (not "Lets get creative!")
- No emoji in UI text (icons only)
- Sound design: Silent or subtle click sounds (future)

### Light Mode = "Creator Mode" 🎨
Philosophy: Creative energy, inspiration, expression.
Visual language:
- Light backgrounds (white, soft grays, subtle gradients)
- Vibrant accent colors (blue-600, purple-500, warm tones)
- Playful animations (Framer Motion: card hovers, page transitions)
- Spacious layouts with breathing room
- Friendly rounded typography
- Microcopy: Warm, encouraging, creative
  - "Your canvas is clean — what will you create today?"
  - "3 ideas brewing ☕"
- Tasteful emoji in key UI moments
- Visual richness: thumbnails, color-coded cards, mood indicators

## YOUR TASKS

### Task 1: Backport Narrative Engine to Dark Mode
Dark mode has NO Narrative Engine page. Light mode has one (from Phase 4-5).
Create: /frontend/narrative-engine-view.html (or add it as a view in the existing dashboard.html SPA)

The Narrative Engine in Dark Mode should feel like "Monk Mode Research":
- Clean, focused research input (topic field + "Research" button)
- Results displayed as structured text blocks (no cards, no visual noise)
- "Generate Content" button → outputs script in a code-block-like textarea
- "Send to Creative Hub" → creates content in contents table (Supabase)
- Use Gemini API integration from Light mode (call /light/api/narrative/research and /light/api/narrative/generate)
  OR make the API calls directly from Dark mode JS to the same API endpoints
- Minimal UI, maximum information density

Read /workspaces/jadisatu.cloud/nextjs-app/src/app/narrative-engine/page.tsx for feature reference
Read /workspaces/jadisatu.cloud/nextjs-app/src/app/api/narrative/ for API structure

### Task 2: Backport Content Studio improvements to Dark Mode
Ensure Dark modes Creative Hub (now using Supabase from Phase 10) has full functionality:
- Verify stage transition buttons work (from Phase 10 fix)
- Verify content cards show correct data from contents table
- Verify creating new content works end-to-end
- Add "View in Content Studio" navigation if content-studio.html exists
- Test the full pipeline: Idea → Draft → Script → Ready → Published

### Task 3: Cross-Mode Navigation
Add seamless navigation between Dark and Light mode:

In Dark Mode (frontend/):
- Add a toggle/button in the sidebar or header: "Switch to Creator Mode"
- Clicking it navigates to /light (same Supabase session should persist from Phase 10)
- Style: subtle, not prominent — Monk Mode users prefer minimal UI

In Light Mode (nextjs-app/):
- Add a toggle/button in the sidebar or header: "Switch to Monk Mode"
- Clicking it navigates to / (root, where Dark mode lives)
- Style: More visible, with icon — Creator Mode users appreciate discoverable features

Important: Both links should be simple <a> tags pointing to the other mode.
The auth session should persist between modes (verified in Phase 10).

### Task 4: Dashboard Personality Polish

#### Dark Mode Dashboard (frontend/dashboard.html):
Review and enhance the Monk Mode personality:
- Ensure the greeting is concise: "Good morning, [Name]." (no emoji)
- Stats should be data-dense: numbers prominent, labels small
- Task list: compact, scannable, no decorations
- Remove any playful/creative microcopy that crept in from previous phases
- Color check: ensure all accent colors are muted/soft, not vibrant
- Verify the layout is information-dense (minimal padding between elements)

#### Light Mode Dashboard (nextjs-app/src/app/page.tsx):
Review and enhance the Creator Mode personality:
- Ensure the greeting is warm: "Hey [Name]! Ready to create? ✨"
- Stats should be visual: large numbers with trend indicators
- Task list: spacious cards with hover effects
- Add inspirational microcopy in empty states
- Color check: vibrant accents, warm tones, soft shadows
- Verify the layout is spacious and visually rich

### Task 5: Sidebar Personality Polish

#### Dark Mode Sidebar:
- Compact navigation items (icon + label, tight spacing)
- Active state: subtle left border, slightly lighter background
- No section separators — clean vertical list
- Collapse to icon-only on small screens

#### Light Mode Sidebar:
- Spacious navigation items (icon + label + description on hover)
- Active state: blue-600 left border, light blue background
- Section separators with labels: "Workspace", "Creative", "Intelligence", "Settings"
- Smooth hover animations

### Task 6: Loading States & Empty States Personality

#### Dark Mode (Monk Mode):
- Loading: Simple spinner or pulsing dot, no text
- Empty states: Minimal text, e.g., "No tasks." or "Empty."
- Error states: "Error loading data. Retry." with retry button

#### Light Mode (Creator Mode):
- Loading: Skeleton loaders with shimmer animation
- Empty states: Illustrated or emoji-based, e.g., "🎯 No tasks yet — add your first one!"
- Error states: Friendly message, e.g., "Oops! Something went sideways. Lets try again."

Apply these patterns consistently across ALL pages in each mode.

### Task 7: Validation Checklist
Run through EVERY page in BOTH modes and verify:

Dark Mode pages (test by opening each HTML file or navigating in the SPA):
- [ ] Dashboard loads, shows correct stats from Supabase
- [ ] Kanban shows tasks from tasks table
- [ ] Creative Hub shows content from contents table (NOT localStorage)
- [ ] Morning Briefing saves to Supabase (NOT localStorage)
- [ ] Narrative Engine works (new from this phase)
- [ ] All CRUD operations work
- [ ] Date header is dynamic (not stuck)
- [ ] Life balance bar shows percentage (not total count)
- [ ] Agent timestamps display correctly
- [ ] Activity logging works for ALL entities

Light Mode pages (test at /light/*):
- [ ] Dashboard loads with Creator personality
- [ ] Focus Mode works (/light/focus)
- [ ] Notes works (/light/notes)
- [ ] CRM works (/light/crm)
- [ ] Content Studio works (/light/content-studio)
- [ ] Creative Hub is enhanced (/light/creative)
- [ ] Narrative Engine works (/light/narrative-engine)
- [ ] Kanban works (/light/kanban)
- [ ] Projects works (/light/projects)
- [ ] All CRUD operations work
- [ ] Theme toggle (dark/light within Light mode) works
- [ ] No console errors on any page

Cross-mode:
- [ ] "Switch to Creator Mode" button in Dark mode works
- [ ] "Switch to Monk Mode" button in Light mode works
- [ ] Auth session persists between modes (no re-login required)
- [ ] Same data appears in both modes (same tasks, same content, same projects)

### Task 8: Build and Final Commit
1. Run: cd /workspaces/jadisatu.cloud/nextjs-app && npx tsc --noEmit — fix ALL errors
2. Run: cd /workspaces/jadisatu.cloud/nextjs-app && npm run build — fix ALL errors
3. Verify Dark mode JS files have no syntax errors
4. Commit all changes with message: "Phase 12: Dual personality polish + Dark mode backport"

### Rules
- Dark mode modifications go in frontend/ (HTML + JS)
- Light mode modifications go in nextjs-app/ (TypeScript + React)
- SQL migrations go in sql/
- Read existing files before modifying
- Do NOT break existing functionality
- Both modes MUST use the same Supabase `contents` table for creative content (NOT `creative_content`)
- Do NOT remove the auth session bridge at /light/auth/bridge
- Do NOT add framer-motion or recharts back — they were removed for performance
- Do NOT set Cache-Control to no-store on all routes — only API routes should be no-store
- Do NOT replace the 3-panel Creative Studio layout with kanban-only view
- Do NOT change creative-hub-service.js TABLE variable from "contents" back to "creative_content"
- Light mode Creative Studio MUST keep the editor panel (not just kanban cards)
- When adding features, use the SAME design style as the existing mode (dont copy-paste Dark mode design to Light mode)'

claude --dangerously-skip-permissions -p "$PROMPT"

# =========================================
# STEP 2: Verify build
# =========================================
echo ""
echo ">>> Step 2: Verifying Next.js build..."
echo "========================================="
cd /workspaces/jadisatu.cloud/nextjs-app
npm run build || {
    echo "BUILD FAILED — running Claude to fix..."
    cd /workspaces/jadisatu.cloud
    claude --dangerously-skip-permissions -p "Read /workspaces/jadisatu.cloud/CLAUDE.md. The Next.js build failed after Phase 12 changes. Run 'cd /workspaces/jadisatu.cloud/nextjs-app && npm run build' to see errors, fix them all, rebuild to confirm. Commit with 'fix: resolve Phase 12 build errors'."
}

# =========================================
# STEP 3: Push to GitHub
# =========================================
echo ""
echo ">>> PUSHING TO GITHUB"
echo "========================================="
cd /workspaces/jadisatu.cloud
git pull origin main --rebase || true
git push origin main

echo ""
echo "========================================="
echo "  Phase 12 Complete!"
echo "  Both personalities polished. Cross-mode navigation active."
echo "  $(date)"
echo "========================================="
