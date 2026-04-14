"use client";

/**
 * Simple SVG Pie Chart for sentiment composition (Positive %, Neutral %, Negative %).
 */

type SentimentPieChartProps = {
  positivePct: number;
  neutralPct: number;
  negativePct: number;
  size?: number;
  className?: string;
};

const DEFAULT_SIZE = 200;

export function SentimentPieChart({
  positivePct,
  neutralPct,
  negativePct,
  size = DEFAULT_SIZE,
  className = "",
}: SentimentPieChartProps) {
  const total = positivePct + neutralPct + negativePct;
  const scale = total > 0 ? 100 / total : 0;
  const p = Math.min(100, Math.max(0, positivePct * scale));
  const n = Math.min(100, Math.max(0, neutralPct * scale));
  const neg = Math.min(100, Math.max(0, negativePct * scale));

  const r = size / 2;
  const cx = r;
  const cy = r;

  const toPath = (startAngle: number, endAngle: number) => {
    const start = (startAngle * Math.PI) / 180;
    const end = (endAngle * Math.PI) / 180;
    const x1 = cx + r * Math.cos(start);
    const y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end);
    const y2 = cy + r * Math.sin(end);
    const large = endAngle - startAngle > 180 ? 1 : 0;
    return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
  };

  const positiveAngle = (p / 100) * 360;
  const neutralAngle = (n / 100) * 360;
  const negativeAngle = (neg / 100) * 360;
  const a0 = 0;
  const a1 = a0 + positiveAngle;
  const a2 = a1 + neutralAngle;
  const a3 = a2 + negativeAngle;

  return (
    <div className={`inline-flex flex-col items-center ${className}`}>
      <svg width={size} height={size} className="rounded-full" aria-hidden>
        <path
          d={toPath(a0, a1)}
          fill="rgb(16, 185, 129)"
          stroke="white"
          strokeWidth={2}
        />
        <path
          d={toPath(a1, a2)}
          fill="rgb(100, 116, 139)"
          stroke="white"
          strokeWidth={2}
        />
        <path
          d={toPath(a2, a3)}
          fill="rgb(239, 68, 68)"
          stroke="white"
          strokeWidth={2}
        />
      </svg>
      <div className="mt-3 flex flex-wrap justify-center gap-4 text-sm">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-emerald-500" />
          Positive {p.toFixed(0)}%
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-slate-500" />
          Neutral {n.toFixed(0)}%
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-red-500" />
          Negative {neg.toFixed(0)}%
        </span>
      </div>
    </div>
  );
}
