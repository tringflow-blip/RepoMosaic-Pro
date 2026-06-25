"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdvancedSkillMap, SkillDimension } from "@/lib/analysis/skill-taxonomy";

type Props = { skillMap: AdvancedSkillMap };

export function AnalyticsPanel({ skillMap }: Props) {
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

      {/* Skill co-occurrence */}
      <SkillCoOccurrenceCard skillMap={skillMap} />
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
      icon: <Award className="h-4 w-4 text-amber-500" />,
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
      {stats.map((s) => (
        <Card key={s.label} className="overflow-hidden">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
              {s.icon}
              {s.label}
            </div>
            <div className={cn("font-mono font-semibold truncate", s.isText ? "text-sm" : "text-xl tabular-nums")}>
              {s.value}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{s.sub}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
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
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}
          {title}
        </CardTitle>
        <CardDescription className="text-[11px] flex items-center gap-1">
          <TrendingUp className="h-3 w-3" /> {items.length} tags detected across the org
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-1.5 max-h-[260px] overflow-y-auto pr-1">
        {items.length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-4">No tags yet.</div>
        )}
        {items.map((item, i) => (
          <div key={item.name} className="flex items-center gap-2 text-[11px]">
            <span className="font-mono text-muted-foreground w-4">{i + 1}</span>
            <span className="font-medium flex-1 truncate" title={item.name}>
              {item.name}
            </span>
            <span className="text-muted-foreground font-mono text-[10px] whitespace-nowrap">
              {item.people}p · {item.commits}c
            </span>
            <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={cn("h-full", accent)}
                style={{ width: `${(item.commits / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
