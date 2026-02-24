import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";
import { CaptionStyle, DEFAULT_CAPTION_STYLE } from "./caption-style";

export type { CaptionStyle };
export { DEFAULT_CAPTION_STYLE };

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

export interface CaptionWord {
  word: string;
  start: number;
  end: number;
}

export interface CaptionSegment {
  start: number;
  end: number;
  text: string;
  words?: CaptionWord[];
}

// Convert hex color (#RRGGBB) to ASS color format (&HAABBGGRR)
function hexToAss(hex: string, alpha: number = 0): string {
  const r = hex.slice(1, 3);
  const g = hex.slice(3, 5);
  const b = hex.slice(5, 7);
  const a = Math.round((1 - alpha / 100) * 255)
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();
  return `&H${a}${b}${g}${r}`.toUpperCase();
}

// ASS time format: H:MM:SS.CC (centiseconds)
function formatAssTime(seconds: number): string {
  const clamped = Math.max(0, seconds);
  const h = Math.floor(clamped / 3600);
  const m = Math.floor((clamped % 3600) / 60);
  const s = clamped % 60;
  const sWhole = Math.floor(s);
  const cs = Math.round((s - sWhole) * 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(sWhole).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

function escapeAssText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}");
}

async function getVideoDimensions(
  videoPath: string
): Promise<{ width: number; height: number }> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=width,height",
    "-of",
    "json",
    videoPath,
  ]);
  const data = JSON.parse(stdout);
  return {
    width: data.streams[0].width,
    height: data.streams[0].height,
  };
}

function generateAssContent(
  captions: CaptionSegment[],
  clipStart: number,
  width: number,
  height: number,
  style?: CaptionStyle
): string {
  const s = style || DEFAULT_CAPTION_STYLE;

  const fontSize = Math.round(s.fontSize * (height / 1080));
  const boxPad = Math.round(fontSize * 0.5);
  const marginV = Math.round(height * 0.06);
  const marginLR = Math.round(width * 0.05);

  const primaryColour = hexToAss(s.textColor, 100);
  const secondaryColour = "&H00AAAAAA";
  const outlineColour = hexToAss(s.bgColor, s.bgOpacity);
  const boldVal = s.bold ? 1 : 0;
  const italicVal = s.italic ? 1 : 0;
  const alignmentMap = { top: 8, center: 5, bottom: 2 };
  const alignment = alignmentMap[s.position];

  const lines: string[] = [
    "[Script Info]",
    "ScriptType: v4.00+",
    `PlayResX: ${width}`,
    `PlayResY: ${height}`,
    "WrapStyle: 0",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    `Style: Default,${s.fontFamily},${fontSize},${primaryColour},${secondaryColour},${outlineColour},&H00000000,${boldVal},${italicVal},0,0,100,100,0,0,3,${boxPad},0,${alignment},${marginLR},${marginLR},${marginV},1`,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ];

  for (const caption of captions) {
    const relStart = Math.max(0, caption.start - clipStart);
    const relEnd = Math.max(0, caption.end - clipStart);
    const startStr = formatAssTime(relStart);
    const endStr = formatAssTime(relEnd);

    if (caption.words && caption.words.length > 0) {
      // Karaoke mode: words turn black one by one
      let text = "";
      let prevTime = caption.start;

      for (let i = 0; i < caption.words.length; i++) {
        const word = caption.words[i];
        const kCs = Math.max(0, Math.round((word.start - prevTime) * 100));
        text += `{\\k${kCs}}${escapeAssText(word.word)}`;
        if (i < caption.words.length - 1) text += " ";
        prevTime = word.start;
      }

      lines.push(
        `Dialogue: 0,${startStr},${endStr},Default,,0,0,0,,${text}`
      );
    } else {
      // Simple text fallback (no word-level timing)
      lines.push(
        `Dialogue: 0,${startStr},${endStr},Default,,0,0,0,,${escapeAssText(caption.text)}`
      );
    }
  }

  return lines.join("\n");
}

export async function extractFullAudio(
  userId: string,
  videoPath: string
): Promise<string> {
  const userDir = getUserTmpDir(userId);
  const outputPath = path.join(
    userDir,
    `full_audio_${Date.now()}_${Math.random().toString(36).slice(2)}.mp3`
  );

  await execFileAsync(
    "ffmpeg",
    [
      "-y",
      "-i",
      videoPath,
      "-vn",
      "-acodec",
      "libmp3lame",
      "-ar",
      "16000",
      "-ac",
      "1",
      "-b:a",
      "32k",
      outputPath,
    ],
    { timeout: 600000 }
  );

  return outputPath;
}

export async function extractAudio(
  userId: string,
  videoPath: string,
  start: number,
  end: number
): Promise<string> {
  const userDir = getUserTmpDir(userId);
  const outputPath = path.join(
    userDir,
    `audio_${Date.now()}_${Math.random().toString(36).slice(2)}.mp3`
  );

  const duration = end - start;

  await execFileAsync(
    "ffmpeg",
    [
      "-y",
      "-ss",
      start.toString(),
      "-i",
      videoPath,
      "-t",
      duration.toString(),
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
  userId: string,
  videoPath: string,
  start: number,
  end: number,
  captions: CaptionSegment[],
  style?: CaptionStyle
): Promise<string> {
  const userDir = getUserTmpDir(userId);
  const outputFilename = `clip_${Date.now()}_${Math.random().toString(36).slice(2)}.mp4`;
  const outputPath = path.join(userDir, outputFilename);
  const duration = end - start;

  // Get video dimensions for ASS scaling
  const { width, height } = await getVideoDimensions(videoPath);

  // Generate ASS subtitle file
  const assContent = generateAssContent(captions, start, width, height, style);
  const assPath = path.join(
    userDir,
    `subs_${Date.now()}_${Math.random().toString(36).slice(2)}.ass`
  );
  fs.writeFileSync(assPath, assContent);

  console.log("ASS content:\n", assContent);

  // Escape the ASS path for ffmpeg filter syntax (colons, backslashes)
  const escapedAssPath = assPath
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:");

  try {
    await execFileAsync(
      "ffmpeg",
      [
        "-y",
        "-ss",
        start.toString(),
        "-i",
        videoPath,
        "-t",
        duration.toString(),
        "-vf",
        `ass=${escapedAssPath}`,
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
  } finally {
    // Clean up temp ASS file
    if (fs.existsSync(assPath)) fs.unlinkSync(assPath);
  }

  return outputFilename;
}

export async function createClipNoCaptions(
  userId: string,
  videoPath: string,
  start: number,
  end: number
): Promise<string> {
  const userDir = getUserTmpDir(userId);
  const outputFilename = `clip_${Date.now()}_${Math.random().toString(36).slice(2)}.mp4`;
  const outputPath = path.join(userDir, outputFilename);
  const duration = end - start;

  await execFileAsync(
    "ffmpeg",
    [
      "-y",
      "-ss",
      start.toString(),
      "-i",
      videoPath,
      "-t",
      duration.toString(),
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
