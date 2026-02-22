"use client";

import { useState, useCallback, useEffect } from "react";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

interface ClipSelectorProps {
  duration: number;
  start: number;
  end: number;
  currentTime?: number;
  onStartChange: (value: number) => void;
  onEndChange: (value: number) => void;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function parseTime(input: string): number | null {
  const trimmed = input.trim();

  // Try MM:SS format
  const colonMatch = trimmed.match(/^(\d{1,2}):(\d{1,2})$/);
  if (colonMatch) {
    const mins = parseInt(colonMatch[1], 10);
    const secs = parseInt(colonMatch[2], 10);
    if (secs < 60) return mins * 60 + secs;
    return null;
  }

  // Try plain seconds
  const num = parseFloat(trimmed);
  if (!isNaN(num) && num >= 0) return num;

  return null;
}

export default function ClipSelector({
  duration,
  start,
  end,
  currentTime = 0,
  onStartChange,
  onEndChange,
}: ClipSelectorProps) {
  const clipDuration = end - start;
  const maxDuration = 90;
  const overLimit = clipDuration > maxDuration;

  const [startInput, setStartInput] = useState(formatTime(start));
  const [endInput, setEndInput] = useState(formatTime(end));

  // Sync text inputs when slider values change externally
  useEffect(() => {
    setStartInput(formatTime(start));
  }, [start]);

  useEffect(() => {
    setEndInput(formatTime(end));
  }, [end]);

  const handleSliderChange = useCallback(
    (values: number[]) => {
      onStartChange(values[0]);
      onEndChange(values[1]);
    },
    [onStartChange, onEndChange]
  );

  const handleStartInputCommit = useCallback(() => {
    const parsed = parseTime(startInput);
    if (parsed !== null && parsed >= 0 && parsed < end && parsed <= duration) {
      onStartChange(parsed);
    } else {
      setStartInput(formatTime(start));
    }
  }, [startInput, start, end, duration, onStartChange]);

  const handleEndInputCommit = useCallback(() => {
    const parsed = parseTime(endInput);
    if (parsed !== null && parsed > start && parsed <= duration) {
      onEndChange(parsed);
    } else {
      setEndInput(formatTime(end));
    }
  }, [endInput, start, end, duration, onEndChange]);

  const handleInputKeyDown = (
    e: React.KeyboardEvent,
    commit: () => void
  ) => {
    if (e.key === "Enter") {
      commit();
    }
  };

  const playheadPercent =
    duration > 0 ? ((currentTime - 0) / duration) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">Clip Range</span>
        <Badge
          variant={overLimit ? "destructive" : "outline"}
          className="font-mono text-xs"
        >
          {formatTime(clipDuration)} / {formatTime(maxDuration)} max
        </Badge>
      </div>

      {/* Timestamp inputs row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="clip-start" className="text-xs text-muted-foreground">
            Start
          </Label>
          <Input
            id="clip-start"
            value={startInput}
            onChange={(e) => setStartInput(e.target.value)}
            onBlur={handleStartInputCommit}
            onKeyDown={(e) => handleInputKeyDown(e, handleStartInputCommit)}
            placeholder="0:00"
            className="font-mono text-sm h-9"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="clip-end" className="text-xs text-muted-foreground">
            End
          </Label>
          <Input
            id="clip-end"
            value={endInput}
            onChange={(e) => setEndInput(e.target.value)}
            onBlur={handleEndInputCommit}
            onKeyDown={(e) => handleInputKeyDown(e, handleEndInputCommit)}
            placeholder="0:30"
            className="font-mono text-sm h-9"
          />
        </div>
      </div>

      {/* Dual-thumb slider with playhead */}
      <div className="relative py-2">
        <Slider
          min={0}
          max={duration}
          step={0.5}
          value={[start, end]}
          onValueChange={handleSliderChange}
          minStepsBetweenThumbs={1}
        />

        {/* Playhead indicator */}
        {duration > 0 && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white/80 pointer-events-none z-10"
            style={{ left: `${playheadPercent}%` }}
          />
        )}
      </div>

      {/* Time markers */}
      <div className="flex justify-between text-xs text-muted-foreground font-mono">
        <span>0:00</span>
        <span>{formatTime(duration)}</span>
      </div>

      {/* Over-limit alert */}
      {overLimit && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Clip exceeds Instagram Reels maximum of 90 seconds. Please shorten
            your selection.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
