"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
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
  const [commitsPerRepo, setCommitsPerRepo] = useState(30);
  const [commitsPerChunk, setCommitsPerChunk] = useState(6);
  const [loadingRepos, setLoadingRepos] = useState(false);

  const [scanId, setScanId] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<ScanStatus | null>(null);
  const [skillMap, setSkillMap] = useState<AdvancedSkillMap | null>(null);
  const [activeTab, setActiveTab] = useState("setup");

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
          commitsPerRepo,
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
        description: `${selectedRepos.size} repos · ${branchMode} · ${setup.llmConfig.provider}`,
      });
    } catch (err) {
      toast({ title: "Scan failed to start", description: (err as Error).message, variant: "destructive" });
    }
  }, [branchMode, commitsPerChunk, commitsPerRepo, selectedRepos, setup, toast]);

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
                commitsPerRepo={commitsPerRepo}
                setCommitsPerRepo={setCommitsPerRepo}
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
              <AdvancedSkillGraph skillMap={skillMap} />
            ) : (
              <EmptyState icon={<Network className="h-6 w-6" />} title="No skill graph yet" desc="Run a scan first." />
            )}
          </TabsContent>

          <TabsContent value="people">
            {skillMap ? (
              <PeopleTable skillMap={skillMap} />
            ) : (
              <EmptyState icon={<Users className="h-6 w-6" />} title="No people yet" desc="Run a scan first." />
            )}
          </TabsContent>

          <TabsContent value="analytics">
            {skillMap ? (
              <AnalyticsPanel skillMap={skillMap} />
            ) : (
              <EmptyState icon={<BarChart3 className="h-6 w-6" />} title="No analytics yet" desc="Run a scan first." />
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

function EmptyState({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-3">
        {icon}
      </div>
      <div className="text-sm font-medium">{title}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
    </div>
  );
}

function PeopleTable({ skillMap }: { skillMap: AdvancedSkillMap }) {
  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr className="text-left">
              <th className="p-2 font-medium">Person</th>
              <th className="p-2 font-medium">Commits</th>
              <th className="p-2 font-medium">Chunks</th>
              <th className="p-2 font-medium">Repos</th>
              <th className="p-2 font-medium text-sector">Sectors</th>
              <th className="p-2 font-medium text-problem">Problem Types</th>
              <th className="p-2 font-medium text-tech">Tech</th>
              <th className="p-2 font-medium text-methodology">Methodologies</th>
              <th className="p-2 font-medium text-role">Roles</th>
            </tr>
          </thead>
          <tbody>
            {skillMap.people.map((p) => (
              <tr key={p.login} className="border-t hover:bg-muted/30">
                <td className="p-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate max-w-[140px]">{p.name || p.login}</span>
                    <span className="text-muted-foreground text-[10px]">@{p.login}</span>
                  </div>
                </td>
                <td className="p-2 font-mono">{p.totalCommits}</td>
                <td className="p-2 font-mono">{p.totalChunks}</td>
                <td className="p-2 font-mono">{p.repos.length}</td>
                <td className="p-2">
                  <div className="flex flex-wrap gap-1 max-w-[220px]">
                    {p.sectors.slice(0, 3).map((s) => (
                      <Badge key={s.name} variant="outline" className="text-[9px] py-0 border-sector/30 text-sector">
                        {s.name}
                      </Badge>
                    ))}
                  </div>
                </td>
                <td className="p-2">
                  <div className="flex flex-wrap gap-1 max-w-[220px]">
                    {p.problemTypes.slice(0, 3).map((s) => (
                      <Badge key={s.name} variant="outline" className="text-[9px] py-0 border-problem/30 text-problem">
                        {s.name}
                      </Badge>
                    ))}
                  </div>
                </td>
                <td className="p-2">
                  <div className="flex flex-wrap gap-1 max-w-[220px]">
                    {p.tech.slice(0, 4).map((s) => (
                      <Badge key={s.name} variant="outline" className="text-[9px] py-0 border-tech/30 text-tech">
                        {s.name}
                      </Badge>
                    ))}
                  </div>
                </td>
                <td className="p-2">
                  <div className="flex flex-wrap gap-1 max-w-[220px]">
                    {p.methodologies.slice(0, 3).map((s) => (
                      <Badge key={s.name} variant="outline" className="text-[9px] py-0 border-methodology/30 text-methodology">
                        {s.name}
                      </Badge>
                    ))}
                  </div>
                </td>
                <td className="p-2">
                  <div className="flex flex-wrap gap-1 max-w-[220px]">
                    {p.roles.slice(0, 3).map((s) => (
                      <Badge key={s.name} variant="outline" className="text-[9px] py-0 border-role/30 text-role">
                        {s.name}
                      </Badge>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
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
