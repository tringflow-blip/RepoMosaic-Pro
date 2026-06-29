'use client';

import { useMemo, useState } from 'react';
import { Calendar, Flame, TrendingUp, ChevronLeft, ChevronRight, BarChart3 } from 'lucide-react';

type Props = {
  /** Each entry: { date: 'YYYY-MM-DD', count: number } */
  data: { date: string; count: number }[];
  /** Total commits for summary */
  totalCommits: number;
  /** Date range label */
  dateRange?: string;
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const CELL_SIZE = 10;
const GAP = 2;

function getHeatmapLevel(count: number): number {
  if (count === 0) return 0;
  if (count <= 2) return 1;
  if (count <= 5) return 2;
  if (count <= 10) return 3;
  return 4;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const month = MONTHS[d.getMonth()];
  const day = d.getDate();
  const year = d.getFullYear();
  return `${month} ${day}, ${year}`;
}

function getDaysInYear(year: number): number {
  return (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 366 : 365;
}

/** Build a year-specific heatmap grid (Jan 1 – Dec 31) */
function buildYearGrid(
  year: number,
  dataMap: Map<string, number>,
  today: Date,
) {
  const jan1 = new Date(year, 0, 1);
  const dec31 = new Date(year, 11, 31);

  // Start from the Sunday on or before Jan 1
  const startOffset = jan1.getDay(); // 0=Sun,1=Mon...
  const gridStart = new Date(jan1);
  gridStart.setDate(gridStart.getDate() - startOffset);

  // End at the Saturday on or after Dec 31
  const endOffset = dec31.getDay(); // 0=Sun...6=Sat
  const gridEnd = new Date(dec31);
  gridEnd.setDate(gridEnd.getDate() + (6 - endOffset));

  // Calculate number of weeks
  const totalDays = Math.round((gridEnd.getTime() - gridStart.getTime()) / (86400000)) + 1;
  const numWeeks = Math.ceil(totalDays / 7);

  const grid: { date: string; count: number }[][] = [];
  let currentWeekStart = new Date(gridStart);

  for (let w = 0; w < numWeeks; w++) {
    const week: { date: string; count: number }[] = [];
    for (let d = 0; d < 7; d++) {
      const cellDate = new Date(currentWeekStart);
      cellDate.setDate(currentWeekStart.getDate() + d);
      const dateStr = cellDate.toISOString().split('T')[0];
      const count = dataMap.get(dateStr) ?? 0;

      const isBeforeYear = cellDate < jan1;
      const isAfterYear = cellDate > dec31;
      const isFuture = cellDate > today;

      if (isBeforeYear || isAfterYear) {
        week.push({ date: dateStr, count: -1 }); // out of range
      } else if (isFuture) {
        week.push({ date: dateStr, count: -2 }); // future, but in year
      } else {
        week.push({ date: dateStr, count });
      }
    }
    grid.push(week);
    currentWeekStart.setDate(currentWeekStart.getDate() + 7);
  }

  // Month labels
  const monthLabels: { label: string; colIndex: number }[] = [];
  let lastMonth = -1;
  for (let w = 0; w < grid.length; w++) {
    // Find the first day in this week that belongs to the year
    let monthFound = -1;
    for (let d = 0; d < 7; d++) {
      if (grid[w][d].count >= -1) {
        const cellDate = new Date(grid[w][d].date + 'T00:00:00');
        if (cellDate.getFullYear() === year) {
          monthFound = cellDate.getMonth();
          break;
        }
      }
    }
    if (monthFound >= 0 && monthFound !== lastMonth) {
      monthLabels.push({
        label: MONTHS[monthFound],
        colIndex: w,
      });
      lastMonth = monthFound;
    }
  }

  return { grid, monthLabels, numWeeks };
}

/** Build the traditional 52-week trailing heatmap */
function buildTrailingGrid(
  dataMap: Map<string, number>,
  today: Date,
) {
  const dayOfWeek = today.getDay();
  const endOfCurrentWeek = new Date(today);
  endOfCurrentWeek.setDate(today.getDate() + (6 - dayOfWeek));

  const gridEndDate = new Date(endOfCurrentWeek);
  const gridStartDate = new Date(gridEndDate);
  gridStartDate.setDate(gridStartDate.getDate() - (52 * 7 - 1));
  gridStartDate.setDate(gridStartDate.getDate() - gridStartDate.getDay());

  const grid: { date: string; count: number }[][] = [];
  let currentWeekStart = new Date(gridStartDate);

  for (let w = 0; w < 53; w++) {
    const week: { date: string; count: number }[] = [];
    for (let d = 0; d < 7; d++) {
      const cellDate = new Date(currentWeekStart);
      cellDate.setDate(currentWeekStart.getDate() + d);
      const dateStr = cellDate.toISOString().split('T')[0];
      const count = dataMap.get(dateStr) ?? 0;
      const isFuture = cellDate > today;
      week.push({
        date: dateStr,
        count: isFuture ? -2 : count,
      });
    }
    grid.push(week);
    currentWeekStart.setDate(currentWeekStart.getDate() + 7);
  }

  const monthLabels: { label: string; colIndex: number }[] = [];
  let lastMonth = -1;
  for (let w = 0; w < grid.length; w++) {
    const firstDayDate = new Date(grid[w][0].date + 'T00:00:00');
    const month = firstDayDate.getMonth();
    if (month !== lastMonth) {
      monthLabels.push({
        label: MONTHS[month],
        colIndex: w,
      });
      lastMonth = month;
    }
  }

  return { grid, monthLabels, numWeeks: 53 };
}

export function CommitHeatmap({ data, totalCommits, dateRange }: Props) {
  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all');

  // Build data map
  const dataMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of data) {
      map.set(entry.date, entry.count);
    }
    return map;
  }, [data]);

  // Derive available years from data
  const { yearsList, yearCommitCounts, earliestYear, latestYear } = useMemo(() => {
    if (data.length === 0) {
      const currentYear = new Date().getFullYear();
      return {
        yearsList: [currentYear - 1, currentYear],
        yearCommitCounts: new Map<number, number>(),
        earliestYear: currentYear,
        latestYear: currentYear,
      };
    }

    let minYear = Infinity;
    let maxYear = -Infinity;
    const countsByYear = new Map<number, number>();

    for (const entry of data) {
      const year = new Date(entry.date + 'T00:00:00').getFullYear();
      if (year < minYear) minYear = year;
      if (year > maxYear) maxYear = year;
      countsByYear.set(year, (countsByYear.get(year) ?? 0) + entry.count);
    }

    // Generate from (earliest - 1) to latest
    const list: number[] = [];
    for (let y = minYear - 1; y <= maxYear; y++) {
      list.push(y);
    }

    return {
      yearsList: list,
      yearCommitCounts: countsByYear,
      earliestYear: minYear,
      latestYear: maxYear,
    };
  }, [data]);

  // Default to latest year on first meaningful data load
  const effectiveYear = useMemo(() => {
    if (selectedYear === 'all') return 'all' as const;
    return selectedYear;
  }, [selectedYear]);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // Build the heatmap grid
  const { grid, monthLabels, numWeeks } = useMemo(() => {
    if (effectiveYear === 'all') {
      return buildTrailingGrid(dataMap, today);
    }
    return buildYearGrid(effectiveYear, dataMap, today);
  }, [effectiveYear, dataMap, today]);

  // Compute stats for the selected view
  const { viewTotalCommits, busiestDay, busiestDayCount, longestStreak, commitTrend } = useMemo(() => {
    // Flatten grid in chronological order
    const allDays: { date: string; count: number }[] = [];
    for (const week of grid) {
      for (const day of week) {
        if (day.count >= 0) {
          allDays.push(day);
        }
      }
    }

    let total = 0;
    let busiestDayStr = '';
    let busiestCount = 0;
    let currentStreak = 0;
    let maxStreak = 0;

    for (const day of allDays) {
      total += day.count;
      if (day.count > busiestCount) {
        busiestCount = day.count;
        busiestDayStr = day.date;
      }
      if (day.count > 0) {
        currentStreak++;
        if (currentStreak > maxStreak) maxStreak = currentStreak;
      } else {
        currentStreak = 0;
      }
    }

    // Commit trend: compare with previous year
    let trend: { direction: 'up' | 'down'; percent: number; previousYear: number } | null = null;
    if (effectiveYear !== 'all' && typeof effectiveYear === 'number') {
      const prevYear = effectiveYear - 1;
      const currentCount = yearCommitCounts.get(effectiveYear) ?? 0;
      const prevCount = yearCommitCounts.get(prevYear) ?? 0;
      if (prevCount > 0) {
        const pct = Math.round(((currentCount - prevCount) / prevCount) * 100);
        trend = {
          direction: pct >= 0 ? 'up' : 'down',
          percent: Math.abs(pct),
          previousYear: prevYear,
        };
      }
    }

    return {
      viewTotalCommits: total,
      busiestDay: busiestDayStr,
      busiestDayCount: busiestCount,
      longestStreak: maxStreak,
      commitTrend: trend,
    };
  }, [grid, effectiveYear, yearCommitCounts]);

  const gridWidth = numWeeks * (CELL_SIZE + GAP);
  const gridHeight = 7 * (CELL_SIZE + GAP);

  // Bar chart data
  const barChartData = useMemo(() => {
    const maxCount = Math.max(...yearsList.map((y) => yearCommitCounts.get(y) ?? 0), 1);
    return yearsList.map((y) => ({
      year: y,
      count: yearCommitCounts.get(y) ?? 0,
      width: ((yearCommitCounts.get(y) ?? 0) / maxCount) * 100,
    }));
  }, [yearsList, yearCommitCounts]);

  // Scroll year pills to show the selected one
  const scrollPills = (direction: 'left' | 'right') => {
    const container = document.getElementById('year-pills-scroll');
    if (container) {
      const scrollAmount = 200;
      container.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Calendar className="mb-2 h-8 w-8 opacity-40" />
        <p className="text-sm">No commit data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Year Selector */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => scrollPills('left')}
          className="flex-shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Scroll years left"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div
          id="year-pills-scroll"
          className="flex flex-1 gap-1.5 overflow-x-auto custom-scrollbar scroll-smooth"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {/* "All" pill */}
          <button
            onClick={() => setSelectedYear('all')}
            className={`flex-shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              effectiveYear === 'all'
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            All{' '}
            <span className="font-mono">
              ({data.reduce((s, e) => s + e.count, 0).toLocaleString()})
            </span>
          </button>
          {/* Year pills */}
          {yearsList.map((year) => {
            const count = yearCommitCounts.get(year) ?? 0;
            const isActive = effectiveYear === year;
            return (
              <button
                key={year}
                onClick={() => setSelectedYear(year)}
                className={`flex-shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  isActive
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {year}{' '}
                <span className="font-mono">({count.toLocaleString()})</span>
              </button>
            );
          })}
        </div>
        <button
          onClick={() => scrollPills('right')}
          className="flex-shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Scroll years right"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Summary Stats */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <div className="flex items-center gap-1.5">
          <TrendingUp className="h-4 w-4 text-primary" />
          <span className="font-mono font-semibold text-foreground">
            {viewTotalCommits.toLocaleString()}
          </span>
          <span className="text-muted-foreground">
            commits in{' '}
            {effectiveYear === 'all'
              ? dateRange ?? 'the last year'
              : effectiveYear}
          </span>
        </div>

        {busiestDay && (
          <div className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-primary" />
            <span className="text-muted-foreground">Busiest day:</span>
            <span className="font-mono font-semibold text-foreground">
              {formatDate(busiestDay)}
            </span>
            <span className="text-muted-foreground">
              ({busiestDayCount} commits)
            </span>
          </div>
        )}

        {longestStreak > 0 && (
          <div className="flex items-center gap-1.5">
            <Flame className="h-4 w-4 text-primary" />
            <span className="text-muted-foreground">Longest streak:</span>
            <span className="font-mono font-semibold text-foreground">
              {longestStreak} days
            </span>
          </div>
        )}

        {commitTrend && (
          <div className="flex items-center gap-1.5">
            {commitTrend.direction === 'up' ? (
              <TrendingUp className="h-4 w-4 text-tech" />
            ) : (
              <TrendingUp className="h-4 w-4 rotate-180 text-problem" />
            )}
            <span
              className={`font-mono font-semibold ${
                commitTrend.direction === 'up' ? 'text-tech' : 'text-problem'
              }`}
            >
              {commitTrend.direction === 'up' ? '↑' : '↓'} {commitTrend.percent}%
            </span>
            <span className="text-muted-foreground">
              {commitTrend.direction === 'up' ? 'more' : 'less'} than{' '}
              {commitTrend.previousYear}
            </span>
          </div>
        )}
      </div>

      {/* Heatmap Grid */}
      <div className="overflow-x-auto pb-2">
        <div className="inline-block min-w-fit">
          {/* Month labels */}
          <div
            className="relative mb-1"
            style={{ width: gridWidth, marginLeft: 28 }}
          >
            {monthLabels.map((ml, i) => (
              <span
                key={`${ml.label}-${i}`}
                className="absolute text-xs text-muted-foreground"
                style={{ left: ml.colIndex * (CELL_SIZE + GAP) }}
              >
                {ml.label}
              </span>
            ))}
          </div>

          {/* Grid with day labels */}
          <div className="flex">
            {/* Day labels */}
            <div
              className="flex flex-shrink-0 flex-col justify-between"
              style={{ height: gridHeight, width: 28 }}
            >
              {[1, 3, 5].map((dayIdx) => (
                <span
                  key={dayIdx}
                  className="text-xs text-muted-foreground leading-none"
                  style={{
                    height: CELL_SIZE,
                    lineHeight: `${CELL_SIZE}px`,
                  }}
                >
                  {DAYS[dayIdx]}
                </span>
              ))}
            </div>

            {/* Cells grid */}
            <div
              className="grid"
              style={{
                gridTemplateRows: `repeat(7, ${CELL_SIZE}px)`,
                gridTemplateColumns: `repeat(${numWeeks}, ${CELL_SIZE}px)`,
                gap: `${GAP}px`,
                width: gridWidth,
              }}
            >
              {grid.map((week, weekIdx) =>
                week.map((day, dayIdx) => {
                  const isOutOfRange = day.count === -1;
                  const isFuture = day.count === -2;
                  const isDimmed = isOutOfRange || isFuture;
                  const level = isDimmed ? 0 : getHeatmapLevel(day.count);
                  const tooltipText = isOutOfRange
                    ? ''
                    : isFuture
                      ? 'No data yet'
                      : `${day.count} commit${day.count !== 1 ? 's' : ''} on ${formatDate(day.date)}`;

                  return (
                    <div
                      key={`${weekIdx}-${dayIdx}`}
                      className={`rounded-sm transition-colors duration-150 ${
                        isOutOfRange
                          ? 'opacity-0'
                          : isFuture
                            ? 'heatmap-0 opacity-30'
                            : `heatmap-${level}`
                      }`}
                      style={{
                        width: CELL_SIZE,
                        height: CELL_SIZE,
                        gridRow: dayIdx + 1,
                        gridColumn: weekIdx + 1,
                      }}
                      title={tooltipText}
                    />
                  );
                })
              )}
            </div>
          </div>

          {/* Legend */}
          <div
            className="mt-2 flex items-center justify-end gap-1.5 text-xs text-muted-foreground"
            style={{ width: gridWidth + 28 }}
          >
            <span>Less</span>
            {[0, 1, 2, 3, 4].map((level) => (
              <div
                key={level}
                className={`heatmap-${level} rounded-sm`}
                style={{ width: CELL_SIZE, height: CELL_SIZE }}
              />
            ))}
            <span>More</span>
          </div>
        </div>
      </div>

      {/* Yearly Overview Bar Chart */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <BarChart3 className="h-3.5 w-3.5" />
          <span className="text-label">Yearly Overview</span>
        </div>
        <div className="space-y-1.5">
          {barChartData.map((bar) => {
            const isActive =
              effectiveYear === bar.year ||
              (effectiveYear === 'all' && bar.year === latestYear);
            return (
              <div
                key={bar.year}
                className="flex items-center gap-2"
                role="button"
                tabIndex={0}
                onClick={() => setSelectedYear(bar.year)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedYear(bar.year);
                  }
                }}
              >
                <span
                  className={`w-10 flex-shrink-0 text-right font-mono text-xs ${
                    isActive
                      ? 'font-semibold text-foreground'
                      : 'text-muted-foreground'
                  }`}
                >
                  {bar.year}
                </span>
                <div className="relative h-4 flex-1 overflow-hidden rounded-sm bg-muted/60">
                  <div
                    className={`absolute inset-y-0 left-0 rounded-sm transition-all duration-500 ${
                      isActive ? 'bg-tech' : 'bg-tech/40'
                    }`}
                    style={{ width: `${Math.max(bar.width, bar.count > 0 ? 2 : 0)}%` }}
                  />
                </div>
                <span
                  className={`w-12 flex-shrink-0 text-right font-mono text-xs ${
                    isActive
                      ? 'font-semibold text-foreground'
                      : 'text-muted-foreground'
                  }`}
                >
                  {bar.count.toLocaleString()}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
