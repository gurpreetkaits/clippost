"use client";

import { useRef, useEffect, useState } from "react";
import { CaptionStyle } from "@/lib/caption-style";
import type { CaptionSegment } from "@/lib/types/editor";

interface CaptionPreviewProps {
  captions: CaptionSegment[];
  currentTime: number;
  style?: CaptionStyle;
}

/**
 * Position config matching ASS export margins:
 *  - bottom: marginV = 22% from bottom edge
 *  - top:    marginV =  6% from top edge
 *  - center: vertically centered
 */
interface PosConfig {
  anchor: "top" | "bottom" | "center";
  marginPct: number;
}

const POSITION_CONFIG: Record<string, PosConfig> = {
  top:    { anchor: "top",    marginPct: 6 },
  center: { anchor: "center", marginPct: 0 },
  bottom: { anchor: "bottom", marginPct: 22 },
  custom: { anchor: "bottom", marginPct: 22 },
};

function getPosStyle(position: string): React.CSSProperties {
  const config = POSITION_CONFIG[position] ?? POSITION_CONFIG.bottom;
  const css: React.CSSProperties = { left: "50%", position: "absolute" };
  if (config.anchor === "bottom") {
    css.bottom = `${config.marginPct}%`;
    css.transform = "translateX(-50%)";
  } else if (config.anchor === "top") {
    css.top = `${config.marginPct}%`;
    css.transform = "translateX(-50%)";
  } else {
    css.top = "50%";
    css.transform = "translate(-50%, -50%)";
  }
  return css;
}

export default function CaptionPreview({
  captions,
  currentTime,
  style,
}: CaptionPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(360);

  useEffect(() => {
    const el = containerRef.current?.parentElement;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height);
      }
    });
    obs.observe(el);
    setContainerHeight(el.clientHeight);
    return () => obs.disconnect();
  }, []);

  const activeCaption = captions.find(
    (c) => currentTime >= c.start && currentTime <= c.end
  );

  if (!activeCaption) return <div ref={containerRef} className="hidden" />;

  const scale = containerHeight / 1080;

  if (!style) {
    const fallbackSize = Math.max(10, Math.round(42 * scale));
    const fallbackPad = Math.max(3, Math.round(42 * 0.5 * scale));
    return (
      <div ref={containerRef} className="z-10 pointer-events-none" style={{ ...getPosStyle("bottom"), position: "absolute" }}>
        <div
          className="bg-black/65 text-white font-semibold text-center max-w-[80%] mx-auto"
          style={{
            fontSize: `${fallbackSize}px`,
            padding: `${fallbackPad}px`,
            borderRadius: `${Math.max(2, Math.round(fallbackPad * 0.3))}px`,
          }}
        >
          {activeCaption.text}
        </div>
      </div>
    );
  }

  const bgAlpha = Math.round((style.bgOpacity / 100) * 255)
    .toString(16)
    .padStart(2, "0");

  const scaledFontSize = Math.max(10, Math.round(style.fontSize * scale));
  const scaledBoxPad = Math.max(3, Math.round(style.fontSize * 0.5 * scale));

  return (
    <div
      ref={containerRef}
      className="z-10 pointer-events-none"
      style={{ ...getPosStyle(style.position), position: "absolute" }}
    >
      <div
        className="text-center max-w-[85%] mx-auto"
        style={{
          fontFamily: style.fontFamily,
          fontSize: `${scaledFontSize}px`,
          padding: `${scaledBoxPad}px`,
          color: style.textColor,
          backgroundColor: `${style.bgColor}${bgAlpha}`,
          fontWeight: style.bold ? "bold" : "normal",
          fontStyle: style.italic ? "italic" : "normal",
          borderRadius: `${Math.max(2, Math.round(scaledBoxPad * 0.3))}px`,
        }}
      >
        {activeCaption.text}
      </div>
    </div>
  );
}
