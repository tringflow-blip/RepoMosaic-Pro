"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SetupPanel, type SetupState, type OwnerInfo } from "@/components/repomosaic/setup-panel";
import { RepoListPanel } from "@/components/repomosaic/repo-list-panel";
import { ScanProgressPanel, type ScanStatus } from "@/components/repomosaic/scan-progress-panel";
import { AnalyticsPanel } from "@/components/repomosaic/analytics-panel";
import { AdvancedSkillGraph } from "@/components/graphs/advanced-skill-graph";
import { cn } from "@/lib/utils";
import type { LLMConfig } from "@/lib/llm/skill-extractor";
import type { AdvancedSkillMap } from "@/lib/analysis/skill-taxonomy";
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

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shrink-0">
              <Network className="h-5 w-5" />
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
              <Badge variant="outline" className="text-[10px] font-mono">
                @{githubUser.login}
              </Badge>
            )}
            {ownerInfo && (
              <Badge variant="outline" className="text-[10px] font-mono">
                {ownerInfo.kind}: {ownerInfo.info.login}
              </Badge>
            )}
            {skillMap && (
              <>
                <Button size="sm" variant="outline" onClick={() => exportData("json")}>
                  <Download className="h-3.5 w-3.5 mr-1" /> JSON
                </Button>
                <Button size="sm" variant="outline" onClick={() => exportData("markdown")}>
                  <Download className="h-3.5 w-3.5 mr-1" /> MD
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
                <FeatureChip icon={<Sparkles className="h-3.5 w-3.5" />} title="GLM skill extractor" desc="Each commit chunk → multi-dim JSON" />
                <FeatureChip icon={<Boxes className="h-3.5 w-3.5" />} title="5 dimensions" desc="Sector · Problem · Tech · Methodology · Role" />
                <FeatureChip icon={<Database className="h-3.5 w-3.5" />} title="Cached" desc="Re-loads last scan instantly" />
              </div>
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
                <Button className="w-full" onClick={() => setActiveTab("graph")}>
                  View skill graph →
                </Button>
              )}
            </div>
          </TabsContent>

          <TabsContent value="graph">
            {skillMap ? (
              <AdvancedSkillGraph skillMap={skillMap} focusRequest={focusRequest} compareRequest={compareRequest} />
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
                  // Bump the focusRequest with a fresh timestamp so the effect re-runs
                  // even if the user clicks the same person twice.
                  setFocusRequest(`${login}:${Date.now()}`);
                  setActiveTab("graph");
                }}
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
                  // Bump the compareRequest with a fresh timestamp so the
                  // effect re-runs even if the user clicks the same pair twice.
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
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t bg-background/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span>RepoMosaic Pro · Advanced Skill Map</span>
            <span>·</span>
            <span className="font-mono">GLM {setup.llmConfig.provider === "glm" ? "(default)" : `+ ${setup.llmConfig.provider}`}</span>
          </div>
          <div className="flex items-center gap-2">
            {scanStatus?.status === "running" && (
              <Button size="sm" variant="ghost" onClick={() => setActiveTab("scan")}>
                <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> scan running…
              </Button>
            )}
            <span>Test target: github.com/Gaia-Recipe</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureChip({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center gap-1.5 text-xs font-medium">
        {icon}
        {title}
      </div>
      <div className="text-[10px] text-muted-foreground mt-0.5">{desc}</div>
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
    <div className="flex flex-col items-center justify-center py-16 text-center max-w-md mx-auto">
      <div className="h-14 w-14 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground mb-3 ring-1 ring-border/50">
        {icon}
      </div>
      <div className="text-sm font-medium">{title}</div>
      <div className="text-xs text-muted-foreground mt-0.5 mb-4">{desc}</div>
      {action && (
        <Button size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}

function PeopleTable({
  skillMap,
  onSwitchToGraph,
}: {
  skillMap: AdvancedSkillMap;
  onSwitchToGraph: (login: string) => void;
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

  // No need for window events — the parent's onSwitchToGraph(login) callback
  // updates the focusRequest prop on AdvancedSkillGraph directly.
  const focusPerson = (login: string) => {
    onSwitchToGraph(login);
  };

  return (
    <div className="rounded-lg border overflow-hidden bg-card">
      <div className="flex items-center justify-between gap-3 p-3 border-b bg-muted/30">
        <div className="text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground">{skillMap.people.length}</span> contributors · click a row to inspect in Skill Graph
        </div>
        <Button size="sm" variant="outline" onClick={exportCsv} className="h-7 text-[11px] gap-1.5">
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
            {skillMap.people.map((p) => {
              const pct = (p.totalCommits / maxCommits) * 100;
              return (
                <tr
                  key={p.login}
                  className="border-t hover:bg-muted/40 transition-colors group cursor-pointer"
                  onClick={() => focusPerson(p.login)}
                  title={`Click to inspect ${p.name || p.login} in Skill Graph`}
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
  // Stronger contrast: opaque text + tinted bg + slightly darker border
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
