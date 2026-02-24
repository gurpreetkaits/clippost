import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  exchangeCodeForTokens,
  getChannelInfo,
} from "@/lib/youtube-api";

export async function GET(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3456";

  if (error) {
    return NextResponse.redirect(
      `${appUrl}/settings?error=${encodeURIComponent(error)}`
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${appUrl}/settings?error=${encodeURIComponent("No authorization code")}`
    );
  }

  try {
    const redirectUri = `${appUrl}/api/auth/youtube/callback`;
    const tokens = await exchangeCodeForTokens(code, redirectUri);
    const channel = await getChannelInfo(tokens.access_token);

    await prisma.youTubeChannel.upsert({
      where: {
        userId_channelId: { userId, channelId: channel.channelId },
      },
      update: {
        channelTitle: channel.channelTitle,
        thumbnailUrl: channel.thumbnailUrl,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      },
      create: {
        userId,
        channelId: channel.channelId,
        channelTitle: channel.channelTitle,
        thumbnailUrl: channel.thumbnailUrl,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        isDefault: true,
      },
    });

    return NextResponse.redirect(
      `${appUrl}/settings?connected_youtube=1`
    );
  } catch (err) {
    console.error("YouTube OAuth error:", err);
    return NextResponse.redirect(
      `${appUrl}/settings?error=${encodeURIComponent(
        err instanceof Error ? err.message : "YouTube connection failed"
      )}`
    );
  }
}
