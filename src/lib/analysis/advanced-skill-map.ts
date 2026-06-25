/**
 * Advanced Skill-Map Aggregator
 * =============================
 *
 * Takes the per-chunk extractions from the GLM skill extractor and rolls
 * them up into:
 *   - Per-person skill records (5 dimensions)
 *   - Org-wide rollups (5 dimensions)
 *
 * Pure in-memory, no I/O. Called by the scan orchestrator after all chunks
 * have been analysed.
 */
import type {
  AdvancedSkillMap,
  ChunkSkillExtraction,
  PersonSkillRecord,
  SkillDimension,
} from "@/lib/analysis/skill-taxonomy";

type DimensionAgg = Map<string, { score: number; commits: number; chunks: number }>;

function newDimAgg(): DimensionAgg {
  return new Map();
}

function addTag(
  agg: DimensionAgg,
  name: string,
  confidence: number,
  commits: number
) {
  const key = name.trim();
  if (!key) return;
  const cur = agg.get(key) ?? { score: 0, commits: 0, chunks: 0 };
  // Confidence is averaged across chunks; commits accumulate.
  cur.score += confidence;
  cur.commits += commits;
  cur.chunks += 1;
  agg.set(key, cur);
}

function rankDim(agg: DimensionAgg): { name: string; score: number; commits: number; chunks: number }[] {
  const items = Array.from(agg.entries()).map(([name, v]) => ({
    name,
    // Score = average confidence across chunks that produced this tag, weighted
    // slightly by commit volume so a 1-commit fluke doesn't outrank a 50-commit trend.
    score: Math.round((v.score / Math.max(1, v.chunks)) * 100) / 100,
    commits: v.commits,
    chunks: v.chunks,
  }));
  items.sort((a, b) => b.commits - a.commits || b.score - a.score);
  return items.slice(0, 30);
}

export type AggregationInput = {
  org: string;
  model: string;
  provider: string;
  extractions: (ChunkSkillExtraction & { commits: number })[];
  /** Per (login, repo) commit totals — for ownership computation. */
  personRepoCommits: Map<string, Map<string, number>>;
  /** Per login → meta */
  personMeta: Map<string, { login: string; name: string; avatarUrl: string; url: string }>;
  totalRepos: number;
  totalCommits: number;
};

export function aggregateSkillMap(input: AggregationInput): AdvancedSkillMap {
  // Group extractions by author login (fallback to author name)
  const byPerson = new Map<string, (ChunkSkillExtraction & { commits: number })[]>();
  for (const ext of input.extractions) {
    const key = ext.authorLogin ?? ext.author;
    if (!byPerson.has(key)) byPerson.set(key, []);
    byPerson.get(key)!.push(ext);
  }

  const people: PersonSkillRecord[] = [];

  for (const [key, exts] of byPerson.entries()) {
    const meta = input.personMeta.get(key) ?? {
      login: key,
      name: exts[0]?.author ?? key,
      avatarUrl: "",
      url: "",
    };

    const sectors = newDimAgg();
    const problemTypes = newDimAgg();
    const tech = newDimAgg();
    const methodologies = newDimAgg();
    const roles = newDimAgg();

    const repos = new Set<string>();
    const allTags: (import("@/lib/analysis/skill-taxonomy").SkillTag & { repo: string; commits: number })[] = [];
    let totalCommits = 0;
    let totalChunks = 0;

    for (const ext of exts) {
      repos.add(ext.repo);
      totalChunks += 1;
      totalCommits += ext.commits;
      for (const tag of ext.tags) {
        const target =
          tag.dimension === "sector" ? sectors :
          tag.dimension === "problemType" ? problemTypes :
          tag.dimension === "tech" ? tech :
          tag.dimension === "methodology" ? methodologies : roles;
        addTag(target, tag.name, tag.confidence, ext.commits);
        allTags.push({ ...tag, repo: ext.repo, commits: ext.commits });
      }
    }

    // Ownership
    const repoCommits = input.personRepoCommits.get(key) ?? new Map();
    const ownership: { repo: string; share: number; commits: number }[] = [];
    for (const [repo, mine] of repoCommits.entries()) {
      // denominator: sum of all people's commits on this repo
      let total = 0;
      for (const inner of input.personRepoCommits.values()) {
        total += inner.get(repo) ?? 0;
      }
      ownership.push({
        repo,
        commits: mine,
        share: total > 0 ? Math.round((mine / total) * 100) / 100 : 0,
      });
    }
    ownership.sort((a, b) => b.share - a.share);

    people.push({
      login: meta.login,
      name: meta.name,
      avatarUrl: meta.avatarUrl,
      url: meta.url,
      totalCommits,
      totalChunks,
      repos: Array.from(repos).sort(),
      sectors: rankDim(sectors),
      problemTypes: rankDim(problemTypes),
      tech: rankDim(tech),
      methodologies: rankDim(methodologies),
      roles: rankDim(roles),
      allTags: allTags.sort((a, b) => b.commits - a.commits).slice(0, 60),
      ownership: ownership.slice(0, 20),
    });
  }

  people.sort((a, b) => b.totalCommits - a.totalCommits);

  // Org rollups
  const orgSectors = newDimAgg();
  const orgProblemTypes = newDimAgg();
  const orgTech = newDimAgg();
  const orgMethodologies = newDimAgg();
  const orgRoles = newDimAgg();
  for (const ext of input.extractions) {
    for (const tag of ext.tags) {
      const target =
        tag.dimension === "sector" ? orgSectors :
        tag.dimension === "problemType" ? orgProblemTypes :
        tag.dimension === "tech" ? orgTech :
        tag.dimension === "methodology" ? orgMethodologies : orgRoles;
      addTag(target, tag.name, tag.confidence, ext.commits);
    }
  }

  // Properly count people per org-level skill
  const countPeople = (dim: SkillDimension, name: string) =>
    people.filter((p) => {
      const list =
        dim === "sector" ? p.sectors :
        dim === "problemType" ? p.problemTypes :
        dim === "tech" ? p.tech :
        dim === "methodology" ? p.methodologies : p.roles;
      return list.some((s) => s.name === name);
    }).length;

  const orgRollup = (agg: DimensionAgg, dim: SkillDimension) =>
    rankDim(agg).map((d) => ({
      name: d.name,
      score: d.score,
      commits: d.commits,
      people: countPeople(dim, d.name),
    }));

  return {
    org: input.org,
    generatedAt: new Date().toISOString(),
    model: input.model,
    provider: input.provider,
    totalRepos: input.totalRepos,
    totalCommits: input.totalCommits,
    totalChunks: input.extractions.length,
    totalPeople: people.length,
    people,
    orgSectors: orgRollup(orgSectors, "sector"),
    orgProblemTypes: orgRollup(orgProblemTypes, "problemType"),
    orgTech: orgRollup(orgTech, "tech"),
    orgMethodologies: orgRollup(orgMethodologies, "methodology"),
    orgRoles: orgRollup(orgRoles, "role"),
  };
}
