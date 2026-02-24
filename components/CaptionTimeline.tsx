"use client";

import { useRef, useCallback, useState, useEffect } from "react";

interface CaptionSegment {
  start: number;
  end: number;
  text: string;
  words?: { word: string; start: number; end: number }[];
}

interface CaptionTimelineProps {
  segments: CaptionSegment[];
  clipStart: number;
  clipEnd: number;
  currentTime: number;
  selectedIndex: number | null;
  onSelectSegment: (index: number | null) => void;
  onSegmentTimingChange: (index: number, edge: "start" | "end", newTime: number) => void;
}

const COLORS = [
  "bg-blue-500/70",
  "bg-indigo-500/70",
  "bg-purple-500/70",
  "bg-teal-500/70",
  "bg-sky-500/70",
  "bg-violet-500/70",
];

const SELECTED_RING = "ring-2 ring-white ring-offset-1 ring-offset-neutral-900";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function CaptionTimeline({
  segments,
  clipStart,
  clipEnd,
  currentTime,
  selectedIndex,
  onSelectSegment,
  onSegmentTimingChange,
}: CaptionTimelineProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<{
    index: number;
    edge: "start" | "end";
  } | null>(null);

  const clipDuration = clipEnd - clipStart;
  if (clipDuration <= 0) return null;

  const toPercent = (time: number) =>
    ((time - clipStart) / clipDuration) * 100;

  const toTime = (clientX: number) => {
    const bar = barRef.current;
    if (!bar) return clipStart;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return clipStart + ratio * clipDuration;
  };

  // Playhead position
  const playheadPercent = Math.max(0, Math.min(100, toPercent(currentTime)));

  // Time markers
  const markerCount = Math.max(2, Math.min(10, Math.floor(clipDuration / 5)));
  const markerInterval = clipDuration / markerCount;
  const markers: number[] = [];
  for (let i = 0; i <= markerCount; i++) {
    markers.push(clipStart + i * markerInterval);
  }

  // Drag handlers
  const handlePointerDown = useCallback(
    (e: React.PointerEvent, index: number, edge: "start" | "end") => {
      e.stopPropagation();
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      setDragging({ index, edge });
    },
    []
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      const newTime = toTime(e.clientX);
      const seg = segments[dragging.index];
      if (!seg) return;

      // Clamp so start < end with at least 0.2s gap
      if (dragging.edge === "start") {
        const clamped = Math.max(clipStart, Math.min(newTime, seg.end - 0.2));
        onSegmentTimingChange(dragging.index, "start", Math.round(clamped * 10) / 10);
      } else {
        const clamped = Math.min(clipEnd, Math.max(newTime, seg.start + 0.2));
        onSegmentTimingChange(dragging.index, "end", Math.round(clamped * 10) / 10);
      }
    },
    [dragging, segments, clipStart, clipEnd, onSegmentTimingChange]
  );

  const handlePointerUp = useCallback(() => {
    setDragging(null);
  }, []);

  return (
    <div className="w-full space-y-1">
      {/* Timeline bar */}
      <div
        ref={barRef}
        className="relative h-12 bg-neutral-800 rounded-lg overflow-hidden cursor-pointer select-none"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onClick={(e) => {
          // Click empty space to deselect
          if ((e.target as HTMLElement) === barRef.current) {
            onSelectSegment(null);
          }
        }}
      >
        {/* Segment blocks */}
        {segments.map((seg, i) => {
          const left = Math.max(0, toPercent(seg.start));
          const right = Math.min(100, toPercent(seg.end));
          const width = right - left;
          if (width <= 0) return null;

          const isSelected = selectedIndex === i;
          const color = COLORS[i % COLORS.length];

          return (
            <div
              key={i}
              className={`absolute top-1 bottom-1 rounded cursor-pointer flex items-center overflow-hidden transition-shadow ${color} ${
                isSelected ? SELECTED_RING : "hover:brightness-110"
              }`}
              style={{ left: `${left}%`, width: `${width}%` }}
              onClick={(e) => {
                e.stopPropagation();
                onSelectSegment(isSelected ? null : i);
              }}
            >
              {/* Drag handle: left edge */}
              <div
                className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-white/30 z-10"
                onPointerDown={(e) => handlePointerDown(e, i, "start")}
              />
              {/* Caption text (only when wide enough) */}
              {width > 8 && (
                <span className="px-2 text-[10px] text-white/90 truncate pointer-events-none select-none">
                  {seg.text}
                </span>
              )}
              {/* Drag handle: right edge */}
              <div
                className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-white/30 z-10"
                onPointerDown={(e) => handlePointerDown(e, i, "end")}
              />
            </div>
          );
        })}

        {/* Playhead */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20 pointer-events-none"
          style={{ left: `${playheadPercent}%` }}
        >
          <div className="absolute -top-0.5 -left-1 w-2.5 h-2.5 bg-red-500 rounded-full" />
        </div>
      </div>

      {/* Time markers */}
      <div className="relative h-4">
        {markers.map((time, i) => (
          <span
            key={i}
            className="absolute text-[10px] text-muted-foreground -translate-x-1/2"
            style={{ left: `${toPercent(time)}%` }}
          >
            {formatTime(time)}
          </span>
        ))}
      </div>
    </div>
  );
}
