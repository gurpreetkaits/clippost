import { NextRequest, NextResponse } from "next/server";
import { createClipWithCaptions, CaptionSegment, CaptionStyle, TextOverlay } from "@/lib/ffmpeg";
import { VideoLayout } from "@/lib/video-layout";
import { getVideoPath } from "@/lib/youtube";
import { requireAuth } from "@/lib/auth";
import { splitLongSegments } from "@/lib/whisper";
import { prisma } from "@/lib/db";
import { checkUsageLimit } from "@/lib/usage";
import { configToTemplate } from "@/lib/caption-template";
import type { ReelTemplate } from "@/lib/caption-template";
import type { ColorGradingParams } from "@/lib/color-grading";

export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  try {
    const usageCheck = await checkUsageLimit(userId, "CLIP_CREATED");
    if (!usageCheck.allowed) {
      return NextResponse.json(
        { error: `Clip limit reached (${usageCheck.used}/${usageCheck.limit} this month). Upgrade to Pro for unlimited clips.` },
        { status: 403 }
      );
    }

    const {
      filename,
      start,
      end,
      captions,
      style,
      layout,
      templateId,
      textOverlays,
      colorGrading,
      enhance,
    }: {
      filename: string;
      start: number;
      end: number;
      captions: CaptionSegment[];
      style?: CaptionStyle;
      layout?: VideoLayout;
      templateId?: string;
      textOverlays?: TextOverlay[];
      colorGrading?: ColorGradingParams;
      enhance?: boolean;
    } = await request.json();

    if (!filename || start === undefined || end === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: filename, start, end" },
        { status: 400 }
      );
    }

    if (end - start > 90) {
      return NextResponse.json(
        { error: "Clip duration cannot exceed 90 seconds" },
        { status: 400 }
      );
    }

    // Fetch template if templateId is provided
    let template: ReelTemplate | undefined;
    if (templateId) {
      const dbTemplate = await prisma.captionTemplate.findFirst({
        where: { id: templateId, userId },
      });
      if (dbTemplate) {
        template = configToTemplate(
          dbTemplate.name,
          dbTemplate.config as Omit<ReelTemplate, "name">
        );
      }
    }

    const videoPath = getVideoPath(userId, filename);
    const shortCaptions = splitLongSegments(captions || []);
    const clipFilename = await createClipWithCaptions(
      userId,
      videoPath,
      start,
      end,
      shortCaptions,
      style,
      layout,
      template,
      textOverlays,
      colorGrading,
      enhance
    );

    // Find the video record if it exists (by youtubeId or filename)
    const youtubeId = filename.replace(/\.mp4$/, "");
    const video = await prisma.video.findFirst({
      where: {
        userId,
        OR: [
          { youtubeId },
          { filename },
        ],
      },
    });

    await prisma.clip.create({
      data: {
        userId,
        videoId: video?.id,
        filename: clipFilename,
        startTime: start,
        endTime: end,
        duration: end - start,
        hasCaptions: shortCaptions.length > 0,
        captionStyle: style ? JSON.parse(JSON.stringify(style)) : undefined,
        method: "MANUAL",
      },
    });

    await prisma.usageRecord.create({
      data: {
        userId,
        action: "CLIP_CREATED",
        metadata: { filename: clipFilename, method: "MANUAL" },
      },
    });

    return NextResponse.json({ clipFilename });
  } catch (error) {
    console.error("Clip creation error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create clip",
      },
      { status: 500 }
    );
  }
}
