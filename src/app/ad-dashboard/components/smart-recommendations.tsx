"use client";

import type { ScaleLevel, MetricScale } from "../lib/types";

// 5-level scale gauge
export function ScaleGauge({ level }: { level: ScaleLevel }) {
  const segments: { key: ScaleLevel; color: string; activeColor: string }[] = [
    { key: "poor", color: "bg-red-500/20", activeColor: "bg-red-500" },
    { key: "below_avg", color: "bg-orange-500/20", activeColor: "bg-orange-500" },
    { key: "average", color: "bg-yellow-500/20", activeColor: "bg-yellow-500" },
    { key: "good", color: "bg-emerald-500/20", activeColor: "bg-emerald-500" },
    { key: "excellent", color: "bg-blue-500/20", activeColor: "bg-blue-500" },
  ];
  const activeIdx = segments.findIndex((s) => s.key === level);
  return (
    <div className="flex gap-1">
      {segments.map((s, i) => (
        <div
          key={s.key}
          className={`h-1.5 flex-1 rounded-full transition-all ${
            i <= activeIdx ? s.activeColor : s.color
          }`}
        />
      ))}
    </div>
  );
}

// Overall health score (circular SVG)
export function OverallHealthScore({
  score,
  level,
}: {
  score: number;
  level: ScaleLevel;
}) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const colors: Record<ScaleLevel, string> = {
    poor: "#ef4444",
    below_avg: "#f97316",
    average: "#eab308",
    good: "#22c55e",
    excellent: "#3b82f6",
  };
  const color = colors[level];
  return (
    <div className="relative h-20 w-20 flex-shrink-0">
      <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke="rgba(0,0,0,0.08)"
          strokeWidth="6"
        />
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          className="transition-all duration-1000"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold text-gray-900">{score}</span>
        <span className="text-[9px] text-gray-400">/100</span>
      </div>
    </div>
  );
}

// Individual metric recommendation card
export function SmartRecommendationCard({ metric }: { metric: MetricScale }) {
  const levelLabels: Record<ScaleLevel, string> = {
    poor: "חלש",
    below_avg: "מתחת לממוצע",
    average: "ממוצע",
    good: "טוב",
    excellent: "מצוין",
  };
  const levelStyles: Record<
    ScaleLevel,
    { text: string; bg: string; border: string; pill: string }
  > = {
    poor: {
      text: "text-red-600",
      bg: "bg-red-50",
      border: "border-red-200",
      pill: "bg-red-100 text-red-700",
    },
    below_avg: {
      text: "text-orange-600",
      bg: "bg-orange-50",
      border: "border-orange-200",
      pill: "bg-orange-100 text-orange-700",
    },
    average: {
      text: "text-yellow-600",
      bg: "bg-yellow-50",
      border: "border-yellow-200",
      pill: "bg-yellow-100 text-yellow-700",
    },
    good: {
      text: "text-emerald-600",
      bg: "bg-emerald-50",
      border: "border-emerald-200",
      pill: "bg-emerald-100 text-emerald-700",
    },
    excellent: {
      text: "text-blue-600",
      bg: "bg-blue-50",
      border: "border-blue-200",
      pill: "bg-blue-100 text-blue-700",
    },
  };
  const s = levelStyles[metric.level];
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border ${s.border} ${s.bg} p-5 transition-all hover:border-opacity-40`}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{metric.icon}</span>
          <span className="text-sm font-medium text-gray-600">
            {metric.label}
          </span>
        </div>
        <span
          className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${s.pill}`}
        >
          {levelLabels[metric.level]}
        </span>
      </div>
      <div className={`mb-3 text-3xl font-bold ${s.text}`}>
        {metric.formattedValue}
      </div>
      <div className="mb-4">
        <ScaleGauge level={metric.level} />
      </div>
      <p className="text-[13px] leading-relaxed text-gray-500">
        {metric.recommendation}
      </p>
    </div>
  );
}
