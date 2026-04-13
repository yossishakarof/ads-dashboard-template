import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const COOKIE_NAME = "dashboard_access";
const SECRET = process.env.AD_DASHBOARD_SESSION_SECRET || "dev-secret";

function sign(value: string): string {
  return crypto.createHmac("sha256", SECRET).update(value).digest("hex");
}

export async function POST(request: NextRequest) {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) {
    return NextResponse.json({ ok: true });
  }

  const body = await request.json();
  if (body.password !== password) {
    return NextResponse.json({ error: "סיסמה שגויה" }, { status: 401 });
  }

  const value = "granted";
  const sig = sign(value);
  const from = body.from || "/ad-dashboard";

  const res = NextResponse.json({ ok: true, redirect: from });
  res.cookies.set(COOKIE_NAME, `${value}.${sig}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return res;
}
