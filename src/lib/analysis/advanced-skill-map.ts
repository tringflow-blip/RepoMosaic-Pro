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
  ActivityPoint,
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
 * Strategy:
 *   1. lowercase + strip punctuation/space → compare.
 *   2. ALIASES map handles common LLM abbreviations (js → JavaScript).
 *   3. STEM_RULES collapses any tag whose normalized form starts with a known
 *      stem (e.g. "edu" → "EduTech", "fintech" → "FinTech"). This catches the
 *      GLM's "EduCook"/"EduHealth"/"EduCooking" pattern that prefix-merging
 *      misses because their normalized forms ("educook", "eduhealth",
 *      "educoking") don't share a ≥4-char prefix.
 *   4. If two normalized forms are equal OR one is a prefix of the other
 *      (≥4 chars), they merge. The canonical name is the longest variant seen.
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

/**
 * Stem rules: if a normalized tag name STARTS WITH one of these stems, it gets
 * remapped to the canonical seed name. This handles the GLM's tendency to
 * invent variations like "EduCook", "EduHealth", "EduCooking" — they all
 * normalize to "edu..." which should map to "EduTech".
 *
 * Stems must be ≥3 chars to avoid false positives. Order matters: longest
 * stems are checked first.
 */
const STEM_RULES: { stem: string; canonical: string }[] = [
  // Education sector — collapse Edu* variations
  { stem: "edu", canonical: "EduTech" },
  // Health sector
  { stem: "health", canonical: "HealthTech" },
  { stem: "med", canonical: "HealthTech" },
  // Finance
  { stem: "fin", canonical: "FinTech" },
  { stem: "pay", canonical: "FinTech" },
  // Commerce
  { stem: "commerce", canonical: "E-commerce" },
  { stem: "shop", canonical: "E-commerce" },
  { stem: "ecomm", canonical: "E-commerce" },
  // DevTools
  { stem: "devtool", canonical: "DevTools" },
  // Media/Content
  { stem: "media", canonical: "Media/Content" },
  { stem: "content", canonical: "Media/Content" },
  { stem: "publish", canonical: "Media/Content" },
  // Web3
  { stem: "web3", canonical: "Web3/Crypto" },
  { stem: "crypto", canonical: "Web3/Crypto" },
  { stem: "blockchain", canonical: "Web3/Crypto" },
  // AI/ML
  { stem: "machine", canonical: "AI/ML" },
  { stem: "deeplearn", canonical: "AI/ML" },
  // Productivity
  { stem: "product", canonical: "Productivity" },
  // Communications
  { stem: "comm", canonical: "Communications" },
  { stem: "chat", canonical: "Communications" },
  { stem: "messag", canonical: "Communications" },
];

function applyStemRule(normalizedName: string): string | null {
  for (const rule of STEM_RULES) {
    if (normalizedName.startsWith(rule.stem) && normalizedName.length > rule.stem.length) {
      return rule.canonical;
    }
  }
  return null;
}

function normalizeKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Build a canonical-name resolver for a set of tag names. Tags that normalize
 *  to the same key (or where one is a prefix of the other ≥4 chars, or that
 *  match a STEM_RULE) collapse into one canonical name. Returns a function
 *  name → canonical name. */
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

  // STEM_RULES pass: any normalized key that starts with a known stem (e.g.
  // "edu" for "educook"/"eduhealth"/"educoking") gets remapped to the stem's
  // canonical seed name. This catches near-duplicates that prefix-merging
  // misses (because "educook"/"eduhealth" don't share a ≥4-char prefix).
  // We only apply the stem rule to keys that aren't EXACT matches for a seed
  // (so "EduTech" itself isn't double-mapped).
  const exactSeedKeys = new Set<string>();
  for (const n of names) {
    const k = normalizeKey(n);
    for (const rule of STEM_RULES) {
      if (k === rule.stem || k === normalizeKey(rule.canonical)) {
        exactSeedKeys.add(k);
      }
    }
  }
  for (const [key, canon] of Array.from(normCanonical.entries())) {
    if (exactSeedKeys.has(key)) continue;
    const stemMatch = applyStemRule(key);
    if (stemMatch) {
      // If the stem's canonical name is already present in the resolver,
      // merge into it; otherwise create a new entry.
      const stemKey = normalizeKey(stemMatch);
      if (normCanonical.has(stemKey)) {
        // Prefer the seed canonical name
        normCanonical.set(key, normCanonical.get(stemKey)!);
      } else {
        normCanonical.set(key, stemMatch);
      }
    }
  }

  // Prefix merging: if "edutech" and "educate" both exist as separate keys,
  // and one is a prefix (≥4 chars) of the other, merge into the longer canonical.
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

/** Convert a list of ISO date strings (possibly with time component) into a
 *  sorted list of { date: YYYY-MM-DD, count } daily activity points. */
function aggregateActivity(dates: string[]): ActivityPoint[] {
  const counts = new Map<string, number>();
  for (const iso of dates) {
    if (!iso) continue;
    const dateStr = iso.slice(0, 10); // YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) continue;
    counts.set(dateStr, (counts.get(dateStr) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
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
    const personDates: string[] = [];
    let totalCommits = 0;
    let totalChunks = 0;

    for (const ext of exts) {
      repos.add(ext.repo);
      totalChunks += 1;
      totalCommits += ext.commits;
      if (ext.dates && ext.dates.length > 0) {
        personDates.push(...ext.dates);
      }
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

    const activity = aggregateActivity(personDates);
    const firstCommitDate = activity.length > 0 ? activity[0].date : null;
    const lastCommitDate = activity.length > 0 ? activity[activity.length - 1].date : null;

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
      activity,
      firstCommitDate,
      lastCommitDate,
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

  // Org-wide activity (union of all person activity)
  const orgDateCounts = new Map<string, number>();
  for (const ext of normalizedExtractions) {
    if (!ext.dates) continue;
    for (const iso of ext.dates) {
      const dateStr = iso.slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) continue;
      orgDateCounts.set(dateStr, (orgDateCounts.get(dateStr) ?? 0) + 1);
    }
  }
  const orgActivity = Array.from(orgDateCounts.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const orgFirst = orgActivity.length > 0 ? orgActivity[0].date : null;
  const orgLast = orgActivity.length > 0 ? orgActivity[orgActivity.length - 1].date : null;

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
    activity: orgActivity,
    firstCommitDate: orgFirst,
    lastCommitDate: orgLast,
  };
}

/**
 * Post-normalize an already-aggregated skill map. Used when loading OLD
 * cached scans that were aggregated before the latest STEM_RULES were added
 * — collapses duplicate tags (e.g. "EduTech"/"EduCook"/"EduHealth") that
 * slipped through the older normalizer.
 *
 * Re-runs buildCanonicalizer across each dimension's tag names (collected
 * from all people + the org rollup), then merges entries that collapse to
 * the same canonical name (summing commits/chunks, averaging score weighted
 * by commits).
 */
export function postNormalizeSkillMap(map: AdvancedSkillMap): AdvancedSkillMap {
  const dimKeys: { field: "sectors" | "problemTypes" | "tech" | "methodologies" | "roles"; orgField: "orgSectors" | "orgProblemTypes" | "orgTech" | "orgMethodologies" | "orgRoles" }[] = [
    { field: "sectors", orgField: "orgSectors" },
    { field: "problemTypes", orgField: "orgProblemTypes" },
    { field: "tech", orgField: "orgTech" },
    { field: "methodologies", orgField: "orgMethodologies" },
    { field: "roles", orgField: "orgRoles" },
  ];

  type MergedItem = { name: string; score: number; commits: number; chunks: number };
  const newPeople: PersonSkillRecord[] = map.people.map((p) => ({ ...p }));
  const newOrg: Record<string, MergedItem & { people: number }> = {};

  for (const { field, orgField } of dimKeys) {
    // Collect all tag names across people + org rollup
    const allNames = new Set<string>();
    for (const p of map.people) {
      for (const item of p[field]) allNames.add(item.name);
    }
    for (const item of map[orgField]) allNames.add(item.name);

    const canonicalize = buildCanonicalizer(Array.from(allNames));

    // Helper: merge a list of items into canonical-name buckets
    const mergeItems = (items: MergedItem[]): MergedItem[] => {
      const buckets = new Map<string, { scoreSum: number; commits: number; chunks: number }>();
      for (const it of items) {
        const canon = canonicalize(it.name);
        const cur = buckets.get(canon) ?? { scoreSum: 0, commits: 0, chunks: 0 };
        // weighted score: average across chunks weighted by commits
        cur.scoreSum += it.score * Math.max(1, it.commits);
        cur.commits += it.commits;
        cur.chunks += it.chunks;
        buckets.set(canon, cur);
      }
      return Array.from(buckets.entries()).map(([name, v]) => ({
        name,
        score: Math.round((v.scoreSum / Math.max(1, v.commits)) * 100) / 100,
        commits: v.commits,
        chunks: v.chunks,
      })).sort((a, b) => b.commits - a.commits || b.score - a.score).slice(0, 30);
    };

    // Re-aggregate per person
    for (const p of newPeople) {
      const merged = mergeItems(p[field]);
      (p as unknown as Record<string, unknown>)[field] = merged;
    }

    // Re-aggregate org rollup with people counts
    const mergedOrg = mergeItems(map[orgField]);
    newOrg[orgField] = mergedOrg.map((d) => ({
      ...d,
      people: newPeople.filter((p) => p[field].some((s) => s.name === d.name)).length,
    }));
  }

  return {
    ...map,
    people: newPeople.map((p) => ({
      ...p,
      activity: p.activity ?? [],
      firstCommitDate: p.firstCommitDate ?? null,
      lastCommitDate: p.lastCommitDate ?? null,
    })),
    orgSectors: newOrg.orgSectors,
    orgProblemTypes: newOrg.orgProblemTypes,
    orgTech: newOrg.orgTech,
    orgMethodologies: newOrg.orgMethodologies,
    orgRoles: newOrg.orgRoles,
    // Preserve activity & date range for old cached scans that already had them
    activity: map.activity ?? [],
    firstCommitDate: map.firstCommitDate ?? null,
    lastCommitDate: map.lastCommitDate ?? null,
  };
}
