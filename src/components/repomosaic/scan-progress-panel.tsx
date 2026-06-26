"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, AlertCircle, Cpu, Layers, GitCommit, Gauge, Zap, Download, FileText, Clock, XCircle } from "lucide-react";

export type ScanStatus = {
  id: string;
  org: string;
  ownerKind: string;
  branchMode: string;
  model: string;
  provider: string;
  status: "pending" | "running" | "completed" | "failed";
  progress: number;
  phase: string;
  message: string;
  totalRepos: number;
  doneRepos: number;
  totalCommitsScanning?: number; // commits discovered so far (across repos, all pages)
  totalChunks: number;
  doneChunks: number;
  failedChunks?: number; // chunks where LLM analysis failed (after retries)
  startedAt?: number;
  finishedAt?: number | null;
  result: unknown | null;
  error: string | null;
};

type Props = {
  status: ScanStatus | null;
  onCancel?: () => void;
};

// Phase definitions for the step indicator
const PHASES = [
  { key: "fetching", label: "Fetching commits" },
  { key: "analyzing", label: "Analyzing with LLM" },
  { key: "aggregating", label: "Aggregating results" },
  { key: "complete", label: "Complete" },
] as const;

function getCurrentPhaseIndex(phase: string, status: string): number {
  if (status === "completed") return 3;
  if (phase === "aggregating") return 2;
  if (phase === "analyzing") return 1;
  // "fetching-commits", "scanning", "pending", or anything else
  return 0;
}

function formatEta(seconds: number): string {
  if (seconds < 60) return `≈ ${Math.round(seconds)} sec remaining`;
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `≈ ${mins} min remaining`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `≈ ${hrs}h ${remMins}m remaining`;
}

export function ScanProgressPanel({ status, onCancel }: Props) {
  const { toast } = useToast();
  // Track elapsed time for ETA when scan is running
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!status || status.status !== "running") return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [status?.status]);

  if (!status) {
    return (
      <Card className="border-dashed">
        <CardContent className="pt-6 text-center text-sm text-muted-foreground">
          No scan running.
        </CardContent>
      </Card>
    );
  }

  const pct = Math.max(0, Math.min(100, status.progress));
  const done = status.status === "completed";
  const failed = status.status === "failed";
  const running = status.status === "running";
  const failedChunks = status.failedChunks ?? 0;
  const okChunks = status.doneChunks - failedChunks;
  const qualityPct = status.doneChunks > 0 ? Math.round((okChunks / status.doneChunks) * 100) : 100;
  const hasFailures = failedChunks > 0;
  const durationSec = status.startedAt
    ? Math.round(((status.finishedAt ?? Date.now()) - status.startedAt) / 1000)
    : 0;

  // ETA calculation
  let etaText: string | null = null;
  if (running && status.startedAt && status.doneRepos > 0 && status.totalRepos > status.doneRepos) {
    const elapsedSec = (now - status.startedAt) / 1000;
    if (elapsedSec > 0) {
      const rate = status.doneRepos / elapsedSec;
      if (rate > 0) {
        const remaining = (status.totalRepos - status.doneRepos) / rate;
        etaText = formatEta(remaining);
      }
    }
  }

  // Phase step indicator
  const currentPhaseIdx = getCurrentPhaseIndex(status.phase, status.status);

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      toast({ title: "Scan cancellation not yet implemented", description: "This feature is coming soon." });
    }
  };

  const downloadLog = (format: "text" | "json") => {
    if (!status.id) return;
    const url = `/api/scan/log?id=${encodeURIComponent(status.id)}&format=${format}`;
    window.open(url, "_blank");
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              {done ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : failed ? (
                <AlertCircle className="h-4 w-4 text-destructive" />
              ) : (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              )}
              Scan — {status.org}
            </CardTitle>
            <CardDescription className="mt-1 flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-[10px] font-mono py-0">
                {status.ownerKind}
              </Badge>
              <Badge variant="outline" className="text-[10px] font-mono py-0">
                {status.branchMode} branch
              </Badge>
              <Badge variant="outline" className="text-[10px] font-mono py-0">
                <Cpu className="h-2.5 w-2.5 mr-0.5" /> {status.model}
              </Badge>
              <Badge variant="outline" className="text-[10px] font-mono py-0">
                {status.provider}
              </Badge>
              {durationSec > 0 && (
                <Badge variant="outline" className="text-[10px] font-mono py-0">
                  {durationSec}s
                </Badge>
              )}
            </CardDescription>
          </div>
          <div className="text-right">
            <div className="text-2xl font-mono font-semibold tabular-nums">{pct}%</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
              {status.status}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Progress value={pct} className="h-2" />

        {/* Phase step indicator */}
        <div className="flex items-center gap-0">
          {PHASES.map((phase, idx) => {
            const isCompleted = idx < currentPhaseIdx;
            const isCurrent = idx === currentPhaseIdx;
            const isPending = idx > currentPhaseIdx;
            return (
              <div key={phase.key} className="flex items-center flex-1">
                <div className="flex flex-col items-center gap-1 flex-1">
                  <div
                    className={cn(
                      "h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold border-2 transition-colors",
                      isCompleted && "bg-emerald-500 border-emerald-500 text-white",
                      isCurrent && "bg-primary border-primary text-primary-foreground",
                      isPending && "bg-muted border-muted-foreground/30 text-muted-foreground"
                    )}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : (
                      idx + 1
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-[9px] leading-tight text-center",
                      isCurrent && "text-primary font-semibold",
                      isCompleted && "text-emerald-600 font-medium",
                      isPending && "text-muted-foreground"
                    )}
                  >
                    {phase.label}
                  </span>
                </div>
                {idx < PHASES.length - 1 && (
                  <div
                    className={cn(
                      "h-0.5 flex-1 -mt-4",
                      idx < currentPhaseIdx ? "bg-emerald-500" : "bg-muted-foreground/20"
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>

        <div className="text-sm text-muted-foreground flex items-center gap-2">
          <span>{status.message || status.phase}</span>
          {etaText && (
            <Badge variant="outline" className="text-[10px] font-mono py-0 gap-1">
              <Clock className="h-2.5 w-2.5" />
              {etaText}
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Metric
            icon={<Layers className="h-3.5 w-3.5" />}
            label="Repos"
            value={`${status.doneRepos}/${status.totalRepos}`}
          />
          <Metric
            icon={<GitCommit className="h-3.5 w-3.5" />}
            label="Commits fetched"
            value={status.totalCommitsScanning != null ? String(status.totalCommitsScanning) : "—"}
          />
          <Metric
            icon={<Cpu className="h-3.5 w-3.5" />}
            label="LLM chunks"
            value={`${status.doneChunks}/${status.totalChunks}`}
          />
        </div>

        {/* Scan quality indicator — only show when there are chunks done */}
        {status.doneChunks > 0 && (
          <div className="rounded-lg border bg-card p-3 space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="flex items-center gap-1.5 font-medium">
                <Gauge className="h-3.5 w-3.5" />
                Scan quality
              </span>
              <span className={cn("font-mono font-semibold", qualityPct === 100 ? "text-emerald-600" : qualityPct >= 80 ? "text-amber-600" : "text-destructive")}>
                {qualityPct}%
                <span className="text-muted-foreground font-normal ml-1.5">
                  ({okChunks} ok{hasFailures ? `, ${failedChunks} failed` : ""})
                </span>
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden flex">
              <div className="h-full bg-emerald-500" style={{ width: `${qualityPct}%` }} />
              {hasFailures && (
                <div className="h-full bg-destructive/70" style={{ width: `${100 - qualityPct}%` }} />
              )}
            </div>
            {hasFailures && (
              <div className="text-[10px] text-muted-foreground flex items-start gap-1">
                <AlertCircle className="h-3 w-3 mt-0.5 shrink-0 text-amber-600" />
                <span>
                  {failedChunks} chunk{failedChunks === 1 ? "" : "s"} could not be analyzed by the LLM
                  (rate-limit or network errors exhausted retries). Those chunks received a fallback
                  "Implementation" tag — {okChunks} chunk{okChunks === 1 ? "" : "s"} were fully analyzed.
                </span>
              </div>
            )}
            {done && !hasFailures && (
              <div className="text-[10px] text-emerald-600 flex items-center gap-1">
                <Zap className="h-3 w-3" />
                All chunks analyzed successfully.
              </div>
            )}
            {/* Download scan log — only show after some chunks have run */}
            <div className="flex items-center gap-2 pt-1 border-t">
              <span className="text-[10px] text-muted-foreground flex items-center gap-1 mr-auto">
                <FileText className="h-3 w-3" />
                Debug log
              </span>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[11px] px-2"
                onClick={() => downloadLog("text")}
                disabled={!status.id}
              >
                <Download className="h-3 w-3 mr-1" /> .log
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[11px] px-2"
                onClick={() => downloadLog("json")}
                disabled={!status.id}
              >
                <Download className="h-3 w-3 mr-1" /> .json
              </Button>
            </div>
          </div>
        )}

        {failed && status.error && (
          <div className="text-xs text-destructive bg-destructive/10 p-2 rounded-lg border border-destructive/30">
            {status.error}
          </div>
        )}

        {done && (
          <div className="text-xs text-emerald-600 bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/30">
            Scan complete. The skill graph is ready below.
          </div>
        )}

        {/* Cancel scan button */}
        {running && (
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[11px] px-3 text-destructive border-destructive/50 hover:bg-destructive/10 hover:text-destructive"
              onClick={handleCancel}
            >
              <XCircle className="h-3 w-3 mr-1" />
              Cancel scan
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-2.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
        {icon}
        {label}
      </div>
      <div className="font-mono text-sm font-semibold mt-0.5">{value}</div>
    </div>
  );
}

// Local cn to avoid circular import edge-cases in this isolated component.
function cn(...classes: (string | false | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}
