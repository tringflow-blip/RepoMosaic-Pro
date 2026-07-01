'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  Crosshair,
  Users,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Loader2,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type {
  AdvancedSkillMap,
  PersonSkillRecord,
  SkillDimension,
} from '@/lib/analysis/skill-taxonomy';
import type { LLMConfig } from '@/lib/llm/skill-extractor';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

type Props = {
  skillMap: AdvancedSkillMap;
  llmConfig: LLMConfig;
  onSelectPerson: (person: PersonSkillRecord) => void;
};

/* ------------------------------------------------------------------ */
/*  Types for API response                                             */
/* ------------------------------------------------------------------ */

type MatchBreakdown = {
  sector: number;
  problemType: number;
  tech: number;
  methodology: number;
  role: number;
};

type Ranking = {
  login: string;
  score: number;
  matchBreakdown: MatchBreakdown;
  justification: string;
  strengths: string[];
  gaps: string[];
};

type RequiredSkills = {
  sector: string[];
  problemType: string[];
  tech: string[];
  methodology: string[];
  role: string[];
};

type MatchResult = {
  requiredSkills: RequiredSkills;
  rankings: Ranking[];
  teamGaps: string[];
  recommendation: string;
};

/* ------------------------------------------------------------------ */
/*  Dimension metadata                                                 */
/* ------------------------------------------------------------------ */

const DIMENSIONS: {
  key: SkillDimension;
  label: string;
  shortLabel: string;
  colorClass: string;
  borderColorClass: string;
  fillColor: string;
  strokeColor: string;
}[] = [
  {
    key: 'sector',
    label: 'Sector',
    shortLabel: 'S',
    colorClass: 'text-sector',
    borderColorClass: 'border-sector/30',
    fillColor: 'oklch(0.62 0.13 35 / 0.20)',
    strokeColor: 'oklch(0.62 0.13 35 / 0.60)',
  },
  {
    key: 'problemType',
    label: 'Problem Type',
    shortLabel: 'P',
    colorClass: 'text-problem',
    borderColorClass: 'border-problem/30',
    fillColor: 'oklch(0.62 0.13 145 / 0.20)',
    strokeColor: 'oklch(0.62 0.13 145 / 0.60)',
  },
  {
    key: 'tech',
    label: 'Tech',
    shortLabel: 'T',
    colorClass: 'text-tech',
    borderColorClass: 'border-tech/30',
    fillColor: 'oklch(0.55 0.11 250 / 0.20)',
    strokeColor: 'oklch(0.55 0.11 250 / 0.60)',
  },
  {
    key: 'methodology',
    label: 'Methodology',
    shortLabel: 'M',
    colorClass: 'text-methodology',
    borderColorClass: 'border-methodology/30',
    fillColor: 'oklch(0.62 0.13 305 / 0.20)',
    strokeColor: 'oklch(0.62 0.13 305 / 0.60)',
  },
  {
    key: 'role',
    label: 'Role',
    shortLabel: 'R',
    colorClass: 'text-role',
    borderColorClass: 'border-role/30',
    fillColor: 'oklch(0.68 0.12 90 / 0.20)',
    strokeColor: 'oklch(0.68 0.12 90 / 0.60)',
  },
];

const EXAMPLE_PROBLEMS = [
  'Build a real-time chat application with WebSocket support',
  'Design a microservices architecture for payment processing',
  'Implement ML pipeline for document classification',
  'Set up CI/CD with infrastructure as code',
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getInitials(name: string, login: string) {
  if (name) {
    const parts = name.trim().split(/\s+/);
    return parts
      .map((p) => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }
  return login.slice(0, 2).toUpperCase();
}

function getScoreColorClass(score: number): string {
  if (score >= 80) return 'text-tech';
  if (score >= 60) return 'text-sector';
  if (score >= 40) return 'text-muted-foreground';
  return 'text-destructive';
}

function getScoreBgClass(score: number): string {
  if (score >= 80) return 'bg-tech/10 border-tech/20';
  if (score >= 60) return 'bg-sector/10 border-sector/20';
  if (score >= 40) return 'bg-muted/50 border-border';
  return 'bg-destructive/10 border-destructive/20';
}

/* ------------------------------------------------------------------ */
/*  Mini Radar Chart (SVG)                                             */
/* ------------------------------------------------------------------ */

const MINI_RADAR_SIZE = 120;
const MINI_CX = MINI_RADAR_SIZE / 2;
const MINI_CY = MINI_RADAR_SIZE / 2;
const MINI_R = 42;
const NUM_AXES = 5;
const ANGLE_STEP = (2 * Math.PI) / NUM_AXES;
const START_ANGLE = -Math.PI / 2;

function miniAxisPoint(index: number, radius: number) {
  const angle = START_ANGLE + index * ANGLE_STEP;
  return {
    x: MINI_CX + radius * Math.cos(angle),
    y: MINI_CY + radius * Math.sin(angle),
  };
}

function MiniRadarChart({ breakdown }: { breakdown: MatchBreakdown }) {
  const values = useMemo(
    () => [
      breakdown.sector,
      breakdown.problemType,
      breakdown.tech,
      breakdown.methodology,
      breakdown.role,
    ],
    [breakdown],
  );

  // Determine dominant dimension for fill
  const dominantIdx = useMemo(() => {
    let max = 0;
    let idx = 0;
    values.forEach((v, i) => {
      if (v > max) {
        max = v;
        idx = i;
      }
    });
    return idx;
  }, [values]);

  const dominant = DIMENSIONS[dominantIdx];

  const dataPoints = values
    .map((v, i) => {
      const r = Math.max(v, 0.05) * MINI_R;
      const pt = miniAxisPoint(i, r);
      return `${pt.x},${pt.y}`;
    })
    .join(' ');

  function gridPentagon(fraction: number) {
    const r = fraction * MINI_R;
    return Array.from({ length: NUM_AXES }, (_, i) => {
      const pt = miniAxisPoint(i, r);
      return `${pt.x},${pt.y}`;
    }).join(' ');
  }

  return (
    <svg
      viewBox={`0 0 ${MINI_RADAR_SIZE} ${MINI_RADAR_SIZE}`}
      width={MINI_RADAR_SIZE}
      height={MINI_RADAR_SIZE}
      className="shrink-0"
    >
      {/* Grid pentagons */}
      {[0.25, 0.5, 0.75, 1].map((frac) => (
        <polygon
          key={frac}
          points={gridPentagon(frac)}
          className="radar-grid"
          fill="none"
          strokeWidth={0.8}
        />
      ))}

      {/* Axis lines */}
      {Array.from({ length: NUM_AXES }, (_, i) => {
        const pt = miniAxisPoint(i, MINI_R);
        return (
          <line
            key={i}
            x1={MINI_CX}
            y1={MINI_CY}
            x2={pt.x}
            y2={pt.y}
            className="radar-axis"
            strokeWidth={0.8}
          />
        );
      })}

      {/* Data polygon */}
      <polygon
        points={dataPoints}
        fill={dominant.fillColor}
        stroke={dominant.strokeColor}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />

      {/* Data points */}
      {values.map((v, i) => {
        const r = Math.max(v, 0.05) * MINI_R;
        const pt = miniAxisPoint(i, r);
        return (
          <circle
            key={i}
            cx={pt.x}
            cy={pt.y}
            r={2.5}
            fill={DIMENSIONS[i].strokeColor}
            stroke="oklch(1 0 0 / 0.9)"
            strokeWidth={1}
          />
        );
      })}

      {/* Axis labels */}
      {DIMENSIONS.map((d, i) => {
        const pt = miniAxisPoint(i, MINI_R + 12);
        return (
          <text
            key={d.key}
            x={pt.x}
            y={pt.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={8}
            fontWeight={600}
            className={d.colorClass}
          >
            {d.shortLabel}
          </text>
        );
      })}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Loading Skeleton                                                   */
/* ------------------------------------------------------------------ */

function LoadingSkeleton({ contributorCount }: { contributorCount: number }) {
  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* Recommendation skeleton */}
      <Card className="border-primary/10">
        <CardContent className="p-4">
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4 mt-1" />
        </CardContent>
      </Card>

      {/* Required skills skeleton */}
      <Card>
        <CardHeader className="pb-3 pt-4 px-4">
          <Skeleton className="h-4 w-32" />
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-5 w-20 rounded-full" />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Rank cards skeleton */}
      <div className="space-y-3">
        {Array.from({ length: Math.min(contributorCount, 3) }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
                <Skeleton className="h-12 w-12 rounded shrink-0" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Required Skills Bar                                                */
/* ------------------------------------------------------------------ */

function RequiredSkillsBar({ skills }: { skills: RequiredSkills }) {
  return (
    <Card>
      <CardHeader className="pb-3 pt-4 px-4">
        <CardTitle className="text-sm flex items-center gap-2">
          <Crosshair className="h-4 w-4 text-primary" />
          Required Skills
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        {DIMENSIONS.map((dim) => {
          const dimSkills = skills[dim.key];
          if (!dimSkills || dimSkills.length === 0) return null;
          return (
            <div key={dim.key} className="space-y-1.5">
              <span
                className={`text-[10px] font-semibold uppercase tracking-wider ${dim.colorClass}`}
              >
                {dim.label}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {dimSkills.map((skill) => (
                  <Badge
                    key={skill}
                    variant="outline"
                    className={`text-xs ${dim.borderColorClass} ${dim.colorClass} font-medium`}
                  >
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Strategic Recommendation Card                                      */
/* ------------------------------------------------------------------ */

function RecommendationCard({ recommendation }: { recommendation: string }) {
  return (
    <Card className="border-primary/15 bg-primary/[0.03]">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-primary/10 p-2 shrink-0 mt-0.5">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-primary/70 mb-1">
              Strategic Recommendation
            </p>
            <p className="text-sm leading-relaxed text-foreground">
              {recommendation}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Ranked Contributor Card                                            */
/* ------------------------------------------------------------------ */

function RankedContributorCard({
  ranking,
  rank,
  person,
  onSelect,
}: {
  ranking: Ranking;
  rank: number;
  person: PersonSkillRecord | undefined;
  onSelect: () => void;
}) {
  const [expanded, setExpanded] = useState(rank <= 3);

  const rankBadge =
    rank === 1 ? (
      <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-tech/15 text-tech text-xs font-bold">
        #1
      </span>
    ) : rank === 2 ? (
      <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-sector/15 text-sector text-xs font-bold">
        #2
      </span>
    ) : rank === 3 ? (
      <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-methodology/15 text-methodology text-xs font-bold">
        #3
      </span>
    ) : (
      <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-muted text-muted-foreground text-xs font-bold">
        #{rank}
      </span>
    );

  return (
    <Card
      className={cn(
        'transition-shadow duration-200 cursor-pointer card-glow',
        rank <= 3 && 'border-l-2',
        rank === 1 && 'border-l-tech',
        rank === 2 && 'border-l-sector',
        rank === 3 && 'border-l-methodology',
      )}
      onClick={onSelect}
    >
      <CardContent className="p-4">
        {/* Top row: rank, avatar, name, score, radar */}
        <div className="flex items-start gap-3">
          {/* Rank */}
          <div className="pt-1 shrink-0">{rankBadge}</div>

          {/* Avatar + name */}
          <div className="flex items-start gap-3 min-w-0 flex-1">
            {person ? (
              <Avatar className="h-9 w-9 shrink-0 ring-1 ring-border">
                <AvatarImage src={person.avatarUrl} alt={person.name} />
                <AvatarFallback className="text-xs">
                  {getInitials(person.name, person.login)}
                </AvatarFallback>
              </Avatar>
            ) : (
              <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                <span className="text-xs text-muted-foreground font-mono">
                  {ranking.login.slice(0, 2)}
                </span>
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold truncate">
                  {person?.name || ranking.login}
                </span>
                {person && (
                  <span className="text-xs text-muted-foreground truncate">
                    @{person.login}
                  </span>
                )}
              </div>
              {person && (
                <span className="text-[10px] text-muted-foreground">
                  {person.totalCommits} commits · {person.repos.length} repos
                </span>
              )}
            </div>
          </div>

          {/* Score */}
          <div
            className={cn(
              'shrink-0 text-center rounded-md border px-2.5 py-1',
              getScoreBgClass(ranking.score),
            )}
          >
            <span
              className={cn(
                'text-lg font-bold tabular-nums leading-none',
                getScoreColorClass(ranking.score),
              )}
            >
              {ranking.score}
            </span>
            <span className="block text-[9px] text-muted-foreground mt-0.5">
              match
            </span>
          </div>

          {/* Mini radar */}
          <div className="shrink-0 hidden sm:block">
            <MiniRadarChart breakdown={ranking.matchBreakdown} />
          </div>
        </div>

        {/* Expand/collapse toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-2 transition-colors"
        >
          {expanded ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
          {expanded ? 'Less detail' : 'More detail'}
        </button>

        {/* Expanded content */}
        {expanded && (
          <div className="mt-3 space-y-3 animate-fade-in-up">
            {/* Mini radar for mobile */}
            <div className="sm:hidden flex justify-center">
              <MiniRadarChart breakdown={ranking.matchBreakdown} />
            </div>

            {/* Dimension breakdown mini bar */}
            <div className="grid grid-cols-5 gap-1.5">
              {DIMENSIONS.map((dim) => {
                const val = ranking.matchBreakdown[dim.key];
                return (
                  <div key={dim.key} className="text-center space-y-1">
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.round(val * 100)}%`,
                          backgroundColor: `var(--${dim.key === 'problemType' ? 'problem' : dim.key})`,
                        }}
                      />
                    </div>
                    <span
                      className={`text-[9px] font-semibold ${dim.colorClass}`}
                    >
                      {Math.round(val * 100)}%
                    </span>
                    <span className="block text-[8px] text-muted-foreground">
                      {dim.shortLabel}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Justification */}
            <p className="text-xs text-muted-foreground leading-relaxed">
              {ranking.justification}
            </p>

            {/* Strengths & Gaps */}
            <div className="flex flex-wrap gap-1.5">
              {ranking.strengths.map((s) => (
                <Badge
                  key={`s-${s}`}
                  variant="outline"
                  className="text-[10px] border-tech/25 text-tech bg-tech/5 gap-1 font-medium"
                >
                  <CheckCircle2 className="h-2.5 w-2.5" />
                  {s}
                </Badge>
              ))}
              {ranking.gaps.map((g) => (
                <Badge
                  key={`g-${g}`}
                  variant="outline"
                  className="text-[10px] border-destructive/25 text-destructive bg-destructive/5 gap-1 font-medium"
                >
                  <XCircle className="h-2.5 w-2.5" />
                  {g}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Team Gaps Card                                                     */
/* ------------------------------------------------------------------ */

function TeamGapsCard({ gaps }: { gaps: string[] }) {
  if (!gaps || gaps.length === 0) return null;

  return (
    <Card className="border-destructive/15 bg-destructive/[0.02]">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-destructive/10 p-2 shrink-0 mt-0.5">
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-destructive/70 mb-2">
              Team Skill Gaps
            </p>
            <ul className="space-y-1.5">
              {gaps.map((gap, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-xs text-muted-foreground leading-relaxed"
                >
                  <XCircle className="h-3 w-3 text-destructive/60 shrink-0 mt-0.5" />
                  <span>{gap}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export function ProblemMatchPanel({
  skillMap,
  llmConfig,
  onSelectPerson,
}: Props) {
  const [problemDescription, setProblemDescription] = useState('');
  const [result, setResult] = useState<MatchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Build a lookup map from login → PersonSkillRecord
  const peopleByLogin = useMemo(() => {
    const map = new Map<string, PersonSkillRecord>();
    for (const p of skillMap.people) {
      map.set(p.login, p);
    }
    return map;
  }, [skillMap.people]);

  const handleAnalyze = useCallback(async () => {
    if (!problemDescription.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const resp = await fetch('/api/match-problem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problemDescription: problemDescription.trim(),
          skillMap,
          llmConfig,
        }),
      });

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(
          (data as { error?: string }).error || `HTTP ${resp.status}`,
        );
      }

      const data = (await resp.json()) as { result: MatchResult };
      setResult(data.result);
    } catch (err) {
      setError((err as Error).message || 'Analysis failed');
    } finally {
      setLoading(false);
    }
  }, [problemDescription, skillMap, llmConfig]);

  const handleRetry = useCallback(() => {
    setError(null);
    handleAnalyze();
  }, [handleAnalyze]);

  const handleExampleClick = useCallback(
    (example: string) => {
      setProblemDescription(example);
    },
    [],
  );

  return (
    <div className="space-y-4">
      {/* ── Problem Input Section ── */}
      <Card>
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <Crosshair className="h-4 w-4 text-primary" />
            Problem Matcher
          </CardTitle>
          <CardDescription className="text-xs">
            Describe a problem or project and we&apos;ll rank contributors by
            skill fit across all 5 dimensions.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <Textarea
            value={problemDescription}
            onChange={(e) => setProblemDescription(e.target.value)}
            placeholder="Describe the problem, project, or task you need to staff..."
            className="min-h-[72px] max-h-[240px] resize-y text-sm"
            rows={3}
            disabled={loading}
          />

          {/* Example chips */}
          <div className="space-y-1.5">
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
              Examples
            </span>
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLE_PROBLEMS.map((example) => (
                <button
                  key={example}
                  onClick={() => handleExampleClick(example)}
                  disabled={loading}
                  className="text-[10px] text-muted-foreground hover:text-foreground bg-muted/60 hover:bg-muted border border-border/50 rounded-full px-2.5 py-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>

          {/* Analyze button */}
          <Button
            onClick={handleAnalyze}
            disabled={loading || !problemDescription.trim()}
            className="w-full sm:w-auto"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyzing…
              </>
            ) : (
              <>
                <TrendingUp className="h-4 w-4" />
                Analyze &amp; Match
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* ── Loading State ── */}
      {loading && (
        <div className="space-y-3">
          <div className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground animate-pulse-soft">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>
              Analyzing problem against{' '}
              <span className="font-semibold text-foreground">
                {skillMap.totalPeople}
              </span>{' '}
              contributors…
            </span>
          </div>
          <LoadingSkeleton contributorCount={skillMap.totalPeople} />
        </div>
      )}

      {/* ── Error State ── */}
      {error && !loading && (
        <Card className="border-destructive/20 bg-destructive/[0.02]">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-destructive mb-1">
                  Analysis Failed
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {error}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRetry}
                  className="mt-3"
                >
                  <TrendingUp className="h-3.5 w-3.5" />
                  Retry
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Results Section ── */}
      {result && !loading && (
        <div className="space-y-4 animate-fade-in-up">
          {/* Strategic Recommendation */}
          <RecommendationCard recommendation={result.recommendation} />

          {/* Required Skills */}
          <RequiredSkillsBar skills={result.requiredSkills} />

          {/* Ranked Contributors */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 px-1">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">
                Ranked Contributors
              </span>
              <Badge
                variant="secondary"
                className="text-[10px] px-1.5 py-0 h-5 font-mono"
              >
                {result.rankings.length}
              </Badge>
            </div>

            <div className="space-y-3">
              {result.rankings.map((ranking, idx) => {
                const person = peopleByLogin.get(ranking.login);
                return (
                  <RankedContributorCard
                    key={ranking.login}
                    ranking={ranking}
                    rank={idx + 1}
                    person={person}
                    onSelect={() => {
                      if (person) onSelectPerson(person);
                    }}
                  />
                );
              })}
            </div>
          </div>

          {/* Team Gaps */}
          <TeamGapsCard gaps={result.teamGaps} />
        </div>
      )}
    </div>
  );
}
