"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import type { VideoPlayerHandle } from "@/components/VideoPlayer";
import CaptionPreview from "@/components/CaptionPreview";
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
import { VideoLayout, getFrameConfig } from "@/lib/video-layout";

const VideoPlayer = dynamic(() => import("@/components/VideoPlayer"), {
  ssr: false,
});

interface CaptionSegment {
  start: number;
  end: number;
  text: string;
}

interface TextOverlay {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
}

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
  generating: boolean;
  layout?: VideoLayout;
  textOverlays: TextOverlay[];
  onTextOverlayMove: (id: string, x: number, y: number) => void;
}

/* ---------- Draggable text overlay ---------- */

function DraggableOverlay({
  overlay,
  canvasRef,
  onMove,
}: {
  overlay: TextOverlay;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  onMove: (x: number, y: number) => void;
}) {
  const elRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragging.current = true;
    const el = elRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    offset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current || !canvasRef.current) return;
      const canvas = canvasRef.current.getBoundingClientRect();
      const x =
        ((e.clientX - canvas.left - offset.current.x) / canvas.width) * 100;
      const y =
        ((e.clientY - canvas.top - offset.current.y) / canvas.height) * 100;
      onMove(Math.max(0, Math.min(90, x)), Math.max(0, Math.min(90, y)));
    },
    [canvasRef, onMove]
  );

  const handlePointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  return (
    <div
      ref={elRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className="absolute cursor-grab active:cursor-grabbing select-none touch-none z-20 hover:ring-2 hover:ring-blue-400 hover:ring-offset-1 rounded px-2 py-1 transition-shadow"
      style={{
        left: `${overlay.x}%`,
        top: `${overlay.y}%`,
        fontSize: `${overlay.fontSize}px`,
        color: overlay.color,
        textShadow: "0 1px 4px rgba(0,0,0,0.8)",
        fontWeight: "bold",
      }}
    >
      {overlay.text}
    </div>
  );
}

/* ---------- Progress / scrub bar ---------- */

function ScrubBar({
  progress,
  onScrub,
  onScrubEnd,
}: {
  progress: number; // 0-1
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
      {/* Track bg */}
      <div className="absolute inset-x-0 h-1 group-hover:h-1.5 bg-white/20 rounded-full transition-all">
        {/* Filled */}
        <div
          className="absolute left-0 top-0 bottom-0 bg-white rounded-full transition-[width] duration-75"
          style={{ width: `${pct}%` }}
        />
      </div>
      {/* Thumb */}
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
  generating,
  layout,
  textOverlays,
  onTextOverlayMove,
}: VideoPreviewPanelProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<VideoPlayerHandle | null>(null);

  const clipUrl = clipFilename
    ? `/api/video?file=${encodeURIComponent(clipFilename)}`
    : null;
  const is916 = layout?.format === "9:16";
  const showingClip = !!clipUrl;
  const activeUrl = clipUrl || videoUrl;
  const activeStart = showingClip ? 0 : start;
  const activeEnd = showingClip ? end - start : end;
  const clipDuration = end - start;

  // Relative time for display/scrub (0 to clipDuration)
  const relativeTime = showingClip ? currentTime : currentTime - start;

  // Local scrub override for instant feedback
  const [scrubTime, setScrubTime] = useState<number | null>(null);
  const displayRelTime = scrubTime !== null ? scrubTime : relativeTime;

  // Volume & speed state
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Fullscreen tracking
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // --- Handlers ---

  const handleClickVideo = useCallback(() => {
    onPlayingChange(!playing);
  }, [playing, onPlayingChange]);

  const handleSkipBack = useCallback(() => {
    const t = showingClip ? 0 : start;
    playerRef.current?.seek(t);
    onProgress(t);
  }, [showingClip, start, onProgress]);

  const handleScrub = useCallback(
    (pct: number) => {
      const relT = pct * clipDuration;
      setScrubTime(relT);
      const absT = showingClip ? relT : start + relT;
      playerRef.current?.seek(absT);
    },
    [clipDuration, showingClip, start]
  );

  const handleScrubEnd = useCallback(() => {
    setScrubTime(null);
  }, []);

  const handleVolumeChange = useCallback(
    (v: number) => {
      setVolume(v);
      setMuted(v === 0);
      playerRef.current?.setVolume(v);
      playerRef.current?.setMuted(v === 0);
    },
    []
  );

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
      // Don't capture when typing in inputs
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
          const absT = showingClip ? t : start + t;
          playerRef.current?.seek(absT);
          onProgress(absT);
          break;
        }
        case "ArrowRight": {
          e.preventDefault();
          const t = Math.min(clipDuration, relativeTime + 5);
          const absT = showingClip ? t : start + t;
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
    start,
    onProgress,
    handleToggleMute,
    handleToggleFullscreen,
  ]);

  const progress = clipDuration > 0 ? displayRelTime / clipDuration : 0;

  return (
    <div
      ref={wrapperRef}
      className="flex flex-col items-center justify-center w-full h-full gap-2 px-2 sm:px-4 bg-neutral-950"
    >
      {/* Canvas area — video + overlays */}
      <div
        ref={canvasRef}
        className={`relative w-full overflow-hidden rounded-lg ${
          is916 && showingClip ? "max-w-sm mx-auto" : "max-w-full"
        }`}
        style={
          is916 && showingClip
            ? { aspectRatio: "9/16", maxHeight: "calc(100% - 80px)" }
            : { maxHeight: "calc(100% - 80px)" }
        }
      >
        {/* Video layer */}
        <div
          className={`relative w-full h-full ${is916 && showingClip ? "bg-black" : ""}`}
          style={
            is916 && showingClip && layout.frame !== "fill"
              ? {
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }
              : {}
          }
        >
          {is916 && showingClip && layout.frame !== "fill" ? (
            <div
              style={{
                width: `${getFrameConfig(layout.frame).videoWidthPct}%`,
                borderRadius: `${getFrameConfig(layout.frame).radiusPct}%`,
                overflow: "hidden",
              }}
            >
              <VideoPlayer
                key={clipFilename || "source"}
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
          ) : (
            <VideoPlayer
              key={clipFilename || "source"}
              url={activeUrl}
              start={activeStart}
              end={activeEnd}
              playing={playing}
              onProgress={onProgress}
              onClickVideo={handleClickVideo}
              fill={is916 && showingClip}
              playerRef={playerRef}
            />
          )}
        </div>

        {/* Caption overlay */}
        {!showingClip && captions.length > 0 && (
          <CaptionPreview
            captions={captions}
            currentTime={currentTime}
            style={captionStyle}
          />
        )}

        {/* Draggable text overlays */}
        {textOverlays.map((overlay) => (
          <DraggableOverlay
            key={overlay.id}
            overlay={overlay}
            canvasRef={canvasRef}
            onMove={(x, y) => onTextOverlayMove(overlay.id, x, y)}
          />
        ))}

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
        {/* Scrub bar */}
        <ScrubBar
          progress={progress}
          onScrub={handleScrub}
          onScrubEnd={handleScrubEnd}
        />

        {/* Buttons row */}
        <div className="flex items-center gap-0.5">
          {/* Skip back */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white/60 hover:text-white hover:bg-white/10"
            onClick={handleSkipBack}
          >
            <SkipBack className="h-4 w-4" />
          </Button>

          {/* Play / Pause */}
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

          {/* Timecode */}
          <span className="text-[11px] text-white/60 font-mono tabular-nums ml-1 select-none">
            {formatTimestamp(displayRelTime)}{" "}
            <span className="text-white/30">/</span>{" "}
            {formatTimestamp(clipDuration)}
          </span>

          {/* Spacer */}
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

          {/* Speed */}
          <button
            onClick={handleCycleSpeed}
            className="px-1.5 py-0.5 text-[11px] font-medium text-white/60 hover:text-white hover:bg-white/10 rounded transition-colors tabular-nums select-none"
          >
            {speed === 1 ? "1x" : `${speed}x`}
          </button>

          {/* Fullscreen */}
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
