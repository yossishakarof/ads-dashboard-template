"use client";

export function NumCell({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <input
      type="number"
      className="w-full bg-transparent px-2 py-2 text-center text-sm text-gray-800 outline-none transition-colors [appearance:textfield] hover:bg-blue-50/60 focus:bg-blue-50 focus:ring-1 focus:ring-blue-400/40 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      value={value || ""}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      placeholder="-"
    />
  );
}

export function TxtCell({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      type="text"
      className="w-full bg-transparent px-2.5 py-2 text-right text-sm text-gray-500 outline-none transition-colors hover:bg-blue-50/60 focus:bg-blue-50 focus:text-gray-800 focus:ring-1 focus:ring-blue-400/40"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="—"
    />
  );
}

export function CC({
  v,
  f,
  pos,
  best,
}: {
  v: number;
  f: (n: number) => string;
  pos?: boolean;
  best?: boolean;
}) {
  const c =
    pos === undefined
      ? "text-gray-700"
      : v > 0
        ? "text-emerald-600"
        : v < 0
          ? "text-red-600"
          : "text-gray-400";
  return (
    <td
      className={`px-2 py-2 text-center text-sm font-semibold ${c} ${best ? "bg-amber-50 ring-2 ring-inset ring-amber-400/50" : "bg-violet-50/40"}`}
    >
      <div className="flex items-center justify-center gap-1">
        {best && <span className="text-[10px]">🏆</span>}
        <span>{f(v)}</span>
      </div>
    </td>
  );
}

export function StaticCell({ value }: { value: string }) {
  return (
    <td className="px-2 py-2 text-center text-sm text-gray-800">
      {value || "—"}
    </td>
  );
}
