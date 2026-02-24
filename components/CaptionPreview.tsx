"use client";

import { useRef, useEffect, useState } from "react";
import { CaptionStyle } from "@/lib/caption-style";

interface CaptionSegment {
  start: number;
  end: number;
  text: string;
}

interface CaptionPreviewProps {
  captions: CaptionSegment[];
  currentTime: number;
  style?: CaptionStyle;
}

const POSITION_MAP = {
  top: "top-[6%]",
  center: "top-1/2 -translate-y-1/2",
  bottom: "bottom-[6%]",
};

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

  // Scale: fontSize is designed for 1080p, scale to actual container height
  const scale = containerHeight / 1080;

  if (!style) {
    const fallbackSize = Math.max(10, Math.round(48 * scale));
    return (
      <div ref={containerRef} className="absolute bottom-[6%] left-1/2 -translate-x-1/2 z-10 pointer-events-none">
        <div
          className="bg-black/65 text-white font-semibold rounded-lg text-center max-w-[80%] mx-auto"
          style={{
            fontSize: `${fallbackSize}px`,
            padding: `${Math.round(8 * scale)}px ${Math.round(16 * scale)}px`,
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
  const scaledPadX = Math.round(Math.max(4, style.fontSize * 0.35 * scale));
  const scaledPadY = Math.round(Math.max(2, style.fontSize * 0.2 * scale));

  return (
    <div
      ref={containerRef}
      className={`absolute left-1/2 -translate-x-1/2 z-10 pointer-events-none ${POSITION_MAP[style.position]}`}
    >
      <div
        className="rounded-lg text-center max-w-[85%] mx-auto"
        style={{
          fontFamily: style.fontFamily,
          fontSize: `${scaledFontSize}px`,
          padding: `${scaledPadY}px ${scaledPadX}px`,
          color: style.textColor,
          backgroundColor: `${style.bgColor}${bgAlpha}`,
          fontWeight: style.bold ? "bold" : "normal",
          fontStyle: style.italic ? "italic" : "normal",
        }}
      >
        {activeCaption.text}
      </div>
    </div>
  );
}
