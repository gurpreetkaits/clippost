"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import TemplatePicker from "@/components/TemplatePicker";
import CaptionStyleEditor from "@/components/CaptionStyleEditor";
import { CaptionStyle } from "@/lib/caption-style";
import type { ReelTemplate } from "@/lib/caption-template";
import { Undo2, RotateCcw } from "lucide-react";

interface CaptionStyleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  captionStyle: CaptionStyle;
  onCaptionStyleChange: (style: CaptionStyle) => void;
  onTemplateSelect: (template: ReelTemplate, id?: string) => void;
  onUndo: () => void;
  onReset: () => void;
  canUndo: boolean;
}

/* ---------- Reel frame preview with Instagram-like UI ---------- */

const PREVIEW_SAMPLE_TEXT = "This is how your caption looks";

/**
 * Mirrors the ASS export positioning:
 * - ASS alignment 2 (bottom-center) with marginV = 22% of height
 *   → caption bottom edge is 22% from frame bottom → top = 78%
 * - ASS alignment 8 (top-center) with marginV = 6% of height
 *   → caption top edge is 6% from frame top → top = 6%
 * - ASS alignment 5 (center) → vertically centered → top = 50%
 */
const POSITION_CONFIG: Record<string, { anchor: "top" | "bottom" | "center"; pct: number }> = {
  top:     { anchor: "top",    pct: 6 },
  center:  { anchor: "center", pct: 50 },
  bottom:  { anchor: "bottom", pct: 22 },
  custom:  { anchor: "bottom", pct: 22 },
};

function ReelPreview({ style }: { style: CaptionStyle }) {
  const config = POSITION_CONFIG[style.position] ?? POSITION_CONFIG.bottom;

  const bgAlpha = Math.round((style.bgOpacity / 100) * 255)
    .toString(16)
    .padStart(2, "0");

  // Scale: ASS uses fontSize at 1920p height. Preview is 320px.
  const previewScale = 320 / 1920;
  const fontSize = Math.max(8, Math.round(style.fontSize * previewScale));
  // Match ASS box padding: borderStyle 3 with Outline = fontSize * 0.5
  const boxPad = Math.max(2, Math.round(style.fontSize * 0.5 * previewScale));

  // Position style that mirrors ASS margin behavior
  const posStyle: React.CSSProperties = { maxWidth: "85%" };
  if (config.anchor === "bottom") {
    posStyle.bottom = `${config.pct}%`;
    posStyle.left = "50%";
    posStyle.transform = "translateX(-50%)";
  } else if (config.anchor === "top") {
    posStyle.top = `${config.pct}%`;
    posStyle.left = "50%";
    posStyle.transform = "translateX(-50%)";
  } else {
    posStyle.top = "50%";
    posStyle.left = "50%";
    posStyle.transform = "translate(-50%, -50%)";
  }

  return (
    <div
      className="relative mx-auto rounded-xl overflow-hidden bg-gradient-to-br from-neutral-800 via-neutral-900 to-black border border-border"
      style={{ width: 180, height: 320 }}
    >
      {/* Fake video background */}
      <div className="absolute inset-0 bg-gradient-to-b from-neutral-700/30 via-transparent to-neutral-900/50" />

      {/* Instagram top bar */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center gap-1.5 px-2.5 pt-3 pb-1">
        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-pink-500 to-yellow-400" />
        <span className="text-[8px] text-white font-semibold">username</span>
        <span className="text-[7px] text-white/50 ml-auto">Follow</span>
      </div>

      {/* Instagram right side icons */}
      <div className="absolute right-2 bottom-[52px] z-20 flex flex-col items-center gap-3">
        <div className="w-4 h-4 flex items-center justify-center">
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" className="w-3.5 h-3.5">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </div>
        <div className="w-4 h-4 flex items-center justify-center">
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" className="w-3.5 h-3.5">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <div className="w-4 h-4 flex items-center justify-center">
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" className="w-3.5 h-3.5">
            <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </div>
      </div>

      {/* Instagram bottom bar */}
      <div className="absolute bottom-0 left-0 right-0 z-20 px-2.5 pb-2.5 pt-6 bg-gradient-to-t from-black/70 to-transparent">
        <p className="text-[7px] text-white/90 leading-tight mb-1">
          <span className="font-semibold">username</span>{" "}
          <span className="text-white/60">Amazing video! #reels</span>
        </p>
        <p className="text-[6px] text-white/50 flex items-center gap-1">
          <span>&#9835;</span> Original Audio
        </p>
      </div>

      {/* Caption — positioned to match ASS export */}
      <div
        className="absolute z-10 pointer-events-none"
        style={posStyle}
      >
        <div
          className="text-center whitespace-nowrap"
          style={{
            fontFamily: style.fontFamily,
            fontSize: `${fontSize}px`,
            padding: `${boxPad}px`,
            color: style.textColor,
            backgroundColor: `${style.bgColor}${bgAlpha}`,
            fontWeight: style.bold ? "bold" : "normal",
            fontStyle: style.italic ? "italic" : "normal",
            borderRadius: `${Math.max(1, Math.round(boxPad * 0.3))}px`,
          }}
        >
          {PREVIEW_SAMPLE_TEXT}
        </div>
      </div>

      {/* Safe zone indicator */}
      <div
        className="absolute left-0 right-0 border-t border-dashed border-red-500/30 z-5"
        style={{ bottom: "18%" }}
      />
      <span
        className="absolute text-[5px] text-red-400/50 z-5"
        style={{ bottom: "18.5%", right: 4 }}
      >
        IG UI
      </span>
    </div>
  );
}

export default function CaptionStyleModal({
  open,
  onOpenChange,
  captionStyle,
  onCaptionStyleChange,
  onTemplateSelect,
  onUndo,
  onReset,
  canUndo,
}: CaptionStyleModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Caption Style</DialogTitle>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onUndo}
                disabled={!canUndo}
                title="Undo style change"
              >
                <Undo2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1 text-xs"
                onClick={onReset}
                title="Reset to default style"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex gap-4">
          {/* Left: Reel preview */}
          <div className="shrink-0 flex flex-col items-center gap-2">
            <ReelPreview style={captionStyle} />
            <p className="text-[10px] text-muted-foreground text-center leading-tight">
              Live preview
            </p>
          </div>

          {/* Right: controls */}
          <div className="flex-1 space-y-4 min-w-0">
            {/* Template picker */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Template
              </label>
              <TemplatePicker onSelect={onTemplateSelect} />
            </div>

            <div className="h-px bg-border" />

            {/* Manual style editor */}
            <CaptionStyleEditor
              style={captionStyle}
              onChange={onCaptionStyleChange}
              compact
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
