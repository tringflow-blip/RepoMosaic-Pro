"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  KeyRound,
  Github,
  Sparkles,
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
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import type { LLMConfig } from "@/lib/llm/skill-extractor";

export type SetupState = {
  githubToken: string;
  ownerInput: string;
  llmConfig: LLMConfig;
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
    try {
      const r = await onPingLLM(setup.llmConfig);
      setLlmOk(r.ok);
      if (r.ok) {
        toast({ title: "LLM connected", description: `${r.provider} · ${r.model}` });
      } else {
        toast({ title: "LLM ping failed", description: r.error ?? "Unknown error", variant: "destructive" });
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
              <div className="h-6 w-6 rounded-md gradient-sector flex items-center justify-center">
                <Settings2 className="h-3.5 w-3.5 text-white" />
              </div>
              Setup
            </CardTitle>
            <CardDescription className="mt-1.5">
              Connect GitHub + configure the LLM skill extractor. GLM is pre-wired; you can also point at any
              OpenAI-compatible cloud or local endpoint.
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme" className="shrink-0 active-scale">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <Tabs defaultValue="github">
          <TabsList className="w-full">
            <TabsTrigger value="github" className="flex-1 text-xs">
              <Github className="h-3 w-3 mr-1.5" /> GitHub
            </TabsTrigger>
            <TabsTrigger value="llm" className="flex-1 text-xs">
              <Sparkles className="h-3 w-3 mr-1.5" /> LLM Skill
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
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
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
                  placeholder="https://github.com/Gaia-Recipe"
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
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  Loaded {ownerInfo.kind}
                  <Badge variant="outline" className="text-[10px] font-mono gradient-sector text-white border-0">@{ownerInfo.info.login}</Badge>
                  {ownerInfo.info.publicRepos != null && <span>· {ownerInfo.info.publicRepos} public repos</span>}
                  {ownerInfo.info.followers > 0 && <span>· {ownerInfo.info.followers} followers</span>}
                </div>
              )}
            </div>

            <Button
              onClick={onLoadRepos}
              disabled={!ready}
              className="w-full active-scale"
              size="sm"
            >
              {ready ? (
                <>
                  Continue to repos <Zap className="h-3.5 w-3.5 ml-1.5" />
                </>
              ) : (
                "Sign in + Load org first"
              )}
            </Button>
          </TabsContent>

          <TabsContent value="llm" className="space-y-3 mt-3">
            <Tabs
              value={setup.llmConfig.provider}
              onValueChange={(v) =>
                setSetup({
                  ...setup,
                  llmConfig: { ...setup.llmConfig, provider: v as "glm" | "openai-compatible" },
                })
              }
            >
              <TabsList className="w-full">
                <TabsTrigger value="glm" className="flex-1 text-xs">
                  <Sparkles className="h-3 w-3 mr-1" /> GLM (default)
                </TabsTrigger>
                <TabsTrigger value="openai-compatible" className="flex-1 text-xs">
                  <PlugZap className="h-3 w-3 mr-1" /> OpenAI-compatible
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {setup.llmConfig.provider === "glm" && (
              <div className="text-[11px] text-muted-foreground space-y-2 p-4 rounded-xl bg-muted/40 border border-border/60 animate-fade-in-up">
                <div className="flex items-center gap-2">
                  <div className="h-5 w-5 rounded gradient-methodology flex items-center justify-center shrink-0">
                    <Sparkles className="h-3 w-3 text-white" />
                  </div>
                  <span className="font-medium text-foreground text-xs">GLM via z-ai-web-dev-sdk</span>
                </div>
                <div>The skill extractor uses the pre-authenticated GLM SDK. No API key required in this sandbox — every commit chunk is sent through the same reusable skill prompt.</div>
                <div className="flex items-center gap-2 pt-1">
                  <Badge variant="outline" className="text-[9px] font-mono py-0">model: glm (auto)</Badge>
                  <Badge variant="outline" className="text-[9px] font-mono py-0">temperature: 0.2</Badge>
                  <Badge variant="outline" className="text-[9px] font-mono py-0">5 dimensions</Badge>
                </div>
              </div>
            )}

            {setup.llmConfig.provider === "openai-compatible" && (
              <div className="space-y-2.5">
                <div className="space-y-1">
                  <Label className="text-xs">Base URL</Label>
                  <Input
                    placeholder="https://api.openai.com/v1  ·  http://localhost:11434/v1 (Ollama)  ·  http://localhost:8000/v1 (vLLM/codecs)"
                    value={setup.llmConfig.baseURL ?? ""}
                    onChange={(e) =>
                      setSetup({ ...setup, llmConfig: { ...setup.llmConfig, baseURL: e.target.value } })
                    }
                    className="font-mono text-xs h-9 focus-ring"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">API Key</Label>
                  <div className="relative">
                    <Input
                      type={showLlmKey ? "text" : "password"}
                      placeholder="sk-...  (or any non-empty string for local servers)"
                      value={setup.llmConfig.apiKey ?? ""}
                      onChange={(e) =>
                        setSetup({ ...setup, llmConfig: { ...setup.llmConfig, apiKey: e.target.value } })
                      }
                      className="pr-9 font-mono text-xs h-9 focus-ring"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLlmKey(!showLlmKey)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showLlmKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Model</Label>
                  <Input
                    placeholder="gpt-4o-mini  ·  llama3.1:8b  ·  qwen2.5-coder:7b"
                    value={setup.llmConfig.model ?? ""}
                    onChange={(e) =>
                      setSetup({ ...setup, llmConfig: { ...setup.llmConfig, model: e.target.value } })
                    }
                    className="font-mono text-xs h-9 focus-ring"
                  />
                </div>
              </div>
            )}

            <Button onClick={handlePingLLM} disabled={pingingLLM} variant="outline" size="sm" className="w-full active-scale">
              {pingingLLM ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <PlugZap className="h-3.5 w-3.5 mr-1.5" />}
              Test LLM connection
            </Button>
            {llmOk !== null && (
              <div className={cn("text-xs flex items-center gap-1.5 animate-fade-in-up", llmOk ? "text-emerald-600" : "text-destructive")}>
                {llmOk ? <CheckCircle2 className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                {llmOk ? "LLM reachable" : "LLM unreachable — check config"}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
