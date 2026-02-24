import type { CSSProperties } from "react";

export type AspectRatio = "original" | "9:16" | "1:1" | "4:5" | "16:9";
export type MaskType = "none" | "rounded" | "soft" | "shadow-bottom" | "shadow-top-bottom" | "rounded-square";

export interface VideoLayout {
  aspectRatio: AspectRatio;
  mask: MaskType;
}

export const DEFAULT_LAYOUT: VideoLayout = {
  aspectRatio: "original",
  mask: "none",
};

export const ASPECT_RATIOS: { id: AspectRatio; label: string; desc: string }[] = [
  { id: "original", label: "Original", desc: "Keep source ratio" },
  { id: "9:16", label: "9:16", desc: "Vertical" },
  { id: "1:1", label: "1:1", desc: "Square" },
  { id: "4:5", label: "4:5", desc: "Portrait" },
  { id: "16:9", label: "16:9", desc: "Landscape" },
];

export const MASKS: { id: MaskType; label: string }[] = [
  { id: "none", label: "None" },
  { id: "rounded", label: "Rounded" },
  { id: "soft", label: "Soft" },
  { id: "shadow-bottom", label: "Shadow Bottom" },
  { id: "shadow-top-bottom", label: "Shadow T/B" },
  { id: "rounded-square", label: "Rounded Square" },
];

export function getMaskCSS(mask: MaskType): CSSProperties {
  switch (mask) {
    case "rounded":
      return { borderRadius: 20, overflow: "hidden" };
    case "soft":
      return {
        maskImage: "radial-gradient(ellipse 70% 70% at center, black 60%, transparent 100%)",
        WebkitMaskImage: "radial-gradient(ellipse 70% 70% at center, black 60%, transparent 100%)",
      };
    case "shadow-bottom":
      return {
        maskImage: "linear-gradient(to bottom, black 60%, transparent 100%)",
        WebkitMaskImage: "linear-gradient(to bottom, black 60%, transparent 100%)",
      };
    case "shadow-top-bottom":
      return {
        maskImage: "linear-gradient(to bottom, transparent 0%, black 18%, black 82%, transparent 100%)",
        WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 18%, black 82%, transparent 100%)",
      };
    case "rounded-square":
      return { borderRadius: "12%", overflow: "hidden" };
    default:
      return {};
  }
}

export function getAspectCSS(ratio: AspectRatio): string | undefined {
  switch (ratio) {
    case "9:16": return "9/16";
    case "1:1": return "1/1";
    case "4:5": return "4/5";
    case "16:9": return "16/9";
    default: return undefined;
  }
}

export function getAspectNumeric(ratio: AspectRatio): number | null {
  switch (ratio) {
    case "9:16": return 9 / 16;
    case "1:1": return 1;
    case "4:5": return 4 / 5;
    case "16:9": return 16 / 9;
    default: return null;
  }
}
