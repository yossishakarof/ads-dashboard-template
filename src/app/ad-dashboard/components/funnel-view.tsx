"use client";

import type { CampaignGoal } from "../lib/types";
import { fmtN, fmtCurrency, fmtDec } from "../lib/format";
import { GLASS } from "../lib/constants";

export function FunnelStep({
  label,
  value,
  rate,
  maxValue,
  color,
  step,
}: {
  label: string;
  value: number;
  rate?: string;
  maxValue: number;
  color: string;
  step: number;
}) {
  const w = maxValue > 0 ? Math.max(5, (value / maxValue) * 100) : 0;
  return (
    <div className="group flex items-center gap-3">
      <div
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
        style={{ backgroundColor: color }}
      >
        {step}
      </div>
      <div className="w-28 flex-shrink-0 text-left text-sm font-medium text-gray-700">
        {label}
      </div>
      <div className="relative flex-1">
        <div className="h-10 overflow-hidden rounded-xl bg-gray-100">
          <div
            className="flex h-full items-center rounded-xl pr-3 transition-all duration-700"
            style={{
              width: `${w}%`,
              background: `linear-gradient(90deg, ${color}cc, ${color}55)`,
            }}
          >
            {w > 15 && (
              <span className="text-xs font-bold text-white drop-shadow-sm">
                {fmtN(value)}
              </span>
            )}
          </div>
        </div>
      </div>
      {w <= 15 && (
        <span className="min-w-[40px] text-left text-xs font-semibold text-gray-900">
          {fmtN(value)}
        </span>
      )}
      {rate && (
        <div
          className="min-w-[70px] rounded-lg px-2 py-1 text-center text-xs font-semibold"
          style={{ backgroundColor: `${color}15`, color: color }}
        >
          {rate}
        </div>
      )}
    </div>
  );
}

export function FunnelDropoff({ from, to }: { from: number; to: number }) {
  if (from <= 0) return null;
  const dropPct = ((from - to) / from) * 100;
  return (
    <div className="flex items-center gap-2 py-0.5 pr-12 text-xs">
      <span className="text-gray-600">↓</span>
      <span
        className={dropPct > 50 ? "text-red-400/60" : "text-gray-500/60"}
      >
        {dropPct.toFixed(1)}% נשרו
      </span>
    </div>
  );
}

export function CampaignResultsBanner({
  goalLabel,
  totalResults,
  costPerResult,
  totalLeads,
  cpl,
  totalPurchases,
  cpa,
  totalRevenue,
  campaignGoal,
}: {
  goalLabel: string;
  totalResults: number;
  costPerResult: number;
  totalLeads: number;
  cpl: number;
  totalPurchases: number;
  cpa: number;
  totalRevenue: number;
  campaignGoal: CampaignGoal;
}) {
  const hasData = totalResults > 0 || totalLeads > 0 || totalPurchases > 0;
  if (!hasData) return null;

  return (
    <div
      className={`mb-5 overflow-hidden ${GLASS} relative`}
    >
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-l from-blue-500 via-purple-500 to-cyan-500" />
      <div className="p-5 md:p-6">
        <div className="mb-4 flex items-center gap-2">
          <span className="text-sm font-bold text-gray-900">📊 תוצאות הקמפיין</span>
          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-medium text-gray-500">
            מטרה: {goalLabel}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <div className="mb-1 text-xs font-medium text-blue-600">
              {goalLabel} (סה״כ)
            </div>
            <div className="text-2xl font-extrabold text-blue-700 md:text-3xl">
              {campaignGoal === "revenue"
                ? fmtCurrency(totalResults)
                : fmtN(totalResults)}
            </div>
          </div>

          <div className="rounded-xl border border-purple-200 bg-purple-50 p-4">
            <div className="mb-1 text-xs font-medium text-purple-600">
              עלות ל{goalLabel.replace("₪", "").trim()}
            </div>
            <div className="text-2xl font-extrabold text-purple-700 md:text-3xl">
              {costPerResult > 0 ? fmtDec(costPerResult) : "-"}
            </div>
          </div>

          <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-4">
            <div className="mb-1 text-xs font-medium text-cyan-600">
              לידים (נרשמו)
            </div>
            <div className="text-2xl font-extrabold text-cyan-700 md:text-3xl">
              {fmtN(totalLeads)}
            </div>
          </div>

          <div className="rounded-xl border border-teal-200 bg-teal-50 p-4">
            <div className="mb-1 text-xs font-medium text-teal-600">
              עלות ליד (CPL)
            </div>
            <div className="text-2xl font-extrabold text-teal-700 md:text-3xl">
              {cpl > 0 ? fmtDec(cpl) : "-"}
            </div>
          </div>

          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="mb-1 text-xs font-medium text-emerald-600">
              רכישות
            </div>
            <div className="text-2xl font-extrabold text-emerald-700 md:text-3xl">
              {fmtN(totalPurchases)}
            </div>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="mb-1 text-xs font-medium text-amber-600">
              עלות לרכישה (CPA)
            </div>
            <div className="text-2xl font-extrabold text-amber-700 md:text-3xl">
              {cpa > 0 ? fmtDec(cpa) : "-"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
