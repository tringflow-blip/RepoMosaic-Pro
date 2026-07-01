"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  KeyRound,
  Github,
  Sun,
  Moon,
  Settings2,
  Loader2,
  CheckCircle2,
  PlugZap,
  Eye,
  EyeOff,
  Network,
  Boxes,
  Zap,
  Cable,
  ExternalLink,
  Cpu,
  ShieldCheck,
  Lock,
  Unlock,
  FileSearch,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import type { LLMConfig } from "@/lib/llm/skill-extractor";
import {
  PROVIDERS,
  getProvider,
  normalizeProvider,
  type ProviderKind,
} from "@/lib/llm/providers";

export type SetupState = {
  githubToken: string;
  ownerInput: string;
  llmConfig: LLMConfig;
  /** When true, scan only repository metadata (name, description, language, topics, etc.)
   *  instead of cloning/fetching full commit contents. Useful for privacy and speed. */
  metadataOnly: boolean;
  /** When true, the metadataOnly toggle is locked and cannot be changed. */
  metadataOnlyLocked: boolean;
};

export type OwnerInfo = {
  login: string;
  name: string | null;
  description: string | null;
  avatarUrl: string;
  url: string;
  publicRepos: number;
  followers: number;
};

type Props = {
  setup: SetupState;
  setSetup: (s: SetupState) => void;
  onVerifyGithub: (token: string) => Promise<{ login: string; name: string | null; avatarUrl: string } | null>;
  onResolveOwner: (token: string, owner: string) => Promise<{ kind: "org" | "user"; info: OwnerInfo } | null>;
  onPingLLM: (config: LLMConfig) => Promise<{ ok: boolean; model: string; provider: string; error?: string }>;
  githubUser: { login: string; name: string | null; avatarUrl: string } | null;
  ownerInfo: { kind: "org" | "user"; info: OwnerInfo } | null;
  onLoadRepos: () => void;
};

export function SetupPanel({
  setup,
  setSetup,
  onVerifyGithub,
  onResolveOwner,
  onPingLLM,
  githubUser,
  ownerInfo,
  onLoadRepos,
}: Props) {
  const { theme, toggle } = useTheme();
  const { toast } = useToast();
  const [verifyingGithub, setVerifyingGithub] = useState(false);
  const [resolvingOwner, setResolvingOwner] = useState(false);
  const [pingingLLM, setPingingLLM] = useState(false);
  const [llmOk, setLlmOk] = useState<boolean | null>(null);
  const [showGithubToken, setShowGithubToken] = useState(false);
  const [showLlmKey, setShowLlmKey] = useState(false);

  const providerId = normalizeProvider(setup.llmConfig.provider);
  const providerInfo = getProvider(providerId);
  const models = useMemo(() => providerInfo.models, [providerInfo.id]);
  const currentModel = setup.llmConfig.model || providerInfo.defaultModel;
  const modelExistsInCatalog = models.some((m) => m.id === currentModel);

  // Static accent → logo color map. Every provider's accent dot uses one of
  // the 6 logo hex colors (orange/turquoise/red/purple/lightblue/blue).
  const ACCENT_DOT: Record<string, string> = {
    violet: "bg-methodology",    // #8A2BE2 purple
    emerald: "bg-tech",          // #40E0D0 turquoise
    amber: "bg-sector",          // #FFA500 orange
    rose: "bg-problem",          // #FF0000 red
    orange: "bg-sector",         // #FFA500 orange
    blue: "bg-people",           // #0000CD blue
    fuchsia: "bg-methodology",   // #8A2BE2 purple
    teal: "bg-tech",             // #40E0D0 turquoise
    slate: "bg-role",            // #87CEFA light blue
  };
  const providerDot = ACCENT_DOT[providerInfo.accent] ?? "bg-tech";

  const handleVerifyGithub = async () => {
    if (!setup.githubToken) {
      toast({ title: "Token required", description: "Paste a GitHub personal access token.", variant: "destructive" });
      return;
    }
    setVerifyingGithub(true);
    try {
      const u = await onVerifyGithub(setup.githubToken);
      if (u) {
        toast({ title: "Signed in", description: `Authenticated as @${u.login}` });
      }
    } catch (err) {
      toast({ title: "GitHub auth failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setVerifyingGithub(false);
    }
  };

  const handleResolveOwner = async () => {
    if (!setup.githubToken || !setup.ownerInput) {
      toast({ title: "Missing fields", description: "Token + org/user URL required.", variant: "destructive" });
      return;
    }
    setResolvingOwner(true);
    try {
      const r = await onResolveOwner(setup.githubToken, setup.ownerInput);
      if (r) {
        toast({ title: `Loaded ${r.kind}`, description: r.info.name || r.info.login });
      }
    } catch (err) {
      toast({ title: "Failed to load", description: (err as Error).message, variant: "destructive" });
    } finally {
      setResolvingOwner(false);
    }
  };

  const handlePingLLM = async () => {
    setPingingLLM(true);
    setLlmOk(null);
    try {
      const r = await onPingLLM(setup.llmConfig);
      setLlmOk(r.ok);
      if (r.ok) {
        toast({
          title: "Connection verified",
          description: `${providerInfo.label} · ${r.model}`,
        });
      } else {
        toast({
          title: "Connection failed",
          description: r.error ?? "Unknown error",
          variant: "destructive",
        });
      }
    } finally {
      setPingingLLM(false);
    }
  };

  const ready = !!githubUser && !!ownerInfo;

  return (
    <Card className="shadow-soft-lg animate-fade-in-up">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-md gradient-primary flex items-center justify-center">
                <Settings2 className="h-3.5 w-3.5 text-white" />
              </div>
              Setup
            </CardTitle>
            <CardDescription className="mt-1.5">
              Connect GitHub and pick an LLM provider.
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme" className="shrink-0 active-scale">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <Tabs defaultValue="github">
          <TabsList className="w-full bg-muted/50 p-1">
            <TabsTrigger value="github" className="flex-1 text-xs transition-all">
              <Github className="h-3 w-3 mr-1.5 text-people" /> GitHub
            </TabsTrigger>
            <TabsTrigger value="llm" className="flex-1 text-xs transition-all">
              <Cable className="h-3 w-3 mr-1.5 text-methodology" /> LLM Connection
            </TabsTrigger>
          </TabsList>

          <TabsContent value="github" className="space-y-3 mt-3">
            <div className="space-y-1.5">
              <Label htmlFor="gh-token" className="text-xs flex items-center gap-1.5">
                <KeyRound className="h-3 w-3 text-sector" /> GitHub Personal Access Token
              </Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="gh-token"
                    type={showGithubToken ? "text" : "password"}
                    placeholder="ghp_... or github_pat_..."
                    value={setup.githubToken}
                    onChange={(e) => setSetup({ ...setup, githubToken: e.target.value })}
                    className="pr-9 font-mono text-xs h-9 focus-ring"
                  />
                  <button
                    type="button"
                    onClick={() => setShowGithubToken(!showGithubToken)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showGithubToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
                <Button onClick={handleVerifyGithub} disabled={verifyingGithub} size="sm" className="h-9 active-scale">
                  {verifyingGithub ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Sign in"}
                </Button>
              </div>
              {githubUser && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1.5 animate-fade-in-up">
                  <CheckCircle2 className="h-3.5 w-3.5 text-tech" />
                  Authenticated as <Badge variant="outline" className="text-[10px] font-mono border-people/30 text-people">@{githubUser.login}</Badge>
                  {githubUser.name && <span>· {githubUser.name}</span>}
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-1.5">
              <Label htmlFor="owner" className="text-xs flex items-center gap-1.5">
                <Network className="h-3 w-3 text-problem" /> Organization or User URL
              </Label>
              <div className="flex gap-2">
                <Input
                  id="owner"
                  placeholder="https://github.com/your-org"
                  value={setup.ownerInput}
                  onChange={(e) => setSetup({ ...setup, ownerInput: e.target.value })}
                  className="font-mono text-xs h-9 focus-ring"
                />
                <Button onClick={handleResolveOwner} disabled={resolvingOwner} size="sm" className="h-9 active-scale">
                  {resolvingOwner ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Load"}
                </Button>
              </div>
              {ownerInfo && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1.5 animate-fade-in-up">
                  <CheckCircle2 className="h-3.5 w-3.5 text-tech" />
                  Loaded {ownerInfo.kind}
                  <Badge variant="outline" className="text-[10px] font-mono gradient-primary text-white border-0">@{ownerInfo.info.login}</Badge>
                  {ownerInfo.info.publicRepos != null && <span>· {ownerInfo.info.publicRepos} public repos</span>}
                  {ownerInfo.info.followers > 0 && <span>· {ownerInfo.info.followers} followers</span>}
                </div>
              )}
            </div>

            {/* Metadata-only scan toggle */}
            <div className="rounded-xl border p-3 space-y-2 animate-fade-in-up" style={{ borderColor: setup.metadataOnly ? 'rgba(0, 150, 136, 0.3)' : undefined, backgroundColor: setup.metadataOnly ? 'rgba(0, 150, 136, 0.04)' : undefined }}>
              <div className="flex items-center justify-between gap-3">
                <Label className="text-xs flex items-center gap-1.5 cursor-pointer">
                  <FileSearch className="h-3.5 w-3.5 text-primary" />
                  Metadata-only scan
                </Label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!setup.metadataOnlyLocked) {
                        setSetup({ ...setup, metadataOnly: !setup.metadataOnly });
                      }
                    }}
                    className={cn(
                      "relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus-ring",
                      setup.metadataOnly ? "bg-primary" : "bg-muted-foreground/30"
                    )}
                    disabled={setup.metadataOnlyLocked}
                    aria-label="Toggle metadata-only scan"
                  >
                    <span
                      className={cn(
                        "inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform shadow-sm",
                        setup.metadataOnly ? "translate-x-4" : "translate-x-0.5"
                      )}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSetup({ ...setup, metadataOnlyLocked: !setup.metadataOnlyLocked })}
                    className={cn(
                      "h-5 w-5 rounded flex items-center justify-center transition-colors",
                      setup.metadataOnlyLocked
                        ? "hover:bg-primary/10"
                        : "text-muted-foreground hover:bg-muted"
                    )}
                    style={{ color: setup.metadataOnlyLocked ? '#009688' : undefined }}
                    aria-label={setup.metadataOnlyLocked ? "Unlock metadata-only toggle" : "Lock metadata-only toggle"}
                  >
                    {setup.metadataOnlyLocked ? (
                      <Lock className="h-3 w-3" />
                    ) : (
                      <Unlock className="h-3 w-3" />
                    )}
                  </button>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                {setup.metadataOnly
                  ? "Scan will analyze repository metadata only (name, description, language, topics, README) — no commit contents are accessed. Faster and more private."
                  : "Scan will fetch and analyze commit contents for deep skill attribution. Switch to metadata-only for privacy or speed."
                }
              </p>
              {setup.metadataOnlyLocked && (
                <div className="flex items-center gap-1 text-[10px]" style={{ color: '#009688' }}>
                  <Lock className="h-2.5 w-2.5" />
                  Toggle locked — click the lock icon to unlock
                </div>
              )}
            </div>

            <Button
              onClick={onLoadRepos}
              disabled={!ready}
              size="sm"
              className="w-full h-10 active-scale transition-all duration-200 text-white hover:shadow-md shadow-sm"
              style={{ background: "linear-gradient(to right, #009688, #00796B)" }}
            >
              {ready ? (
                <>
                  Continue to repos <Zap className="h-3.5 w-3.5 ml-1.5 text-sector" />
                </>
              ) : (
                "Sign in + Load org first"
              )}
            </Button>
          </TabsContent>

          <TabsContent value="llm" className="space-y-3 mt-3">
            {/* Provider selector */}
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5">
                <Cable className="h-3 w-3 text-methodology" /> Provider
              </Label>
              <Select
                value={providerId}
                onValueChange={(v) => {
                  const next = getProvider(v as ProviderKind);
                  setSetup({
                    ...setup,
                    llmConfig: {
                      ...setup.llmConfig,
                      provider: v as ProviderKind,
                      // Switch to the new provider's default model + reset baseURL
                      // so the catalog URL takes effect.
                      model: next.defaultModel,
                      baseURL: undefined,
                      // Clear the key when switching to a no-key provider.
                      apiKey: next.requiresKey ? setup.llmConfig.apiKey : undefined,
                    },
                  });
                  setLlmOk(null);
                }}
              >
                <SelectTrigger className="h-9 text-xs focus-ring">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{p.label}</span>
                        <span className="text-muted-foreground text-[10px]">· {p.tagline}</span>
                        {p.sandboxDefault && (
                          <Badge variant="outline" className="text-[9px] py-0.5 px-1.5 ml-1 border font-semibold" style={{ backgroundColor: "rgba(0, 150, 136, 0.1)", color: "#00695C", borderColor: "rgba(0, 150, 136, 0.25)" }}>
                            Pre-configured
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Model selector */}
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5">
                <Cpu className="h-3 w-3 text-tech" /> Model
              </Label>
              <Select
                value={modelExistsInCatalog ? currentModel : "__custom__"}
                onValueChange={(v) => {
                  if (v === "__custom__") return;
                  setSetup({
                    ...setup,
                    llmConfig: { ...setup.llmConfig, model: v },
                  });
                  setLlmOk(null);
                }}
              >
                <SelectTrigger className="h-9 text-xs focus-ring">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {models.map((m) => (
                    <SelectItem key={m.id} value={m.id} className="text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{m.label}</span>
                        {m.hint && (
                          <span className="text-muted-foreground text-[10px]">· {m.hint}</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                  {!modelExistsInCatalog && currentModel && (
                    <SelectItem value="__custom__" className="text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-medium font-mono">{currentModel}</span>
                        <Badge variant="outline" className="text-[8px] py-0 px-1">custom</Badge>
                      </div>
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-foreground/60 font-mono truncate px-2 py-1 rounded bg-muted/50 inline-block">
                id: <span className="text-foreground/80 font-medium">{currentModel}</span>
              </p>
            </div>

            {/* API key — optional for sandbox default + local providers */}
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <KeyRound className="h-3 w-3 text-problem" /> API Key
                </span>
                {providerInfo.keyUrl && (
                  <a
                    href={providerInfo.keyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] font-medium hover:underline flex items-center gap-0.5"
                    style={{ color: "#009688" }}
                  >
                    get key <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                )}
              </Label>
              <div className="relative">
                <Input
                  type={showLlmKey ? "text" : "password"}
                  placeholder={
                    providerInfo.requiresKey
                      ? `Paste your ${providerInfo.label} key…`
                      : "Optional"
                  }
                  value={setup.llmConfig.apiKey ?? ""}
                  onChange={(e) =>
                    setSetup({ ...setup, llmConfig: { ...setup.llmConfig, apiKey: e.target.value } })
                  }
                  className={cn(
                    "pr-9 font-mono text-xs h-9 focus-ring",
                    providerInfo.requiresKey && !setup.llmConfig.apiKey &&
                      "ring-1 ring-sector/20"
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowLlmKey(!showLlmKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showLlmKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
              {!providerInfo.requiresKey && (
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <ShieldCheck className="h-2.5 w-2.5 text-primary" />
                  {providerInfo.sandboxDefault
                    ? "Pre-configured — runs through the built-in SDK."
                    : "Local server — no key needed."}
                </p>
              )}
            </div>

            {/* Provider info card */}
            <div className="text-[11px] text-muted-foreground space-y-1.5 p-3 rounded-xl bg-gradient-to-br from-muted/60 to-muted/30 border border-border/80 border-l-4 animate-fade-in-up" style={{ borderLeftColor: "rgba(0, 150, 136, 0.5)" }}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-foreground text-xs flex items-center gap-1.5">
                  <span className={cn("h-1.5 w-1.5 rounded-full", providerDot)} />
                  {providerInfo.label}
                </span>
                <span className="text-[10px]">{providerInfo.tagline}</span>
              </div>
              {providerInfo.baseURL && (
                <div className="font-mono text-[10px] truncate text-muted-foreground/80">
                  {providerInfo.baseURL}
                </div>
              )}
              <div className="flex items-center gap-1.5 pt-0.5 flex-wrap">
                <Badge variant="outline" className="text-[9px] font-mono py-0">
                  temp: 0.2
                </Badge>
                <Badge variant="outline" className="text-[9px] font-mono py-0">
                  5 dimensions
                </Badge>
                <Badge variant="outline" className="text-[9px] font-mono py-0">
                  JSON output
                </Badge>
                {providerInfo.authScheme === "x-api-key" && (
                  <Badge variant="outline" className="text-[9px] font-mono py-0">
                    x-api-key
                  </Badge>
                )}
              </div>
            </div>

            <Button
              onClick={handlePingLLM}
              disabled={pingingLLM}
              size="sm"
              className="w-full h-10 active-scale text-white shadow-sm hover:shadow-md transition-all duration-200"
              style={{ background: "linear-gradient(to right, #009688, #00796B)" }}
            >
              {pingingLLM ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : (
                <PlugZap className="h-3.5 w-3.5 mr-1.5" />
              )}
              Test connection
            </Button>
            {llmOk !== null && (
              <div
                className={cn(
                  "text-xs flex items-center gap-1.5 animate-fade-in-up px-3 py-1.5 rounded-lg border w-fit",
                  llmOk
                    ? "bg-tech/10 border-tech/20 text-tech"
                    : "text-destructive bg-destructive/10 border-destructive/20"
                )}
              >
                {llmOk ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <EyeOff className="h-3.5 w-3.5" />
                )}
                {llmOk
                  ? "Connection verified — ready to scan"
                  : "Connection failed — check the key or provider"}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
