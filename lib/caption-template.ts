import { CaptionStyle } from "./caption-style";

export type Zone =
  | "top-left"
  | "top-center"
  | "top-right"
  | "center-left"
  | "center"
  | "center-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export interface ReelTemplate {
  name: string;
  // Typography
  fontFamily: string;
  fontSize: number; // base px at 1080x1920
  bold: boolean;
  italic: boolean;
  underline: boolean;
  textTransform: "none" | "uppercase" | "lowercase";
  letterSpacing: number; // 0-20, maps to ASS \fsp
  scaleX: number; // 50-200, maps to ASS ScaleX
  // Colors
  textColor: string; // hex
  bgColor: string; // hex
  bgOpacity: number; // 0-100
  // Border & Shadow
  borderStyle: "box" | "outline"; // ASS BorderStyle 3 vs 1
  outlineWidth: number; // 0-10 (used when borderStyle="outline")
  shadowDistance: number; // 0-10
  shadowColor: string; // hex
  // Positioning
  zone: Zone;
  posX: number | null; // fine-tune override (% of width), null = use zone default
  posY: number | null; // fine-tune override (% of height)
  maxWidth: number; // text max width as % of canvas (30-95)
  wrapStyle: "smart" | "none"; // ASS \q0 vs \q2
}

// Maps zone to ASS \an alignment (numpad layout)
export const ZONE_ALIGNMENT_MAP: Record<Zone, number> = {
  "bottom-left": 1,
  "bottom-center": 2,
  "bottom-right": 3,
  "center-left": 4,
  center: 5,
  "center-right": 6,
  "top-left": 7,
  "top-center": 8,
  "top-right": 9,
};

// Default zone positions as % of canvas
export const ZONE_POSITION_MAP: Record<Zone, { x: number; y: number }> = {
  "top-left": { x: 15, y: 8 },
  "top-center": { x: 50, y: 8 },
  "top-right": { x: 85, y: 8 },
  "center-left": { x: 15, y: 50 },
  center: { x: 50, y: 50 },
  "center-right": { x: 85, y: 50 },
  "bottom-left": { x: 15, y: 78 },
  "bottom-center": { x: 50, y: 78 },
  "bottom-right": { x: 85, y: 78 },
};

// Reproduces current DEFAULT_CAPTION_STYLE behavior exactly
export const DEFAULT_REEL_TEMPLATE: ReelTemplate = {
  name: "Classic Bottom",
  fontFamily: "Helvetica Neue",
  fontSize: 42,
  bold: true,
  italic: false,
  underline: false,
  textTransform: "none",
  letterSpacing: 0,
  scaleX: 100,
  textColor: "#000000",
  bgColor: "#FFFFFF",
  bgOpacity: 100,
  borderStyle: "box",
  outlineWidth: 0,
  shadowDistance: 0,
  shadowColor: "#000000",
  zone: "bottom-center",
  posX: null,
  posY: null,
  maxWidth: 90,
  wrapStyle: "smart",
};

export const ZONE_PRESETS: ReelTemplate[] = [
  // Classic Bottom — matches DEFAULT_CAPTION_STYLE
  { ...DEFAULT_REEL_TEMPLATE },
  // Bold Center
  {
    ...DEFAULT_REEL_TEMPLATE,
    name: "Bold Center",
    fontFamily: "Impact",
    fontSize: 54,
    textColor: "#FFFFFF",
    bgColor: "#000000",
    bgOpacity: 0,
    borderStyle: "outline",
    outlineWidth: 4,
    textTransform: "uppercase",
    zone: "center",
  },
  // Minimal Top
  {
    ...DEFAULT_REEL_TEMPLATE,
    name: "Minimal Top",
    fontFamily: "Helvetica Neue",
    fontSize: 34,
    textColor: "#FFFFFF",
    bgColor: "#000000",
    bgOpacity: 60,
    zone: "top-center",
  },
  // Neon Pop
  {
    ...DEFAULT_REEL_TEMPLATE,
    name: "Neon Pop",
    fontFamily: "Arial Black",
    fontSize: 46,
    textColor: "#FACC15",
    bgColor: "#000000",
    bgOpacity: 0,
    borderStyle: "outline",
    outlineWidth: 3,
    textTransform: "uppercase",
    letterSpacing: 4,
    zone: "bottom-center",
  },
  // Cinema Lower Third
  {
    ...DEFAULT_REEL_TEMPLATE,
    name: "Cinema Lower Third",
    fontFamily: "Georgia",
    fontSize: 36,
    italic: true,
    textColor: "#FFFFFF",
    bgColor: "#1E293B",
    bgOpacity: 80,
    zone: "bottom-left",
    maxWidth: 70,
  },
  // Typewriter
  {
    ...DEFAULT_REEL_TEMPLATE,
    name: "Typewriter",
    fontFamily: "Courier New",
    fontSize: 38,
    textColor: "#22C55E",
    bgColor: "#0F172A",
    bgOpacity: 90,
    letterSpacing: 3,
    zone: "bottom-center",
  },
];

// Convert a ReelTemplate to CaptionStyle for backward compat with existing components
export function templateToCaptionStyle(template: ReelTemplate): CaptionStyle {
  const zoneToPosition: Record<string, "top" | "center" | "bottom"> = {
    "top-left": "top",
    "top-center": "top",
    "top-right": "top",
    "center-left": "center",
    center: "center",
    "center-right": "center",
    "bottom-left": "bottom",
    "bottom-center": "bottom",
    "bottom-right": "bottom",
  };

  return {
    fontFamily: template.fontFamily,
    fontSize: template.fontSize,
    textColor: template.textColor,
    bgColor: template.bgColor,
    bgOpacity: template.bgOpacity,
    position: zoneToPosition[template.zone] || "bottom",
    bold: template.bold,
    italic: template.italic,
  };
}

// Strip name from template for DB storage (config field)
export function templateToConfig(
  template: ReelTemplate
): Omit<ReelTemplate, "name"> {
  const { name, ...config } = template;
  return config;
}

// Reconstitute template from DB record
export function configToTemplate(
  name: string,
  config: Omit<ReelTemplate, "name">
): ReelTemplate {
  return { name, ...config };
}
