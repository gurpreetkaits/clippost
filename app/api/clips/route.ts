import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const limitParam = request.nextUrl.searchParams.get("limit");
  const take = limitParam ? Math.min(parseInt(limitParam, 10) || 50, 100) : 50;
  const videoFilename = request.nextUrl.searchParams.get("videoFilename");

  // If videoFilename provided, filter clips by that video's youtubeId
  const videoFilter: Record<string, unknown> = {};
  if (videoFilename) {
    const youtubeId = videoFilename.replace(/\.mp4$/, "");
    const video = await prisma.video.findFirst({ where: { userId, youtubeId } });
    if (video) {
      videoFilter.videoId = video.id;
    } else {
      return NextResponse.json({ clips: [] });
    }
  }

  const clips = await prisma.clip.findMany({
    where: { userId, ...videoFilter },
    include: {
      video: {
        select: {
          title: true,
          duration: true,
          youtubeId: true,
          sourceUrl: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take,
  });

  return NextResponse.json({
    clips: clips.map((clip) => ({
      id: clip.id,
      filename: clip.filename,
      startTime: clip.startTime,
      endTime: clip.endTime,
      duration: clip.duration,
      hasCaptions: clip.hasCaptions,
      method: clip.method,
      publishedAt: clip.publishedAt,
      instagramMediaId: clip.instagramMediaId,
      youtubeVideoId: clip.youtubeVideoId,
      createdAt: clip.createdAt,
      video: clip.video
        ? {
            title: clip.video.title,
            duration: clip.video.duration,
            youtubeId: clip.video.youtubeId,
            sourceUrl: clip.video.sourceUrl,
            thumbnail: `https://img.youtube.com/vi/${clip.video.youtubeId}/mqdefault.jpg`,
          }
        : null,
    })),
  });
}
