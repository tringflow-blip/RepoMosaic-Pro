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
