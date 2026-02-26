import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getMusicDir, getAudioDuration } from "@/lib/music";

const ALLOWED_EXTENSIONS = [".mp3", ".wav", ".m4a", ".aac", ".ogg"];
const MAX_SIZE = 50 * 1024 * 1024; // 50MB

export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File too large (max 50MB)" }, { status: 400 });
    }

    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: `Unsupported format. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}` },
        { status: 400 }
      );
    }

    const musicDir = getMusicDir(userId);
    const filename = `music_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
    const filePath = path.join(musicDir, filename);

    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    const duration = await getAudioDuration(filePath);

    const track = await prisma.musicTrack.create({
      data: {
        userId,
        filename,
        originalName: file.name,
        duration,
      },
    });

    return NextResponse.json(track);
  } catch (error) {
    console.error("Music upload error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    );
  }
}
