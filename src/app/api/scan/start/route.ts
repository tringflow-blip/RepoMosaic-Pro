import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  resolveOwner,
  listOrgRepos,
  listUserRepos,
  listCommits,
  getCommitDetail,
  listContributors,
  parseGithubIdentifier,
  type CommitInfo,
  type RepoInfo,
  type Contributor,
} from "@/lib/github/client";
import {
  extractSkillsForChunk,
  type LLMConfig,
} from "@/lib/llm/skill-extractor";
import { aggregateSkillMap } from "@/lib/analysis/advanced-skill-map";
import type { ChunkSkillExtraction } from "@/lib/analysis/skill-taxonomy";

export const runtime = "nodejs";
export const maxDuration = 600; // 10 min — long scan

/** In-memory job registry (single-process dev server). */
type ScanJob = {
  id: string;
  org: string;
  ownerKind: string;
  branchMode: string;
  model: string;
  provider: string;
  status: "pending" | "running" | "completed" | "failed";
  progress: number;
  phase: string;
  message: string;
  totalRepos: number;
  doneRepos: number;
  totalChunks: number;
  doneChunks: number;
  result: unknown | null;
  error: string | null;
  startedAt: number;
};

// Persist across HMR reloads in dev
const globalForScan = globalThis as unknown as { __scanJobs?: Map<string, ScanJob> };
if (!globalForScan.__scanJobs) globalForScan.__scanJobs = new Map();
const JOBS = globalForScan.__scanJobs;

function chunkCommits(commits: CommitInfo[], size: number): CommitInfo[][] {
  const out: CommitInfo[][] = [];
  for (let i = 0; i < commits.length; i += size) out.push(commits.slice(i, i + size));
  return out;
}

async function runScan(jobId: string, params: {
  token: string;
  owner: string;
  selectedRepos: string[];
  branchMode: "main" | "all";
  llmConfig: LLMConfig;
  commitsPerRepo: number;
  commitsPerChunk: number;
}) {
  const job = JOBS.get(jobId);
  if (!job) return;
  try {
    job.status = "running";
    job.phase = "resolve";
    job.message = "Resolving GitHub owner…";

    const { kind, info } = await resolveOwner(params.token, params.owner);
    job.org = info.login;
    job.ownerKind = kind;

    job.phase = "repos";
    job.message = "Listing repositories…";
    let allRepos: RepoInfo[] = kind === "org" ? await listOrgRepos(params.token, info.login) : await listUserRepos(params.token, info.login);
    // Filter to selected repos
    const selected = allRepos.filter((r) => params.selectedRepos.includes(r.name));
    job.totalRepos = selected.length;

    // Per (login, repo) commit counts — for ownership
    const personRepoCommits = new Map<string, Map<string, number>>();
    const personMeta = new Map<string, { login: string; name: string; avatarUrl: string; url: string }>();

    const extractions: (ChunkSkillExtraction & { commits: number })[] = [];
    let totalCommits = 0;
    let totalChunks = 0;
    let lastModel = job.model;
    let lastProvider = job.provider;

    for (let ri = 0; ri < selected.length; ri++) {
      const repo = selected[ri];
      job.phase = `repo ${ri + 1}/${selected.length}`;
      job.message = `Scanning ${repo.name}…`;
      job.doneRepos = ri;

      // Determine branches to scan
      const branches = params.branchMode === "all" ? await listBranchesSafe(params.token, info.login, repo.name) : [repo.defaultBranch];

      for (const branch of branches) {
        // 1. Fetch contributors for ownership
        let contribs: Contributor[] = [];
        try {
          contribs = await listContributors(params.token, info.login, repo.name);
        } catch {
          contribs = [];
        }
        for (const c of contribs) {
          if (!personMeta.has(c.login)) {
            personMeta.set(c.login, { login: c.login, name: c.name ?? c.login, avatarUrl: c.avatarUrl, url: c.url });
          }
          if (!personRepoCommits.has(c.login)) personRepoCommits.set(c.login, new Map());
          personRepoCommits.get(c.login)!.set(repo.name, (personRepoCommits.get(c.login)!.get(repo.name) ?? 0) + c.contributions);
        }

        // 2. Fetch commits (with file details)
        let commits: CommitInfo[] = [];
        try {
          const raw = await listCommits(params.token, info.login, repo.name, {
            branch,
            per_page: params.commitsPerRepo,
          });
          // Fetch file details for first N
          const cap = Math.min(raw.length, params.commitsPerRepo, 30);
          const detailed = await Promise.all(
            raw.slice(0, cap).map((c) => getCommitDetail(params.token, info.login, repo.name, c.sha).catch(() => c))
          );
          commits = detailed;
        } catch {
          commits = [];
        }
        totalCommits += commits.length;

        // 3. Chunk commits — group by author within the chunk so each chunk
        //    has a single attribution. We sort by author then chunk.
        const byAuthor = new Map<string, CommitInfo[]>();
        for (const c of commits) {
          const key = c.authorLogin ?? c.author;
          if (!byAuthor.has(key)) byAuthor.set(key, []);
          byAuthor.get(key)!.push(c);
        }

        for (const [authorKey, authorCommits] of byAuthor.entries()) {
          const chunks = chunkCommits(authorCommits, params.commitsPerChunk);
          for (let ci = 0; ci < chunks.length; ci++) {
            const chunk = chunks[ci];
            const chunkId = `${repo.name}:${branch}:${authorKey}:${ci}`;
            job.totalChunks += 1;
            const firstCommit = chunk[0];
            try {
              const ext = await extractSkillsForChunk(params.llmConfig, {
                chunkId,
                repo: repo.name,
                author: firstCommit.author,
                authorLogin: firstCommit.authorLogin,
                commits: chunk.map((c) => ({
                  sha: c.sha,
                  message: c.message,
                  date: c.date,
                  additions: c.additions,
                  deletions: c.deletions,
                  files: c.files,
                })),
              });
              extractions.push({ ...ext, commits: chunk.length });
              lastModel = ext.model;
              lastProvider = ext.provider;
            } catch (err) {
              // Skip failed chunks but keep going
              console.error(`Chunk ${chunkId} failed:`, (err as Error).message);
            }
            job.doneChunks += 1;
            job.progress = Math.round(((ri + (ci + 1) / chunks.length) / selected.length) * 100);
          }
        }
      }
      job.doneRepos = ri + 1;
    }

    job.model = lastModel;
    job.provider = lastProvider;
    job.phase = "aggregate";
    job.message = "Aggregating skills…";

    const skillMap = aggregateSkillMap({
      org: info.login,
      model: lastModel,
      provider: lastProvider,
      extractions,
      personRepoCommits,
      personMeta,
      totalRepos: selected.length,
      totalCommits,
    });

    job.result = skillMap;
    job.status = "completed";
    job.progress = 100;
    job.message = `Done — ${selected.length} repos, ${totalCommits} commits, ${extractions.length} chunks, ${skillMap.totalPeople} people`;

    // Persist to DB
    try {
      await db.scanCache.upsert({
        where: {
          org_ownerKind_branchMode_model_provider: {
            org: info.login,
            ownerKind: kind,
            branchMode: params.branchMode,
            model: lastModel,
            provider: lastProvider,
          },
        },
        create: {
          org: info.login,
          ownerKind: kind,
          branchMode: params.branchMode,
          model: lastModel,
          provider: lastProvider,
          totalRepos: selected.length,
          totalCommits,
          totalChunks: extractions.length,
          totalPeople: skillMap.totalPeople,
          skillMapJson: JSON.stringify(skillMap),
          reposJson: JSON.stringify(selected.map((r) => r.name)),
        },
        update: {
          model: lastModel,
          provider: lastProvider,
          totalRepos: selected.length,
          totalCommits,
          totalChunks: extractions.length,
          totalPeople: skillMap.totalPeople,
          skillMapJson: JSON.stringify(skillMap),
          reposJson: JSON.stringify(selected.map((r) => r.name)),
          updatedAt: new Date(),
        },
      });
    } catch (dbErr) {
      console.error("DB cache write failed:", (dbErr as Error).message);
    }
  } catch (err) {
    job.status = "failed";
    job.error = (err as Error).message;
    job.message = `Failed: ${(err as Error).message}`;
  }
}

async function listBranchesSafe(token: string, owner: string, repo: string): Promise<string[]> {
  try {
    const { listRepoBranches } = await import("@/lib/github/client");
    const branches = await listRepoBranches(token, owner, repo);
    return branches.map((b) => b.name);
  } catch {
    return [];
  }
}

/** POST /api/scan/start
 *  body: {
 *    token, owner, selectedRepos, branchMode, llmConfig,
 *    commitsPerRepo, commitsPerChunk
 *  }
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      token?: string;
      owner?: string;
      selectedRepos?: string[];
      branchMode?: "main" | "all";
      llmConfig?: LLMConfig;
      commitsPerRepo?: number;
      commitsPerChunk?: number;
    };
    if (!body.token || !body.owner || !body.llmConfig) {
      return NextResponse.json({ error: "token, owner, llmConfig required" }, { status: 400 });
    }
    const parsed = parseGithubIdentifier(body.owner);
    if (!parsed.owner) {
      return NextResponse.json({ error: "Invalid owner" }, { status: 400 });
    }
    const id = `scan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const job: ScanJob = {
      id,
      org: parsed.owner,
      ownerKind: "org",
      branchMode: body.branchMode ?? "main",
      model: body.llmConfig.model ?? "glm",
      provider: body.llmConfig.provider,
      status: "pending",
      progress: 0,
      phase: "queued",
      message: "Queued",
      totalRepos: 0,
      doneRepos: 0,
      totalChunks: 0,
      doneChunks: 0,
      result: null,
      error: null,
      startedAt: Date.now(),
    };
    JOBS.set(id, job);

    // Fire and forget
    runScan(id, {
      token: body.token,
      owner: parsed.owner,
      selectedRepos: body.selectedRepos ?? [],
      branchMode: body.branchMode ?? "main",
      llmConfig: body.llmConfig,
      commitsPerRepo: body.commitsPerRepo ?? 30,
      commitsPerChunk: body.commitsPerChunk ?? 6,
    }).catch((err) => {
      console.error("Scan crashed:", err);
    });

    return NextResponse.json({ id, status: job.status });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

/** GET /api/scan/start?id=... — alias for status, kept for convenience. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const job = JOBS.get(id);
  if (!job) return NextResponse.json({ error: "job not found" }, { status: 404 });
  return NextResponse.json(job);
}
