import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function extractHostname(hostHeader: string | null) {
  if (!hostHeader) return "";
  return hostHeader.split(":")[0].toLowerCase();
}

export function middleware(request: NextRequest) {
  const hostname = extractHostname(request.headers.get("host"));
  const { pathname } = request.nextUrl;

  if (hostname === "run.dbbrewbeer.com" && pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/run-voucher";
    return NextResponse.redirect(url, 307);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
