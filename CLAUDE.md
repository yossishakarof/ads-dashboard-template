# Ads Dashboard - Claude Code Guide

## What is this?

Self-hosted Meta Ads + Instagram analytics dashboard. Runs locally, no external DB - all data from Meta API, settings in localStorage, auth via signed cookies.

**Stack:** Next.js 16 (App Router), React 19, Tailwind v4, TypeScript

## Quick Start

```bash
npm install
cp .env.example .env.local
# Edit .env.local with your Meta access token (see Auth below)
npm run dev
```

## Auth - Two Modes

### Direct Token (recommended for personal use)

No Meta App needed. Just set `META_ACCESS_TOKEN` in `.env.local`:

1. Go to https://developers.facebook.com/tools/explorer/
2. Select your app, request `ads_read` permission
3. Generate token, paste into `.env.local`

```bash
META_ACCESS_TOKEN=your_token_here
AD_DASHBOARD_SESSION_SECRET=$(openssl rand -hex 32)
```

### OAuth Flow (for multi-user / production)

Requires a Meta Developer App. Set in `.env.local`:

```bash
META_APP_ID=your_app_id
META_APP_SECRET=your_app_secret
META_REDIRECT_URI=http://localhost:3000/api/ad-dashboard/auth/callback
AD_DASHBOARD_SESSION_SECRET=$(openssl rand -hex 32)
```

## AI Chat

Uses local Claude Code CLI via `@anthropic-ai/claude-agent-sdk`. No API key needed - uses your existing Claude Code auth. Requires Claude Code installed (`npm install -g @anthropic-ai/claude-code`).

## Project Structure

```
src/
  app/
    ad-dashboard/
      page.tsx              - Server component, reads session
      dashboard.tsx          - Main client component (state + layout)
      ai-chat.tsx            - AI chat panel (uses local Claude Code)
      diagnostic-view.tsx    - Funnel diagnostic engine
      instagram-view.tsx     - Instagram analytics
      components/            - Extracted UI components
        winning-ads-view.tsx - Ad performance comparison
        dashboard-kpi-card.tsx
        funnel-view.tsx
        daily-trend.tsx
        smart-recommendations.tsx
        confirm-dialog.tsx
        kpi-card.tsx         - Shared KPI card (used by Instagram views)
        scale-gauge.tsx
        table-cells.tsx
      lib/
        meta-api.ts          - Meta Graph API client
        instagram-api.ts     - Instagram API client
        calculations.ts      - Metrics, summaries, recommendations
        session.ts           - Cookie-based session (HMAC signed)
        types.ts             - All TypeScript interfaces
        format.ts            - Number/currency formatters
        constants.ts         - Shared constants, defaults
        date-presets.ts      - Date range helpers
      login/page.tsx         - OAuth login page
    api/ad-dashboard/
      auth/                  - OAuth login/callback/logout
      sync/route.ts          - Sync data from Meta API
      chat/route.ts          - AI chat endpoint
      instagram/             - Instagram API endpoints
  lib/utils/
    anthropic-client.ts      - Claude Code Agent SDK wrapper
```

## Coding Conventions

- Hebrew UI, RTL layout (lang="he", dir="rtl")
- Assistant font for Hebrew text
- Tailwind v4 with `GLASS` / `GLASS_HOVER` constants for card styles
- Formatters in `lib/format.ts` - use `fmtN`, `fmtCurrency`, `fmtPct`, `fmtK` etc.
- Access tokens sent via `Authorization: Bearer` header (not URL params)
- No em dashes in any output
- Israeli market defaults (18% VAT, NIS currency)

## Key Decisions

- No database - localStorage + Meta API on each sync
- Session stored in HMAC-signed httpOnly cookie (60-day expiry)
- Meta API v21.0
- AI features optional - dashboard works without Claude Code installed
