"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users,
  Search,
  GitCommitVertical,
  FolderGit2,
  Boxes,
  Wrench,
  Target,
  Compass,
  Shield,
} from "lucide-react";
import { ForceGraph } from "./force-graph";
import { cn } from "@/lib/utils";
import {
  skillMapToGraph,
  type AdvancedSkillMap,
  type PersonSkillRecord,
  type SkillDimension,
} from "@/lib/analysis/skill-taxonomy";

type Props = {
  skillMap: AdvancedSkillMap;
};

const DIMENSIONS: { key: SkillDimension; label: string; icon: typeof Compass; color: string }[] = [
  { key: "sector", label: "Sectors", icon: Compass, color: "text-sector" },
  { key: "problemType", label: "Problem Types", icon: Target, color: "text-problem" },
  { key: "tech", label: "Tech", icon: Wrench, color: "text-tech" },
  { key: "methodology", label: "Methodology", icon: Boxes, color: "text-methodology" },
  { key: "role", label: "Roles", icon: Shield, color: "text-role" },
];

export function AdvancedSkillGraph({ skillMap }: Props) {
  const [dimension, setDimension] = useState<SkillDimension>("sector");
  const [search, setSearch] = useState("");
  const [selectedLogin, setSelectedLogin] = useState<string | null>(null);

  const graph = useMemo(() => skillMapToGraph(skillMap, dimension), [skillMap, dimension]);

  const filteredPeople = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return skillMap.people;
    return skillMap.people.filter(
      (p) =>
        p.login.toLowerCase().includes(q) ||
        (p.name ?? "").toLowerCase().includes(q) ||
        p.sectors.some((s) => s.name.toLowerCase().includes(q)) ||
        p.problemTypes.some((s) => s.name.toLowerCase().includes(q)) ||
        p.tech.some((s) => s.name.toLowerCase().includes(q)) ||
        p.methodologies.some((s) => s.name.toLowerCase().includes(q)) ||
        p.roles.some((s) => s.name.toLowerCase().includes(q))
    );
  }, [skillMap.people, search]);

  const selectedPerson = selectedLogin
    ? skillMap.people.find((p) => p.login === selectedLogin) ?? null
    : null;

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="lg:col-span-3 space-y-4">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-people" />
                  Skill Graph — {skillMap.org}
                </CardTitle>
                <CardDescription className="mt-1">
                  {skillMap.people.length} people · {skillMap.totalRepos} repos ·{" "}
                  {skillMap.totalCommits} commits · {skillMap.totalChunks} LLM chunks ·{" "}
                  <span className="font-mono text-[10px]">{skillMap.model}</span>
                </CardDescription>
              </div>
              <Tabs value={dimension} onValueChange={(v) => setDimension(v as SkillDimension)}>
                <TabsList className="h-8">
                  {DIMENSIONS.map((d) => (
                    <TabsTrigger key={d.key} value={d.key} className="text-[11px] px-2.5 h-7">
                      <d.icon className={cn("h-3 w-3 mr-1", d.color)} />
                      {d.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent>
            <ForceGraph
              nodes={graph.nodes}
              edges={graph.edges}
              height={520}
              showLabels
              emptyMessage="Run a scan to populate the skill graph."
              onSelectNode={(id) => {
                if (id.startsWith("person:")) {
                  const login = id.slice("person:".length);
                  setSelectedLogin(login);
                }
              }}
            />
            <p className="text-[11px] text-muted-foreground mt-2 text-center">
              Person nodes (cyan) sized by commits · {DIMENSIONS.find((d) => d.key === dimension)?.label} nodes sized by aggregate commit volume · drag to reposition
            </p>
          </CardContent>
        </Card>

        <DimensionLeaderboards skillMap={skillMap} dimension={dimension} />
      </div>

      <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contributors</CardTitle>
            <div className="relative mt-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search by name, skill, sector…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 text-sm h-9"
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-1 max-h-[300px] overflow-y-auto pr-1">
            {filteredPeople.slice(0, 80).map((p) => (
              <PersonRow
                key={p.login}
                person={p}
                selected={selectedLogin === p.login}
                onClick={() => setSelectedLogin(selectedLogin === p.login ? null : p.login)}
              />
            ))}
            {filteredPeople.length === 0 && (
              <div className="text-sm text-muted-foreground py-6 text-center">No matches.</div>
            )}
          </CardContent>
        </Card>

        {selectedPerson ? (
          <PersonDetailCard person={selectedPerson} />
        ) : (
          <Card className="border-dashed">
            <CardContent className="pt-6 text-center text-sm text-muted-foreground">
              Click a contributor to see their multi-dimensional skill breakdown.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function PersonRow({
  person,
  selected,
  onClick,
}: {
  person: PersonSkillRecord;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 p-2 rounded-lg border transition-all text-left",
        selected
          ? "border-people/40 bg-accent/50 shadow-soft"
          : "border-transparent hover:border-border/60 hover:bg-muted/40"
      )}
    >
      <Avatar className="h-8 w-8">
        <AvatarImage src={person.avatarUrl} />
        <AvatarFallback>{person.login[0]?.toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{person.name || person.login}</div>
        <div className="text-[11px] text-muted-foreground flex items-center gap-2">
          <span>@{person.login}</span>
          <span>·</span>
          <span className="flex items-center gap-0.5">
            <GitCommitVertical className="h-3 w-3" />
            {person.totalCommits}
          </span>
          <span>·</span>
          <span className="flex items-center gap-0.5">
            <FolderGit2 className="h-3 w-3" />
            {person.repos.length}
          </span>
        </div>
      </div>
      {person.sectors[0] && (
        <Badge variant="outline" className="text-[10px] font-mono border-sector/30 text-sector">
          {person.sectors[0].name}
        </Badge>
      )}
    </button>
  );
}

function PersonDetailCard({ person }: { person: PersonSkillRecord }) {
  return (
    <Card className="animate-fade-in-up">
      <CardHeader>
        <div className="flex items-center gap-3">
          <Avatar className="h-11 w-11">
            <AvatarImage src={person.avatarUrl} />
            <AvatarFallback>{person.login[0]?.toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <CardTitle className="text-base truncate">{person.name || person.login}</CardTitle>
            <CardDescription className="text-[11px]">
              @{person.login} · {person.totalCommits} commits · {person.totalChunks} chunks ·{" "}
              {person.repos.length} repos
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 max-h-[520px] overflow-y-auto pr-1">
        <SkillList
          title="SECTORS"
          color="text-sector"
          barClass="bg-sector"
          items={person.sectors}
        />
        <SkillList
          title="PROBLEM TYPES"
          color="text-problem"
          barClass="bg-problem"
          items={person.problemTypes}
        />
        <SkillList
          title="TECH CAPABILITIES"
          color="text-tech"
          barClass="bg-tech"
          items={person.tech}
        />
        <SkillList
          title="METHODOLOGIES"
          color="text-methodology"
          barClass="bg-methodology"
          items={person.methodologies}
        />
        <SkillList
          title="ROLES"
          color="text-role"
          barClass="bg-role"
          items={person.roles}
        />
        {person.ownership.length > 0 && (
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-2">OWNERSHIP</div>
            <div className="flex flex-wrap gap-1.5">
              {person.ownership.slice(0, 15).map((o) => (
                <Badge key={o.repo} variant="outline" className="text-[10px] font-mono">
                  {o.repo}: {(o.share * 100).toFixed(0)}%
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SkillList({
  title,
  color,
  barClass,
  items,
}: {
  title: string;
  color: string;
  barClass: string;
  items: { name: string; score: number; commits: number; chunks: number }[];
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className={cn("text-xs font-medium mb-2", color)}>{title}</div>
      <div className="space-y-1.5">
        {items.slice(0, 10).map((s) => (
          <div key={s.name} className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-medium truncate pr-2">{s.name}</span>
              <span className="text-muted-foreground font-mono whitespace-nowrap">
                {(s.score * 100).toFixed(0)}% · {s.commits}c
              </span>
            </div>
            <div className="h-1 rounded-full bg-muted overflow-hidden">
              <div className={cn("h-full", barClass)} style={{ width: `${s.score * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DimensionLeaderboards({
  skillMap,
  dimension,
}: {
  skillMap: AdvancedSkillMap;
  dimension: SkillDimension;
}) {
  const list =
    dimension === "sector" ? skillMap.orgSectors :
    dimension === "problemType" ? skillMap.orgProblemTypes :
    dimension === "tech" ? skillMap.orgTech :
    dimension === "methodology" ? skillMap.orgMethodologies : skillMap.orgRoles;

  if (list.length === 0) return null;

  const maxCommits = Math.max(1, ...list.map((l) => l.commits));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base capitalize">
          {dimension === "problemType" ? "Problem Types" : dimension + "s"} — Org-wide
        </CardTitle>
        <CardDescription className="text-[11px]">
          Top {list.length} tags detected across all scanned repos
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
        {list.slice(0, 25).map((item, i) => (
          <div key={item.name} className="flex items-center gap-3 text-[11px]">
            <span className="font-mono text-muted-foreground w-6">{i + 1}</span>
            <span className="font-medium flex-1 truncate">{item.name}</span>
            <span className="text-muted-foreground font-mono whitespace-nowrap">
              {item.people}p · {item.commits}c
            </span>
            <div className="w-24 h-1 rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  "h-full",
                  dimension === "sector" && "bg-sector",
                  dimension === "problemType" && "bg-problem",
                  dimension === "tech" && "bg-tech",
                  dimension === "methodology" && "bg-methodology",
                  dimension === "role" && "bg-role"
                )}
                style={{ width: `${(item.commits / maxCommits) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
