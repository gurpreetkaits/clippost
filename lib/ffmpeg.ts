import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";
import { CaptionStyle, DEFAULT_CAPTION_STYLE } from "./caption-style";
import { VideoLayout, getFrameConfig, REEL_WIDTH, REEL_HEIGHT } from "./video-layout";
import { ReelTemplate, ZONE_ALIGNMENT_MAP } from "./caption-template";
import { ColorGradingParams, buildColorGradingFilter } from "./color-grading";
import { ENHANCE_FILTER } from "./enhance";

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
  confidence?: "high" | "medium" | "low"; // transcription confidence
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
  // 22% from bottom keeps captions above Instagram's follow/like UI
  const marginV = Math.round(height * 0.22);
  const marginLR = Math.round(width * 0.05);

  const primaryColour = hexToAss(s.textColor, 100);
  const secondaryColour = "&H00AAAAAA";
  const outlineColour = hexToAss(s.bgColor, s.bgOpacity);
  const boldVal = s.bold ? 1 : 0;
  const italicVal = s.italic ? 1 : 0;
  const alignmentMap: Record<string, number> = { top: 8, center: 5, bottom: 2, custom: 2 };
  const alignment = alignmentMap[s.position] ?? 2;

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

function generateAssContentFromTemplate(
  captions: CaptionSegment[],
  clipStart: number,
  width: number,
  height: number,
  template: ReelTemplate
): string {
  const t = template;
  const fontSize = Math.round(t.fontSize * (height / 1920));

  // Colors
  const primaryColour = hexToAss(t.textColor, 100);
  const secondaryColour = "&H00AAAAAA";

  // BorderStyle 3 = opaque box, 1 = outline+shadow
  const borderStyleVal = t.borderStyle === "box" ? 3 : 1;
  let outlineColour: string;
  let outlineVal: number;
  let shadowVal: number;
  let backColour: string;

  if (t.borderStyle === "box") {
    outlineColour = hexToAss(t.bgColor, t.bgOpacity);
    outlineVal = Math.round(fontSize * 0.5); // box padding
    shadowVal = 0;
    backColour = "&H00000000";
  } else {
    outlineColour = hexToAss(t.shadowColor, 100);
    outlineVal = t.outlineWidth;
    shadowVal = t.shadowDistance;
    backColour = hexToAss(t.shadowColor, 60);
  }

  const boldVal = t.bold ? 1 : 0;
  const italicVal = t.italic ? 1 : 0;
  const underlineVal = t.underline ? 1 : 0;
  const alignment = ZONE_ALIGNMENT_MAP[t.zone];
  const wrapStyleVal = t.wrapStyle === "smart" ? 0 : 2;

  // Margins: use maxWidth to calculate left/right margins
  const marginPct = (100 - t.maxWidth) / 2;
  const marginLR = Math.round((width * marginPct) / 100);
  // Higher margin keeps captions above Instagram's UI overlay
  const isBottomZone = t.zone.startsWith("bottom");
  const marginV = Math.round(height * (isBottomZone ? 0.22 : 0.06));

  const lines: string[] = [
    "[Script Info]",
    "ScriptType: v4.00+",
    `PlayResX: ${width}`,
    `PlayResY: ${height}`,
    `WrapStyle: ${wrapStyleVal}`,
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    `Style: Default,${t.fontFamily},${fontSize},${primaryColour},${secondaryColour},${outlineColour},${backColour},${boldVal},${italicVal},${underlineVal},0,${t.scaleX},100,${t.letterSpacing},0,${borderStyleVal},${outlineVal},${shadowVal},${alignment},${marginLR},${marginLR},${marginV},1`,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ];

  // Build \pos override tag if posX/posY are set
  const posOverride =
    t.posX !== null && t.posY !== null
      ? `{\\pos(${Math.round((t.posX / 100) * width)},${Math.round((t.posY / 100) * height)})}`
      : "";

  for (const caption of captions) {
    const relStart = Math.max(0, caption.start - clipStart);
    const relEnd = Math.max(0, caption.end - clipStart);
    const startStr = formatAssTime(relStart);
    const endStr = formatAssTime(relEnd);

    // Apply text transform
    const transformText = (text: string) => {
      if (t.textTransform === "uppercase") return text.toUpperCase();
      if (t.textTransform === "lowercase") return text.toLowerCase();
      return text;
    };

    if (caption.words && caption.words.length > 0) {
      let text = posOverride;
      let prevTime = caption.start;
      for (let i = 0; i < caption.words.length; i++) {
        const word = caption.words[i];
        const kCs = Math.max(0, Math.round((word.start - prevTime) * 100));
        text += `{\\k${kCs}}${escapeAssText(transformText(word.word))}`;
        if (i < caption.words.length - 1) text += " ";
        prevTime = word.start;
      }
      lines.push(`Dialogue: 0,${startStr},${endStr},Default,,0,0,0,,${text}`);
    } else {
      lines.push(
        `Dialogue: 0,${startStr},${endStr},Default,,0,0,0,,${posOverride}${escapeAssText(transformText(caption.text))}`
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

/* ---------- Text Overlays (drawtext) ---------- */

export interface TextOverlay {
  id: string;
  text: string;
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  fontSize: number;
  color: string; // hex #RRGGBB
}

function escapeDrawtextValue(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/'/g, "'\\''");
}

function buildDrawtextChain(
  overlays: TextOverlay[],
  outputWidth: number,
  outputHeight: number
): string {
  if (!overlays || overlays.length === 0) return "";
  const fontScale = outputWidth / 400;
  return overlays
    .map((o) => {
      const x = Math.round((outputWidth * o.x) / 100);
      const y = Math.round((outputHeight * o.y) / 100);
      const sz = Math.round(o.fontSize * fontScale);
      const escaped = escapeDrawtextValue(o.text);
      return `drawtext=text='${escaped}':x=${x}:y=${y}:fontsize=${sz}:fontcolor=${o.color}:borderw=2:bordercolor=black@0.7:shadowcolor=black@0.5:shadowx=1:shadowy=2`;
    })
    .join(",");
}

// Build rounded-corner geq filter with a specific pixel radius
function buildRoundedCornersGeq(radiusPx: number): string {
  const R = radiusPx;
  return `geq=lum='p(X,Y)':cb='p(X,Y)':cr='p(X,Y)':a='if(gt(abs(X-W/2),W/2-${R})*gt(abs(Y-H/2),H/2-${R}),if(lte(hypot(abs(X-W/2)-(W/2-${R}),abs(Y-H/2)-(H/2-${R})),${R}),255,0),255)'`;
}

export interface MusicMixOptions {
  filePath: string;
  volume: number; // 0-100
  startTime?: number; // seconds into the music track to start from
  endTime?: number;   // seconds into the music track to end at
}

export async function createClipWithCaptions(
  userId: string,
  videoPath: string,
  start: number,
  end: number,
  captions: CaptionSegment[],
  style?: CaptionStyle,
  layout?: VideoLayout,
  template?: ReelTemplate,
  textOverlays?: TextOverlay[],
  colorGrading?: ColorGradingParams,
  enhance?: boolean,
  music?: MusicMixOptions
): Promise<string> {
  const userDir = getUserTmpDir(userId);
  const outputFilename = `clip_${Date.now()}_${Math.random().toString(36).slice(2)}.mp4`;
  const outputPath = path.join(userDir, outputFilename);
  const duration = end - start;

  const { width, height } = await getVideoDimensions(videoPath);

  const is916 = layout?.format === "9:16";
  const frameConfig = is916 ? getFrameConfig(layout.frame) : null;
  const isFrameMode = is916 && frameConfig && frameConfig.id !== "fill";

  // For frame modes, burn ASS onto the source video first so captions stay
  // inside the video area. For fill/original, ASS matches the final output.
  const assWidth = isFrameMode ? width : (is916 ? REEL_WIDTH : width);
  const assHeight = isFrameMode ? height : (is916 ? REEL_HEIGHT : height);

  const assContent = template
    ? generateAssContentFromTemplate(captions, start, assWidth, assHeight, template)
    : generateAssContent(captions, start, assWidth, assHeight, style);
  const assPath = path.join(
    userDir,
    `subs_${Date.now()}_${Math.random().toString(36).slice(2)}.ass`
  );
  fs.writeFileSync(assPath, assContent);

  const escapedAssPath = assPath
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:");

  try {
    let ffmpegArgs: string[];
    const enhancePrefix = enhance ? `${ENHANCE_FILTER},` : "";
    const colorFilter = colorGrading ? buildColorGradingFilter(colorGrading) : "";
    const colorPrefix = enhancePrefix + (colorFilter ? `${colorFilter},` : "");

    // Build audio mixing filter when background music is provided
    const hasMusic = music && music.filePath && music.volume > 0;
    const musicInputArgs = hasMusic ? ["-i", music.filePath] : [];
    const musicInputIdx = hasMusic ? 1 : -1;

    // Helper: returns audio filter chains for filter_complex and map args
    function getAudioMixParts(): { chains: string[]; mapArgs: string[] } {
      if (!hasMusic) {
        return { chains: [], mapArgs: ["-c:a", "aac", "-b:a", "128k"] };
      }
      const vol = music.volume / 100;
      const videoVol = Math.max(0.1, 1.0 - vol * 0.5);
      const musicVol = vol;

      // Build trim filter: select portion of track, then loop to fill clip
      let trimFilter: string;
      if (music.startTime != null && music.startTime > 0) {
        const endPart = music.endTime != null ? `:${music.endTime}` : "";
        trimFilter = `atrim=${music.startTime}${endPart},asetpts=PTS-STARTPTS,`;
      } else if (music.endTime != null) {
        trimFilter = `atrim=0:${music.endTime},asetpts=PTS-STARTPTS,`;
      } else {
        trimFilter = "";
      }

      return {
        chains: [
          `[0:a]volume=${videoVol.toFixed(2)}[a0]`,
          `[${musicInputIdx}:a]${trimFilter}aloop=loop=-1:size=2e+09,atrim=0:${duration},volume=${musicVol.toFixed(2)}[a1]`,
          `[a0][a1]amix=inputs=2:duration=first[aout]`,
        ],
        mapArgs: ["-map", "[aout]", "-c:a", "aac", "-b:a", "128k"],
      };
    }

    const audioParts = getAudioMixParts();

    if (is916 && frameConfig && frameConfig.id === "fill") {
      // 9:16 Fill: crop center to 9:16 ratio, then scale to 1080x1920
      const targetRatio = REEL_WIDTH / REEL_HEIGHT; // 0.5625
      const srcRatio = width / height;
      let cropFilter: string;
      if (Math.abs(srcRatio - targetRatio) < 0.01) {
        cropFilter = "";
      } else if (srcRatio > targetRatio) {
        cropFilter = `crop=ih*${targetRatio}:ih,`;
      } else {
        cropFilter = `crop=iw:iw/${targetRatio},`;
      }

      const dt = buildDrawtextChain(textOverlays || [], REEL_WIDTH, REEL_HEIGHT);
      const dtSuffix = dt ? `,${dt}` : "";

      if (hasMusic) {
        const videoChain = `[0:v]${cropFilter}scale=${REEL_WIDTH}:${REEL_HEIGHT},${colorPrefix}ass=${escapedAssPath}${dtSuffix}[vout]`;
        const filterComplex = [videoChain, ...audioParts.chains].join(";");
        ffmpegArgs = [
          "-y",
          "-ss", start.toString(),
          "-i", videoPath,
          ...musicInputArgs,
          "-t", duration.toString(),
          "-filter_complex", filterComplex,
          "-map", "[vout]",
          ...audioParts.mapArgs,
          "-c:v", "libx264",
          "-preset", "fast",
          "-crf", "23",
          "-movflags", "+faststart",
          outputPath,
        ];
      } else {
        ffmpegArgs = [
          "-y",
          "-ss", start.toString(),
          "-i", videoPath,
          "-t", duration.toString(),
          "-vf", `${cropFilter}scale=${REEL_WIDTH}:${REEL_HEIGHT},${colorPrefix}ass=${escapedAssPath}${dtSuffix}`,
          "-c:v", "libx264",
          "-preset", "fast",
          "-crf", "23",
          "-c:a", "aac",
          "-b:a", "128k",
          "-movflags", "+faststart",
          outputPath,
        ];
      }
    } else if (isFrameMode && frameConfig) {
      // 9:16 Frame template: burn captions on video first, then scale, round corners, overlay on black canvas
      const scaledW = Math.round((REEL_WIDTH * frameConfig.videoWidthPct) / 100 / 2) * 2;
      const radiusPx = Math.round(scaledW * frameConfig.radiusPct / 100);

      let videoChain: string;
      if (radiusPx > 0) {
        videoChain = `[0:v]${colorPrefix}ass=${escapedAssPath},scale=${scaledW}:-2,format=yuva420p,${buildRoundedCornersGeq(radiusPx)}[vid]`;
      } else {
        videoChain = `[0:v]${colorPrefix}ass=${escapedAssPath},scale=${scaledW}:-2[vid]`;
      }

      const dt = buildDrawtextChain(textOverlays || [], REEL_WIDTH, REEL_HEIGHT);
      const dtSuffix = dt ? `,${dt}` : "";

      const videoOverlay = `[bg][vid]overlay=(W-w)/2:(H-h)/2:shortest=1${dtSuffix}`;
      const filterChains = [
        videoChain,
        `color=black:s=${REEL_WIDTH}x${REEL_HEIGHT}[bg]`,
      ];

      if (hasMusic) {
        filterChains.push(`${videoOverlay}[vout]`);
        filterChains.push(...audioParts.chains);
        const filterComplex = filterChains.join(";");
        ffmpegArgs = [
          "-y",
          "-ss", start.toString(),
          "-i", videoPath,
          ...musicInputArgs,
          "-t", duration.toString(),
          "-filter_complex", filterComplex,
          "-map", "[vout]",
          ...audioParts.mapArgs,
          "-c:v", "libx264",
          "-preset", "fast",
          "-crf", "23",
          "-movflags", "+faststart",
          outputPath,
        ];
      } else {
        filterChains.push(videoOverlay);
        const filterComplex = filterChains.join(";");
        ffmpegArgs = [
          "-y",
          "-ss", start.toString(),
          "-i", videoPath,
          "-t", duration.toString(),
          "-filter_complex", filterComplex,
          "-c:v", "libx264",
          "-preset", "fast",
          "-crf", "23",
          "-c:a", "aac",
          "-b:a", "128k",
          "-movflags", "+faststart",
          outputPath,
        ];
      }
    } else {
      // Original format: just encode with even dimensions + subtitles
      const evenW = Math.floor(width / 2) * 2;
      const evenH = Math.floor(height / 2) * 2;
      const dt = buildDrawtextChain(textOverlays || [], evenW, evenH);
      const dtSuffix = dt ? `,${dt}` : "";

      if (hasMusic) {
        const videoChain = `[0:v]scale=trunc(iw/2)*2:trunc(ih/2)*2,${colorPrefix}ass=${escapedAssPath}${dtSuffix}[vout]`;
        const filterComplex = [videoChain, ...audioParts.chains].join(";");
        ffmpegArgs = [
          "-y",
          "-ss", start.toString(),
          "-i", videoPath,
          ...musicInputArgs,
          "-t", duration.toString(),
          "-filter_complex", filterComplex,
          "-map", "[vout]",
          ...audioParts.mapArgs,
          "-c:v", "libx264",
          "-preset", "fast",
          "-crf", "23",
          "-movflags", "+faststart",
          outputPath,
        ];
      } else {
        ffmpegArgs = [
          "-y",
          "-ss", start.toString(),
          "-i", videoPath,
          "-t", duration.toString(),
          "-vf", `scale=trunc(iw/2)*2:trunc(ih/2)*2,${colorPrefix}ass=${escapedAssPath}${dtSuffix}`,
          "-c:v", "libx264",
          "-preset", "fast",
          "-crf", "23",
          "-c:a", "aac",
          "-b:a", "128k",
          "-movflags", "+faststart",
          outputPath,
        ];
      }
    }

    await execFileAsync("ffmpeg", ffmpegArgs, { timeout: 300000 });
  } finally {
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
