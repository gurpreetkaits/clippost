import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkUsageLimit } from "@/lib/usage";
import { ensureFreshToken, uploadToYouTubeShorts } from "@/lib/youtube-api";
import path from "path";
import fs from "fs";

export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  try {
    const usageCheck = await checkUsageLimit(userId, "PUBLISH");
    if (!usageCheck.allowed) {
      return NextResponse.json(
        {
          error: `Publish limit reached (${usageCheck.used}/${usageCheck.limit} this month). Upgrade to Pro for unlimited publishing.`,
        },
        { status: 403 }
      );
    }

    const { clipFilename, title, description, channelId } =
      await request.json();

    if (!clipFilename || !channelId) {
      return NextResponse.json(
        { error: "Missing clipFilename or channelId" },
        { status: 400 }
      );
    }

    const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const clipPath = path.join(
      process.cwd(),
      "tmp",
      safeUserId,
      path.basename(clipFilename)
    );
    if (!fs.existsSync(clipPath)) {
      return NextResponse.json(
        { error: "Clip file not found" },
        { status: 404 }
      );
    }

    const accessToken = await ensureFreshToken(userId, channelId);

    const shortTitle = title
      ? `${title} #Shorts`
      : "New Short #Shorts";
    const shortDesc = description || "";

    const videoId = await uploadToYouTubeShorts(
      accessToken,
      clipPath,
      shortTitle,
      shortDesc
    );

    // Track in DB
    const clip = await prisma.clip.findFirst({
      where: { userId, filename: clipFilename },
      orderBy: { createdAt: "desc" },
    });
    if (clip) {
      await prisma.clip.update({
        where: { id: clip.id },
        data: { youtubeVideoId: videoId },
      });
    }

    await prisma.usageRecord.create({
      data: {
        userId,
        action: "PUBLISH",
        metadata: { clipFilename, youtubeVideoId: videoId, channelId },
      },
    });

    return NextResponse.json({
      success: true,
      videoId,
      url: `https://youtube.com/shorts/${videoId}`,
    });
  } catch (error) {
    console.error("YouTube publish error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to publish to YouTube",
      },
      { status: 500 }
    );
  }
}
