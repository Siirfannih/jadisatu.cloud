#!/bin/bash
# Phase 11: Feature Parity + Creator Mode UX
# OPTIMIZED VERSION — Split into 5 micro-tasks
set -e

cd /workspaces/jadisatu.cloud

echo "========================================="
echo "  Phase 11 (Optimized): Feature Parity + Creator Mode UX"
echo "  $(date)"
echo "========================================="

# ============================================================
# STEP 0: Update context file
# ============================================================
echo ">>> Step 0: Updating context snapshot..."

cat > /tmp/jadisatu-context.md << 'CONTEXT_EOF'
# Jadisatu Quick Context

## Architecture
- Dark Mode: /workspaces/jadisatu.cloud/frontend/ (Static HTML+JS at root /)
- Light Mode: /workspaces/jadisatu.cloud/nextjs-app/ (Next.js 15 at /light)
- Both share same Supabase DB
- Supabase config Light: nextjs-app/src/lib/supabase-browser.ts

## Light Mode Key Files
- nextjs-app/src/app/page.tsx — Dashboard
- nextjs-app/src/app/focus/page.tsx — Focus page (EXISTS, basic)
- nextjs-app/src/app/notes/page.tsx — Notes page (EXISTS, basic)
- nextjs-app/src/app/crm/page.tsx — CRM page (EXISTS, basic)
- nextjs-app/src/app/creative/page.tsx — Creative Hub (EXISTS)
- nextjs-app/src/components/layout/Sidebar.tsx — Sidebar navigation
- nextjs-app/src/components/layout/AppShell.tsx — App wrapper
- nextjs-app/src/lib/supabase-browser.ts — Supabase client

## Tech Stack
- Next.js 15, React 19, TypeScript 5.8, Tailwind CSS 3.4
- Icons: lucide-react
- Animation: framer-motion (if installed)
- Charts: recharts (if installed)

## Personality: Light Mode = "Creator Mode"
- Warm, spacious, expressive, inspiring
- Tasteful emoji in headings (not excessive)
- Encouraging microcopy: "Your canvas awaits!", "What will you create today?"
- Rounded cards (rounded-3xl), soft shadows, warm accent colors
- Generous spacing, hover effects

## Tables: tasks, projects, ideas, contents, agents, activities, domains, schedule_blocks, morning_briefings, leads

## Phase 10 completed: Database unified, localStorage migrated, bugs fixed.
CONTEXT_EOF

echo "Context snapshot saved."

# ============================================================
# MICRO-TASK 1: Upgrade Focus View (Pomodoro Timer)
# ============================================================
echo ""
echo ">>> Micro-task 1/5: Upgrade Focus View"
echo "========================================="

claude --dangerously-skip-permissions -p "Read /tmp/jadisatu-context.md for context.

YOUR TASK: Upgrade the Focus page at nextjs-app/src/app/focus/page.tsx.

1. Read the current focus/page.tsx to understand what exists
2. Rebuild it as a full Creator Mode Focus View with:
   - Pomodoro timer (25 min work / 5 min break, with 'Start', 'Pause', 'Reset' buttons)
   - Timer display: large, centered, clean digits
   - Today's focus tasks: fetch from Supabase 'tasks' table where status='in_progress' and user_id matches
   - Quick add task input at bottom
   - Session counter (how many pomodoros completed today — use localStorage for simplicity)
3. Creator Mode personality:
   - Heading: '🎯 Focus Zone'
   - Empty state: 'Nothing on your plate yet — add a focus task to get started!'
   - Timer complete: 'Great session! Take a breather ☕'
4. Use 'use client' directive, import createClient from '@/lib/supabase-browser'
5. Style: rounded-3xl cards, warm colors, generous padding

Commit: 'feat: upgrade Focus View with Pomodoro timer'"

# ============================================================
# MICRO-TASK 2: Upgrade Notes View (3-panel layout)
# ============================================================
echo ""
echo ">>> Micro-task 2/5: Upgrade Notes View"
echo "========================================="

claude --dangerously-skip-permissions -p "Read /tmp/jadisatu-context.md for context.

YOUR TASK: Upgrade the Notes page at nextjs-app/src/app/notes/page.tsx.

1. Read current notes/page.tsx
2. Also check if /api/notes/route.ts exists. If not, create it.
3. Rebuild as a 3-panel note-taking app:
   - Left panel: Note list (titles, sorted by updated_at DESC)
   - Center panel: Note editor (textarea for content, input for title)
   - Right panel: Note metadata (created date, word count, tags)
4. CRUD operations:
   - Store in Supabase 'ideas' table (or create a 'notes' table if ideas doesn't fit)
   - Fields: id, title, content, tags[], user_id, created_at, updated_at
   - Create, read, update, delete with user_id filtering
5. If /api/notes/route.ts doesn't exist, create it with GET (list all), POST (create), PATCH (update), DELETE
6. Creator Mode personality:
   - Heading: '📝 Notes & Ideas'
   - Empty state: 'Your ideas notebook is empty — start capturing thoughts!'
7. Use 'use client', import createClient from '@/lib/supabase-browser'
8. Style: 3-column grid on desktop, stacked on mobile

Commit: 'feat: upgrade Notes View with 3-panel layout'"

# ============================================================
# MICRO-TASK 3: Upgrade CRM + Content Studio
# ============================================================
echo ""
echo ">>> Micro-task 3/5: Upgrade CRM + Content Studio"
echo "========================================="

claude --dangerously-skip-permissions -p "Read /tmp/jadisatu-context.md for context.

YOUR TASK: Upgrade CRM and Creative Hub pages.

PART A — CRM Page (nextjs-app/src/app/crm/page.tsx):
1. Read current crm/page.tsx
2. Upgrade to a pipeline kanban view:
   - Columns: Lead → Prospect → Client → Completed
   - Each card shows: name, email/phone, last interaction, value
   - Add contact button at top
   - Store in Supabase (use leads table or create a contacts table)
3. Creator Mode: heading '🤝 My Network', encouraging empty state

PART B — Creative Hub (nextjs-app/src/app/creative/page.tsx):
1. Read current creative/page.tsx
2. Upgrade with:
   - Content pipeline view: Idea → Draft → Script → Ready → Published
   - Each card: title, platform badge (IG/TikTok/YT), status, created date
   - Quick create button: opens a form with title, platform, script textarea
   - Drag or button to move between stages
3. Fetch from Supabase 'contents' table with user_id filtering
4. Creator Mode: heading '🎨 Creative Studio', empty: 'Your creative pipeline is ready — drop an idea in!'

Commit: 'feat: upgrade CRM and Creative Studio'"

# ============================================================
# MICRO-TASK 4: Enhance Sidebar + Dashboard
# ============================================================
echo ""
echo ">>> Micro-task 4/5: Enhance Sidebar + Dashboard"
echo "========================================="

claude --dangerously-skip-permissions -p "Read /tmp/jadisatu-context.md for context.

YOUR TASK: Polish the Sidebar and Dashboard for Creator Mode.

PART A — Sidebar (nextjs-app/src/components/layout/Sidebar.tsx):
1. Read current Sidebar.tsx
2. Ensure all nav items have proper icons from lucide-react
3. Add active state highlighting (bg-orange-50 or similar warm color)
4. Ensure 'Dark Mode' link at bottom goes to '/' (the root dark mode site)
5. Add section dividers between groups

PART B — Dashboard (nextjs-app/src/app/page.tsx):
1. Read current page.tsx (dashboard)
2. Ensure it has Creator Mode personality:
   - Greeting: time-based ('Good morning/afternoon/evening, [Name]! ✨')
   - 4 stat cards: Tasks Completed, Active Projects, Pending Tasks, Creative Output
   - Each card should fetch real data from Supabase
   - Add skeleton loading (animate-pulse) while data loads
3. Today's Tasks section: fetch tasks due today
4. Calendar mini widget: show current month with today highlighted

Commit: 'feat: polish Sidebar and Dashboard for Creator Mode'"

# ============================================================
# MICRO-TASK 5: Build verify
# ============================================================
echo ""
echo ">>> Micro-task 5/5: Build verification"
echo "========================================="

claude --dangerously-skip-permissions -p "Read /tmp/jadisatu-context.md for context.

YOUR TASK: Verify the Next.js build passes.

1. Run: cd /workspaces/jadisatu.cloud/nextjs-app && npm run build
2. If there are errors, fix ALL of them
3. Run the build again to confirm it passes
4. Commit fixes with: 'fix: resolve Phase 11 build errors'"

# ============================================================
# Push to GitHub
# ============================================================
echo ""
echo ">>> PUSHING TO GITHUB"
echo "========================================="
cd /workspaces/jadisatu.cloud
git pull origin main --rebase || true
git push origin main

echo ""
echo "========================================="
echo "  Phase 11 (Optimized) Complete!"
echo "  $(date)"
echo "========================================="
