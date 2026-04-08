# Ads Dashboard Refactor - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix security issues, replace Anthropic API with local Claude Code (Agent SDK), split the 3233-line dashboard into focused components, deduplicate code, and apply Next.js best practices.

**Architecture:** Keep the existing Next.js App Router structure. Replace the `@anthropic-ai/sdk` direct API calls with `@anthropic-ai/claude-agent-sdk` which uses the local Claude Code CLI (no API key needed). Split `dashboard.tsx` into ~8 focused component files. Move shared UI components and formatters to a shared location.

**Tech Stack:** Next.js 16, React 19, Tailwind v4, `@anthropic-ai/claude-agent-sdk` (replaces `@anthropic-ai/sdk`)

---

### Task 1: Replace Anthropic SDK with Claude Agent SDK

**Files:**
- Modify: `package.json`
- Rewrite: `src/lib/utils/anthropic-client.ts`
- Modify: `src/app/api/ad-dashboard/chat/route.ts`
- Modify: `.env.example`

- [ ] **Step 1: Swap dependencies**

```bash
cd /Users/danielgoldman/Desktop/projects/ads-dashboard
npm remove @anthropic-ai/sdk
npm install @anthropic-ai/claude-agent-sdk
```

- [ ] **Step 2: Rewrite `src/lib/utils/anthropic-client.ts`**

Replace the entire file with a Claude Agent SDK wrapper:

```typescript
/**
 * Claude Code Local Client
 *
 * Uses @anthropic-ai/claude-agent-sdk to run queries via the local
 * Claude Code CLI. No API key needed - uses your existing Claude Code auth.
 */

import { query } from "@anthropic-ai/claude-agent-sdk";

/**
 * Check if Claude Code CLI is available
 */
export function hasClaudeCode(): boolean {
  // The SDK will throw CLINotFoundError if not available,
  // so we optimistically return true
  return true;
}

interface GenerateTextOptions {
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
}

/**
 * Generate text using local Claude Code
 */
export async function generateText(
  options: GenerateTextOptions
): Promise<{ text: string; error?: string }> {
  const { prompt, systemPrompt } = options;

  const fullPrompt = systemPrompt
    ? `${systemPrompt}\n\n---\n\n${prompt}`
    : prompt;

  try {
    let result = "";
    for await (const message of query({
      prompt: fullPrompt,
      options: {
        maxTurns: 1,
        allowedTools: [],
      },
    })) {
      if ("result" in message) {
        result = message.result;
      }
    }

    if (!result) {
      return { text: "", error: "No response from Claude Code" };
    }

    return { text: result };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Claude Code query failed";
    console.error("[Claude Code]", errorMsg);
    return { text: "", error: errorMsg };
  }
}
```

- [ ] **Step 3: Update the chat API route**

Modify `src/app/api/ad-dashboard/chat/route.ts` - the `generateText` import stays the same, but remove the `model` parameter from the call:

Replace:
```typescript
    const result = await generateText({
      prompt,
      systemPrompt,
      maxTokens: 2000,
      model: "sonnet",
    });
```

With:
```typescript
    const result = await generateText({
      prompt,
      systemPrompt,
    });
```

- [ ] **Step 4: Update `.env.example`**

Remove the `ANTHROPIC_API_KEY` section. Replace with a comment:

```bash
# -----------------------------------------------
# AI Chat (optional)
# Requires Claude Code CLI installed locally.
# No API key needed - uses your Claude Code auth.
# Install: npm install -g @anthropic-ai/claude-code
# -----------------------------------------------
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: replace Anthropic API with local Claude Code Agent SDK

No API key needed - AI chat now uses the local Claude Code CLI.
Removes @anthropic-ai/sdk, adds @anthropic-ai/claude-agent-sdk."
```

---

### Task 2: Fix `next.config.ts` - remove error suppression

**Files:**
- Modify: `next.config.ts`

- [ ] **Step 1: Remove `ignoreBuildErrors` and `ignoreDuringBuilds`**

In `next.config.ts`, remove lines 5-6:

```typescript
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
```

So the config becomes:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "scontent.cdninstagram.com" },
      { protocol: "https", hostname: "**.fbcdn.net" },
      { protocol: "https", hostname: "**.cdninstagram.com" },
    ],
  },
};

export default nextConfig;
```

- [ ] **Step 2: Run the build and fix any TS errors**

```bash
cd /Users/danielgoldman/Desktop/projects/ads-dashboard
npx next build 2>&1 | head -80
```

Fix any TypeScript errors that surface. Common ones to expect:
- Unused imports
- Missing type annotations
- Implicit `any` types

- [ ] **Step 3: Commit**

```bash
git add next.config.ts
git commit -m "fix: remove ignoreBuildErrors and ignoreDuringBuilds from next.config

TypeScript and ESLint errors are no longer silently swallowed."
```

---

### Task 3: Move access tokens from URL query params to Authorization headers

**Files:**
- Modify: `src/app/ad-dashboard/lib/meta-api.ts`
- Modify: `src/app/ad-dashboard/lib/instagram-api.ts`

- [ ] **Step 1: Fix `meta-api.ts` `metaFetch` function**

In `src/app/ad-dashboard/lib/meta-api.ts`, replace the `metaFetch` function (lines 49-67):

```typescript
async function metaFetch<T>(
  endpoint: string,
  accessToken: string
): Promise<T> {
  const url = `${META_API_BASE}${endpoint}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg =
      body?.error?.message || `Meta API error: ${res.status}`;
    const code = body?.error?.code;
    throw new MetaApiError(msg, res.status, code);
  }

  return res.json();
}
```

Also fix `exchangeCodeForToken` (line 368-393) and `getLongLivedToken` (line 397-422) - these use `fetch` directly with params in URL. These OAuth endpoints require params in URL per Meta's spec, so leave those as-is. Only the Graph API calls (via `metaFetch`) need the header change.

- [ ] **Step 2: Fix `instagram-api.ts` `igFetch` function**

In `src/app/ad-dashboard/lib/instagram-api.ts`, replace the `igFetch` function (lines 23-48):

```typescript
async function igFetch<T>(url: string, accessToken: string): Promise<T> {
  const fullUrl = url.startsWith("http")
    ? url
    : `${META_API_BASE}${url}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const res = await fetch(fullUrl, {
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const msg = body?.error?.message || `Instagram API error: ${res.status}`;
      throw new InstagramApiError(msg, res.status, body?.error?.code);
    }
    return res.json();
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new InstagramApiError("Request timeout (30s)", 408);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
```

- [ ] **Step 3: Fix pagination URL in `getAdInsights`**

In `meta-api.ts`, the pagination at line 281 uses `res.paging.next` which is a full URL from Meta that includes the access token in the query. This is Meta's behavior - we can't control it. Leave it as-is since we can't modify Meta's pagination URLs.

- [ ] **Step 4: Verify the app still works**

```bash
cd /Users/danielgoldman/Desktop/projects/ads-dashboard
npx next build
```

- [ ] **Step 5: Commit**

```bash
git add src/app/ad-dashboard/lib/meta-api.ts src/app/ad-dashboard/lib/instagram-api.ts
git commit -m "security: move Meta access tokens from URL params to Authorization headers

Prevents token leakage via server logs, browser history, and Referer headers.
OAuth token exchange endpoints left as-is per Meta's spec."
```

---

### Task 4: Extract shared UI components and formatters

**Files:**
- Create: `src/app/ad-dashboard/components/kpi-card.tsx`
- Create: `src/app/ad-dashboard/components/confirm-dialog.tsx`
- Create: `src/app/ad-dashboard/components/scale-gauge.tsx`
- Modify: `src/app/ad-dashboard/lib/format.ts` (add missing formatters)
- Modify: `src/app/ad-dashboard/instagram-view.tsx` (remove duplicates, import shared)
- Modify: `src/app/ad-dashboard/instagram/charts.tsx` (remove duplicate KpiCard, import shared)

- [ ] **Step 1: Add missing formatters to `lib/format.ts`**

Add `fmtK` and `fmtDate` to `src/app/ad-dashboard/lib/format.ts`:

```typescript
export function fmtK(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString("he-IL");
}

export function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("he-IL", { day: "numeric", month: "short" });
}
```

- [ ] **Step 2: Create shared `kpi-card.tsx`**

Create `src/app/ad-dashboard/components/kpi-card.tsx`:

```typescript
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

export function KpiCard({
  label,
  value,
  icon,
  sub,
  color = "blue",
}: KpiCardProps) {
  return (
    <div className={`${GLASS} ${GLASS_HOVER} p-4`}>
      <div className="mb-2 flex items-center gap-2">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${colorMap[color]} text-sm text-white`}
        >
          {icon}
        </div>
        <span className="text-xs font-medium text-gray-500">{label}</span>
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-gray-400">{sub}</div>}
    </div>
  );
}
```

- [ ] **Step 3: Create shared `confirm-dialog.tsx`**

Create `src/app/ad-dashboard/components/confirm-dialog.tsx`:

```typescript
"use client";

export function ConfirmDialog({
  open,
  title,
  message,
  onConfirm,
  onCancel,
  danger,
}: {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="mx-4 w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-2 text-lg font-bold text-gray-900">{title}</h3>
        <p className="mb-6 text-sm leading-relaxed text-gray-500">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all ${danger ? "bg-red-600 hover:bg-red-500" : "bg-blue-600 hover:bg-blue-500"}`}
          >
            אישור
          </button>
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-medium text-gray-600 transition-all hover:bg-gray-100"
          >
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create shared `scale-gauge.tsx`**

Create `src/app/ad-dashboard/components/scale-gauge.tsx`:

```typescript
"use client";

import type { ScaleLevel } from "../lib/types";

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
        <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="6" />
        <circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset} className="transition-all duration-1000" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold text-gray-900">{score}</span>
        <span className="text-[9px] text-gray-400">/100</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Update `instagram-view.tsx` to use shared formatters**

In `src/app/ad-dashboard/instagram-view.tsx`:

1. Remove the local `fmtK`, `fmtPct`, `fmtDate`, `fmtDay`, `fmtHour` functions (lines 17-38)
2. Remove the local `KpiCard` component (lines 84-120)
3. Add imports at top:

```typescript
import { fmtK, fmtPct, fmtDate } from "./lib/format";
import { KpiCard } from "./components/kpi-card";
```

Keep `fmtDay` and `fmtHour` as local since they're Instagram-specific.

- [ ] **Step 6: Update `instagram/charts.tsx` to use shared components**

In `src/app/ad-dashboard/instagram/charts.tsx`:

1. Remove the local `KpiCard` component (lines 116-138)
2. Add import: `import { KpiCard } from "../components/kpi-card";`

- [ ] **Step 7: Update `instagram/utils.ts`**

Check if `src/app/ad-dashboard/instagram/utils.ts` has duplicate formatters. If it re-exports `fmtK`/`fmtDate`, update the imports in `charts.tsx` to use `../lib/format` instead.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor: extract shared components and deduplicate formatters

- Shared KpiCard, ConfirmDialog, ScaleGauge components
- Centralized fmtK, fmtDate in lib/format.ts
- Removed duplicates from instagram-view.tsx and instagram/charts.tsx"
```

---

### Task 5: Split `dashboard.tsx` into focused component files

This is the largest task. Extract the sub-components from `dashboard.tsx` (3233 lines) into separate files. The main `Dashboard` component stays but becomes much smaller.

**Files:**
- Create: `src/app/ad-dashboard/components/winning-ads-view.tsx`
- Create: `src/app/ad-dashboard/components/meta-actions-debug.tsx`
- Create: `src/app/ad-dashboard/components/dashboard-kpi-card.tsx`
- Create: `src/app/ad-dashboard/components/funnel-view.tsx`
- Create: `src/app/ad-dashboard/components/daily-trend.tsx`
- Create: `src/app/ad-dashboard/components/smart-recommendations.tsx`
- Modify: `src/app/ad-dashboard/dashboard.tsx` (keep only main Dashboard + imports)

- [ ] **Step 1: Extract `MetaActionsDebug` component**

Create `src/app/ad-dashboard/components/meta-actions-debug.tsx`.

Extract the `MetaActionsDebug` function (dashboard.tsx lines 65-297) into this new file. It needs these imports:

```typescript
"use client";

import { useState } from "react";
import type { Account } from "../lib/types";
import { type DatePreset, getDateRange } from "../lib/date-presets";
```

Export the component: `export function MetaActionsDebug(...)`.

- [ ] **Step 2: Extract `WinningAdsView` component**

Create `src/app/ad-dashboard/components/winning-ads-view.tsx`.

Extract the `WinningAdsView` function (dashboard.tsx lines 299-701) plus the `rankLabel` helper (lines 57-63) into this file. It needs:

```typescript
"use client";

import { useState, useMemo } from "react";
import type { Account } from "../lib/types";
import type { AdInsight } from "../lib/meta-api";
import { fmtN, fmtCurrency, fmtPct, fmtDec } from "../lib/format";
import { GLASS } from "../lib/constants";
import { type DatePreset, DATE_PRESETS } from "../lib/date-presets";
import { MetaActionsDebug } from "./meta-actions-debug";
```

- [ ] **Step 3: Extract `DashboardKPICard` + `FunnelStep` + `FunnelDropoff`**

Create `src/app/ad-dashboard/components/funnel-view.tsx`.

Move `FunnelStep` (lines 824-883), `FunnelDropoff` (lines 1106-1120), and `CampaignResultsBanner` (lines 1122-1220) into this file.

Also create `src/app/ad-dashboard/components/dashboard-kpi-card.tsx` for the dashboard-specific `KPICard` (lines 756-822) which has different props than the Instagram KpiCard (it has `color` as string, `status`, `large`).

- [ ] **Step 4: Extract `DailyTrend` component**

Create `src/app/ad-dashboard/components/daily-trend.tsx`.

Move `DailyTrend` (lines 885-953) into this file. It needs:

```typescript
"use client";

import type { DayData, DayMetrics } from "../lib/types";
import { fmtSigned } from "../lib/format";
import { GLASS } from "../lib/constants";
```

- [ ] **Step 5: Extract `SmartRecommendations` components**

Create `src/app/ad-dashboard/components/smart-recommendations.tsx`.

Move `SmartRecommendationCard` (lines 1031-1103) and `OverallHealthScore` import into this file. Import `ScaleGauge` and `OverallHealthScore` from `./scale-gauge`.

- [ ] **Step 6: Update `dashboard.tsx` imports**

Replace all the extracted inline components with imports:

```typescript
import { WinningAdsView } from "./components/winning-ads-view";
import { ConfirmDialog } from "./components/confirm-dialog";
import { DashboardKPICard } from "./components/dashboard-kpi-card";
import { FunnelStep, FunnelDropoff, CampaignResultsBanner } from "./components/funnel-view";
import { DailyTrend } from "./components/daily-trend";
import { SmartRecommendationCard } from "./components/smart-recommendations";
import { OverallHealthScore } from "./components/scale-gauge";
```

Remove the extracted functions from dashboard.tsx. Also remove `NumCell`, `TxtCell`, `CC`, `StaticCell` helper components (lines 1221-1298) - inline them or move to a small `table-cells.tsx` if they're used by the daily table.

- [ ] **Step 7: Verify build passes**

```bash
cd /Users/danielgoldman/Desktop/projects/ads-dashboard
npx next build
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor: split dashboard.tsx (3233 lines) into focused components

Extracted: WinningAdsView, MetaActionsDebug, DashboardKPICard,
FunnelView, DailyTrend, SmartRecommendations, ConfirmDialog.
Main Dashboard component is now import-heavy but focused on state
management and layout orchestration."
```

---

### Task 6: Add `loading.tsx` and fix model mapping

**Files:**
- Create: `src/app/ad-dashboard/loading.tsx`
- Remove misleading model mapping from `src/lib/utils/anthropic-client.ts` (already done in Task 1)

- [ ] **Step 1: Create `loading.tsx` for the dashboard route**

Create `src/app/ad-dashboard/loading.tsx`:

```typescript
export default function DashboardLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50" dir="rtl">
      <div className="text-center">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-3 border-blue-500 border-t-transparent" />
        <p className="text-sm text-gray-500">טוען דשבורד...</p>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/ad-dashboard/loading.tsx
git commit -m "feat: add loading.tsx for dashboard route

Shows a spinner while the server component loads session data."
```

---

### Task 7: Final build verification and cleanup

**Files:**
- Verify all files compile
- Clean up any remaining issues

- [ ] **Step 1: Full build check**

```bash
cd /Users/danielgoldman/Desktop/projects/ads-dashboard
npx next build
```

- [ ] **Step 2: Fix any remaining TypeScript errors**

Address any errors from the build output. Common issues:
- Missing exports
- Incorrect import paths after refactoring
- Type mismatches from extracted components

- [ ] **Step 3: Verify dev server starts**

```bash
cd /Users/danielgoldman/Desktop/projects/ads-dashboard
npx next dev &
sleep 5
curl -s http://localhost:3000 | head -20
kill %1
```

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "fix: resolve remaining build issues after refactor"
```
