import { auth } from "@/auth";
import { NextResponse } from "next/server";

// Use Node.js runtime instead of Edge to support Prisma
export const runtime = "nodejs";

const isLocalhost = process.env.NODE_ENV === "development";

// Routes that require authentication — all others are public
const PROTECTED_PREFIXES = [
  "/api/clip",
  "/api/transcribe",
  "/api/publish",
  "/api/auto-trim",
  "/api/accounts",
  "/api/checkout",
  "/api/usage",
  "/api/youtube-channels",
  "/api/settings",
  "/api/generate-caption",
  "/settings",
  "/clips",
];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));

  if (!req.auth && isProtected) {
    // In dev, allow unauthenticated access (local-dev fallback in requireAuth)
    if (isLocalhost) return;

    // API routes get 401, pages get redirected to login
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.nextUrl.origin));
  }

  // Redirect logged-in users away from login page
  if (req.auth && pathname === "/login") {
    return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/webhooks|api/upload).*)"],
};
