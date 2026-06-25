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
