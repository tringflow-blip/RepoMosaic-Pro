'use client';

import { useMemo } from 'react';
import {
  X,
  Compass,
  Target,
  Wrench,
  Boxes,
  Shield,
  GitCommitVertical,
  ExternalLink,
  ChevronDown,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import type {
  PersonSkillRecord,
  SkillDimension,
} from '@/lib/analysis/skill-taxonomy';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

type Props = {
  person: PersonSkillRecord | null; // null = panel closed
  onClose: () => void;
};

/* ------------------------------------------------------------------ */
/*  Dimension metadata                                                 */
/* ------------------------------------------------------------------ */

const DIMENSIONS: {
  key: SkillDimension;
  label: string;
  icon: typeof Compass;
  colorClass: string;          // Tailwind text-*
  bgClass: string;             // Tailwind bg-*
  barColor: string;            // oklch for inline style
  fillColor: string;           // oklch for SVG fill (20% opacity)
  strokeColor: string;         // oklch for SVG stroke (60% opacity)
}[] = [
  {
    key: 'sector',
    label: 'Sectors',
    icon: Compass,
    colorClass: 'text-sector',
    bgClass: 'bg-sector',
    barColor: 'oklch(0.62 0.13 35)',
    fillColor: 'oklch(0.62 0.13 35 / 0.20)',
    strokeColor: 'oklch(0.62 0.13 35 / 0.60)',
  },
  {
    key: 'problemType',
    label: 'Problem Types',
    icon: Target,
    colorClass: 'text-problem',
    bgClass: 'bg-problem',
    barColor: 'oklch(0.62 0.13 145)',
    fillColor: 'oklch(0.62 0.13 145 / 0.20)',
    strokeColor: 'oklch(0.62 0.13 145 / 0.60)',
  },
  {
    key: 'tech',
    label: 'Tech',
    icon: Wrench,
    colorClass: 'text-tech',
    bgClass: 'bg-tech',
    barColor: 'oklch(0.55 0.11 250)',
    fillColor: 'oklch(0.55 0.11 250 / 0.20)',
    strokeColor: 'oklch(0.55 0.11 250 / 0.60)',
  },
  {
    key: 'methodology',
    label: 'Methodologies',
    icon: Boxes,
    colorClass: 'text-methodology',
    bgClass: 'bg-methodology',
    barColor: 'oklch(0.62 0.13 305)',
    fillColor: 'oklch(0.62 0.13 305 / 0.20)',
    strokeColor: 'oklch(0.62 0.13 305 / 0.60)',
  },
  {
    key: 'role',
    label: 'Roles',
    icon: Shield,
    colorClass: 'text-role',
    bgClass: 'bg-role',
    barColor: 'oklch(0.68 0.12 90)',
    fillColor: 'oklch(0.68 0.12 90 / 0.20)',
    strokeColor: 'oklch(0.68 0.12 90 / 0.60)',
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
    case 'sector':
      return person.sectors;
    case 'problemType':
      return person.problemTypes;
    case 'tech':
      return person.tech;
    case 'methodology':
      return person.methodologies;
    case 'role':
      return person.roles;
  }
}

/** Get initials from a name or login for avatar fallback */
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

/* ------------------------------------------------------------------ */
/*  Radar Chart (SVG)                                                  */
/* ------------------------------------------------------------------ */

const RADAR_SIZE = 280;
const RADAR_CX = RADAR_SIZE / 2;
const RADAR_CY = RADAR_SIZE / 2;
const RADAR_R = 105; // max radius for 100%
const NUM_AXES = 5;
const ANGLE_STEP = (2 * Math.PI) / NUM_AXES;
// Start from top (–90°) so Sector is at the top
const START_ANGLE = -Math.PI / 2;

function axisPoint(index: number, radius: number) {
  const angle = START_ANGLE + index * ANGLE_STEP;
  return {
    x: RADAR_CX + radius * Math.cos(angle),
    y: RADAR_CY + radius * Math.sin(angle),
  };
}

function RadarChart({ person }: { person: PersonSkillRecord }) {
  // Compute per-axis values: number of unique skills / max across dims, normalized 0-1
  const axisValues = useMemo(() => {
    const counts = DIMENSIONS.map((d) => {
      const skills = getSkillsForDimension(person, d.key);
      return skills.length;
    });
    const maxCount = Math.max(...counts, 1);
    return counts.map((c) => c / maxCount);
  }, [person]);

  // Determine dominant dimension for fill color
  const dominantIdx = useMemo(() => {
    let max = 0;
    let idx = 0;
    axisValues.forEach((v, i) => {
      if (v > max) {
        max = v;
        idx = i;
      }
    });
    return idx;
  }, [axisValues]);

  const dominant = DIMENSIONS[dominantIdx];

  // Build data polygon points
  const dataPoints = axisValues
    .map((v, i) => {
      const r = Math.max(v, 0.02) * RADAR_R; // min 2% so it's visible
      const pt = axisPoint(i, r);
      return `${pt.x},${pt.y}`;
    })
    .join(' ');

  // Grid pentagon points at a given fraction (0-1)
  function gridPentagon(fraction: number) {
    const r = fraction * RADAR_R;
    return Array.from({ length: NUM_AXES }, (_, i) => {
      const pt = axisPoint(i, r);
      return `${pt.x},${pt.y}`;
    }).join(' ');
  }

  return (
    <svg
      viewBox={`0 0 ${RADAR_SIZE} ${RADAR_SIZE}`}
      className="mx-auto animate-scale-in"
      width={RADAR_SIZE}
      height={RADAR_SIZE}
    >
      {/* Grid pentagons at 25%, 50%, 75%, 100% */}
      {[0.25, 0.5, 0.75, 1].map((frac) => (
        <polygon
          key={frac}
          points={gridPentagon(frac)}
          className="radar-grid"
          fill="none"
          strokeWidth={1}
        />
      ))}

      {/* Axis lines from center to each vertex */}
      {Array.from({ length: NUM_AXES }, (_, i) => {
        const pt = axisPoint(i, RADAR_R);
        return (
          <line
            key={i}
            x1={RADAR_CX}
            y1={RADAR_CY}
            x2={pt.x}
            y2={pt.y}
            className="radar-axis"
            strokeWidth={1}
          />
        );
      })}

      {/* Grid labels at 25%, 50%, 75%, 100% */}
      {[0.25, 0.5, 0.75, 1].map((frac) => {
        // Place labels along the first axis (top)
        const pt = axisPoint(0, frac * RADAR_R);
        return (
          <text
            key={frac}
            x={pt.x + 8}
            y={pt.y + 3}
            className="fill-muted-foreground"
            fontSize={8}
          >
            {Math.round(frac * 100)}%
          </text>
        );
      })}

      {/* Data polygon */}
      <polygon
        points={dataPoints}
        fill={dominant.fillColor}
        stroke={dominant.strokeColor}
        strokeWidth={2}
        strokeLinejoin="round"
      />

      {/* Data points (dots) */}
      {axisValues.map((v, i) => {
        const r = Math.max(v, 0.02) * RADAR_R;
        const pt = axisPoint(i, r);
        return (
          <circle
            key={i}
            cx={pt.x}
            cy={pt.y}
            r={3.5}
            fill={DIMENSIONS[i].strokeColor}
            stroke="oklch(1 0 0 / 0.9)"
            strokeWidth={1.5}
          />
        );
      })}

      {/* Axis labels */}
      {DIMENSIONS.map((d, i) => {
        const pt = axisPoint(i, RADAR_R + 18);
        const count = getSkillsForDimension(person, d.key).length;
        return (
          <text
            key={d.key}
            x={pt.x}
            y={pt.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={10}
            fontWeight={600}
            className={d.colorClass}
          >
            {d.label} ({count})
          </text>
        );
      })}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Score Bar (inline progress bar)                                    */
/* ------------------------------------------------------------------ */

function ScoreBar({
  score,
  color,
  maxScore,
}: {
  score: number;
  color: string;
  maxScore: number;
}) {
  const pct = maxScore > 0 ? (score / maxScore) * 100 : 0;
  return (
    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full transition-all duration-300"
        style={{
          width: `${pct}%`,
          backgroundColor: color,
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Dimension Section (Accordion item content)                         */
/* ------------------------------------------------------------------ */

function DimensionSection({
  person,
  dim,
}: {
  person: PersonSkillRecord;
  dim: (typeof DIMENSIONS)[number];
}) {
  const skills = getSkillsForDimension(person, dim.key);
  const sorted = [...skills].sort((a, b) => b.score - a.score);
  const maxScore = sorted.length > 0 ? sorted[0].score : 1;
  const Icon = dim.icon;

  return (
    <AccordionItem value={dim.key} className="border-border/50">
      <AccordionTrigger className="hover:no-underline py-3">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${dim.colorClass}`} />
          <span className={`font-semibold text-sm ${dim.colorClass}`}>
            {dim.label}
          </span>
          <Badge
            variant="secondary"
            className="text-[10px] px-1.5 py-0 h-5 font-mono"
          >
            {skills.length}
          </Badge>
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div className="space-y-1.5">
          {sorted.length === 0 && (
            <p className="text-xs text-muted-foreground italic pl-1">
              No skills detected
            </p>
          )}
          {sorted.map((skill) => (
            <div
              key={skill.name}
              className="flex items-center gap-2 pl-1 py-0.5 group"
            >
              <Badge
                variant="outline"
                className={`text-xs border-${dim.key === 'problemType' ? 'problem' : dim.key}/30 text-${dim.key === 'problemType' ? 'problem' : dim.key} shrink-0 font-medium`}
              >
                {skill.name}
              </Badge>
              <ScoreBar
                score={skill.score}
                color={dim.barColor}
                maxScore={maxScore}
              />
              <span className="text-[10px] text-muted-foreground tabular-nums ml-auto">
                {skill.commits} commits · {skill.chunks} chunks
              </span>
            </div>
          ))}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

/* ------------------------------------------------------------------ */
/*  Evidence Section                                                   */
/* ------------------------------------------------------------------ */

function EvidenceSection({ person }: { person: PersonSkillRecord }) {
  // Group allTags by repo
  const byRepo = useMemo(() => {
    const map = new Map<string, PersonSkillRecord['allTags']>();
    for (const tag of person.allTags) {
      const existing = map.get(tag.repo) ?? [];
      existing.push(tag);
      map.set(tag.repo, existing);
    }
    return map;
  }, [person]);

  if (person.allTags.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">
        No evidence recorded for this person.
      </p>
    );
  }

  const repos = Array.from(byRepo.keys());

  return (
    <div className="space-y-4">
      {repos.map((repo) => {
        const tags = byRepo.get(repo) ?? [];
        return (
          <div key={repo}>
            <div className="flex items-center gap-1.5 mb-1.5">
              <GitCommitVertical className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold font-mono text-foreground">
                {repo}
              </span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                {tags.length}
              </Badge>
            </div>
            <div className="space-y-2 pl-5">
              {tags.map((tag, i) => {
                const dimMeta = DIMENSIONS.find((d) => d.key === tag.dimension);
                return (
                  <div key={`${tag.name}-${i}`} className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      {dimMeta && (
                        <dimMeta.icon
                          className={`h-3 w-3 ${dimMeta.colorClass}`}
                        />
                      )}
                      <span
                        className={`text-xs font-medium ${dimMeta?.colorClass ?? ''}`}
                      >
                        {tag.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        confidence {Math.round(tag.confidence * 100)}%
                      </span>
                    </div>
                    <ul className="space-y-0.5 pl-4">
                      {tag.evidence.map((ev, j) => (
                        <li
                          key={j}
                          className="text-[11px] text-muted-foreground leading-relaxed"
                        >
                          <span className="text-foreground/70 mr-1">•</span>
                          {ev}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
            {repos.indexOf(repo) < repos.length - 1 && (
              <Separator className="mt-3" />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export function PersonDetailPanel({ person, onClose }: Props) {
  if (!person) return null;

  return (
    <Sheet open={!!person} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="glass-strong w-full sm:max-w-lg overflow-y-auto p-0"
      >
        {/* Header */}
        <SheetHeader className="p-6 pb-4">
          <div className="flex items-start gap-4">
            <Avatar className="h-16 w-16 shrink-0 ring-2 ring-border">
              <AvatarImage src={person.avatarUrl} alt={person.name} />
              <AvatarFallback className="text-lg">
                {getInitials(person.name, person.login)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-lg leading-tight truncate">
                {person.name}
              </SheetTitle>
              <p className="text-sm text-muted-foreground truncate">
                @{person.login}
              </p>
              {person.url && (
                <a
                  href={person.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                >
                  <ExternalLink className="h-3 w-3" />
                  GitHub Profile
                </a>
              )}
            </div>
          </div>

          {/* Key stats */}
          <div className="grid grid-cols-3 gap-3 mt-4">
            <StatCard
              label="Commits"
              value={person.totalCommits}
              icon={<GitCommitVertical className="h-3.5 w-3.5" />}
              color="text-people"
            />
            <StatCard
              label="Chunks"
              value={person.totalChunks}
              icon={<Boxes className="h-3.5 w-3.5" />}
              color="text-methodology"
            />
            <StatCard
              label="Repos"
              value={person.repos.length}
              icon={<Compass className="h-3.5 w-3.5" />}
              color="text-sector"
            />
          </div>

          {/* Ownership badges */}
          {person.ownership.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Repo Ownership
              </p>
              <div className="flex flex-wrap gap-1.5">
                {person.ownership.map((o) => (
                  <Badge
                    key={o.repo}
                    variant="outline"
                    className="text-xs gap-1 border-people/30 text-people"
                  >
                    {o.repo}
                    <span className="text-[10px] text-muted-foreground">
                      {o.commits} commits
                    </span>
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </SheetHeader>

        <Separator />

        {/* Radar Chart */}
        <div className="px-6 py-4">
          <h3 className="text-sm font-semibold mb-2">Skill Profile</h3>
          <RadarChart person={person} />
        </div>

        <Separator />

        {/* Skill Breakdown by Dimension */}
        <div className="px-6 py-4">
          <h3 className="text-sm font-semibold mb-1">Skill Breakdown</h3>
          <Accordion
            type="multiple"
            defaultValue={DIMENSIONS.map((d) => d.key)}
            className="w-full"
          >
            {DIMENSIONS.map((dim) => (
              <DimensionSection key={dim.key} person={person} dim={dim} />
            ))}
          </Accordion>
        </div>

        <Separator />

        {/* Evidence Section */}
        <div className="px-6 py-4 pb-8">
          <h3 className="text-sm font-semibold mb-3">Evidence</h3>
          <EvidenceSection person={person} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/*  Stat Card                                                          */
/* ------------------------------------------------------------------ */

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="rounded-lg bg-muted/40 px-3 py-2 text-center">
      <div className={`flex items-center justify-center gap-1 ${color}`}>
        {icon}
        <span className="text-lg font-bold tabular-nums">{value}</span>
      </div>
      <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}
