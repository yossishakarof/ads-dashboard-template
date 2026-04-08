"use client";

import { GLASS, GLASS_HOVER } from "../lib/constants";

export function DashboardKPICard({
  label,
  value,
  sub,
  color,
  icon,
  status,
  large,
}: {
  label: string;
  value: string;
  sub?: string;
  color: string;
  icon: string;
  status?: "good" | "warning" | "bad";
  large?: boolean;
}) {
  const accents: Record<string, { bar: string; iconBg: string }> = {
    blue: { bar: "bg-blue-500", iconBg: "bg-blue-50" },
    green: { bar: "bg-emerald-500", iconBg: "bg-emerald-50" },
    red: { bar: "bg-red-500", iconBg: "bg-red-50" },
    amber: { bar: "bg-amber-500", iconBg: "bg-amber-50" },
    purple: { bar: "bg-purple-500", iconBg: "bg-purple-50" },
    cyan: { bar: "bg-cyan-500", iconBg: "bg-cyan-50" },
  };
  const a = accents[color] || accents.blue;
  const statusColors = {
    good: "bg-emerald-500",
    warning: "bg-amber-500",
    bad: "bg-red-500",
  };

  return (
    <div
      className={`group relative overflow-hidden ${GLASS} ${GLASS_HOVER} p-5 md:p-6`}
    >
      <div
        className={`absolute inset-x-0 top-0 h-[2px] ${a.bar} opacity-60`}
      />
      <div className="relative">
        <div className="mb-3 flex items-center gap-2.5">
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-xl ${a.iconBg} text-lg`}
          >
            {icon}
          </div>
          <span className="text-sm font-medium text-gray-500">{label}</span>
          {status && (
            <span
              className={`h-2 w-2 rounded-full ${statusColors[status]}`}
            />
          )}
        </div>
        <div
          className={`font-bold tracking-tight text-gray-900 ${large ? "text-4xl md:text-5xl" : "text-3xl md:text-4xl"}`}
        >
          {value}
        </div>
        {sub && (
          <div className="mt-2.5 text-[13px] leading-relaxed text-gray-400">
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}
