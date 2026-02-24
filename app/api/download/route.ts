import { NextRequest, NextResponse } from "next/server";
import { downloadVideo, isValidYouTubeUrl } from "@/lib/youtube";
import { optionalAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkUsageLimit } from "@/lib/usage";

export async function POST(request: NextRequest) {
  const { userId, authenticated, anonId } = await optionalAuth();

  try {
    // Only check usage limits for authenticated users
    if (authenticated) {
      const usageCheck = await checkUsageLimit(userId, "VIDEO_DOWNLOADED");
      if (!usageCheck.allowed) {
        return NextResponse.json(
          { error: `Download limit reached (${usageCheck.used}/${usageCheck.limit} this month). Upgrade to Pro for unlimited downloads.` },
          { status: 403 }
        );
      }
    }

    const { url } = await request.json();

    if (!url || !isValidYouTubeUrl(url)) {
      return NextResponse.json(
        { error: "Invalid YouTube URL" },
        { status: 400 }
      );
    }

    const metadata = await downloadVideo(userId, url);

    // Track video in DB only for authenticated users
    if (authenticated) {
      await prisma.video.upsert({
        where: { userId_youtubeId: { userId, youtubeId: metadata.id } },
        update: { title: metadata.title, filename: metadata.filename },
        create: {
          userId,
          youtubeId: metadata.id,
          title: metadata.title,
          duration: metadata.duration,
          filename: metadata.filename,
          sourceUrl: url,
        },
      });

      await prisma.usageRecord.create({
        data: {
          userId,
          action: "VIDEO_DOWNLOADED",
          metadata: { youtubeId: metadata.id, title: metadata.title },
        },
      });
    }

    const response = NextResponse.json({
      id: metadata.id,
      title: metadata.title,
      duration: metadata.duration,
      filename: metadata.filename,
    });

    // Set anonymous cookie so /api/video can find the files
    if (!authenticated && anonId) {
      response.cookies.set("clippost-anon", anonId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24,
      });
    }

    return response;
  } catch (error) {
    console.error("Download error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to download video",
      },
      { status: 500 }
    );
  }
}
