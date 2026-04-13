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

export default async function Page() {
  // Password gate — runs server-side, always has env vars
  const password = process.env.DASHBOARD_PASSWORD;
  if (password) {
    const cookieStore = await cookies();
    const access = cookieStore.get("dashboard_access")?.value;
    if (access !== "granted") {
      redirect("/ad-dashboard/gate?from=/ad-dashboard");
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
