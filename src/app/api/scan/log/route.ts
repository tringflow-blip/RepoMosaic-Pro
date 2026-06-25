import { NextResponse } from "next/server";

export const runtime = "nodejs";

const globalForScan = globalThis as unknown as { __scanJobs?: Map<string, unknown> };

type ChunkEvent = {
  chunkId: string;
  repo: string;
  author: string;
  status: "ok" | "failed";
  model: string;
  provider: string;
  error?: string;
  tags: number;
  timestamp: number;
};

type ScanJob = {
  id: string;
  org: string;
  ownerKind: string;
  branchMode: string;
  model: string;
  provider: string;
  status: string;
  progress: number;
  phase: string;
  message: string;
  totalRepos: number;
  doneRepos: number;
  totalCommitsScanning: number;
  totalChunks: number;
  doneChunks: number;
  failedChunks: number;
  chunkEvents?: ChunkEvent[]; // optional for backward compat with old jobs
  retryLog?: { chunkId: string; attempt: number; error: string; timestamp: number }[];
  result: unknown | null;
  error: string | null;
  startedAt?: number;
  finishedAt?: number | null;
};

/** GET /api/scan/log?id=...&format=text|json
 *  Exports the scan log — chunk-by-chunk outcome + retry warnings.
 *  Default format is a human-readable text log; format=json returns the
 *  raw event arrays. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const format = url.searchParams.get("format") ?? "text";
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const job = globalForScan.__scanJobs?.get(id) as ScanJob | undefined;
  if (!job) return NextResponse.json({ error: "job not found" }, { status: 404 });

  // Defensive defaults — old jobs (created before chunkEvents/retryLog existed)
  // won't have these fields.
  const chunkEvents = job.chunkEvents ?? [];
  const retryLog = job.retryLog ?? [];
  const startedAt = job.startedAt ?? 0;
  const finishedAt = job.finishedAt ?? null;

  if (format === "json") {
    return NextResponse.json({
      id: job.id,
      org: job.org,
      status: job.status,
      model: job.model,
      provider: job.provider,
      startedAt,
      finishedAt,
      durationMs: (finishedAt ?? Date.now()) - startedAt,
      summary: {
        totalRepos: job.totalRepos,
        doneRepos: job.doneRepos,
        totalCommits: job.totalCommitsScanning,
        totalChunks: job.totalChunks,
        doneChunks: job.doneChunks,
        failedChunks: job.failedChunks,
      },
      chunkEvents,
      retryLog,
      error: job.error,
    });
  }

  // Text format — human readable
  const lines: string[] = [];
  const durationSec = (finishedAt ?? Date.now() - startedAt) / 1000;
  lines.push(`# RepoMosaic Pro — Scan Log`);
  lines.push(`# Job ID:    ${job.id}`);
  lines.push(`# Org:       ${job.org} (${job.ownerKind})`);
  lines.push(`# Branch:    ${job.branchMode}`);
  lines.push(`# Model:     ${job.model} (${job.provider})`);
  lines.push(`# Status:    ${job.status}`);
  lines.push(`# Started:   ${startedAt ? new Date(startedAt).toISOString() : "—"}`);
  lines.push(`# Finished:  ${finishedAt ? new Date(finishedAt).toISOString() : "(running)"}`);
  lines.push(`# Duration:  ${durationSec.toFixed(1)}s`);
  lines.push(`# `);
  lines.push(`# Summary: ${job.doneRepos}/${job.totalRepos} repos · ${job.totalCommitsScanning} commits · ${job.doneChunks}/${job.totalChunks} chunks OK (${job.failedChunks} failed)`);
  lines.push(`#`);
  if (job.error) {
    lines.push(`# ERROR: ${job.error}`);
    lines.push(`#`);
  }
  lines.push("");
  lines.push(`=== Per-chunk outcomes (${chunkEvents.length} entries) ===`);
  lines.push("");
  if (chunkEvents.length === 0) {
    lines.push("(no chunk events recorded — this scan predates the event log feature)");
  } else {
    lines.push("status  tags  chunk-id                                                   repo                       author");
    lines.push("-".repeat(120));
    for (const ev of chunkEvents) {
      const status = ev.status === "ok" ? "  OK  " : "FAILED";
      const tags = String(ev.tags).padStart(3, " ");
      const chunkId = ev.chunkId.padEnd(55, " ");
      const repo = ev.repo.slice(0, 25).padEnd(25, " ");
      const author = ev.author.slice(0, 30);
      lines.push(`${status}  ${tags}  ${chunkId}  ${repo}  ${author}`);
      if (ev.error) {
        lines.push(`         └─ ${ev.error}`);
      }
    }
  }

  if (retryLog.length > 0) {
    lines.push("");
    lines.push(`=== Retry warnings (${retryLog.length} entries) ===`);
    lines.push("");
    for (const r of retryLog) {
      lines.push(`[${new Date(r.timestamp).toISOString()}] ${r.chunkId} attempt ${r.attempt}: ${r.error}`);
    }
  }

  const text = lines.join("\n");
  return new Response(text, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="scan-${job.org}-${job.id}.log"`,
    },
  });
}
