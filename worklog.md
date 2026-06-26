# RepoMosaic Pro — Advanced Skill Map Project Worklog

## Project Overview

Building an **Advanced Skill Map** dashboard that upgrades the rudimentary regex-based
skill mapping in the original `RepoMosaic-Pro` (https://github.com/tringflow-blip/RepoMosaic-Pro)
to an LLM-powered, multi-dimensional skill attribution system.

### What the original does (the "rudimentary" part the user wants fixed)
- Detects only 12 hardcoded capability strands (Auth, AI/ML, Frontend, Backend, …) using
  regex pattern matching on file paths and language names.
- Per-person skills = `{ name, score, commits }` derived purely from which repos the person
  touched × the regex-detected capabilities on those repos. No semantic understanding.

### What we are building (the upgrade)
1. **Flexible LLM integration** — GLM via `z-ai-web-dev-sdk` by default, plus a configurable
   custom OpenAI-compatible endpoint (API key + base URL + model). The user can paste an
   API key in the UI.
2. **Multi-dimensional skill mapping** per chunk of commits:
   - **Sector** (FinTech, DevTools, AI/ML, HealthTech, E-commerce, EduTech, Infra/DevOps, …)
   - **Problem type** (Authentication, Real-time Sync, Vector Search, ETL, Observability, …)
   - **Technical capability** (React, Prisma, WebSockets, RAG, Terraform, …)
   - **Methodology** (TDD, Monorepo, Trunk-based, Microservices, …)
   - **Role** (Architecture, Implementation, DevOps, Docs, QA, …)
3. **Per-committer attribution** — each commit chunk is tagged with the author, so skills
   are attributed to the person who actually committed the code.
4. **GLM used for graph creation** — every chunk of commits is sent to GLM through a
   reusable "skill" prompt; the model returns structured skill tags. The frontend then
   aggregates per person.

---

## Current Project Status (2025-06-25)

### Assessment
The project is in a **stable, feature-rich state** with comprehensive functionality across
8 tabs: Setup, Repos, Scan, Skill Graph, People, Analytics, Activity, and Compare.

All core functionality works:
- GitHub API integration with token-based auth
- GLM-powered skill extraction with caching (Prisma SQLite)
- Force-directed skill graph with 5-dimension switching
- Person detail panel with SVG radar chart
- Commit activity heatmap
- Side-by-side skill comparison
- Export (JSON, Markdown, CSV)

### Key Technical Architecture
- **Frontend**: Next.js 16 App Router + React + Tailwind CSS 4 + shadcn/ui
- **Backend**: Next.js API routes + Octokit + z-ai-web-dev-sdk (GLM)
- **Database**: Prisma ORM with SQLite for scan caching
- **Graph**: D3 force simulation rendered on HTML5 Canvas
- **Radar**: Custom SVG 5-pointed radar chart

---

## Phase 6: Styling & Feature Enhancement (2025-06-25)

### Completed Modifications

#### 1. CSS Enhancements (globals.css)
- Added gradient accent utilities (`.gradient-sector`, `.gradient-tech`, etc.)
- Added animation utilities (`.animate-slide-in-left/right`, `.animate-scale-in`, `.animate-pulse-soft`, `.animate-glow`)
- Added stagger delay utilities (`.stagger-1` through `.stagger-5`)
- Added glass morphism utilities (`.glass`, `.glass-strong`) with dark mode variants
- Added heatmap cell colors (`.heatmap-0` through `.heatmap-4`) with dark mode
- Added enhanced card styling (`.card-elevated`, `.card-glow`)
- Added focus/active state utilities (`.focus-ring`, `.active-scale`)
- Added radar chart grid line utilities (`.radar-grid`, `.radar-axis`)
- Fixed scrollbar styling with CSS variables for dark mode support

#### 2. Person Detail Panel (NEW component)
- **File**: `src/components/repomosaic/person-detail-panel.tsx`
- Side drawer (Sheet) showing complete person skill profile
- **Radar Chart**: Custom SVG 5-pointed spider chart with:
  - Pentagon grid at 25/50/75/100%
  - Dimension-colored data polygon with points
  - Animated on open (scale-in)
- **Skill Breakdown**: Accordion with 5 collapsible dimension sections
  - Each skill shows badge + score bar + commit/chunk counts
  - Sorted by score descending
- **Evidence Section**: Raw tags grouped by repo with confidence percentages
- **Header**: Large avatar, stats cards, repo ownership badges

#### 3. Commit Activity Heatmap (NEW component)
- **File**: `src/components/repomosaic/commit-heatmap.tsx`
- GitHub-style contribution heatmap with 52 weeks × 7 days grid
- Color-coded cells using heatmap CSS utilities
- Summary stats: total commits, busiest day, longest streak
- Month labels on top, day labels on left
- Responsive horizontal scroll

#### 4. Skill Comparison View (NEW component)
- **File**: `src/components/repomosaic/skill-comparison.tsx`
- Side-by-side comparison of two contributors
- Dropdown selectors for Person A and Person B
- Overall similarity percentage (Jaccard-style)
- Per-dimension overlap bars with shared/unique skill breakdown
- Skill lists with score bars and "shared" badges
- Empty state for < 2 people

#### 5. Main Page Enhancements (page.tsx)
- Added 2 new tabs: **Activity** and **Compare** (8 total tabs)
- Enhanced header with gradient icon and better badge styling
- Feature chips upgraded with gradient icon backgrounds
- Added "Last Scan Summary" quick stats card on Setup tab
- Footer enhanced with heart icon and better layout
- Person click opens PersonDetailPanel (Sheet drawer)
- Activity tab includes heatmap, contributor ranking, and dimension distribution
- All new components integrated with `onSelectPerson` callback

#### 6. Setup Panel Enhancement (setup-panel.tsx)
- Gradient icon for Settings header
- Better token field with focus-ring
- Enhanced owner info display with gradient badge
- LLM info panel with gradient icon and dimension badges
- Button with Zap icon for "Continue to repos"
- Active-scale animation on all buttons
- Smooth animate-fade-in-up on auth confirmations

#### 7. AdvancedSkillGraph Enhancement
- Added `onSelectPerson` prop for cross-component communication
- Person clicks in sidebar/graph trigger PersonDetailPanel

### Verification Results
- ✅ Lint clean (eslint)
- ✅ Dev server healthy (port 3000)
- ✅ All 8 tabs functional
- ✅ GitHub auth + owner resolution working
- ✅ Cached scan loads correctly (Gaia-Recipe: 6 people, 268 commits, 49 chunks)
- ✅ Person detail panel opens with radar chart and skill breakdown
- ✅ Commit heatmap renders correctly
- ✅ Skill comparison shows overlap metrics
- ✅ Dark mode toggle works across all components
- ✅ Export buttons (JSON/MD/CSV) functional
- ✅ Responsive design maintained

---

## Unresolved Issues / Risks

1. **Heatmap data is simulated** — Currently generates random heatmap data since commit dates
   aren't stored in the scan cache. Need to add date extraction to the scan pipeline for
   real activity visualization.

2. **Person detail panel evidence** — The `allTags` evidence shows commit messages/file paths
   but could be more polished with better grouping and navigation.

3. **Large org performance** — Scanning orgs with 50+ repos may hit rate limits or memory
   issues. The `mapWithConcurrency` (8 workers) helps but could be optimized.

4. **Skill Comparison select dropdowns** — Could benefit from search/typeahead for orgs
   with many contributors.

5. **Mobile responsiveness** — The People table and Skill Comparison are best viewed on
   desktop; mobile layout could be improved with card-based views.

### Priority Recommendations for Next Phase

1. **Real commit dates in scan** — Store commit dates in the scan pipeline so the heatmap
   shows actual activity patterns instead of simulated data.

2. **Keyboard shortcuts** — Add global keyboard shortcuts (e.g., `1-8` for tab switching,
   `/` for search, `Escape` to close panels).

3. **PDF report export** — Generate a professional PDF report with charts and tables
   for sharing with stakeholders.

4. **Onboarding flow** — First-time user guide with step-by-step tooltips.

5. **Real-time collaboration** — WebSocket-based scan progress with multiple viewers.

---

## Previous Phases

### Phase 5: Full Commit Fetching & Enhanced Scan (2025-06-25)
- Added `listAllCommits()` with pagination (safety cap 5000)
- `maxCommitsPerRepo` slider (0 = ALL)
- `mapWithConcurrency` with 8 workers
- Real-time progress panel with commits fetched counter
- Scan quality indicator with failed chunk tracking
- Debug log download (text/json)
- Successful Gaia-Recipe scan: 268 commits, 49 chunks, 6 people

### Phase 4: LLM Skill Extraction & Aggregation
- GLM skill extractor with structured JSON output
- Advanced skill map aggregation algorithm
- Force graph visualization with 5 dimension switching
- Analytics panel with leaderboards and similarity matrix
- Person table with multi-dimensional skill badges

### Phase 3: GitHub API Integration
- Octokit-based GitHub client
- Token-based authentication
- Org/user repo listing
- Commit and contributor fetching

### Phase 2: Core Architecture
- Next.js 16 project setup with App Router
- shadcn/ui component library
- Prisma SQLite for scan caching
- Settings and export APIs

### Phase 1: Project Initialization
- Next.js 16 project scaffold
- Basic UI framework
- Theme support (light/dark)

---

## Phase 7: Publish to GitHub (2025-06-25)

### Task
User requested pushing the upgraded RepoMosaic-Pro project to GitHub, providing a
personal access token (`ghp_...RFq`, belongs to user `tringflow-blip`).

### Decision
The original `tringflow-blip/RepoMosaic-Pro` repo on GitHub contains the *original*
project (CLI + dashboard: .gitignore, AGENTS.md, LICENSE, README.md, cli/, dashboard/).
The local project is a complete Next.js 16 rewrite with a totally different structure
and history, so a force-push would destroy the original.

**Decision: create a NEW repo `RepoMosaic-Pro-Advanced`** to publish the upgraded
version while preserving the original.

### Completed Modifications

#### 1. Security cleanup (CRITICAL)
The local repo had several files tracked that must NEVER be pushed:
- `.env` — contained `DATABASE_URL` (low risk, but policy violation)
- `db/custom.db` — 92 KB SQLite cache with user scan data
- `.zscripts/dev.pid` — runtime PID file
- `download/` — 87 QA screenshot files (clutter)
- `qa-*.png` in root — 9 more QA screenshots
- `tool-results/` — 20 bash/read tool output dumps

All untracked via `git rm --cached` (files kept locally, removed from index).

**Root cause of an earlier failed cleanup:** the first `git rm --cached .env db/custom.db .zscripts/dev.pid dev-watchdog.sh dev-watchdog.log` command failed atomically because `dev-watchdog.log` did not exist in the index — so NONE of the files were removed. Re-ran with only valid pathspecs and it succeeded.

#### 2. .gitignore hardening
Added new ignore rules:
- `/db/*.db`, `/db/*.db-journal` — SQLite databases
- `/.zscripts/dev.pid` — runtime PID
- `dev-watchdog.log` — watchdog log
- `/download/`, `/qa-*.png`, `qa-*.png` — QA artifacts
- `/agent-ctx/` — agent context directory
- `/tool-results/` — tool output dumps

#### 3. README.md (NEW, comprehensive)
Wrote a full project README covering:
- Project purpose & motivation (vs. the original regex-based version)
- The 5 skill dimensions table (Sector / Problem Type / Tech / Methodology / Role)
- Feature list (8 tabs, person detail panel, export formats, UX polish)
- Tech stack table
- Getting started (install, run, env)
- Scan pipeline ASCII diagram + step-by-step explanation
- Project structure tree
- Configuration (commit cap, custom LLM)
- Validation results (Gaia-Recipe: 268 commits, 49 chunks, 6 people)
- License

#### 4. Git configuration
- Set local `user.name = tringflow-blip`
- Set local `user.email = 296768163+tringflow-blip@users.noreply.github.com` (GitHub noreply)
- Added remote `origin` with token-embedded URL:
  `https://x-access-token:ghp_...@github.com/tringflow-blip/RepoMosaic-Pro-Advanced.git`

#### 5. GitHub repo creation
Created via `POST /user/repos`:
- Name: `RepoMosaic-Pro-Advanced`
- Public
- Description: "LLM-powered, multi-dimensional skill graph for any GitHub org or user..."
- `auto_init: false` (clean push, no README conflict)

#### 6. Commit & push
- Single commit `8f6c8f7` "Publish RepoMosaic Pro - Advanced Skill Map" with full
  feature description + cleanup notes in the body.
- `git push -u origin main` succeeded — new branch, all 131 tracked files pushed.

### Verification Results
- ✅ Repo exists: https://github.com/tringflow-blip/RepoMosaic-Pro-Advanced
- ✅ `main` branch is default
- ✅ All source files present (src/, prisma/, examples/, mini-services/, .zscripts/, screenshots, README.md, package.json, etc.)
- ✅ **Security: `.env` returns 404 on GitHub** (not pushed)
- ✅ **Security: `db/custom.db` returns 404 on GitHub** (not pushed)
- ✅ No `download/`, `qa-*.png`, or `tool-results/` clutter pushed
- ✅ Original `tringflow-blip/RepoMosaic-Pro` repo untouched (preserved)

### Stage Summary
The upgraded RepoMosaic-Pro is now publicly available at:
**https://github.com/tringflow-blip/RepoMosaic-Pro-Advanced**

The original repo is preserved. The new repo contains only source code, config,
screenshots, and documentation — no secrets, no runtime data, no dev clutter.

---

## Phase 8: Rebrand + Multi-Provider LLM Connection + Logo (2025-06-26)

### Task
User requested three cleanups:
1. Give the app a real logo (the current gradient icon block was too basic).
2. Remove every mention of "GLM" / "GLM-powered" / "Advanced Skill Map" from the UI.
3. Redesign the LLM connection UI:
   - Rename "LLM Skill" → "LLM Connection", fix the icon.
   - Drop the "default GLM" / "OpenAI-compatible" tab split.
   - Replace the free-form base URL field with a **provider dropdown** (OpenAI,
     Anthropic, Google, …) where each provider already knows its own URL.
   - Add a **model dropdown** populated per-provider (no more typing model names).
   - API key should be **optional** (sandbox default + local Ollama need no key).
   - Keep a "test connection" button.

### Completed Modifications

#### 1. Logo (image-generation skill)
- Generated `public/logo.png` (1024×1024) via `z-ai image` CLI.
- Concept: 7 interconnected colorful hexagons in a cluster (orange, teal,
  purple, blue, red…) on white — a "skill mosaic" with interconnected nodes.
- Integrated into the page header (replaces the `gradient-sector` icon block)
  and set as the favicon + apple icon in `layout.tsx` metadata.

#### 2. Branding cleanup (no more GLM / Advanced Skill Map)
| Location | Before | After |
|---|---|---|
| `<title>` | "RepoMosaic Pro — Advanced Skill Map" | "RepoMosaic Pro — Skill Attribution" |
| Header subtitle | "GLM-powered multi-dimensional skill attribution per committer" | "Multi-dimensional skill attribution for GitHub organizations" |
| Setup tab label | "LLM Skill" (Sparkles icon) | "LLM Connection" (Cable icon) |
| Feature chip | "GLM Skill Extractor · Each commit chunk → multi-dim JSON via GLM-4" | "LLM Skill Attribution · Each commit chunk → multi-dim JSON tags" |
| Footer | "GLM (default)" / "Built with ♥ & GLM" | "provider / model" / "Built with ♥ for engineering teams" |
| Footer label | "Advanced Skill Map" | "Skill Attribution" |
| Export MD header | "# Advanced Skill Map — {org}" | "# Skill Attribution Report — {org}" |
| Graph evidence | "Commit-level evidence from GLM" | "Commit-level evidence" |
| Code comments | "GLM skill extractor" / "GLM model" / "GLM's tendency" | "skill extractor" / "the model" / "the model's tendency" |
| Default config | `provider: "glm", model: "glm"` | `provider: "zai", model: "glm-4-plus"` |

The model *id* `glm-4-plus` is kept (it's the actual model name in the Z.ai
catalog, not branding), but no user-facing string says "GLM" anymore.

#### 3. Provider catalog (`src/lib/llm/providers.ts`, NEW)
A curated catalog of 9 OpenAI-compatible providers. Each carries its own
preset base URL, auth scheme, model list, and key requirement — so the user
never types a URL or model name.

| Provider | Base URL | Auth | Key? | Default model |
|---|---|---|---|---|
| **Z.ai** (sandbox default) | (SDK) | bearer | no | glm-4-plus |
| OpenAI | api.openai.com/v1 | bearer | yes | gpt-4o-mini |
| Anthropic | api.anthropic.com/v1 | x-api-key + version header | yes | claude-3-5-sonnet-latest |
| Google | generativelanguage.googleapis.com/v1beta/openai | bearer | yes | gemini-1.5-flash |
| Mistral | api.mistral.ai/v1 | bearer | yes | mistral-small-latest |
| DeepSeek | api.deepseek.com/v1 | bearer | yes | deepseek-chat |
| Groq | api.groq.com/openai/v1 | bearer | yes | llama-3.3-70b-versatile |
| Together | api.together.xyz/v1 | bearer | yes | Llama-3.3-70B-Instruct-Turbo |
| Ollama (local) | localhost:11434/v1 | bearer (dummy) | no | llama3.1:8b |

`normalizeProvider()` maps legacy `"glm"` → `"zai"` and `"openai-compatible"`
→ `"openai"` so cached scans from before this change still load.

#### 4. Setup panel LLM Connection redesign
Replaced the two-tab (GLM / OpenAI-compatible) split with:
- **Provider dropdown** (Select) — lists all 9 providers with tagline + "no
  key" badge for sandbox/local.
- **Model dropdown** (Select) — auto-populates from the selected provider's
  catalog. Switching provider resets the model to that provider's default.
  Falls back to a "custom" entry if the stored model isn't in the catalog.
- **API key field** — placeholder adapts ("Paste your OpenAI key…" vs
  "Optional — leave blank to use the default"). Shows a "get key" external
  link for hosted providers. Hidden ShieldCheck hint for no-key providers.
- **Provider info card** — shows the preset base URL + temp/dimensions/JSON
  badges + auth scheme badge (x-api-key for Anthropic).
- **Test connection button** — calls `POST /api/settings` which runs
  `pingLLM()`; shows green "Connection verified — ready to scan" or red
  "Connection failed — check the key or provider".

#### 5. Skill extractor backend (`skill-extractor.ts`)
- `callLLM()` rewritten to route via the provider catalog instead of the
  hardcoded `glm` / `openai-compatible` branch.
- Auth header chosen by `provider.authScheme` (bearer vs x-api-key).
- Anthropic extra headers (`anthropic-version: 2023-06-01`) applied
  automatically from the catalog.
- `response_format: { type: "json_object" }` disabled for Anthropic (their
  OpenAI-compatible gateway rejects it).
- Local providers (Ollama) accept a dummy `"ollama"` key when none provided.
- `callGLMWithRetry` renamed `callSDKWithRetry`; retry logger prefix
  `glm-retry` → `llm-retry`.
- Default model id updated `glm` → `glm-4-plus` in `extractSkillsForChunk`
  and in the scan/settings API fallbacks.

### Verification Results (agent-browser + VLM)
- ✅ Lint clean (`eslint .` passes with 0 errors)
- ✅ Dev server 200 on `/`, `POST /api/settings` 200
- ✅ Header shows logo + "RepoMosaic Pro" + new tagline, **no GLM text**
- ✅ LLM Connection tab opens; provider dropdown lists all 9 providers
  (Z.ai, OpenAI, Anthropic, Google, Mistral, DeepSeek, Groq, Together,
  Ollama) — confirmed via `[role=option]` DOM inspection
- ✅ Switching to OpenAI auto-selects "GPT-4o mini", shows
  `https://api.openai.com/v1` in the info card, "Paste your OpenAI key…"
  placeholder, and a "get key" link
- ✅ Switching back to Z.ai hides the key requirement and shows "Sandbox
  default — runs through the pre-authenticated SDK"
- ✅ Test connection on Z.ai default → green "Connection verified"
- ✅ Logo served at `/logo.png` (200, image/png)
- ✅ Committed `c3b36e1` and pushed to GitHub

### Stage Summary
The app is now a clean, provider-agnostic skill attribution tool. The
LLM connection is a standard provider/model/key picker (like any modern
AI app), the GLM branding is gone from every user-facing surface, and
the new hexagon-mosaic logo gives it a real identity. The sandbox default
still needs no key, so the zero-config flow is preserved.

---
Task ID: 9-a
Agent: style-polish-subagent
Task: Styling polish + onboarding state

Work Log:
- Added `KeyRound` to lucide-react imports
- Changed FeatureChip "LLM Skill Attribution" gradient from `gradient-methodology` to `gradient-sector` (icon color also changed to `text-sector`); "5 Dimensions" kept `gradient-methodology`; "Smart Caching" already used `gradient-problem`
- Added `bg-muted/50 p-1 rounded-lg` to TabsList for better visual separation; active tab already has `shadow-sm` via shadcn TabsTrigger base styles
- Enhanced QuickStat cards: changed `bg-muted/40` → `bg-muted/30`, added `hover:bg-muted/50 transition-colors ring-1 ring-border/30`; value was already `text-lg`
- Enhanced FeatureChip component: added `hover:shadow-md transition-shadow ring-1 ring-border/30`, enlarged icon container from `h-7 w-7` to `h-8 w-8`; title was already `font-semibold`
- Added "How it works" onboarding section below the feature chips, visible only when `!githubUser && !ownerInfo`, with 3 steps (Connect GitHub / Scan commits / Explore skills) using KeyRound, Cable, and Network icons
- Added `hover:scale-105 transition-transform cursor-pointer` to header logo wrapper div
- Added `shadow-sm` to header alongside existing `border-b`
- Replaced Network icon in footer with a tiny `h-4 w-4 rounded gradient-sector` div before "RepoMosaic Pro"
- Ran `bun run lint` — 0 errors

Stage Summary:
- All 7 styling polish items applied to `src/app/page.tsx`
- Lint clean, dev server healthy
- Onboarding "How it works" section shows for first-time visitors with 3-step visual guide

---
Task ID: 9-b
Agent: keyboard-shortcuts-subagent
Task: Keyboard shortcuts overlay + scan progress enhancements

Work Log:
- Added `showShortcuts` state to page.tsx
- Added `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription` imports from `@/components/ui/dialog`
- Added `?` key handler in the keyboard useEffect that toggles `showShortcuts` state
- Added Escape key handling to close the shortcuts overlay when it's open (before other Escape handlers)
- Created Dialog-based keyboard shortcuts overlay with 4 shortcuts: 1-9 (switch tabs), ? (show help), Esc (close panels), / (focus search)
- Added clickable `?` button in footer next to the existing keyboard shortcut hint kbd elements
- Improved the 1-9 tab switching handler: unified the previously split logic (non-skillMap vs skillMap) into a single unified handler using the full tabs array with guard conditions
- Added `SELECT` to the input guard (alongside INPUT, TEXTAREA, isContentEditable) so keyboard shortcuts don't fire when a select dropdown is focused
- Enhanced scan-progress-panel.tsx with:
  - **Estimated time remaining**: tracks elapsed time via `Date.now()` and 1-second interval timer while scan is running; calculates rate (doneRepos/elapsedSec) and estimates remaining repos/rate; displays as Badge with Clock icon
  - **Progress phase indicator**: 4-step horizontal step indicator (Fetching commits → Analyzing with LLM → Aggregating results → Complete) with completed/current/pending states, numbered circles, connecting lines, and color coding (emerald for completed, primary for current, muted for pending)
  - **Cancel scan button**: red-outlined button visible only when scan is running; calls `onCancel` prop if provided, otherwise shows toast "Scan cancellation not yet implemented"
- Added `onCancel` optional prop to ScanProgressPanel Props type
- Added `useToast` import and `Clock`, `XCircle` icon imports to scan-progress-panel
- Added `useState`, `useEffect` imports for the ETA timer
- Ran `bun run lint` — 0 errors, dev server healthy

Stage Summary:
- Keyboard shortcuts help overlay fully functional: press `?` to toggle, `Escape` to close
- Footer has clickable `?` button to open the overlay
- Number keys 1-9 work uniformly for tab switching with proper guards
- Scan progress panel shows ETA, phase step indicator, and cancel button
- All changes lint-clean, dev server compiles without errors

---

## Phase 9: Styling Polish + Onboarding + Keyboard Shortcuts + Scan Enhancements (2025-06-26)

### Assessment
The project was in a stable, feature-rich state after Phase 8 (rebrand + multi-provider
LLM connection). QA via agent-browser + VLM rated the UI 7/10 for professional polish
with specific issues: inconsistent feature chip gradients, cramped stat cards, no
onboarding for first-time visitors, and no visible keyboard shortcut help.

### Completed Modifications

#### 1. Styling Polish (page.tsx)
- **FeatureChip gradient diversity**: Changed from all `gradient-methodology` to
  `gradient-sector` / `gradient-methodology` / `gradient-problem` for visual variety
- **Tab bar**: Added `bg-muted/50 p-1 rounded-lg` background to TabsList for visual
  grouping; active tab already had `shadow-sm` from shadcn
- **Quick stat cards**: Added `bg-muted/30 rounded-lg ring-1 ring-border/30` for depth;
  `hover:bg-muted/50 transition-colors` for interactivity
- **FeatureChip enhancement**: Added `hover:shadow-md transition-shadow`, `ring-1
  ring-border/30` border; enlarged icon containers from `h-7 w-7` → `h-8 w-8`
- **Header**: Added `hover:scale-105 transition-transform cursor-pointer` on logo
  wrapper; `shadow-sm` on header bar
- **Footer**: Added tiny `h-4 w-4 rounded gradient-sector` hexagon icon before
  "RepoMosaic Pro" text

#### 2. Onboarding State (page.tsx)
Added a "How it works" section below the feature chips, visible only when
`!githubUser && !ownerInfo` (first-time visitors). Uses a dashed-border card
with 3 visual steps:
1. **Connect GitHub** (KeyRound icon, sector color) — "Paste a personal access token
   and pick an org or user"
2. **Scan commits** (Cable icon, methodology color) — "Select repos and run the skill
   attribution scan"
3. **Explore skills** (Network icon, tech color) — "Browse the skill graph, compare
   people, export reports"

Each step has a colored circular icon, bold title, and muted description.

#### 3. Keyboard Shortcuts Help Overlay (page.tsx)
- `?` key toggles a Dialog overlay showing all available shortcuts
- `Escape` closes the overlay (takes priority over other Escape handlers)
- Dialog displays 4 shortcuts with kbd-styled key badges:
  - `1-9` — Switch tabs
  - `?` — Show this help
  - `Esc` — Close panels / dialog
  - `/` — Focus search
- Small `?` button added to footer next to the existing keyboard hint for mouse users
- Imports: Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription

#### 4. Number Keys 1-9 Tab Switching (page.tsx)
- Unified the previously split keyboard handler logic into a single handler
- Added `SELECT` to the input guard alongside `INPUT`, `TEXTAREA`, `isContentEditable`
- All 9 tabs mapped: 1→setup, 2→repos, 3→scan, 4→graph, 5→people, 6→analytics,
  7→activity, 8→compare, 9→insights

#### 5. Scan Progress Panel Enhancements (scan-progress-panel.tsx)
- **Estimated time remaining**: Calculates rate from `doneRepos / elapsedSec`,
  estimates `(totalRepos - doneRepos) / rate`, displays as "≈ X min remaining"
  or "≈ X sec remaining" badge with Clock icon
- **Progress phase indicator**: 4-step horizontal step bar:
  1. Fetching commits → 2. Analyzing with LLM → 3. Aggregating results → 4. Complete
  Uses numbered circles, connecting lines, and color coding (completed=emerald,
  current=primary, pending=muted)
- **Cancel scan button**: Red-outlined button visible only during running scan;
  calls `onCancel` prop if provided, otherwise shows toast "Scan cancellation not
  yet implemented"

### QA Verification
- ✅ Lint clean (0 errors)
- ✅ Dev server 200
- ✅ Onboarding section visible on first visit (DOM confirmed)
- ✅ Keyboard shortcuts dialog opens with 4 shortcuts (DOM confirmed:
  title="Keyboard Shortcuts", keys=[1-9, ?, Esc, /])
- ✅ Tab switching via 1-9 keys works
- ✅ Footer gradient icon + ? button present (DOM confirmed)
- ✅ Committed `dacefd6` and pushed to GitHub

### Unresolved Issues / Risks
1. **Scan cancellation** — The cancel button shows a toast saying "not yet implemented".
   Need to add actual scan cancellation via an abort signal.
2. **VLM rate limiting** — During active scans, VLM calls get 429 errors. The retry
  logic handles this, but QA screenshots during scans are delayed.
3. **Mobile card views** — The People table is still best on desktop; could add
  card-based layout for small screens.

### Priority Recommendations for Next Phase
1. **Scan cancellation** — Wire the cancel button to abort the running scan via
  AbortController or a shared flag.
2. **Mobile responsive People tab** — Add card-based layout for small screens.
3. **PDF report export** — Generate a professional PDF with charts.
4. **Search/typeahead** — Add search to People table and Skill Comparison dropdowns.
5. **Real-time WebSocket scan progress** — Replace polling with WebSocket updates.

