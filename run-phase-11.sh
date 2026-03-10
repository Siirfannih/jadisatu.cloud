#!/bin/bash
# Phase 11: Feature Parity — Port Missing Pages to Light Mode (Creator Personality)
# Dark Mode has features that Light Mode is missing. Port them with Creator Mode UX.
set -e

cd /workspaces/jadisatu.cloud

echo "========================================="
echo "  Phase 11: Feature Parity + Creator Mode UX"
echo "  $(date)"
echo "========================================="

# =========================================
# STEP 1: Claude ports missing features
# =========================================
echo ""
echo ">>> Step 1: Claude porting missing features to Light Mode..."
echo "========================================="

PROMPT='Read /workspaces/jadisatu.cloud/CLAUDE.md for project context.

## CONTEXT

Phase 10 unified the database — both Dark Mode (frontend/) and Light Mode (nextjs-app/) now share
the same Supabase tables, auth, and data. Phase 10 also fixed bugs and migrated localStorage to Supabase.

Now we need FEATURE PARITY. Dark Mode has several features that Light Mode is missing.
But this is NOT just a copy-paste job. Light Mode has a different personality:

### TWO PERSONALITIES CONCEPT
- **Dark Mode (Monk Mode)**: For focused workers. Calm, minimal, distraction-free. Deep work environment.
- **Light Mode (Creator Mode)**: For creative workers. Expressive, inspirational, playful. Creative workspace.

When porting features from Dark to Light, you must REDESIGN them for the Creator personality:
- More visual, more color, more personality
- Inspirational microcopy (e.g., instead of "No tasks" → "Your canvas is clean — what will you create?")
- Creative-oriented layouts (mood boards, visual pipelines, drag-drop)
- Rounded corners (rounded-3xl), card-based layouts, blue-600/purple accent colors
- Animations with Framer Motion where appropriate
- Creator-friendly terminology (e.g., "Content Studio" not just "Editor")

## YOUR TASKS

### Task 1: Port Focus View → nextjs-app/src/app/focus/page.tsx

Dark Mode has: /frontend/focus-view.html (Pomodoro timer, today priority tasks, focus mode)

Create a Creator Mode version:
- **Timer Section**: Beautiful circular Pomodoro timer (25/5/15 min cycles)
  - Use SVG circle for visual countdown
  - Animated progress ring
  - Play/Pause/Reset buttons with smooth transitions
  - Session counter: "Focus Session #3 today 🔥"
- **Priority Tasks**: Show top 3 tasks from tasks table (status != done, ordered by priority)
  - Each task as a card with checkbox
  - Complete task → satisfying animation + celebratory microcopy
  - Pull from same tasks table as Dark mode
- **Focus Stats**: Mini dashboard showing todays completed vs planned
- **Ambient Mode**: Optional background gradient animation for creative focus
- **Microcopy examples**:
  - Header: "Creator Focus Zone"
  - Empty state: "Nothing on deck — time to brainstorm?"
  - Timer done: "Great session! Take a break, grab a coffee ☕"

Data source: tasks table (same as Dark mode), filter by user_id, status != done

### Task 2: Port Notes View → nextjs-app/src/app/notes/page.tsx

Dark Mode has: /frontend/notes-view.html + /frontend/js/notes-renderer.js (full note-taking with tags, favorites, domain tagging)

Create a Creator Mode version:
- **Left Panel**: Note list with search + filters
  - Search bar at top
  - Filter chips: All, Favorites, by Domain (Work, Creative, Personal, Business)
  - Each note shows: title, preview (first 100 chars), date, tags
  - Favorite toggle (star icon)
- **Center Panel**: Note editor
  - Rich text area for writing
  - Title input (large, bold)
  - Content textarea (expandable)
  - Tags input (comma-separated or chip-based)
- **Right Panel**: Note metadata
  - Domain selector
  - Created/Updated dates
  - Related project link (optional)
  - Word count
- **Creator personality**:
  - Header: "Creators Notebook 📝"
  - Empty state: "Your best ideas start as messy notes. Start writing."
  - Warm card backgrounds, subtle shadows

Data source: ideas table (with source = quick-note or manual), filter by user_id
- CRUD: Use existing /api/ideas route if it exists, or create /api/notes/route.ts that queries ideas table

### Task 3: Port CRM View → Enhance nextjs-app/src/app/crm/page.tsx (or /leads)

Dark Mode has: /frontend/crm-view.html + /frontend/js/crm-renderer.js (full CRM with contacts, lead status, follow-up tracking)

The current Light Mode /leads page is minimal. Create a full Creator Mode CRM:
- **Pipeline View**: Visual kanban-style pipeline
  - Columns: New → Contacted → Negotiating → Won → Lost
  - Drag-and-drop lead cards between stages (or click to move)
- **Lead Cards**: Each card shows:
  - Name/Company
  - Pain points (from Reddit/LinkedIn scraping)
  - Pain score (visual bar)
  - Category tag
  - Last follow-up date
  - Quick action buttons: Call, Email, Note
- **Add Lead Form**: Modal or slide-over panel
  - Name, company, source, pain points, category
  - Auto-set status to "New"
- **Creator personality**:
  - Header: "Your Network 🤝"
  - Empty state: "Your next big collab is one connection away."
  - Warm, approachable design

Data source: leads table, filter by user_id
CRUD: Use existing /api/leads/route.ts

### Task 4: Port Content Studio → nextjs-app/src/app/content-studio/page.tsx

Dark Mode has: /frontend/content-studio.html + /frontend/js/content-studio.js (content editor, script writing)

Create a Creator Mode Content Studio:
- **3-Panel Layout** (like Creative Hub but focused on editing):
  - Left: Content list from contents table (filter by status)
  - Center: Full editor with:
    - Title (large input)
    - Script editor (textarea with line numbers or markdown support)
    - Caption editor (shorter textarea)
    - Platform selector (Instagram, TikTok, YouTube, LinkedIn, Twitter)
  - Right: Content metadata
    - Status badge (color-coded: idea=blue, draft=yellow, script=purple, ready=green, published=teal)
    - Publish date picker
    - Tags
    - Project link
    - Thumbnail upload placeholder (URL input for now)
- **Quick Actions Bar**: at the top
  - "New Content" button
  - "Send to Creative Hub" button
  - "Generate with AI" button (links to Narrative Engine)
- **Creator personality**:
  - Header: "Content Studio ✨"
  - Empty state: "Every viral post started as a blank page. Lets go."
  - Rich visual status indicators

Data source: contents table, filter by user_id
CRUD: Use existing /api/contents/route.ts
Link to Creative Hub: when clicking "View in Creative Hub", navigate to /creative with content ID

### Task 5: Enhance Creative Hub → Update nextjs-app/src/app/creative/page.tsx

The current Light Mode Creative Hub is minimal. Dark mode has a full pipeline.
Enhance it to match Dark modes functionality with Creator personality:

- **Pipeline Stage Indicator** at top:
  - Visual pipeline: Idea → Script → Shoot → Publish
  - Clickable stages to filter content by stage
  - Count badge on each stage
  - Active stage highlighted with animation
- **Content Grid/List**: Show all content from contents table
  - Card view (default): Visual cards with thumbnail, title, status, platform icon
  - List view (toggle): Compact list with sortable columns
  - Filter by: stage, platform, date range
- **Quick Actions**:
  - "New Idea" → creates content with status=idea
  - "Import from Narrative Engine" → links to /narrative-engine
  - "Move to Next Stage" on each card → updates status
- **Content Detail Modal**: Click a card to see full details
  - Script preview
  - Caption preview
  - Assets/thumbnails
  - Edit button → navigates to /content-studio?id=xxx
- **Creator personality**:
  - Header: "Creative Hub 🎨"
  - Stage labels: "💡 Sparks" → "📝 Scripts" → "🎬 Production" → "🚀 Live"
  - Empty state per stage: "No sparks yet — light one up!"

Data source: contents table, filter by user_id

### Task 6: Add Sidebar Navigation for New Pages
Update nextjs-app/src/components/ Sidebar to include ALL pages:

Navigation items (in order):
1. Dashboard (/)
2. Focus Mode (/focus) — NEW
3. Tasks (/tasks or /kanban)
4. Kanban (/kanban)
5. Projects (/projects)
6. Creative Hub (/creative)
7. Content Studio (/content-studio) — NEW
8. Narrative Engine (/narrative-engine)
9. Notes (/notes) — NEW
10. CRM (/crm) — NEW (or enhanced /leads)
11. AI Agents (/agents)
12. History (/history)
13. Settings (/settings)

Each nav item should have:
- Lucide React icon
- Label
- Active state indicator (left border or background highlight)
- Smooth transition on hover

### Task 7: Create /api/notes/route.ts (if needed)
If there is no API route for notes, create one:
- GET: Fetch all ideas where user_id matches, optionally filter by source, domain, tags
- POST: Create new idea with user_id
- PATCH: Update idea by id (verify user_id ownership)
- DELETE: Delete idea by id (verify user_id ownership)

### Task 8: Build and Validate
1. Run: cd /workspaces/jadisatu.cloud/nextjs-app && npx tsc --noEmit — fix all errors
2. Run: cd /workspaces/jadisatu.cloud/nextjs-app && npm run build — fix all errors
3. Verify ALL new pages are accessible:
   - /light/focus
   - /light/notes
   - /light/crm (or /light/leads enhanced)
   - /light/content-studio
   - /light/creative (enhanced)
4. Verify existing pages still work:
   - /light/ (dashboard)
   - /light/kanban
   - /light/projects
   - /light/ideas
   - /light/agents
   - /light/history
   - /light/narrative-engine
   - /light/settings
   - /light/login

### Design Rules (CRITICAL — Creator Mode Personality)
- Color palette: blue-600 primary, purple-500 accent, warm grays, soft shadows
- Cards: rounded-3xl, bg-white dark:bg-gray-800, shadow-sm hover:shadow-md transition
- Typography: Large bold headers, warm microcopy, emoji where natural (not forced)
- Icons: Lucide React only
- Animations: Framer Motion for page transitions, card hovers, modal opens
- Empty states: Always have encouraging, creative microcopy — never just "No data"
- Layout: Card-based, spacious padding (p-6, gap-6), responsive (mobile-first)
- Theme-aware: Use CSS variables and Tailwind dark: classes so all pages work in both themes
- Import Supabase client from @/lib/supabase-browser for client components
- Use "use client" directive for interactive pages
- Follow existing component patterns from the dashboard page

### Commit Convention
Commit with message: "Phase 11: Feature parity — port missing pages with Creator Mode UX"

IMPORTANT:
- Read EVERY referenced Dark mode file before creating the Light mode equivalent
- Read existing Light mode pages (dashboard, kanban, projects) to match patterns
- Do NOT modify frontend/ files — only add/modify files in nextjs-app/
- Every new page must work with the SAME Supabase data that Dark mode uses'

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
    claude --dangerously-skip-permissions -p "Read /workspaces/jadisatu.cloud/CLAUDE.md. The Next.js build failed after Phase 11 changes. Run 'cd /workspaces/jadisatu.cloud/nextjs-app && npm run build' to see the errors, then fix ALL of them. Only modify files in nextjs-app/. After fixing, run the build again to confirm it passes. Commit fixes with message 'fix: resolve Phase 11 build errors'."
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
echo "  Phase 11 Complete!"
echo "  All missing features ported with Creator Mode personality."
echo "  $(date)"
echo "========================================="
