import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";

const execFileAsync = promisify(execFile);

const TMP_DIR = path.join(process.cwd(), "tmp");

function ensureTmpDir() {
  if (!fs.existsSync(TMP_DIR)) {
    fs.mkdirSync(TMP_DIR, { recursive: true });
  }
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

export async function downloadVideo(url: string): Promise<VideoMetadata> {
  ensureTmpDir();

  // Get video info first (using TV client to bypass bot detection)
  const { stdout: infoJson } = await execFileAsync("yt-dlp", [
    "--dump-json",
    "--no-playlist",
    "--extractor-args",
    "youtube:player_client=tv",
    url,
  ]);
  const info = JSON.parse(infoJson);

  const videoId = info.id;
  const filename = `${videoId}.mp4`;
  const filepath = path.join(TMP_DIR, filename);

  // Download if not already cached
  if (!fs.existsSync(filepath)) {
    await execFileAsync(
      "yt-dlp",
      [
        "-f",
        "bestvideo[ext=mp4][height<=1080]+bestaudio[ext=m4a]/best[ext=mp4]/best",
        "--merge-output-format",
        "mp4",
        "-o",
        filepath,
        "--no-playlist",
        "--extractor-args",
        "youtube:player_client=tv",
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

export function getVideoPath(filename: string): string {
  return path.join(TMP_DIR, filename);
}

export function cleanupVideo(filename: string) {
  const filepath = path.join(TMP_DIR, filename);
  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath);
  }
}
