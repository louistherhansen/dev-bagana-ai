import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * GET / → 302 redirect to /login. No React, no layout; avoids any server-side 500.
 * Use Host header so redirect stays on 127.0.0.1 (not 0.0.0.0) when opened from browser.
 */
export function GET(request: NextRequest) {
  const url = new URL(request.url);
  const hostHeader = request.headers.get("host") || url.host;
  const host = hostHeader && hostHeader.startsWith("0.0.0.0") ? "127.0.0.1" + hostHeader.slice(7) : hostHeader;
  const base = `${url.protocol}//${host}`;
  const token = request.cookies.get("auth_token")?.value;
  const dest = token ? "/dashboard" : "/login";
  return NextResponse.redirect(`${base}${dest}`, 302);
}
