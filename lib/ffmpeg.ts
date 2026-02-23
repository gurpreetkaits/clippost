import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";

const execFileAsync = promisify(execFile);

const TMP_DIR = path.join(process.cwd(), "tmp");

export interface CaptionSegment {
  start: number;
  end: number;
  text: string;
}

export async function extractAudio(
  videoPath: string,
  start: number,
  end: number
): Promise<string> {
  const outputPath = path.join(
    TMP_DIR,
    `audio_${Date.now()}_${Math.random().toString(36).slice(2)}.mp3`
  );

  await execFileAsync(
    "ffmpeg",
    [
      "-y",
      "-i",
      videoPath,
      "-ss",
      start.toString(),
      "-to",
      end.toString(),
      "-vn",
      "-acodec",
      "libmp3lame",
      "-ar",
      "16000",
      "-ac",
      "1",
      outputPath,
    ],
    { timeout: 120000 }
  );

  return outputPath;
}

export async function createClipWithCaptions(
  videoPath: string,
  start: number,
  end: number,
  captions: CaptionSegment[]
): Promise<string> {
  const outputFilename = `clip_${Date.now()}_${Math.random().toString(36).slice(2)}.mp4`;
  const outputPath = path.join(TMP_DIR, outputFilename);

  // Add a white caption bar at the bottom (80px tall) below the video content
  const padFilter = "pad=iw:ih+80:0:0:color=white";

  // Build drawtext filter chain for each caption segment
  const drawtextFilters = captions.map((caption) => {
    // Escape special characters for ffmpeg drawtext
    const escapedText = caption.text
      .replace(/\\/g, "\\\\\\\\")
      .replace(/'/g, "\u2019")
      .replace(/"/g, '\\"')
      .replace(/:/g, "\\:")
      .replace(/;/g, "\\;")
      .replace(/%/g, "%%");

    const segStart = caption.start - start;
    const segEnd = caption.end - start;

    return [
      `drawtext=text='${escapedText}'`,
      `fontsize=36`,
      `fontcolor=#333333`,
      `font=Arial`,
      `x=(w-text_w)/2`,
      `y=h-60`,
      `enable='between(t,${segStart.toFixed(2)},${segEnd.toFixed(2)})'`,
    ].join(":");
  });

  const filterComplex =
    drawtextFilters.length > 0
      ? [padFilter, ...drawtextFilters].join(",")
      : "null"; // no-op filter if no captions

  console.log("Captions received:", JSON.stringify(captions, null, 2));
  console.log("Filter complex:", filterComplex);

  await execFileAsync(
    "ffmpeg",
    [
      "-y",
      "-i",
      videoPath,
      "-ss",
      start.toString(),
      "-to",
      end.toString(),
      "-vf",
      filterComplex,
      "-c:v",
      "libx264",
      "-preset",
      "fast",
      "-crf",
      "23",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      outputPath,
    ],
    { timeout: 300000 }
  );

  return outputFilename;
}

export function cleanup(filepath: string) {
  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath);
  }
}
