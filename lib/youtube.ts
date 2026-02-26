import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";

const execFileAsync = promisify(execFile);

const TMP_DIR = path.join(process.cwd(), "tmp");
const COOKIES_PATH = path.join(process.cwd(), "cookies.txt");

function getCookiesArgs(): string[] {
  if (fs.existsSync(COOKIES_PATH)) {
    return ["--cookies", COOKIES_PATH];
  }
  return [];
}

function getUserTmpDir(userId: string): string {
  const safeId = userId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const dir = path.join(TMP_DIR, safeId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Detect video source from URL hostname.
 * Returns "youtube" | "instagram" | null.
 */
export function detectVideoSource(url: string): "youtube" | "instagram" | null {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (host === "youtube.com" || host === "youtu.be") return "youtube";
    if (host === "instagram.com") return "instagram";
  } catch {
    // malformed URL
  }
  return null;
}

export function isValidYouTubeUrl(url: string): boolean {
  return detectVideoSource(url) === "youtube";
}

export function isValidInstagramUrl(url: string): boolean {
  return detectVideoSource(url) === "instagram";
}

export function isValidVideoUrl(url: string): boolean {
  return detectVideoSource(url) !== null;
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
  const source = detectVideoSource(url);

  // YouTube-specific extractor args (avoid TV client which triggers DRM)
  const extractorArgs =
    source === "youtube"
      ? ["--extractor-args", "youtube:player_client=mweb,web;player_skip=configs,webpage"]
      : [];

  // Get video info first
  const { stdout: infoJson } = await execFileAsync("yt-dlp", [
    "--dump-json",
    "--no-playlist",
    ...extractorArgs,
    ...getCookiesArgs(),
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
        ...extractorArgs,
        ...getCookiesArgs(),
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
