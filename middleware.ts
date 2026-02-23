import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isAuthRoute = req.nextUrl.pathname.startsWith("/api/auth");
  const isLoginPage = req.nextUrl.pathname === "/login";

  if (!req.auth && !isAuthRoute && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", req.nextUrl.origin));
  }

  if (req.auth && isLoginPage) {
    return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
