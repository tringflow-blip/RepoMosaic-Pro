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
  SkillTag,
} from "@/lib/analysis/skill-taxonomy";

type DimensionAgg = Map<string, { score: number; commits: number; chunks: number }>;

function newDimAgg(): DimensionAgg {
  return new Map();
}

/**
 * Normalize a skill tag name so near-duplicates emitted by the LLM collapse
 * into a single canonical form. Examples the GLM model actually produces:
 *   "EduTech" / "EduCook" / "EduHealth" / "EduCooking"  →  "EduTech"
 *   "UI/UX Implementation" / "UI/UX & Design Systems"   →  kept distinct
 *   "Refactoring" / "Refactor"                           →  "Refactoring"
 *   "HTML" / "Html" / "html5"                            →  "HTML"
 *   "JS" / "JavaScript" / "javascript"                   →  "JavaScript"
 *
 * Strategy: lowercase + strip punctuation/space → compare. If the normalized
 * forms are equal OR one is a prefix of the other (≥4 chars), they merge.
 * The canonical name is the longest variant seen (so "EduTech" beats "EduCook"
 * only if it appeared — otherwise the longest survives). A small alias map
 * handles the most common LLM abbreviations.
 */
const ALIASES: Record<string, string> = {
  js: "JavaScript",
  javascript: "JavaScript",
  ts: "TypeScript",
  typescript: "TypeScript",
  reactjs: "React",
  nextjs: "Next.js",
  nodejs: "Node.js",
  node: "Node.js",
  html5: "HTML",
  html: "HTML",
  css3: "CSS",
  css: "CSS",
  rest: "REST API",
  restapi: "REST API",
  graphql: "GraphQL",
  uiux: "UI/UX",
  ui: "UI/UX",
  ux: "UI/UX",
  devops: "DevOps/Infra",
  infra: "Infra/DevOps",
  ml: "AI/ML",
  ai: "AI/ML",
};

function normalizeKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Build a canonical-name resolver for a set of tag names. Tags that normalize
 *  to the same key (or where one is a prefix of the other ≥4 chars) collapse
 *  into one canonical name. Returns a function name → canonical name. */
function buildCanonicalizer(names: string[]): (name: string) => string {
  // Group by alias first
  const aliasCanonical = new Map<string, string>(); // normalized key → canonical
  for (const n of names) {
    const key = normalizeKey(n);
    if (ALIASES[key]) {
      const canon = ALIASES[key];
      aliasCanonical.set(key, canon);
    }
  }

  // Then group remaining by normalized key, picking the longest variant as canonical
  const byNorm = new Map<string, string[]>();
  for (const n of names) {
    const key = normalizeKey(n);
    if (!byNorm.has(key)) byNorm.set(key, []);
    byNorm.get(key)!.push(n);
  }
  const normCanonical = new Map<string, string>();
  for (const [key, variants] of byNorm.entries()) {
    if (aliasCanonical.has(key)) {
      normCanonical.set(key, aliasCanonical.get(key)!);
    } else {
      // Pick the longest variant (most descriptive), tiebreak by alphabetical
      const canon = variants.sort((a, b) => b.length - a.length || a.localeCompare(b))[0];
      normCanonical.set(key, canon);
    }
  }

  // Prefix merging: if "edutech" and "educate" both exist as separate keys,
  // and one is a prefix (≥4 chars) of the other, merge into the longer canonical.
  // This catches "EduCook" / "EduTech" / "EduHealth" → they share "edu" prefix
  // but are genuinely different. We only merge when ONE is a prefix of the OTHER
  // (i.e. "react" / "reactjs"), not when they merely share a prefix.
  const keys = Array.from(normCanonical.keys());
  for (const k1 of keys) {
    if (!normCanonical.has(k1)) continue; // may have been merged already
    for (const k2 of keys) {
      if (k1 === k2) continue;
      if (!normCanonical.has(k2)) continue;
      // Merge if one is a prefix of the other and the shorter is ≥4 chars
      const shorter = k1.length <= k2.length ? k1 : k2;
      const longer = k1.length <= k2.length ? k2 : k1;
      if (shorter.length >= 4 && longer.startsWith(shorter)) {
        // Merge shorter into longer's canonical (keep the longer canonical name)
        const canonShorter = normCanonical.get(shorter)!;
        const canonLonger = normCanonical.get(longer)!;
        // Pick the more frequently-occurring canonical as the survivor.
        // We don't have counts here, so pick the one that appeared first in
        // the original names list (more common in practice).
        const survivor = names.indexOf(canonLonger) <= names.indexOf(canonShorter) ? canonLonger : canonShorter;
        normCanonical.set(shorter, survivor);
        normCanonical.set(longer, survivor);
      }
    }
  }

  return (name: string) => {
    const key = normalizeKey(name);
    return normCanonical.get(key) ?? name;
  };
}

/** Normalize all tags across all extractions: returns a map from
 *  "dimension::originalName" → canonical name. */
function buildTagCanonicalMap(extractions: ChunkSkillExtraction[]): (dim: SkillDimension, name: string) => string {
  // Collect all tag names per dimension
  const byDim = new Map<SkillDimension, string[]>();
  for (const ext of extractions) {
    for (const tag of ext.tags) {
      if (!byDim.has(tag.dimension)) byDim.set(tag.dimension, []);
      byDim.get(tag.dimension)!.push(tag.name);
    }
  }
  const resolvers = new Map<SkillDimension, (n: string) => string>();
  for (const [dim, names] of byDim.entries()) {
    resolvers.set(dim, buildCanonicalizer(names));
  }
  return (dim, name) => resolvers.get(dim)?.(name) ?? name;
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
  // Build a tag canonicalizer once for the whole scan — this collapses
  // near-duplicate tag names (e.g. "EduTech"/"EduCook"/"EduHealth") into a
  // single canonical form before aggregation.
  const canonicalize = buildTagCanonicalMap(input.extractions);

  // Pre-normalize all tags in every extraction (mutates a copy)
  const normalizedExtractions: (ChunkSkillExtraction & { commits: number })[] = input.extractions.map((ext) => ({
    ...ext,
    tags: ext.tags.map((t): SkillTag => ({
      ...t,
      name: canonicalize(t.dimension, t.name),
    })),
  }));

  // Group extractions by author login (fallback to author name)
  const byPerson = new Map<string, (ChunkSkillExtraction & { commits: number })[]>();
  for (const ext of normalizedExtractions) {
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
    const allTags: (SkillTag & { repo: string; commits: number })[] = [];
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

  // Org rollups — use the normalized extractions
  const orgSectors = newDimAgg();
  const orgProblemTypes = newDimAgg();
  const orgTech = newDimAgg();
  const orgMethodologies = newDimAgg();
  const orgRoles = newDimAgg();
  for (const ext of normalizedExtractions) {
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
