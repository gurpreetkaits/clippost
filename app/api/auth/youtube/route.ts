import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getYouTubeAuthUrl } from "@/lib/youtube-api";

export async function GET() {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3456";
  const redirectUri = `${appUrl}/api/auth/youtube/callback`;
  const url = getYouTubeAuthUrl(redirectUri, userId);

  return NextResponse.redirect(url);
}
