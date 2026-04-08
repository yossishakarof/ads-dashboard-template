"use client";

import { useState, useMemo } from "react";
import type { Account } from "../lib/types";
import type { AdInsight } from "../lib/meta-api";
import { fmtN, fmtCurrency, fmtPct, fmtDec } from "../lib/format";
import { GLASS } from "../lib/constants";
import { type DatePreset, DATE_PRESETS, getDateRange } from "../lib/date-presets";

function rankLabel(rank: string): string {
  if (rank.includes("ABOVE")) return "מעל הממוצע";
  if (rank.includes("AVERAGE") && !rank.includes("BELOW")) return "ממוצע";
  if (rank.includes("BELOW")) return "מתחת לממוצע";
  return "—";
}

// Debug: show all action types Meta returns
function MetaActionsDebug({
  accounts,
  activeAccountId,
  datePreset,
}: {
  accounts: Account[];
  activeAccountId: string;
  datePreset: DatePreset;
}) {
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{
    period?: { since: string; until: string };
    actions?: { type: string; count: number }[];
    actionValues?: { type: string; value: number }[];
    error?: string;
  } | null>(null);

  const load = async () => {
    const targetIds =
      activeAccountId === "all"
        ? accounts.map((a) => a.id)
        : [activeAccountId];
    const { since, until } = getDateRange(datePreset);

    setLoading(true);
    setShow(true);
    try {
      // Fetch for first account (debug is per-account)
      const res = await fetch("/api/ad-dashboard/debug-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: targetIds[0], since, until }),
      });
      setData(await res.json());
    } catch {
      setData({ error: "שגיאה בטעינה" });
    } finally {
      setLoading(false);
    }
  };

  // Known action types and their Hebrew labels
  const actionLabels: Record<string, string> = {
    lead: "ליד (Lead)",
    "offsite_conversion.fb_pixel_lead": "ליד - Pixel",
    "onsite_conversion.lead_grouped": "ליד - טופס מיידי",
    complete_registration: "השלמת רישום (Complete Registration)",
    "offsite_conversion.fb_pixel_complete_registration": "רישום - Pixel",
    landing_page_view: "צפייה בדף נחיתה",
    purchase: "רכישה",
    "offsite_conversion.fb_pixel_purchase": "רכישה - Pixel",
    link_click: "קליק על לינק",
    page_engagement: "מעורבות בדף",
    post_engagement: "מעורבות בפוסט",
    video_view: "צפייה בוידאו",
    comment: "תגובה",
    like: "לייק",
    share: "שיתוף",
    post_reaction: "ריאקשן",
  };

  return (
    <>
      <button
        onClick={load}
        className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50"
      >
        🔍 בדוק אירועי המרה
      </button>

      {show && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
          onClick={() => setShow(false)}
        >
          <div
            className="mx-4 max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">
                🔍 כל האירועים שMeta מחזיר
              </h3>
              <button
                onClick={() => setShow(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            {loading && (
              <div className="py-8 text-center">
                <div className="mb-3 h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent mx-auto" />
                <p className="text-sm text-gray-400">מושך נתונים מ-Meta...</p>
              </div>
            )}

            {data?.error && (
              <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600">
                {data.error}
              </div>
            )}

            {data?.actions && (
              <>
                {data.period && (
                  <p className="mb-4 text-xs text-gray-400">
                    תקופה: {data.period.since} עד {data.period.until}
                  </p>
                )}

                <div className="mb-4 space-y-2">
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                    💡 <strong>לידים:</strong> הדשבורד סופר את האירוע הראשון שמוצא מתוך: lead, fb_pixel_lead, lead_grouped, complete_registration.
                  </div>
                  <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800">
                    🛒 <strong>רכישות:</strong> הדשבורד סופר את: purchase, fb_pixel_purchase, onsite_conversion.purchase. אם יש לך <strong>המרה מותאמת אישית</strong> שמתאימה לרכישות (offsite_conversion.fb_pixel_custom וכו') - תבדוק בטבלה איזה אירוע מתאים.
                  </div>
                </div>

                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="px-3 py-2 text-right text-xs font-bold text-gray-600">
                        סוג אירוע (action_type)
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-bold text-gray-600">
                        תיאור
                      </th>
                      <th className="px-3 py-2 text-center text-xs font-bold text-gray-600">
                        כמות
                      </th>
                      <th className="px-3 py-2 text-center text-xs font-bold text-gray-600">
                        נספר כ
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.actions.map((a, i) => {
                      const isLeadType = [
                        "lead",
                        "offsite_conversion.fb_pixel_lead",
                        "onsite_conversion.lead_grouped",
                        "complete_registration",
                        "offsite_conversion.fb_pixel_complete_registration",
                      ].includes(a.type);

                      const isPurchaseType = [
                        "purchase",
                        "offsite_conversion.fb_pixel_purchase",
                        "onsite_conversion.purchase",
                      ].includes(a.type);

                      const isCustom = a.type.includes("custom");

                      return (
                        <tr
                          key={i}
                          className={`border-b border-gray-100 ${isLeadType ? "bg-amber-50" : isPurchaseType ? "bg-emerald-50" : isCustom ? "bg-blue-50" : ""}`}
                        >
                          <td className="px-3 py-2 text-right font-mono text-xs text-gray-700">
                            {a.type}
                          </td>
                          <td className="px-3 py-2 text-right text-xs text-gray-500">
                            {actionLabels[a.type] || (isCustom ? "המרה מותאמת" : "—")}
                          </td>
                          <td className="px-3 py-2 text-center text-sm font-bold text-gray-900">
                            {a.count}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {isLeadType && (
                              <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                                👥 ליד
                              </span>
                            )}
                            {isPurchaseType && (
                              <span className="rounded-full bg-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                                🛒 רכישה
                              </span>
                            )}
                            {isCustom && !isLeadType && !isPurchaseType && (
                              <span className="rounded-full bg-blue-200 px-2 py-0.5 text-[10px] font-bold text-blue-800">
                                ⚙️ מותאם
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {data.actionValues && data.actionValues.length > 0 && (
                  <>
                    <h4 className="mb-2 mt-6 text-sm font-bold text-gray-700">
                      ערכים כספיים (action_values)
                    </h4>
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50">
                          <th className="px-3 py-2 text-right text-xs font-bold text-gray-600">
                            סוג
                          </th>
                          <th className="px-3 py-2 text-center text-xs font-bold text-gray-600">
                            ערך ₪
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.actionValues.map((a, i) => (
                          <tr key={i} className="border-b border-gray-100">
                            <td className="px-3 py-2 text-right font-mono text-xs text-gray-700">
                              {a.type}
                            </td>
                            <td className="px-3 py-2 text-center text-sm font-bold text-gray-900">
                              ₪{a.value.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export function WinningAdsView({
  ads,
  isLoading,
  error,
  onBack,
  accounts,
  activeAccountId,
  onChangeAccount,
  datePreset,
  onChangeDatePreset,
}: {
  ads: AdInsight[];
  isLoading: boolean;
  error: string | null;
  onBack: () => void;
  accounts: Account[];
  activeAccountId: string;
  onChangeAccount: (id: string) => void;
  datePreset: DatePreset;
  onChangeDatePreset: (preset: DatePreset) => void;
}) {
  // Sort by results (most first), then by cost-per-result (cheapest first)
  const sorted = useMemo(
    () =>
      [...ads].sort((a, b) => {
        const aResults = a.leads + a.purchases;
        const bResults = b.leads + b.purchases;
        if (bResults !== aResults) return bResults - aResults;
        // Same results - cheaper cost per result wins
        return (a.costPerResult || Infinity) - (b.costPerResult || Infinity);
      }),
    [ads]
  );

  // Category winners - with minimum thresholds for reliability
  const bestResults = useMemo(
    () => sorted.find((a) => (a.leads + a.purchases) > 0) || null,
    [sorted]
  );
  const bestCtr = useMemo(
    () =>
      ads.length > 0
        ? [...ads]
            .filter((a) => a.spend >= 10 && a.impressions >= 100)
            .sort((a, b) => b.ctr - a.ctr)[0] || null
        : null,
    [ads]
  );
  const bestCostPerResult = useMemo(
    () =>
      [...ads]
        .filter((a) => a.costPerResult > 0 && (a.leads + a.purchases) >= 1)
        .sort((a, b) => a.costPerResult - b.costPerResult)[0] || null,
    [ads]
  );

  // Ads that are losing money: 0 results, or very high cost per result
  const moneyBurners = useMemo(() => {
    const avgCpr =
      ads.filter((a) => a.costPerResult > 0).reduce((s, a) => s + a.costPerResult, 0) /
        (ads.filter((a) => a.costPerResult > 0).length || 1) || 0;
    const threshold = avgCpr * 2; // 2x average = expensive

    return [...ads]
      .filter((a) => {
        if (a.spend <= 0) return false;
        const results = a.leads + a.purchases;
        // Zero results
        if (results === 0) return true;
        // Cost per result > 2x average
        if (threshold > 0 && a.costPerResult > threshold) return true;
        return false;
      })
      .sort((a, b) => b.spend - a.spend);
  }, [ads]);

  const totalAds = ads.length;
  const totalSpend = ads.reduce((s, a) => s + a.spend, 0);
  const totalLeads = ads.reduce((s, a) => s + a.leads, 0);
  const totalPurchases = ads.reduce((s, a) => s + a.purchases, 0);
  const avgCtr =
    ads.length > 0 ? ads.reduce((s, a) => s + a.ctr, 0) / ads.length : 0;
  const avgCpl = totalLeads > 0 ? totalSpend / totalLeads : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent mx-auto" />
          <p className="text-sm text-gray-400">טוען נתוני מודעות...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-10">
        <div className="mx-auto max-w-md rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm font-bold text-red-700">שגיאה בטעינת מודעות</p>
          <p className="mt-1 text-sm text-red-600">{error}</p>
          <button onClick={onBack} className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500">
            חזור
          </button>
        </div>
      </div>
    );
  }

  if (ads.length === 0) {
    return (
      <div className="py-10 text-center">
        <p className="text-gray-500">אין מודעות לתקופה הנבחרת</p>
        <button onClick={onBack} className="mt-4 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
          חזור לדשבורד
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-extrabold text-gray-900">🏆 מודעה מנצחת</h2>
        <button
          onClick={onBack}
          className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          ← חזור לדשבורד
        </button>
      </div>

      {/* Account Selector */}
      {accounts.length > 0 && (
        <div className={`mb-6 ${GLASS} p-1.5`}>
          <div className="flex items-center gap-1 overflow-x-auto">
            {accounts.length > 1 && (
              <>
                <button
                  onClick={() => onChangeAccount("all")}
                  className={`flex-shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
                    activeAccountId === "all"
                      ? "bg-amber-50 text-amber-700 shadow-sm"
                      : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                  }`}
                >
                  📊 כל החשבונות
                </button>
                <div className="h-6 w-px flex-shrink-0 bg-gray-200" />
              </>
            )}
            {accounts.map((acc) => (
              <button
                key={acc.id}
                onClick={() => onChangeAccount(acc.id)}
                className={`flex-shrink-0 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
                  activeAccountId === acc.id
                    ? "bg-amber-50 text-amber-700 shadow-sm"
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                }`}
              >
                {acc.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Date Range Presets */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-gray-500">📅 תקופה:</span>
        {DATE_PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => onChangeDatePreset(p.key)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              datePreset === p.key
                ? "bg-gray-900 text-white"
                : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* KPI Row */}
      <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">⚠️</span>
          <div>
            <div className="text-xs font-bold text-amber-800">לא בטוח שהמדידה נכונה?</div>
            <div className="text-[10px] text-amber-700">לחץ כדי לראות אילו אירועים Meta מחזיר ולוודא שלידים ורכישות נספרים נכון (כולל המרות מותאמות אישית)</div>
          </div>
        </div>
        <MetaActionsDebug
          accounts={accounts}
          activeAccountId={activeAccountId}
          datePreset={datePreset}
        />
      </div>
      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "מודעות", value: String(totalAds), icon: "📢" },
          { label: "הוצאה כוללת", value: fmtCurrency(totalSpend), icon: "💰" },
          { label: 'סה"כ לידים', value: String(totalLeads), icon: "👥" },
          { label: 'סה"כ רכישות', value: String(totalPurchases), icon: "🛒" },
          { label: "CTR ממוצע", value: fmtPct(avgCtr), icon: "📊" },
          { label: "CPL ממוצע", value: avgCpl > 0 ? fmtCurrency(avgCpl) : "—", icon: "🎯" },
        ].map((kpi) => (
          <div key={kpi.label} className={`${GLASS} p-4 text-center`}>
            <div className="text-xs text-gray-500">{kpi.icon} {kpi.label}</div>
            <div className="mt-1 text-2xl font-extrabold text-gray-900">{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Category Winners */}
      <div className="mb-8">
        <h3 className="mb-4 text-lg font-bold text-gray-900">מודעות מנצחות</h3>
        <div className="grid gap-4 md:grid-cols-3">
          {/* Best Results */}
          {bestResults && (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <span className="text-lg">🥇</span>
                <span className="text-xs font-bold text-amber-700">הכי הרבה תוצאות</span>
              </div>
              <div className="mb-1 text-sm font-bold text-gray-900">{bestResults.adName}</div>
              <div className="mb-3 text-xs text-gray-400">{bestResults.campaignName}</div>
              <div className="grid grid-cols-3 gap-3 text-center text-xs">
                <div>
                  <div className="text-gray-400">תוצאות</div>
                  <div className="text-lg font-extrabold text-gray-900">{bestResults.leads + bestResults.purchases}</div>
                </div>
                <div>
                  <div className="text-gray-400">הוצאה</div>
                  <div className="font-bold text-gray-900">{fmtCurrency(bestResults.spend)}</div>
                </div>
                <div>
                  <div className="text-gray-400">עלות/תוצאה</div>
                  <div className="font-bold text-gray-900">{bestResults.costPerResult > 0 ? fmtDec(bestResults.costPerResult) : "—"}</div>
                </div>
              </div>
            </div>
          )}

          {/* Best CTR */}
          {bestCtr && (
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <span className="text-lg">🎯</span>
                <span className="text-xs font-bold text-blue-700">CTR הכי גבוה - ההוק עובד</span>
              </div>
              <div className="mb-1 text-sm font-bold text-gray-900">{bestCtr.adName}</div>
              <div className="mb-3 text-xs text-gray-400">{bestCtr.campaignName}</div>
              <div className="grid grid-cols-3 gap-3 text-center text-xs">
                <div>
                  <div className="text-gray-400">CTR</div>
                  <div className="text-lg font-extrabold text-blue-700">{fmtPct(bestCtr.ctr)}</div>
                </div>
                <div>
                  <div className="text-gray-400">קליקים</div>
                  <div className="font-bold text-gray-900">{fmtN(bestCtr.clicks)}</div>
                </div>
                <div>
                  <div className="text-gray-400">חשיפות</div>
                  <div className="font-bold text-gray-900">{fmtN(bestCtr.impressions)}</div>
                </div>
              </div>
            </div>
          )}

          {/* Best Cost Per Result */}
          {bestCostPerResult && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <span className="text-lg">💰</span>
                <span className="text-xs font-bold text-emerald-700">עלות לתוצאה הכי נמוכה</span>
              </div>
              <div className="mb-1 text-sm font-bold text-gray-900">{bestCostPerResult.adName}</div>
              <div className="mb-3 text-xs text-gray-400">{bestCostPerResult.campaignName}</div>
              <div className="grid grid-cols-3 gap-3 text-center text-xs">
                <div>
                  <div className="text-gray-400">עלות/תוצאה</div>
                  <div className="text-lg font-extrabold text-emerald-700">{fmtDec(bestCostPerResult.costPerResult)}</div>
                </div>
                <div>
                  <div className="text-gray-400">תוצאות</div>
                  <div className="font-bold text-gray-900">{bestCostPerResult.leads + bestCostPerResult.purchases}</div>
                </div>
                <div>
                  <div className="text-gray-400">הוצאה</div>
                  <div className="font-bold text-gray-900">{fmtCurrency(bestCostPerResult.spend)}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Money Burners */}
      {moneyBurners.length > 0 && (
        <div className="mb-8">
          <h3 className="mb-4 text-lg font-bold text-gray-900">🔥 מודעות שמפסידות כסף</h3>
          <div className="overflow-hidden rounded-2xl border border-red-200 bg-red-50/50">
            <table className="w-full">
              <thead>
                <tr className="border-b border-red-200 bg-red-50">
                  {["שם מודעה", "קמפיין", "הוצאה", "תוצאות", "עלות/תוצאה", "חשיפות", "CTR", "CPC", "סיבה"].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-center text-xs font-bold text-red-700">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {moneyBurners.slice(0, 10).map((ad, i) => {
                  const results = ad.leads + ad.purchases;
                  const isZero = results === 0;
                  return (
                    <tr key={ad.adName + i} className={`border-b border-red-100 ${i % 2 === 0 ? "bg-white" : "bg-red-50/30"}`}>
                      <td className="max-w-[200px] truncate px-3 py-2 text-right text-sm font-medium text-gray-900">{ad.adName}</td>
                      <td className="max-w-[150px] truncate px-3 py-2 text-right text-xs text-gray-500">{ad.campaignName}</td>
                      <td className="px-3 py-2 text-center text-sm font-bold text-red-700">{fmtCurrency(ad.spend)}</td>
                      <td className={`px-3 py-2 text-center text-sm font-bold ${isZero ? "text-red-600" : "text-gray-900"}`}>
                        {isZero ? "0" : results}
                      </td>
                      <td className="px-3 py-2 text-center text-sm font-semibold text-red-600">
                        {ad.costPerResult > 0 ? fmtDec(ad.costPerResult) : "—"}
                      </td>
                      <td className="px-3 py-2 text-center text-sm text-gray-700">{fmtN(ad.impressions)}</td>
                      <td className="px-3 py-2 text-center text-sm text-gray-700">{fmtPct(ad.ctr)}</td>
                      <td className="px-3 py-2 text-center text-sm text-gray-700">{fmtDec(ad.cpc)}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${isZero ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                          {isZero ? "0 תוצאות" : "עלות גבוהה"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-red-200 bg-red-50">
                  <td colSpan={2} className="px-3 py-2.5 text-right text-xs font-bold text-red-700">
                    סה״כ: {moneyBurners.length} מודעות מפסידות
                  </td>
                  <td className="px-3 py-2.5 text-center text-sm font-extrabold text-red-700">
                    {fmtCurrency(moneyBurners.reduce((s, a) => s + a.spend, 0))}
                  </td>
                  <td colSpan={6} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* All Ads Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 bg-gray-50 px-5 py-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900">כל המודעות</h3>
            <span className="text-xs text-gray-400">{totalAds} מודעות · ממוין לפי תוצאות</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                {["#", "שם מודעה", "קמפיין", "הוצאה", "חשיפות", "CTR", "CPC", "CPM", "לידים", "רכישות", "עלות/תוצאה", "איכות", "מעורבות", "המרה"].map((h) => (
                  <th key={h} className="px-3 py-3 text-center text-xs font-bold text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((ad, i) => {
                const results = ad.leads + ad.purchases;
                return (
                  <tr key={ad.adName + i} className={`border-b border-gray-100 transition-colors hover:bg-blue-50/50 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/60"}`}>
                    <td className="px-3 py-2.5 text-center text-sm font-bold text-gray-400">{i + 1}</td>
                    <td className="max-w-[200px] truncate px-3 py-2.5 text-right text-sm font-medium text-gray-900">{ad.adName}</td>
                    <td className="max-w-[150px] truncate px-3 py-2.5 text-right text-xs text-gray-500">{ad.campaignName}</td>
                    <td className="px-3 py-2.5 text-center text-sm font-semibold text-gray-900">{fmtCurrency(ad.spend)}</td>
                    <td className="px-3 py-2.5 text-center text-sm text-gray-700">{fmtN(ad.impressions)}</td>
                    <td className="px-3 py-2.5 text-center text-sm font-semibold text-gray-900">{fmtPct(ad.ctr)}</td>
                    <td className="px-3 py-2.5 text-center text-sm text-gray-700">{fmtDec(ad.cpc)}</td>
                    <td className="px-3 py-2.5 text-center text-sm text-gray-700">{fmtDec(ad.cpm)}</td>
                    <td className={`px-3 py-2.5 text-center text-sm font-bold ${ad.leads > 0 ? "text-gray-900" : "text-gray-400"}`}>{ad.leads || "—"}</td>
                    <td className={`px-3 py-2.5 text-center text-sm font-bold ${ad.purchases > 0 ? "text-gray-900" : "text-gray-400"}`}>{ad.purchases || "—"}</td>
                    <td className={`px-3 py-2.5 text-center text-sm font-semibold ${ad.costPerResult > 0 ? "text-gray-900" : "text-gray-400"}`}>{ad.costPerResult > 0 ? fmtDec(ad.costPerResult) : "—"}</td>
                    <td className="px-3 py-2.5 text-center text-xs text-gray-500">{rankLabel(ad.quality)}</td>
                    <td className="px-3 py-2.5 text-center text-xs text-gray-500">{rankLabel(ad.engagement)}</td>
                    <td className="px-3 py-2.5 text-center text-xs text-gray-500">{rankLabel(ad.conversion)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
