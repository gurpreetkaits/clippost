import { auth } from "@/auth";
import { NextResponse } from "next/server";

const isLocalhost = process.env.NODE_ENV === "development";

export default auth((req) => {
  // Skip all auth on localhost
  if (isLocalhost) return;

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
