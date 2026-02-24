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

export function isValidYouTubeUrl(url: string): boolean {
  const patterns = [
    /^https?:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]+/,
    /^https?:\/\/youtu\.be\/[\w-]+/,
    /^https?:\/\/(www\.)?youtube\.com\/shorts\/[\w-]+/,
  ];
  return patterns.some((p) => p.test(url));
}

export interface VideoMetadata {
  id: string;
  title: string;
  duration: number;
  filename: string;
  filepath: string;
}

export async function downloadVideo(
  userId: string,
  url: string
): Promise<VideoMetadata> {
  const userDir = getUserTmpDir(userId);

  // Get video info first
  const { stdout: infoJson } = await execFileAsync("yt-dlp", [
    "--dump-json",
    "--no-playlist",
    url,
  ]);
  const info = JSON.parse(infoJson);

  const videoId = info.id;
  const filename = `${videoId}.mp4`;
  const filepath = path.join(userDir, filename);

  // Download if not already cached
  if (!fs.existsSync(filepath)) {
    await execFileAsync(
      "yt-dlp",
      [
        "-f",
        "bestvideo[height<=1080]+bestaudio/best[height<=1080]/best",
        "--merge-output-format",
        "mp4",
        "-o",
        filepath,
        "--no-playlist",
        url,
      ],
      { timeout: 300000 }
    );
  }

  return {
    id: videoId,
    title: info.title,
    duration: info.duration,
    filename,
    filepath,
  };
}

export function getVideoPath(userId: string, filename: string): string {
  const userDir = getUserTmpDir(userId);
  const safeName = path.basename(filename);
  const resolved = path.join(userDir, safeName);
  // Verify the file is within the user's directory
  if (!resolved.startsWith(userDir)) {
    throw new Error("Invalid file path");
  }
  return resolved;
}

export function cleanupVideo(userId: string, filename: string) {
  const filepath = getVideoPath(userId, filename);
  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath);
  }
}
