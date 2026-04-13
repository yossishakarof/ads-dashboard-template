import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "dashboard_access";

export async function POST(request: NextRequest) {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) {
    return NextResponse.json({ ok: true, redirect: "/ad-dashboard" });
  }

  const body = await request.json();
  if (body.password !== password) {
    return NextResponse.json({ error: "סיסמה שגויה" }, { status: 401 });
  }

  const from = body.from || "/ad-dashboard";
  const res = NextResponse.json({ ok: true, redirect: from });
  res.cookies.set(COOKIE_NAME, "granted", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return res;
}
