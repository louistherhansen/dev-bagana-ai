"use client";

/**
 * Simple SVG Bar Chart for trend summary values.
 * Displays horizontal bars for each trend with values 0-100.
 */

export type SummaryBarData = {
  name: string;
  value: number; // 0-100
};

type SummaryBarChartProps = {
  data: SummaryBarData[];
  width?: number;
  height?: number;
  className?: string;
};

const DEFAULT_WIDTH = 600;
const DEFAULT_HEIGHT = 400;
const PADDING = { top: 20, right: 40, bottom: 40, left: 200 };
const BAR_HEIGHT = 32;
const BAR_GAP = 12;
const COLORS = [
  "rgb(59, 130, 246)", // blue
  "rgb(16, 185, 129)", // green
  "rgb(234, 179, 8)",  // yellow
  "rgb(239, 68, 68)",  // red
  "rgb(168, 85, 247)", // purple
  "rgb(236, 72, 153)", // pink
  "rgb(14, 165, 233)", // sky blue
  "rgb(34, 197, 94)",  // emerald
];

export function SummaryBarChart({
  data,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  className = "",
}: SummaryBarChartProps) {
  if (!data || data.length === 0) return null;

  const chartWidth = width - PADDING.left - PADDING.right;
  const chartHeight = height - PADDING.top - PADDING.bottom;
  const maxValue = 100;
  const totalBarsHeight = data.length * BAR_HEIGHT + (data.length - 1) * BAR_GAP;
  const startY = PADDING.top + (chartHeight - totalBarsHeight) / 2;

  // Convert value to bar width
  const getBarWidth = (value: number) => {
    return (value / maxValue) * chartWidth;
  };

  // Get Y position for a bar index
  const getY = (index: number) => {
    return startY + index * (BAR_HEIGHT + BAR_GAP);
  };

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <svg width={width} height={height} className="overflow-visible">
        {/* Bars */}
        {data.map((bar, index) => {
          const barWidth = getBarWidth(bar.value);
          const y = getY(index);
          const color = COLORS[index % COLORS.length];

          return (
            <g key={bar.name}>
              {/* Bar */}
              <rect
                x={PADDING.left}
                y={y}
                width={barWidth}
                height={BAR_HEIGHT}
                fill={color}
                rx={4}
                className="transition-all hover:opacity-80"
              />
              {/* Value label on bar */}
              {barWidth > 40 && (
                <text
                  x={PADDING.left + barWidth - 8}
                  y={y + BAR_HEIGHT / 2}
                  textAnchor="end"
                  dominantBaseline="middle"
                  className="text-xs font-semibold fill-white"
                  style={{ fontSize: "12px" }}
                >
                  {bar.value}
                </text>
              )}
              {/* Trend name label */}
              <text
                x={PADDING.left - 12}
                y={y + BAR_HEIGHT / 2}
                textAnchor="end"
                dominantBaseline="middle"
                className="text-xs font-medium fill-slate-700"
                style={{ fontSize: "12px" }}
              >
                {bar.name}
              </text>
            </g>
          );
        })}

        {/* Y-axis (value scale) */}
        <line
          x1={PADDING.left}
          y1={PADDING.top}
          x2={PADDING.left}
          y2={PADDING.top + chartHeight}
          stroke="rgb(148, 163, 184)"
          strokeWidth={1.5}
        />

        {/* X-axis (value scale) */}
        <line
          x1={PADDING.left}
          y1={PADDING.top + chartHeight}
          x2={PADDING.left + chartWidth}
          y2={PADDING.top + chartHeight}
          stroke="rgb(148, 163, 184)"
          strokeWidth={1.5}
        />

        {/* X-axis labels (0, 25, 50, 75, 100) */}
        {[0, 25, 50, 75, 100].map((value) => {
          const x = PADDING.left + getBarWidth(value);
          return (
            <g key={value}>
              <line
                x1={x}
                y1={PADDING.top + chartHeight}
                x2={x}
                y2={PADDING.top + chartHeight + 5}
                stroke="rgb(148, 163, 184)"
                strokeWidth={1}
              />
              <text
                x={x}
                y={PADDING.top + chartHeight + 18}
                textAnchor="middle"
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
      <div className="mt-4 text-xs text-slate-500 text-center">
        Trend strength/interest level (0-100)
      </div>
    </div>
  );
}
