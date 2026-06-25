# RepoMosaic Pro — Advanced Skill Map

> Turn any GitHub organization or user account into a **multi-dimensional, LLM-powered
> skill graph**. RepoMosaic Pro scans every commit on every repo, sends each chunk of
> work to GLM (or any OpenAI-compatible LLM), and attributes the resulting skill tags
> back to the **person who actually wrote the code**.

This is the upgraded, Next.js 16 rewrite of the original `RepoMosaic-Pro`. The original
used 12 hardcoded regex patterns and could only answer "which files did this person
touch?". This version answers **"what is this person actually good at?"** across five
semantic dimensions.

---

## Why this exists

The original RepoMosaic could tell you *that* someone committed to a repo. It couldn't
tell you *what kind of engineer* they are. Are they an architect? A DevOps person? Do
they work on FinTech or HealthTech problems? Do they reach for RAG, vector search, or
plain CRUD?

RepoMosaic Pro fixes that by:

1. **Fetching every commit** (paginated, up to a 5,000-commit safety cap) — not just
   the default 30.
2. **Chunking commits by author** and asking an LLM to tag each chunk across 5
   dimensions.
3. **Aggregating per person** so you get a real skill profile, not a repo-attendance
   sheet.

---

## The 5 skill dimensions

Every chunk of commits is classified into all five:

| Dimension | Question it answers | Examples |
|---|---|---|
| **Sector** | What problem domain? | FinTech, DevTools, AI/ML, HealthTech, E-commerce, EduTech, Infra/DevOps |
| **Problem type** | What class of problem? | Authentication, Real-time Sync, Vector Search, ETL, Observability |
| **Tech** | What tools/frameworks? | React, Prisma, WebSockets, RAG, Terraform, Kafka |
| **Methodology** | How do they work? | TDD, Monorepo, Trunk-based, Microservices, GitOps |
| **Role** | What hat are they wearing? | Architecture, Implementation, DevOps, Docs, QA |

---

## Features

### Core scanning
- **Full commit pagination** — `listAllCommits()` walks every page (100/page) up to a
  configurable safety cap. A UI slider maps 510 → "ALL commits".
- **Concurrent repo scanning** — `mapWithConcurrency` runs 8 repos in parallel.
- **Per-author chunking** — commits are grouped by author before LLM tagging, so
  attribution is exact, not inferred.
- **Persistent scan cache** — Prisma + SQLite stores chunks, tags, and metadata so you
  never pay for the same scan twice.

### Flexible LLM backend
- **GLM by default** via `z-ai-web-dev-sdk` (`glm-4-plus`) — no API key needed in the
  sandbox.
- **Custom OpenAI-compatible endpoint** — paste your own `base URL + API key + model`
  in the Setup tab and the skill extractor swaps to it transparently.
- **Structured JSON output** — the LLM is forced into a strict schema; malformed
  responses are retried and logged.

### Visualization (8 tabs)
1. **Setup** — GitHub token + owner resolution + LLM config.
2. **Repos** — pick which repos to scan.
3. **Scan** — live progress with commits-fetched counter, chunk counter, failed-chunk
   tracker, and debug-log download.
4. **Skill Graph** — D3 force-directed graph on HTML5 Canvas, switchable across all 5
   dimensions.
5. **People** — table with per-person multi-dimensional skill badges; click a row to
   open the detail panel.
6. **Analytics** — leaderboards per dimension + person-to-person similarity matrix.
7. **Activity** — GitHub-style 52-week contribution heatmap + contributor ranking +
   dimension distribution.
8. **Compare** — side-by-side comparison of two contributors with Jaccard similarity
   and shared/unique skill breakdown.

### Person detail panel
A slide-out drawer with:
- **5-point SVG radar chart** — pentagon grid at 25/50/75/100%, dimension-colored
  data polygon, animated on open.
- **Skill breakdown accordion** — 5 collapsible sections, each skill shows badge +
  score bar + commit/chunk counts, sorted by score.
- **Evidence view** — raw LLM tags grouped by repo with confidence percentages.
- **Header** — large avatar, stat cards, repo-ownership badges.

### Export
- **JSON** — full scan dump (people, chunks, tags, metadata).
- **Markdown** — human-readable report per person.
- **CSV** — flat skill table for spreadsheets.

### UX polish
- Light/dark theme via `next-themes`.
- Framer Motion transitions on hover, focus, panel open.
- Glass morphism, gradient accents, staggered entrance animations.
- Fully responsive (mobile-first); People table and Compare degrade to card views.
- Sticky footer, semantic HTML, ARIA labels, keyboard-navigable.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 (strict) |
| Styling | Tailwind CSS 4 + shadcn/ui (New York) |
| State | Zustand (client) + TanStack Query (server) |
| Database | Prisma ORM + SQLite |
| GitHub | Octokit (paginated, token-authed) |
| LLM | `z-ai-web-dev-sdk` (GLM `glm-4-plus`) or custom OpenAI-compatible |
| Graph | D3 force simulation on HTML5 Canvas |
| Charts | Recharts + custom SVG radar |
| Icons | Lucide |

---

## Getting started

### Prerequisites
- Node.js 18+ or [Bun](https://bun.sh)
- A GitHub personal access token (classic or fine-grained) with `repo` read scope

### Install & run

```bash
bun install
bun run db:push      # create the SQLite cache
bun run dev          # http://localhost:3000
```

Open the app, paste your GitHub token, and enter an owner (e.g. `Gaia-Recipe`). The
app resolves it to a user/org, lists repos, and lets you kick off a scan.

### Environment

A `.env` file is optional. The only variable is:

```bash
DATABASE_URL="file:./db/custom.db"
```

The GitHub token and LLM config are entered in the UI and stored in the local SQLite
cache — **never** committed to git.

---

## How a scan works

```
┌──────────┐   ┌──────────────┐   ┌──────────────┐   ┌────────────┐
│ listRepos │──▶│ listAllCommits│──▶│ chunkByAuthor│──▶│  GLM tag   │
│  (Octokit)│   │ (paginated)   │   │  (per author)│   │ (5-dim JSON)│
└──────────┘   └──────────────┘   └──────────────┘   └─────┬──────┘
                                                            │
                              ┌──────────────────────────────┘
                              ▼
                   ┌────────────────────┐   ┌──────────────────┐
                   │ aggregatePerPerson │──▶│   SQLite cache   │
                   │  (5 dimensions)    │   │ (chunks + tags)  │
                   └────────────────────┘   └──────────────────┘
```

1. **listRepos** — Octokit fetches all repos for the owner (handles both users and
   orgs).
2. **listAllCommits** — paginates `GET /repos/{owner}/{repo}/commits` at 100/page up
   to the safety cap (default 5,000). Each commit carries author login, SHA, message,
   and date.
3. **chunkByAuthor** — commits are grouped by author, then split into chunks of ~10
   commits each so the LLM prompt stays within context.
4. **GLM tag** — each chunk is sent with a structured-output prompt asking for tags
   across all 5 dimensions, with confidence scores. Output is validated against a JSON
   schema and retried on failure.
5. **aggregatePerPerson** — tags are summed, weighted by confidence and chunk size,
   and normalized per dimension into 0–100 scores.
6. **Cache** — everything is persisted in SQLite so re-opening the app reloads the
   last scan instantly.

---

## Project structure

```
src/
├── app/
│   ├── api/
│   │   ├── scan/start/        # kickoff scan (concurrency 8)
│   │   ├── scan/status/       # live progress polling
│   │   ├── scan/log/          # debug log download
│   │   ├── github/{repos,commits,contributors,tree,viewer}/
│   │   ├── analyze/           # GLM skill extraction
│   │   ├── export/            # JSON / MD / CSV
│   │   └── settings/          # token + LLM config persistence
│   ├── globals.css            # design system: gradients, glass, heatmap
│   ├── layout.tsx
│   └── page.tsx               # 8-tab dashboard
├── components/
│   ├── graphs/                # D3 force graph (Canvas) + radar
│   ├── repomosaic/            # setup, repos, scan, people, analytics, activity, compare
│   ├── theme-provider.tsx
│   └── ui/                    # shadcn/ui (New York)
├── hooks/
└── lib/
    ├── analysis/
    │   ├── advanced-skill-map.ts   # aggregation algorithm
    │   └── skill-taxonomy.ts       # 5-dimension taxonomy definitions
    ├── github/client.ts            # Octokit wrapper, listAllCommits()
    ├── llm/skill-extractor.ts      # GLM prompt + structured output
    ├── db.ts                       # Prisma client
    └── utils.ts
prisma/
└── schema.prisma              # Scan, Repo, CommitChunk, SkillTag models
```

---

## Configuration

### Commit cap
The Setup → Repos tab exposes a slider (20 → 510). Position 510 maps to `0`, which
means **ALL commits** (up to the 5,000 safety cap). Any other position caps commits
per repo at that number.

### Custom LLM
In the Setup tab, switch the LLM provider from "GLM (default)" to "Custom OpenAI-compatible"
and provide:
- **Base URL** — e.g. `https://api.openai.com/v1` or your vLLM/LM Studio endpoint
- **API key**
- **Model name** — e.g. `gpt-4o`, `llama-3.1-70b`, etc.

The skill extractor uses the same structured-output prompt regardless of backend.

---

## Tested against

The scan pipeline was validated against [`https://github.com/Gaia-Recipe/`](https://github.com/Gaia-Recipe/):

- **268 commits** fetched across all repos (vs. 48 with the old default-30 cap)
- **49 LLM chunks** processed
- **6 contributors** profiled, including `jolinajavier02` (242 commits, 7 sectors,
  10 tech tags — up from 29 commits / 4 sectors / 5 tech with the old pipeline)

---

## License

MIT — see [LICENSE](LICENSE).
