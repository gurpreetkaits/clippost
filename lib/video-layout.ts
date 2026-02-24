export type OutputFormat = "original" | "9:16";
export type FrameTemplate = "fill" | "cinema" | "compact" | "floating";

export interface VideoLayout {
  format: OutputFormat;
  frame: FrameTemplate;
}

export const DEFAULT_LAYOUT: VideoLayout = {
  format: "original",
  frame: "cinema",
};

export const OUTPUT_FORMATS: { id: OutputFormat; label: string }[] = [
  { id: "original", label: "Flat" },
  { id: "9:16", label: "9:16 Reel" },
];

export const FRAME_TEMPLATES: {
  id: FrameTemplate;
  label: string;
  desc: string;
  videoWidthPct: number;
  radiusPct: number;
}[] = [
  { id: "fill", label: "Fill", desc: "Crop to fill frame", videoWidthPct: 100, radiusPct: 0 },
  { id: "cinema", label: "Cinema", desc: "Large with rounded corners", videoWidthPct: 92, radiusPct: 3 },
  { id: "compact", label: "Compact", desc: "Medium centered frame", videoWidthPct: 76, radiusPct: 3.5 },
  { id: "floating", label: "Floating", desc: "Small floating card", videoWidthPct: 60, radiusPct: 4 },
];

export function getFrameConfig(frame: FrameTemplate) {
  return FRAME_TEMPLATES.find((t) => t.id === frame) ?? FRAME_TEMPLATES[1];
}

// Output resolution for 9:16 reel
export const REEL_WIDTH = 1080;
export const REEL_HEIGHT = 1920;
