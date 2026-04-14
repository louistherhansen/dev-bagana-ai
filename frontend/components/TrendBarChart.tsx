"use client";

/**
 * Simple SVG Bar Chart for trend progression over time periods.
 * Displays grouped bars for each trend across multiple periods.
 */

export type TrendDataPoint = {
  period: string;
  value: number; // 0-100
};

export type TrendLine = {
  name: string;
  color?: string;
  data: TrendDataPoint[];
};

type TrendBarChartProps = {
  trends: TrendLine[];
  width?: number;
  height?: number;
  className?: string;
};

const DEFAULT_WIDTH = 600;
const DEFAULT_HEIGHT = 400;
const PADDING = { top: 20, right: 40, bottom: 60, left: 60 };
const COLORS = [
  "rgb(59, 130, 246)", // blue
  "rgb(16, 185, 129)", // green
  "rgb(234, 179, 8)",  // yellow
  "rgb(239, 68, 68)",  // red
  "rgb(168, 85, 247)", // purple
  "rgb(236, 72, 153)", // pink
];

export function TrendBarChart({
  trends,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  className = "",
}: TrendBarChartProps) {
  if (!trends || trends.length === 0) return null;

  const chartWidth = width - PADDING.left - PADDING.right;
  const chartHeight = height - PADDING.top - PADDING.bottom;

  // Collect all periods
  const allPeriods = Array.from(
    new Set(trends.flatMap((t) => t.data.map((d) => d.period)))
  ).sort();

  // Collect all values to find max
  const allValues = trends.flatMap((t) => t.data.map((d) => d.value));
  const maxValue = Math.max(100, ...allValues);
  const valueRange = maxValue || 1;

  // Calculate bar dimensions
  const numPeriods = allPeriods.length;
  const numTrends = trends.length;
  const groupWidth = numPeriods > 0 ? chartWidth / numPeriods : 0;
  const barWidth = numTrends > 0 ? (groupWidth * 0.8) / numTrends : 0;
  const barGap = numTrends > 1 ? (groupWidth * 0.2) / (numTrends - 1) : 0;

  // Convert period to x coordinate (center of group)
  const getGroupX = (period: string) => {
    const index = allPeriods.indexOf(period);
    return PADDING.left + (index + 0.5) * groupWidth;
  };

  // Convert value to bar height (inverted: higher value = taller bar)
  const getBarHeight = (value: number) => {
    return (value / valueRange) * chartHeight;
  };

  // Get bar x position within group
  const getBarX = (period: string, trendIndex: number) => {
    const groupX = getGroupX(period);
    const startX = groupX - (groupWidth * 0.8) / 2;
    return startX + trendIndex * (barWidth + barGap);
  };

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <svg width={width} height={height} className="overflow-visible">
        {/* Bars */}
        {trends.map((trend, trendIndex) => {
          const color = trend.color || COLORS[trendIndex % COLORS.length];
          
          return trend.data.map((point) => {
            const barHeight = getBarHeight(point.value);
            const barX = getBarX(point.period, trendIndex);
            const barY = PADDING.top + chartHeight - barHeight;

            return (
              <g key={`${trend.name}-${point.period}`}>
                {/* Bar */}
                <rect
                  x={barX}
                  y={barY}
                  width={barWidth}
                  height={barHeight}
                  fill={color}
                  rx={2}
                  className="transition-all hover:opacity-80"
                />
                {/* Value label on top of bar */}
                {barHeight > 20 && (
                  <text
                    x={barX + barWidth / 2}
                    y={barY - 4}
                    textAnchor="middle"
                    dominantBaseline="text-before-edge"
                    className="text-xs font-semibold fill-slate-700"
                    style={{ fontSize: "11px" }}
                  >
                    {Math.round(point.value)}
                  </text>
                )}
              </g>
            );
          });
        })}

        {/* X-axis */}
        <line
          x1={PADDING.left}
          y1={PADDING.top + chartHeight}
          x2={PADDING.left + chartWidth}
          y2={PADDING.top + chartHeight}
          stroke="rgb(148, 163, 184)"
          strokeWidth={1.5}
        />

        {/* Y-axis */}
        <line
          x1={PADDING.left}
          y1={PADDING.top}
          x2={PADDING.left}
          y2={PADDING.top + chartHeight}
          stroke="rgb(148, 163, 184)"
          strokeWidth={1.5}
        />

        {/* X-axis labels (periods) */}
        {allPeriods.map((period) => {
          const x = getGroupX(period);
          return (
            <text
              key={period}
              x={x}
              y={PADDING.top + chartHeight + 20}
              textAnchor="middle"
              className="text-xs fill-slate-600"
              style={{ fontSize: "11px" }}
            >
              {period}
            </text>
          );
        })}

        {/* Y-axis labels (0, 25, 50, 75, 100) */}
        {[0, 25, 50, 75, 100].map((value) => {
          const y = PADDING.top + chartHeight - getBarHeight(value);
          return (
            <g key={value}>
              <line
                x1={PADDING.left}
                y1={y}
                x2={PADDING.left - 5}
                y2={y}
                stroke="rgb(148, 163, 184)"
                strokeWidth={1}
              />
              <text
                x={PADDING.left - 10}
                y={y}
                textAnchor="end"
                dominantBaseline="middle"
                className="text-xs fill-slate-600"
                style={{ fontSize: "11px" }}
              >
                {value}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap justify-center gap-4 text-sm">
        {trends.map((trend, index) => {
          const color = trend.color || COLORS[index % COLORS.length];
          return (
            <span key={trend.name} className="flex items-center gap-1.5">
              <span
                className="h-3 w-3 rounded"
                style={{ backgroundColor: color }}
              />
              {trend.name}
            </span>
          );
        })}
      </div>
    </div>
  );
}
