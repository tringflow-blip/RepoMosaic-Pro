"use client";

import { useState, useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Merge,
  GitFork,
  Check,
  X,
  UserPlus,
  AlertTriangle,
  Shield,
  GitCommit,
  Boxes,
  Compass,
  Link2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdvancedSkillMap, PersonSkillRecord } from "@/lib/analysis/skill-taxonomy";
import type { PersonMergeRule } from "@/lib/analysis/person-merge";
import { isMergedPerson, type MergedPersonSkillRecord } from "@/lib/analysis/person-merge";

/* ------------------------------------------------------------------ */
/*  Props                                                               */
/* ------------------------------------------------------------------ */

type Props = {
  skillMap: AdvancedSkillMap;
  mergeRules: PersonMergeRule[];
  onMerge: (primaryLogin: string, mergedLogins: string[]) => Promise<void>;
  onUnmerge: (ruleId: string) => Promise<void>;
  onChangePrimary: (ruleId: string, newPrimary: string) => Promise<void>;
  onInspectPerson: (person: PersonSkillRecord) => void;
};

/* ------------------------------------------------------------------ */
/*  Main Component                                                      */
/* ------------------------------------------------------------------ */

export function PersonMergePanel({
  skillMap,
  mergeRules,
  onMerge,
  onUnmerge,
  onChangePrimary,
  onInspectPerson,
}: Props) {
  const [mergeMode, setMergeMode] = useState(false);
  const [selectedLogins, setSelectedLogins] = useState<Set<string>>(new Set());
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [primaryLogin, setPrimaryLogin] = useState<string>("");
  const [showManageDialog, setShowManageDialog] = useState(false);

  const mergedLoginSet = useMemo(() => {
    const set = new Set<string>();
    for (const rule of mergeRules) {
      for (const l of rule.mergedLogins) set.add(l);
    }
    return set;
  }, [mergeRules]);

  // Available (non-merged) people for selection in merge mode
  const availablePeople = useMemo(
    () => skillMap.people.filter((p) => !mergedLoginSet.has(p.login)),
    [skillMap.people, mergedLoginSet],
  );

  const toggleSelection = (login: string) => {
    setSelectedLogins((prev) => {
      const next = new Set(prev);
      if (next.has(login)) next.delete(login);
      else next.add(login);
      return next;
    });
  };

  const startMerge = () => {
    if (selectedLogins.size < 2) return;
    // Default: first selected is primary
    const logins = Array.from(selectedLogins);
    setPrimaryLogin(logins[0]);
    setShowConfirmDialog(true);
  };

  const confirmMerge = async () => {
    const logins = Array.from(selectedLogins);
    await onMerge(primaryLogin, logins);
    setSelectedLogins(new Set());
    setMergeMode(false);
    setShowConfirmDialog(false);
  };

  const cancelMerge = () => {
    setSelectedLogins(new Set());
    setMergeMode(false);
  };

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <Card className="shadow-soft animate-fade-in-up">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-lg gradient-people flex items-center justify-center text-white shrink-0">
                <Merge className="h-4.5 w-4.5" />
              </div>
              <div>
                <CardTitle className="text-base">Merge Accounts</CardTitle>
                <CardDescription className="text-xs">
                  Combine multiple GitHub accounts for the same person
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {!mergeMode ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px] active-scale"
                    onClick={() => setMergeMode(true)}
                    disabled={availablePeople.length < 2}
                  >
                    <Merge className="h-3 w-3 mr-1" /> Merge Accounts
                  </Button>
                  {mergeRules.length > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px] active-scale"
                      onClick={() => setShowManageDialog(true)}
                    >
                      <Shield className="h-3 w-3 mr-1" /> Manage ({mergeRules.length})
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <span className="text-[11px] text-muted-foreground">
                    Select 2+ people to merge
                  </span>
                  <Button
                    size="sm"
                    className="h-7 text-[11px] active-scale gradient-people text-white border-0"
                    onClick={startMerge}
                    disabled={selectedLogins.size < 2}
                  >
                    <Check className="h-3 w-3 mr-1" /> Merge ({selectedLogins.size})
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-[11px]"
                    onClick={cancelMerge}
                  >
                    <X className="h-3 w-3 mr-1" /> Cancel
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        {mergeRules.length > 0 && !mergeMode && (
          <CardContent className="pt-0">
            <div className="space-y-2">
              <p className="text-[11px] text-muted-foreground">
                Active merges — these accounts are combined when viewing skill data:
              </p>
              <div className="flex flex-wrap gap-2">
                {mergeRules.map((rule) => {
                  const primary = skillMap.people.find((p) => p.login === rule.primaryLogin);
                  const secondary = rule.mergedLogins.filter((l) => l !== rule.primaryLogin);
                  return (
                    <div
                      key={rule.id}
                      className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2"
                    >
                      <Avatar className="h-5 w-5 ring-1 ring-border/50">
                        <AvatarImage src={primary?.avatarUrl} />
                        <AvatarFallback className="text-[8px]">
                          {rule.primaryLogin[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs font-medium">
                        {primary?.name || rule.primaryLogin}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        ← {secondary.map((l) => `@${l}`).join(", ")}
                      </span>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-5 w-5 p-0 text-destructive hover:bg-destructive/10"
                              onClick={() => onUnmerge(rule.id)}
                            >
                              <GitFork className="h-3 w-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Unmerge (split back into separate accounts)</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* People selection list (merge mode) */}
      {mergeMode && (
        <Card className="shadow-soft animate-fade-in-up">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-people" />
              Select Accounts to Merge
            </CardTitle>
            <CardDescription className="text-xs">
              Click on people to select them. The first selected person will be the primary account (their name and avatar will be used).
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {availablePeople.length < 2 ? (
              <div className="text-center py-8">
                <AlertTriangle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">
                  Need at least 2 unmerged people to create a merge.
                  {mergedLoginSet.size > 0 && " All remaining people are already merged."}
                </p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
                {availablePeople.map((person) => {
                  const isSelected = selectedLogins.has(person.login);
                  const isFirst = isSelected && Array.from(selectedLogins)[0] === person.login;
                  return (
                    <div
                      key={person.login}
                      className={cn(
                        "flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-all",
                        isSelected
                          ? "bg-people/10 border-people/40 ring-1 ring-people/20"
                          : "hover:bg-muted/40 border-transparent",
                      )}
                      onClick={() => toggleSelection(person.login)}
                    >
                      <div className={cn(
                        "h-5 w-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all",
                        isSelected
                          ? "bg-people border-people text-white"
                          : "border-muted-foreground/30",
                      )}>
                        {isSelected && <Check className="h-3 w-3" />}
                      </div>
                      <Avatar className="h-8 w-8 shrink-0 ring-1 ring-border/50">
                        <AvatarImage src={person.avatarUrl} />
                        <AvatarFallback className="text-[10px]">{person.login[0]?.toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium truncate">{person.name || person.login}</span>
                          {isFirst && (
                            <Badge className="text-[9px] px-1.5 py-0 h-4 gradient-people text-white border-0">
                              Primary
                            </Badge>
                          )}
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate">@{person.login}</div>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground shrink-0">
                        <span className="flex items-center gap-1">
                          <GitCommit className="h-2.5 w-2.5" /> {person.totalCommits}
                        </span>
                        <span className="flex items-center gap-1">
                          <Boxes className="h-2.5 w-2.5" /> {person.totalChunks}
                        </span>
                        <span className="flex items-center gap-1">
                          <Compass className="h-2.5 w-2.5" /> {person.repos.length}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Merged People Preview */}
      {mergeRules.length > 0 && !mergeMode && (
        <Card className="shadow-soft animate-fade-in-up">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Link2 className="h-4 w-4 text-people" />
              Merged People
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2 max-h-[360px] overflow-y-auto custom-scrollbar pr-1">
              {skillMap.people
                .filter((p): p is MergedPersonSkillRecord => isMergedPerson(p))
                .map((person) => (
                  <div
                    key={person.login}
                    className="flex items-center gap-3 p-2.5 rounded-lg border bg-card hover:bg-accent/30 transition-colors cursor-pointer"
                    onClick={() => onInspectPerson(person)}
                  >
                    <Avatar className="h-8 w-8 shrink-0 ring-1 ring-border/50">
                      <AvatarImage src={person.avatarUrl} />
                      <AvatarFallback className="text-[10px]">{person.login[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium truncate">{person.name || person.login}</span>
                        <Badge className="text-[9px] px-1.5 py-0 h-4 gradient-people text-white border-0">
                          <Merge className="h-2.5 w-2.5 mr-0.5" /> Merged
                        </Badge>
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        @{person.login}
                        <span className="mx-1">+</span>
                        {person.mergedLogins!.filter((l) => l !== person.login).map((l) => (
                          <span key={l}>@{l} </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground shrink-0">
                      <span className="flex items-center gap-1">
                        <GitCommit className="h-2.5 w-2.5" /> {person.totalCommits}
                      </span>
                      <span className="flex items-center gap-1">
                        <Boxes className="h-2.5 w-2.5" /> {person.totalChunks}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confirm Merge Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Merge className="h-4 w-4 text-people" /> Confirm Account Merge
            </DialogTitle>
            <DialogDescription>
              Merged accounts will be combined into one. Their skills, commits, and activity will be aggregated. You can undo this later.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 mt-2">
            <div>
              <label className="text-xs font-medium mb-1.5 block">Primary Account</label>
              <p className="text-[10px] text-muted-foreground mb-2">
                The primary account's name and avatar will be used for the merged person.
              </p>
              <div className="space-y-1">
                {Array.from(selectedLogins).map((login) => {
                  const person = skillMap.people.find((p) => p.login === login);
                  const isPrimary = login === primaryLogin;
                  return (
                    <div
                      key={login}
                      className={cn(
                        "flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all",
                        isPrimary
                          ? "bg-people/10 border-people/40 ring-1 ring-people/20"
                          : "hover:bg-muted/40 border-transparent",
                      )}
                      onClick={() => setPrimaryLogin(login)}
                    >
                      <div className={cn(
                        "h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0",
                        isPrimary ? "bg-people border-people" : "border-muted-foreground/30",
                      )}>
                        {isPrimary && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                      </div>
                      <Avatar className="h-6 w-6 shrink-0 ring-1 ring-border/50">
                        <AvatarImage src={person?.avatarUrl} />
                        <AvatarFallback className="text-[8px]">{login[0]?.toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <span className="text-xs font-medium truncate">{person?.name || login}</span>
                        <span className="text-[10px] text-muted-foreground ml-1">@{login}</span>
                      </div>
                      {isPrimary && (
                        <Badge className="text-[8px] px-1 py-0 h-4 ml-auto gradient-people text-white border-0 shrink-0">
                          Primary
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-lg border border-people/20 bg-people/5 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <AlertTriangle className="h-3.5 w-3.5 text-people" />
                <span className="text-xs font-semibold text-people">What will happen</span>
              </div>
              <ul className="text-[10px] text-muted-foreground space-y-0.5 pl-5 list-disc">
                <li>All commits from the selected accounts will be combined</li>
                <li>Skills will be merged — overlapping skills get summed scores</li>
                <li>The primary account's name & avatar will be displayed</li>
                <li>This merge is saved and persists across page refreshes</li>
                <li>You can undo this merge at any time from the Manage panel</li>
              </ul>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="gradient-people text-white border-0 active-scale"
              onClick={confirmMerge}
            >
              <Merge className="h-3.5 w-3.5 mr-1" /> Merge {selectedLogins.size} Accounts
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manage Merges Dialog */}
      <Dialog open={showManageDialog} onOpenChange={setShowManageDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-people" /> Manage Merges
            </DialogTitle>
            <DialogDescription>
              View, modify, or undo account merges. Unmerging will split accounts back into separate people.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 mt-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
            {mergeRules.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">No active merges</p>
            ) : (
              mergeRules.map((rule) => {
                const primary = skillMap.people.find((p) => p.login === rule.primaryLogin);
                return (
                  <div key={rule.id} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7 ring-1 ring-border/50">
                          <AvatarImage src={primary?.avatarUrl} />
                          <AvatarFallback className="text-[9px]">{rule.primaryLogin[0]?.toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="text-xs font-semibold">{primary?.name || rule.primaryLogin}</div>
                          <div className="text-[10px] text-muted-foreground">@{rule.primaryLogin} (primary)</div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-[10px] text-destructive hover:bg-destructive/10"
                        onClick={async () => {
                          await onUnmerge(rule.id);
                        }}
                      >
                        <GitFork className="h-3 w-3 mr-1" /> Unmerge
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pl-9">
                      {rule.mergedLogins.filter((l) => l !== rule.primaryLogin).map((login) => {
                        const person = skillMap.people.find((p) => p.login === login);
                        return (
                          <Badge
                            key={login}
                            variant="outline"
                            className="text-[10px] gap-1 border-people/30 text-people"
                          >
                            <Avatar className="h-3.5 w-3.5">
                              <AvatarImage src={person?.avatarUrl} />
                              <AvatarFallback className="text-[6px]">{login[0]?.toUpperCase()}</AvatarFallback>
                            </Avatar>
                            @{login}
                          </Badge>
                        );
                      })}
                    </div>
                    {/* Change primary */}
                    <div className="pl-9">
                      <label className="text-[9px] text-muted-foreground uppercase tracking-wider block mb-1">Change primary to:</label>
                      <div className="flex flex-wrap gap-1">
                        {rule.mergedLogins.map((login) => (
                          <Button
                            key={login}
                            size="sm"
                            variant={login === rule.primaryLogin ? "secondary" : "outline"}
                            className={cn("h-5 text-[9px] px-2", login === rule.primaryLogin && "bg-people/10 text-people border-people/30")}
                            disabled={login === rule.primaryLogin}
                            onClick={() => onChangePrimary(rule.id, login)}
                          >
                            @{login}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
