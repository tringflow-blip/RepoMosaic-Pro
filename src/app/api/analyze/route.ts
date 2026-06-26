import { NextResponse } from "next/server";
import { extractSkillsForChunk, type LLMConfig } from "@/lib/llm/skill-extractor";

export const runtime = "nodejs";
export const maxDuration = 120;

/** POST /api/analyze
 *  body: {
 *    config: LLMConfig,
 *    chunk: { chunkId, repo, author, authorLogin, commits: CommitInfo[] }
 *  }
 *  Returns: ChunkSkillExtraction
 *
 *  This endpoint exposes the skill extractor directly so you can test a
 *  single chunk without running a full scan.
 */
export async function POST(req: Request) {
  try {
    const { config, chunk } = (await req.json()) as {
      config?: LLMConfig;
      chunk?: Parameters<typeof extractSkillsForChunk>[1];
    };
    if (!config || !chunk) {
      return NextResponse.json({ error: "config and chunk required" }, { status: 400 });
    }
    const result = await extractSkillsForChunk(config, chunk);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
