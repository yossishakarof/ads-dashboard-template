import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const from = request.nextUrl.searchParams.get("from") || "/ad-dashboard";
  const res = NextResponse.redirect(new URL(from, request.url));
  res.cookies.set("dashboard_access", "granted", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return res;
}
