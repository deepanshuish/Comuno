import { NextResponse, type NextRequest } from "next/server";

// Optimistic auth check: send signed-out visitors of platform pages to /login.
// Real session validation happens in the (platform) layout and in each API route.
const PLATFORM = [
  "/agent", "/dashboard", "/prospect", "/contacts", "/companies", "/lists", "/sequences", "/inbox",
  "/dialer", "/tasks", "/deals", "/analytics", "/signals", "/visitors", "/settings",
];

export function proxy(req: NextRequest) {
  const hasSession = req.cookies.has("comuno_session");
  const { pathname } = req.nextUrl;
  if (!hasSession && PLATFORM.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next|favicon.ico|t.js).*)"],
};
