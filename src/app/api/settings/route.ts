import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { pingLLM, type LLMConfig } from "@/lib/llm/skill-extractor";

export const runtime = "nodejs";

/** GET /api/settings/cache?org=...&branchMode=...&model=...&provider=...
 *  Returns the most recent cached scan for this combo, if any. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const org = url.searchParams.get("org");
  const branchMode = url.searchParams.get("branchMode") ?? "main";
  const model = url.searchParams.get("model") ?? "glm";
  const provider = url.searchParams.get("provider") ?? "glm";
  if (!org) return NextResponse.json({ cached: null });
  try {
    const row = await db.scanCache.findUnique({
      where: {
        org_ownerKind_branchMode_model_provider: {
          org,
          ownerKind: url.searchParams.get("ownerKind") ?? "org",
          branchMode,
          model,
          provider,
        },
      },
    });
    if (!row) return NextResponse.json({ cached: null });
    return NextResponse.json({
      cached: {
        org: row.org,
        ownerKind: row.ownerKind,
        branchMode: row.branchMode,
        model: row.model,
        provider: row.provider,
        totalRepos: row.totalRepos,
        totalCommits: row.totalCommits,
        totalChunks: row.totalChunks,
        totalPeople: row.totalPeople,
        skillMap: JSON.parse(row.skillMapJson),
        repos: JSON.parse(row.reposJson),
        updatedAt: row.updatedAt,
      },
    });
  } catch (err) {
    return NextResponse.json({ cached: null, error: (err as Error).message });
  }
}

/** POST /api/settings/ping — test LLM connectivity.
 *  body: { config: LLMConfig } */
export async function POST(req: Request) {
  try {
    const { config } = (await req.json()) as { config?: LLMConfig };
    if (!config) return NextResponse.json({ error: "config required" }, { status: 400 });
    const result = await pingLLM(config);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
