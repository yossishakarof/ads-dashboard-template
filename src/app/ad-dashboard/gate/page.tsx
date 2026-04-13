"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function GateForm() {
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/ad-dashboard";
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/ad-dashboard/gate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password, from }),
    });
    const data = await res.json();
    if (res.ok) {
      window.location.href = data.redirect || "/ad-dashboard";
    } else {
      setError(data.error || "סיסמה שגויה");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#08080f]" dir="rtl">
      <div className="w-full max-w-sm rounded-2xl border border-white/[0.08] bg-[#111119] p-8 shadow-lg shadow-black/40">
        <div className="mb-6 text-center">
          <div className="mb-2 text-3xl">📊</div>
          <h1 className="text-xl font-extrabold text-white">Ads Dashboard</h1>
          <p className="mt-1 text-sm text-slate-400">הזן סיסמה להמשך</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="סיסמה"
            autoFocus
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-right text-sm text-white outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20"
          />
          {error && (
            <p className="text-center text-sm font-medium text-red-500">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading || !password}
            className="w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-black transition-all hover:bg-amber-400 disabled:opacity-50"
          >
            {loading ? "מתחבר..." : "כניסה"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function GatePage() {
  return (
    <Suspense>
      <GateForm />
    </Suspense>
  );
}
