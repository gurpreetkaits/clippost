import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";

const execFileAsync = promisify(execFile);

const TMP_DIR = path.join(process.cwd(), "tmp");

function getUserTmpDir(userId: string): string {
  const safeId = userId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const dir = path.join(TMP_DIR, safeId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export const ENHANCE_FILTER = "unsharp=5:5:0.8:3:3:0.4,hqdn3d=4:3:6:4.5";

export async function applyEnhancement(
  userId: string,
  videoPath: string,
  start: number,
  end: number
): Promise<string> {
  const userDir = getUserTmpDir(userId);
  const outputFilename = `enhanced_${Date.now()}_${Math.random().toString(36).slice(2)}.mp4`;
  const outputPath = path.join(userDir, outputFilename);
  const duration = end - start;

  await execFileAsync(
    "ffmpeg",
    [
      "-y",
      "-ss", start.toString(),
      "-i", videoPath,
      "-t", duration.toString(),
      "-vf", ENHANCE_FILTER,
      "-c:v", "libx264",
      "-preset", "fast",
      "-crf", "23",
      "-c:a", "aac",
      "-b:a", "128k",
      "-movflags", "+faststart",
      outputPath,
    ],
    { timeout: 300000 }
  );

  return outputFilename;
}
