"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import type {
  DayData,
  Settings,
  Account,
  CampaignGoal,
  SyncStatus,
  AdUser,
  ScaleLevel,
} from "./lib/types";
import {
  calcDay,
  calcSummary,
  mergeDays,
  aggregateDays,
  groupByWeek,
  calcAdLeaderboard,
  getSmartRecommendations,
  generateEmptyDays,
  generateDemo,
  dbRowToDayData,
} from "./lib/calculations";
import {
  MONTHS_HE,
  DEFAULT_SETTINGS,
  EMPTY_DAY,
  CAMPAIGN_GOAL_LABELS,
  LEAD_ACTION_TYPES,
  GLASS,
  GLASS_HOVER,
} from "./lib/constants";
import {
  fmtN,
  fmtCurrency,
  fmtSigned,
  fmtPct,
  fmtRoas,
  fmtDec,
} from "./lib/format";
import type { AdInsight } from "./lib/meta-api";
import { DiagnosticView } from "./diagnostic-view";
import { InstagramView } from "./instagram-view";
import { AIChatPanel } from "./ai-chat";
import { type DatePreset, DATE_PRESETS, getDateRange } from "./lib/date-presets";
import { WinningAdsView } from "./components/winning-ads-view";
import { ConfirmDialog } from "./components/confirm-dialog";
import { DashboardKPICard as KPICard } from "./components/dashboard-kpi-card";
import { CampaignResultsBanner } from "./components/funnel-view";
import { NumCell, CC, StaticCell } from "./components/table-cells";

// ═══════════════════════════════════════════════════════════
// MAIN DASHBOARD COMPONENT
// ═══════════════════════════════════════════════════════════

export function Dashboard({
  user,
}: {
  user: AdUser | null;
}) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activeAccountId, setActiveAccountId] = useState("summary");
  const [timeView, setTimeView] = useState<"daily" | "weekly" | "monthly">(
    "daily"
  );
  const [showAI, setShowAI] = useState(false);
  const [showWinningAds, setShowWinningAds] = useState(false);
  const [showDiagnostic, setShowDiagnostic] = useState(false);
  const [showInstagram, setShowInstagram] = useState(false);
  const [diagDatePreset, setDiagDatePreset] = useState<DatePreset>("this_month");
  const [diagAccountId, setDiagAccountId] = useState("summary");
  const [diagCampaignId, setDiagCampaignId] = useState<string>("");
  const [diagCampaigns, setDiagCampaigns] = useState<Array<{ id: string; name: string; status: string }>>([]);
  const [diagSum, setDiagSum] = useState<typeof sum | null>(null);
  const [diagLoading, setDiagLoading] = useState(false);
  const [winningAds, setWinningAds] = useState<AdInsight[]>([]);
  const [winningAdsLoading, setWinningAdsLoading] = useState(false);
  const [winningAdsError, setWinningAdsError] = useState<string | null>(null);
  const [winningAdsAccountId, setWinningAdsAccountId] = useState("all");
  const [winningAdsDatePreset, setWinningAdsDatePreset] = useState<DatePreset>("this_month");
  const [aiTab, setAiTab] = useState<"import" | "export">("import");
  const [jsonIn, setJsonIn] = useState("");
  const [importMsg, setImportMsg] = useState<{
    ok: boolean;
    msg: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    danger?: boolean;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<
    Record<string, SyncStatus>
  >({});

  // ─── Load data from API ───
  useEffect(() => {
    if (!user) {
      // No user — use localStorage fallback (demo mode)
      try {
        const saved = localStorage.getItem("ad-dashboard-v4");
        if (saved) {
          const d = JSON.parse(saved);
          if (d.settings) setSettings(d.settings);
          if (d.accounts?.length) setAccounts(d.accounts);
        }
      } catch {
        /* ignore */
      }
      setIsLoading(false);
      return;
    }

    // Authenticated — load from API (optimized: parallel fetch)
    const loadData = async () => {
      try {
        // 1. Fetch accounts from Meta (skip settings — uses client defaults)
        const accountsRes = await fetch("/api/ad-dashboard/accounts");
        if (!accountsRes.ok) throw new Error("Failed to fetch accounts");
        const { accounts: accs } = await accountsRes.json();

        if (accs?.length) {
          const s = settings;

          // 2. Show accounts immediately with empty days (instant UI)
          const emptyAccounts: Account[] = accs.map((acc: { id: string; name: string; metaAccountId?: string }) => ({
            id: acc.id,
            name: acc.name,
            metaAccountId: acc.metaAccountId,
            days: generateEmptyDays(s.month, s.year),
          }));
          setAccounts(emptyAccounts);
          setIsLoading(false);

          // 3. Sync ALL accounts in parallel from Meta (fills in real data)
          await Promise.all(
            emptyAccounts.map((acc) => syncAccount(acc.id, s.month, s.year))
          );
          return; // isLoading already set to false above
        }
      } catch (err) {
        console.error("Failed to load dashboard data:", err);
        setLoadError(err instanceof Error ? err.message : "שגיאה בטעינת נתונים");
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // ─── Persistence for non-authenticated users ───
  useEffect(() => {
    if (user) return; // Don't use localStorage when authenticated
    try {
      localStorage.setItem(
        "ad-dashboard-v4",
        JSON.stringify({ settings, accounts })
      );
    } catch {
      /* ignore */
    }
  }, [settings, accounts, user]);

  // ─── Sync from Meta ───
  const syncAccount = useCallback(
    async (accountId: string, month: number, year: number, force = false) => {
      setSyncStatus((prev) => ({
        ...prev,
        [accountId]: { lastSynced: null, isSyncing: true, error: null },
      }));

      try {
        const res = await fetch("/api/ad-dashboard/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accountId, month, year, force, leadActionType: settings.leadActionTypes?.[accountId] || settings.leadActionType || "auto" }),
        });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || `שגיאה בסנכרון (${res.status})`);
        }

        if (data.synced && data.data) {
          // Merge sync data directly into account days
          setAccounts((prev) =>
            prev.map((acc) => {
              if (acc.id !== accountId) return acc;
              const days = [...acc.days];
              for (const insight of data.data) {
                // "2026-03-15" → day 15
                const parts = insight.date.split("-");
                if (parts.length !== 3) continue;
                const dayNum = parseInt(parts[2]);
                if (dayNum >= 1 && dayNum <= days.length) {
                  days[dayNum - 1] = {
                    ...days[dayNum - 1],
                    adSpend: insight.adSpend || 0,
                    impressions: insight.impressions || 0,
                    uniqueClicks: insight.uniqueClicks || 0,
                    landingPageViews: insight.landingPageViews || 0,
                    registrations: insight.registrations || 0,
                    purchases: insight.purchases || 0,
                    revenue: insight.revenue || 0,
                  };
                }
              }
              return { ...acc, days };
            })
          );
        }

        setSyncStatus((prev) => ({
          ...prev,
          [accountId]: {
            lastSynced: data.lastSynced || data.last_synced || null,
            isSyncing: false,
            error: null,
          },
        }));
      } catch (err) {
        setSyncStatus((prev) => ({
          ...prev,
          [accountId]: {
            lastSynced: null,
            isSyncing: false,
            error: err instanceof Error ? err.message : "Sync failed",
          },
        }));
      }
    },
    [settings.leadActionTypes, settings.leadActionType]
  );

  // ─── Computed data ───
  const activeAccount = accounts.find((a) => a.id === activeAccountId);
  const isEditable =
    timeView === "daily" &&
    (activeAccountId !== "summary" || accounts.length === 1);

  const activeDays = useMemo(() => {
    if (activeAccountId === "summary") return mergeDays(accounts);
    return accounts.find((a) => a.id === activeAccountId)?.days || [];
  }, [activeAccountId, accounts]);

  const metrics = useMemo(
    () => activeDays.map((d) => calcDay(d, settings.vatRate)),
    [activeDays, settings.vatRate]
  );

  const sum = useMemo(
    () => calcSummary(activeDays, settings.vatRate),
    [activeDays, settings.vatRate]
  );

  const bestDays = useMemo(() => {
    let bestCtrIdx = -1,
      bestCtrVal = -1;
    let bestCostLpvIdx = -1,
      bestCostLpvVal = Infinity;
    let bestRegRateIdx = -1,
      bestRegRateVal = -1;

    activeDays.forEach((day, i) => {
      const active = day.adSpend > 0 || day.revenue > 0 || day.purchases > 0;
      if (!active) return;
      const m = metrics[i];
      if (m.ctr > bestCtrVal) {
        bestCtrVal = m.ctr;
        bestCtrIdx = i;
      }
      if (day.landingPageViews > 0 && day.adSpend > 0) {
        const cpv = day.adSpend / day.landingPageViews;
        if (cpv < bestCostLpvVal) {
          bestCostLpvVal = cpv;
          bestCostLpvIdx = i;
        }
      }
      if (m.regRate > bestRegRateVal) {
        bestRegRateVal = m.regRate;
        bestRegRateIdx = i;
      }
    });

    return {
      bestCtrIdx,
      bestCostLpvIdx,
      bestCostLpvVal:
        bestCostLpvIdx >= 0
          ? activeDays[bestCostLpvIdx].adSpend /
            activeDays[bestCostLpvIdx].landingPageViews
          : 0,
      bestRegRateIdx,
    };
  }, [activeDays, metrics]);

  const adLeaderboard = useMemo(
    () => calcAdLeaderboard(activeDays, settings.campaignGoal),
    [activeDays, settings.campaignGoal]
  );

  const smartRecs = useMemo(
    () => getSmartRecommendations(activeDays, settings.vatRate),
    [activeDays, settings.vatRate]
  );

  // Campaign results — computed based on campaign goal
  const campaignResults = useMemo(() => {
    const goal = settings.campaignGoal;
    let totalResults = 0;
    if (goal === "clicks") totalResults = sum.totalUniqueClicks;
    else if (goal === "landingPageViews") totalResults = sum.totalLPV;
    else if (goal === "registrations") totalResults = sum.totalRegistrations;
    else if (goal === "purchases") totalResults = sum.totalPurchases;
    else if (goal === "revenue") totalResults = sum.totalRevenue;
    const costPerResult = totalResults > 0 ? sum.totalSpend / totalResults : 0;
    const cpl = sum.totalRegistrations > 0 ? sum.totalSpend / sum.totalRegistrations : 0;
    return { totalResults, costPerResult, cpl };
  }, [sum, settings.campaignGoal]);

  const weeklyRows = useMemo(() => {
    if (timeView !== "weekly") return [];
    return groupByWeek(activeDays).map((w) => ({
      label: w.label,
      day: w.data,
      metrics: calcDay(w.data, settings.vatRate),
    }));
  }, [timeView, activeDays, settings.vatRate]);

  const monthlyRow = useMemo(() => {
    if (timeView !== "monthly") return null;
    const agg = aggregateDays(activeDays);
    return {
      label: "סה״כ חודשי",
      day: agg,
      metrics: calcDay(agg, settings.vatRate),
    };
  }, [timeView, activeDays, settings.vatRate]);

  // ─── Handlers ───
  const upDay = useCallback(
    (i: number, field: keyof DayData, val: number | string) => {
      // Determine which account to update
      const targetAccountId =
        activeAccountId === "summary" && accounts.length === 1
          ? accounts[0].id
          : activeAccountId;
      if (!targetAccountId || targetAccountId === "summary") return;

      setAccounts((prev) =>
        prev.map((acc) =>
          acc.id === targetAccountId
            ? {
                ...acc,
                days: acc.days.map((d, j) =>
                  j === i ? { ...d, [field]: val } : d
                ),
              }
            : acc
        )
      );

      // Persist to API if authenticated
      if (user) {
        const day = activeDays[i];
        if (day) {
          // Convert date "15.3" to "2026-03-15"
          const dayNum = parseInt(day.date.split(".")[0]);
          const dateStr = `${settings.year}-${String(settings.month).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
          fetch("/api/ad-dashboard/daily-data", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              accountId: targetAccountId,
              date: dateStr,
              [field]: val,
            }),
          }).catch(() => {});
        }
      }
    },
    [activeAccountId, user, activeDays, settings.month, settings.year]
  );

  const upSet = useCallback(
    <K extends keyof Settings>(k: K, v: Settings[K]) => {
      setSettings((p) => ({ ...p, [k]: v }));
      if (user) {
        fetch("/api/ad-dashboard/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [k]: v }),
        }).catch(() => {});
      }
    },
    [user]
  );

  const chMonth = useCallback(
    (month: number, year: number) => {
      const hasData = accounts.some((acc) =>
        acc.days.some(
          (d) => d.adSpend > 0 || d.revenue > 0 || d.purchases > 0
        )
      );
      const doChange = () => {
        setSettings((p) => ({ ...p, month, year }));
        if (user) {
          // Reload data from API for new month
          setIsLoading(true);
          Promise.all(
            accounts.map(async (acc) => {
              const dataRes = await fetch(
                `/api/ad-dashboard/daily-data?accountId=${acc.id}&month=${month}&year=${year}`
              );
              let days = generateEmptyDays(month, year);
              if (dataRes.ok) {
                const { rows } = await dataRes.json();
                for (const row of rows) {
                  const dayData = dbRowToDayData(row);
                  const dayNum = parseInt(dayData.date.split(".")[0]);
                  if (dayNum >= 1 && dayNum <= days.length) {
                    days[dayNum - 1] = dayData;
                  }
                }
              }
              return { ...acc, days };
            })
          ).then((updated) => {
            setAccounts(updated);
            setIsLoading(false);
            // Auto-sync for new month
            for (const acc of updated) {
              syncAccount(acc.id, month, year);
            }
          });
          fetch("/api/ad-dashboard/settings", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ month, year }),
          }).catch(() => {});
        } else {
          setAccounts((prev) =>
            prev.map((acc) => ({
              ...acc,
              days: generateEmptyDays(month, year),
            }))
          );
        }
      };
      if (hasData && !user) {
        setConfirmDialog({
          title: "שינוי חודש",
          message: "שינוי חודש ימחק את כל הנתונים הקיימים. להמשיך?",
          onConfirm: () => {
            doChange();
            setConfirmDialog(null);
          },
          danger: true,
        });
      } else {
        doChange();
      }
    },
    [accounts, user, syncAccount]
  );

  const loadDemo = useCallback(() => {
    setConfirmDialog({
      title: "טעינת דאטה לדוגמה",
      message:
        "פעולה זו תחליף את כל הנתונים הקיימים בדאטה לדוגמה. להמשיך?",
      onConfirm: () => {
        const demoAccounts =
          accounts.length > 0
            ? accounts
            : [
                {
                  id: "1",
                  name: "חשבון 1",
                  days: generateEmptyDays(settings.month, settings.year),
                },
              ];
        setAccounts(
          demoAccounts.map((acc, idx) => ({
            ...acc,
            days: generateDemo(settings.month, settings.year, idx),
          }))
        );
        setSettings((p) => ({
          ...p,
          businessName: p.businessName || "העסק שלי",
        }));
        setConfirmDialog(null);
      },
    });
  }, [settings.month, settings.year, accounts]);

  const clearAll = useCallback(() => {
    setConfirmDialog({
      title: "ניקוי נתונים",
      message:
        activeAccountId === "summary"
          ? "למחוק את כל הנתונים בכל החשבונות?"
          : "למחוק את כל הנתונים בחשבון הנוכחי?",
      onConfirm: () => {
        if (activeAccountId === "summary") {
          setAccounts((prev) =>
            prev.map((acc) => ({
              ...acc,
              days: generateEmptyDays(settings.month, settings.year),
            }))
          );
        } else {
          setAccounts((prev) =>
            prev.map((acc) =>
              acc.id === activeAccountId
                ? {
                    ...acc,
                    days: generateEmptyDays(
                      settings.month,
                      settings.year
                    ),
                  }
                : acc
            )
          );
        }
        setConfirmDialog(null);
      },
      danger: true,
    });
  }, [activeAccountId, settings.month, settings.year]);

  const addAccount = useCallback(() => {
    const newId = String(Date.now());
    setAccounts((prev) => [
      ...prev,
      {
        id: newId,
        name: `חשבון ${prev.length + 1}`,
        days: generateEmptyDays(settings.month, settings.year),
      },
    ]);
    setActiveAccountId(newId);
  }, [settings.month, settings.year]);

  const removeAccount = useCallback(
    (id: string) => {
      const accName = accounts.find((a) => a.id === id)?.name || "חשבון";
      setConfirmDialog({
        title: "מחיקת חשבון",
        message: `למחוק את "${accName}" וכל הנתונים שלו?`,
        onConfirm: () => {
          setAccounts((prev) => {
            if (prev.length <= 1) return prev;
            return prev.filter((a) => a.id !== id);
          });
          if (activeAccountId === id) setActiveAccountId("summary");
          setConfirmDialog(null);
        },
        danger: true,
      });
    },
    [activeAccountId, accounts]
  );

  const renameAccount = useCallback((id: string, name: string) => {
    setAccounts((prev) =>
      prev.map((acc) => (acc.id === id ? { ...acc, name } : acc))
    );
  }, []);

  const doExport = useCallback(() => {
    if (user) {
      // Download from API
      window.open("/api/ad-dashboard/export", "_blank");
      return "";
    }
    if (activeAccountId === "summary") {
      const accsWithData = accounts.map((acc) => ({
        id: acc.id,
        name: acc.name,
        days: acc.days.filter(
          (d) => d.adSpend > 0 || d.revenue > 0 || d.purchases > 0
        ),
      }));
      return JSON.stringify(
        {
          settings,
          accounts: accsWithData,
          _lastUpdated: new Date().toISOString(),
        },
        null,
        2
      );
    }
    const act = (activeAccount?.days || []).filter(
      (d: DayData) => d.adSpend > 0 || d.revenue > 0 || d.purchases > 0
    );
    return JSON.stringify(
      {
        settings,
        accountId: activeAccountId,
        accountName: activeAccount?.name,
        days: act,
      },
      null,
      2
    );
  }, [accounts, activeAccount, activeAccountId, settings, user]);

  const doImport = useCallback(() => {
    try {
      const data = JSON.parse(jsonIn);

      if (user) {
        // Send to API
        fetch("/api/ad-dashboard/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: jsonIn,
        })
          .then((res) => res.json())
          .then((result) => {
            if (result.ok) {
              setImportMsg({
                ok: true,
                msg: result.message || "יובא בהצלחה",
              });
              setJsonIn("");
              // Reload
              window.location.reload();
            } else {
              setImportMsg({
                ok: false,
                msg: result.error || "שגיאה בייבוא",
              });
            }
          });
        return;
      }

      // Local import (no auth)
      if (data.settings) setSettings((p) => ({ ...p, ...data.settings }));
      const mo = data.settings?.month || settings.month;
      const yr = data.settings?.year || settings.year;

      if (data.accounts && Array.isArray(data.accounts)) {
        let importedCount = 0;
        setAccounts((prev) => {
          const updated = [...prev];
          for (const fileAcc of data.accounts) {
            if (!fileAcc.days?.length) continue;
            const idx = updated.findIndex((a) => a.id === fileAcc.id);
            const days = generateEmptyDays(mo, yr);
            for (const d of fileAcc.days) {
              const num = parseInt(d.date?.split(".")[0]);
              if (num >= 1 && num <= days.length) {
                days[num - 1] = { ...EMPTY_DAY, ...d, date: d.date || `${num}.${mo}` };
              }
            }
            if (idx >= 0) {
              updated[idx] = {
                ...updated[idx],
                name: fileAcc.name || updated[idx].name,
                days,
              };
            } else {
              updated.push({
                id: fileAcc.id || String(Date.now()),
                name: fileAcc.name || `חשבון ${updated.length + 1}`,
                days,
              });
            }
            importedCount++;
          }
          return updated;
        });
        setImportMsg({
          ok: true,
          msg: `יובאו ${data.accounts.length} חשבונות (${importedCount} עם נתונים)`,
        });
        setJsonIn("");
        return;
      }

      if (!data.days || !Array.isArray(data.days)) {
        setImportMsg({ ok: false, msg: 'חסר שדה "days" או "accounts"' });
        return;
      }
      setImportMsg({ ok: true, msg: `יובאו ${data.days.length} ימים` });
      setJsonIn("");
    } catch {
      setImportMsg({ ok: false, msg: "JSON לא תקין" });
    }
  }, [jsonIn, settings.month, settings.year, user]);

  const loadDiagnostic = useCallback(async (forAccountId?: string, preset?: DatePreset, campaignId?: string) => {
    if (!user || accounts.length === 0) return;

    const accId = forAccountId ?? diagAccountId;
    const dateP = preset ?? diagDatePreset;
    const campId = campaignId !== undefined ? campaignId : diagCampaignId;
    setDiagAccountId(accId);
    setDiagDatePreset(dateP);
    setDiagCampaignId(campId);
    setShowDiagnostic(true);
    setShowWinningAds(false);
    setShowInstagram(false);

    // Load campaigns list when account changes (only for single account, not "summary")
    if (forAccountId && forAccountId !== "summary") {
      try {
        const campRes = await fetch(`/api/ad-dashboard/campaigns?accountId=${forAccountId}`);
        const campData = await campRes.json();
        if (campData.campaigns) setDiagCampaigns(campData.campaigns);
      } catch {
        setDiagCampaigns([]);
      }
    } else if (forAccountId === "summary") {
      setDiagCampaigns([]);
    }

    // Use existing dashboard data only when no campaign filter and matches main view
    if (dateP === "this_month" && accId === activeAccountId && !campId) {
      setDiagSum(null);
      return;
    }

    setDiagLoading(true);
    const { since, until } = getDateRange(dateP);
    const targetIds = accId === "summary" ? accounts.map(a => a.id) : [accId];

    try {
      const allDays: import("./lib/types").DayData[] = [];
      for (const id of targetIds) {
        const res = await fetch("/api/ad-dashboard/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accountId: id, since, until, leadActionType: getLeadActionType(id), campaignId: campId || undefined }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        if (data.synced && data.data) {
          for (const insight of data.data) {
            allDays.push({
              date: insight.date,
              adSpend: insight.adSpend || 0,
              impressions: insight.impressions || 0,
              uniqueClicks: insight.uniqueClicks || 0,
              landingPageViews: insight.landingPageViews || 0,
              registrations: insight.registrations || 0,
              purchases: insight.purchases || 0,
              revenue: insight.revenue || 0,
              adName: "",
              notes: "",
            });
          }
        }
      }
      setDiagSum(calcSummary(allDays, settings.vatRate));
    } catch {
      setDiagSum(null);
    } finally {
      setDiagLoading(false);
    }
  }, [user, accounts, diagAccountId, diagDatePreset, diagCampaignId, activeAccountId, settings.vatRate, settings.leadActionType]);

  const loadWinningAds = useCallback(async (forAccountId?: string, preset?: DatePreset) => {
    if (!user || accounts.length === 0) return;

    const targetAccId = forAccountId || winningAdsAccountId || "all";
    const dateP = preset || winningAdsDatePreset;
    setWinningAdsAccountId(targetAccId);
    setWinningAdsDatePreset(dateP);

    const { since, until } = getDateRange(dateP);

    // Determine which accounts to fetch
    const targetIds: string[] =
      targetAccId === "all"
        ? accounts.map((a) => a.id)
        : [targetAccId];

    setShowWinningAds(true);
    setWinningAdsLoading(true);
    setWinningAdsError(null);
    try {
      const allAds: AdInsight[] = [];
      for (const accId of targetIds) {
        const res = await fetch("/api/ad-dashboard/ads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountId: accId,
            since,
            until,
            leadActionType: getLeadActionType(accId),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "שגיאה");
        if (data.ads) allAds.push(...data.ads);
      }
      setWinningAds(allAds);
    } catch (err) {
      setWinningAdsError(
        err instanceof Error ? err.message : "שגיאה בטעינת מודעות"
      );
    } finally {
      setWinningAdsLoading(false);
    }
  }, [user, accounts, winningAdsAccountId, winningAdsDatePreset, settings.leadActionType]);

  const clip = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const profitColor =
    sum.totalNetProfit > 0
      ? "green"
      : sum.totalNetProfit < 0
        ? "red"
        : "blue";
  const roasColor =
    sum.overallRoas >= settings.breakEvenRoas
      ? "green"
      : sum.overallRoas > 0
        ? "amber"
        : "red";

  const levelToStatus = (level: ScaleLevel): "good" | "warning" | "bad" =>
    level === "poor" || level === "below_avg"
      ? "bad"
      : level === "average"
        ? "warning"
        : "good";

  const inputCls =
    "rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-900 outline-none transition-all focus:border-blue-400 focus:ring-1 focus:ring-blue-100";
  const numInputCls = `${inputCls} [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`;

  const isSyncing = Object.values(syncStatus).some((s) => s.isSyncing);

  // Get lead action type for a specific account (per-account override or global default)
  const getLeadActionType = useCallback((accountId: string) => {
    return settings.leadActionTypes?.[accountId] || settings.leadActionType || "auto";
  }, [settings.leadActionTypes, settings.leadActionType]);

  // Set lead action type for a specific account + auto resync
  const setAccountLeadActionType = useCallback((accountId: string, actionType: string) => {
    const updated = { ...settings.leadActionTypes, [accountId]: actionType };
    upSet("leadActionTypes", updated);
    // Auto resync this account
    syncAccount(accountId, settings.month, settings.year, true);
  }, [settings.leadActionTypes, settings.month, settings.year, upSet, syncAccount]);
  const syncErrors = Object.entries(syncStatus).filter(([, s]) => s.error);
  const hasSyncErrors = syncErrors.length > 0;

  // ═══════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════

  if (isLoading) {
    return (
      <main
        className="flex min-h-screen items-center justify-center bg-gray-50"
        dir="rtl"
      >
        <div className="text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent mx-auto" />
          <p className="text-sm text-gray-400">טוען נתונים...</p>
        </div>
      </main>
    );
  }

  return (
    <main
      className="relative min-h-screen bg-gray-50 text-gray-900"
      dir="rtl"
    >
      <ConfirmDialog
        open={!!confirmDialog}
        title={confirmDialog?.title || ""}
        message={confirmDialog?.message || ""}
        onConfirm={confirmDialog?.onConfirm || (() => {})}
        onCancel={() => setConfirmDialog(null)}
        danger={confirmDialog?.danger}
      />

      <div className="mx-auto max-w-[1700px] px-4 py-8 md:px-8 md:py-12">
        {/* HEADER */}
        <header className="mb-10 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
              Meta Ads Dashboard
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 md:text-5xl">
              אצבע על הדופק
            </h1>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-gray-500">
              דשבורד מעקב Meta Ads + משפך המרות + רווחיות
              {user && (
                <span className="mr-2 text-blue-600">
                  · מחובר כ-{user.name}
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            {user && (
              <>
                <button
                  onClick={() => {
                    for (const acc of accounts) {
                      syncAccount(acc.id, settings.month, settings.year, true);
                    }
                  }}
                  disabled={isSyncing}
                  className={`rounded-xl border px-4 py-2 text-xs font-semibold transition-all ${
                    isSyncing
                      ? "border-blue-300 bg-blue-50 text-blue-600"
                      : "border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:bg-blue-50"
                  }`}
                >
                  {isSyncing ? "מסנכרן..." : "🔄 סנכרן מ-Meta"}
                </button>
                <button
                  onClick={() => { setShowDiagnostic(false); setShowInstagram(false); loadWinningAds(); }}
                  className={`rounded-xl border px-4 py-2 text-xs font-semibold transition-all ${
                    showWinningAds
                      ? "border-amber-300 bg-amber-50 text-amber-700"
                      : "border-gray-200 bg-white text-gray-600 hover:border-amber-300 hover:bg-amber-50"
                  }`}
                >
                  🏆 מודעה מנצחת
                </button>
                <button
                  onClick={() => { setShowInstagram(false); loadDiagnostic(); }}
                  className={`rounded-xl border px-4 py-2 text-xs font-semibold transition-all ${
                    showDiagnostic
                      ? "border-blue-300 bg-blue-50 text-blue-700"
                      : "border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:bg-blue-50"
                  }`}
                >
                  🩺 אבחון מצב
                </button>
                <button
                  onClick={() => { setShowWinningAds(false); setShowDiagnostic(false); setShowInstagram(!showInstagram); }}
                  className={`rounded-xl border px-4 py-2 text-xs font-semibold transition-all ${
                    showInstagram
                      ? "border-purple-300 bg-purple-50 text-purple-700"
                      : "border-gray-200 bg-white text-gray-600 hover:border-purple-300 hover:bg-purple-50"
                  }`}
                >
                  📸 אינסטגרם
                </button>
              </>
            )}
            {!user && (
              <>
                <a
                  href="/api/ad-dashboard/auth/login"
                  className="rounded-xl border border-blue-300 bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-700 transition-all hover:bg-blue-100"
                >
                  🔗 התחבר ל-Meta
                </a>
                <button
                  onClick={loadDemo}
                  className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-medium text-gray-600 transition-all hover:border-gray-300 hover:bg-gray-50"
                >
                  טען דאטה לדוגמה
                </button>
              </>
            )}
            <button
              onClick={clearAll}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-medium text-gray-600 transition-all hover:border-gray-300 hover:bg-gray-50"
            >
              נקה הכל
            </button>
            <button
              onClick={() => setShowAI(!showAI)}
              className={`rounded-xl border px-4 py-2 text-xs font-semibold transition-all ${
                showAI
                  ? "border-blue-300 bg-blue-50 text-blue-700"
                  : "border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:bg-blue-50"
              }`}
            >
              📥 ייבוא / ייצוא
            </button>
            {user && (
              <button
                onClick={() =>
                  fetch("/api/ad-dashboard/auth/logout", {
                    method: "POST",
                  }).then(() => (window.location.href = "/ad-dashboard/login"))
                }
                className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-medium text-gray-600 transition-all hover:border-red-300 hover:bg-red-50"
              >
                התנתק
              </button>
            )}
          </div>
        </header>

        {/* WINNING ADS VIEW */}
        {showWinningAds && (
          <WinningAdsView
            ads={winningAds}
            isLoading={winningAdsLoading}
            error={winningAdsError}
            onBack={() => setShowWinningAds(false)}
            accounts={accounts}
            activeAccountId={winningAdsAccountId}
            onChangeAccount={(id) => loadWinningAds(id)}
            datePreset={winningAdsDatePreset}
            onChangeDatePreset={(preset) => loadWinningAds(undefined, preset)}
          />
        )}

        {/* DIAGNOSTIC VIEW */}
        {showDiagnostic && (
          <DiagnosticView
            sum={diagSum ?? sum}
            breakEvenRoas={settings.breakEvenRoas}
            onBack={() => setShowDiagnostic(false)}
            accounts={accounts}
            activeAccountId={diagAccountId}
            onChangeAccount={(id) => loadDiagnostic(id, undefined, "")}
            datePreset={diagDatePreset}
            onChangeDatePreset={(preset) => loadDiagnostic(undefined, preset)}
            isLoading={diagLoading}
            campaigns={diagCampaigns}
            activeCampaignId={diagCampaignId}
            onChangeCampaign={(id) => loadDiagnostic(undefined, undefined, id)}
          />
        )}

        {/* INSTAGRAM VIEW */}
        {showInstagram && (
          <InstagramView onBack={() => setShowInstagram(false)} />
        )}

        {/* MAIN DASHBOARD (hidden when viewing winning ads, diagnostic, or instagram) */}
        {!showWinningAds && !showDiagnostic && !showInstagram && <>

        {/* LOAD ERROR */}
        {loadError && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="text-lg">❌</span>
              <div>
                <div className="text-sm font-bold text-red-700">שגיאה בטעינת נתונים</div>
                <p className="mt-0.5 text-sm text-red-600">{loadError}</p>
              </div>
              <button
                onClick={() => window.location.reload()}
                className="mr-auto rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition-all hover:bg-red-100"
              >
                רענן
              </button>
            </div>
          </div>
        )}

        {/* DATE PRESETS */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-gray-500">📅</span>
          {DATE_PRESETS.map((p) => {
            // Check if this preset matches current month
            const range = getDateRange(p.key);
            const presetMonth = parseInt(range.since.split("-")[1]);
            const presetYear = parseInt(range.since.split("-")[0]);
            const isActive = p.key === "this_month"
              ? settings.month === new Date().getMonth() + 1 && settings.year === new Date().getFullYear()
              : p.key === "last_month"
                ? (() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return settings.month === d.getMonth() + 1 && settings.year === d.getFullYear(); })()
                : false;
            return (
              <button
                key={p.key}
                onClick={() => {
                  const r = getDateRange(p.key);
                  const m = parseInt(r.since.split("-")[1]);
                  const y = parseInt(r.since.split("-")[0]);
                  chMonth(m, y);
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  isActive
                    ? "bg-gray-900 text-white"
                    : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {/* SETTINGS */}
        <div
          className={`mb-8 flex flex-wrap items-center gap-4 ${GLASS} p-4 md:gap-6 md:p-5`}
        >
          <label className="flex items-center gap-2 text-sm text-gray-600">
            שם העסק
            <input
              type="text"
              value={settings.businessName}
              onChange={(e) => upSet("businessName", e.target.value)}
              className={inputCls}
              placeholder="הכנס שם..."
            />
          </label>
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                let m = settings.month - 1;
                let y = settings.year;
                if (m < 1) {
                  m = 12;
                  y--;
                }
                chMonth(m, y);
              }}
              className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-600 transition-all hover:bg-gray-50"
            >
              ←
            </button>
            <label className="flex items-center gap-2 text-sm text-gray-600">
              חודש
              <select
                value={settings.month}
                onChange={(e) =>
                  chMonth(parseInt(e.target.value), settings.year)
                }
                className={inputCls}
              >
                {MONTHS_HE.map((m, i) => (
                  <option key={i} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <button
              onClick={() => {
                let m = settings.month + 1;
                let y = settings.year;
                if (m > 12) {
                  m = 1;
                  y++;
                }
                chMonth(m, y);
              }}
              className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-600 transition-all hover:bg-gray-50"
            >
              →
            </button>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600">
            שנה
            <input
              type="number"
              value={settings.year}
              onChange={(e) =>
                chMonth(settings.month, parseInt(e.target.value) || 2026)
              }
              className={`w-20 ${numInputCls}`}
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-600">
            מע״מ %
            <input
              type="number"
              value={settings.vatRate}
              onChange={(e) =>
                upSet("vatRate", parseFloat(e.target.value) || 18)
              }
              className={`w-14 ${numInputCls}`}
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-600">
            ROAS איזון
            <input
              type="number"
              step="0.1"
              value={settings.breakEvenRoas}
              onChange={(e) =>
                upSet("breakEvenRoas", parseFloat(e.target.value) || 2)
              }
              className={`w-16 ${numInputCls}`}
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-600">
            מטרת קמפיין
            <select
              value={settings.campaignGoal}
              onChange={(e) =>
                upSet("campaignGoal", e.target.value as CampaignGoal)
              }
              className={inputCls}
            >
              {(
                Object.entries(CAMPAIGN_GOAL_LABELS) as [
                  CampaignGoal,
                  string,
                ][]
              ).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          {activeAccountId !== "summary" ? (
            <label className="flex items-center gap-2 text-sm text-gray-600">
              אירוע ליד ({activeAccount?.name})
              <select
                value={getLeadActionType(activeAccountId)}
                onChange={(e) => setAccountLeadActionType(activeAccountId, e.target.value)}
                className={inputCls}
              >
                {LEAD_ACTION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
          ) : accounts.length === 1 ? (
            <label className="flex items-center gap-2 text-sm text-gray-600">
              אירוע ליד
              <select
                value={getLeadActionType(accounts[0].id)}
                onChange={(e) => setAccountLeadActionType(accounts[0].id, e.target.value)}
                className={inputCls}
              >
                {LEAD_ACTION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="flex items-center gap-2 text-sm text-gray-600">
              אירוע ליד (ברירת מחדל)
              <select
                value={settings.leadActionType || "auto"}
                onChange={(e) => upSet("leadActionType", e.target.value)}
                className={inputCls}
              >
                {LEAD_ACTION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        {/* SYNC ERROR BANNER */}
        {hasSyncErrors && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-5 py-4">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 text-lg">⚠️</span>
              <div className="flex-1">
                <div className="text-sm font-bold text-red-700">
                  שגיאה במשיכת נתונים מ-Meta
                </div>
                <p className="mt-1 text-sm text-red-600">
                  הנתונים המוצגים עלולים להיות חלקיים או לא מעודכנים. החישובים עלולים להיות לא מדויקים.
                </p>
                <div className="mt-2 space-y-1">
                  {syncErrors.map(([accId, status]) => {
                    const accName = accounts.find(a => a.id === accId)?.name || accId;
                    return (
                      <div key={accId} className="text-xs text-red-500">
                        <span className="font-medium">{accName}:</span> {status.error}
                      </div>
                    );
                  })}
                </div>
                <button
                  onClick={() => {
                    for (const acc of accounts) {
                      syncAccount(acc.id, settings.month, settings.year, true);
                    }
                  }}
                  className="mt-3 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition-all hover:bg-red-100"
                >
                  🔄 נסה שוב
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ACCOUNT TABS */}
        <div className={`mb-8 overflow-hidden ${GLASS} p-1.5`}>
          <div className="flex items-center gap-1 overflow-x-auto">
            <button
              onClick={() => setActiveAccountId("summary")}
              className={`flex-shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
                activeAccountId === "summary"
                  ? "bg-blue-50 text-blue-700 shadow-sm"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
              }`}
            >
              📊 סיכום כולל
            </button>
            <div className="h-6 w-px flex-shrink-0 bg-gray-200" />
            {accounts.map((acc) => {
              const accSum = calcSummary(acc.days, settings.vatRate);
              return (
                <button
                  key={acc.id}
                  onClick={() => setActiveAccountId(acc.id)}
                  className={`group relative flex-shrink-0 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
                    activeAccountId === acc.id
                      ? "bg-purple-50 text-purple-700 shadow-sm"
                      : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                  }`}
                >
                  <span>{acc.name}</span>
                  {accSum.totalSpend > 0 && (
                    <span className="mr-2 text-[10px] text-gray-500">
                      {fmtCurrency(accSum.totalSpend)}
                    </span>
                  )}
                  {accounts.length > 1 && !user && (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        removeAccount(acc.id);
                      }}
                      className="absolute -left-1 -top-1 hidden h-4 w-4 cursor-pointer items-center justify-center rounded-full bg-red-500/80 text-[8px] text-white group-hover:flex"
                    >
                      ×
                    </span>
                  )}
                </button>
              );
            })}
            {!user && (
              <button
                onClick={addAccount}
                className="flex-shrink-0 rounded-xl px-3 py-2.5 text-lg text-gray-400 transition-all hover:bg-gray-50 hover:text-gray-600"
              >
                +
              </button>
            )}
          </div>
        </div>

        {/* ACCOUNT NAME */}
        {activeAccount && (
          <div className="-mt-4 mb-8 flex items-center gap-3 px-2">
            <span className="text-xs text-gray-500">שם חשבון:</span>
            <input
              type="text"
              value={activeAccount.name}
              onChange={(e) =>
                renameAccount(activeAccountId, e.target.value)
              }
              className="rounded-lg border border-gray-200 bg-white px-3 py-1 text-sm text-gray-900 outline-none transition-all focus:border-purple-400"
              readOnly={!!user}
            />
            {syncStatus[activeAccountId] && (
              <span className={`text-xs ${syncStatus[activeAccountId].error ? "text-red-600 font-medium" : "text-gray-500"}`}>
                {syncStatus[activeAccountId].isSyncing
                  ? "מסנכרן..."
                  : syncStatus[activeAccountId].error
                    ? `⚠ שגיאה בסנכרון: ${syncStatus[activeAccountId].error}`
                    : syncStatus[activeAccountId].lastSynced
                      ? `סונכרן לאחרונה: ${new Date(syncStatus[activeAccountId].lastSynced!).toLocaleString("he-IL")}`
                      : ""}
              </span>
            )}
          </div>
        )}

        {/* PER-ACCOUNT BREAKDOWN (Summary) */}
        {activeAccountId === "summary" && sum.activeDays > 0 && (
          <div className="mb-8">
            <h3 className="mb-4 text-lg font-bold text-gray-900">
              פירוט לפי חשבון
            </h3>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              {accounts.map((acc) => {
                const accSum = calcSummary(acc.days, settings.vatRate);
                if (accSum.activeDays === 0) return null;
                return (
                  <div
                    key={acc.id}
                    onClick={() => setActiveAccountId(acc.id)}
                    className={`cursor-pointer ${GLASS} ${GLASS_HOVER} p-4`}
                  >
                    <div className="mb-1 text-sm font-medium text-gray-500">
                      {acc.name}
                    </div>
                    <div className="text-lg font-bold text-gray-900">
                      {fmtCurrency(accSum.totalSpend)}
                    </div>
                    <div
                      className={`mt-1 text-sm font-semibold ${accSum.totalNetProfit > 0 ? "text-emerald-400" : accSum.totalNetProfit < 0 ? "text-red-400" : "text-gray-500"}`}
                    >
                      רווח: {fmtSigned(accSum.totalNetProfit)}
                    </div>
                    <div className="mt-0.5 text-xs text-gray-500">
                      ROAS: {fmtRoas(accSum.overallRoas)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SECTION: Financial Overview */}
        <div className="mb-2 flex items-center gap-2 px-1">
          <span className="text-sm font-bold text-gray-900">💼 סיכום כספי</span>
          <div className="h-px flex-1 bg-gray-200" />
        </div>
        <div className="mb-5 grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-5">
          <KPICard
            icon="💰"
            label="הוצאה על מודעות"
            value={fmtCurrency(sum.totalSpend)}
            sub={`${sum.activeDays} ימים פעילים`}
            color="blue"
            large={true}
          />
          <KPICard
            icon="📈"
            label="הכנסה ברוטו"
            value={fmtCurrency(sum.totalRevenue)}
            sub={`לפני מע״מ: ${fmtCurrency(sum.totalRevenueBeforeVat)}`}
            color="cyan"
            large={true}
            status={sum.totalRevenue > sum.totalSpend ? "good" : "bad"}
          />
          <KPICard
            icon={sum.totalNetProfit >= 0 ? "✅" : "⚠️"}
            label="רווח נקי (אחרי מע״מ)"
            value={fmtSigned(sum.totalNetProfit)}
            sub={`${sum.profitableDays} מתוך ${sum.activeDays} ימים ברווח`}
            color={profitColor}
            large={true}
            status={sum.totalNetProfit > 0 ? "good" : sum.totalNetProfit === 0 ? "warning" : "bad"}
          />
          <KPICard
            icon="🔄"
            label="החזר על הוצאה (ROAS)"
            value={fmtRoas(sum.overallRoas)}
            sub={`איזון: ${fmtRoas(settings.breakEvenRoas)} · ROI: ${fmtPct(sum.overallRoi)}`}
            color={roasColor}
            large={true}
            status={levelToStatus(smartRecs.metrics.find(m => m.metric === "roas")?.level || "average")}
          />
        </div>

        {/* CAMPAIGN RESULTS */}
        <CampaignResultsBanner
          goalLabel={CAMPAIGN_GOAL_LABELS[settings.campaignGoal]}
          totalResults={campaignResults.totalResults}
          costPerResult={campaignResults.costPerResult}
          totalLeads={sum.totalRegistrations}
          cpl={campaignResults.cpl}
          totalPurchases={sum.totalPurchases}
          cpa={sum.avgCpa}
          totalRevenue={sum.totalRevenue}
          campaignGoal={settings.campaignGoal}
        />

        {/* SECTION: Performance Metrics */}
        <div className="mb-2 flex items-center gap-2 px-1">
          <span className="text-sm font-bold text-gray-900">📊 מדדי ביצוע</span>
          <div className="h-px flex-1 bg-gray-200" />
        </div>
        <div className="mb-10 grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-5">
          <KPICard
            icon="📢"
            label="אחוז הקלקה (CTR)"
            value={fmtPct(sum.avgCtr)}
            sub={`עלות קליק: ${fmtDec(sum.avgCpc)} · CPM: ${fmtDec(sum.avgCpm)}`}
            color="purple"
            status={levelToStatus(smartRecs.metrics.find(m => m.metric === "ctr")?.level || "average")}
          />
          <KPICard
            icon="📝"
            label="אחוז המרה בדף (לידים)"
            value={fmtPct(sum.avgRegRate)}
            sub={`${fmtN(sum.totalRegistrations)} נרשמו מתוך ${fmtN(sum.totalLPV)} שהגיעו`}
            color="cyan"
            status={levelToStatus(smartRecs.metrics.find(m => m.metric === "regRate")?.level || "average")}
          />
          <KPICard
            icon="🛒"
            label="אחוז רכישה (מלידים)"
            value={fmtPct(sum.avgPurchaseRate)}
            sub={`${fmtN(sum.totalPurchases)} רכשו · ממוצע הזמנה: ${fmtCurrency(sum.avgAov)}`}
            color="green"
            status={levelToStatus(smartRecs.metrics.find(m => m.metric === "purchaseRate")?.level || "average")}
          />
          <KPICard
            icon="🎯"
            label="עלות לרכישה (CPA)"
            value={fmtDec(sum.avgCpa)}
            sub={sum.totalPurchases > 0 ? `${fmtN(sum.totalPurchases)} רכישות בסה״כ` : "אין רכישות עדיין"}
            color="amber"
            status={sum.avgCpa > 0 && sum.overallRoas >= settings.breakEvenRoas ? "good" : "bad"}
          />
        </div>

        {/* AD LEADERBOARD */}
        {adLeaderboard.length > 0 && (
          <div className={`mb-10 ${GLASS} p-5 md:p-6`}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">
                🏆 מודעה ווינרית (לפי{" "}
                {CAMPAIGN_GOAL_LABELS[settings.campaignGoal]})
              </h2>
              <span className="rounded-lg bg-gray-100 px-3 py-1 text-xs font-medium text-gray-500">
                {adLeaderboard.length} מודעות
              </span>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {adLeaderboard.slice(0, 3).map((ad, i) => {
                const medals = ["🥇", "🥈", "🥉"];
                const borderColors = [
                  "border-amber-300",
                  "border-gray-200",
                  "border-orange-200",
                ];
                const bgColors = [
                  "bg-amber-50",
                  "bg-white",
                  "bg-white",
                ];
                return (
                  <div
                    key={ad.adName}
                    className={`rounded-xl border ${borderColors[i]} ${bgColors[i]} p-4`}
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <span className="text-lg">{medals[i]}</span>
                      <span className="text-sm font-bold text-gray-900">
                        {ad.adName}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-gray-500">
                          {CAMPAIGN_GOAL_LABELS[settings.campaignGoal]}:{" "}
                        </span>
                        <span className="font-bold text-gray-900">
                          {settings.campaignGoal === "revenue"
                            ? fmtCurrency(ad.results)
                            : fmtN(ad.results)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">הוצאה: </span>
                        <span className="font-bold text-gray-900">
                          {fmtCurrency(ad.spend)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">ROAS: </span>
                        <span
                          className={`font-bold ${ad.roas >= settings.breakEvenRoas ? "text-emerald-600" : "text-red-600"}`}
                        >
                          {fmtRoas(ad.roas)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">CPA: </span>
                        <span className="font-bold text-gray-900">
                          {fmtDec(ad.cpa)}
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 text-[11px] text-gray-500">
                      {ad.days} ימים פעילים
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* IMPORT/EXPORT PANEL */}
        {showAI && (
          <div
            className={`mb-8 overflow-hidden ${GLASS}`}
          >
            <div className="flex border-b border-gray-200">
              {(
                [
                  { key: "import" as const, label: "ייבוא JSON", icon: "📥" },
                  { key: "export" as const, label: "ייצוא JSON", icon: "📤" },
                ] as const
              ).map((t) => (
                <button
                  key={t.key}
                  onClick={() => setAiTab(t.key)}
                  className={`flex items-center gap-1.5 px-5 py-3.5 text-sm font-medium transition-all ${
                    aiTab === t.key
                      ? "border-b-2 border-blue-500 bg-blue-50 text-blue-700"
                      : "text-gray-400 hover:bg-gray-50 hover:text-gray-600"
                  }`}
                >
                  <span className="text-xs">{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>
            <div className="p-5 md:p-7">
              {aiTab === "import" && (
                <div>
                  <p className="mb-3 text-sm text-gray-500">
                    הדבק JSON כדי לייבא נתונים לדשבורד.
                  </p>
                  <textarea
                    value={jsonIn}
                    onChange={(e) => {
                      setJsonIn(e.target.value);
                      setImportMsg(null);
                    }}
                    className="h-48 w-full rounded-xl border border-gray-200 bg-gray-50 p-4 font-mono text-sm text-gray-700 outline-none transition-all focus:border-blue-400 focus:bg-white"
                    placeholder='{"settings":{...},"accounts":[...]}'
                    dir="ltr"
                  />
                  <div className="mt-4 flex items-center gap-3">
                    <button
                      onClick={doImport}
                      disabled={!jsonIn.trim()}
                      className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-500 hover:shadow-md disabled:opacity-40 disabled:shadow-none"
                    >
                      ייבא נתונים
                    </button>
                    {importMsg && (
                      <span
                        className={`text-sm font-medium ${importMsg.ok ? "text-emerald-400" : "text-red-400"}`}
                      >
                        {importMsg.msg}
                      </span>
                    )}
                  </div>
                </div>
              )}
              {aiTab === "export" && (
                <div>
                  <p className="mb-3 text-sm text-gray-500">
                    נתונים נוכחיים כ-JSON.
                  </p>
                  {user ? (
                    <button
                      onClick={() => doExport()}
                      className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-500"
                    >
                      הורד JSON
                    </button>
                  ) : (
                    <>
                      <pre
                        className="max-h-64 overflow-auto rounded-xl border border-gray-200 bg-gray-50 p-4 font-mono text-sm text-gray-700"
                        dir="ltr"
                      >
                        {doExport()}
                      </pre>
                      <button
                        onClick={() => clip(doExport())}
                        className="mt-4 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-500"
                      >
                        {copied ? "הועתק! ✓" : "העתק JSON"}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* DAILY TABLE */}
        <div className="mb-10 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl shadow-black/5">
          <div className="flex flex-col gap-3 border-b border-gray-100 bg-gray-50 px-5 py-4 md:flex-row md:items-center md:justify-between md:px-7">
            <h2 className="text-xl font-bold text-gray-900">
              {activeAccountId === "summary"
                ? "סיכום כולל"
                : activeAccount?.name || "מעקב"}{" "}
              — {MONTHS_HE[settings.month - 1]} {settings.year}
            </h2>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-0.5 rounded-lg bg-gray-100 p-0.5">
                {(
                  [
                    { key: "daily" as const, label: "יומי" },
                    { key: "weekly" as const, label: "שבועי" },
                    { key: "monthly" as const, label: "חודשי" },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setTimeView(t.key)}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                      timeView === t.key
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="hidden items-center gap-3 text-xs md:flex">
                <span className="flex items-center gap-1.5 text-gray-400">
                  <span className="inline-block h-2 w-4 rounded-sm bg-gray-200" />
                  קלט
                </span>
                <span className="flex items-center gap-1.5 text-gray-400">
                  <span className="inline-block h-2 w-4 rounded-sm bg-violet-100" />
                  מחושב אוטומטית
                </span>
              </div>
            </div>
          </div>

          {/* Multi-account edit hint */}
          {activeAccountId === "summary" && accounts.length > 1 && timeView === "daily" && (
            <div className="border-b border-gray-100 bg-amber-50 px-5 py-2.5 md:px-7">
              <p className="text-xs text-amber-700">
                ✏️ כדי לערוך נתונים, בחר חשבון ספציפי מהטאבים למעלה.
              </p>
            </div>
          )}

          {/* Top Performers Banner */}
          {sum.activeDays > 0 &&
            (bestDays.bestCtrIdx >= 0 ||
              bestDays.bestCostLpvIdx >= 0 ||
              bestDays.bestRegRateIdx >= 0) && (
              <div className="border-b border-gray-100 bg-gradient-to-l from-amber-50/60 via-white to-white px-5 py-3 md:px-7">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="text-xs font-bold text-gray-600">
                    🏆 שיאי החודש:
                  </span>
                  {bestDays.bestCtrIdx >= 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                      🎯 CTR הכי גבוה — יום{" "}
                      {activeDays[bestDays.bestCtrIdx].date} (
                      {fmtPct(metrics[bestDays.bestCtrIdx].ctr)})
                    </span>
                  )}
                  {bestDays.bestCostLpvIdx >= 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      💰 עלות/צפייה הכי נמוכה — יום{" "}
                      {activeDays[bestDays.bestCostLpvIdx].date} (₪
                      {bestDays.bestCostLpvVal.toFixed(1)})
                    </span>
                  )}
                  {bestDays.bestRegRateIdx >= 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700">
                      📝 המרה בדף הכי גבוהה — יום{" "}
                      {activeDays[bestDays.bestRegRateIdx].date} (
                      {fmtPct(metrics[bestDays.bestRegRateIdx].regRate)})
                    </span>
                  )}
                </div>
              </div>
            )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] table-fixed">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="w-[60px] bg-gray-50 px-2 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-gray-500">תאריך</th>
                  <th colSpan={4} className="bg-blue-50/70 px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-blue-600/70">Meta Ads Manager</th>
                  <th colSpan={2} className="bg-violet-50/70 px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-violet-600/70">משפך (CRM / אתר)</th>
                  <th colSpan={1} className="bg-emerald-50/70 px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-emerald-600/70">כספים</th>
                  <th colSpan={9} className="bg-purple-50/70 px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-purple-600/70">מדדי ביצוע (אוטומטי)</th>
                </tr>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="sticky right-0 z-10 w-[60px] bg-gray-50 px-2 py-3 text-center text-xs font-bold text-gray-600">תאריך</th>
                  {["הוצאה ₪", "חשיפות", "קליקים יחודיים", "הגיעו לדף"].map((h) => (
                    <th key={h} className="bg-blue-50/30 px-2 py-3 text-center text-xs font-bold text-gray-600">{h}</th>
                  ))}
                  {["נרשמו", "רכשו"].map((h) => (
                    <th key={h} className="bg-violet-50/30 px-2 py-3 text-center text-xs font-bold text-gray-600">{h}</th>
                  ))}
                  {["הכנסה ₪"].map((h) => (
                    <th key={h} className="bg-emerald-50/30 px-2 py-3 text-center text-xs font-bold text-gray-600">{h}</th>
                  ))}
                  {["CTR %", "CPC ₪", "CPM ₪", "% הגעה", "% רישום", "% רכישה", "CPA ₪", "רווח נקי", "ROAS"].map((h) => (
                    <th key={h} className="bg-purple-50/30 px-2 py-3 text-center text-xs font-bold text-gray-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* DAILY — editable */}
                {timeView === "daily" &&
                  isEditable &&
                  activeDays.map((day, i) => {
                    const m = metrics[i];
                    const active = day.adSpend > 0 || day.revenue > 0 || day.purchases > 0;
                    const dayNum = parseInt(day.date.split(".")[0]);
                    const now = new Date();
                    const isToday = dayNum === now.getDate() && settings.month === now.getMonth() + 1 && settings.year === now.getFullYear();
                    const bg = isToday ? "bg-blue-50" : i % 2 === 0 ? "bg-white" : "bg-gray-50/60";
                    const stickyBg = isToday ? "bg-blue-50" : i % 2 === 0 ? "bg-white" : "bg-gray-50";
                    return (
                      <tr key={i} className={`border-b border-gray-100 ${bg} transition-colors hover:bg-blue-50/50 ${isToday ? "ring-2 ring-inset ring-blue-400/60" : ""}`}>
                        <td className={`sticky right-0 z-10 ${stickyBg} px-2 py-1 text-center text-sm font-semibold ${isToday ? "text-blue-600" : active ? "text-gray-900" : "text-gray-400"}`}>
                          <div className="flex items-center gap-1">
                            {isToday && <span className="inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-500" />}
                            <span>{day.date}</span>
                            {bestDays.bestCtrIdx === i && <span className="inline-block rounded-full bg-amber-100 px-1 py-px text-[7px] font-bold leading-tight text-amber-700">CTR</span>}
                            {bestDays.bestCostLpvIdx === i && <span className="inline-block rounded-full bg-emerald-100 px-1 py-px text-[7px] font-bold leading-tight text-emerald-700">CPV</span>}
                            {bestDays.bestRegRateIdx === i && <span className="inline-block rounded-full bg-purple-100 px-1 py-px text-[7px] font-bold leading-tight text-purple-700">CVR</span>}
                          </div>
                        </td>
                        <td className="px-0 py-0"><NumCell value={day.adSpend} onChange={(v) => upDay(i, "adSpend", v)} /></td>
                        <td className="px-0 py-0"><NumCell value={day.impressions} onChange={(v) => upDay(i, "impressions", v)} /></td>
                        <td className="px-0 py-0"><NumCell value={day.uniqueClicks} onChange={(v) => upDay(i, "uniqueClicks", v)} /></td>
                        <td className="px-0 py-0"><NumCell value={day.landingPageViews} onChange={(v) => upDay(i, "landingPageViews", v)} /></td>
                        <td className="px-0 py-0"><NumCell value={day.registrations} onChange={(v) => upDay(i, "registrations", v)} /></td>
                        <td className="px-0 py-0"><NumCell value={day.purchases} onChange={(v) => upDay(i, "purchases", v)} /></td>
                        <td className="px-0 py-0"><NumCell value={day.revenue} onChange={(v) => upDay(i, "revenue", v)} /></td>
                        <CC v={m.ctr} f={fmtPct} best={bestDays.bestCtrIdx === i} />
                        <CC v={m.cpc} f={fmtDec} />
                        <CC v={m.cpm} f={fmtDec} />
                        <CC v={m.lpvRate} f={fmtPct} best={bestDays.bestCostLpvIdx === i} />
                        <CC v={m.regRate} f={fmtPct} best={bestDays.bestRegRateIdx === i} />
                        <CC v={m.purchaseRate} f={fmtPct} />
                        <CC v={m.cpa} f={fmtDec} />
                        <CC v={m.netProfit} f={fmtSigned} pos={m.netProfit > 0} />
                        <CC v={m.roas} f={fmtRoas} pos={m.roas >= settings.breakEvenRoas} />
                      </tr>
                    );
                  })}

                {/* DAILY — readonly (summary) */}
                {timeView === "daily" &&
                  !isEditable &&
                  activeDays.map((day, i) => {
                    const m = metrics[i];
                    const active = day.adSpend > 0 || day.revenue > 0;
                    const bg = i % 2 === 0 ? "bg-white" : "bg-gray-50/60";
                    const stickyBg = i % 2 === 0 ? "bg-white" : "bg-gray-50";
                    return (
                      <tr key={i} className={`border-b border-gray-100 ${bg} transition-colors hover:bg-blue-50/50`}>
                        <td className={`sticky right-0 z-10 ${stickyBg} px-2 py-2 text-center text-sm font-semibold ${active ? "text-gray-900" : "text-gray-400"}`}>{day.date}</td>
                        <StaticCell value={day.adSpend ? fmtCurrency(day.adSpend) : ""} />
                        <StaticCell value={day.impressions ? fmtN(day.impressions) : ""} />
                        <StaticCell value={day.uniqueClicks ? fmtN(day.uniqueClicks) : ""} />
                        <StaticCell value={day.landingPageViews ? fmtN(day.landingPageViews) : ""} />
                        <StaticCell value={day.registrations ? fmtN(day.registrations) : ""} />
                        <StaticCell value={day.purchases ? fmtN(day.purchases) : ""} />
                        <StaticCell value={day.revenue ? fmtCurrency(day.revenue) : ""} />
                        <CC v={m.ctr} f={fmtPct} />
                        <CC v={m.cpc} f={fmtDec} />
                        <CC v={m.cpm} f={fmtDec} />
                        <CC v={m.lpvRate} f={fmtPct} />
                        <CC v={m.regRate} f={fmtPct} />
                        <CC v={m.purchaseRate} f={fmtPct} />
                        <CC v={m.cpa} f={fmtDec} />
                        <CC v={m.netProfit} f={fmtSigned} pos={m.netProfit > 0} />
                        <CC v={m.roas} f={fmtRoas} pos={m.roas >= settings.breakEvenRoas} />
                      </tr>
                    );
                  })}

                {/* WEEKLY */}
                {timeView === "weekly" &&
                  weeklyRows.map((row, i) => {
                    const d = row.day;
                    const m = row.metrics;
                    const bg = i % 2 === 0 ? "bg-white" : "bg-gray-50/60";
                    const stickyBg = i % 2 === 0 ? "bg-white" : "bg-gray-50";
                    return (
                      <tr key={i} className={`border-b border-gray-100 ${bg} transition-colors hover:bg-blue-50/50`}>
                        <td className={`sticky right-0 z-10 ${stickyBg} px-2 py-3 text-center text-sm font-bold text-gray-900`}>{row.label}</td>
                        <StaticCell value={fmtCurrency(d.adSpend)} />
                        <StaticCell value={fmtN(d.impressions)} />
                        <StaticCell value={fmtN(d.uniqueClicks)} />
                        <StaticCell value={fmtN(d.landingPageViews)} />
                        <StaticCell value={fmtN(d.registrations)} />
                        <StaticCell value={fmtN(d.purchases)} />
                        <StaticCell value={fmtCurrency(d.revenue)} />
                        <CC v={m.ctr} f={fmtPct} />
                        <CC v={m.cpc} f={fmtDec} />
                        <CC v={m.cpm} f={fmtDec} />
                        <CC v={m.lpvRate} f={fmtPct} />
                        <CC v={m.regRate} f={fmtPct} />
                        <CC v={m.purchaseRate} f={fmtPct} />
                        <CC v={m.cpa} f={fmtDec} />
                        <CC v={m.netProfit} f={fmtSigned} pos={m.netProfit > 0} />
                        <CC v={m.roas} f={fmtRoas} pos={m.roas >= settings.breakEvenRoas} />
                      </tr>
                    );
                  })}

                {/* MONTHLY */}
                {timeView === "monthly" &&
                  monthlyRow &&
                  (() => {
                    const d = monthlyRow.day;
                    const m = monthlyRow.metrics;
                    return (
                      <tr className="border-b border-gray-100 bg-white transition-colors hover:bg-blue-50/50">
                        <td className="sticky right-0 z-10 bg-white px-2 py-3 text-center text-sm font-bold text-gray-900">{monthlyRow.label}</td>
                        <StaticCell value={fmtCurrency(d.adSpend)} />
                        <StaticCell value={fmtN(d.impressions)} />
                        <StaticCell value={fmtN(d.uniqueClicks)} />
                        <StaticCell value={fmtN(d.landingPageViews)} />
                        <StaticCell value={fmtN(d.registrations)} />
                        <StaticCell value={fmtN(d.purchases)} />
                        <StaticCell value={fmtCurrency(d.revenue)} />
                        <CC v={m.ctr} f={fmtPct} />
                        <CC v={m.cpc} f={fmtDec} />
                        <CC v={m.cpm} f={fmtDec} />
                        <CC v={m.lpvRate} f={fmtPct} />
                        <CC v={m.regRate} f={fmtPct} />
                        <CC v={m.purchaseRate} f={fmtPct} />
                        <CC v={m.cpa} f={fmtDec} />
                        <CC v={m.netProfit} f={fmtSigned} pos={m.netProfit > 0} />
                        <CC v={m.roas} f={fmtRoas} pos={m.roas >= settings.breakEvenRoas} />
                      </tr>
                    );
                  })()}

                {/* TOTALS */}
                <tr className="border-t-2 border-blue-300 bg-blue-50 font-bold">
                  <td className="sticky right-0 z-10 bg-blue-50 px-2 py-3.5 text-center text-sm font-extrabold text-blue-700">סה״כ</td>
                  <td className="px-2 py-3.5 text-center text-sm font-bold text-gray-900">{fmtCurrency(sum.totalSpend)}</td>
                  <td className="px-2 py-3.5 text-center text-sm font-bold text-gray-900">{fmtN(sum.totalImpressions)}</td>
                  <td className="px-2 py-3.5 text-center text-sm font-bold text-gray-900">{fmtN(sum.totalUniqueClicks)}</td>
                  <td className="px-2 py-3.5 text-center text-sm font-bold text-gray-900">{fmtN(sum.totalLPV)}</td>
                  <td className="px-2 py-3.5 text-center text-sm font-bold text-gray-900">{fmtN(sum.totalRegistrations)}</td>
                  <td className="px-2 py-3.5 text-center text-sm font-bold text-gray-900">{fmtN(sum.totalPurchases)}</td>
                  <td className="px-2 py-3.5 text-center text-sm font-bold text-gray-900">{fmtCurrency(sum.totalRevenue)}</td>
                  <CC v={sum.avgCtr} f={fmtPct} />
                  <CC v={sum.avgCpc} f={fmtDec} />
                  <CC v={sum.avgCpm} f={fmtDec} />
                  <CC v={sum.avgLpvRate} f={fmtPct} />
                  <CC v={sum.avgRegRate} f={fmtPct} />
                  <CC v={sum.avgPurchaseRate} f={fmtPct} />
                  <CC v={sum.avgCpa} f={fmtDec} />
                  <CC v={sum.totalNetProfit} f={fmtSigned} pos={sum.totalNetProfit > 0} />
                  <CC v={sum.overallRoas} f={fmtRoas} pos={sum.overallRoas >= settings.breakEvenRoas} />
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        </>}

        {/* FOOTER */}
        <footer className="mt-10 flex items-center justify-center gap-2 text-xs text-gray-400">
          <div className="h-px max-w-32 flex-1 bg-gray-200" />
          דשבורד ממומן v5.0 — אצבע על הדופק
          <div className="h-px max-w-32 flex-1 bg-gray-200" />
        </footer>
      </div>

      {/* AI Chat */}
      {user && (
        <AIChatPanel sum={sum} accounts={accounts} settings={settings} />
      )}
    </main>
  );
}
