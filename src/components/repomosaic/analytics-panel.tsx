"use client";

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
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdvancedSkillMap } from "@/lib/analysis/skill-taxonomy";

type Props = { skillMap: AdvancedSkillMap };

export function AnalyticsPanel({ skillMap }: Props) {
  const topPeople = skillMap.people.slice(0, 8);

  return (
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
