import { NextResponse } from "next/server";
import type { AdvancedSkillMap } from "@/lib/analysis/skill-taxonomy";

export const runtime = "nodejs";

/** POST /api/export
 *  body: { skillMap, format: "json" | "markdown" }
 *  Returns: downloadable file (or JSON for fetch-based download)
 */
export async function POST(req: Request) {
  try {
    const { skillMap, format } = (await req.json()) as {
      skillMap?: AdvancedSkillMap;
      format?: "json" | "markdown";
    };
    if (!skillMap) return NextResponse.json({ error: "skillMap required" }, { status: 400 });
    if (format === "markdown") {
      const md = toMarkdown(skillMap);
      return new NextResponse(md, {
        headers: { "Content-Type": "text/markdown; charset=utf-8" },
      });
    }
    return new NextResponse(JSON.stringify(skillMap, null, 2), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

function toMarkdown(m: AdvancedSkillMap): string {
  const lines: string[] = [];
  lines.push(`# Advanced Skill Map — ${m.org}`);
  lines.push("");
  lines.push(`- Generated: ${m.generatedAt}`);
  lines.push(`- Model: ${m.model} (${m.provider})`);
  lines.push(`- Repos: ${m.totalRepos} · Commits: ${m.totalCommits} · Chunks: ${m.totalChunks} · People: ${m.totalPeople}`);
  lines.push("");
  lines.push("## Org-wide Sectors");
  for (const s of m.orgSectors.slice(0, 15)) {
    lines.push(`- **${s.name}** — score ${s.score} · ${s.people} people · ${s.commits} commits`);
  }
  lines.push("");
  lines.push("## Org-wide Problem Types");
  for (const s of m.orgProblemTypes.slice(0, 15)) {
    lines.push(`- **${s.name}** — score ${s.score} · ${s.people} people · ${s.commits} commits`);
  }
  lines.push("");
  lines.push("## Org-wide Tech");
  for (const s of m.orgTech.slice(0, 20)) {
    lines.push(`- **${s.name}** — score ${s.score} · ${s.people} people · ${s.commits} commits`);
  }
  lines.push("");
  lines.push("## People");
  for (const p of m.people) {
    lines.push(`### ${p.name || p.login} (@${p.login})`);
    lines.push(`- Commits: ${p.totalCommits} · Chunks: ${p.totalChunks} · Repos: ${p.repos.length}`);
    lines.push(`- Sectors: ${p.sectors.slice(0, 5).map((s) => `${s.name} (${s.score})`).join(", ")}`);
    lines.push(`- Problem Types: ${p.problemTypes.slice(0, 5).map((s) => `${s.name} (${s.score})`).join(", ")}`);
    lines.push(`- Tech: ${p.tech.slice(0, 8).map((s) => `${s.name} (${s.score})`).join(", ")}`);
    lines.push(`- Methodologies: ${p.methodologies.slice(0, 5).map((s) => `${s.name} (${s.score})`).join(", ")}`);
    lines.push(`- Roles: ${p.roles.slice(0, 5).map((s) => `${s.name} (${s.score})`).join(", ")}`);
    lines.push("");
  }
  return lines.join("\n");
}
