"use client";

import { GLASS, GLASS_HOVER } from "../lib/constants";

interface KpiCardProps {
  label: string;
  value: string;
  icon: string;
  sub?: string;
  color?: "blue" | "purple" | "pink" | "green" | "amber" | "rose";
}

const colorMap = {
  blue: "from-blue-500 to-blue-600",
  purple: "from-purple-500 to-purple-600",
  pink: "from-pink-500 to-pink-600",
  green: "from-green-500 to-green-600",
  amber: "from-amber-500 to-amber-600",
  rose: "from-rose-500 to-rose-600",
};

export function KpiCard({ label, value, icon, sub, color = "blue" }: KpiCardProps) {
  return (
    <div className={`${GLASS} ${GLASS_HOVER} p-4`}>
      <div className="mb-2 flex items-center gap-2">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${colorMap[color]} text-sm text-white`}>
          {icon}
        </div>
        <span className="text-xs font-medium text-gray-500">{label}</span>
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-gray-400">{sub}</div>}
    </div>
  );
}
