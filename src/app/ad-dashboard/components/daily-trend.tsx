"use client";

import type { DayData, DayMetrics } from "../lib/types";
import { fmtSigned } from "../lib/format";
import { GLASS } from "../lib/constants";

export function DailyTrend({
  days,
  metrics,
}: {
  days: DayData[];
  metrics: DayMetrics[];
}) {
  const bars = days.map((d, i) => ({
    date: d.date,
    profit: metrics[i].netProfit,
    active: d.adSpend > 0 || d.revenue > 0 || d.purchases > 0,
  }));
  const hasData = bars.some((b) => b.active);
  if (!hasData) return null;
  const maxAbs = Math.max(...bars.map((b) => Math.abs(b.profit)), 1);

  return (
    <div className={`mb-8 ${GLASS} p-5 md:p-6`}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">מגמת רווח יומי</h2>
        <div className="flex items-center gap-4 text-xs text-gray-400">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500" />
            רווח
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-500" />
            הפסד
          </span>
        </div>
      </div>
      <div className="flex items-end gap-[3px]" style={{ height: 100 }}>
        {bars.map((b, i) => {
          if (!b.active) {
            return (
              <div key={i} className="flex-1" title={b.date}>
                <div className="mx-auto h-[2px] w-full rounded-full bg-gray-100" />
              </div>
            );
          }
          const h = Math.max(4, (Math.abs(b.profit) / maxAbs) * 100);
          const isProfit = b.profit >= 0;
          return (
            <div
              key={i}
              className="group/bar relative flex-1"
              title={`${b.date}: ${fmtSigned(b.profit)}`}
            >
              <div
                className={`w-full rounded-t-md transition-all duration-200 group-hover/bar:opacity-100 ${isProfit ? "bg-emerald-500 group-hover/bar:bg-emerald-400" : "bg-red-400 group-hover/bar:bg-red-500"}`}
                style={{ height: `${h}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-[3px]">
        {bars.map((b, i) => (
          <div
            key={i}
            className="flex-1 text-center text-[8px] text-gray-600"
          >
            {(i + 1) % 5 === 1 ? b.date.split(".")[0] : ""}
          </div>
        ))}
      </div>
    </div>
  );
}
