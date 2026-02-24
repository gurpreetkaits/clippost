import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import fs from "fs";
import path from "path";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;
  const { id } = await params;

  const clip = await prisma.clip.findFirst({
    where: { id, userId },
    include: {
      video: {
        select: {
          title: true,
          duration: true,
          youtubeId: true,
          sourceUrl: true,
          filename: true,
        },
      },
    },
  });

  if (!clip) {
    return NextResponse.json({ error: "Clip not found" }, { status: 404 });
  }

  // Check if source video file still exists
  const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const videoExists = clip.video?.filename
    ? fs.existsSync(
        path.join(process.cwd(), "tmp", safeUserId, path.basename(clip.video.filename))
      )
    : false;

  return NextResponse.json({
    ...clip,
    video: clip.video
      ? {
          ...clip.video,
          thumbnail: `https://img.youtube.com/vi/${clip.video.youtubeId}/mqdefault.jpg`,
          fileExists: videoExists,
        }
      : null,
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;
  const { id } = await params;

  // Check user is PRO
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (user?.plan !== "PRO") {
    return NextResponse.json(
      { error: "Upgrade to Pro to delete clips" },
      { status: 403 }
    );
  }

  const clip = await prisma.clip.findFirst({ where: { id, userId } });
  if (!clip) {
    return NextResponse.json({ error: "Clip not found" }, { status: 404 });
  }

  // Delete clip file from disk
  const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const clipPath = path.join(
    process.cwd(),
    "tmp",
    safeUserId,
    path.basename(clip.filename)
  );
  if (fs.existsSync(clipPath)) {
    fs.unlinkSync(clipPath);
  }

  await prisma.clip.delete({ where: { id: clip.id } });

  return NextResponse.json({ success: true });
}
