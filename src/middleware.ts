import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "dashboard_access";
const VALID_VALUE = "granted";

export function middleware(request: NextRequest) {
  const password = process.env.DASHBOARD_PASSWORD;

  // If no password configured, allow through
  if (!password) return NextResponse.next();

  const { pathname } = request.nextUrl;

  // Allow gate routes
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
  if (cookie === VALID_VALUE) return NextResponse.next();

  // Redirect to gate
  const gate = new URL("/ad-dashboard/gate", request.url);
  gate.searchParams.set("from", pathname);
  return NextResponse.redirect(gate);
}

export const config = {
  matcher: ["/ad-dashboard/:path*", "/api/ad-dashboard/:path*"],
};
