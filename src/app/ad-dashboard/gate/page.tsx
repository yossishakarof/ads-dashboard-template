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
    <div className="flex min-h-screen items-center justify-center bg-gray-50" dir="rtl">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-8 shadow-lg">
        <div className="mb-6 text-center">
          <div className="mb-2 text-3xl">📊</div>
          <h1 className="text-xl font-extrabold text-gray-900">Ads Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">הזן סיסמה להמשך</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="סיסמה"
            autoFocus
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-right text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
          {error && (
            <p className="text-center text-sm font-medium text-red-500">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading || !password}
            className="w-full rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-gray-700 disabled:opacity-50"
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
