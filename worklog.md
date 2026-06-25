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
   renders a force-graph from the aggregated tags (no LLM in the frontend).
5. **Test target**: https://github.com/Gaia-Recipe/

### Tech stack
- Next.js 16 (App Router) + TypeScript 5 + Tailwind 4 + shadcn/ui
- `octokit` for GitHub API
- `d3-force` for canvas force-graph
- `z-ai-web-dev-sdk` (GLM) for LLM skill extraction (backend only)
- Prisma + SQLite for scan-result caching
- Single route `/` (per project rules)

---
Task ID: 1
Agent: main
Task: Install dependencies (octokit, d3-force) and initialize the worklog.

Work Log:
- Reviewed the cloned RepoMosaic-Pro repository (dashboard + python CLI) to understand
  the existing skill-map and capability-dna implementation.
- Confirmed the original `capability.ts` only has 12 hardcoded regex-based capability
  strands and the original `skill-map.ts` only outputs `{ name, score, commits }` per
  person — this is the "rudimentary" mapping the user wants upgraded.
- Read the LLM skill docs at `/home/z/my-project/skills/LLM/SKILL.md` to confirm GLM is
  invoked via `z-ai-web-dev-sdk` (backend only) with `zai.chat.completions.create(...)`.
- Installed `octokit@5.0.5` and `d3-force@3.0.0`.

Stage Summary:
- Project structure decided. Ready to build the GitHub client, advanced skill taxonomy,
  GLM skill extractor, API routes, and the dashboard frontend.
- The "skill" the user refers to ("each time some chunk is being sent, that skill is
  being used") = a reusable system prompt + structured-JSON output contract for GLM that
  maps a chunk of commits into multi-dimensional skill tags. This is implemented as
  `src/lib/llm/skill-extractor.ts`.

---
Task ID: 2
Agent: main
Task: Upgrade the scanner to fetch ALL commits per repo (paginate every page) instead of capping at 100, per user request: "I want all the commits, even though it takes time. It's fine."

Work Log:
- Added `listAllCommits()` to `src/lib/github/client.ts` — paginates through every
  page of `octokit.rest.repos.listCommits` (per_page=100), with a safety cap of
  5000 commits per repo (configurable via `maxCommits`). Handles 409/422 (empty
  repo) gracefully. Calls an `onProgress` callback after each page so the scan
  panel can show "Fetching all commits for X… N so far".
- Added a bounded-concurrency `mapWithConcurrency()` helper in
  `src/app/api/scan/start/route.ts` so we can enrich EVERY commit with file-level
  diffs (`getCommitDetail`) without hammering GitHub's rate limit — 8 concurrent
  requests at a time, failures fall back to metadata-only commit.
- Replaced the `commitsPerRepo` param with `maxCommitsPerRepo` (0 = ALL) across
  the scan API, the `ScanJob` type (added `totalCommitsScanning` field), and the
  `ScanStatus` frontend type.
- Updated `RepoListPanel` UI: replaced the "Commits per repo: 30" slider with a
  new "Commits per repo" control that has an explicit "All commits (paginate
  every page)" button + a slider (20 → 500+). When the slider hits 510 it flips
  to ALL mode (badge shows "ALL"). Default is ALL (0).
- Updated `ScanProgressPanel` metrics grid: replaced the redundant "Provider"
  metric (already shown in header badges) with a "Commits fetched" metric that
  surfaces `totalCommitsScanning` live during the scan.
- Updated `page.tsx`: state `commitsPerRepo` → `maxCommitsPerRepo` (default 0);
  scan-start toast now says "ALL commits" when 0.
- Verified lint clean (`bun run lint` → no errors).

End-to-end verification on https://github.com/Gaia-Recipe (3 repos):
- Previous run (capped at 30/repo): 48 commits, 12 chunks, 4 people.
- New run (ALL commits):        268 commits, 49 chunks, 6 people.
  · 5.6× more commits scanned.
  · 2 previously-missed committers surfaced (BroccoBae Developer, avdingal).
  · jolinajavier02 went from 29 → 242 commits, 4 → 7 sectors, 5 → 10 tech.
- The scan correctly paginated through broccobae's 250-commit history and
  enriched every one of them with file diffs (bounded concurrency = 8).
- Scan panel showed live "Commits fetched: 268" metric.
- Skill Graph, People, and Analytics tabs all render the richer multi-dimensional
  skill data (sectors, problem types, tech, methodologies, roles) per committer.

Stage Summary:
- The scanner no longer caps commits at 100. It paginates through every page of
  the GitHub commits API (safety cap 5000/repo, configurable) and enriches every
  commit with file-level diffs via bounded-concurrency fetching.
- The UI exposes an explicit "All commits (paginate every page)" mode (default).
- Real scan on Gaia-Recipe: 268 commits → 49 GLM-extracted chunks → 6 people
  with full multi-dimensional skill attribution. Lint clean. Server healthy.
