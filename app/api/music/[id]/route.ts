import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getMusicPath } from "@/lib/music";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;
  const { id } = await params;

  const track = await prisma.musicTrack.findFirst({
    where: { id, userId },
  });

  if (!track) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  const body = await request.json();
  const data: Record<string, boolean> = {};

  if (typeof body.isFavorite === "boolean") {
    data.isFavorite = body.isFavorite;
  }

  if (body.isDefault === true) {
    // Unset other defaults first
    await prisma.musicTrack.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    });
    data.isDefault = true;
  } else if (body.isDefault === false) {
    data.isDefault = false;
  }

  const updated = await prisma.musicTrack.update({
    where: { id },
    data,
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;
  const { id } = await params;

  const track = await prisma.musicTrack.findFirst({
    where: { id, userId },
  });

  if (!track) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  // Delete file from disk
  const filePath = getMusicPath(userId, track.filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  await prisma.musicTrack.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
