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

/** Invoke the LLM (GLM by default, OpenAI-compatible if configured). */
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
    const resp = await fetch(`${config.baseURL.replace(/\/$/, "")}/chat/completions`, {
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

  // GLM via z-ai-web-dev-sdk (default)
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
}

/** Analyse a single chunk of commits and return multi-dimensional skill tags.
 *  This is the function the scan orchestrator calls once per chunk. */
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
): Promise<ChunkSkillExtraction & { model: string; provider: string }> {
  const systemPrompt = buildSkillPrompt();
  const userMessage = buildChunkUserMessage(chunk);

  let parsed: { summary?: string; primarySector?: string | null; tags?: unknown };
  let model = "glm";
  let provider = "glm";
  try {
    const { content, model: m, provider: p } = await callLLM(config, systemPrompt, userMessage);
    model = m;
    provider = p;
    parsed = extractJSON(content) as typeof parsed;
  } catch (err) {
    // Fallback: emit a minimal "unknown" tag so we never lose the chunk
    parsed = {
      summary: `Failed to parse LLM response: ${(err as Error).message}`,
      primarySector: null,
      tags: [
        { dimension: "role", name: "Implementation", confidence: 0.3, evidence: ["(LLM parse failed)"] },
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
    model,
    provider,
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
