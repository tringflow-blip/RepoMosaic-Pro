'use client';

import { useMemo } from 'react';
import { Calendar, Flame, TrendingUp } from 'lucide-react';

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
const WEEKS = 52;
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

export function CommitHeatmap({ data, totalCommits, dateRange }: Props) {
  const { grid, monthLabels, busiestDay, longestStreak, busiestDayCount } = useMemo(() => {
    // Build a date -> count lookup
    const dataMap = new Map<string, number>();
    for (const entry of data) {
      dataMap.set(entry.date, entry.count);
    }

    // Calculate the date range: 52 weeks back from today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find the Sunday of the current week (or today if today is Sunday)
    const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon, ...
    const endOfCurrentWeek = new Date(today);
    // Go to Saturday of this week (end of the week column)
    endOfCurrentWeek.setDate(today.getDate() + (6 - dayOfWeek));

    // The grid ends at the end of the current week
    // Start: 52 weeks before the end of current week's Saturday, then go to Sunday of that week
    const gridEndDate = new Date(endOfCurrentWeek);
    const gridStartDate = new Date(gridEndDate);
    gridStartDate.setDate(gridStartDate.getDate() - (WEEKS * 7 - 1));
    // Adjust to start on Sunday
    gridStartDate.setDate(gridStartDate.getDate() - gridStartDate.getDay());

    // Build the grid: weeks[weekIndex][dayIndex] = { date, count }
    const grid: { date: string; count: number }[][] = [];
    let currentWeekStart = new Date(gridStartDate);

    for (let w = 0; w < WEEKS; w++) {
      const week: { date: string; count: number }[] = [];
      for (let d = 0; d < 7; d++) {
        const cellDate = new Date(currentWeekStart);
        cellDate.setDate(currentWeekStart.getDate() + d);
        const dateStr = cellDate.toISOString().split('T')[0];
        const count = dataMap.get(dateStr) ?? 0;

        // Only include cells that are within the 1-year range or in the future
        // All cells in the grid get rendered, but future dates are empty
        const isFuture = cellDate > today;
        week.push({
          date: dateStr,
          count: isFuture ? -1 : count, // -1 signals "no data / future"
        });
      }
      grid.push(week);
      currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    }

    // Calculate month labels
    const monthLabels: { label: string; colIndex: number }[] = [];
    let lastMonth = -1;
    for (let w = 0; w < grid.length; w++) {
      // Use the first day (Sunday) of the week to determine the month
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

    // Calculate stats
    let busiestDayStr = '';
    let busiestDayCountVal = 0;
    let currentStreak = 0;
    let maxStreak = 0;

    // Flatten grid in chronological order
    const allDays: { date: string; count: number }[] = [];
    for (const week of grid) {
      for (const day of week) {
        if (day.count >= 0) {
          allDays.push(day);
        }
      }
    }

    for (const day of allDays) {
      if (day.count > busiestDayCountVal) {
        busiestDayCountVal = day.count;
        busiestDayStr = day.date;
      }
      if (day.count > 0) {
        currentStreak++;
        if (currentStreak > maxStreak) {
          maxStreak = currentStreak;
        }
      } else {
        currentStreak = 0;
      }
    }

    return {
      grid,
      monthLabels,
      busiestDay: busiestDayStr,
      longestStreak: maxStreak,
      busiestDayCount: busiestDayCountVal,
    };
  }, [data]);

  const gridWidth = WEEKS * (CELL_SIZE + GAP);
  const gridHeight = 7 * (CELL_SIZE + GAP);

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <div className="flex items-center gap-1.5">
          <TrendingUp className="h-4 w-4 text-primary" />
          <span className="font-mono font-semibold text-foreground">{totalCommits.toLocaleString()}</span>
          <span className="text-muted-foreground">
            commits in the {dateRange ?? 'last year'}
          </span>
        </div>

        {busiestDay && (
          <div className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-primary" />
            <span className="text-muted-foreground">Busiest day:</span>
            <span className="font-mono font-semibold text-foreground">{formatDate(busiestDay)}</span>
            <span className="text-muted-foreground">({busiestDayCount} commits)</span>
          </div>
        )}

        {longestStreak > 0 && (
          <div className="flex items-center gap-1.5">
            <Flame className="h-4 w-4 text-primary" />
            <span className="text-muted-foreground">Longest streak:</span>
            <span className="font-mono font-semibold text-foreground">{longestStreak} days</span>
          </div>
        )}
      </div>

      {/* Heatmap grid */}
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
              className="flex flex-shrink-0 flex-col"
              style={{ height: gridHeight, width: 28 }}
            >
              {[1, 3, 5].map((dayIdx) => (
                <span
                  key={dayIdx}
                  className="text-xs text-muted-foreground leading-none"
                  style={{
                    height: CELL_SIZE,
                    marginTop: dayIdx === 1 ? 0 : GAP,
                    marginBottom: GAP,
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
                gridTemplateColumns: `repeat(${WEEKS}, ${CELL_SIZE}px)`,
                gap: `${GAP}px`,
                width: gridWidth,
              }}
            >
              {grid.map((week, weekIdx) =>
                week.map((day, dayIdx) => {
                  const isFuture = day.count < 0;
                  const level = isFuture ? 0 : getHeatmapLevel(day.count);
                  const tooltipText = isFuture
                    ? 'No data'
                    : `${day.count} commit${day.count !== 1 ? 's' : ''} on ${formatDate(day.date)}`;

                  return (
                    <div
                      key={`${weekIdx}-${dayIdx}`}
                      className={`rounded-sm transition-colors duration-150 ${
                        isFuture ? 'heatmap-0 opacity-30' : `heatmap-${level}`
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
          <div className="mt-2 flex items-center justify-end gap-1.5 text-xs text-muted-foreground" style={{ width: gridWidth + 28 }}>
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
    </div>
  );
}
