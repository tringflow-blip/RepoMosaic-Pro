"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  ChevronRight,
  GitCompare,
  X,
  CheckCircle2,
  Sparkles,
  Layers,
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
  /** When this changes, the graph focuses this person. Used for cross-tab
   *  navigation (e.g. clicking a People-table row). Pass a string that
   *  changes each time you want to focus — e.g. `${login}:${Date.now()}`. */
  focusRequest?: string;
  /** When this changes, the graph enters compare mode with the two specified
   *  people pre-selected. Format: `${loginA}|${loginB}:${timestamp}`.
   *  Used by the Person Similarity Matrix cell-click handler. */
  compareRequest?: string;
  /** Called when user selects a person in the graph or sidebar. */
  onSelectPerson?: (person: PersonSkillRecord) => void;
};

const DIMENSIONS: { key: SkillDimension; label: string; icon: typeof Compass; color: string }[] = [
  { key: "sector", label: "Sectors", icon: Compass, color: "text-sector" },
  { key: "problemType", label: "Problem Types", icon: Target, color: "text-problem" },
  { key: "tech", label: "Tech", icon: Wrench, color: "text-tech" },
  { key: "methodology", label: "Methodology", icon: Boxes, color: "text-methodology" },
  { key: "role", label: "Roles", icon: Shield, color: "text-role" },
];

export function AdvancedSkillGraph({ skillMap, focusRequest, compareRequest, onSelectPerson }: Props) {
  const [dimension, setDimension] = useState<SkillDimension>("sector");
  const [search, setSearch] = useState("");
  const [selectedLogin, setSelectedLogin] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [compareLogins, setCompareLogins] = useState<string[]>([]);
  // Track the previous focusRequest so we can "adjust state when a prop changes"
  // — the React-recommended pattern instead of setState-in-effect.
  // Initialize to "" (not focusRequest) so that if the parent passes a non-empty
  // focusRequest on first mount (e.g. user clicked a People-table row to navigate
  // here), the if-block below fires and selects that person.
  const [prevFocusRequest, setPrevFocusRequest] = useState("");
  // Same pattern for compareRequest — when it changes, enter compare mode with
  // the two specified people pre-selected (used by the Person Similarity Matrix
  // cell-click handler in the Analytics tab).
  const [prevCompareRequest, setPrevCompareRequest] = useState("");

  // Cross-tab focus: when focusRequest changes, switch selected person.
  // This runs during render (not in an effect) to avoid cascading renders.
  if ((focusRequest ?? "") !== prevFocusRequest) {
    setPrevFocusRequest(focusRequest ?? "");
    if (focusRequest) {
      const login = focusRequest.split(":")[0];
      if (login && skillMap.people.some((p) => p.login === login)) {
        if (compareMode) setCompareMode(false);
        setCompareLogins([]);
        setSelectedLogin(login);
      }
    }
  }

  // Cross-tab compare: when compareRequest changes, enter compare mode with
  // the two specified people pre-selected.
  if ((compareRequest ?? "") !== prevCompareRequest) {
    setPrevCompareRequest(compareRequest ?? "");
    if (compareRequest) {
      // Format: "loginA|loginB:timestamp"
      const pairPart = compareRequest.split(":")[0];
      const [a, b] = pairPart.split("|");
      if (
        a && b &&
        skillMap.people.some((p) => p.login === a) &&
        skillMap.people.some((p) => p.login === b)
      ) {
        setSelectedLogin(null);
        setCompareMode(true);
        setCompareLogins([a, b]);
      }
    }
  }

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

  const comparePeople = compareLogins
    .map((l) => skillMap.people.find((p) => p.login === l))
    .filter((p): p is PersonSkillRecord => !!p);

  const handlePersonClick = (login: string) => {
    if (compareMode) {
      setCompareLogins((prev) =>
        prev.includes(login)
          ? prev.filter((l) => l !== login)
          : prev.length >= 2
            ? [prev[1], login] // replace first, keep second
            : [...prev, login]
      );
    } else {
      setSelectedLogin(selectedLogin === login ? null : login);
    }
    // Trigger onSelectPerson callback
    if (onSelectPerson) {
      const person = skillMap.people.find((p) => p.login === login);
      if (person) onSelectPerson(person);
    }
  };

  // Also listen for "repomosaic:focus-person" window events (legacy path
  // — still used if someone dispatches the event manually)
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ login: string }>;
      if (typeof ce.detail?.login === "string") {
        if (compareMode) setCompareMode(false);
        setCompareLogins([]);
        setSelectedLogin(ce.detail.login);
      }
    };
    window.addEventListener("repomosaic:focus-person", handler as EventListener);
    return () => window.removeEventListener("repomosaic:focus-person", handler as EventListener);
  }, [compareMode, selectedLogin]);

  // "/" keyboard shortcut to focus the contributor search input
  const searchInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="space-y-4">
      {/* Compare mode banner */}
      {compareMode && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs">
              <GitCompare className="h-4 w-4 text-primary" />
              <span className="font-medium">Compare mode</span>
              <span className="text-muted-foreground">
                · Select {comparePeople.length === 0 ? "2" : comparePeople.length === 1 ? "1 more" : "✓ 2 selected"} people from the list
              </span>
            </div>
            <div className="flex items-center gap-2">
              {comparePeople.map((p) => (
                <Badge key={p.login} variant="outline" className="text-[10px] gap-1">
                  <Avatar className="h-3 w-3">
                    <AvatarImage src={p.avatarUrl} />
                    <AvatarFallback className="text-[8px]">{p.login[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  {p.name || p.login}
                  <button
                    type="button"
                    onClick={() => setCompareLogins((prev) => prev.filter((l) => l !== p.login))}
                    className="ml-0.5 hover:text-destructive"
                    aria-label={`Remove ${p.login}`}
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </Badge>
              ))}
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-[11px]"
                onClick={() => { setCompareMode(false); setCompareLogins([]); }}
              >
                Exit compare
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3 space-y-4">
          {/* Sticky mini-stats bar — at-a-glance scan totals, stays visible while scrolling */}
          <div className="sticky top-0 z-20 -mx-1 px-1 py-1.5 rounded-lg bg-background/80 backdrop-blur-md border-b border-border/40">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
              <span className="font-mono font-semibold text-people inline-flex items-center gap-1">
                <Users className="h-3 w-3" />
                {skillMap.people.length} people
              </span>
              <span className="text-muted-foreground/40">·</span>
              <span className="font-mono tabular-nums text-muted-foreground inline-flex items-center gap-1">
                <GitCommitVertical className="h-3 w-3" />
                {skillMap.totalCommits} commits
              </span>
              <span className="text-muted-foreground/40">·</span>
              <span className="font-mono tabular-nums text-muted-foreground inline-flex items-center gap-1">
                <Layers className="h-3 w-3" />
                {skillMap.totalChunks} chunks
              </span>
              <span className="text-muted-foreground/40">·</span>
              <span className="font-mono tabular-nums text-muted-foreground">{skillMap.totalRepos} repos</span>
              <span className="text-muted-foreground/40">·</span>
              <span className="font-mono text-[10px] text-primary/80 inline-flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                {skillMap.model}
              </span>
              <span className="ml-auto text-[10px] text-muted-foreground/70 italic hidden sm:inline">
                {compareMode
                  ? `Compare mode · ${compareLogins.length}/2 selected`
                  : selectedPerson
                    ? `Inspecting ${selectedPerson.name || selectedPerson.login}`
                    : "Click a node or row to inspect"}
              </span>
            </div>
          </div>

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
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={compareMode ? "default" : "outline"}
                    className="h-7 text-[11px]"
                    onClick={() => {
                      setCompareMode(!compareMode);
                      setCompareLogins([]);
                      setSelectedLogin(null);
                    }}
                  >
                    <GitCompare className="h-3 w-3 mr-1" />
                    Compare
                  </Button>
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
                  handlePersonClick(login);
                }
              }}
            />
            <div className="flex items-center justify-between gap-3 mt-2">
              <p className="text-[11px] text-muted-foreground">
                {compareMode
                  ? "Compare mode: click person nodes to select 2 for side-by-side comparison."
                  : "Person nodes (people-colored) sized by commits · "}
                {!compareMode && (
                  <>
                    {DIMENSIONS.find((d) => d.key === dimension)?.label} nodes sized by aggregate commit
                    volume · drag to reposition
                  </>
                )}
              </p>
              <DimensionLegend dimension={dimension} />
            </div>
          </CardContent>
        </Card>

        <DimensionLeaderboards skillMap={skillMap} dimension={dimension} />
      </div>

      <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span>Contributors</span>
              {compareMode && (
                <span className="text-[10px] font-normal text-muted-foreground">
                  {compareLogins.length}/2 selected
                </span>
              )}
            </CardTitle>
            <div className="relative mt-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                placeholder="Search by name, skill, sector…  (press / to focus)"
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
                selected={compareMode ? compareLogins.includes(p.login) : selectedLogin === p.login}
                onClick={() => handlePersonClick(p.login)}
                compareMode={compareMode}
              />
            ))}
            {filteredPeople.length === 0 && (
              <div className="text-sm text-muted-foreground py-6 text-center">No matches.</div>
            )}
          </CardContent>
        </Card>

        {compareMode ? (
          comparePeople.length === 2 ? (
            <ComparePeopleCard people={comparePeople as [PersonSkillRecord, PersonSkillRecord]} />
          ) : (
            <Card className="border-dashed border-primary/30">
              <CardContent className="pt-6 text-center text-sm text-muted-foreground space-y-2">
                <GitCompare className="h-6 w-6 mx-auto text-primary/50" />
                <div>Select {2 - comparePeople.length} more person{comparePeople.length === 1 ? "" : "s"} to compare</div>
                <div className="text-[11px]">Click contributor rows or graph nodes</div>
              </CardContent>
            </Card>
          )
        ) : selectedPerson ? (
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
    </div>
  );
}

/** Side-by-side comparison of two people's skill profiles. Shows overlap
 *  (shared skills) and unique skills per person, per dimension. Includes
 *  a Jaccard similarity score per dimension (|shared| / |union|) and an
 *  overall similarity headline. */
function ComparePeopleCard({ people }: { people: [PersonSkillRecord, PersonSkillRecord] }) {
  const [a, b] = people;
  const dims: { key: "sectors" | "problemTypes" | "tech" | "methodologies" | "roles"; label: string; color: string; barClass: string }[] = [
    { key: "sectors", label: "Sectors", color: "text-sector", barClass: "bg-sector" },
    { key: "problemTypes", label: "Problem Types", color: "text-problem", barClass: "bg-problem" },
    { key: "tech", label: "Tech", color: "text-tech", barClass: "bg-tech" },
    { key: "methodologies", label: "Methodologies", color: "text-methodology", barClass: "bg-methodology" },
    { key: "roles", label: "Roles", color: "text-role", barClass: "bg-role" },
  ];

  // Compute per-dimension Jaccard + overall
  const dimStats = dims.map((dim) => {
    const listA = a[dim.key];
    const listB = b[dim.key];
    const namesA = new Set(listA.map((s) => s.name));
    const namesB = new Set(listB.map((s) => s.name));
    const shared = listA.filter((s) => namesB.has(s.name));
    const onlyA = listA.filter((s) => !namesB.has(s.name));
    const onlyB = listB.filter((s) => !namesA.has(s.name));
    const union = namesA.size + namesB.size - shared.length;
    const jaccard = union > 0 ? shared.length / union : 0;
    return { dim, shared, onlyA, onlyB, jaccard, union };
  });

  // Overall Jaccard across all dimensions
  const allA = new Set<string>();
  const allB = new Set<string>();
  for (const d of dims) {
    a[d.key].forEach((s) => allA.add(s.name));
    b[d.key].forEach((s) => allB.add(s.name));
  }
  let sharedAll = 0;
  for (const name of allA) if (allB.has(name)) sharedAll++;
  const overallJaccard = allA.size + allB.size - sharedAll > 0
    ? sharedAll / (allA.size + allB.size - sharedAll)
    : 0;

  const jaccardLabel = (j: number) =>
    j >= 0.7 ? "Very similar" : j >= 0.4 ? "Moderately similar" : j >= 0.2 ? "Somewhat similar" : j > 0 ? "Mostly distinct" : "No overlap";

  return (
    <Card className="animate-fade-in-up">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <GitCompare className="h-4 w-4 text-primary" />
          Skill Overlap
        </CardTitle>
        <CardDescription className="text-[11px]">
          Shared skills vs unique skills per person, with Jaccard similarity (|shared| / |union|)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 max-h-[560px] overflow-y-auto pr-1">
        {/* Overall similarity headline */}
        <div className="rounded-lg border bg-gradient-to-br from-primary/5 to-transparent p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              Overall skill similarity
            </span>
            <span className={cn(
              "text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded",
              overallJaccard >= 0.4 ? "bg-tech/15 text-tech" : "bg-sector/15 text-sector"
            )}>
              {jaccardLabel(overallJaccard)}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-mono font-bold tabular-nums">
              {(overallJaccard * 100).toFixed(0)}<span className="text-base text-muted-foreground">%</span>
            </span>
            <span className="text-[10px] text-muted-foreground">
              {sharedAll} shared · {allA.size + allB.size - sharedAll} total unique
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary/70 to-primary transition-all"
              style={{ width: `${overallJaccard * 100}%` }}
            />
          </div>
        </div>

        {/* Header row with both avatars */}
        <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center pb-2 border-b">
          <div className="flex items-center gap-2 min-w-0">
            <Avatar className="h-7 w-7 shrink-0">
              <AvatarImage src={a.avatarUrl} />
              <AvatarFallback className="text-[10px]">{a.login[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="text-xs font-medium truncate">{a.name || a.login}</div>
              <div className="text-[10px] text-muted-foreground">{a.totalCommits}c · {a.totalChunks} chunks</div>
            </div>
          </div>
          <VsBadge />
          <div className="flex items-center gap-2 min-w-0 justify-end">
            <div className="min-w-0 text-right">
              <div className="text-xs font-medium truncate">{b.name || b.login}</div>
              <div className="text-[10px] text-muted-foreground">{b.totalCommits}c · {b.totalChunks} chunks</div>
            </div>
            <Avatar className="h-7 w-7 shrink-0">
              <AvatarImage src={b.avatarUrl} />
              <AvatarFallback className="text-[10px]">{b.login[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
          </div>
        </div>

        {dimStats.map(({ dim, shared, onlyA, onlyB, jaccard, union }) => {
          if (shared.length === 0 && onlyA.length === 0 && onlyB.length === 0) return null;
          return (
            <div key={dim.key} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className={cn("text-[11px] font-medium flex items-center gap-1.5", dim.color)}>
                  {dim.label}
                </span>
                <div className="flex items-center gap-1.5">
                  <div className="w-16 h-1 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn("h-full", dim.barClass)}
                      style={{ width: `${jaccard * 100}%` }}
                    />
                  </div>
                  <span className="text-[9px] font-mono text-muted-foreground tabular-nums w-9 text-right">
                    {(jaccard * 100).toFixed(0)}%
                  </span>
                  <span className="text-[9px] text-muted-foreground/70 font-normal">
                    · {shared.length}/{union}
                  </span>
                </div>
              </div>
              {shared.length > 0 && (
                <div className="space-y-0.5">
                  <div className="text-[9px] uppercase tracking-wide text-tech flex items-center gap-1">
                    <CheckCircle2 className="h-2.5 w-2.5" /> Shared
                  </div>
                  {shared.map((s) => (
                    <div key={s.name} className="flex items-center gap-2 text-[10px]">
                      <span className="font-medium flex-1 truncate">{s.name}</span>
                      <span className="text-muted-foreground font-mono">{s.commits}c</span>
                      <span className="text-muted-foreground/60 font-mono">
                        {b[dim.key].find((x) => x.name === s.name)?.commits ?? 0}c
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-0.5">
                  <div className="text-[9px] uppercase tracking-wide text-muted-foreground truncate">
                    Only {a.name || a.login}
                  </div>
                  {onlyA.slice(0, 5).map((s) => (
                    <div key={s.name} className="text-[10px] truncate" title={s.name}>
                      <span className="font-medium">{s.name}</span>
                      <span className="text-muted-foreground ml-1 font-mono">{s.commits}c</span>
                    </div>
                  ))}
                  {onlyA.length === 0 && <div className="text-[9px] text-muted-foreground/60">—</div>}
                </div>
                <div className="space-y-0.5">
                  <div className="text-[9px] uppercase tracking-wide text-muted-foreground truncate text-right">
                    Only {b.name || b.login}
                  </div>
                  {onlyB.slice(0, 5).map((s) => (
                    <div key={s.name} className="text-[10px] truncate text-right" title={s.name}>
                      <span className="text-muted-foreground mr-1 font-mono">{s.commits}c</span>
                      <span className="font-medium">{s.name}</span>
                    </div>
                  ))}
                  {onlyB.length === 0 && <div className="text-[9px] text-muted-foreground/60 text-right">—</div>}
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function VsBadge() {
  return (
    <span className="text-[9px] font-mono font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
      VS
    </span>
  );
}

function PersonRow({
  person,
  selected,
  onClick,
  compareMode = false,
}: {
  person: PersonSkillRecord;
  selected: boolean;
  onClick: () => void;
  compareMode?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 p-2.5 rounded-lg border transition-all text-left",
        selected
          ? compareMode
            ? "border-primary/50 bg-primary/10 shadow-soft"
            : "border-people/50 bg-accent/60 shadow-soft"
          : "border-transparent hover:border-border/60 hover:bg-muted/50"
      )}
    >
      {compareMode && (
        <div className={cn(
          "h-4 w-4 rounded-full border flex items-center justify-center shrink-0 transition-colors",
          selected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30"
        )}>
          {selected && <CheckCircle2 className="h-3 w-3" />}
        </div>
      )}
      <Avatar className="h-9 w-9 shrink-0 ring-1 ring-border/60">
        <AvatarImage src={person.avatarUrl} />
        <AvatarFallback className="text-[11px]">{person.login[0]?.toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{person.name || person.login}</div>
        <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
          <span className="truncate">@{person.login}</span>
          <span className="opacity-40">·</span>
          <span className="inline-flex items-center gap-0.5 shrink-0">
            <GitCommitVertical className="h-3 w-3" />
            <span className="font-mono tabular-nums">{person.totalCommits}</span>
          </span>
          <span className="opacity-40">·</span>
          <span className="inline-flex items-center gap-0.5 shrink-0">
            <FolderGit2 className="h-3 w-3" />
            <span className="font-mono tabular-nums">{person.repos.length}</span>
          </span>
        </div>
      </div>
      {person.sectors[0] && (
        <Badge
          variant="outline"
          className="text-[10px] font-mono border-sector/40 bg-sector/10 text-sector shrink-0"
        >
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
      <CardContent className="space-y-4 max-h-[560px] overflow-y-auto pr-1">
        <SkillListWithEvidence
          title="SECTORS"
          icon={<Compass className="h-3 w-3" />}
          color="text-sector"
          barClass="bg-sector"
          items={person.sectors}
          allTags={person.allTags}
          dimension="sector"
        />
        <SkillListWithEvidence
          title="PROBLEM TYPES"
          icon={<Target className="h-3 w-3" />}
          color="text-problem"
          barClass="bg-problem"
          items={person.problemTypes}
          allTags={person.allTags}
          dimension="problemType"
        />
        <SkillListWithEvidence
          title="TECH CAPABILITIES"
          icon={<Wrench className="h-3 w-3" />}
          color="text-tech"
          barClass="bg-tech"
          items={person.tech}
          allTags={person.allTags}
          dimension="tech"
        />
        <SkillListWithEvidence
          title="METHODOLOGIES"
          icon={<Boxes className="h-3 w-3" />}
          color="text-methodology"
          barClass="bg-methodology"
          items={person.methodologies}
          allTags={person.allTags}
          dimension="methodology"
        />
        <SkillListWithEvidence
          title="ROLES"
          icon={<Shield className="h-3 w-3" />}
          color="text-role"
          barClass="bg-role"
          items={person.roles}
          allTags={person.allTags}
          dimension="role"
        />
        {person.ownership.length > 0 && (
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
              <FolderGit2 className="h-3 w-3" />
              OWNERSHIP
            </div>
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

/** Skill list where each row can be expanded to show the commit-level evidence
 *  that justified the tag. Evidence comes from the `allTags` flat list. */
function SkillListWithEvidence({
  title,
  icon,
  color,
  barClass,
  items,
  allTags,
  dimension,
}: {
  title: string;
  icon: React.ReactNode;
  color: string;
  barClass: string;
  items: { name: string; score: number; commits: number; chunks: number }[];
  allTags: { dimension: SkillDimension; name: string; evidence: string[]; repo: string; commits: number }[];
  dimension: SkillDimension;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  if (items.length === 0) return null;
  return (
    <div>
      <div className={cn("text-xs font-medium mb-2 flex items-center gap-1.5", color)}>
        {icon}
        {title}
      </div>
      <div className="space-y-1">
        {items.slice(0, 10).map((s) => {
          const isOpen = expanded === s.name;
          // Find evidence entries for this skill in this dimension
          const evidenceEntries = allTags
            .filter((t) => t.dimension === dimension && t.name === s.name)
            .flatMap((t) => (t.evidence || []).map((e) => ({ evidence: e, repo: t.repo })))
            .slice(0, 6);
          return (
            <div key={s.name} className="space-y-1">
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : s.name)}
                className="w-full flex items-center justify-between text-[11px] group"
              >
                <span className="font-medium truncate pr-2 text-left flex items-center gap-1">
                  {evidenceEntries.length > 0 && (
                    <ChevronRight
                      className={cn(
                        "h-2.5 w-2.5 text-muted-foreground transition-transform shrink-0",
                        isOpen && "rotate-90"
                      )}
                    />
                  )}
                  {s.name}
                </span>
                <span className="text-muted-foreground font-mono whitespace-nowrap flex items-center gap-1.5">
                  <span>{(s.score * 100).toFixed(0)}% · {s.commits}c</span>
                  {evidenceEntries.length > 0 && (
                    <span className="text-[8px] uppercase tracking-wide text-muted-foreground/60 group-hover:text-muted-foreground">
                      {evidenceEntries.length} evidence
                    </span>
                  )}
                </span>
              </button>
              <div className="h-1 rounded-full bg-muted overflow-hidden">
                <div className={cn("h-full transition-all", barClass)} style={{ width: `${s.score * 100}%` }} />
              </div>
              {isOpen && evidenceEntries.length > 0 && (
                <div className="mt-1 mb-1.5 p-2 rounded-md bg-muted/40 border border-border/40 space-y-1 animate-fade-in-up">
                  <div className="text-[9px] uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1">
                    <Search className="h-2.5 w-2.5" />
                    Commit-level evidence
                  </div>
                  {evidenceEntries.map((e, i) => (
                    <div key={i} className="text-[10px] flex items-start gap-1.5">
                      <FolderGit2 className="h-2.5 w-2.5 mt-0.5 shrink-0 text-muted-foreground/60" />
                      <span className="font-mono text-muted-foreground shrink-0">{e.repo}:</span>
                      <span className="text-foreground/80 break-all">{e.evidence}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
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

/** Small color legend showing the active dimension's color + the people color. */
function DimensionLegend({ dimension }: { dimension: SkillDimension }) {
  const dimMeta = DIMENSIONS.find((d) => d.key === dimension)!;
  const colorClass =
    dimension === "sector" ? "bg-sector" :
    dimension === "problemType" ? "bg-problem" :
    dimension === "tech" ? "bg-tech" :
    dimension === "methodology" ? "bg-methodology" : "bg-role";
  return (
    <div className="flex items-center gap-3 text-[10px] text-muted-foreground shrink-0">
      <span className="flex items-center gap-1.5">
        <span className={cn("h-2.5 w-2.5 rounded-full", colorClass)} />
        {dimMeta.label}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-people" />
        Person
      </span>
    </div>
  );
}
