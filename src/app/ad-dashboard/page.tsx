import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Dashboard } from "./dashboard";
import { getSessionData } from "./lib/session";
import type { AdUser } from "./lib/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "דשבורד ממומן | אצבע על הדופק",
  description:
    "דשבורד מעקב הוצאות פרסום ממומן והחזר השקעה לבעלי עסקים — סנכרון אוטומטי מ-Meta Ads",
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const accessKey = process.env.DASHBOARD_ACCESS_KEY;

  if (accessKey) {
    const cookieStore = await cookies();
    const hasAccess = cookieStore.get("dashboard_access")?.value === "granted";

    if (!hasAccess) {
      const params = await searchParams;
      if (params.key === accessKey) {
        // Valid key — grant access via cookie (set via API then redirect)
        redirect(`/api/ad-dashboard/grant-access?from=/ad-dashboard`);
      } else {
        // No access
        return (
          <div
            className="flex min-h-screen items-center justify-center bg-[#08080f]"
            dir="rtl"
          >
            <div className="text-center">
              <p className="text-2xl font-bold text-white">אין גישה</p>
              <p className="mt-2 text-sm text-slate-500">
                אין לך קישור גישה תקף
              </p>
            </div>
          </div>
        );
      }
    }
  }

  let user: AdUser | null = null;
  const session = await getSessionData();
  if (session) {
    user = {
      id: session.metaUserId,
      metaUserId: session.metaUserId,
      name: session.name,
      email: session.email,
      hasValidToken: session.tokenExpiresAt
        ? new Date(session.tokenExpiresAt) > new Date()
        : true,
      tokenExpiresAt: session.tokenExpiresAt,
    };
  }

  return <Dashboard user={user} />;
}
