import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const COOKIE_NAME = "dashboard_access";
const PASSWORD = process.env.DASHBOARD_PASSWORD;
const SECRET = process.env.AD_DASHBOARD_SESSION_SECRET || "dev-secret";

function sign(value: string): string {
  return crypto.createHmac("sha256", SECRET).update(value).digest("hex");
}

function isValidCookie(cookie: string): boolean {
  const [value, sig] = cookie.split(".");
  if (!value || !sig) return false;
  return sig === sign(value);
}

export function middleware(request: NextRequest) {
  // If no password is configured, allow everything through
  if (!PASSWORD) return NextResponse.next();

  const { pathname } = request.nextUrl;

  // Allow the gate page and its API route
  if (
    pathname === "/ad-dashboard/gate" ||
    pathname === "/api/ad-dashboard/gate"
  ) {
    return NextResponse.next();
  }

  // Only protect dashboard routes
  const isProtected =
    pathname.startsWith("/ad-dashboard") ||
    pathname.startsWith("/api/ad-dashboard");

  if (!isProtected) return NextResponse.next();

  const cookie = request.cookies.get(COOKIE_NAME)?.value;
  if (cookie && isValidCookie(cookie)) return NextResponse.next();

  // Redirect to gate, preserving the original URL
  const gate = new URL("/ad-dashboard/gate", request.url);
  gate.searchParams.set("from", pathname);
  return NextResponse.redirect(gate);
}

export const config = {
  matcher: ["/ad-dashboard/:path*", "/api/ad-dashboard/:path*"],
};
