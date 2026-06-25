"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, AlertCircle, Cpu, Layers, GitCommit } from "lucide-react";

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
  totalChunks: number;
  doneChunks: number;
  result: unknown | null;
  error: string | null;
};

type Props = {
  status: ScanStatus | null;
};

export function ScanProgressPanel({ status }: Props) {
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

        <div className="text-sm text-muted-foreground">{status.message || status.phase}</div>

        <div className="grid grid-cols-3 gap-3">
          <Metric
            icon={<Layers className="h-3.5 w-3.5" />}
            label="Repos"
            value={`${status.doneRepos}/${status.totalRepos}`}
          />
          <Metric
            icon={<GitCommit className="h-3.5 w-3.5" />}
            label="LLM chunks"
            value={`${status.doneChunks}/${status.totalChunks}`}
          />
          <Metric
            icon={<Cpu className="h-3.5 w-3.5" />}
            label="Provider"
            value={status.provider}
          />
        </div>

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
