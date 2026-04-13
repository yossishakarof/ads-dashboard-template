import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Dashboard } from "./dashboard";
import { getSessionData } from "./lib/session";
import type { AdUser } from "./lib/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "SmartLeads Dashboard",
  description: "דשבורד מעקב פרסום ממומן",
};

async function checkPassword(formData: FormData) {
  "use server";
  const password = process.env.DASHBOARD_PASSWORD?.trim();
  const input = (formData.get("password") as string)?.trim();
  if (input === password) {
    const cookieStore = await cookies();
    cookieStore.set("dashboard_access", "granted", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    redirect("/ad-dashboard");
  } else {
    redirect("/ad-dashboard?error=1");
  }
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const password = process.env.DASHBOARD_PASSWORD?.trim();

  if (password) {
    const cookieStore = await cookies();
    const hasAccess = cookieStore.get("dashboard_access")?.value === "granted";

    if (!hasAccess) {
      const params = await searchParams;
      const hasError = params.error === "1";

      return (
        <div className="flex min-h-screen items-center justify-center bg-[#08080f]" dir="rtl">
          <div className="w-full max-w-sm rounded-2xl border border-white/[0.08] bg-[#111119] p-8 shadow-lg shadow-black/40">
            <div className="mb-6 text-center">
              <div className="mb-3 text-4xl">📊</div>
              <h1 className="text-xl font-extrabold text-white">SmartLeads Dashboard</h1>
              <p className="mt-1 text-sm text-slate-400">הזן סיסמה להמשך</p>
            </div>
            <form action={checkPassword} className="space-y-4">
              <input
                type="password"
                name="password"
                placeholder="סיסמה"
                autoFocus
                required
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-right text-sm text-white outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20"
              />
              {hasError && (
                <p className="text-center text-sm font-medium text-red-400">סיסמה שגויה</p>
              )}
              <button
                type="submit"
                className="w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-black transition-all hover:bg-amber-400"
              >
                כניסה
              </button>
            </form>
          </div>
        </div>
      );
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
