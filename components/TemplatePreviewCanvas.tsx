"use client";

import { ReelTemplate } from "@/lib/caption-template";

interface TemplatePreviewCanvasProps {
  template: ReelTemplate;
}

const SAMPLE_TEXT = "This is how your captions will look";

export default function TemplatePreviewCanvas({
  template: t,
}: TemplatePreviewCanvasProps) {
  const zoneStyles: Record<string, React.CSSProperties> = {
    "top-left": { top: "8%", left: "5%", textAlign: "left" },
    "top-center": { top: "8%", left: "50%", transform: "translateX(-50%)", textAlign: "center" },
    "top-right": { top: "8%", right: "5%", textAlign: "right" },
    "center-left": { top: "50%", left: "5%", transform: "translateY(-50%)", textAlign: "left" },
    center: { top: "50%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center" },
    "center-right": { top: "50%", right: "5%", transform: "translateY(-50%)", textAlign: "right" },
    "bottom-left": { bottom: "8%", left: "5%", textAlign: "left" },
    "bottom-center": { bottom: "8%", left: "50%", transform: "translateX(-50%)", textAlign: "center" },
    "bottom-right": { bottom: "8%", right: "5%", textAlign: "right" },
  };

  const posStyle: React.CSSProperties =
    t.posX !== null && t.posY !== null
      ? {
          position: "absolute",
          left: `${t.posX}%`,
          top: `${t.posY}%`,
          transform: "translate(-50%, -50%)",
          textAlign: "center",
        }
      : { position: "absolute", ...zoneStyles[t.zone] };

  const displayText =
    t.textTransform === "uppercase"
      ? SAMPLE_TEXT.toUpperCase()
      : t.textTransform === "lowercase"
        ? SAMPLE_TEXT.toLowerCase()
        : SAMPLE_TEXT;

  // Scale font size for preview (preview is ~270px wide representing 1080px)
  const scaleFactor = 0.25;
  const previewFontSize = Math.max(8, Math.round(t.fontSize * scaleFactor));

  const isBox = t.borderStyle === "box";

  const textStyle: React.CSSProperties = {
    fontFamily: t.fontFamily,
    fontSize: `${previewFontSize}px`,
    fontWeight: t.bold ? "bold" : "normal",
    fontStyle: t.italic ? "italic" : "normal",
    textDecoration: t.underline ? "underline" : "none",
    color: t.textColor,
    letterSpacing: `${t.letterSpacing * scaleFactor}px`,
    transform: t.scaleX !== 100 ? `scaleX(${t.scaleX / 100})` : undefined,
    maxWidth: `${t.maxWidth}%`,
    lineHeight: 1.4,
    padding: isBox ? `${Math.round(previewFontSize * 0.3)}px ${Math.round(previewFontSize * 0.5)}px` : "0",
    backgroundColor:
      isBox && t.bgOpacity > 0
        ? hexToRgba(t.bgColor, t.bgOpacity)
        : "transparent",
    borderRadius: isBox ? "4px" : "0",
    WebkitTextStroke:
      !isBox && t.outlineWidth > 0
        ? `${Math.max(1, Math.round(t.outlineWidth * scaleFactor))}px ${t.shadowColor}`
        : undefined,
    textShadow:
      !isBox && t.shadowDistance > 0
        ? `${t.shadowDistance}px ${t.shadowDistance}px 0 ${t.shadowColor}`
        : undefined,
    wordBreak: "break-word",
  };

  return (
    <div className="relative w-full aspect-[9/16] bg-zinc-900 rounded-lg overflow-hidden border border-border">
      {/* Background gradient for realism */}
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-800/50 via-transparent to-zinc-800/50" />

      {/* Sample video content placeholder */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-zinc-700 text-xs">9:16 Preview</div>
      </div>

      {/* Caption text */}
      <div style={posStyle}>
        <span style={textStyle}>{displayText}</span>
      </div>
    </div>
  );
}

function hexToRgba(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity / 100})`;
}
