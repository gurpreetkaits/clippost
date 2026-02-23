import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  // Only NextAuth routes (/api/auth/signin, /api/auth/callback, etc.) are public.
  // Instagram OAuth routes have their own auth checks inside.
  const isNextAuthRoute =
    req.nextUrl.pathname.startsWith("/api/auth/") &&
    !req.nextUrl.pathname.startsWith("/api/auth/instagram");
  const isLoginPage = req.nextUrl.pathname === "/login";

  if (!req.auth && !isNextAuthRoute && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", req.nextUrl.origin));
  }

  if (req.auth && isLoginPage) {
    return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
