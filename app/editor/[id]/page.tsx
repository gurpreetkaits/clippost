"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import dynamic from "next/dynamic";
import CaptionStyleEditor from "@/components/CaptionStyleEditor";
import PublishButton from "@/components/PublishButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  ArrowLeft,
  Play,
  Pause,
  AlertCircle,
  Download,
  RefreshCw,
  Film,
  CheckCircle2,
} from "lucide-react";
import { CaptionStyle, DEFAULT_CAPTION_STYLE } from "@/lib/caption-style";
import {
  VideoLayout,
  DEFAULT_LAYOUT,
  ASPECT_RATIOS,
  MASKS,
  getMaskCSS,
  getAspectCSS,
} from "@/lib/video-layout";

const VideoPlayer = dynamic(() => import("@/components/VideoPlayer"), {
  ssr: false,
});

interface ClipData {
  id: string;
  filename: string;
  startTime: number;
  endTime: number;
  captionStyle: CaptionStyle | null;
  video: {
    filename: string;
    title: string;
    duration: number;
    fileExists: boolean;
  } | null;
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function ClipEditorPage() {
  const router = useRouter();
  const params = useParams();
  const clipId = params.id as string;

  // Loading / error
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Clip data from API
  const [clip, setClip] = useState<ClipData | null>(null);
  const [clipFilename, setClipFilename] = useState("");

  // Editor state
  const [captionStyle, setCaptionStyle] = useState<CaptionStyle>(DEFAULT_CAPTION_STYLE);
  const [layout, setLayout] = useState<VideoLayout>(DEFAULT_LAYOUT);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [generating, setGenerating] = useState(false);

  // Fetch clip on mount
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const r = await fetch(`/api/clips/${clipId}`);
        if (!r.ok) throw new Error("Clip not found");
        const data = await r.json();
        if (cancelled) return;

        setClip(data);
        setClipFilename(data.filename);
        if (data.captionStyle) {
          setCaptionStyle(data.captionStyle as CaptionStyle);
        }
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load clip");
          setLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [clipId]);

  const clipDuration = clip ? clip.endTime - clip.startTime : 0;

  const videoContainerRef = useRef<HTMLDivElement>(null);

  const handleRegenerateClip = useCallback(async () => {
    if (!clip?.video) return;
    setGenerating(true);
    setError("");

    try {
      const response = await fetch("/api/clip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: clip.video.filename,
          start: clip.startTime,
          end: clip.endTime,
          captions: [],
          style: captionStyle,
          layout,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Clip generation failed");
      }
      setClipFilename(data.clipFilename);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Clip generation failed");
    } finally {
      setGenerating(false);
    }
  }, [clip, captionStyle, layout]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Error / not found
  if (!clip) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Film className="h-12 w-12 text-muted-foreground/40 mx-auto" />
          <p className="text-muted-foreground">{error || "Clip not found."}</p>
          <Button variant="ghost" onClick={() => router.push("/clips")}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to clips
          </Button>
        </div>
      </div>
    );
  }

  const clipUrl = `/api/video?file=${encodeURIComponent(clipFilename)}`;
  const videoTitle = clip.video?.title || "Untitled";

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 p-4 md:p-6">
        <div className="max-w-7xl mx-auto space-y-4">
          {/* Header */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/clips")}
              className="text-muted-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <h1 className="text-lg font-semibold text-foreground truncate flex-1">
              {videoTitle}
            </h1>
            <Badge variant="secondary" className="shrink-0">
              Experimental
            </Badge>
          </div>

          {/* Source video missing notice */}
          {clip.video && !clip.video.fileExists && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Source video is no longer on disk. Re-download the original video to transcribe or regenerate this clip.
              </AlertDescription>
            </Alert>
          )}

          {/* Two-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-6">
            {/* LEFT: Video player */}
            <div className="lg:sticky lg:top-4 lg:self-start space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Clip Preview
                  </p>
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                </div>
                <div
                  ref={videoContainerRef}
                  className="relative mx-auto bg-black"
                  style={{
                    ...(getAspectCSS(layout.aspectRatio)
                      ? { aspectRatio: getAspectCSS(layout.aspectRatio), maxHeight: "65vh" }
                      : {}),
                    overflow: "hidden",
                    ...getMaskCSS(layout.mask),
                  }}
                >
                  <VideoPlayer
                    key={clipFilename}
                    url={clipUrl}
                    start={0}
                    end={clipDuration}
                    playing={playing}
                    onProgress={setCurrentTime}
                    style={
                      getAspectCSS(layout.aspectRatio)
                        ? { objectFit: "cover" as const, width: "100%", height: "100%" }
                        : undefined
                    }
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPlaying(!playing)}
                >
                  {playing ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  {playing ? "Pause" : "Play"}
                </Button>
                <span className="flex items-center text-xs text-muted-foreground">
                  {formatTimestamp(clip.startTime)} &ndash;{" "}
                  {formatTimestamp(clip.endTime)} ({Math.round(clipDuration)}s)
                </span>
              </div>
            </div>

            {/* RIGHT: Style + Actions */}
            <div className="space-y-5">
              {/* Layout */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Layout</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Aspect Ratio</p>
                    <div className="flex flex-wrap gap-1.5">
                      {ASPECT_RATIOS.map((r) => (
                        <button
                          key={r.id}
                          onClick={() => setLayout((l) => ({ ...l, aspectRatio: r.id }))}
                          className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                            layout.aspectRatio === r.id
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
                          }`}
                          title={r.desc}
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Mask</p>
                    <div className="flex flex-wrap gap-1.5">
                      {MASKS.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => setLayout((l) => ({ ...l, mask: m.id }))}
                          className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                            layout.mask === m.id
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Caption Style */}
              <CaptionStyleEditor style={captionStyle} onChange={setCaptionStyle} />

              {/* Regenerate */}
              <Button
                onClick={handleRegenerateClip}
                disabled={generating || !clip.video?.fileExists}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
                size="lg"
              >
                {generating ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Regenerating Clip...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    Regenerate Clip
                  </>
                )}
              </Button>

              {/* Download + Publish */}
              <div className="flex gap-2">
                <a
                  href={clipUrl}
                  download={`clip_${clip.video?.filename || clip.filename}`}
                  className="flex-1"
                >
                  <Button variant="outline" size="lg" className="w-full">
                    <Download className="h-4 w-4 mr-1" />
                    Download
                  </Button>
                </a>
                <div className="flex-1">
                  <PublishButton
                    clipFilename={clipFilename}
                    videoTitle={videoTitle}
                    clipDuration={clipDuration}
                  />
                </div>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
