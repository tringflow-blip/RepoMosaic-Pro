'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Compass,
  Target,
  Wrench,
  Boxes,
  Shield,
  GitCommitVertical,
  ArrowLeftRight,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  AdvancedSkillMap,
  PersonSkillRecord,
  SkillDimension,
} from '@/lib/analysis/skill-taxonomy';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

type Props = {
  skillMap: AdvancedSkillMap;
  /** Pre-select these two people */
  initialPair?: [string, string] | null;
  onBack?: () => void;
};

/* ------------------------------------------------------------------ */
/*  Dimension metadata                                                 */
/* ------------------------------------------------------------------ */

const DIMENSIONS: {
  key: SkillDimension;
  label: string;
  icon: typeof Compass;
  colorClass: string;
  barColor: string;
  fillColor: string;
}[] = [
  {
    key: 'sector',
    label: 'Sectors',
    icon: Compass,
    colorClass: 'text-sector',
    barColor: 'oklch(0.62 0.13 35)',
    fillColor: 'oklch(0.62 0.13 35 / 0.15)',
  },
  {
    key: 'problemType',
    label: 'Problem Types',
    icon: Target,
    colorClass: 'text-problem',
    barColor: 'oklch(0.62 0.13 145)',
    fillColor: 'oklch(0.62 0.13 145 / 0.15)',
  },
  {
    key: 'tech',
    label: 'Tech',
    icon: Wrench,
    colorClass: 'text-tech',
    barColor: 'oklch(0.55 0.11 250)',
    fillColor: 'oklch(0.55 0.11 250 / 0.15)',
  },
  {
    key: 'methodology',
    label: 'Methodologies',
    icon: Boxes,
    colorClass: 'text-methodology',
    barColor: 'oklch(0.62 0.13 305)',
    fillColor: 'oklch(0.62 0.13 305 / 0.15)',
  },
  {
    key: 'role',
    label: 'Roles',
    icon: Shield,
    colorClass: 'text-role',
    barColor: 'oklch(0.68 0.12 90)',
    fillColor: 'oklch(0.68 0.12 90 / 0.15)',
  },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getSkillsForDimension(
  person: PersonSkillRecord,
  dim: SkillDimension,
) {
  switch (dim) {
    case 'sector': return person.sectors;
    case 'problemType': return person.problemTypes;
    case 'tech': return person.tech;
    case 'methodology': return person.methodologies;
    case 'role': return person.roles;
  }
}

/* ------------------------------------------------------------------ */
/*  Overlap metric                                                     */
/* ------------------------------------------------------------------ */

function computeOverlap(
  a: PersonSkillRecord,
  b: PersonSkillRecord,
  dim: SkillDimension,
): { shared: string[]; onlyA: string[]; onlyB: string[]; pct: number } {
  const skillsA = new Set(getSkillsForDimension(a, dim).map((s) => s.name));
  const skillsB = new Set(getSkillsForDimension(b, dim).map((s) => s.name));
  const shared = [...skillsA].filter((s) => skillsB.has(s));
  const onlyA = [...skillsA].filter((s) => !skillsB.has(s));
  const onlyB = [...skillsB].filter((s) => !skillsA.has(s));
  const total = new Set([...skillsA, ...skillsB]).size;
  const pct = total > 0 ? Math.round((shared.length / total) * 100) : 0;
  return { shared, onlyA, onlyB, pct };
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export function SkillComparison({ skillMap, initialPair, onBack }: Props) {
  const people = skillMap.people;
  const [loginA, setLoginA] = useState(initialPair?.[0] ?? people[0]?.login ?? '');
  const [loginB, setLoginB] = useState(initialPair?.[1] ?? people[1]?.login ?? '');

  const personA = useMemo(() => people.find((p) => p.login === loginA), [people, loginA]);
  const personB = useMemo(() => people.find((p) => p.login === loginB), [people, loginB]);

  // Overall similarity
  const overallSimilarity = useMemo(() => {
    if (!personA || !personB) return 0;
    let totalShared = 0;
    let totalAll = 0;
    for (const dim of DIMENSIONS) {
      const overlap = computeOverlap(personA, personB, dim.key);
      totalShared += overlap.shared.length;
      totalAll += overlap.shared.length + overlap.onlyA.length + overlap.onlyB.length;
    }
    return totalAll > 0 ? Math.round((totalShared / totalAll) * 100) : 0;
  }, [personA, personB]);

  if (!personA || !personB) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
        Select two people to compare
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* Selection header */}
      <Card className="shadow-soft">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2 mb-2">
            <ArrowLeftRight className="h-4 w-4 text-methodology" />
            <CardTitle className="text-sm">Skill Comparison</CardTitle>
            {onBack && (
              <Button variant="ghost" size="sm" onClick={onBack} className="ml-auto h-7 text-xs">
                Back
              </Button>
            )}
          </div>
          <CardDescription>Compare two contributors side-by-side across all skill dimensions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Select value={loginA} onValueChange={setLoginA}>
              <SelectTrigger className="flex-1 h-9 text-xs">
                <SelectValue placeholder="Select person A" />
              </SelectTrigger>
              <SelectContent>
                {people.map((p) => (
                  <SelectItem key={p.login} value={p.login} className="text-xs">
                    {p.name || p.login}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="shrink-0 flex flex-col items-center gap-0.5">
              <div className="text-lg font-bold tabular-nums text-methodology">{overallSimilarity}%</div>
              <div className="text-[9px] text-muted-foreground uppercase tracking-wider">Similarity</div>
            </div>

            <Select value={loginB} onValueChange={setLoginB}>
              <SelectTrigger className="flex-1 h-9 text-xs">
                <SelectValue placeholder="Select person B" />
              </SelectTrigger>
              <SelectContent>
                {people.map((p) => (
                  <SelectItem key={p.login} value={p.login} className="text-xs">
                    {p.name || p.login}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Person headers side-by-side */}
      <div className="grid grid-cols-2 gap-4">
        <PersonHeader person={personA} />
        <PersonHeader person={personB} />
      </div>

      {/* Dimension-by-dimension comparison */}
      {DIMENSIONS.map((dim) => {
        const overlap = computeOverlap(personA, personB, dim.key);
        const Icon = dim.icon;
        const skillsA = getSkillsForDimension(personA, dim.key);
        const skillsB = getSkillsForDimension(personB, dim.key);
        const maxScoreA = skillsA.length > 0 ? Math.max(...skillsA.map((s) => s.score)) : 1;
        const maxScoreB = skillsB.length > 0 ? Math.max(...skillsB.map((s) => s.score)) : 1;

        return (
          <Card key={dim.key} className="shadow-soft animate-fade-in-up">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${dim.colorClass}`} />
                  <CardTitle className={`text-sm ${dim.colorClass}`}>{dim.label}</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {overlap.shared.length} shared
                  </Badge>
                  <Badge variant="secondary" className="text-[10px] font-mono">
                    {overlap.pct}% overlap
                  </Badge>
                </div>
              </div>
              {/* Overlap bar */}
              <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden flex">
                {overlap.shared.length > 0 && (
                  <div
                    className={cn('rounded-l-full', dim.key === 'sector' ? 'bg-sector' : dim.key === 'problemType' ? 'bg-problem' : dim.key === 'tech' ? 'bg-tech' : dim.key === 'methodology' ? 'bg-methodology' : 'bg-role')}
                    style={{ width: `${overlap.pct}%` }}
                  />
                )}
                {overlap.onlyA.length > 0 && (
                  <div className="bg-muted-foreground/20" style={{ width: `${Math.round((overlap.onlyA.length / (overlap.shared.length + overlap.onlyA.length + overlap.onlyB.length)) * 100)}%` }} />
                )}
                {overlap.onlyB.length > 0 && (
                  <div className="bg-muted-foreground/10 rounded-r-full" style={{ width: `${Math.round((overlap.onlyB.length / (overlap.shared.length + overlap.onlyA.length + overlap.onlyB.length)) * 100)}%` }} />
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {/* Person A skills */}
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 font-medium">
                    {personA.name || personA.login}
                  </div>
                  <div className="space-y-1.5">
                    {skillsA.sort((a, b) => b.score - a.score).map((skill) => {
                      const isShared = overlap.shared.includes(skill.name);
                      const pctA = (skill.score / maxScoreA) * 100;
                      return (
                        <div key={skill.name} className="flex items-center gap-2">
                          <div
                            className={cn(
                              'h-1.5 rounded-full shrink-0',
                              isShared ? '' : 'opacity-40',
                            )}
                            style={{ width: `${Math.max(pctA, 5)}%`, minWidth: 16, backgroundColor: dim.barColor }}
                          />
                          <span className={cn('text-[11px] truncate', isShared ? 'font-medium' : 'text-muted-foreground')}>
                            {skill.name}
                          </span>
                          {isShared && (
                            <Badge variant="secondary" className="text-[8px] h-4 px-1 py-0 font-mono shrink-0">
                              shared
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                    {skillsA.length === 0 && (
                      <div className="text-[10px] text-muted-foreground italic">No skills detected</div>
                    )}
                  </div>
                </div>

                {/* Person B skills */}
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 font-medium">
                    {personB.name || personB.login}
                  </div>
                  <div className="space-y-1.5">
                    {skillsB.sort((a, b) => b.score - a.score).map((skill) => {
                      const isShared = overlap.shared.includes(skill.name);
                      const pctB = (skill.score / maxScoreB) * 100;
                      return (
                        <div key={skill.name} className="flex items-center gap-2">
                          <div
                            className={cn(
                              'h-1.5 rounded-full shrink-0',
                              isShared ? '' : 'opacity-40',
                            )}
                            style={{ width: `${Math.max(pctB, 5)}%`, minWidth: 16, backgroundColor: dim.barColor }}
                          />
                          <span className={cn('text-[11px] truncate', isShared ? 'font-medium' : 'text-muted-foreground')}>
                            {skill.name}
                          </span>
                          {isShared && (
                            <Badge variant="secondary" className="text-[8px] h-4 px-1 py-0 font-mono shrink-0">
                              shared
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                    {skillsB.length === 0 && (
                      <div className="text-[10px] text-muted-foreground italic">No skills detected</div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Person Header                                                      */
/* ------------------------------------------------------------------ */

function PersonHeader({ person }: { person: PersonSkillRecord }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-soft">
      <div className="flex items-center gap-3">
        <Avatar className="h-12 w-12 shrink-0 ring-2 ring-border">
          <AvatarImage src={person.avatarUrl} alt={person.name} />
          <AvatarFallback className="text-sm">{person.login[0]?.toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-sm truncate">{person.name || person.login}</div>
          <div className="text-[11px] text-muted-foreground">@{person.login}</div>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <GitCommitVertical className="h-3 w-3" /> {person.totalCommits} commits
            </span>
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Users className="h-3 w-3" /> {person.repos.length} repos
            </span>
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Boxes className="h-3 w-3" /> {person.totalChunks} chunks
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
