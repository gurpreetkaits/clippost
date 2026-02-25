import { NextRequest, NextResponse } from "next/server";
import { optionalAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkUsageLimit } from "@/lib/usage";
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";
import crypto from "crypto";

const execFileAsync = promisify(execFile);

const TMP_DIR = path.join(process.cwd(), "tmp");

const ALLOWED_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-matroska",
]);

const ALLOWED_EXTENSIONS = new Set([".mp4", ".mov", ".webm", ".mkv"]);

const MAX_SIZE_FREE = 500 * 1024 * 1024; // 500MB
const MAX_SIZE_PRO = 2 * 1024 * 1024 * 1024; // 2GB

function getUserTmpDir(userId: string): string {
  const safeId = userId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const dir = path.join(TMP_DIR, safeId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

async function getVideoDuration(filePath: string): Promise<number> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "json",
    filePath,
  ]);
  const data = JSON.parse(stdout);
  return parseFloat(data.format.duration) || 0;
}

async function isVideoFile(filePath: string): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v", "error",
      "-select_streams", "v:0",
      "-show_entries", "stream=codec_type",
      "-of", "json",
      filePath,
    ]);
    const data = JSON.parse(stdout);
    return data.streams?.length > 0;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const { userId, authenticated } = await optionalAuth();

  try {
    if (authenticated) {
      const usageCheck = await checkUsageLimit(userId, "VIDEO_DOWNLOADED");
      if (!usageCheck.allowed) {
        return NextResponse.json(
          { error: `Upload limit reached (${usageCheck.used}/${usageCheck.limit} this month). Upgrade to Pro for unlimited uploads.` },
          { status: 403 }
        );
      }
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file type
    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_TYPES.has(file.type) && !ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        { error: "Unsupported file type. Accepted: mp4, mov, webm, mkv" },
        { status: 400 }
      );
    }

    // Check file size based on plan
    let maxSize = MAX_SIZE_FREE;
    if (authenticated) {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true } });
      if (user?.plan === "PRO") maxSize = MAX_SIZE_PRO;
    }

    if (file.size > maxSize) {
      const limitMB = Math.round(maxSize / (1024 * 1024));
      return NextResponse.json(
        { error: `File too large. Maximum size is ${limitMB}MB.` },
        { status: 400 }
      );
    }

    // Save file to disk
    const userDir = getUserTmpDir(userId);
    const uuid = crypto.randomUUID();
    const inputFilename = `upload_${uuid}${ext}`;
    const inputPath = path.join(userDir, inputFilename);

    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(inputPath, buffer);

    // Verify it's actually a video
    const isValid = await isVideoFile(inputPath);
    if (!isValid) {
      fs.unlinkSync(inputPath);
      return NextResponse.json(
        { error: "File does not appear to be a valid video" },
        { status: 400 }
      );
    }

    // Transcode to mp4 if not already mp4
    let finalFilename = inputFilename;
    if (ext !== ".mp4") {
      const mp4Filename = `upload_${uuid}.mp4`;
      const mp4Path = path.join(userDir, mp4Filename);
      await execFileAsync("ffmpeg", [
        "-y", "-i", inputPath,
        "-c:v", "libx264", "-preset", "fast", "-crf", "23",
        "-c:a", "aac", "-b:a", "128k",
        "-movflags", "+faststart",
        mp4Path,
      ], { timeout: 600000 });
      // Remove original non-mp4 file
      fs.unlinkSync(inputPath);
      finalFilename = mp4Filename;
    }

    const finalPath = path.join(userDir, finalFilename);
    const duration = await getVideoDuration(finalPath);

    // Clean title from filename
    const title = file.name.replace(/\.[^.]+$/, "").replace(/[_-]/g, " ").trim() || "Uploaded Video";

    // Track in DB for authenticated users
    if (authenticated) {
      await prisma.video.create({
        data: {
          userId,
          title,
          duration,
          filename: finalFilename,
          source: "UPLOAD",
        },
      });

      await prisma.usageRecord.create({
        data: {
          userId,
          action: "VIDEO_DOWNLOADED",
          metadata: { filename: finalFilename, source: "upload", title },
        },
      });
    }

    return NextResponse.json({
      filename: finalFilename,
      title,
      duration,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to upload video" },
      { status: 500 }
    );
  }
}
