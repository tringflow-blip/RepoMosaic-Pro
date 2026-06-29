/**
 * Person Merge Logic
 * ==================
 *
 * When the same person has multiple GitHub accounts (e.g. personal + org),
 * their commits appear under separate logins. This module provides the
 * logic to merge multiple PersonSkillRecords into one combined record,
 * and to apply a set of merge rules to an entire AdvancedSkillMap.
 */

import type {
  AdvancedSkillMap,
  PersonSkillRecord,
  SkillDimension,
  ActivityPoint,
} from "./skill-taxonomy";

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

/** A persisted merge rule: "merge these logins into one person" */
export type PersonMergeRule = {
  id: string;
  org: string;
  /** The primary login — whose name/avatar/url is used for the merged person */
  primaryLogin: string;
  /** All logins that are merged (includes primaryLogin) */
  mergedLogins: string[];
  createdAt: string;
};

/* ------------------------------------------------------------------ */
/*  Skill merging helpers                                               */
/* ------------------------------------------------------------------ */

type SkillEntry = { name: string; score: number; commits: number; chunks: number };

/** Merge two arrays of SkillEntry by name, summing score/commits/chunks */
function mergeSkillArrays(
  a: SkillEntry[],
  b: SkillEntry[],
): SkillEntry[] {
  const map = new Map<string, SkillEntry>();
  for (const s of a) {
    map.set(s.name, { ...s });
  }
  for (const s of b) {
    const existing = map.get(s.name);
    if (existing) {
      existing.score += s.score;
      existing.commits += s.commits;
      existing.chunks += s.chunks;
    } else {
      map.set(s.name, { ...s });
    }
  }
  // Sort by score descending
  return Array.from(map.values()).sort((a, b) => b.score - a.score);
}

/** Merge two activity arrays by date, summing counts */
function mergeActivityArrays(a: ActivityPoint[], b: ActivityPoint[]): ActivityPoint[] {
  const map = new Map<string, number>();
  for (const p of a) map.set(p.date, p.count);
  for (const p of b) map.set(p.date, (map.get(p.date) || 0) + p.count);
  return Array.from(map.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Merge ownership arrays by repo, summing commits and averaging share */
function mergeOwnershipArrays(
  a: { repo: string; share: number; commits: number }[],
  b: { repo: string; share: number; commits: number }[],
): { repo: string; share: number; commits: number }[] {
  const map = new Map<string, { repo: string; share: number; commits: number }>();
  for (const o of a) map.set(o.repo, { ...o });
  for (const o of b) {
    const existing = map.get(o.repo);
    if (existing) {
      existing.commits += o.commits;
      existing.share = (existing.share + o.share) / 2; // average
    } else {
      map.set(o.repo, { ...o });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.commits - a.commits);
}

/** Merge allTags arrays, avoiding duplicates by (dimension, name, repo) key */
function mergeAllTags(
  a: (import("./skill-taxonomy").SkillTag & { repo: string; commits: number })[],
  b: (import("./skill-taxonomy").SkillTag & { repo: string; commits: number })[],
) {
  const seen = new Set<string>();
  const result: typeof a = [];
  for (const t of [...a, ...b]) {
    const key = `${t.dimension}:${t.name}:${t.repo}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(t);
    }
  }
  return result;
}

/* ------------------------------------------------------------------ */
/*  Core merge function                                                 */
/* ------------------------------------------------------------------ */

/** Merge multiple PersonSkillRecords into a single combined record.
 *  The primary person's name, avatar, and URL are used. */
export function mergePersonRecords(
  records: PersonSkillRecord[],
  primaryLogin: string,
): PersonSkillRecord {
  if (records.length === 0) throw new Error("No records to merge");
  if (records.length === 1) return records[0];

  // Find primary
  const primary = records.find((r) => r.login === primaryLogin) ?? records[0];

  let merged: PersonSkillRecord = { ...primary };

  for (let i = 0; i < records.length; i++) {
    const rec = records[i];
    if (rec.login === primaryLogin && i === 0) continue; // skip primary on first pass
    merged = {
      ...merged,
      totalCommits: merged.totalCommits + rec.totalCommits,
      totalChunks: merged.totalChunks + rec.totalChunks,
      repos: [...new Set([...merged.repos, ...rec.repos])],
      sectors: mergeSkillArrays(merged.sectors, rec.sectors),
      problemTypes: mergeSkillArrays(merged.problemTypes, rec.problemTypes),
      tech: mergeSkillArrays(merged.tech, rec.tech),
      methodologies: mergeSkillArrays(merged.methodologies, rec.methodologies),
      roles: mergeSkillArrays(merged.roles, rec.roles),
      allTags: mergeAllTags(merged.allTags, rec.allTags),
      ownership: mergeOwnershipArrays(merged.ownership, rec.ownership),
      activity: mergeActivityArrays(merged.activity, rec.activity),
      // Keep earliest/latest dates
      firstCommitDate: earliestDate(merged.firstCommitDate, rec.firstCommitDate),
      lastCommitDate: latestDate(merged.lastCommitDate, rec.lastCommitDate),
    };
  }

  // Store all merged logins in a special way — we add a `mergedLogins` field
  // that the UI can use to display "also known as"
  return merged;
}

function earliestDate(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a < b ? a : b;
}

function latestDate(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

/* ------------------------------------------------------------------ */
/*  Apply merge rules to entire skill map                               */
/* ------------------------------------------------------------------ */

/** Apply a set of merge rules to an AdvancedSkillMap, producing a new map
 *  with merged people. The original map is NOT mutated. */
export function applyMergeRules(
  skillMap: AdvancedSkillMap,
  rules: PersonMergeRule[],
): AdvancedSkillMap {
  if (rules.length === 0) return skillMap;

  // Build a lookup: login -> rule id
  const loginToRule = new Map<string, string>();
  for (const rule of rules) {
    for (const login of rule.mergedLogins) {
      loginToRule.set(login, rule.id);
    }
  }

  // Group people by rule id
  const ruleGroups = new Map<string, PersonSkillRecord[]>();
  const ungrouped: PersonSkillRecord[] = [];
  const processedRules = new Set<string>();

  for (const person of skillMap.people) {
    const ruleId = loginToRule.get(person.login);
    if (ruleId) {
      if (!ruleGroups.has(ruleId)) ruleGroups.set(ruleId, []);
      ruleGroups.get(ruleId)!.push(person);
      processedRules.add(ruleId);
    } else {
      ungrouped.push(person);
    }
  }

  // Merge each group
  const mergedPeople: PersonSkillRecord[] = [...ungrouped];
  for (const rule of rules) {
    const group = ruleGroups.get(rule.id);
    if (group && group.length > 0) {
      const merged = mergePersonRecords(group, rule.primaryLogin);
      // Attach the list of merged logins for UI display
      // We store this in a non-standard field using Object.assign
      Object.assign(merged, { mergedLogins: rule.mergedLogins });
      mergedPeople.push(merged);
    }
  }

  // Recalculate org-level stats (totalPeople changed, org rollups may change)
  const totalPeople = mergedPeople.length;
  const totalCommits = mergedPeople.reduce((s, p) => s + p.totalCommits, 0);
  const totalChunks = mergedPeople.reduce((s, p) => s + p.totalChunks, 0);

  // Recalculate org rollups
  const orgSectors = recalcOrgRollup(mergedPeople, "sectors");
  const orgProblemTypes = recalcOrgRollup(mergedPeople, "problemTypes");
  const orgTech = recalcOrgRollup(mergedPeople, "tech");
  const orgMethodologies = recalcOrgRollup(mergedPeople, "methodologies");
  const orgRoles = recalcOrgRollup(mergedPeople, "roles");

  return {
    ...skillMap,
    totalPeople,
    totalCommits,
    totalChunks,
    people: mergedPeople,
    orgSectors,
    orgProblemTypes,
    orgTech,
    orgMethodologies,
    orgRoles,
    activity: mergeActivityArrays(
      skillMap.activity,
      [], // no change to org-level activity
    ),
  };
}

type OrgRollupEntry = { name: string; score: number; people: number; commits: number };

function recalcOrgRollup(
  people: PersonSkillRecord[],
  dim: "sectors" | "problemTypes" | "tech" | "methodologies" | "roles",
): OrgRollupEntry[] {
  const map = new Map<string, { score: number; people: Set<string>; commits: number }>();
  for (const p of people) {
    const list = p[dim];
    for (const s of list) {
      const existing = map.get(s.name);
      if (existing) {
        existing.score += s.score;
        existing.people.add(p.login);
        existing.commits += s.commits;
      } else {
        map.set(s.name, { score: s.score, people: new Set([p.login]), commits: s.commits });
      }
    }
  }
  return Array.from(map.entries())
    .map(([name, data]) => ({ name, score: data.score, people: data.people.size, commits: data.commits }))
    .sort((a, b) => b.score - a.score);
}

/* ------------------------------------------------------------------ */
/*  Augmented type with merge info                                      */
/* ------------------------------------------------------------------ */

/** PersonSkillRecord with optional merge metadata */
export type MergedPersonSkillRecord = PersonSkillRecord & {
  mergedLogins?: string[];
};

/** Type guard to check if a person has merge info */
export function isMergedPerson(person: PersonSkillRecord): person is MergedPersonSkillRecord {
  return "mergedLogins" in person && Array.isArray((person as MergedPersonSkillRecord).mergedLogins);
}
