/**
 * GLM Skill Extractor
 * ===================
 *
 * This is the "skill" the user asked for: every chunk of commits is sent
 * through this reusable prompt to GLM (or any OpenAI-compatible LLM), and
 * the model returns a structured JSON of multi-dimensional skill tags.
 *
 * The chunk is bounded by maxCommitsPerChunk (default 8) so we don't blow
 * the context window on huge repos. Each chunk is one LLM call.
 *
 * Provider flexibility:
 *   - Default: GLM via z-ai-web-dev-sdk (no API key needed in the UI — the
 *     SDK is pre-authenticated in this sandbox).
 *   - Optional: a custom OpenAI-compatible endpoint (baseURL + apiKey +
 *     model) that the user pastes in the Settings panel. This is the
 *     "cloud or local codecs" flexibility the user requested.
 */
import ZAI from "z-ai-web-dev-sdk";
import type {
  ChunkSkillExtraction,
  SkillDimension,
  SkillTag,
} from "@/lib/analysis/skill-taxonomy";
import {
  SECTOR_SEEDS,
  PROBLEM_TYPE_SEEDS,
  TECH_SEEDS,
  METHODOLOGY_SEEDS,
  ROLE_SEEDS,
} from "@/lib/analysis/skill-taxonomy";

export type LLMProvider = "glm" | "openai-compatible";

export type LLMConfig = {
  provider: LLMProvider;
  /** When provider === "openai-compatible" */
  apiKey?: string;
  baseURL?: string;
  model?: string;
};

const DIMENSIONS: { key: SkillDimension; label: string; seeds: string[] }[] = [
  { key: "sector", label: "Sector (industry / domain served)", seeds: SECTOR_SEEDS },
  { key: "problemType", label: "Problem Type (what kind of problem solved)", seeds: PROBLEM_TYPE_SEEDS },
  { key: "tech", label: "Tech Capability (specific tech / framework / library)", seeds: TECH_SEEDS },
  { key: "methodology", label: "Methodology (engineering approach / process)", seeds: METHODOLOGY_SEEDS },
  { key: "role", label: "Role (what the author did in this chunk)", seeds: ROLE_SEEDS },
];

/** Build the system prompt — the actual "skill" definition. */
export function buildSkillPrompt(): string {
  const dimDocs = DIMENSIONS.map((d) =>
    `### ${d.label}\nSuggested vocabulary (you may add your own when justified):\n${d.seeds.map((s) => `- ${s}`).join("\n")}`
  ).join("\n\n");

  return `You are the RepoMosaic Advanced Skill Mapper — an expert engineering analyst that reads chunks of git commit activity and tags them with multi-dimensional skills.

For each chunk you receive, you must:
1. Understand what the author actually did (read commit messages + file paths + diff stats).
2. Attribute skills across FIVE dimensions:
${dimDocs}

3. Be specific and evidence-based. Only tag a skill if there is concrete evidence in the chunk.
4. Confidence is a float in [0,1] reflecting how strongly the evidence supports the tag.
5. Always include AT LEAST one sector tag, one problem-type tag, one tech tag, and one role tag when there is enough signal. Methodology tags are optional.

Output STRICT JSON ONLY (no markdown fences, no prose) with this exact shape:

{
  "summary": "one-sentence summary of what this chunk accomplished",
  "primarySector": "the single strongest sector for this chunk (string or null)",
  "tags": [
    {
      "dimension": "sector" | "problemType" | "tech" | "methodology" | "role",
      "name": "Human-readable tag name (Title Case)",
      "confidence": 0.0,
      "evidence": ["commit message or file path that justifies this tag"]
    }
  ]
}

Rules:
- Return between 4 and 20 tags per chunk.
- Do not invent dimensions outside the five listed above.
- Tag names should be consistent across chunks (use the suggested vocabulary when it fits).
- Evidence entries must come from the actual chunk text.
- Never wrap the JSON in markdown fences.`;
}

/** Build the user message for a single chunk of commits. */
export function buildChunkUserMessage(chunk: {
  repo: string;
  author: string;
  authorLogin: string | null;
  commits: {
    sha: string;
    message: string;
    date: string;
    additions: number;
    deletions: number;
    files: { filename: string; status: string; additions: number; deletions: number; changes: number }[];
  }[];
}): string {
  const commitLines = chunk.commits.map((c, i) => {
    const files = c.files.slice(0, 20).map((f) => `    - [${f.status}] ${f.filename} (+${f.additions}/-${f.deletions})`).join("\n");
    return `Commit ${i + 1}: ${c.sha.slice(0, 8)} — ${c.date}
  Author: ${chunk.author}${chunk.authorLogin ? ` (@${chunk.authorLogin})` : ""}
  Message: ${c.message.split("\n").slice(0, 4).join(" | ").slice(0, 400)}
  Files (${c.files.length}):
${files || "    (no file details)"}`;
  }).join("\n\n");

  return `Repo: ${chunk.repo}
Author: ${chunk.author}${chunk.authorLogin ? ` (@${chunk.authorLogin})` : ""}
Commits in chunk: ${chunk.commits.length}

${commitLines}

Tag this chunk now. Output STRICT JSON only.`;
}

/** Robust JSON extractor — GLM occasionally wraps JSON in prose or fences. */
function extractJSON(text: string): unknown {
  if (!text) throw new Error("Empty LLM response");
  // Strip markdown fences if present
  let t = text.trim();
  // Remove ```json ... ``` or ``` ... ```
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  // Find the first { ... last }
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object found in LLM response");
  }
  const slice = t.slice(start, end + 1);
  return JSON.parse(slice);
}

function normaliseTags(raw: unknown): SkillTag[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((t): t is Record<string, unknown> => !!t && typeof t === "object")
    .map((t) => ({
      dimension: (String(t.dimension ?? "") as SkillDimension) || "tech",
      name: String(t.name ?? "").trim(),
      confidence: Math.max(0, Math.min(1, Number(t.confidence ?? 0) || 0)),
      evidence: Array.isArray(t.evidence)
        ? t.evidence.map((e) => String(e)).slice(0, 5)
        : [],
    }))
    .filter((t) => t.name && DIMENSIONS.some((d) => d.key === t.dimension));
}

/** Invoke the LLM (GLM by default, OpenAI-compatible if configured).
 *  Includes retry with exponential backoff for transient errors (429, 5xx,
 *  network timeouts) so we don't lose skill data to rate-limiting. */
async function callLLM(
  config: LLMConfig,
  systemPrompt: string,
  userMessage: string
): Promise<{ content: string; model: string; provider: string }> {
  if (config.provider === "openai-compatible") {
    if (!config.apiKey || !config.baseURL) {
      throw new Error("OpenAI-compatible provider requires apiKey + baseURL");
    }
    const model = config.model || "gpt-4o-mini";
    const resp = await fetchWithRetry(`${config.baseURL.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        temperature: 0.2,
        response_format: { type: "json_object" },
      }),
    });
    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(`LLM HTTP ${resp.status}: ${txt.slice(0, 200)}`);
    }
    const data = (await resp.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content ?? "";
    return { content, model, provider: "openai-compatible" };
  }

  // GLM via z-ai-web-dev-sdk (default) — retry on 429/5xx/network errors
  return callGLMWithRetry(systemPrompt, userMessage);
}

/** Sleep helper. */
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Determine if an error is transient (worth retrying). */
function isTransient(err: unknown): boolean {
  const msg = (err as Error)?.message ?? "";
  if (/429|rate.?limit|too many requests/i.test(msg)) return true;
  if (/5\d{2}|server error|internal error|bad gateway|service unavailable|gateway timeout/i.test(msg)) return true;
  if (/ECONNRESET|ETIMEDOUT|ENOTFOUND|fetch failed|network|socket hang up|aborted/i.test(msg)) return true;
  return false;
}

/** fetch with retry — for OpenAI-compatible providers. */
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  maxRetries = 4
): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const resp = await fetch(url, init);
      // Retry on 429 and 5xx
      if (resp.status === 429 || (resp.status >= 500 && resp.status < 600)) {
        const retryAfter = resp.headers.get("retry-after");
        const delay = retryAfter
          ? Math.min(30000, parseInt(retryAfter, 10) * 1000)
          : Math.min(30000, 800 * 2 ** attempt + Math.random() * 300);
        if (attempt === maxRetries) return resp;
        await sleep(delay);
        continue;
      }
      return resp;
    } catch (err) {
      lastErr = err;
      if (isTransient(err) && attempt < maxRetries) {
        const delay = Math.min(30000, 800 * 2 ** attempt + Math.random() * 300);
        await sleep(delay);
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

/** GLM SDK call with retry — for the default z-ai-web-dev-sdk provider. */
async function callGLMWithRetry(
  systemPrompt: string,
  userMessage: string,
  maxRetries = 4
): Promise<{ content: string; model: string; provider: string }> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const zai = await ZAI.create();
      const completion = await zai.chat.completions.create({
        messages: [
          { role: "assistant", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        thinking: { type: "disabled" },
        temperature: 0.2,
      });
      const content = completion.choices[0]?.message?.content ?? "";
      return {
        content,
        model: (completion as unknown as { model?: string }).model || "glm",
        provider: "glm",
      };
    } catch (err) {
      lastErr = err;
      if (isTransient(err) && attempt < maxRetries) {
        // Exponential backoff: ~1s, ~2s, ~4s, ~8s (with jitter)
        const delay = Math.min(30000, 1000 * 2 ** attempt + Math.random() * 500);
        const msg = (err as Error).message.slice(0, 100);
        console.warn(
          `[glm-retry] attempt ${attempt + 1}/${maxRetries + 1} failed: ${msg} → retrying in ${Math.round(delay)}ms`
        );
        // Push to the global retry registry so the scan log can pick it up
        pushRetryEvent({
          attempt: attempt + 1,
          error: msg,
          timestamp: Date.now(),
        });
        await sleep(delay);
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

/** Global retry registry — the scan orchestrator pulls from this each chunk
 *  to attach retry warnings to the active job's log. The key is the chunk
 *  id (set by the orchestrator around each call); the value is the list of
 *  retry events that occurred during that chunk. */
const globalForRetry = globalThis as unknown as {
  __retryBuffer?: { chunkId: string | null; attempt: number; error: string; timestamp: number }[];
};
if (!globalForRetry.__retryBuffer) globalForRetry.__retryBuffer = [];

function pushRetryEvent(ev: { attempt: number; error: string; timestamp: number }) {
  globalForRetry.__retryBuffer!.push({
    chunkId: currentChunkId,
    attempt: ev.attempt,
    error: ev.error,
    timestamp: ev.timestamp,
  });
  // Cap the buffer to avoid unbounded growth on a runaway scan
  if (globalForRetry.__retryBuffer!.length > 1000) {
    globalForRetry.__retryBuffer!.splice(0, globalForRetry.__retryBuffer!.length - 1000);
  }
}

let currentChunkId: string | null = null;

/** Set the current chunk id — used by the scan orchestrator to attribute
 *  retry events to the chunk that caused them. Returns a reset function. */
export function setChunkContext(chunkId: string): () => void {
  currentChunkId = chunkId;
  return () => {
    currentChunkId = null;
  };
}

/** Drain the retry buffer for a given chunk id — returns the events and
 *  removes them from the global buffer. */
export function drainRetryEvents(chunkId: string): { chunkId: string; attempt: number; error: string; timestamp: number }[] {
  const buf = globalForRetry.__retryBuffer!;
  const matching = buf.filter((e) => e.chunkId === chunkId);
  if (matching.length > 0) {
    globalForRetry.__retryBuffer = buf.filter((e) => e.chunkId !== chunkId);
  }
  return matching;
}

/** Analyse a single chunk of commits and return multi-dimensional skill tags.
 *  This is the function the scan orchestrator calls once per chunk.
 *  Returns `failed: true` when the LLM call could not be completed even after
 *  retries — the caller can use this to track scan quality. */
export async function extractSkillsForChunk(
  config: LLMConfig,
  chunk: {
    chunkId: string;
    repo: string;
    author: string;
    authorLogin: string | null;
    commits: {
      sha: string;
      message: string;
      date: string;
      additions: number;
      deletions: number;
      files: { filename: string; status: string; additions: number; deletions: number; changes: number }[];
    }[];
  }
): Promise<ChunkSkillExtraction & { model: string; provider: string; failed: boolean }> {
  const systemPrompt = buildSkillPrompt();
  const userMessage = buildChunkUserMessage(chunk);

  let parsed: { summary?: string; primarySector?: string | null; tags?: unknown };
  let model = "glm";
  let provider = "glm";
  let failed = false;
  try {
    const { content, model: m, provider: p } = await callLLM(config, systemPrompt, userMessage);
    model = m;
    provider = p;
    parsed = extractJSON(content) as typeof parsed;
  } catch (err) {
    // All retries exhausted — emit a minimal fallback tag so we never lose
    // the chunk entirely, but flag it as failed for quality tracking.
    failed = true;
    parsed = {
      summary: `LLM analysis failed (after retries): ${(err as Error).message.slice(0, 120)}`,
      primarySector: null,
      tags: [
        { dimension: "role", name: "Implementation", confidence: 0.3, evidence: ["(LLM analysis failed — fallback tag)"] },
      ],
    };
  }

  const tags = normaliseTags(parsed.tags);

  return {
    chunkId: chunk.chunkId,
    author: chunk.author,
    authorLogin: chunk.authorLogin,
    repo: chunk.repo,
    tags,
    summary: String(parsed.summary ?? "").slice(0, 400),
    primarySector: parsed.primarySector ? String(parsed.primarySector) : null,
    /** Pass through commit dates so the aggregator can build a real activity
     *  timeline without re-fetching from GitHub. */
    dates: chunk.commits.map((c) => c.date).filter(Boolean),
    model,
    provider,
    failed,
  };
}

/** Test the LLM connectivity with a tiny ping. Returns the model string. */
export async function pingLLM(config: LLMConfig): Promise<{ ok: boolean; model: string; provider: string; error?: string }> {
  try {
    const { model, provider } = await callLLM(
      config,
      "You are a connectivity test. Reply with the JSON {\"ok\":true}.",
      "ping"
    );
    return { ok: true, model, provider };
  } catch (err) {
    return { ok: false, model: "", provider: config.provider, error: (err as Error).message };
  }
}
