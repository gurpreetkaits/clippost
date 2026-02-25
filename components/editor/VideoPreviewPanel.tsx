"use client";

import { useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import CaptionPreview from "@/components/CaptionPreview";
import { Button } from "@/components/ui/button";
import {
  Play,
  Pause,
  CheckCircle2,
  Download,
  Film,
} from "lucide-react";
import { CaptionStyle } from "@/lib/caption-style";
import PublishButton from "@/components/PublishButton";

const VideoPlayer = dynamic(() => import("@/components/VideoPlayer"), {
  ssr: false,
});

interface CaptionSegment {
  start: number;
  end: number;
  text: string;
}

interface VideoPreviewPanelProps {
  videoUrl: string;
  videoFilename: string;
  videoTitle: string;
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
  language: string;
}

export default function VideoPreviewPanel({
  videoUrl,
  videoFilename,
  videoTitle,
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
  language,
}: VideoPreviewPanelProps) {
  const generatedClipRef = useRef<HTMLDivElement>(null);
  const clipUrl = clipFilename ? `/api/video?file=${encodeURIComponent(clipFilename)}` : null;

  useEffect(() => {
    if (clipFilename && generatedClipRef.current) {
      generatedClipRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [clipFilename]);

  return (
    <>
      {/* Original Video with caption overlay */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Original</p>
        <div className="relative">
          <VideoPlayer
            url={videoUrl}
            start={start}
            end={end}
            playing={playing}
            onProgress={onProgress}
          />
          {captions.length > 0 && (
            <CaptionPreview
              captions={captions}
              currentTime={currentTime}
              style={captionStyle}
            />
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onPlayingChange(!playing)}
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {playing ? "Pause" : "Play Clip"}
          </Button>
          <span className="flex items-center text-xs text-muted-foreground font-mono">
            {formatTimestamp(start)} &ndash; {formatTimestamp(end)} ({Math.round(end - start)}s)
          </span>
        </div>
      </div>

      {/* Generated Clip */}
      <div className="space-y-2" ref={generatedClipRef}>
        <div className="flex items-center gap-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Generated Clip</p>
          {clipUrl && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
        </div>
        {clipUrl ? (
          <>
            <video
              src={clipUrl}
              controls
              className="w-full rounded-lg bg-black"
            />
            <div className="flex gap-2">
              <a
                href={clipUrl}
                download={`clip_${videoFilename}`}
                className="flex-1"
              >
                <Button variant="outline" size="sm" className="w-full">
                  <Download className="h-4 w-4 mr-1" />
                  Download
                </Button>
              </a>
              <div className="flex-1">
                <PublishButton
                  clipFilename={clipFilename!}
                  videoTitle={videoTitle}
                  clipDuration={end - start}
                  transcript={captions.map(c => c.text).join(" ")}
                  language={language}
                />
              </div>
            </div>
          </>
        ) : (
          <div className="aspect-video rounded-lg border-2 border-dashed border-muted-foreground/20 flex flex-col items-center justify-center bg-muted/30 gap-2">
            <Film className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground/50">
              {generating ? "Generating..." : "Your clip will appear here"}
            </p>
          </div>
        )}
      </div>
    </>
  );
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
