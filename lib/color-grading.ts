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

export interface ColorGradingParams {
  brightness: number; // -1 to 1 (0 = no change)
  contrast: number; // 0.0 to 3.0 (1 = no change)
  saturation: number; // 0.0 to 3.0 (1 = no change)
  gamma: number; // 0.1 to 10.0 (1 = no change)
  colorbalance: {
    rs: number; // shadows red -1 to 1
    gs: number;
    bs: number;
    rm: number; // midtones red -1 to 1
    gm: number;
    bm: number;
    rh: number; // highlights red -1 to 1
    gh: number;
    bh: number;
  };
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
  yavg: number; // average luma (0-255)
  ymin: number; // minimum luma
  ymax: number; // maximum luma
  satavg: number; // average saturation
  huemed: number; // median hue (0-360)
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
          "-ss",
          t.toString(),
          "-i",
          videoPath,
          "-vframes",
          "1",
          "-vf",
          "signalstats=stat=tout+vrep+brng,metadata=mode=print",
          "-f",
          "null",
          "-",
        ],
        { timeout: 30000 }
      );

      const parsed = parseSignalStats(stderr);
      if (parsed) {
        analyses.push(parsed);
      }
    } catch {
      // skip failed frame
    }
  }

  if (analyses.length === 0) {
    // Return neutral defaults if analysis completely fails
    return { yavg: 128, ymin: 16, ymax: 235, satavg: 80, huemed: 180 };
  }

  // Average across all sampled frames
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

  // Exposure correction
  if (analysis.yavg < 80) {
    // Underexposed: boost brightness and gamma
    const deficit = (80 - analysis.yavg) / 80;
    brightness = Math.min(0.12, deficit * 0.15);
    gamma = Math.min(1.4, 1 + deficit * 0.5);
  } else if (analysis.yavg > 200) {
    // Overexposed: reduce brightness and gamma
    const excess = (analysis.yavg - 200) / 55;
    brightness = Math.max(-0.12, -excess * 0.15);
    gamma = Math.max(0.75, 1 - excess * 0.3);
  }

  // Contrast correction
  const dynamicRange = analysis.ymax - analysis.ymin;
  if (dynamicRange < 120) {
    const shortfall = (120 - dynamicRange) / 120;
    contrast = Math.min(1.3, 1 + shortfall * 0.4);
  }

  // Saturation correction
  if (analysis.satavg < 40) {
    const deficit = (40 - analysis.satavg) / 40;
    saturation = Math.min(1.5, 1 + deficit * 0.6);
  }

  // Color cast correction via midtone colorbalance
  // Hue 0=red, 60=yellow, 120=green, 180=cyan, 240=blue, 300=magenta
  const hue = analysis.huemed;
  const MAX_CORRECTION = 0.12;

  // Only correct if saturation is noticeable (cast is visible)
  if (analysis.satavg > 20) {
    if (hue < 30 || hue > 330) {
      // Red cast: reduce red, boost cyan
      colorbalance.rm = -MAX_CORRECTION * 0.5;
      colorbalance.gm = MAX_CORRECTION * 0.25;
      colorbalance.bm = MAX_CORRECTION * 0.25;
    } else if (hue >= 30 && hue < 90) {
      // Yellow cast: reduce red+green slightly
      colorbalance.rm = -MAX_CORRECTION * 0.3;
      colorbalance.gm = -MAX_CORRECTION * 0.3;
      colorbalance.bm = MAX_CORRECTION * 0.3;
    } else if (hue >= 90 && hue < 150) {
      // Green cast: reduce green
      colorbalance.rm = MAX_CORRECTION * 0.25;
      colorbalance.gm = -MAX_CORRECTION * 0.5;
      colorbalance.bm = MAX_CORRECTION * 0.25;
    } else if (hue >= 150 && hue < 210) {
      // Cyan cast: common, usually fine — very light correction
      colorbalance.rm = MAX_CORRECTION * 0.15;
      colorbalance.gm = -MAX_CORRECTION * 0.1;
      colorbalance.bm = -MAX_CORRECTION * 0.15;
    } else if (hue >= 210 && hue < 270) {
      // Blue cast: reduce blue
      colorbalance.rm = MAX_CORRECTION * 0.25;
      colorbalance.gm = MAX_CORRECTION * 0.25;
      colorbalance.bm = -MAX_CORRECTION * 0.5;
    } else if (hue >= 270 && hue <= 330) {
      // Magenta cast: reduce red+blue
      colorbalance.rm = -MAX_CORRECTION * 0.3;
      colorbalance.gm = MAX_CORRECTION * 0.3;
      colorbalance.bm = -MAX_CORRECTION * 0.3;
    }
  }

  return { brightness, contrast, saturation, gamma, colorbalance };
}

export function buildColorGradingFilter(params: ColorGradingParams): string {
  const parts: string[] = [];

  // eq filter for brightness/contrast/saturation/gamma
  const eqParts: string[] = [];
  if (params.brightness !== 0) eqParts.push(`brightness=${params.brightness.toFixed(3)}`);
  if (params.contrast !== 1) eqParts.push(`contrast=${params.contrast.toFixed(3)}`);
  if (params.saturation !== 1) eqParts.push(`saturation=${params.saturation.toFixed(3)}`);
  if (params.gamma !== 1) eqParts.push(`gamma=${params.gamma.toFixed(3)}`);

  if (eqParts.length > 0) {
    parts.push(`eq=${eqParts.join(":")}`);
  }

  // colorbalance filter
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

  return parts.join(",");
}

export function describeCorrections(params: ColorGradingParams): string[] {
  const corrections: string[] = [];

  if (params.brightness > 0.02) corrections.push("Brightened");
  else if (params.brightness < -0.02) corrections.push("Darkened");

  if (params.contrast > 1.05) corrections.push("Increased contrast");

  if (params.saturation > 1.05) corrections.push("Boosted saturation");

  if (params.gamma > 1.05) corrections.push("Lifted shadows");
  else if (params.gamma < 0.95) corrections.push("Tamed highlights");

  const cb = params.colorbalance;
  const hasCast =
    Math.abs(cb.rm) > 0.02 || Math.abs(cb.gm) > 0.02 || Math.abs(cb.bm) > 0.02;
  if (hasCast) corrections.push("Fixed color cast");

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
    // No corrections to apply — just copy the segment
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
