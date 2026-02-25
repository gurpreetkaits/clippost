import fs from "fs";
import path from "path";
import { CaptionSegment } from "./ffmpeg";

const TMP_DIR = path.join(process.cwd(), "tmp");

function getCachePath(userId: string, videoId: string, language: string): string {
  const safeId = userId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(TMP_DIR, safeId, `${videoId}_transcript_${language}.json`);
}

export function getCachedTranscription(
  userId: string,
  videoId: string,
  language: string
): CaptionSegment[] | null {
  const cachePath = getCachePath(userId, videoId, language);
  if (!fs.existsSync(cachePath)) return null;
  try {
    const data = fs.readFileSync(cachePath, "utf-8");
    return JSON.parse(data) as CaptionSegment[];
  } catch {
    return null;
  }
}

export function cacheTranscription(
  userId: string,
  videoId: string,
  language: string,
  segments: CaptionSegment[]
): void {
  const cachePath = getCachePath(userId, videoId, language);
  fs.writeFileSync(cachePath, JSON.stringify(segments));
}
