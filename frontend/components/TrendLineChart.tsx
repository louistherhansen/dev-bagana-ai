"use client";

/**
 * Simple SVG Line Chart for trend progression over time periods.
 * Displays multiple trend lines on the same chart.
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

type TrendLineChartProps = {
  trends: TrendLine[];
  width?: number;
  height?: number;
  className?: string;
};

const DEFAULT_WIDTH = 600;
const DEFAULT_HEIGHT = 300;
const PADDING = { top: 20, right: 40, bottom: 40, left: 60 };
const COLORS = [
  "rgb(59, 130, 246)", // blue
  "rgb(16, 185, 129)", // green
  "rgb(234, 179, 8)",  // yellow
  "rgb(239, 68, 68)",  // red
  "rgb(168, 85, 247)", // purple
  "rgb(236, 72, 153)", // pink
];

export function TrendLineChart({
  trends,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  className = "",
}: TrendLineChartProps) {
  if (!trends || trends.length === 0) return null;

  const chartWidth = width - PADDING.left - PADDING.right;
  const chartHeight = height - PADDING.top - PADDING.bottom;

  // Collect all data points to find min/max
  const allValues = trends.flatMap((t) => t.data.map((d) => d.value));
  const minValue = Math.min(0, ...allValues);
  const maxValue = Math.max(100, ...allValues);
  const valueRange = maxValue - minValue || 1;

  // Collect all periods
  const allPeriods = Array.from(
    new Set(trends.flatMap((t) => t.data.map((d) => d.period)))
  ).sort();

  // Convert period to x coordinate
  const getX = (period: string) => {
    const index = allPeriods.indexOf(period);
    return PADDING.left + (index / Math.max(1, allPeriods.length - 1)) * chartWidth;
  };

  // Convert value to y coordinate (inverted: higher value = lower y)
  const getY = (value: number) => {
    const normalized = (value - minValue) / valueRange;
    return PADDING.top + chartHeight - normalized * chartHeight;
  };

  // Generate path for a trend line
  const getPath = (data: TrendDataPoint[]) => {
    if (data.length === 0) return "";
    const points = data
      .map((d) => `${getX(d.period)},${getY(d.value)}`)
      .join(" ");
    return `M ${points}`;
  };

  return (
    <div className={`inline-flex flex-col items-center ${className}`}>
      <svg width={width} height={height} className="border border-slate-200 rounded-lg bg-white">
        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map((val) => {
          const y = getY(val);
          return (
            <g key={val}>
              <line
                x1={PADDING.left}
                y1={y}
                x2={PADDING.left + chartWidth}
                y2={y}
                stroke="rgb(226, 232, 240)"
                strokeWidth={1}
                strokeDasharray="4 4"
              />
              <text
                x={PADDING.left - 10}
                y={y + 4}
                textAnchor="end"
                fontSize="10"
                fill="rgb(100, 116, 139)"
              >
                {val}
              </text>
            </g>
          );
        })}

        {/* X-axis labels */}
        {allPeriods.map((period, i) => {
          const x = getX(period);
          return (
            <text
              key={period}
              x={x}
              y={height - PADDING.bottom + 20}
              textAnchor="middle"
              fontSize="10"
              fill="rgb(100, 116, 139)"
            >
              {period}
            </text>
          );
        })}

        {/* Trend lines */}
        {trends.map((trend, trendIndex) => {
          const color = trend.color || COLORS[trendIndex % COLORS.length];
          const path = getPath(trend.data);
          if (!path) return null;

          return (
            <g key={trend.name}>
              <path
                d={path}
                fill="none"
                stroke={color}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Data points */}
              {trend.data.map((point) => (
                <circle
                  key={`${trend.name}-${point.period}`}
                  cx={getX(point.period)}
                  cy={getY(point.value)}
                  r={4}
                  fill={color}
                  stroke="white"
                  strokeWidth={2}
                />
              ))}
            </g>
          );
        })}

        {/* Axes */}
        <line
          x1={PADDING.left}
          y1={PADDING.top}
          x2={PADDING.left}
          y2={PADDING.top + chartHeight}
          stroke="rgb(148, 163, 184)"
          strokeWidth={1.5}
        />
        <line
          x1={PADDING.left}
          y1={PADDING.top + chartHeight}
          x2={PADDING.left + chartWidth}
          y2={PADDING.top + chartHeight}
          stroke="rgb(148, 163, 184)"
          strokeWidth={1.5}
        />
      </svg>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap justify-center gap-4 text-sm">
        {trends.map((trend, index) => {
          const color = trend.color || COLORS[index % COLORS.length];
          return (
            <span key={trend.name} className="flex items-center gap-1.5">
              <span
                className="h-3 w-3 rounded-full"
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
