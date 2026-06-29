"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Github,
  Sparkles,
  Cable,
  KeyRound,
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
  Lightbulb,
  TrendingUp,
  Target,
  ChevronDown,
  ChevronUp,
  Search,
  Keyboard,
  MapPin,
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
import { PdfExportButton } from "@/components/repomosaic/pdf-export-button";
import { SkillGroupMapPanel } from "@/components/repomosaic/skill-group-map-panel";
import { PersonMergePanel } from "@/components/repomosaic/person-merge-panel";
import { applyMergeRules, type PersonMergeRule } from "@/lib/analysis/person-merge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { LLMConfig } from "@/lib/llm/skill-extractor";
import type { AdvancedSkillMap, PersonSkillRecord } from "@/lib/analysis/skill-taxonomy";
import type { RepoInfo } from "@/lib/github/client";

export default function Home() {
  const { toast } = useToast();

  const [setup, setSetup] = useState<SetupState>({
    githubToken: "",
    ownerInput: "https://github.com/Gaia-Recipe",
    llmConfig: { provider: "zai", model: "glm-4-plus" },
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
  // Keyboard shortcuts overlay
  const [showShortcuts, setShowShortcuts] = useState(false);
  // Person merge rules (persisted)
  const [mergeRules, setMergeRules] = useState<PersonMergeRule[]>([]);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ---- Merged skill map ----
  // Apply merge rules to the raw skill map, producing a combined view
  const mergedSkillMap = useMemo(() => {
    if (!skillMap) return null;
    if (mergeRules.length === 0) return skillMap;
    return applyMergeRules(skillMap, mergeRules);
  }, [skillMap, mergeRules]);

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

  // Cancel a running scan — calls POST /api/scan/cancel which sets a flag the
  // scan loop checks between chunks. Partial results are still aggregated.
  const cancelScan = useCallback(async () => {
    if (!scanId) return;
    try {
      const r = await fetch("/api/scan/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: scanId }),
      });
      const data = await r.json().catch(() => ({}));
      if (data.alreadyDone) {
        toast({ title: "Scan already finished", description: `Status: ${data.status}` });
      } else if (r.ok) {
        toast({
          title: "Cancelling scan…",
          description: "Finishing current chunk, then aggregating partial results.",
        });
      } else {
        toast({ title: "Cancel failed", description: data.error ?? "Unknown error", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Cancel failed", description: (err as Error).message, variant: "destructive" });
    }
  }, [scanId, toast]);

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
        } else if (s.status === "cancelled") {
          // Scan was cancelled by the user — load partial results if any,
          // and stop polling. Stay on the scan tab so the user sees the
          // cancellation message and can navigate manually.
          if (s.result) {
            setSkillMap(s.result as AdvancedSkillMap);
          }
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

  // ---- Auto-load cached scan on mount (if no owner resolved yet) ----
  useEffect(() => {
    if (ownerInfo || skillMap) return; // skip if already loaded
    const tryAutoLoad = async () => {
      try {
        const org = "Gaia-Recipe";
        const url = new URL("/api/settings", window.location.origin);
        url.searchParams.set("org", org);
        url.searchParams.set("ownerKind", "org");
        url.searchParams.set("branchMode", branchMode);
        url.searchParams.set("model", setup.llmConfig.model ?? "glm-4-plus");
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
    tryAutoLoad();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount

  // ---- Cache check on owner load ----
  useEffect(() => {
    if (!ownerInfo) {
      return; // don't clear skillMap — auto-load may have set it
    }
    const checkCache = async () => {
      try {
        const url = new URL("/api/settings", window.location.origin);
        url.searchParams.set("org", ownerInfo.info.login);
        url.searchParams.set("ownerKind", ownerInfo.kind);
        url.searchParams.set("branchMode", branchMode);
        url.searchParams.set("model", setup.llmConfig.model ?? "glm-4-plus");
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

  // ---- Load merge rules when skill map is available ----
  useEffect(() => {
    if (!skillMap) return;
    const loadMerges = async () => {
      try {
        const r = await fetch(`/api/person-merge?org=${encodeURIComponent(skillMap.org)}`);
        if (!r.ok) return;
        const data = await r.json();
        setMergeRules(data.rules || []);
      } catch {
        // ignore
      }
    };
    loadMerges();
  }, [skillMap]);

  // ---- Merge API handlers ----
  const handleMerge = useCallback(async (primaryLogin: string, mergedLogins: string[]) => {
    if (!skillMap) return;
    try {
      const r = await fetch("/api/person-merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org: skillMap.org, primaryLogin, mergedLogins }),
      });
      if (!r.ok) {
        const e = await r.json();
        throw new Error(e.error || "Merge failed");
      }
      const data = await r.json();
      setMergeRules((prev) => [...prev, data.rule]);
      toast({ title: "Accounts merged", description: `${mergedLogins.length} accounts → @${primaryLogin}` });
    } catch (err) {
      toast({ title: "Merge failed", description: (err as Error).message, variant: "destructive" });
    }
  }, [skillMap, toast]);

  const handleUnmerge = useCallback(async (ruleId: string) => {
    try {
      const r = await fetch("/api/person-merge", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: ruleId }),
      });
      if (!r.ok) throw new Error("Unmerge failed");
      setMergeRules((prev) => prev.filter((r) => r.id !== ruleId));
      toast({ title: "Accounts unmerged", description: "People are now separate again" });
    } catch (err) {
      toast({ title: "Unmerge failed", description: (err as Error).message, variant: "destructive" });
    }
  }, [toast]);

  const handleChangePrimary = useCallback(async (ruleId: string, newPrimary: string) => {
    try {
      const rule = mergeRules.find((r) => r.id === ruleId);
      if (!rule) return;
      const r = await fetch("/api/person-merge", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: ruleId, primaryLogin: newPrimary, mergedLogins: rule.mergedLogins }),
      });
      if (!r.ok) throw new Error("Update failed");
      const data = await r.json();
      setMergeRules((prev) => prev.map((r) => r.id === ruleId ? data.rule : r));
      toast({ title: "Primary account changed", description: `Now using @${newPrimary}` });
    } catch (err) {
      toast({ title: "Update failed", description: (err as Error).message, variant: "destructive" });
    }
  }, [mergeRules, toast]);

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

  // Use REAL commit activity data from the skillMap (aggregated by the scan
  // pipeline from actual commit dates). Falls back to empty for old cached
  // scans that don't have date info.
  const heatmapData = useMemo(() => {
    if (!mergedSkillMap || !mergedSkillMap.activity) return [];
    return mergedSkillMap.activity;
  }, [mergedSkillMap]);

  // ---- Keyboard shortcuts ----
  // 1-9 switches tabs (when not typing in an input), Esc closes the person
  // panel, "/" focuses the People-tab search box.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't trigger when typing in inputs/textareas/selects
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)) {
        if (e.key === "Escape" && target.blur) target.blur();
        return;
      }
      if (e.key === "Escape") {
        if (showShortcuts) { setShowShortcuts(false); return; }
        if (selectedPerson) setSelectedPerson(null);
        return;
      }
      // "?" toggles shortcuts overlay
      if (e.key === "?") {
        setShowShortcuts((prev) => !prev);
        e.preventDefault();
        return;
      }
      // "/" focuses the People-tab search box
      if (e.key === "/") {
        const input = document.getElementById("people-search-input") as HTMLInputElement | null;
        if (input) {
          setActiveTab("people");
          // Defer focus until after the tab switch renders
          setTimeout(() => input.focus(), 50);
          e.preventDefault();
          return;
        }
      }
      // Tab switching with 1-9
      const tabs = ["setup", "repos", "scan", "graph", "people", "analytics", "activity", "compare", "insights", "skillmap"];
      const idx = parseInt(e.key, 10) - 1;
      if (idx >= 0 && idx < tabs.length) {
        const targetTab = tabs[idx];
        // Guard: repos/scan require ownerInfo
        if ((targetTab === "repos" || targetTab === "scan") && !ownerInfo) return;
        // Guard: graph/people/analytics/activity/compare/insights/skillmap require skillMap
        if ((targetTab === "graph" || targetTab === "people" || targetTab === "analytics" || targetTab === "activity" || targetTab === "compare" || targetTab === "insights" || targetTab === "skillmap") && !skillMap) return;
        setActiveTab(targetTab);
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [skillMap, ownerInfo, selectedPerson, showShortcuts]);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b shadow-sm bg-background/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl overflow-hidden shrink-0 shadow-soft ring-1 ring-border/40 hover:scale-105 transition-transform cursor-pointer">
              <img
                src="/logo.png"
                alt="RepoMosaic Pro logo"
                className="h-full w-full object-cover"
              />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-semibold tracking-tight truncate">
                RepoMosaic Pro
              </h1>
              <p className="text-[10px] text-muted-foreground hidden sm:block">
                Multi-dimensional skill attribution for GitHub organizations
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
          <TabsList className="mb-5 flex-wrap h-auto bg-muted/50 p-1 rounded-lg">
            <TabsTrigger value="setup" className="text-xs">
              <Sparkles className="h-3.5 w-3.5 mr-1.5 text-sector" /> Setup
            </TabsTrigger>
            <TabsTrigger value="repos" className="text-xs" disabled={!ownerInfo}>
              <Github className="h-3.5 w-3.5 mr-1.5 text-people" /> Repos
            </TabsTrigger>
            <TabsTrigger value="scan" className="text-xs" disabled={!ownerInfo}>
              <Loader2 className="h-3.5 w-3.5 mr-1.5 text-tech" /> Scan
            </TabsTrigger>
            <TabsTrigger value="graph" className="text-xs" disabled={!skillMap}>
              <Network className="h-3.5 w-3.5 mr-1.5 text-methodology" /> Skill Graph
            </TabsTrigger>
            <TabsTrigger value="people" className="text-xs" disabled={!skillMap}>
              <Users className="h-3.5 w-3.5 mr-1.5 text-people" /> People
            </TabsTrigger>
            <TabsTrigger value="analytics" className="text-xs" disabled={!skillMap}>
              <BarChart3 className="h-3.5 w-3.5 mr-1.5 text-problem" /> Analytics
            </TabsTrigger>
            <TabsTrigger value="activity" className="text-xs" disabled={!skillMap}>
              <Activity className="h-3.5 w-3.5 mr-1.5 text-role" /> Activity
            </TabsTrigger>
            <TabsTrigger value="compare" className="text-xs" disabled={!skillMap}>
              <ArrowLeftRight className="h-3.5 w-3.5 mr-1.5 text-methodology" /> Compare
            </TabsTrigger>
            <TabsTrigger value="insights" className="text-xs" disabled={!skillMap}>
              <Lightbulb className="h-3.5 w-3.5 mr-1.5 text-sector" /> Insights
            </TabsTrigger>
            <TabsTrigger value="skillmap" className="text-xs" disabled={!skillMap}>
              <MapPin className="h-3.5 w-3.5 mr-1.5 text-tech" /> Skill Map
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
                  icon={<Cable className="h-4 w-4 text-sector" />}
                  title="LLM Skill Attribution"
                  desc="Each commit chunk → multi-dim JSON tags"
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
              {/* Welcome / Onboarding for first-time visitors */}
              {!githubUser && !ownerInfo && (
                <div className="mt-6 rounded-xl border border-dashed border-border/60 bg-muted/20 p-5 space-y-4">
                  <h3 className="text-sm font-semibold text-center">How it works</h3>
                  <div className="grid sm:grid-cols-3 gap-4 text-center">
                    <div className="space-y-1.5">
                      <div className="h-10 w-10 rounded-full bg-sector/10 text-sector flex items-center justify-center mx-auto">
                        <KeyRound className="h-5 w-5" />
                      </div>
                      <p className="text-xs font-medium">1. Connect GitHub</p>
                      <p className="text-[10px] text-muted-foreground">Paste a personal access token and pick an org or user</p>
                    </div>
                    <div className="space-y-1.5">
                      <div className="h-10 w-10 rounded-full bg-methodology/10 text-methodology flex items-center justify-center mx-auto">
                        <Cable className="h-5 w-5" />
                      </div>
                      <p className="text-xs font-medium">2. Scan commits</p>
                      <p className="text-[10px] text-muted-foreground">Select repos and run the skill attribution scan</p>
                    </div>
                    <div className="space-y-1.5">
                      <div className="h-10 w-10 rounded-full bg-tech/10 text-tech flex items-center justify-center mx-auto">
                        <Network className="h-5 w-5" />
                      </div>
                      <p className="text-xs font-medium">3. Explore skills</p>
                      <p className="text-[10px] text-muted-foreground">Browse the skill graph, compare people, export reports</p>
                    </div>
                  </div>
                </div>
              )}
              {/* Quick Stats Banner when data is loaded */}
              {mergedSkillMap && (
                <div className="mt-4 rounded-xl border bg-card p-4 shadow-soft animate-fade-in-up">
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="h-4 w-4 text-sector" />
                    <span className="text-sm font-semibold">Last Scan Summary</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <QuickStat label="People" value={mergedSkillMap.totalPeople} icon={<Users className="h-3.5 w-3.5" />} color="text-people" />
                    <QuickStat label="Commits" value={mergedSkillMap.totalCommits} icon={<GitCommit className="h-3.5 w-3.5" />} color="text-sector" />
                    <QuickStat label="Chunks" value={mergedSkillMap.totalChunks} icon={<Boxes className="h-3.5 w-3.5" />} color="text-methodology" />
                    <QuickStat label="Repos" value={mergedSkillMap.totalRepos} icon={<Github className="h-3.5 w-3.5" />} color="text-problem" />
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
              <ScanProgressPanel status={scanStatus} onCancel={cancelScan} />
              {scanStatus?.status === "completed" && skillMap && (
                <Button className="w-full active-scale" onClick={() => setActiveTab("graph")}>
                  View skill graph <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              )}
              {scanStatus?.status === "cancelled" && skillMap && (
                <Button variant="outline" className="w-full active-scale border-sector/50 text-sector hover:bg-sector/10" onClick={() => setActiveTab("graph")}>
                  View partial results <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              )}
            </div>
          </TabsContent>

          <TabsContent value="graph">
            {mergedSkillMap ? (
              <AdvancedSkillGraph
                skillMap={mergedSkillMap}
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
            {mergedSkillMap ? (
              <div className="space-y-4">
                <PersonMergePanel
                  skillMap={mergedSkillMap}
                  mergeRules={mergeRules}
                  onMerge={handleMerge}
                  onUnmerge={handleUnmerge}
                  onChangePrimary={handleChangePrimary}
                  onInspectPerson={(person) => setSelectedPerson(person)}
                />
                <PeopleTable
                  skillMap={mergedSkillMap}
                  onSwitchToGraph={(login) => {
                    setFocusRequest(`${login}:${Date.now()}`);
                    setActiveTab("graph");
                  }}
                  onInspectPerson={(person) => setSelectedPerson(person)}
                />
              </div>
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
            {mergedSkillMap ? (
              <div className="space-y-4">
                <div className="flex items-center justify-end gap-2">
                  <PdfExportButton skillMap={mergedSkillMap} />
                </div>
                <AnalyticsPanel
                  skillMap={mergedSkillMap}
                  onComparePair={(a, b) => {
                    setCompareRequest(`${a}|${b}:${Date.now()}`);
                    setActiveTab("graph");
                  }}
                />
              </div>
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
            {mergedSkillMap && mergedSkillMap.people.length >= 2 ? (
              <SkillComparison skillMap={mergedSkillMap} />
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
            {mergedSkillMap ? (
              <div className="space-y-6">
                <div className="rounded-xl border bg-card p-5 shadow-soft animate-fade-in-up">
                  <div className="flex items-center gap-2 mb-4">
                    <Activity className="h-4 w-4 text-problem" />
                    <h3 className="text-sm font-semibold">Commit Activity</h3>
                    {mergedSkillMap.firstCommitDate && mergedSkillMap.lastCommitDate && (
                      <Badge variant="outline" className="text-[10px] font-mono ml-auto">
                        {mergedSkillMap.firstCommitDate} → {mergedSkillMap.lastCommitDate}
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {mergedSkillMap.totalCommits} total commits
                    </Badge>
                  </div>
                  {heatmapData.length > 0 ? (
                    <CommitHeatmap
                      data={heatmapData}
                      totalCommits={mergedSkillMap.totalCommits}
                    />
                  ) : (
                    <div className="text-xs text-muted-foreground italic py-8 text-center">
                      No commit date data in this scan. Re-run the scan to populate the heatmap with real activity.
                    </div>
                  )}
                </div>

                {/* People Activity Ranking */}
                <div className="rounded-xl border bg-card p-5 shadow-soft animate-fade-in-up stagger-1">
                  <div className="flex items-center gap-2 mb-4">
                    <Users className="h-4 w-4 text-people" />
                    <h3 className="text-sm font-semibold">Contributor Activity</h3>
                  </div>
                  <div className="space-y-3">
                    {mergedSkillMap.people
                      .sort((a, b) => b.totalCommits - a.totalCommits)
                      .map((p, i) => {
                        const maxCommits = mergedSkillMap.people[0]?.totalCommits ?? 1;
                        const pct = (p.totalCommits / maxCommits) * 100;
                        return (
                          <div key={p.login} className="flex items-center gap-3 group cursor-pointer hover:bg-muted/40 -mx-2 px-2 py-1.5 rounded-lg transition-colors" onClick={() => setSelectedPerson(p)}>
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
                      { label: "Sectors", items: mergedSkillMap.orgSectors, color: "bg-sector", textClass: "text-sector" },
                      { label: "Problem Types", items: mergedSkillMap.orgProblemTypes, color: "bg-problem", textClass: "text-problem" },
                      { label: "Tech", items: mergedSkillMap.orgTech, color: "bg-tech", textClass: "text-tech" },
                      { label: "Methodologies", items: mergedSkillMap.orgMethodologies, color: "bg-methodology", textClass: "text-methodology" },
                      { label: "Roles", items: mergedSkillMap.orgRoles, color: "bg-role", textClass: "text-role" },
                    ].map((dim) => {
                      const totalScore = dim.items.reduce((sum, s) => sum + s.score, 0);
                      return (
                        <div key={dim.label}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className={`text-xs font-medium ${dim.textClass}`}>{dim.label}</span>
                            <span className="text-[10px] text-muted-foreground tabular-nums">{dim.items.length} unique</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden flex">
                            {dim.items.slice(0, 8).map((item, i) => {
                              const width = totalScore > 0 ? (item.score / totalScore) * 100 : 0;
                              const opacityCls = ["opacity-100", "opacity-90", "opacity-80", "opacity-70", "opacity-60", "opacity-50", "opacity-40", "opacity-30"][i] ?? "opacity-30";
                              return (
                                <div
                                  key={item.name}
                                  className={cn(dim.color, "first:rounded-l-full last:rounded-r-full transition-all hover:brightness-110", opacityCls)}
                                  style={{ width: `${Math.max(width, 1)}%` }}
                                  title={`${item.name}: ${item.score.toFixed(1)} score · ${item.commits} commits · ${item.people} people`}
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

          <TabsContent value="insights">
            {mergedSkillMap ? (
              <InsightsPanel skillMap={mergedSkillMap} onSelectPerson={(p) => setSelectedPerson(p)} />
            ) : (
              <EmptyState
                icon={<Lightbulb className="h-6 w-6" />}
                title="No insights yet"
                desc="Run a scan to see AI-style recommendations based on skill gaps and team coverage."
                action={{ label: "Go to Scan", onClick: () => setActiveTab("scan") }}
              />
            )}
          </TabsContent>

          <TabsContent value="skillmap">
            {mergedSkillMap ? (
              <SkillGroupMapPanel
                skillMap={mergedSkillMap}
                onSelectPerson={(p) => setSelectedPerson(p)}
              />
            ) : (
              <EmptyState
                icon={<MapPin className="h-6 w-6" />}
                title="No skill group map yet"
                desc="Run a scan first, then use skill group templates to re-project skills through organizational perspectives."
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
              <div className="h-4 w-4 rounded gradient-sector shrink-0" />
              <span className="font-medium">RepoMosaic Pro</span>
              <span className="text-border">·</span>
              <span>Skill Attribution</span>
            </div>
            <span className="text-border">·</span>
            <span className="font-mono text-muted-foreground">
              {setup.llmConfig.provider} / {setup.llmConfig.model ?? "auto"}
            </span>
            <span className="hidden md:inline text-border">·</span>
            <span className="hidden md:inline-flex items-center gap-1" title="Keyboard shortcuts: 1-9 switch tabs, / focus search, Esc close panel">
              <Keyboard className="h-3 w-3" />
              <kbd className="font-mono text-[9px] px-1 py-0.5 rounded border bg-muted">1-9</kbd>
              <kbd className="font-mono text-[9px] px-1 py-0.5 rounded border bg-muted">/</kbd>
              <kbd className="font-mono text-[9px] px-1 py-0.5 rounded border bg-muted">Esc</kbd>
              <button
                onClick={() => setShowShortcuts(true)}
                className="ml-0.5 h-4 w-4 rounded border bg-muted flex items-center justify-center hover:bg-accent transition-colors cursor-pointer"
                aria-label="Show keyboard shortcuts"
              >
                <span className="text-[9px] font-mono font-bold">?</span>
              </button>
            </span>
          </div>
          <div className="flex items-center gap-2">
            {scanStatus?.status === "running" && (
              <Button size="sm" variant="ghost" onClick={() => setActiveTab("scan")} className="h-6 text-[11px]">
                <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> scan running…
              </Button>
            )}
            <span>Built with <Heart className="h-2.5 w-2.5 inline text-sector" /> for engineering teams</span>
          </div>
        </div>
      </footer>

      {/* Person Detail Panel (Sheet/Drawer) */}
      <PersonDetailPanel
        person={selectedPerson}
        onClose={() => setSelectedPerson(null)}
      />

      {/* Keyboard Shortcuts Help Overlay */}
      <Dialog open={showShortcuts} onOpenChange={setShowShortcuts}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Keyboard className="h-4 w-4" /> Keyboard Shortcuts
            </DialogTitle>
            <DialogDescription>Quick navigation and actions</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            {[
              { keys: ["1-9"], desc: "Switch tabs" },
              { keys: ["?"], desc: "Show this help" },
              { keys: ["Esc"], desc: "Close panels / dialog" },
              { keys: ["/"], desc: "Focus search (on tabs that have it)" },
            ].map((s) => (
              <div key={s.desc} className="flex items-center justify-between py-1">
                <span className="text-muted-foreground">{s.desc}</span>
                <div className="flex gap-1">
                  {s.keys.map((k) => (
                    <kbd key={k} className="font-mono text-[10px] px-1.5 py-0.5 rounded border bg-muted">{k}</kbd>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function FeatureChip({ icon, title, desc, gradient }: { icon: React.ReactNode; title: string; desc: string; gradient: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 card-elevated animate-fade-in-up hover:shadow-md transition-shadow ring-1 ring-border/30">
      <div className="flex items-center gap-2.5 mb-1.5">
        <div className={`h-8 w-8 rounded-lg ${gradient} flex items-center justify-center text-white shrink-0`}>
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
    <div className="rounded-lg bg-muted/30 px-3 py-2 text-center hover:bg-muted/50 transition-colors ring-1 ring-border/30">
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
  const [sortKey, setSortKey] = useState<"commits" | "chunks" | "repos" | "name">("commits");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [query, setQuery] = useState("");

  const filteredPeople = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? skillMap.people.filter((p) =>
          p.login.toLowerCase().includes(q) ||
          (p.name ?? "").toLowerCase().includes(q) ||
          p.repos.some((r) => r.toLowerCase().includes(q)) ||
          p.sectors.some((s) => s.name.toLowerCase().includes(q)) ||
          p.tech.some((s) => s.name.toLowerCase().includes(q)) ||
          p.roles.some((s) => s.name.toLowerCase().includes(q))
        )
      : skillMap.people;
    const sorted = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = (a.name || a.login).localeCompare(b.name || b.login);
      else if (sortKey === "commits") cmp = a.totalCommits - b.totalCommits;
      else if (sortKey === "chunks") cmp = a.totalChunks - b.totalChunks;
      else if (sortKey === "repos") cmp = a.repos.length - b.repos.length;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [skillMap.people, sortKey, sortDir, query]);

  const toggleSort = (key: "commits" | "chunks" | "repos" | "name") => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  };

  const renderSortIcon = (active: boolean) =>
    active ? (
      sortDir === "asc" ? <ChevronUp className="h-3 w-3 inline ml-0.5" /> : <ChevronDown className="h-3 w-3 inline ml-0.5" />
    ) : null;

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
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 border-b bg-muted/30">
        <div className="text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground">{filteredPeople.length}</span>
          {query && <span> of {skillMap.people.length}</span>} contributors · click a row to inspect
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="h-3 w-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search name, skill, repo…  (press / to focus)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-7 w-[180px] sm:w-[260px] rounded-md border bg-background pl-7 pr-2 text-[11px] focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all"
              id="people-search-input"
            />
          </div>
          <Button size="sm" variant="outline" onClick={exportCsv} className="h-7 text-[11px] gap-1.5 active-scale">
            <Download className="h-3 w-3" /> CSV
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto hidden md:block">
        <table className="w-full text-xs">
          <thead className="bg-muted/60 sticky top-0 z-10 backdrop-blur-sm">
            <tr className="text-left">
              <th
                className="p-3 font-medium text-[10px] uppercase tracking-wide text-muted-foreground min-w-[220px] cursor-pointer hover:text-foreground transition-colors select-none"
                onClick={() => toggleSort("name")}
              >
                Person {renderSortIcon(sortKey === "name")}
              </th>
              <th
                className="p-3 font-medium text-[10px] uppercase tracking-wide text-muted-foreground w-[110px] cursor-pointer hover:text-foreground transition-colors select-none"
                onClick={() => toggleSort("commits")}
              >
                Commits {renderSortIcon(sortKey === "commits")}
              </th>
              <th
                className="p-3 font-medium text-[10px] uppercase tracking-wide text-muted-foreground w-[80px] cursor-pointer hover:text-foreground transition-colors select-none"
                onClick={() => toggleSort("chunks")}
              >
                Chunks {renderSortIcon(sortKey === "chunks")}
              </th>
              <th
                className="p-3 font-medium text-[10px] uppercase tracking-wide text-muted-foreground w-[70px] cursor-pointer hover:text-foreground transition-colors select-none"
                onClick={() => toggleSort("repos")}
              >
                Repos {renderSortIcon(sortKey === "repos")}
              </th>
              <th className="p-3 font-medium text-[10px] uppercase tracking-wide text-sector min-w-[160px]">Sectors</th>
              <th className="p-3 font-medium text-[10px] uppercase tracking-wide text-problem min-w-[180px]">Problem Types</th>
              <th className="p-3 font-medium text-[10px] uppercase tracking-wide text-tech min-w-[160px]">Tech</th>
              <th className="p-3 font-medium text-[10px] uppercase tracking-wide text-methodology min-w-[170px]">Methodologies</th>
              <th className="p-3 font-medium text-[10px] uppercase tracking-wide text-role min-w-[170px]">Roles</th>
            </tr>
          </thead>
          <tbody>
            {filteredPeople.map((p, idx) => {
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
            {filteredPeople.length === 0 && (
              <tr>
                <td colSpan={9} className="p-6 text-center text-muted-foreground">
                  {query ? `No contributors match "${query}"` : "No people detected."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile card view — shown below the md breakpoint */}
      <div className="md:hidden divide-y bg-card">
        {filteredPeople.map((p) => {
          const pct = (p.totalCommits / maxCommits) * 100;
          return (
            <button
              key={p.login}
              onClick={() => focusPerson(p)}
              className="w-full text-left p-3 hover:bg-muted/40 active:bg-muted/60 transition-colors"
            >
              {/* Header: avatar + name + stats */}
              <div className="flex items-center gap-2.5 mb-2.5">
                <Avatar className="h-10 w-10 shrink-0 ring-1 ring-border/60">
                  <AvatarImage src={p.avatarUrl} />
                  <AvatarFallback className="text-xs">{p.login[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate" title={p.name || p.login}>
                    {p.name || p.login}
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate">@{p.login}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono font-semibold text-sm tabular-nums">{p.totalCommits}</div>
                  <div className="text-[9px] text-muted-foreground uppercase tracking-wide">commits</div>
                </div>
              </div>

              {/* Commit bar */}
              <div className="h-1 rounded-full bg-muted overflow-hidden mb-2.5">
                <div className="h-full bg-people" style={{ width: `${pct}%` }} />
              </div>

              {/* Stats row */}
              <div className="flex items-center gap-3 mb-2.5 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <GitCommit className="h-2.5 w-2.5" />
                  <span className="font-mono tabular-nums">{p.totalChunks}</span> chunks
                </span>
                <span className="flex items-center gap-1">
                  <Boxes className="h-2.5 w-2.5" />
                  <span className="font-mono tabular-nums">{p.repos.length}</span> repos
                </span>
              </div>

              {/* Skill chips — compact */}
              {p.sectors.length > 0 && (
                <div className="mb-1.5">
                  <div className="text-[9px] uppercase tracking-wide text-sector font-semibold mb-1">Sectors</div>
                  <SkillChipList items={p.sectors} variant="sector" max={2} />
                </div>
              )}
              {p.tech.length > 0 && (
                <div className="mb-1.5">
                  <div className="text-[9px] uppercase tracking-wide text-tech font-semibold mb-1">Tech</div>
                  <SkillChipList items={p.tech} variant="tech" max={3} />
                </div>
              )}
              {p.roles.length > 0 && (
                <div>
                  <div className="text-[9px] uppercase tracking-wide text-role font-semibold mb-1">Roles</div>
                  <SkillChipList items={p.roles} variant="role" max={2} />
                </div>
              )}
            </button>
          );
        })}
        {filteredPeople.length === 0 && (
          <div className="p-6 text-center text-muted-foreground text-sm">
            {query ? `No contributors match "${query}"` : "No people detected."}
          </div>
        )}
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

/* ------------------------------------------------------------------ */
/*  InsightsPanel — AI-style recommendations derived from the skill map */
/* ------------------------------------------------------------------ */

type Insight = {
  id: string;
  type: "gap" | "concentration" | "opportunity" | "balance" | "coverage";
  title: string;
  description: string;
  severity: "info" | "warning" | "success";
  actionLabel?: string;
  onAction?: () => void;
  related?: string[];
};

function InsightsPanel({
  skillMap,
  onSelectPerson,
}: {
  skillMap: AdvancedSkillMap;
  onSelectPerson: (p: PersonSkillRecord) => void;
}) {
  const insights = useMemo<Insight[]>(() => {
    const out: Insight[] = [];

    // 1. Bus-factor detection: any repo where one person has > 80% share
    const busFactors: { repo: string; person: PersonSkillRecord; share: number }[] = [];
    for (const p of skillMap.people) {
      for (const o of p.ownership) {
        if (o.share >= 0.8 && o.commits >= 5) {
          busFactors.push({ repo: o.repo, person: p, share: o.share });
        }
      }
    }
    if (busFactors.length > 0) {
      out.push({
        id: "bus-factor",
        type: "concentration",
        title: `Bus-factor risk on ${busFactors.length} repo${busFactors.length === 1 ? "" : "s"}`,
        description: `${busFactors.slice(0, 3).map((b) => `${b.person.login} owns ${Math.round(b.share * 100)}% of ${b.repo}`).join("; ")}${busFactors.length > 3 ? ` … +${busFactors.length - 3} more` : ""}. Consider knowledge sharing or pair programming to reduce concentration risk.`,
        severity: "warning",
        actionLabel: "View person",
        onAction: () => busFactors[0] && onSelectPerson(busFactors[0].person),
        related: busFactors.map((b) => b.repo),
      });
    }

    // 2. Skill gap: seed skills mentioned in the taxonomy that no one has
    const allTech = new Set(skillMap.orgTech.map((t) => t.name.toLowerCase()));
    const commonMissing = ["Testing & QA", "CI/CD & Release Engineering", "Observability & Monitoring"]
      .filter((s) => !skillMap.orgProblemTypes.some((p) => p.name === s));
    if (commonMissing.length > 0 && skillMap.totalCommits > 30) {
      out.push({
        id: "skill-gap",
        type: "gap",
        title: `Potential practice gaps: ${commonMissing.join(", ")}`,
        description: `None of the scanned commits were tagged with these common engineering practices. This may indicate either a real gap or that they happen outside the scanned repos (e.g. in CI config files, .github/ workflows, or test files that the LLM didn't see).`,
        severity: "info",
      });
    }

    // 3. Tech diversity: ratio of unique tech to people
    const techPerPerson = skillMap.totalPeople > 0 ? skillMap.orgTech.length / skillMap.totalPeople : 0;
    if (techPerPerson >= 5) {
      out.push({
        id: "tech-diversity",
        type: "opportunity",
        title: `High tech diversity (${skillMap.orgTech.length} techs / ${skillMap.totalPeople} people = ${techPerPerson.toFixed(1)} per person)`,
        description: `The team works across a broad tech surface area. This is great for versatility but may indicate context-switching overhead. Consider grouping people with complementary stacks for cross-training.`,
        severity: "success",
      });
    } else if (techPerPerson < 2 && skillMap.orgTech.length > 0) {
      out.push({
        id: "tech-narrow",
        type: "concentration",
        title: `Narrow tech focus (${skillMap.orgTech.length} techs / ${skillMap.totalPeople} people)`,
        description: `The team concentrates on a small tech surface. This enables deep expertise but may limit adaptability to new requirements. Consider hack-days or rotation to broaden the stack.`,
        severity: "info",
      });
    }

    // 4. Sector coverage: only 1 sector → high concentration
    if (skillMap.orgSectors.length === 1) {
      out.push({
        id: "single-sector",
        type: "concentration",
        title: `Single-sector focus: ${skillMap.orgSectors[0].name}`,
        description: `All scanned commits fall under one sector. This is fine for specialised teams, but if the org is meant to be multi-domain, the scan may be missing repos from other sectors.`,
        severity: "info",
      });
    } else if (skillMap.orgSectors.length >= 4) {
      out.push({
        id: "multi-sector",
        type: "coverage",
        title: `Multi-sector coverage: ${skillMap.orgSectors.length} sectors`,
        description: `The team operates across ${skillMap.orgSectors.slice(0, 5).map((s) => s.name).join(", ")}. This breadth is a strength — cross-sector insights often drive innovation.`,
        severity: "success",
      });
    }

    // 5. Role balance: implementation vs architecture ratio
    const implCount = skillMap.orgRoles.find((r) => r.name === "Implementation")?.commits ?? 0;
    const archCount = skillMap.orgRoles.find((r) => r.name === "Architecture")?.commits ?? 0;
    const docCount = skillMap.orgRoles.find((r) => r.name === "Documentation")?.commits ?? 0;
    const totalRoleCommits = skillMap.orgRoles.reduce((s, r) => s + r.commits, 0) || 1;
    const docPct = (docCount / totalRoleCommits) * 100;
    if (docPct < 5 && skillMap.totalCommits > 50) {
      out.push({
        id: "low-docs",
        type: "balance",
        title: `Documentation commits are ${docPct.toFixed(1)}% of activity`,
        description: `Documentation is a small fraction of total commits. Consider a "docs-first" sprint or ADR (Architecture Decision Records) practice to capture institutional knowledge.`,
        severity: "info",
      });
    }
    if (archCount > 0 && implCount > 0 && archCount / implCount > 0.5) {
      out.push({
        id: "arch-heavy",
        type: "balance",
        title: `Architecture-heavy activity (${Math.round((archCount / (archCount + implCount)) * 100)}% arch vs impl)`,
        description: `A high ratio of architecture to implementation commits may indicate planning-heavy phase or that the team is designing without enough delivery follow-through. Watch for analysis-paralysis.`,
        severity: "info",
      });
    }

    // 6. Most diverse contributor — recognition insight
    const mostDiverse = [...skillMap.people]
      .map((p) => ({
        p,
        unique: p.sectors.length + p.problemTypes.length + p.tech.length + p.methodologies.length + p.roles.length,
      }))
      .sort((a, b) => b.unique - a.unique)[0];
    if (mostDiverse && mostDiverse.unique >= 10) {
      out.push({
        id: "diverse-contributor",
        type: "opportunity",
        title: `${mostDiverse.p.name || mostDiverse.p.login} is the team's polymath (${mostDiverse.unique} unique skills)`,
        description: `${mostDiverse.p.login} spans ${mostDiverse.p.sectors.length} sectors, ${mostDiverse.p.tech.length} techs, and ${mostDiverse.p.roles.length} roles. They're a strong candidate for mentoring, architecture review, or cross-team liaison.`,
        severity: "success",
        actionLabel: "View profile",
        onAction: () => onSelectPerson(mostDiverse.p),
      });
    }

    // 7. Top contributor dominance
    if (skillMap.people.length >= 3) {
      const sorted = [...skillMap.people].sort((a, b) => b.totalCommits - a.totalCommits);
      const topShare = sorted[0].totalCommits / skillMap.totalCommits;
      if (topShare >= 0.6) {
        out.push({
          id: "top-dominance",
          type: "concentration",
          title: `${sorted[0].login} contributes ${Math.round(topShare * 100)}% of all commits`,
          description: `One person drives the majority of activity. This is a high-risk pattern — they hold a lot of implicit knowledge. Consider rotating ownership, pair programming, or documentation sprints.`,
          severity: "warning",
          actionLabel: "View profile",
          onAction: () => onSelectPerson(sorted[0]),
        });
      }
    }

    // 8. Activity recency: last commit date
    if (skillMap.lastCommitDate) {
      const last = new Date(skillMap.lastCommitDate);
      const days = Math.floor((Date.now() - last.getTime()) / (1000 * 60 * 60 * 24));
      if (days > 90) {
        out.push({
          id: "stale-repos",
          type: "gap",
          title: `Last commit was ${days} days ago`,
          description: `The scanned repos haven't seen activity in over 3 months. They may be in maintenance mode, abandoned, or the team moved to other repos not included in the scan.`,
          severity: "info",
        });
      } else if (days <= 7) {
        out.push({
          id: "active",
          type: "coverage",
          title: `Active project — last commit ${days === 0 ? "today" : `${days} day${days === 1 ? "" : "s"} ago`}`,
          description: `The repos are under active development. Skill attribution data is current and reliable.`,
          severity: "success",
        });
      }
    }

    return out;
  }, [skillMap, onSelectPerson]);

  const severityStyles: Record<Insight["severity"], { border: string; bg: string; icon: React.ReactNode; label: string }> = {
    info: {
      border: "border-l-people/60",
      bg: "bg-people/5",
      icon: <Lightbulb className="h-4 w-4 text-people" />,
      label: "Info",
    },
    warning: {
      border: "border-l-sector/70",
      bg: "bg-sector/5",
      icon: <Target className="h-4 w-4 text-sector" />,
      label: "Watch",
    },
    success: {
      border: "border-l-tech/60",
      bg: "bg-tech/5",
      icon: <TrendingUp className="h-4 w-4 text-tech" />,
      label: "Strength",
    },
  };

  const typeLabels: Record<Insight["type"], string> = {
    gap: "Gap",
    concentration: "Concentration",
    opportunity: "Opportunity",
    balance: "Balance",
    coverage: "Coverage",
  };

  // Summary counts
  const counts = useMemo(() => ({
    warning: insights.filter((i) => i.severity === "warning").length,
    info: insights.filter((i) => i.severity === "info").length,
    success: insights.filter((i) => i.severity === "success").length,
  }), [insights]);

  return (
    <div className="space-y-5 animate-fade-in-up">
      {/* Header card with summary */}
      <div className="rounded-xl border bg-card p-5 shadow-soft">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="h-7 w-7 rounded-lg gradient-methodology flex items-center justify-center">
                <Lightbulb className="h-4 w-4 text-white" />
              </div>
              <h3 className="text-sm font-semibold">Skill Insights & Recommendations</h3>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Auto-generated from the {skillMap.totalPeople}-person, {skillMap.totalCommits}-commit scan of <span className="font-mono">{skillMap.org}</span>. These are heuristic recommendations — use judgment when acting on them.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-4">
          <div className="rounded-lg border border-sector/30 bg-sector/5 p-2.5 text-center">
            <div className="text-xl font-bold tabular-nums text-sector">{counts.warning}</div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Watch</div>
          </div>
          <div className="rounded-lg border border-people/30 bg-people/5 p-2.5 text-center">
            <div className="text-xl font-bold tabular-nums text-people">{counts.info}</div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Info</div>
          </div>
          <div className="rounded-lg border border-tech/30 bg-tech/5 p-2.5 text-center">
            <div className="text-xl font-bold tabular-nums text-tech">{counts.success}</div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Strengths</div>
          </div>
        </div>
      </div>

      {/* Insights list */}
      <div className="space-y-2.5">
        {insights.map((insight, i) => {
          const style = severityStyles[insight.severity];
          return (
            <div
              key={insight.id}
              className={cn(
                "rounded-xl border border-l-4 bg-card p-4 shadow-soft animate-fade-in-up hover:shadow-md transition-shadow",
                style.border,
                style.bg
              )}
              style={{ animationDelay: `${Math.min(i * 50, 400)}ms` }}
            >
              <div className="flex items-start gap-3">
                <div className="shrink-0 mt-0.5">{style.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <h4 className="text-sm font-semibold leading-snug">{insight.title}</h4>
                    <Badge variant="outline" className="text-[9px] font-mono py-0 h-4">
                      {typeLabels[insight.type]}
                    </Badge>
                  </div>
                  <p className="text-[12px] text-muted-foreground leading-relaxed">{insight.description}</p>
                  {insight.related && insight.related.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {insight.related.slice(0, 5).map((r) => (
                        <span key={r} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          {r}
                        </span>
                      ))}
                      {insight.related.length > 5 && (
                        <span className="text-[10px] font-mono text-muted-foreground">+{insight.related.length - 5}</span>
                      )}
                    </div>
                  )}
                  {insight.actionLabel && insight.onAction && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-3 h-6 text-[11px] active-scale"
                      onClick={insight.onAction}
                    >
                      {insight.actionLabel} <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {insights.length === 0 && (
          <div className="rounded-xl border bg-card p-8 text-center">
            <Lightbulb className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No insights to surface yet. Run a deeper scan for more data.</p>
          </div>
        )}
      </div>
    </div>
  );
}
