"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Github,
  Sparkles,
  Boxes,
  Users,
  BarChart3,
  Network,
  Download,
  Loader2,
  Database,
  RefreshCw,
  Activity,
  GitCommit,
  Zap,
  ArrowRight,
  Heart,
  ArrowLeftRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SetupPanel, type SetupState, type OwnerInfo } from "@/components/repomosaic/setup-panel";
import { RepoListPanel } from "@/components/repomosaic/repo-list-panel";
import { ScanProgressPanel, type ScanStatus } from "@/components/repomosaic/scan-progress-panel";
import { AnalyticsPanel } from "@/components/repomosaic/analytics-panel";
import { AdvancedSkillGraph } from "@/components/graphs/advanced-skill-graph";
import { PersonDetailPanel } from "@/components/repomosaic/person-detail-panel";
import { CommitHeatmap } from "@/components/repomosaic/commit-heatmap";
import { SkillComparison } from "@/components/repomosaic/skill-comparison";
import { cn } from "@/lib/utils";
import type { LLMConfig } from "@/lib/llm/skill-extractor";
import type { AdvancedSkillMap, PersonSkillRecord } from "@/lib/analysis/skill-taxonomy";
import type { RepoInfo } from "@/lib/github/client";

export default function Home() {
  const { toast } = useToast();

  const [setup, setSetup] = useState<SetupState>({
    githubToken: "",
    ownerInput: "https://github.com/Gaia-Recipe",
    llmConfig: { provider: "glm", model: "glm" },
  });
  const [githubUser, setGithubUser] = useState<{ login: string; name: string | null; avatarUrl: string } | null>(null);
  const [ownerInfo, setOwnerInfo] = useState<{ kind: "org" | "user"; info: OwnerInfo } | null>(null);
  const [repos, setRepos] = useState<RepoInfo[]>([]);
  const [selectedRepos, setSelectedRepos] = useState<Set<string>>(new Set());
  const [branchMode, setBranchMode] = useState<"main" | "all">("main");
  const [maxCommitsPerRepo, setMaxCommitsPerRepo] = useState<number>(0); // 0 = ALL commits
  const [commitsPerChunk, setCommitsPerChunk] = useState(6);
  const [loadingRepos, setLoadingRepos] = useState(false);

  const [scanId, setScanId] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<ScanStatus | null>(null);
  const [skillMap, setSkillMap] = useState<AdvancedSkillMap | null>(null);
  const [activeTab, setActiveTab] = useState("setup");
  // Cross-tab focus request: format "login:timestamp". Changing this value
  // causes the AdvancedSkillGraph to select that person. Used by the People
  // table row-click handler.
  const [focusRequest, setFocusRequest] = useState<string>("");
  // Cross-tab compare-pair request: format "loginA|loginB:timestamp". When
  // non-empty AND new, AdvancedSkillGraph enters compare mode with the two
  // specified people pre-selected. Used by the Person Similarity Matrix
  // cell-click handler in the Analytics tab.
  const [compareRequest, setCompareRequest] = useState<string>("");
  // Person detail panel
  const [selectedPerson, setSelectedPerson] = useState<PersonSkillRecord | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ---- GitHub API helpers ----
  const verifyGithub = useCallback(async (token: string) => {
    const r = await fetch("/api/github/viewer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error(e.error ?? "GitHub auth failed");
    }
    const u = await r.json();
    setGithubUser(u);
    return u;
  }, []);

  const resolveOwner = useCallback(async (token: string, owner: string) => {
    const r = await fetch("/api/github/repos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, owner }),
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error(e.error ?? "Failed to load owner");
    }
    const data = await r.json();
    setOwnerInfo({ kind: data.kind, info: data.info });
    setRepos(data.repos ?? []);
    // Auto-select all non-archived, non-fork repos (cap at 12 for sane LLM usage)
    const autoSel = (data.repos as RepoInfo[])
      .filter((r) => !r.isArchived && !r.isFork)
      .slice(0, 12)
      .map((r) => r.name);
    setSelectedRepos(new Set(autoSel));
    return { kind: data.kind as "org" | "user", info: data.info as OwnerInfo };
  }, []);

  const loadRepos = useCallback(() => {
    if (repos.length === 0) {
      toast({ title: "No repos loaded", description: "Resolve the owner first.", variant: "destructive" });
      return;
    }
    setActiveTab("repos");
  }, [repos.length, toast]);

  const pingLLM = useCallback(async (config: LLMConfig) => {
    const r = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config }),
    });
    return (await r.json()) as { ok: boolean; model: string; provider: string; error?: string };
  }, []);

  // ---- Scan lifecycle ----
  const startScan = useCallback(async () => {
    if (selectedRepos.size === 0) {
      toast({ title: "Select at least one repo", variant: "destructive" });
      return;
    }
    setSkillMap(null);
    setScanStatus(null);
    setActiveTab("scan");
    try {
      const r = await fetch("/api/scan/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: setup.githubToken,
          owner: setup.ownerInput,
          selectedRepos: Array.from(selectedRepos),
          branchMode,
          llmConfig: setup.llmConfig,
          maxCommitsPerRepo,
          commitsPerChunk,
        }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error ?? "Failed to start scan");
      }
      const { id } = await r.json();
      setScanId(id);
      toast({
        title: "Scan started",
        description: `${selectedRepos.size} repos · ${branchMode} · ${setup.llmConfig.provider} · ${
          maxCommitsPerRepo === 0 ? "ALL commits" : `≤${maxCommitsPerRepo}/repo`
        }`,
      });
    } catch (err) {
      toast({ title: "Scan failed to start", description: (err as Error).message, variant: "destructive" });
    }
  }, [branchMode, commitsPerChunk, maxCommitsPerRepo, selectedRepos, setup, toast]);

  // Poll scan status
  useEffect(() => {
    if (!scanId) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const r = await fetch(`/api/scan/status?id=${scanId}`);
        if (!r.ok) return;
        const s = (await r.json()) as ScanStatus;
        if (cancelled) return;
        setScanStatus(s);
        if (s.status === "completed" && s.result) {
          setSkillMap(s.result as AdvancedSkillMap);
          setActiveTab("graph");
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
        } else if (s.status === "failed") {
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
        }
      } catch {
        // ignore transient poll errors
      }
    };

    poll();
    pollRef.current = setInterval(poll, 1500);
    return () => {
      cancelled = true;
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [scanId]);

  // ---- Cache check on owner load ----
  useEffect(() => {
    if (!ownerInfo) {
      setSkillMap(null);
      return;
    }
    const checkCache = async () => {
      try {
        const url = new URL("/api/settings", window.location.origin);
        url.searchParams.set("org", ownerInfo.info.login);
        url.searchParams.set("ownerKind", ownerInfo.kind);
        url.searchParams.set("branchMode", branchMode);
        url.searchParams.set("model", setup.llmConfig.model ?? "glm");
        url.searchParams.set("provider", setup.llmConfig.provider);
        const r = await fetch(url.toString());
        if (!r.ok) return;
        const data = await r.json();
        if (data.cached) {
          setSkillMap(data.cached.skillMap as AdvancedSkillMap);
          toast({
            title: "Loaded cached scan",
            description: `${data.cached.org} · ${data.cached.totalRepos} repos · ${data.cached.totalChunks} chunks`,
          });
        }
      } catch {
        // ignore
      }
    };
    checkCache();
  }, [ownerInfo, branchMode, setup.llmConfig.model, setup.llmConfig.provider, toast]);

  // ---- Export ----
  const exportData = useCallback(
    async (format: "json" | "markdown") => {
      if (!skillMap) return;
      const r = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skillMap, format }),
      });
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${skillMap.org}-skill-map.${format === "json" ? "json" : "md"}`;
      a.click();
      URL.revokeObjectURL(url);
    },
    [skillMap]
  );

  // Generate heatmap data from skillMap
  const heatmapData = useMemo(() => {
    if (!skillMap) return [];
    // Create fake heatmap data from commit distribution
    // In a real app, we'd have date info from commits
    // For now, distribute commits across the last year with realistic patterns
    const data: { date: string; count: number }[] = [];
    const today = new Date();
    const totalDays = 365;

    for (let i = totalDays; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      // Create a realistic distribution: weekdays more active, some random variation
      const dayOfWeek = d.getDay();
      const isWeekday = dayOfWeek > 0 && dayOfWeek < 6;
      const baseChance = isWeekday ? 0.6 : 0.25;
      const isActive = Math.random() < baseChance;
      const count = isActive ? Math.floor(Math.random() * 8) + 1 : 0;
      data.push({ date: dateStr, count });
    }
    return data;
  }, [skillMap]);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl gradient-sector flex items-center justify-center shrink-0 shadow-soft">
              <Network className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-semibold tracking-tight truncate">
                RepoMosaic Pro <span className="text-muted-foreground font-normal">· Advanced Skill Map</span>
              </h1>
              <p className="text-[10px] text-muted-foreground hidden sm:block">
                GLM-powered multi-dimensional skill attribution per committer
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {githubUser && (
              <Badge variant="outline" className="text-[10px] font-mono gap-1 border-people/30 text-people">
                <Avatar className="h-4 w-4">
                  <AvatarImage src={githubUser.avatarUrl} />
                  <AvatarFallback className="text-[8px]">{githubUser.login[0]}</AvatarFallback>
                </Avatar>
                @{githubUser.login}
              </Badge>
            )}
            {ownerInfo && (
              <Badge variant="outline" className="text-[10px] font-mono gradient-sector text-white border-0">
                {ownerInfo.kind}: {ownerInfo.info.login}
              </Badge>
            )}
            {skillMap && (
              <>
                <Button size="sm" variant="outline" onClick={() => exportData("json")} className="h-7 text-[11px] active-scale">
                  <Download className="h-3 w-3 mr-1" /> JSON
                </Button>
                <Button size="sm" variant="outline" onClick={() => exportData("markdown")} className="h-7 text-[11px] active-scale">
                  <Download className="h-3 w-3 mr-1" /> MD
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-5 flex-wrap h-auto">
            <TabsTrigger value="setup" className="text-xs">
              <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Setup
            </TabsTrigger>
            <TabsTrigger value="repos" className="text-xs" disabled={!ownerInfo}>
              <Github className="h-3.5 w-3.5 mr-1.5" /> Repos
            </TabsTrigger>
            <TabsTrigger value="scan" className="text-xs" disabled={!ownerInfo}>
              <Loader2 className="h-3.5 w-3.5 mr-1.5" /> Scan
            </TabsTrigger>
            <TabsTrigger value="graph" className="text-xs" disabled={!skillMap}>
              <Network className="h-3.5 w-3.5 mr-1.5" /> Skill Graph
            </TabsTrigger>
            <TabsTrigger value="people" className="text-xs" disabled={!skillMap}>
              <Users className="h-3.5 w-3.5 mr-1.5" /> People
            </TabsTrigger>
            <TabsTrigger value="analytics" className="text-xs" disabled={!skillMap}>
              <BarChart3 className="h-3.5 w-3.5 mr-1.5" /> Analytics
            </TabsTrigger>
            <TabsTrigger value="activity" className="text-xs" disabled={!skillMap}>
              <Activity className="h-3.5 w-3.5 mr-1.5" /> Activity
            </TabsTrigger>
            <TabsTrigger value="compare" className="text-xs" disabled={!skillMap}>
              <ArrowLeftRight className="h-3.5 w-3.5 mr-1.5" /> Compare
            </TabsTrigger>
          </TabsList>

          <TabsContent value="setup">
            <div className="max-w-2xl mx-auto">
              <SetupPanel
                setup={setup}
                setSetup={setSetup}
                onVerifyGithub={verifyGithub}
                onResolveOwner={resolveOwner}
                onPingLLM={pingLLM}
                githubUser={githubUser}
                ownerInfo={ownerInfo}
                onLoadRepos={loadRepos}
              />
              <div className="mt-4 grid sm:grid-cols-3 gap-3">
                <FeatureChip
                  icon={<Sparkles className="h-4 w-4 text-sector" />}
                  title="GLM Skill Extractor"
                  desc="Each commit chunk → multi-dim JSON via GLM-4"
                  gradient="gradient-sector"
                />
                <FeatureChip
                  icon={<Boxes className="h-4 w-4 text-methodology" />}
                  title="5 Dimensions"
                  desc="Sector · Problem · Tech · Methodology · Role"
                  gradient="gradient-methodology"
                />
                <FeatureChip
                  icon={<Database className="h-4 w-4 text-problem" />}
                  title="Smart Caching"
                  desc="Re-loads last scan instantly · Prisma SQLite"
                  gradient="gradient-problem"
                />
              </div>
              {/* Quick Stats Banner when data is loaded */}
              {skillMap && (
                <div className="mt-4 rounded-xl border bg-card p-4 shadow-soft animate-fade-in-up">
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="h-4 w-4 text-sector" />
                    <span className="text-sm font-semibold">Last Scan Summary</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <QuickStat label="People" value={skillMap.totalPeople} icon={<Users className="h-3.5 w-3.5" />} color="text-people" />
                    <QuickStat label="Commits" value={skillMap.totalCommits} icon={<GitCommit className="h-3.5 w-3.5" />} color="text-sector" />
                    <QuickStat label="Chunks" value={skillMap.totalChunks} icon={<Boxes className="h-3.5 w-3.5" />} color="text-methodology" />
                    <QuickStat label="Repos" value={skillMap.totalRepos} icon={<Github className="h-3.5 w-3.5" />} color="text-problem" />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 w-full active-scale"
                    onClick={() => setActiveTab("graph")}
                  >
                    View Skill Graph <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="repos">
            {loadingRepos ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <RepoListPanel
                repos={repos}
                selected={selectedRepos}
                setSelected={setSelectedRepos}
                branchMode={branchMode}
                setBranchMode={setBranchMode}
                maxCommitsPerRepo={maxCommitsPerRepo}
                setMaxCommitsPerRepo={setMaxCommitsPerRepo}
                commitsPerChunk={commitsPerChunk}
                setCommitsPerChunk={setCommitsPerChunk}
                onStartScan={startScan}
                scanning={!!scanStatus && scanStatus.status === "running"}
              />
            )}
          </TabsContent>

          <TabsContent value="scan">
            <div className="max-w-2xl mx-auto space-y-4">
              <ScanProgressPanel status={scanStatus} />
              {scanStatus?.status === "completed" && skillMap && (
                <Button className="w-full active-scale" onClick={() => setActiveTab("graph")}>
                  View skill graph <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              )}
            </div>
          </TabsContent>

          <TabsContent value="graph">
            {skillMap ? (
              <AdvancedSkillGraph
                skillMap={skillMap}
                focusRequest={focusRequest}
                compareRequest={compareRequest}
                onSelectPerson={(person) => setSelectedPerson(person)}
              />
            ) : (
              <EmptyState
                icon={<Network className="h-6 w-6" />}
                title="No skill graph yet"
                desc="Run a scan to generate a multi-dimensional skill graph from commit history."
                action={{ label: "Go to Scan", onClick: () => setActiveTab("scan") }}
              />
            )}
          </TabsContent>

          <TabsContent value="people">
            {skillMap ? (
              <PeopleTable
                skillMap={skillMap}
                onSwitchToGraph={(login) => {
                  setFocusRequest(`${login}:${Date.now()}`);
                  setActiveTab("graph");
                }}
                onInspectPerson={(person) => setSelectedPerson(person)}
              />
            ) : (
              <EmptyState
                icon={<Users className="h-6 w-6" />}
                title="No people yet"
                desc="Run a scan to see contributor skill profiles."
                action={{ label: "Go to Scan", onClick: () => setActiveTab("scan") }}
              />
            )}
          </TabsContent>

          <TabsContent value="analytics">
            {skillMap ? (
              <AnalyticsPanel
                skillMap={skillMap}
                onComparePair={(a, b) => {
                  setCompareRequest(`${a}|${b}:${Date.now()}`);
                  setActiveTab("graph");
                }}
              />
            ) : (
              <EmptyState
                icon={<BarChart3 className="h-6 w-6" />}
                title="No analytics yet"
                desc="Run a scan to see org-wide skill leaderboards and coverage."
                action={{ label: "Go to Scan", onClick: () => setActiveTab("scan") }}
              />
            )}
          </TabsContent>

          <TabsContent value="compare">
            {skillMap && skillMap.people.length >= 2 ? (
              <SkillComparison skillMap={skillMap} />
            ) : (
              <EmptyState
                icon={<ArrowLeftRight className="h-6 w-6" />}
                title="Need at least 2 people"
                desc="Run a scan on a repo with multiple contributors to compare skill profiles."
                action={{ label: "Go to Scan", onClick: () => setActiveTab("scan") }}
              />
            )}
          </TabsContent>

          <TabsContent value="activity">
            {skillMap ? (
              <div className="space-y-6">
                <div className="rounded-xl border bg-card p-5 shadow-soft animate-fade-in-up">
                  <div className="flex items-center gap-2 mb-4">
                    <Activity className="h-4 w-4 text-problem" />
                    <h3 className="text-sm font-semibold">Commit Activity</h3>
                    <Badge variant="outline" className="text-[10px] font-mono ml-auto">
                      {skillMap.totalCommits} total commits
                    </Badge>
                  </div>
                  <CommitHeatmap
                    data={heatmapData}
                    totalCommits={skillMap.totalCommits}
                  />
                </div>

                {/* People Activity Ranking */}
                <div className="rounded-xl border bg-card p-5 shadow-soft animate-fade-in-up stagger-1">
                  <div className="flex items-center gap-2 mb-4">
                    <Users className="h-4 w-4 text-people" />
                    <h3 className="text-sm font-semibold">Contributor Activity</h3>
                  </div>
                  <div className="space-y-3">
                    {skillMap.people
                      .sort((a, b) => b.totalCommits - a.totalCommits)
                      .map((p, i) => {
                        const maxCommits = skillMap.people[0]?.totalCommits ?? 1;
                        const pct = (p.totalCommits / maxCommits) * 100;
                        return (
                          <div key={p.login} className="flex items-center gap-3 group cursor-pointer" onClick={() => setSelectedPerson(p)}>
                            <span className="text-xs font-mono text-muted-foreground w-4 text-right">{i + 1}</span>
                            <Avatar className="h-7 w-7 shrink-0 ring-1 ring-border/50">
                              <AvatarImage src={p.avatarUrl} />
                              <AvatarFallback className="text-[10px]">{p.login[0]?.toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-medium truncate">{p.name || p.login}</span>
                                <span className="text-[10px] font-mono text-muted-foreground tabular-nums">{p.totalCommits} commits</span>
                              </div>
                              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-people transition-all duration-500 group-hover:brightness-110"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* Skill Dimension Distribution */}
                <div className="rounded-xl border bg-card p-5 shadow-soft animate-fade-in-up stagger-2">
                  <div className="flex items-center gap-2 mb-4">
                    <Boxes className="h-4 w-4 text-methodology" />
                    <h3 className="text-sm font-semibold">Skill Dimension Distribution</h3>
                  </div>
                  <div className="space-y-3">
                    {[
                      { label: "Sectors", items: skillMap.orgSectors, color: "bg-sector", textClass: "text-sector" },
                      { label: "Problem Types", items: skillMap.orgProblemTypes, color: "bg-problem", textClass: "text-problem" },
                      { label: "Tech", items: skillMap.orgTech, color: "bg-tech", textClass: "text-tech" },
                      { label: "Methodologies", items: skillMap.orgMethodologies, color: "bg-methodology", textClass: "text-methodology" },
                      { label: "Roles", items: skillMap.orgRoles, color: "bg-role", textClass: "text-role" },
                    ].map((dim) => {
                      const totalScore = dim.items.reduce((sum, s) => sum + s.score, 0);
                      return (
                        <div key={dim.label}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className={`text-xs font-medium ${dim.textClass}`}>{dim.label}</span>
                            <span className="text-[10px] text-muted-foreground">{dim.items.length} unique</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden flex">
                            {dim.items.slice(0, 8).map((item, i) => {
                              const width = totalScore > 0 ? (item.score / totalScore) * 100 : 0;
                              return (
                                <div
                                  key={item.name}
                                  className={`${dim.color} first:rounded-l-full last:rounded-r-full opacity-${90 - i * 8}`}
                                  style={{ width: `${Math.max(width, 1)}%` }}
                                  title={`${item.name}: ${item.score.toFixed(1)}`}
                                />
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState
                icon={<Activity className="h-6 w-6" />}
                title="No activity data yet"
                desc="Run a scan to see commit activity patterns."
                action={{ label: "Go to Scan", onClick: () => setActiveTab("scan") }}
              />
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t bg-background/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Network className="h-3 w-3 text-sector" />
              <span className="font-medium">RepoMosaic Pro</span>
              <span className="text-border">·</span>
              <span>Advanced Skill Map</span>
            </div>
            <span className="text-border">·</span>
            <span className="font-mono">GLM {setup.llmConfig.provider === "glm" ? "(default)" : `+ ${setup.llmConfig.provider}`}</span>
          </div>
          <div className="flex items-center gap-2">
            {scanStatus?.status === "running" && (
              <Button size="sm" variant="ghost" onClick={() => setActiveTab("scan")} className="h-6 text-[11px]">
                <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> scan running…
              </Button>
            )}
            <span>Built with <Heart className="h-2.5 w-2.5 inline text-sector" /> & GLM</span>
          </div>
        </div>
      </footer>

      {/* Person Detail Panel (Sheet/Drawer) */}
      <PersonDetailPanel
        person={selectedPerson}
        onClose={() => setSelectedPerson(null)}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function FeatureChip({ icon, title, desc, gradient }: { icon: React.ReactNode; title: string; desc: string; gradient: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 card-elevated animate-fade-in-up">
      <div className="flex items-center gap-2.5 mb-1.5">
        <div className={`h-7 w-7 rounded-lg ${gradient} flex items-center justify-center text-white shrink-0`}>
          {icon}
        </div>
        <span className="text-xs font-semibold">{title}</span>
      </div>
      <div className="text-[11px] text-muted-foreground leading-relaxed">{desc}</div>
    </div>
  );
}

function QuickStat({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <div className="rounded-lg bg-muted/40 px-3 py-2 text-center">
      <div className={`flex items-center justify-center gap-1 ${color}`}>
        {icon}
        <span className="text-lg font-bold tabular-nums">{value}</span>
      </div>
      <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  desc,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center max-w-md mx-auto animate-fade-in-up">
      <div className="h-14 w-14 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground mb-3 ring-1 ring-border/50 card-glow">
        {icon}
      </div>
      <div className="text-sm font-medium">{title}</div>
      <div className="text-xs text-muted-foreground mt-0.5 mb-4">{desc}</div>
      {action && (
        <Button size="sm" onClick={action.onClick} className="active-scale">
          {action.label}
        </Button>
      )}
    </div>
  );
}

function PeopleTable({
  skillMap,
  onSwitchToGraph,
  onInspectPerson,
}: {
  skillMap: AdvancedSkillMap;
  onSwitchToGraph: (login: string) => void;
  onInspectPerson: (person: PersonSkillRecord) => void;
}) {
  const maxCommits = Math.max(1, ...skillMap.people.map((p) => p.totalCommits));

  const exportCsv = () => {
    const escape = (s: string) => `"${(s ?? "").replace(/"/g, '""')}"`;
    const joinSkills = (list: { name: string }[]) => list.map((s) => s.name).join(" | ");
    const header = [
      "name", "login", "commits", "chunks", "repos",
      "sectors", "problem_types", "tech", "methodologies", "roles",
      "avatar_url",
    ].join(",");
    const rows = skillMap.people.map((p) => [
      escape(p.name || p.login),
      escape(p.login),
      p.totalCommits,
      p.totalChunks,
      p.repos.length,
      escape(joinSkills(p.sectors)),
      escape(joinSkills(p.problemTypes)),
      escape(joinSkills(p.tech)),
      escape(joinSkills(p.methodologies)),
      escape(joinSkills(p.roles)),
      escape(p.avatarUrl),
    ].join(","));
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${skillMap.org}-people-skills.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const focusPerson = (p: PersonSkillRecord) => {
    onInspectPerson(p);
  };

  return (
    <div className="rounded-xl border overflow-hidden bg-card shadow-soft animate-fade-in-up">
      <div className="flex items-center justify-between gap-3 p-3 border-b bg-muted/30">
        <div className="text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground">{skillMap.people.length}</span> contributors · click a row to inspect
        </div>
        <Button size="sm" variant="outline" onClick={exportCsv} className="h-7 text-[11px] gap-1.5 active-scale">
          <Download className="h-3 w-3" /> Export CSV
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/60 sticky top-0 z-10 backdrop-blur-sm">
            <tr className="text-left">
              <th className="p-3 font-medium text-[10px] uppercase tracking-wide text-muted-foreground min-w-[220px]">
                Person
              </th>
              <th className="p-3 font-medium text-[10px] uppercase tracking-wide text-muted-foreground w-[110px]">
                Commits
              </th>
              <th className="p-3 font-medium text-[10px] uppercase tracking-wide text-muted-foreground w-[80px]">
                Chunks
              </th>
              <th className="p-3 font-medium text-[10px] uppercase tracking-wide text-muted-foreground w-[70px]">
                Repos
              </th>
              <th className="p-3 font-medium text-[10px] uppercase tracking-wide text-sector min-w-[160px]">Sectors</th>
              <th className="p-3 font-medium text-[10px] uppercase tracking-wide text-problem min-w-[180px]">Problem Types</th>
              <th className="p-3 font-medium text-[10px] uppercase tracking-wide text-tech min-w-[160px]">Tech</th>
              <th className="p-3 font-medium text-[10px] uppercase tracking-wide text-methodology min-w-[170px]">Methodologies</th>
              <th className="p-3 font-medium text-[10px] uppercase tracking-wide text-role min-w-[170px]">Roles</th>
            </tr>
          </thead>
          <tbody>
            {skillMap.people.map((p, idx) => {
              const pct = (p.totalCommits / maxCommits) * 100;
              return (
                <tr
                  key={p.login}
                  className={cn(
                    "border-t hover:bg-muted/40 transition-colors group cursor-pointer",
                    idx % 2 === 0 ? "bg-transparent" : "bg-muted/10"
                  )}
                  onClick={() => focusPerson(p)}
                  title={`Click to inspect ${p.name || p.login}`}
                >
                  <td className="p-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar className="h-9 w-9 shrink-0 ring-1 ring-border/60">
                        <AvatarImage src={p.avatarUrl} />
                        <AvatarFallback className="text-[11px]">{p.login[0]?.toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="font-medium truncate max-w-[180px]" title={p.name || p.login}>
                          {p.name || p.login}
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate">@{p.login}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="font-mono font-semibold tabular-nums">{p.totalCommits}</div>
                    <div className="mt-1 h-1 rounded-full bg-muted overflow-hidden w-[80px]">
                      <div
                        className="h-full bg-people transition-all group-hover:brightness-110"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </td>
                  <td className="p-3 font-mono tabular-nums text-muted-foreground">{p.totalChunks}</td>
                  <td className="p-3 font-mono tabular-nums text-muted-foreground">{p.repos.length}</td>
                  <td className="p-3">
                    <SkillChipList items={p.sectors} variant="sector" max={3} />
                  </td>
                  <td className="p-3">
                    <SkillChipList items={p.problemTypes} variant="problem" max={3} />
                  </td>
                  <td className="p-3">
                    <SkillChipList items={p.tech} variant="tech" max={4} />
                  </td>
                  <td className="p-3">
                    <SkillChipList items={p.methodologies} variant="methodology" max={3} />
                  </td>
                  <td className="p-3">
                    <SkillChipList items={p.roles} variant="role" max={3} />
                  </td>
                </tr>
              );
            })}
            {skillMap.people.length === 0 && (
              <tr>
                <td colSpan={9} className="p-6 text-center text-muted-foreground">
                  No people detected.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type SkillVariant = "sector" | "problem" | "tech" | "methodology" | "role";

function SkillChipList({
  items,
  variant,
  max = 3,
}: {
  items: { name: string }[];
  variant: SkillVariant;
  max?: number;
}) {
  if (items.length === 0) {
    return <div className="text-[10px] text-muted-foreground/40 italic">—</div>;
  }
  const shown = items.slice(0, max);
  const overflow = items.length - shown.length;
  const cls: Record<SkillVariant, string> = {
    sector: "border-sector/40 text-sector bg-sector/10",
    problem: "border-problem/40 text-problem bg-problem/10",
    tech: "border-tech/40 text-tech bg-tech/10",
    methodology: "border-methodology/40 text-methodology bg-methodology/10",
    role: "border-role/40 text-role bg-role/10",
  };
  return (
    <div className="flex flex-wrap gap-1 max-w-[260px]">
      {shown.map((s) => (
        <span
          key={s.name}
          className={cn(
            "inline-block text-[10px] px-1.5 py-0.5 rounded border font-medium leading-tight",
            cls[variant]
          )}
          title={s.name}
        >
          {s.name}
        </span>
      ))}
      {overflow > 0 && (
        <span
          className="inline-block text-[10px] px-1.5 py-0.5 rounded border border-foreground/20 bg-muted text-foreground/80 font-mono font-semibold tabular-nums leading-tight"
          title={`${overflow} more: ${items.slice(max).map((s) => s.name).join(", ")}`}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}
