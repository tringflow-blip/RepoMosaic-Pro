"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Compass,
  Target,
  Wrench,
  Boxes,
  Shield,
  Users,
  GitCommitVertical,
  TrendingUp,
  Layers,
  Sparkles,
  Award,
  Link2,
  AlertTriangle,
  Grid3x3,
  ArrowRight,
  Radar,
  Flame,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdvancedSkillMap, SkillDimension, PersonSkillRecord } from "@/lib/analysis/skill-taxonomy";
import {
  SECTOR_SEEDS,
  PROBLEM_TYPE_SEEDS,
  TECH_SEEDS,
  METHODOLOGY_SEEDS,
  ROLE_SEEDS,
} from "@/lib/analysis/skill-taxonomy";

type Props = {
  skillMap: AdvancedSkillMap;
  /** Called when the user clicks a cell in the Person Similarity Matrix.
   *  Arguments are the two logins being compared. The parent should switch
   *  to the Skill Graph tab in compare mode with these two pre-selected. */
  onComparePair?: (loginA: string, loginB: string) => void;
};

export function AnalyticsPanel({ skillMap, onComparePair }: Props) {
  const topPeople = skillMap.people.slice(0, 8);

  return (
    <div className="space-y-4">
      {/* Summary stats strip */}
      <OrgSummaryStrip skillMap={skillMap} />

      <div className="grid gap-4 lg:grid-cols-2">
        <LeaderboardCard
          title="Top Sectors"
          icon={<Compass className="h-4 w-4 text-sector" />}
          accent="bg-sector"
          items={skillMap.orgSectors.slice(0, 12)}
        />
        <LeaderboardCard
          title="Top Problem Types"
          icon={<Target className="h-4 w-4 text-problem" />}
          accent="bg-problem"
          items={skillMap.orgProblemTypes.slice(0, 12)}
        />
        <LeaderboardCard
          title="Top Tech"
          icon={<Wrench className="h-4 w-4 text-tech" />}
          accent="bg-tech"
          items={skillMap.orgTech.slice(0, 15)}
        />
        <LeaderboardCard
          title="Top Methodologies"
          icon={<Boxes className="h-4 w-4 text-methodology" />}
          accent="bg-methodology"
          items={skillMap.orgMethodologies.slice(0, 12)}
        />
        <LeaderboardCard
          title="Top Roles"
          icon={<Shield className="h-4 w-4 text-role" />}
          accent="bg-role"
          items={skillMap.orgRoles.slice(0, 10)}
        />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-people" /> Top Contributors
            </CardTitle>
            <CardDescription className="text-[11px]">
              By total commits scanned
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
            {topPeople.map((p, i) => (
              <div key={p.login} className="flex items-center gap-3">
                <span className="font-mono text-[10px] text-muted-foreground w-4">{i + 1}</span>
                <Avatar className="h-7 w-7">
                  <AvatarImage src={p.avatarUrl} />
                  <AvatarFallback>{p.login[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{p.name || p.login}</div>
                  <div className="text-[10px] text-muted-foreground flex items-center gap-2">
                    <span className="flex items-center gap-0.5">
                      <GitCommitVertical className="h-2.5 w-2.5" />
                      {p.totalCommits}
                    </span>
                    <span>· {p.repos.length} repos</span>
                    <span>· {p.totalChunks} chunks</span>
                  </div>
                </div>
                {p.sectors[0] && (
                  <Badge variant="outline" className="text-[10px] border-sector/30 text-sector">
                    {p.sectors[0].name}
                  </Badge>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Team skill radar chart — overlays all people on 5 axes */}
      <TeamRadarChart skillMap={skillMap} />

      {/* Skill co-occurrence */}
      <SkillCoOccurrenceCard skillMap={skillMap} />

      {/* Skill coverage matrix — heatmap of people × top skills */}
      <SkillCoverageMatrix skillMap={skillMap} />

      {/* Person-to-Person similarity matrix */}
      <PersonSimilarityMatrix skillMap={skillMap} onComparePair={onComparePair} />

      {/* Skill gap analysis — what's missing from the team */}
      <SkillGapAnalysisCard skillMap={skillMap} />
    </div>
  );
}

/** Compact strip of headline stats at the top of the Analytics tab. */
function OrgSummaryStrip({ skillMap }: { skillMap: AdvancedSkillMap }) {
  const totalUniqueSkills =
    skillMap.orgSectors.length +
    skillMap.orgProblemTypes.length +
    skillMap.orgTech.length +
    skillMap.orgMethodologies.length +
    skillMap.orgRoles.length;

  const avgCommitsPerPerson = skillMap.totalPeople > 0
    ? Math.round(skillMap.totalCommits / skillMap.totalPeople)
    : 0;
  const avgChunksPerPerson = skillMap.totalPeople > 0
    ? Math.round(skillMap.totalChunks / skillMap.totalPeople)
    : 0;

  // Most diverse person (most unique skills across all dimensions)
  const mostDiverse = skillMap.people
    .map((p) => ({
      login: p.login,
      name: p.name || p.login,
      avatarUrl: p.avatarUrl,
      unique: p.sectors.length + p.problemTypes.length + p.tech.length + p.methodologies.length + p.roles.length,
      sectors: p.sectors.length,
    }))
    .sort((a, b) => b.unique - a.unique)[0];

  // Most common sector
  const topSector = skillMap.orgSectors[0];

  const stats = [
    {
      icon: <Users className="h-4 w-4 text-people" />,
      label: "People",
      value: skillMap.totalPeople,
      sub: `${skillMap.totalRepos} repos scanned`,
    },
    {
      icon: <GitCommitVertical className="h-4 w-4 text-muted-foreground" />,
      label: "Commits",
      value: skillMap.totalCommits,
      sub: `${avgCommitsPerPerson} avg / person`,
    },
    {
      icon: <Layers className="h-4 w-4 text-primary" />,
      label: "LLM chunks",
      value: skillMap.totalChunks,
      sub: `${avgChunksPerPerson} avg / person`,
    },
    {
      icon: <Sparkles className="h-4 w-4 text-sector" />,
      label: "Unique skills",
      value: totalUniqueSkills,
      sub: "across 5 dimensions",
    },
    {
      icon: <Award className="h-4 w-4 text-sector" />,
      label: "Most diverse",
      value: mostDiverse?.name ?? "—",
      sub: mostDiverse ? `${mostDiverse.unique} skills · ${mostDiverse.sectors} sectors` : "no data",
      isText: true,
    },
    {
      icon: <Compass className="h-4 w-4 text-sector" />,
      label: "Top sector",
      value: topSector?.name ?? "—",
      sub: topSector ? `${topSector.people}p · ${topSector.commits}c` : "no data",
      isText: true,
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {stats.map((s, i) => (
        <Card key={s.label} className="overflow-hidden relative group">
          <div className={cn("absolute inset-x-0 top-0 h-0.5", getAccentForLabel(s.label))} />
          <CardContent className="p-3 pt-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
              {s.icon}
              {s.label}
            </div>
            <div
              className={cn(
                "font-mono font-semibold truncate transition-transform group-hover:-translate-y-0.5",
                s.isText ? "text-sm" : "text-xl tabular-nums"
              )}
              title={String(s.value)}
            >
              {s.value}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5 truncate" title={s.sub}>{s.sub}</div>
            {i === 0 && skillMap.totalPeople > 0 && (
              <div className="mt-1.5 flex -space-x-1.5">
                {skillMap.people.slice(0, 5).map((p) => (
                  <Avatar key={p.login} className="h-4 w-4 border border-card rounded-full">
                    <AvatarImage src={p.avatarUrl} />
                    <AvatarFallback className="text-[7px]">{p.login[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                ))}
                {skillMap.people.length > 5 && (
                  <span className="h-4 w-4 rounded-full bg-muted border border-card flex items-center justify-center text-[7px] font-mono">
                    +{skillMap.people.length - 5}
                  </span>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function getAccentForLabel(label: string): string {
  if (/people/i.test(label)) return "bg-people";
  if (/commits/i.test(label)) return "bg-muted-foreground/40";
  if (/chunks/i.test(label)) return "bg-primary";
  if (/skills/i.test(label)) return "bg-sector";
  if (/diverse/i.test(label)) return "bg-sector";
  if (/sector/i.test(label)) return "bg-sector";
  return "bg-primary";
}

/** Compute and display which skills tend to co-occur in the same chunks.
 *  Uses the per-person `allTags` flat list — any two tags that appear for the
 *  same person+repo are considered co-occurring. */
function SkillCoOccurrenceCard({ skillMap }: { skillMap: AdvancedSkillMap }) {
  const pairs = useMemo(() => {
    // Group all tags by (person, repo) to find co-occurrences
    const byKey = new Map<string, { name: string; dimension: SkillDimension }[]>();
    for (const p of skillMap.people) {
      for (const t of p.allTags) {
        const key = `${p.login}::${t.repo}`;
        if (!byKey.has(key)) byKey.set(key, []);
        byKey.get(key)!.push({ name: t.name, dimension: t.dimension });
      }
    }

    // Count pairs (only across different dimensions to avoid trivial self-pairs)
    const pairCounts = new Map<string, { a: string; b: string; count: number }>();
    for (const tags of byKey.values()) {
      const unique = Array.from(new Set(tags.map((t) => t.name)));
      for (let i = 0; i < unique.length; i++) {
        for (let j = i + 1; j < unique.length; j++) {
          const [a, b] = [unique[i], unique[j]].sort();
          const key = `${a}||${b}`;
          if (!pairCounts.has(key)) {
            pairCounts.set(key, { a, b, count: 0 });
          }
          pairCounts.get(key)!.count++;
        }
      }
    }

    return Array.from(pairCounts.values())
      .filter((p) => p.count >= 2)
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
  }, [skillMap]);

  if (pairs.length === 0) return null;

  const maxCount = Math.max(1, ...pairs.map((p) => p.count));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Link2 className="h-4 w-4 text-primary" />
          Skill Co-occurrence
        </CardTitle>
        <CardDescription className="text-[11px] flex items-center gap-1">
          <TrendingUp className="h-3 w-3" />
          Skills that frequently appear together in the same person's work — reveals tech-stack clusters and cross-cutting capabilities
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-1.5 max-h-[320px] overflow-y-auto pr-1">
        {pairs.map((p, i) => (
          <div key={`${p.a}-${p.b}`} className="flex items-center gap-3 text-[11px]">
            <span className="font-mono text-muted-foreground w-5">{i + 1}</span>
            <div className="flex-1 min-w-0 flex items-center gap-1.5">
              <span className="font-medium truncate">{p.a}</span>
              <Link2 className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
              <span className="font-medium truncate">{p.b}</span>
            </div>
            <span className="text-muted-foreground font-mono text-[10px] whitespace-nowrap">
              {p.count}× co-occur
            </span>
            <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden shrink-0">
              <div
                className="h-full bg-primary"
                style={{ width: `${(p.count / maxCount) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function LeaderboardCard({
  title,
  icon,
  accent,
  items,
}: {
  title: string;
  icon: React.ReactNode;
  accent: string;
  items: { name: string; score: number; commits: number; people: number }[];
}) {
  const max = Math.max(1, ...items.map((i) => i.commits));
  const totalCommits = items.reduce((sum, i) => sum + i.commits, 0);
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}
          {title}
        </CardTitle>
        <CardDescription className="text-[11px] flex items-center gap-1">
          <TrendingUp className="h-3 w-3" /> {items.length} tags · {totalCommits} total commits
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-1.5 max-h-[280px] overflow-y-auto pr-1">
        {items.length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-4">No tags yet.</div>
        )}
        {items.map((item, i) => {
          const pctOfMax = (item.commits / max) * 100;
          const pctOfTotal = totalCommits > 0 ? (item.commits / totalCommits) * 100 : 0;
          return (
            <div
              key={item.name}
              className="group flex items-center gap-2 text-[11px] py-1 px-1 rounded hover:bg-muted/40 -mx-1 transition-colors"
            >
              <span className="font-mono text-muted-foreground w-4 text-right tabular-nums">{i + 1}</span>
              <span className="font-medium flex-1 truncate" title={item.name}>
                {item.name}
              </span>
              <span className="text-muted-foreground font-mono text-[10px] whitespace-nowrap tabular-nums">
                {item.people}p · {item.commits}c
              </span>
              <span className="text-muted-foreground/80 font-mono text-[9px] w-9 text-right tabular-nums">
                {pctOfTotal.toFixed(0)}%
              </span>
              <div className="w-20 h-2 rounded-full bg-muted overflow-hidden shrink-0 relative">
                <div
                  className={cn("h-full transition-all group-hover:brightness-110", accent)}
                  style={{ width: `${pctOfMax}%` }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

/** Interactive heatmap of people × top skills across a chosen dimension.
 *  Each cell shows commit volume for that (person, skill) pair, with color
 *  intensity scaled to the max in the matrix. Clicking a row/column header
 *  pins it for closer inspection. */
function SkillCoverageMatrix({ skillMap }: { skillMap: AdvancedSkillMap }) {
  const [dimension, setDimension] = useState<SkillDimension>("sector");
  const [pinnedSkill, setPinnedSkill] = useState<string | null>(null);

  const { people, skills, matrix, maxCell } = useMemo(() => {
    // Pick the right org-wide list for the active dimension
    const orgList =
      dimension === "sector" ? skillMap.orgSectors :
      dimension === "problemType" ? skillMap.orgProblemTypes :
      dimension === "tech" ? skillMap.orgTech :
      dimension === "methodology" ? skillMap.orgMethodologies : skillMap.orgRoles;

    const skills = orgList.slice(0, 12).map((s) => s.name);

    // Build matrix[personIndex][skillIndex] = commit count
    const people = skillMap.people.slice(0, 12);
    const matrix: number[][] = people.map((p) => {
      const list =
        dimension === "sector" ? p.sectors :
        dimension === "problemType" ? p.problemTypes :
        dimension === "tech" ? p.tech :
        dimension === "methodology" ? p.methodologies : p.roles;
      const lookup = new Map(list.map((s) => [s.name, s.commits]));
      return skills.map((sk) => lookup.get(sk) ?? 0);
    });

    const maxCell = Math.max(1, ...matrix.flat());
    return { people, skills, matrix, maxCell };
  }, [skillMap, dimension]);

  if (people.length === 0 || skills.length === 0) return null;

  const accentVar =
    dimension === "sector" ? "var(--sector)" :
    dimension === "problemType" ? "var(--problem)" :
    dimension === "tech" ? "var(--tech)" :
    dimension === "methodology" ? "var(--methodology)" : "var(--role)";

  const dimLabel =
    dimension === "problemType" ? "Problem Types" : `${dimension.charAt(0).toUpperCase() + dimension.slice(1)}s`;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers className="h-4 w-4 text-primary" />
              Skill Coverage Matrix
            </CardTitle>
            <CardDescription className="text-[11px] flex items-center gap-1 mt-1">
              <TrendingUp className="h-3 w-3" />
              Heatmap of {people.length} top contributors × top {skills.length} {dimLabel.toLowerCase()} · darker = more commits
            </CardDescription>
          </div>
          <Tabs value={dimension} onValueChange={(v) => { setDimension(v as SkillDimension); setPinnedSkill(null); }}>
            <TabsList className="h-8">
              {([
                { k: "sector", l: "Sector" },
                { k: "problemType", l: "Problem" },
                { k: "tech", l: "Tech" },
                { k: "methodology", l: "Method" },
                { k: "role", l: "Role" },
              ] as { k: SkillDimension; l: string }[]).map((d) => (
                <TabsTrigger key={d.k} value={d.k} className="text-[10px] px-2 h-7">
                  {d.l}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-1">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-card p-1.5 text-left text-[10px] font-medium text-muted-foreground min-w-[120px]">
                Person
              </th>
              {skills.map((s) => (
                <th
                  key={s}
                  className={cn(
                    "p-1.5 text-[9px] font-medium cursor-pointer transition-colors rounded select-none",
                    pinnedSkill === s ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => setPinnedSkill(pinnedSkill === s ? null : s)}
                  title={`Click to pin ${s}`}
                >
                  <div className="writing-vertical-rl rotate-180 truncate max-h-[80px] mx-auto" style={{ writingMode: "vertical-rl" }}>
                    {s}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {people.map((p, ri) => (
              <tr key={p.login}>
                <td className="sticky left-0 z-10 bg-card p-1.5 text-[10px] font-medium whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    <Avatar className="h-5 w-5 shrink-0">
                      <AvatarImage src={p.avatarUrl} />
                      <AvatarFallback className="text-[8px]">{p.login[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="truncate max-w-[100px]" title={p.name || p.login}>{p.name || p.login}</span>
                  </div>
                </td>
                {skills.map((s, ci) => {
                  const v = matrix[ri][ci];
                  const intensity = v / maxCell;
                  const isPinned = pinnedSkill === s;
                  return (
                    <td
                      key={s}
                      className={cn(
                        "p-0 text-center align-middle transition-all",
                        isPinned && "ring-2 ring-primary/40 ring-offset-1 ring-offset-card rounded"
                      )}
                      title={`${p.name || p.login} · ${s}: ${v} commits`}
                    >
                      <div
                        className="h-9 min-w-[36px] rounded flex items-center justify-center text-[10px] font-mono font-semibold tabular-nums cursor-pointer hover:scale-105 transition-transform"
                        style={{
                          backgroundColor: v === 0
                            ? "var(--muted)"
                            : `color-mix(in oklch, ${accentVar} ${15 + intensity * 70}%, var(--card))`,
                          color: v === 0
                            ? "transparent"
                            : intensity > 0.5
                              ? "oklch(0.99 0 0)"
                              : "var(--foreground)",
                        }}
                      >
                        {v === 0 ? "·" : v}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span>Low</span>
            <div className="flex">
              {[0.1, 0.3, 0.5, 0.7, 0.9].map((i) => (
                <div
                  key={i}
                  className="h-3 w-5"
                  style={{ backgroundColor: `color-mix(in oklch, ${accentVar} ${15 + i * 70}%, var(--card))` }}
                />
              ))}
            </div>
            <span>High · {maxCell}c max</span>
          </div>
          {pinnedSkill && (
            <button
              type="button"
              onClick={() => setPinnedSkill(null)}
              className="hover:text-foreground transition-colors"
            >
              Clear pin ({pinnedSkill}) ×
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/** Person-to-Person similarity matrix — NxN grid of overall Jaccard similarity.
 *  Helps spot skill-cluster overlaps at a glance. Hover a cell to see exact %,
 *  click an off-diagonal cell to open the Skill Graph in compare mode with
 *  that pair pre-selected (requires onComparePair). */
function PersonSimilarityMatrix({
  skillMap,
  onComparePair,
}: {
  skillMap: AdvancedSkillMap;
  onComparePair?: (loginA: string, loginB: string) => void;
}) {
  const people = skillMap.people.slice(0, 10);
  const [hovered, setHovered] = useState<{ i: number; j: number } | null>(null);

  // Precompute Jaccard for every pair
  const matrix = useMemo(() => {
    const dimLists = (p: PersonSkillRecord) => [
      ...p.sectors, ...p.problemTypes, ...p.tech, ...p.methodologies, ...p.roles,
    ].map((s) => s.name);
    const nameSets = people.map((p) => new Set(dimLists(p)));
    return people.map((_, i) =>
      people.map((_, j) => {
        if (i === j) return { jaccard: 1, shared: nameSets[i].size, union: nameSets[i].size };
        const a = nameSets[i];
        const b = nameSets[j];
        let shared = 0;
        for (const n of a) if (b.has(n)) shared++;
        const union = a.size + b.size - shared;
        return { jaccard: union > 0 ? shared / union : 0, shared, union };
      })
    );
  }, [people]);

  if (people.length < 2) return null;

  const cellColor = (j: number) => {
    if (j >= 0.7) return "oklch(0.70 0.13 145)";
    if (j >= 0.4) return "oklch(0.75 0.10 145)";
    if (j >= 0.2) return "oklch(0.82 0.06 95)";
    if (j > 0) return "oklch(0.80 0.07 50)";
    return "var(--muted)";
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Grid3x3 className="h-4 w-4 text-primary" />
              Person Similarity Matrix
            </CardTitle>
            <CardDescription className="text-[11px] flex items-center gap-1 mt-1">
              <TrendingUp className="h-3 w-3" />
              Jaccard similarity across all 5 dimensions · darker green = more overlap · {people.length}×{people.length} grid
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="border-separate border-spacing-1 mx-auto">
          <thead>
            <tr>
              <th className="p-1.5"></th>
              {people.map((p, j) => (
                <th key={p.login} className="p-1 text-[9px] font-medium text-muted-foreground align-bottom">
                  <div className="writing-vertical-rl rotate-180 mx-auto max-h-[70px] truncate" style={{ writingMode: "vertical-rl" }} title={p.name || p.login}>
                    {p.name || p.login}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {people.map((p, i) => (
              <tr key={p.login}>
                <td className="p-1 text-[10px] font-medium text-right whitespace-nowrap pr-2 max-w-[110px]">
                  <div className="flex items-center gap-1.5 justify-end">
                    <span className="truncate max-w-[90px]" title={p.name || p.login}>{p.name || p.login}</span>
                    <Avatar className="h-4 w-4 shrink-0">
                      <AvatarImage src={p.avatarUrl} />
                      <AvatarFallback className="text-[7px]">{p.login[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                  </div>
                </td>
                {people.map((_, j) => {
                  const v = matrix[i][j];
                  const isDiag = i === j;
                  const isHovered = hovered?.i === i && hovered?.j === j;
                  const canClick = !isDiag && onComparePair;
                  return (
                    <td
                      key={j}
                      className="p-0 text-center align-middle"
                      onMouseEnter={() => setHovered({ i, j })}
                      onMouseLeave={() => setHovered(null)}
                      title={isDiag
                        ? `${p.name || p.login} (self)`
                        : `${p.name || p.login} vs ${people[j].name || people[j].login}: ${(v.jaccard * 100).toFixed(0)}% (${v.shared}/${v.union} shared)${canClick ? " · click to compare" : ""}`}
                    >
                      <button
                        type="button"
                        disabled={!canClick}
                        onClick={() => {
                          if (canClick) onComparePair(p.login, people[j].login);
                        }}
                        className={cn(
                          "h-9 w-9 rounded flex items-center justify-center text-[10px] font-mono font-semibold tabular-nums transition-all",
                          isDiag
                            ? "ring-1 ring-inset ring-border cursor-default"
                            : canClick
                              ? "cursor-pointer hover:ring-2 hover:ring-primary/60 hover:scale-110"
                              : "cursor-default",
                          isHovered && !isDiag && "ring-2 ring-primary/60 scale-110"
                        )}
                        style={{
                          backgroundColor: cellColor(v.jaccard),
                          color: v.jaccard >= 0.4 ? "oklch(0.20 0 0)" : "var(--foreground)",
                        }}
                      >
                        {isDiag ? "—" : Math.round(v.jaccard * 100)}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-3 flex items-center justify-center gap-3 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span>Low</span>
            <div className="flex gap-0.5">
              {[0, 0.1, 0.25, 0.5, 0.75].map((i) => (
                <div key={i} className="h-3 w-5 rounded-sm" style={{ backgroundColor: cellColor(i) }} />
              ))}
            </div>
            <span>High</span>
          </div>
          <span className="text-[10px] text-muted-foreground/70">·</span>
          <span>{onComparePair ? "Click a cell to compare · " : ""}Hover for details · diagonal = self</span>
        </div>
      </CardContent>
    </Card>
  );
}

/** Skill Gap Analysis — compares the team's actual skills to the seed taxonomy
 *  and highlights the seeds that NO person has. Useful for spotting "what's
 *  missing" when planning hires or training. */
function SkillGapAnalysisCard({ skillMap }: { skillMap: AdvancedSkillMap }) {
  const [dimension, setDimension] = useState<SkillDimension>("role");

  const { present, missing } = useMemo(() => {
    const seeds =
      dimension === "sector" ? SECTOR_SEEDS :
      dimension === "problemType" ? PROBLEM_TYPE_SEEDS :
      dimension === "tech" ? TECH_SEEDS :
      dimension === "methodology" ? METHODOLOGY_SEEDS : ROLE_SEEDS;

    const orgList =
      dimension === "sector" ? skillMap.orgSectors :
      dimension === "problemType" ? skillMap.orgProblemTypes :
      dimension === "tech" ? skillMap.orgTech :
      dimension === "methodology" ? skillMap.orgMethodologies : skillMap.orgRoles;

    // Build a normalized set of present names so "React" matches "react"
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const presentNames = new Set(orgList.map((s) => normalize(s.name)));
    const present = seeds.filter((s) => presentNames.has(normalize(s)));
    const missing = seeds.filter((s) => !presentNames.has(normalize(s)));
    return { present, missing };
  }, [skillMap, dimension]);

  const accentVar =
    dimension === "sector" ? "var(--sector)" :
    dimension === "problemType" ? "var(--problem)" :
    dimension === "tech" ? "var(--tech)" :
    dimension === "methodology" ? "var(--methodology)" : "var(--role)";

  const dimLabel =
    dimension === "problemType" ? "Problem Types" : `${dimension.charAt(0).toUpperCase() + dimension.slice(1)}s`;

  // Map a few seeds to human-friendly descriptions of what they enable
  const seedDescription: Record<string, string> = {
    "Testing & QA": "Test coverage, regression safety",
    "CI/CD & Release Engineering": "Automated build / ship pipelines",
    "Observability & Monitoring": "Logs, metrics, traces, alerting",
    "Infrastructure as Code": "Reproducible infra provisioning",
    "Accessibility": "a11y for users with disabilities",
    "Internationalization": "Multi-language / locale support",
    "Encryption & Crypto": "Data protection at rest / in transit",
    "Compliance & Audit": "SOC2 / GDPR / HIPAA controls",
    "Vector Search & RAG": "Semantic retrieval for LLMs",
    "LLM Orchestration": "Multi-step LLM workflows",
    "Microservices": "Decomposed service architecture",
    "Domain-Driven Design": "Bounded contexts, ubiquitous language",
    "Test-Driven Development": "Red-green-refactor loop",
    "Pair Programming": "Two-mind knowledge transfer",
    "Documentation": "Guides, API references, ADRs",
    "Mentoring": "Leveling up junior engineers",
    "Performance Optimization": "Latency, throughput, profiling",
    "Security Hardening": "Threat modeling, vuln remediation",
  };

  // Severity classification for missing seeds — helps prioritize hiring/training.
  // Critical = security/reliability/compliance gaps that pose real risk.
  // Important = foundational engineering practices the team likely needs.
  // Nice-to-have = specialized skills that depend on the product direction.
  const CRITICAL_SEEDS = new Set([
    "Testing & QA",
    "Security Hardening",
    "Encryption & Crypto",
    "Compliance & Audit",
    "Observability & Monitoring",
    "Authentication & Identity",
    "Authorization & Access Control",
  ]);
  const IMPORTANT_SEEDS = new Set([
    "CI/CD & Release Engineering",
    "Infrastructure as Code",
    "Architecture",
    "API Design",
    "Release Management",
    "Documentation",
    "Code Review",
    "Mentoring",
    "Test-Driven Development",
    "Domain-Driven Design",
    "Performance Optimization",
    "Internationalization",
    "Accessibility",
  ]);
  const severityFor = (seed: string): "critical" | "important" | "nice" => {
    if (CRITICAL_SEEDS.has(seed)) return "critical";
    if (IMPORTANT_SEEDS.has(seed)) return "important";
    return "nice";
  };
  const severityMeta = {
    critical: {
      label: "Critical",
      icon: <Flame className="h-2.5 w-2.5" />,
      className: "border-problem/40 bg-problem/10 text-problem",
      dot: "bg-problem",
    },
    important: {
      label: "Important",
      icon: <AlertTriangle className="h-2.5 w-2.5" />,
      className: "border-sector/40 bg-sector/10 text-sector",
      dot: "bg-sector",
    },
    nice: {
      label: "Nice-to-have",
      icon: <Info className="h-2.5 w-2.5" />,
      className: "border-role/30 bg-role/5 text-role",
      dot: "bg-role",
    },
  } as const;

  // Sort missing seeds by severity (critical first, then important, then nice)
  const sevOrder = { critical: 0, important: 1, nice: 2 } as const;
  const sortedMissing = [...missing].sort((a, b) => {
    const sa = severityFor(a);
    const sb = severityFor(b);
    if (sevOrder[sa] !== sevOrder[sb]) return sevOrder[sa] - sevOrder[sb];
    return a.localeCompare(b);
  });

  // Count by severity
  const sevCounts = {
    critical: missing.filter((s) => severityFor(s) === "critical").length,
    important: missing.filter((s) => severityFor(s) === "important").length,
    nice: missing.filter((s) => severityFor(s) === "nice").length,
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-sector" />
              Skill Gap Analysis
            </CardTitle>
            <CardDescription className="text-[11px] flex items-center gap-1 mt-1">
              <ArrowRight className="h-3 w-3" />
              Seed taxonomy items the team has NOT touched · {missing.length} of {present.length + missing.length} {dimLabel.toLowerCase()} missing
            </CardDescription>
          </div>
          <Tabs value={dimension} onValueChange={(v) => setDimension(v as SkillDimension)}>
            <TabsList className="h-8">
              {([
                { k: "sector", l: "Sector" },
                { k: "problemType", l: "Problem" },
                { k: "tech", l: "Tech" },
                { k: "methodology", l: "Method" },
                { k: "role", l: "Role" },
              ] as { k: SkillDimension; l: string }[]).map((d) => (
                <TabsTrigger key={d.k} value={d.k} className="text-[10px] px-2 h-7">
                  {d.l}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        {missing.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-8">
            <Sparkles className="h-6 w-6 mx-auto mb-2 text-tech" />
            <div className="font-medium text-foreground">No gaps detected</div>
            <div className="text-[11px] mt-1">Every seed {dimLabel.toLowerCase()} appears in at least one commit.</div>
          </div>
        ) : (
          <>
            {/* Severity legend / summary chips */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground mr-1">
                Severity:
              </span>
              {(["critical", "important", "nice"] as const).map((sev) => {
                const m = severityMeta[sev];
                const count = sevCounts[sev];
                if (count === 0) return null;
                return (
                  <span
                    key={sev}
                    className={cn(
                      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium",
                      m.className
                    )}
                  >
                    {m.icon}
                    {m.label}
                    <span className="font-mono tabular-nums opacity-70">· {count}</span>
                  </span>
                );
              })}
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {sortedMissing.map((s) => {
                const sev = severityFor(s);
                const m = severityMeta[sev];
                return (
                  <div
                    key={s}
                    className={cn(
                      "group flex items-start gap-2 p-3 rounded-md border transition-all hover:scale-[1.01]",
                      m.className
                    )}
                    title={`${s} — ${m.label}`}
                  >
                    <div
                      className={cn("mt-1 h-1.5 w-1.5 rounded-full shrink-0", m.dot)}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="text-xs font-medium truncate" title={s}>{s}</div>
                        <span className="inline-flex items-center gap-0.5 text-[9px] uppercase tracking-wide opacity-70 shrink-0">
                          {m.icon}
                          {m.label}
                        </span>
                      </div>
                      {seedDescription[s] && (
                        <div className="text-[10px] opacity-80 mt-1 line-clamp-2">{seedDescription[s]}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Coverage summary bar */}
        <div className="mt-4 pt-3 border-t">
          <div className="flex items-center justify-between text-[11px] mb-1.5">
            <span className="text-muted-foreground">Seed coverage</span>
            <span className="font-mono font-semibold tabular-nums">
              {present.length}/{present.length + missing.length}
              <span className="text-muted-foreground ml-1">
                · {Math.round((present.length / Math.max(1, present.length + missing.length)) * 100)}%
              </span>
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full transition-all"
              style={{
                width: `${(present.length / Math.max(1, present.length + missing.length)) * 100}%`,
                backgroundColor: accentVar,
              }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** Team Skill Radar Chart — overlays every person (up to 6) on 5 normalized
 *  axes (one per skill dimension) so you can see at a glance who covers what.
 *  Each axis is scaled 0..100 = (person's commit count in that dimension) /
 *  (max commit count across all people in that dimension) × 100. This rewards
 *  both breadth (many skills) and depth (many commits) without letting one
 *  person's huge commit count squash everyone else to 0.
 *
 *  Click a person in the legend to toggle their polygon on/off. */
function TeamRadarChart({ skillMap }: { skillMap: AdvancedSkillMap }) {
  const people = skillMap.people.slice(0, 6);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  // Distinct color per person — uses oklch hue rotation for accessibility
  const personColors = useMemo(() => {
    const palette = [
      "oklch(0.62 0.16 35)",    // orange
      "oklch(0.62 0.14 145)",   // green
      "oklch(0.62 0.16 250)",   // blue (avoid as primary; OK for distinct viz)
      "oklch(0.62 0.16 305)",   // magenta
      "oklch(0.65 0.13 90)",    // yellow
      "oklch(0.60 0.13 195)",   // teal
    ];
    return new Map(people.map((p, i) => [p.login, palette[i % palette.length]]));
  }, [people]);

  // Compute per-person score per dimension: total commits across all skills
  // in that dimension. Then normalize 0..100 against the max across people.
  const { scores } = useMemo(() => {
    const dimKeys: { key: SkillDimension; field: "sectors" | "problemTypes" | "tech" | "methodologies" | "roles" }[] = [
      { key: "sector", field: "sectors" },
      { key: "problemType", field: "problemTypes" },
      { key: "tech", field: "tech" },
      { key: "methodology", field: "methodologies" },
      { key: "role", field: "roles" },
    ];
    const rawByDim: Record<SkillDimension, number[]> = {
      sector: [],
      problemType: [],
      tech: [],
      methodology: [],
      role: [],
    };
    for (const p of people) {
      for (const { key, field } of dimKeys) {
        const sum = p[field].reduce((acc, s) => acc + s.commits, 0);
        rawByDim[key].push(sum);
      }
    }
    const maxByDim: Record<SkillDimension, number> = {
      sector: Math.max(1, ...rawByDim.sector),
      problemType: Math.max(1, ...rawByDim.problemType),
      tech: Math.max(1, ...rawByDim.tech),
      methodology: Math.max(1, ...rawByDim.methodology),
      role: Math.max(1, ...rawByDim.role),
    };
    const scores = people.map((p, personIdx) => {
      const byDim: Record<SkillDimension, number> = {
        sector: 0, problemType: 0, tech: 0, methodology: 0, role: 0,
      };
      dimKeys.forEach(({ key }) => {
        byDim[key] = Math.round((rawByDim[key][personIdx] / maxByDim[key]) * 100);
      });
      return byDim;
    });
    return { scores };
  }, [people]);

  if (people.length < 2) return null;

  // SVG geometry
  const size = 320;
  const cx = size / 2;
  const cy = size / 2;
  const r = 110; // max radius
  const dims: { key: SkillDimension; label: string; color: string }[] = [
    { key: "sector", label: "Sectors", color: "var(--sector)" },
    { key: "problemType", label: "Problem Types", color: "var(--problem)" },
    { key: "tech", label: "Tech", color: "var(--tech)" },
    { key: "methodology", label: "Methodology", color: "var(--methodology)" },
    { key: "role", label: "Roles", color: "var(--role)" },
  ];
  const n = dims.length;
  const angleFor = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2; // start at top
  const pointFor = (i: number, ratio: number) => ({
    x: cx + Math.cos(angleFor(i)) * r * ratio,
    y: cy + Math.sin(angleFor(i)) * r * ratio,
  });

  // Build polygon points for a person
  const polygonFor = (personScores: Record<SkillDimension, number>) => {
    return dims.map((d, i) => {
      const ratio = Math.max(0, Math.min(1, personScores[d.key] / 100));
      const p = pointFor(i, ratio);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    }).join(" ");
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Radar className="h-4 w-4 text-primary" />
              Team Skill Radar
            </CardTitle>
            <CardDescription className="text-[11px] flex items-center gap-1 mt-1">
              <TrendingUp className="h-3 w-3" />
              Per-person coverage across 5 dimensions (0–100 = % of team max) · toggle a person to isolate
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col lg:flex-row items-center gap-6">
          {/* SVG radar */}
          <div className="relative shrink-0">
            <svg
              width={size}
              height={size}
              viewBox={`0 0 ${size} ${size}`}
              className="max-w-full"
              role="img"
              aria-label="Team skill radar chart"
            >
              {/* Concentric grid pentagons at 25/50/75/100% */}
              {[0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                const pts = dims.map((_, i) => {
                  const p = pointFor(i, ratio);
                  return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
                }).join(" ");
                return (
                  <polygon
                    key={idx}
                    points={pts}
                    fill="none"
                    stroke="var(--border)"
                    strokeWidth={1}
                    strokeDasharray={ratio === 1 ? "0" : "2 3"}
                    opacity={0.7}
                  />
                );
              })}

              {/* Axis lines + labels */}
              {dims.map((d, i) => {
                const p = pointFor(i, 1);
                const labelOffset = 18;
                const lp = pointFor(i, (r + labelOffset) / r);
                return (
                  <g key={d.key}>
                    <line
                      x1={cx}
                      y1={cy}
                      x2={p.x}
                      y2={p.y}
                      stroke="var(--border)"
                      strokeWidth={1}
                      opacity={0.6}
                    />
                    <text
                      x={lp.x}
                      y={lp.y}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="fill-current text-[10px] font-semibold"
                      style={{ fill: d.color }}
                    >
                      {d.label}
                    </text>
                  </g>
                );
              })}

              {/* Per-person polygons */}
              {people.map((p, idx) => {
                if (hidden.has(p.login)) return null;
                const color = personColors.get(p.login)!;
                const points = polygonFor(scores[idx]);
                return (
                  <g key={p.login}>
                    <polygon
                      points={points}
                      fill={color}
                      fillOpacity={0.12}
                      stroke={color}
                      strokeWidth={1.8}
                      strokeLinejoin="round"
                    />
                    {/* Vertex dots */}
                    {dims.map((d, i) => {
                      const ratio = Math.max(0, Math.min(1, scores[idx][d.key] / 100));
                      const pt = pointFor(i, ratio);
                      return (
                        <circle
                          key={d.key}
                          cx={pt.x}
                          cy={pt.y}
                          r={2.5}
                          fill={color}
                          stroke="var(--background)"
                          strokeWidth={1}
                        />
                      );
                    })}
                  </g>
                );
              })}

              {/* Center dot */}
              <circle cx={cx} cy={cy} r={1.5} fill="var(--muted-foreground)" opacity={0.5} />
            </svg>
          </div>

          {/* Legend + per-person scores */}
          <div className="flex-1 w-full space-y-2 max-h-[320px] overflow-y-auto pr-1">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
              People ({people.length})
            </div>
            {people.map((p, idx) => {
              const isHidden = hidden.has(p.login);
              const color = personColors.get(p.login)!;
              return (
                <button
                  key={p.login}
                  type="button"
                  onClick={() => {
                    setHidden((prev) => {
                      const next = new Set(prev);
                      if (next.has(p.login)) next.delete(p.login);
                      else next.add(p.login);
                      return next;
                    });
                  }}
                  className={cn(
                    "w-full flex items-center gap-2 p-2 rounded-md border transition-all text-left",
                    isHidden ? "opacity-40 border-border/50 bg-transparent" : "border-border/30 bg-muted/30 hover:bg-muted/60"
                  )}
                >
                  <span
                    className="h-3 w-3 rounded-full shrink-0 ring-2 ring-background"
                    style={{ backgroundColor: color }}
                  />
                  <Avatar className="h-5 w-5 shrink-0">
                    <AvatarImage src={p.avatarUrl} />
                    <AvatarFallback className="text-[8px]">{p.login[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{p.name || p.login}</div>
                    <div className="text-[10px] text-muted-foreground font-mono tabular-nums">
                      S{scores[idx].sector} · P{scores[idx].problemType} · T{scores[idx].tech} · M{scores[idx].methodology} · R{scores[idx].role}
                    </div>
                  </div>
                  {isHidden && (
                    <span className="text-[9px] text-muted-foreground italic">hidden</span>
                  )}
                </button>
              );
            })}
            <div className="pt-2 mt-2 border-t text-[10px] text-muted-foreground/70">
              Click a person to toggle their polygon. 0–100 = % of team max commits in that dimension.
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
