"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import type { VideoPlayerHandle } from "@/components/VideoPlayer";
import { Button } from "@/components/ui/button";
import {
  Play,
  Pause,
  SkipBack,
  Maximize2,
  Minimize2,
  Volume2,
  Volume1,
  VolumeX,
} from "lucide-react";
import { CaptionStyle } from "@/lib/caption-style";
import type { CaptionSegment } from "@/lib/types/editor";

const VideoPlayer = dynamic(() => import("@/components/VideoPlayer"), {
  ssr: false,
});

interface VideoPreviewPanelProps {
  videoUrl: string;
  start: number;
  end: number;
  playing: boolean;
  currentTime: number;
  onPlayingChange: (playing: boolean) => void;
  onProgress: (time: number) => void;
  captions: CaptionSegment[];
  captionStyle: CaptionStyle;
  clipFilename: string | null;
  enhancedFilename: string | null;
  gradedFilename: string | null;
  generating: boolean;
}

/* ---------- Caption position helpers (mirrors ASS export) ---------- */

/**
 * ASS alignment + marginV mapping:
 *  - alignment 2 (bottom-center): marginV = 22% from bottom edge
 *  - alignment 8 (top-center):    marginV =  6% from top edge
 *  - alignment 5 (center):        vertically centered
 *
 * anchor tells us which edge marginPct is measured from.
 */
interface CaptionPosConfig {
  anchor: "top" | "bottom" | "center";
  marginPct: number; // distance from the anchor edge as %
}

const POSITION_CONFIG: Record<string, CaptionPosConfig> = {
  top:    { anchor: "top",    marginPct: 6 },
  center: { anchor: "center", marginPct: 0 },
  bottom: { anchor: "bottom", marginPct: 22 },
  custom: { anchor: "bottom", marginPct: 22 },
};

function getCaptionPosStyle(style: CaptionStyle): React.CSSProperties {
  const config = POSITION_CONFIG[style.position] ?? POSITION_CONFIG.bottom;
  const css: React.CSSProperties = { left: "50%" };

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

/* ---------- Progress / scrub bar ---------- */

function ScrubBar({
  progress,
  onScrub,
  onScrubEnd,
}: {
  progress: number;
  onScrub: (pct: number) => void;
  onScrubEnd: () => void;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const scrubbing = useRef(false);

  const calcPct = useCallback((e: React.PointerEvent) => {
    if (!barRef.current) return 0;
    const rect = barRef.current.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      scrubbing.current = true;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      onScrub(calcPct(e));
    },
    [calcPct, onScrub]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!scrubbing.current) return;
      onScrub(calcPct(e));
    },
    [calcPct, onScrub]
  );

  const handlePointerUp = useCallback(() => {
    scrubbing.current = false;
    onScrubEnd();
  }, [onScrubEnd]);

  const pct = Math.max(0, Math.min(100, progress * 100));

  return (
    <div
      ref={barRef}
      className="group relative w-full h-5 flex items-center cursor-pointer touch-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <div className="absolute inset-x-0 h-1 group-hover:h-1.5 bg-white/20 rounded-full transition-all">
        <div
          className="absolute left-0 top-0 bottom-0 bg-white rounded-full transition-[width] duration-75"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div
        className="absolute h-3 w-3 bg-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity -translate-x-1/2 -translate-y-1/2 top-1/2 pointer-events-none"
        style={{ left: `${pct}%` }}
      />
    </div>
  );
}

/* ---------- Speed picker ---------- */

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

/* ---------- Main component ---------- */

export default function VideoPreviewPanel({
  videoUrl,
  start,
  end,
  playing,
  currentTime,
  onPlayingChange,
  onProgress,
  captions,
  captionStyle,
  clipFilename,
  enhancedFilename,
  gradedFilename,
  generating,
}: VideoPreviewPanelProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<VideoPlayerHandle | null>(null);

  const clipUrl = clipFilename
    ? `/api/video?file=${encodeURIComponent(clipFilename)}`
    : null;
  const enhancedUrl = enhancedFilename
    ? `/api/video?file=${encodeURIComponent(enhancedFilename)}`
    : null;
  const gradedUrl = gradedFilename
    ? `/api/video?file=${encodeURIComponent(gradedFilename)}`
    : null;

  const showingClip = !!clipUrl;
  const showingProcessed = !showingClip && !!(enhancedUrl || gradedUrl);
  const activeUrl = clipUrl || enhancedUrl || gradedUrl || videoUrl;
  const activeStart = showingClip || showingProcessed ? 0 : start;
  const activeEnd = showingClip || showingProcessed ? end - start : end;
  const clipDuration = end - start;

  const relativeTime = showingClip || showingProcessed ? currentTime : currentTime - start;

  const [scrubTime, setScrubTime] = useState<number | null>(null);
  const displayRelTime = scrubTime !== null ? scrubTime : relativeTime;

  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [containerHeight, setContainerHeight] = useState(360);

  useEffect(() => {
    const el = canvasRef.current;
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

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const activeCaption = captions.find(
    (c) => currentTime >= c.start && currentTime <= c.end
  );

  const handleClickVideo = useCallback(() => {
    onPlayingChange(!playing);
  }, [playing, onPlayingChange]);

  const handleSkipBack = useCallback(() => {
    const t = showingClip || showingProcessed ? 0 : start;
    playerRef.current?.seek(t);
    onProgress(t);
  }, [showingClip, showingProcessed, start, onProgress]);

  const handleScrub = useCallback(
    (pct: number) => {
      const relT = pct * clipDuration;
      setScrubTime(relT);
      const absT = showingClip || showingProcessed ? relT : start + relT;
      playerRef.current?.seek(absT);
    },
    [clipDuration, showingClip, showingProcessed, start]
  );

  const handleScrubEnd = useCallback(() => {
    setScrubTime(null);
  }, []);

  const handleVolumeChange = useCallback((v: number) => {
    setVolume(v);
    setMuted(v === 0);
    playerRef.current?.setVolume(v);
    playerRef.current?.setMuted(v === 0);
  }, []);

  const handleToggleMute = useCallback(() => {
    const next = !muted;
    setMuted(next);
    playerRef.current?.setMuted(next);
  }, [muted]);

  const handleCycleSpeed = useCallback(() => {
    const idx = SPEEDS.indexOf(speed);
    const next = SPEEDS[(idx + 1) % SPEEDS.length];
    setSpeed(next);
    playerRef.current?.setPlaybackRate(next);
  }, [speed]);

  const handleToggleFullscreen = useCallback(() => {
    if (!wrapperRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      wrapperRef.current.requestFullscreen();
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      switch (e.key) {
        case " ":
          e.preventDefault();
          onPlayingChange(!playing);
          break;
        case "ArrowLeft": {
          e.preventDefault();
          const t = Math.max(0, relativeTime - 5);
          const absT = showingClip || showingProcessed ? t : start + t;
          playerRef.current?.seek(absT);
          onProgress(absT);
          break;
        }
        case "ArrowRight": {
          e.preventDefault();
          const t = Math.min(clipDuration, relativeTime + 5);
          const absT = showingClip || showingProcessed ? t : start + t;
          playerRef.current?.seek(absT);
          onProgress(absT);
          break;
        }
        case "m":
        case "M":
          handleToggleMute();
          break;
        case "f":
        case "F":
          handleToggleFullscreen();
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    playing,
    onPlayingChange,
    relativeTime,
    clipDuration,
    showingClip,
    showingProcessed,
    start,
    onProgress,
    handleToggleMute,
    handleToggleFullscreen,
  ]);

  const progress = clipDuration > 0 ? displayRelTime / clipDuration : 0;

  // Caption styling — matches ASS export: fontSize at 1080p, boxPad = fontSize*0.5
  const scale = containerHeight / 1080;
  const captionPosStyle = getCaptionPosStyle(captionStyle);

  const bgAlpha = Math.round((captionStyle.bgOpacity / 100) * 255)
    .toString(16)
    .padStart(2, "0");
  const scaledFontSize = Math.max(10, Math.round(captionStyle.fontSize * scale));
  // ASS BorderStyle 3 uses Outline value as box padding (= fontSize * 0.5)
  const scaledBoxPad = Math.max(3, Math.round(captionStyle.fontSize * 0.5 * scale));

  return (
    <div
      ref={wrapperRef}
      className="flex flex-col items-center justify-center w-full h-full gap-2 px-2 sm:px-4 bg-neutral-950"
    >
      {/* Canvas area */}
      <div
        ref={canvasRef}
        className="relative w-full overflow-hidden rounded-lg max-w-full"
        style={{ maxHeight: "calc(100% - 80px)" }}
      >
        {/* Video layer */}
        <div className="relative w-full h-full">
          <VideoPlayer
            key={clipFilename || enhancedFilename || gradedFilename || "source"}
            url={activeUrl}
            start={activeStart}
            end={activeEnd}
            playing={playing}
            onProgress={onProgress}
            onClickVideo={handleClickVideo}
            fill={false}
            playerRef={playerRef}
          />
        </div>

        {/* Caption overlay — mirrors ASS export positioning & styling */}
        {!showingClip && activeCaption && (
          <div
            className="absolute pointer-events-none z-10"
            style={captionPosStyle}
          >
            <div
              className="text-center whitespace-nowrap"
              style={{
                fontFamily: captionStyle.fontFamily,
                fontSize: `${scaledFontSize}px`,
                padding: `${scaledBoxPad}px`,
                color: captionStyle.textColor,
                backgroundColor: `${captionStyle.bgColor}${bgAlpha}`,
                fontWeight: captionStyle.bold ? "bold" : "normal",
                fontStyle: captionStyle.italic ? "italic" : "normal",
                borderRadius: `${Math.max(2, Math.round(scaledBoxPad * 0.3))}px`,
              }}
            >
              {activeCaption.text}
            </div>
          </div>
        )}

        {/* Generating overlay */}
        {generating && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-lg z-30">
            <div className="flex items-center gap-2 text-white text-sm">
              <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Generating clip...
            </div>
          </div>
        )}
      </div>

      {/* Custom controls */}
      <div className="w-full max-w-3xl shrink-0 space-y-0.5">
        <ScrubBar
          progress={progress}
          onScrub={handleScrub}
          onScrubEnd={handleScrubEnd}
        />

        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white/60 hover:text-white hover:bg-white/10"
            onClick={handleSkipBack}
          >
            <SkipBack className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-white hover:bg-white/10"
            onClick={() => onPlayingChange(!playing)}
          >
            {playing ? (
              <Pause className="h-5 w-5" />
            ) : (
              <Play className="h-5 w-5 ml-0.5" />
            )}
          </Button>

          <span className="text-[11px] text-white/60 font-mono tabular-nums ml-1 select-none">
            {formatTimestamp(displayRelTime)}{" "}
            <span className="text-white/30">/</span>{" "}
            {formatTimestamp(clipDuration)}
          </span>

          <div className="flex-1" />

          {/* Volume */}
          <div className="flex items-center gap-1 group/vol">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-white/60 hover:text-white hover:bg-white/10"
              onClick={handleToggleMute}
            >
              {muted || volume === 0 ? (
                <VolumeX className="h-4 w-4" />
              ) : volume < 0.5 ? (
                <Volume1 className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </Button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={muted ? 0 : volume}
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              className="w-0 group-hover/vol:w-16 transition-all duration-200 h-1 cursor-pointer appearance-none bg-white/20 rounded-full overflow-hidden [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-sm"
            />
          </div>

          <button
            onClick={handleCycleSpeed}
            className="px-1.5 py-0.5 text-[11px] font-medium text-white/60 hover:text-white hover:bg-white/10 rounded transition-colors tabular-nums select-none"
          >
            {speed === 1 ? "1x" : `${speed}x`}
          </button>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white/60 hover:text-white hover:bg-white/10"
            onClick={handleToggleFullscreen}
          >
            {isFullscreen ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function formatTimestamp(seconds: number): string {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}
