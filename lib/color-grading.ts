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

/*
 * Professional Color Grading Pipeline
 * ====================================
 * Order of operations (matches industry standard):
 *
 * 1. Exposure correction  (eq: brightness + gamma)
 * 2. Contrast via S-curve  (curves: lifted blacks, rolled highlights, midtone contrast)
 * 3. Color balance / cast correction  (colorbalance: shadows/mids/highlights)
 * 4. Saturation / vibrance  (eq: saturation)
 * 5. Color separation  (colorbalance: teal shadows + warm highlights — the cinematic split)
 * 6. Sharpening / clarity  (unsharp: subtle detail enhancement)
 *
 * ffmpeg filter chain:
 *   eq → curves → colorbalance → unsharp
 */

export interface ColorGradingParams {
  brightness: number;  // -1 to 1 (0 = no change)
  contrast: number;    // 0.0 to 3.0 (1 = no change) — linear eq contrast
  saturation: number;  // 0.0 to 3.0 (1 = no change)
  gamma: number;       // 0.1 to 10.0 (1 = no change)
  colorbalance: {
    rs: number; gs: number; bs: number;  // shadows  (-1 to 1)
    rm: number; gm: number; bm: number;  // midtones (-1 to 1)
    rh: number; gh: number; bh: number;  // highlights (-1 to 1)
  };
  // Tonal curve (S-curve with lifted blacks + rolled highlights)
  curves: {
    master: string;  // e.g. "0/0.04 0.25/0.20 0.5/0.50 0.75/0.80 1/0.97"
  } | null;
  // Sharpening / clarity
  sharpening: {
    lumaAmount: number;  // 0 to 2.0 (0 = off)
    lumaSizeX: number;   // odd integer 3-13
    lumaSizeY: number;
  } | null;
}

export interface ColorGradingState {
  enabled: boolean;
  params: ColorGradingParams | null;
  gradedFilename: string | null;
}

export const DEFAULT_COLOR_GRADING_STATE: ColorGradingState = {
  enabled: false,
  params: null,
  gradedFilename: null,
};

interface ColorAnalysis {
  yavg: number;    // average luma (0-255)
  ymin: number;    // minimum luma
  ymax: number;    // maximum luma
  satavg: number;  // average saturation
  huemed: number;  // median hue (0-360)
}

export async function analyzeVideoColors(
  videoPath: string,
  start: number,
  end: number
): Promise<ColorAnalysis> {
  const duration = end - start;
  const numSamples = 5;
  const analyses: ColorAnalysis[] = [];

  for (let i = 0; i < numSamples; i++) {
    const t = start + (duration * (i + 0.5)) / numSamples;

    try {
      const { stderr } = await execFileAsync(
        "ffmpeg",
        [
          "-ss", t.toString(),
          "-i", videoPath,
          "-vframes", "1",
          "-vf", "signalstats=stat=tout+vrep+brng,metadata=mode=print",
          "-f", "null",
          "-",
        ],
        { timeout: 30000 }
      );

      const parsed = parseSignalStats(stderr);
      if (parsed) analyses.push(parsed);
    } catch {
      // skip failed frame
    }
  }

  if (analyses.length === 0) {
    return { yavg: 128, ymin: 16, ymax: 235, satavg: 80, huemed: 180 };
  }

  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

  return {
    yavg: avg(analyses.map((a) => a.yavg)),
    ymin: avg(analyses.map((a) => a.ymin)),
    ymax: avg(analyses.map((a) => a.ymax)),
    satavg: avg(analyses.map((a) => a.satavg)),
    huemed: avg(analyses.map((a) => a.huemed)),
  };
}

function parseSignalStats(stderr: string): ColorAnalysis | null {
  const getValue = (key: string): number | null => {
    const regex = new RegExp(`lavfi\\.signalstats\\.${key}=(\\d+\\.?\\d*)`);
    const match = stderr.match(regex);
    return match ? parseFloat(match[1]) : null;
  };

  const yavg = getValue("YAVG");
  const ymin = getValue("YMIN");
  const ymax = getValue("YMAX");
  const satavg = getValue("SATAVG");
  const huemed = getValue("HUEMED");

  if (yavg === null || ymin === null || ymax === null) return null;

  return {
    yavg,
    ymin,
    ymax,
    satavg: satavg ?? 80,
    huemed: huemed ?? 180,
  };
}

/**
 * Compute color grading parameters from video analysis.
 *
 * Principle: only fix what's actually wrong. A well-shot video
 * should come out nearly untouched. Every effect is conditional
 * on the analysis showing a real deficiency.
 */
export function computeGradingParams(analysis: ColorAnalysis): ColorGradingParams {
  let brightness = 0;
  let contrast = 1;
  let saturation = 1;
  let gamma = 1;
  const colorbalance = {
    rs: 0, gs: 0, bs: 0,
    rm: 0, gm: 0, bm: 0,
    rh: 0, gh: 0, bh: 0,
  };
  let curves: ColorGradingParams["curves"] = null;
  let sharpening: ColorGradingParams["sharpening"] = null;

  const dynamicRange = analysis.ymax - analysis.ymin;

  // ──────────────────────────────────────────────
  // 1. Exposure — only if clearly under/overexposed
  // ──────────────────────────────────────────────
  if (analysis.yavg < 70) {
    // Underexposed
    const deficit = (70 - analysis.yavg) / 70;
    brightness = Math.min(0.10, deficit * 0.12);
    gamma = Math.min(1.30, 1 + deficit * 0.40);
  } else if (analysis.yavg > 210) {
    // Overexposed
    const excess = (analysis.yavg - 210) / 45;
    brightness = Math.max(-0.10, -excess * 0.12);
    gamma = Math.max(0.80, 1 - excess * 0.25);
  }
  // yavg 70-210 = normal exposure, don't touch it.

  // ──────────────────────────────────────────────
  // 2. Contrast / S-curve — only if dynamic range is flat
  // ──────────────────────────────────────────────
  if (dynamicRange < 100) {
    // Flat/washed out: needs contrast help via S-curve
    contrast = 1.10;
    curves = {
      master: "0/0.04 0.25/0.19 0.5/0.50 0.75/0.81 1/0.96",
    };
  } else if (dynamicRange < 140) {
    // Slightly flat: gentle curve boost
    contrast = 1.05;
    curves = {
      master: "0/0.03 0.25/0.21 0.5/0.50 0.75/0.79 1/0.97",
    };
  }
  // dynamicRange >= 140 = good range already, skip curves entirely.

  // ──────────────────────────────────────────────
  // 3. Color cast correction — only if a cast is detected
  // ──────────────────────────────────────────────
  // A strong cast means the median hue is far from neutral AND
  // saturation is high enough for the cast to be visible.
  const hue = analysis.huemed;
  const CAST_STRENGTH = 0.10;

  // Only correct if saturation is noticeable (cast is visible)
  // AND the hue is clearly skewed away from neutral (~150-210 range
  // is roughly neutral/cyan which is usually fine).
  if (analysis.satavg > 30) {
    if (hue < 30 || hue > 330) {
      colorbalance.rm = -CAST_STRENGTH * 0.5;
      colorbalance.gm = CAST_STRENGTH * 0.25;
      colorbalance.bm = CAST_STRENGTH * 0.25;
    } else if (hue >= 30 && hue < 90) {
      colorbalance.rm = -CAST_STRENGTH * 0.3;
      colorbalance.gm = -CAST_STRENGTH * 0.3;
      colorbalance.bm = CAST_STRENGTH * 0.3;
    } else if (hue >= 90 && hue < 150) {
      colorbalance.rm = CAST_STRENGTH * 0.25;
      colorbalance.gm = -CAST_STRENGTH * 0.5;
      colorbalance.bm = CAST_STRENGTH * 0.25;
    } else if (hue >= 210 && hue < 270) {
      colorbalance.rm = CAST_STRENGTH * 0.25;
      colorbalance.gm = CAST_STRENGTH * 0.25;
      colorbalance.bm = -CAST_STRENGTH * 0.5;
    } else if (hue >= 270 && hue <= 330) {
      colorbalance.rm = -CAST_STRENGTH * 0.3;
      colorbalance.gm = CAST_STRENGTH * 0.3;
      colorbalance.bm = -CAST_STRENGTH * 0.3;
    }
    // hue 150-210 (cyan-ish) = neutral, no correction needed.
  }

  // ──────────────────────────────────────────────
  // 4. Saturation — only if actually wrong
  // ──────────────────────────────────────────────
  if (analysis.satavg < 30) {
    // Washed out: boost
    const deficit = (30 - analysis.satavg) / 30;
    saturation = Math.min(1.30, 1 + deficit * 0.40);
  } else if (analysis.satavg > 120) {
    // Over-saturated: pull back
    saturation = Math.max(0.85, 1 - (analysis.satavg - 120) / 200);
  }
  // satavg 30-120 = normal range, leave it alone.

  // ──────────────────────────────────────────────
  // No unconditional sharpening, color separation, or desaturation.
  // Those are creative choices, not corrections.
  // ──────────────────────────────────────────────

  return {
    brightness,
    contrast,
    saturation,
    gamma,
    colorbalance,
    curves,
    sharpening,
  };
}

/**
 * Build the complete ffmpeg filter chain from grading params.
 *
 * Output order: eq → curves → colorbalance → unsharp
 */
export function buildColorGradingFilter(params: ColorGradingParams): string {
  const parts: string[] = [];

  // 1. eq filter — exposure, contrast, saturation, gamma
  const eqParts: string[] = [];
  if (params.brightness !== 0) eqParts.push(`brightness=${params.brightness.toFixed(3)}`);
  if (params.contrast !== 1) eqParts.push(`contrast=${params.contrast.toFixed(3)}`);
  if (params.saturation !== 1) eqParts.push(`saturation=${params.saturation.toFixed(3)}`);
  if (params.gamma !== 1) eqParts.push(`gamma=${params.gamma.toFixed(3)}`);
  if (eqParts.length > 0) {
    parts.push(`eq=${eqParts.join(":")}`);
  }

  // 2. curves filter — S-curve with lifted blacks and rolled highlights
  if (params.curves?.master) {
    parts.push(`curves=m='${params.curves.master}'`);
  }

  // 3. colorbalance filter — cast correction + cinematic color separation
  const cb = params.colorbalance;
  const cbParts: string[] = [];
  if (cb.rs !== 0) cbParts.push(`rs=${cb.rs.toFixed(3)}`);
  if (cb.gs !== 0) cbParts.push(`gs=${cb.gs.toFixed(3)}`);
  if (cb.bs !== 0) cbParts.push(`bs=${cb.bs.toFixed(3)}`);
  if (cb.rm !== 0) cbParts.push(`rm=${cb.rm.toFixed(3)}`);
  if (cb.gm !== 0) cbParts.push(`gm=${cb.gm.toFixed(3)}`);
  if (cb.bm !== 0) cbParts.push(`bm=${cb.bm.toFixed(3)}`);
  if (cb.rh !== 0) cbParts.push(`rh=${cb.rh.toFixed(3)}`);
  if (cb.gh !== 0) cbParts.push(`gh=${cb.gh.toFixed(3)}`);
  if (cb.bh !== 0) cbParts.push(`bh=${cb.bh.toFixed(3)}`);
  if (cbParts.length > 0) {
    parts.push(`colorbalance=${cbParts.join(":")}`);
  }

  // 4. unsharp filter — clarity / sharpening
  if (params.sharpening && params.sharpening.lumaAmount > 0) {
    const s = params.sharpening;
    parts.push(`unsharp=${s.lumaSizeX}:${s.lumaSizeY}:${s.lumaAmount.toFixed(2)}:${s.lumaSizeX}:${s.lumaSizeY}:0.0`);
  }

  return parts.join(",");
}

/**
 * Human-readable description of what the grading did.
 */
export function describeCorrections(params: ColorGradingParams): string[] {
  const corrections: string[] = [];

  if (params.brightness > 0.02) corrections.push("Brightened");
  else if (params.brightness < -0.02) corrections.push("Darkened");

  if (params.gamma > 1.05) corrections.push("Lifted shadows");
  else if (params.gamma < 0.95) corrections.push("Tamed highlights");

  if (params.contrast > 1.03) corrections.push("Increased contrast");

  if (params.curves) corrections.push("Improved tonal range");

  const cb = params.colorbalance;
  const hasCast =
    Math.abs(cb.rm) > 0.02 || Math.abs(cb.gm) > 0.02 || Math.abs(cb.bm) > 0.02;
  if (hasCast) corrections.push("Fixed color cast");

  if (params.saturation > 1.05) corrections.push("Boosted saturation");
  else if (params.saturation < 0.95) corrections.push("Reduced oversaturation");

  if (params.sharpening && params.sharpening.lumaAmount > 0) {
    corrections.push("Added clarity");
  }

  if (corrections.length === 0) corrections.push("No corrections needed");

  return corrections;
}

export async function applyColorGrading(
  userId: string,
  videoPath: string,
  start: number,
  end: number,
  params: ColorGradingParams
): Promise<string> {
  const userDir = getUserTmpDir(userId);
  const outputFilename = `graded_${Date.now()}_${Math.random().toString(36).slice(2)}.mp4`;
  const outputPath = path.join(userDir, outputFilename);
  const duration = end - start;

  const colorFilter = buildColorGradingFilter(params);
  if (!colorFilter) {
    await execFileAsync(
      "ffmpeg",
      [
        "-y",
        "-ss", start.toString(),
        "-i", videoPath,
        "-t", duration.toString(),
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
  } else {
    await execFileAsync(
      "ffmpeg",
      [
        "-y",
        "-ss", start.toString(),
        "-i", videoPath,
        "-t", duration.toString(),
        "-vf", colorFilter,
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
  }

  return outputFilename;
}
