"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  MapPin,
  Download,
  Upload,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Star,
  BarChart3,
  Users,
  Compass,
  Target,
  Wrench,
  Boxes,
  Shield,
  AlertTriangle,
  Sparkles,
  FileJson,
  X,
  Check,
  Edit3,
  Copy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { AdvancedSkillMap, PersonSkillRecord, SkillDimension } from "@/lib/analysis/skill-taxonomy";
import type {
  SkillGroupTemplate,
  SkillGroup,
  SkillMapping,
  PersonGroupScore,
} from "@/lib/analysis/skill-group-templates";
import {
  BUILTIN_TEMPLATES,
  BLANK_TEMPLATE,
  applyTemplate,
  applyTemplateOrg,
} from "@/lib/analysis/skill-group-templates";

/* ------------------------------------------------------------------ */
/*  Color key helpers                                                   */
/* ------------------------------------------------------------------ */

const COLOR_KEY_MAP: Record<string, { textClass: string; bgClass: string; gradientClass: string; barColor: string; label: string }> = {
  sector: { textClass: "text-sector", bgClass: "bg-sector", gradientClass: "gradient-sector", barColor: "#FFA500", label: "Orange" },
  problem: { textClass: "text-problem", bgClass: "bg-problem", gradientClass: "gradient-problem", barColor: "#FF0000", label: "Red" },
  tech: { textClass: "text-tech", bgClass: "bg-tech", gradientClass: "gradient-tech", barColor: "#40E0D0", label: "Teal" },
  methodology: { textClass: "text-methodology", bgClass: "bg-methodology", gradientClass: "gradient-methodology", barColor: "#8A2BE2", label: "Purple" },
  role: { textClass: "text-role", bgClass: "bg-role", gradientClass: "gradient-role", barColor: "#87CEFA", label: "Light Blue" },
  people: { textClass: "text-people", bgClass: "bg-people", gradientClass: "gradient-people", barColor: "#0000CD", label: "Blue" },
};

const DIMENSION_ICONS: Record<SkillDimension, typeof Compass> = {
  sector: Compass,
  problemType: Target,
  tech: Wrench,
  methodology: Boxes,
  role: Shield,
};

/* ------------------------------------------------------------------ */
/*  Props                                                               */
/* ------------------------------------------------------------------ */

type Props = {
  skillMap: AdvancedSkillMap;
  onSelectPerson?: (person: PersonSkillRecord) => void;
};

/* ------------------------------------------------------------------ */
/*  Main Component                                                      */
/* ------------------------------------------------------------------ */

export function SkillGroupMapPanel({ skillMap, onSelectPerson }: Props) {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<SkillGroupTemplate[]>(BUILTIN_TEMPLATES);
  const [customTemplates, setCustomTemplates] = useState<SkillGroupTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(BUILTIN_TEMPLATES[0].id);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<"fitness" | "commits" | "name">("fitness");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load custom templates from DB on mount
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/skill-group-templates");
        if (!r.ok) return;
        const data = await r.json();
        setCustomTemplates(data.custom || []);
      } catch {
        // ignore
      }
    })();
  }, []);

  const allTemplates = useMemo(
    () => [...templates, ...customTemplates],
    [templates, customTemplates],
  );

  const selectedTemplate = useMemo(
    () => allTemplates.find((t) => t.id === selectedTemplateId) ?? BUILTIN_TEMPLATES[0],
    [allTemplates, selectedTemplateId],
  );

  // Apply template to skill map
  const personScores = useMemo(
    () => applyTemplate(selectedTemplate, skillMap),
    [selectedTemplate, skillMap],
  );

  const orgScores = useMemo(
    () => applyTemplateOrg(selectedTemplate, skillMap),
    [selectedTemplate, skillMap],
  );

  // Sort people
  const sortedPeople = useMemo(() => {
    const list = [...personScores];
    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "fitness") cmp = a.fitnessScore - b.fitnessScore;
      else if (sortKey === "commits") cmp = a.totalCommits - b.totalCommits;
      else cmp = (a.name || a.login).localeCompare(b.name || b.login);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [personScores, sortKey, sortDir]);

  const toggleGroup = (name: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  // Download blank template
  const downloadBlankTemplate = () => {
    const json = JSON.stringify(BLANK_TEMPLATE, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "skill-group-template-blank.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Template downloaded", description: "Edit the JSON and re-upload it" });
  };

  // Download current template
  const downloadCurrentTemplate = () => {
    const { id, isBuiltIn, ...rest } = selectedTemplate;
    const json = JSON.stringify(rest, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `skill-group-template-${selectedTemplate.name.toLowerCase().replace(/\s+/g, "-")}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Template exported", description: selectedTemplate.name });
  };

  // Upload custom template
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed.name || !parsed.groups || !Array.isArray(parsed.groups)) {
        toast({ title: "Invalid template", description: "Template must have name and groups array", variant: "destructive" });
        return;
      }
      // Save to DB
      const r = await fetch("/api/skill-group-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.error || "Upload failed");
      }
      const saved = await r.json();
      setCustomTemplates((prev) => [saved, ...prev]);
      setSelectedTemplateId(saved.id);
      toast({ title: "Template uploaded", description: saved.name });
    } catch (err) {
      toast({ title: "Upload failed", description: (err as Error).message, variant: "destructive" });
    }
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Delete custom template
  const deleteTemplate = async (id: string) => {
    try {
      const r = await fetch("/api/skill-group-templates", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!r.ok) throw new Error("Delete failed");
      setCustomTemplates((prev) => prev.filter((t) => t.id !== id));
      if (selectedTemplateId === id) {
        setSelectedTemplateId(BUILTIN_TEMPLATES[0].id);
      }
      toast({ title: "Template deleted" });
    } catch (err) {
      toast({ title: "Delete failed", description: (err as Error).message, variant: "destructive" });
    }
  };

  // Toggle sort
  const toggleSort = (key: "fitness" | "commits" | "name") => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir(key === "name" ? "asc" : "desc"); }
  };

  return (
    <div className="space-y-4">
      {/* Template selector header */}
      <Card className="shadow-soft animate-fade-in-up">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-lg gradient-methodology flex items-center justify-center text-white shrink-0">
                <MapPin className="h-4.5 w-4.5" />
              </div>
              <div>
                <CardTitle className="text-base">Skill Group Map</CardTitle>
                <CardDescription className="text-xs">
                  Re-project skills through organizational perspectives
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[11px] active-scale"
                onClick={downloadBlankTemplate}
              >
                <Download className="h-3 w-3 mr-1" /> Format
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[11px] active-scale"
                onClick={downloadCurrentTemplate}
              >
                <FileJson className="h-3 w-3 mr-1" /> Export
              </Button>
              <label className="cursor-pointer">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[11px] active-scale"
                  asChild
                >
                  <span>
                    <Upload className="h-3 w-3 mr-1" /> Upload
                  </span>
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleUpload}
                />
              </label>
              <Button
                size="sm"
                className="h-7 text-[11px] active-scale gradient-sector text-white border-0"
                onClick={() => setShowCreateDialog(true)}
              >
                <Plus className="h-3 w-3 mr-1" /> Create
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1 block">
                Template
              </label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select a template…" />
                </SelectTrigger>
                <SelectContent>
                  {BUILTIN_TEMPLATES.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      <div className="flex items-center gap-2">
                        <Star className="h-3 w-3 text-sector" />
                        <span>{t.name}</span>
                        <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 ml-1">built-in</Badge>
                      </div>
                    </SelectItem>
                  ))}
                  {customTemplates.length > 0 && (
                    <>
                      <Separator className="my-1" />
                      {customTemplates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          <div className="flex items-center gap-2">
                            <Edit3 className="h-3 w-3 text-methodology" />
                            <span>{t.name}</span>
                            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 ml-1">custom</Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
            {selectedTemplate && !selectedTemplate.isBuiltIn && (
              <div className="flex items-end">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-9 w-9 text-destructive hover:bg-destructive/10"
                        onClick={() => deleteTemplate(selectedTemplate.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Delete this custom template</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            )}
          </div>
          {selectedTemplate && (
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
              {selectedTemplate.description}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Org-level group overview */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {orgScores.map((group) => {
          const color = COLOR_KEY_MAP[group.colorKey] ?? COLOR_KEY_MAP.tech;
          return (
            <Card key={group.name} className="shadow-soft animate-fade-in-up card-elevated">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`h-7 w-7 rounded-md ${color.gradientClass} flex items-center justify-center text-white shrink-0`}>
                    <BarChart3 className="h-3.5 w-3.5" />
                  </div>
                  <span className={`text-xs font-semibold ${color.textClass} truncate`}>
                    {group.name}
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-bold tabular-nums">{group.avgScore.toFixed(1)}</span>
                  <span className="text-[10px] text-muted-foreground">avg score</span>
                </div>
                <div className="flex items-center gap-1 mt-1">
                  <Users className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {group.peopleCount}/{skillMap.totalPeople} people
                  </span>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all duration-500", color.bgClass)}
                    style={{ width: `${Math.min(100, group.avgScore * 5)}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Person ranking table */}
      <Card className="shadow-soft animate-fade-in-up">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-people" />
              <CardTitle className="text-sm">Team Ranking</CardTitle>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                {personScores.length} people
              </Badge>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              Sort by:
              {(["fitness", "commits", "name"] as const).map((key) => (
                <Button
                  key={key}
                  size="sm"
                  variant={sortKey === key ? "secondary" : "ghost"}
                  className="h-6 text-[10px] px-2"
                  onClick={() => toggleSort(key)}
                >
                  {key === "fitness" ? "Fitness" : key === "commits" ? "Commits" : "Name"}
                  {sortKey === key && (
                    sortDir === "asc" ? <ChevronUp className="h-3 w-3 ml-0.5" /> : <ChevronDown className="h-3 w-3 ml-0.5" />
                  )}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-1.5 max-h-[480px] overflow-y-auto custom-scrollbar pr-1">
            {sortedPeople.map((person, idx) => (
              <PersonGroupRow
                key={person.login}
                person={person}
                rank={idx + 1}
                template={selectedTemplate}
                expandedGroups={expandedGroups}
                onToggleGroup={toggleGroup}
                onClick={() => {
                  const full = skillMap.people.find((p) => p.login === person.login);
                  if (full && onSelectPerson) onSelectPerson(full);
                }}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Template detail card */}
      <Card className="shadow-soft animate-fade-in-up">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Boxes className="h-4 w-4 text-methodology" />
            <CardTitle className="text-sm">Template Groups</CardTitle>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
              {selectedTemplate.groups.length} groups
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-3">
            {selectedTemplate.groups.map((group) => {
              const color = COLOR_KEY_MAP[group.colorKey] ?? COLOR_KEY_MAP.tech;
              const orgGroup = orgScores.find((g) => g.name === group.name);
              return (
                <div key={group.name} className="rounded-lg border bg-card p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`h-6 w-6 rounded ${color.gradientClass} flex items-center justify-center text-white text-[10px] font-bold shrink-0`}>
                        {group.name[0]}
                      </div>
                      <span className={`text-xs font-semibold ${color.textClass}`}>{group.name}</span>
                    </div>
                    {orgGroup && (
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        avg {orgGroup.avgScore.toFixed(1)} · {orgGroup.peopleCount} people
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mb-2">{group.description}</p>
                  <div className="flex flex-wrap gap-1">
                    {group.mappings.map((m, i) => {
                      const DimIcon = DIMENSION_ICONS[m.dimension];
                      return (
                        <TooltipProvider key={i}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge
                                variant="outline"
                                className={cn("text-[9px] px-1.5 py-0 h-5 gap-0.5 cursor-default", color.textClass, `border-${group.colorKey}/30`)}
                              >
                                <DimIcon className="h-2.5 w-2.5" />
                                {m.pattern === "*" ? "ALL" : m.pattern}
                                <span className="text-muted-foreground ml-0.5">×{m.weight}</span>
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-xs">
                              {m.dimension} · "{m.pattern}" · weight {m.weight}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Create Template Dialog */}
      <CreateTemplateDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSave={async (template) => {
          try {
            const r = await fetch("/api/skill-group-templates", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(template),
            });
            if (!r.ok) {
              const err = await r.json();
              throw new Error(err.error || "Save failed");
            }
            const saved = await r.json();
            setCustomTemplates((prev) => [saved, ...prev]);
            setSelectedTemplateId(saved.id);
            setShowCreateDialog(false);
            toast({ title: "Template created", description: saved.name });
          } catch (err) {
            toast({ title: "Save failed", description: (err as Error).message, variant: "destructive" });
          }
        }}
        onDuplicate={async (template) => {
          // Duplicate a built-in or custom template as a new custom one
          const { id, isBuiltIn, ...rest } = template;
          try {
            const r = await fetch("/api/skill-group-templates", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...rest, name: `${rest.name} (Copy)` }),
            });
            if (!r.ok) {
              const err = await r.json();
              throw new Error(err.error || "Duplicate failed");
            }
            const saved = await r.json();
            setCustomTemplates((prev) => [saved, ...prev]);
            setSelectedTemplateId(saved.id);
            toast({ title: "Template duplicated", description: saved.name });
          } catch (err) {
            toast({ title: "Duplicate failed", description: (err as Error).message, variant: "destructive" });
          }
        }}
        currentTemplate={selectedTemplate}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Person Group Row                                                    */
/* ------------------------------------------------------------------ */

function PersonGroupRow({
  person,
  rank,
  template,
  expandedGroups,
  onToggleGroup,
  onClick,
}: {
  person: PersonGroupScore;
  rank: number;
  template: SkillGroupTemplate;
  expandedGroups: Set<string>;
  onToggleGroup: (name: string) => void;
  onClick: () => void;
}) {
  const isExpanded = expandedGroups.has(person.login);

  return (
    <div className="rounded-lg border bg-card hover:bg-accent/30 transition-colors">
      <div
        className="flex items-center gap-3 p-2.5 cursor-pointer"
        onClick={onClick}
      >
        {/* Rank */}
        <span className="text-[10px] font-mono text-muted-foreground w-5 text-right shrink-0">
          {rank}
        </span>

        {/* Avatar */}
        <Avatar className="h-7 w-7 shrink-0 ring-1 ring-border/50">
          <AvatarImage src={person.avatarUrl} />
          <AvatarFallback className="text-[10px]">{(person.name || person.login)[0]?.toUpperCase()}</AvatarFallback>
        </Avatar>

        {/* Name & login */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium truncate">{person.name || person.login}</span>
            <span className="text-[10px] text-muted-foreground truncate">@{person.login}</span>
          </div>
          {/* Mini group bars */}
          <div className="flex gap-0.5 mt-1 h-1.5 rounded-full overflow-hidden bg-muted">
            {person.groups.map((g) => {
              const color = COLOR_KEY_MAP[g.colorKey] ?? COLOR_KEY_MAP.tech;
              const maxScore = Math.max(...person.groups.map((pg) => pg.score), 1);
              const width = (g.score / maxScore) * 100;
              return (
                <div
                  key={g.name}
                  className={cn(color.bgClass, "transition-all duration-500")}
                  style={{ width: `${Math.max(width, 2)}%` }}
                  title={`${g.name}: ${g.score.toFixed(1)}`}
                />
              );
            })}
          </div>
        </div>

        {/* Fitness score */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="text-right">
            <div className="text-sm font-bold tabular-nums text-sector">{person.fitnessScore}</div>
            <div className="text-[9px] text-muted-foreground">fitness</div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0"
            onClick={(e) => {
              e.stopPropagation();
              onToggleGroup(person.login);
            }}
          >
            {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
        </div>
      </div>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="px-3 pb-3 pt-0 space-y-2 border-t">
          {person.groups.map((g) => {
            const color = COLOR_KEY_MAP[g.colorKey] ?? COLOR_KEY_MAP.tech;
            const maxScore = Math.max(...person.groups.map((pg) => pg.score), 1);
            const pct = (g.score / maxScore) * 100;
            return (
              <div key={g.name} className="pt-2">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <div className={`h-4 w-4 rounded ${color.gradientClass} flex items-center justify-center text-white text-[8px] font-bold shrink-0`}>
                      {g.name[0]}
                    </div>
                    <span className={`text-[11px] font-semibold ${color.textClass}`}>{g.name}</span>
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground tabular-nums">{g.score.toFixed(1)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all duration-500", color.bgClass)}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {/* Contributions */}
                {g.contributions.length > 0 && (
                  <div className="flex flex-wrap gap-0.5 mt-1.5">
                    {g.contributions.slice(0, 8).map((c, i) => {
                      const DimIcon = DIMENSION_ICONS[c.dimension];
                      return (
                        <Badge key={i} variant="outline" className="text-[8px] px-1 py-0 h-4 gap-0.5">
                          <DimIcon className="h-2 w-2" />
                          {c.skillName}
                        </Badge>
                      );
                    })}
                    {g.contributions.length > 8 && (
                      <Badge variant="secondary" className="text-[8px] px-1 py-0 h-4">
                        +{g.contributions.length - 8} more
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Create Template Dialog                                              */
/* ------------------------------------------------------------------ */

function CreateTemplateDialog({
  open,
  onOpenChange,
  onSave,
  onDuplicate,
  currentTemplate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (template: Omit<SkillGroupTemplate, "id" | "isBuiltIn">) => Promise<void>;
  onDuplicate: (template: SkillGroupTemplate) => Promise<void>;
  currentTemplate: SkillGroupTemplate;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [groups, setGroups] = useState<SkillGroup[]>([
    {
      name: "Group 1",
      description: "",
      colorKey: "sector",
      mappings: [{ dimension: "tech", pattern: "React", weight: 1 }],
    },
  ]);
  const { toast } = useToast();

  const resetForm = useCallback(() => {
    setName("");
    setDescription("");
    setGroups([
      {
        name: "Group 1",
        description: "",
        colorKey: "sector",
        mappings: [{ dimension: "tech", pattern: "React", weight: 1 }],
      },
    ]);
  }, []);

  const addGroup = () => {
    const colorKeys = ["sector", "problem", "tech", "methodology", "role", "people"];
    const nextColor = colorKeys[groups.length % colorKeys.length];
    setGroups((prev) => [
      ...prev,
      {
        name: `Group ${prev.length + 1}`,
        description: "",
        colorKey: nextColor,
        mappings: [{ dimension: "tech", pattern: "", weight: 1 }],
      },
    ]);
  };

  const removeGroup = (idx: number) => {
    setGroups((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateGroup = (idx: number, updates: Partial<SkillGroup>) => {
    setGroups((prev) =>
      prev.map((g, i) => (i === idx ? { ...g, ...updates } : g)),
    );
  };

  const addMapping = (groupIdx: number) => {
    setGroups((prev) =>
      prev.map((g, i) =>
        i === groupIdx
          ? { ...g, mappings: [...g.mappings, { dimension: "tech" as SkillDimension, pattern: "", weight: 1 }] }
          : g,
      ),
    );
  };

  const removeMapping = (groupIdx: number, mappingIdx: number) => {
    setGroups((prev) =>
      prev.map((g, i) =>
        i === groupIdx
          ? { ...g, mappings: g.mappings.filter((_, mi) => mi !== mappingIdx) }
          : g,
      ),
    );
  };

  const updateMapping = (groupIdx: number, mappingIdx: number, updates: Partial<SkillMapping>) => {
    setGroups((prev) =>
      prev.map((g, i) =>
        i === groupIdx
          ? {
              ...g,
              mappings: g.mappings.map((m, mi) =>
                mi === mappingIdx ? { ...m, ...updates } : m,
              ),
            }
          : g,
      ),
    );
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    if (groups.length === 0) {
      toast({ title: "At least one group required", variant: "destructive" });
      return;
    }
    // Validate mappings have patterns
    for (const g of groups) {
      const empty = g.mappings.some((m) => !m.pattern.trim());
      if (empty) {
        toast({ title: `Group "${g.name}" has empty patterns`, variant: "destructive" });
        return;
      }
    }
    await onSave({ name: name.trim(), description: description.trim(), groups });
    resetForm();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-sector" />
            Create Custom Skill Group Map
          </DialogTitle>
          <DialogDescription>
            Define your own skill groups and mapping rules. Each group maps existing skills to a new perspective.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Quick actions */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[11px]"
              onClick={() => onDuplicate(currentTemplate)}
            >
              <Copy className="h-3 w-3 mr-1" /> Duplicate &quot;{currentTemplate.name}&quot;
            </Button>
          </div>

          <Separator />

          {/* Template info */}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium mb-1 block">Template Name *</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. My Company Skill Map"
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Description</label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What perspective does this template represent?"
                className="h-8 text-xs"
              />
            </div>
          </div>

          <Separator />

          {/* Groups */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold">Groups ({groups.length})</span>
              <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={addGroup}>
                <Plus className="h-3 w-3 mr-1" /> Add Group
              </Button>
            </div>

            {groups.map((group, gIdx) => {
              const color = COLOR_KEY_MAP[group.colorKey] ?? COLOR_KEY_MAP.tech;
              return (
                <div key={gIdx} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className={`h-6 w-6 rounded ${color.gradientClass} flex items-center justify-center text-white text-[9px] font-bold shrink-0`}>
                      {group.name[0]}
                    </div>
                    <Input
                      value={group.name}
                      onChange={(e) => updateGroup(gIdx, { name: e.target.value })}
                      className="h-7 text-xs flex-1"
                      placeholder="Group name"
                    />
                    <Select
                      value={group.colorKey}
                      onValueChange={(v) => updateGroup(gIdx, { colorKey: v })}
                    >
                      <SelectTrigger className="h-7 w-24 text-[10px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(COLOR_KEY_MAP).map(([key, val]) => (
                          <SelectItem key={key} value={key}>
                            <div className="flex items-center gap-1.5">
                              <div className={`h-3 w-3 rounded ${val.bgClass}`} />
                              <span className="text-[10px]">{val.label}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                      onClick={() => removeGroup(gIdx)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <Input
                    value={group.description}
                    onChange={(e) => updateGroup(gIdx, { description: e.target.value })}
                    className="h-7 text-xs"
                    placeholder="Group description"
                  />
                  {/* Mappings */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                        Mappings ({group.mappings.length})
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-5 text-[10px] px-1.5"
                        onClick={() => addMapping(gIdx)}
                      >
                        <Plus className="h-2.5 w-2.5 mr-0.5" /> Add
                      </Button>
                    </div>
                    {group.mappings.map((mapping, mIdx) => (
                      <div key={mIdx} className="flex items-center gap-1.5">
                        <Select
                          value={mapping.dimension}
                          onValueChange={(v) =>
                            updateMapping(gIdx, mIdx, { dimension: v as SkillDimension })
                          }
                        >
                          <SelectTrigger className="h-6 w-28 text-[10px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sector">Sector</SelectItem>
                            <SelectItem value="problemType">Problem Type</SelectItem>
                            <SelectItem value="tech">Tech</SelectItem>
                            <SelectItem value="methodology">Methodology</SelectItem>
                            <SelectItem value="role">Role</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          value={mapping.pattern}
                          onChange={(e) =>
                            updateMapping(gIdx, mIdx, { pattern: e.target.value })
                          }
                          className="h-6 text-[10px] flex-1"
                          placeholder='Skill pattern (or "*" for all)'
                        />
                        <Input
                          type="number"
                          min={0}
                          max={1}
                          step={0.1}
                          value={mapping.weight}
                          onChange={(e) =>
                            updateMapping(gIdx, mIdx, {
                              weight: Math.max(0, Math.min(1, parseFloat(e.target.value) || 0)),
                            })
                          }
                          className="h-6 w-14 text-[10px] text-center"
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => removeMapping(gIdx, mIdx)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" className="gradient-sector text-white border-0 active-scale" onClick={handleSave}>
            <Check className="h-3.5 w-3.5 mr-1" /> Create Template
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
