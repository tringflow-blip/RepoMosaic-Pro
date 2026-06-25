"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Search, Star, GitFork, Archive, GitBranch, CheckCheck, Square } from "lucide-react";
import type { RepoInfo } from "@/lib/github/client";
import { cn } from "@/lib/utils";

type Props = {
  repos: RepoInfo[];
  selected: Set<string>;
  setSelected: (s: Set<string>) => void;
  branchMode: "main" | "all";
  setBranchMode: (m: "main" | "all") => void;
  commitsPerRepo: number;
  setCommitsPerRepo: (n: number) => void;
  commitsPerChunk: number;
  setCommitsPerChunk: (n: number) => void;
  onStartScan: () => void;
  scanning: boolean;
};

export function RepoListPanel({
  repos,
  selected,
  setSelected,
  branchMode,
  setBranchMode,
  commitsPerRepo,
  setCommitsPerRepo,
  commitsPerChunk,
  setCommitsPerChunk,
  onStartScan,
  scanning,
}: Props) {
  const [search, setSearch] = useState("");
  const [hideArchived, setHideArchived] = useState(true);
  const [hideForks, setHideForks] = useState(true);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return repos
      .filter((r) => (hideArchived ? !r.isArchived : true))
      .filter((r) => (hideForks ? !r.isFork : true))
      .filter((r) =>
        !q
          ? true
          : r.name.toLowerCase().includes(q) ||
            (r.description ?? "").toLowerCase().includes(q) ||
            (r.language ?? "").toLowerCase().includes(q) ||
            r.topics.some((t) => t.toLowerCase().includes(q))
      )
      .sort((a, b) => b.stars - a.stars || b.updatedAt.localeCompare(a.updatedAt));
  }, [repos, search, hideArchived, hideForks]);

  const toggle = (name: string) => {
    const next = new Set(selected);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setSelected(next);
  };

  const selectAll = () => setSelected(new Set(filtered.map((r) => r.name)));
  const deselectAll = () => setSelected(new Set());

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Repositories · {repos.length}</CardTitle>
            <CardDescription className="mt-1">
              {selected.size} selected · scan will fetch up to {commitsPerRepo} commits per repo,
              chunked {commitsPerChunk} per LLM call
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={selectAll} disabled={scanning}>
              <CheckCheck className="h-3.5 w-3.5 mr-1" /> All
            </Button>
            <Button variant="outline" size="sm" onClick={deselectAll} disabled={scanning}>
              <Square className="h-3.5 w-3.5 mr-1" /> None
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search repos, descriptions, languages, topics…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 text-sm h-9"
            />
          </div>
          <label className="flex items-center gap-1.5 text-xs">
            <Switch checked={hideArchived} onCheckedChange={setHideArchived} />
            <Archive className="h-3 w-3" /> Hide archived
          </label>
          <label className="flex items-center gap-1.5 text-xs">
            <Switch checked={hideForks} onCheckedChange={setHideForks} />
            <GitFork className="h-3 w-3" /> Hide forks
          </label>
        </div>

        {/* Repo list */}
        <div className="space-y-1 max-h-[340px] overflow-y-auto pr-1">
          {filtered.map((r) => (
            <label
              key={r.id}
              className={cn(
                "flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-all",
                selected.has(r.name)
                  ? "border-primary/30 bg-accent/50 shadow-soft"
                  : "border-transparent hover:border-border/60 hover:bg-muted/40"
              )}
            >
              <Checkbox
                checked={selected.has(r.name)}
                onCheckedChange={() => toggle(r.name)}
                className="mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{r.name}</span>
                  {r.language && (
                    <Badge variant="outline" className="text-[10px] font-mono py-0">
                      {r.language}
                    </Badge>
                  )}
                  {r.isArchived && (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground py-0">
                      <Archive className="h-2.5 w-2.5 mr-0.5" /> archived
                    </Badge>
                  )}
                  {r.isFork && (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground py-0">
                      <GitFork className="h-2.5 w-2.5 mr-0.5" /> fork
                    </Badge>
                  )}
                </div>
                {r.description && (
                  <div className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                    {r.description}
                  </div>
                )}
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-1 font-mono">
                  <span className="flex items-center gap-0.5">
                    <Star className="h-2.5 w-2.5" /> {r.stars}
                  </span>
                  <span className="flex items-center gap-0.5">
                    <GitFork className="h-2.5 w-2.5" /> {r.forks}
                  </span>
                  <span className="flex items-center gap-0.5">
                    <GitBranch className="h-2.5 w-2.5" /> {r.defaultBranch}
                  </span>
                  {r.topics.slice(0, 3).map((t) => (
                    <Badge key={t} variant="secondary" className="text-[9px] py-0 px-1">
                      {t}
                    </Badge>
                  ))}
                </div>
              </div>
            </label>
          ))}
          {filtered.length === 0 && (
            <div className="text-sm text-muted-foreground py-6 text-center">No repos match.</div>
          )}
        </div>

        {/* Scan options */}
        <div className="grid sm:grid-cols-3 gap-4 pt-2 border-t">
          <div className="space-y-2">
            <Label className="text-xs flex items-center gap-1.5">
              <GitBranch className="h-3 w-3" /> Branch mode
            </Label>
            <div className="flex items-center gap-2">
              <Switch
                checked={branchMode === "all"}
                onCheckedChange={(v) => setBranchMode(v ? "all" : "main")}
                disabled={scanning}
              />
              <span className="text-xs">
                {branchMode === "main" ? "Main only" : "All branches"}
              </span>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Commits per repo: {commitsPerRepo}</Label>
            <Slider
              value={[commitsPerRepo]}
              onValueChange={([v]) => setCommitsPerRepo(v)}
              min={5}
              max={100}
              step={5}
              disabled={scanning}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Commits per LLM chunk: {commitsPerChunk}</Label>
            <Slider
              value={[commitsPerChunk]}
              onValueChange={([v]) => setCommitsPerChunk(v)}
              min={2}
              max={12}
              step={1}
              disabled={scanning}
            />
          </div>
        </div>

        <Button
          onClick={onStartScan}
          disabled={scanning || selected.size === 0}
          className="w-full"
          size="lg"
        >
          {scanning ? "Scanning…" : `Start scan · ${selected.size} repos`}
        </Button>
      </CardContent>
    </Card>
  );
}
