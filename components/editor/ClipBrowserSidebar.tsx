"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, Clock, Sparkles, Film, Instagram, Youtube } from "lucide-react";

export interface SidebarClip {
  id: string;
  filename: string;
  startTime: number;
  endTime: number;
  duration: number;
  method: "MANUAL" | "AUTO_TRIM";
  publishedAt: string | null;
  instagramMediaId: string | null;
  youtubeVideoId: string | null;
  hasCaptions: boolean;
}

interface ClipBrowserSidebarProps {
  clips: SidebarClip[];
  loading: boolean;
  activeClipId: string | null;
  onSelectClip: (clip: SidebarClip) => void;
  onNewClip: () => void;
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function ClipCard({
  clip,
  active,
  onClick,
}: {
  clip: SidebarClip;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-lg border p-3 transition-all hover:bg-muted/50 ${
        active
          ? "ring-2 ring-primary border-primary bg-primary/5"
          : "border-border"
      }`}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <Badge variant="outline" className="text-[10px] gap-0.5 px-1.5 py-0">
          <Clock className="h-2.5 w-2.5" />
          {formatTimestamp(clip.startTime)}&ndash;{formatTimestamp(clip.endTime)}
        </Badge>
        <Badge variant="secondary" className="text-[10px] gap-0.5 px-1.5 py-0">
          {clip.method === "AUTO_TRIM" ? (
            <Sparkles className="h-2.5 w-2.5" />
          ) : (
            <Film className="h-2.5 w-2.5" />
          )}
          {clip.method === "AUTO_TRIM" ? "Auto" : "Manual"}
        </Badge>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">
          {Math.round(clip.duration)}s
        </span>
        {clip.publishedAt && clip.instagramMediaId && (
          <Instagram className="h-3 w-3 text-pink-500" />
        )}
        {clip.youtubeVideoId && (
          <Youtube className="h-3 w-3 text-red-500" />
        )}
      </div>
    </button>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-lg border border-border p-3 animate-pulse">
          <div className="h-3 w-20 bg-muted rounded mb-2" />
          <div className="h-3 w-12 bg-muted rounded" />
        </div>
      ))}
    </div>
  );
}

export default function ClipBrowserSidebar({
  clips,
  loading,
  activeClipId,
  onSelectClip,
  onNewClip,
}: ClipBrowserSidebarProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Clips
        </p>
        <Button variant="ghost" size="sm" onClick={onNewClip} className="h-7 text-xs gap-1">
          <Plus className="h-3 w-3" />
          New
        </Button>
      </div>

      {loading ? (
        <LoadingSkeleton />
      ) : clips.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-muted-foreground/60 text-center px-2">
            No clips yet. Generate your first clip to see it here.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {clips.map((clip) => (
            <ClipCard
              key={clip.id}
              clip={clip}
              active={clip.id === activeClipId}
              onClick={() => onSelectClip(clip)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function ClipBrowserStrip({
  clips,
  loading,
  activeClipId,
  onSelectClip,
  onNewClip,
}: ClipBrowserSidebarProps) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2">
      <Button variant="outline" size="sm" onClick={onNewClip} className="shrink-0 h-8 text-xs gap-1">
        <Plus className="h-3 w-3" />
        New Clip
      </Button>
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : (
        clips.map((clip) => (
          <button
            key={clip.id}
            onClick={() => onSelectClip(clip)}
            className={`shrink-0 rounded-md border px-3 py-1.5 text-xs transition-all ${
              clip.id === activeClipId
                ? "ring-2 ring-primary border-primary bg-primary/5"
                : "border-border hover:bg-muted/50"
            }`}
          >
            {formatTimestamp(clip.startTime)}&ndash;{formatTimestamp(clip.endTime)}
            <span className="text-muted-foreground ml-1">({Math.round(clip.duration)}s)</span>
          </button>
        ))
      )}
    </div>
  );
}
