"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import dynamic from "next/dynamic";
import CaptionEditor from "@/components/CaptionEditor";
import CaptionTimeline from "@/components/CaptionTimeline";
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

const VideoPlayer = dynamic(() => import("@/components/VideoPlayer"), {
  ssr: false,
});

interface CaptionSegment {
  start: number;
  end: number;
  text: string;
  words?: { word: string; start: number; end: number }[];
}

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
  const [segments, setSegments] = useState<CaptionSegment[]>([]);
  const [captionStyle, setCaptionStyle] = useState<CaptionStyle>(DEFAULT_CAPTION_STYLE);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Fetch clip on mount, then auto-transcribe so captions are immediately editable
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

        // Auto-transcribe if source video exists
        if (data.video?.fileExists && data.video?.filename) {
          setTranscribing(true);
          try {
            const tr = await fetch("/api/transcribe", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                filename: data.video.filename,
                start: data.startTime,
                end: data.endTime,
              }),
            });
            const trData = await tr.json();
            if (!cancelled && tr.ok) {
              setSegments(trData.segments);
            }
          } catch {
            // Non-fatal: user can still manually transcribe
          } finally {
            if (!cancelled) setTranscribing(false);
          }
        }
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
  const originalTime = clip ? clip.startTime + currentTime : currentTime;

  // Find the active caption segment for the current playback time
  const activeSegment = useMemo(() => {
    if (segments.length === 0) return null;
    return segments.find((s) => originalTime >= s.start && originalTime <= s.end) ?? null;
  }, [segments, originalTime]);

  // Ref for the video container to compute scale ratio
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const el = videoContainerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [clip]);

  const handleTranscribe = useCallback(async () => {
    if (!clip?.video) return;
    setTranscribing(true);
    setError("");

    try {
      const response = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: clip.video.filename,
          start: clip.startTime,
          end: clip.endTime,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Transcription failed");
      }
      setSegments(data.segments);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transcription failed");
    } finally {
      setTranscribing(false);
    }
  }, [clip]);

  const handleRegenerateClip = useCallback(async () => {
    if (!clip?.video) return;
    setGenerating(true);
    setError("");

    try {
      // Auto-transcribe if no segments yet
      let finalSegments = segments;
      if (finalSegments.length === 0) {
        const transcribeRes = await fetch("/api/transcribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: clip.video.filename,
            start: clip.startTime,
            end: clip.endTime,
          }),
        });
        const transcribeData = await transcribeRes.json();
        if (!transcribeRes.ok) {
          throw new Error(transcribeData.error || "Transcription failed");
        }
        finalSegments = transcribeData.segments;
        setSegments(finalSegments);
      }

      const response = await fetch("/api/clip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: clip.video.filename,
          start: clip.startTime,
          end: clip.endTime,
          captions: finalSegments,
          style: captionStyle,
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
  }, [clip, segments, captionStyle]);

  const handleSegmentTimingChange = useCallback(
    (index: number, edge: "start" | "end", newTime: number) => {
      setSegments((prev) => {
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          [edge]: newTime,
          words: undefined,
        };
        return updated;
      });
    },
    []
  );

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
                <div ref={videoContainerRef} className="relative">
                  <VideoPlayer
                    key={clipFilename}
                    url={clipUrl}
                    start={0}
                    end={clipDuration}
                    playing={playing}
                    onProgress={setCurrentTime}
                  />
                  {/* Live caption overlay */}
                  {activeSegment && (
                    <div
                      className="absolute inset-x-0 flex justify-center pointer-events-none"
                      style={{
                        ...(captionStyle.position === "top"
                          ? { top: "8%" }
                          : captionStyle.position === "center"
                          ? { top: "50%", transform: "translateY(-50%)" }
                          : { bottom: "8%" }),
                      }}
                    >
                      <span
                        className="rounded-md text-center leading-relaxed max-w-[90%]"
                        style={{
                          fontFamily: captionStyle.fontFamily,
                          fontSize: `${Math.max(
                            12,
                            captionStyle.fontSize * (containerWidth / 1080)
                          )}px`,
                          color: captionStyle.textColor,
                          backgroundColor: `${captionStyle.bgColor}${Math.round(
                            (captionStyle.bgOpacity / 100) * 255
                          )
                            .toString(16)
                            .padStart(2, "0")}`,
                          fontWeight: captionStyle.bold ? "bold" : "normal",
                          fontStyle: captionStyle.italic ? "italic" : "normal",
                          padding: "4px 10px",
                        }}
                      >
                        {activeSegment.text}
                      </span>
                    </div>
                  )}
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
                <Button
                  size="sm"
                  onClick={handleTranscribe}
                  disabled={transcribing || !clip.video?.fileExists}
                >
                  {transcribing ? (
                    <>
                      <Loader2 className="animate-spin" />
                      Transcribing...
                    </>
                  ) : (
                    "Transcribe"
                  )}
                </Button>
                <span className="flex items-center text-xs text-muted-foreground">
                  {formatTimestamp(clip.startTime)} &ndash;{" "}
                  {formatTimestamp(clip.endTime)} ({Math.round(clipDuration)}s)
                </span>
              </div>
            </div>

            {/* RIGHT: Style + Actions */}
            <div className="space-y-5">
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

          {/* Full-width: Caption Timeline */}
          {segments.length > 0 && (
            <div className="mt-2">
              <CaptionTimeline
                segments={segments}
                clipStart={clip.startTime}
                clipEnd={clip.endTime}
                currentTime={originalTime}
                selectedIndex={selectedIndex}
                onSelectSegment={setSelectedIndex}
                onSegmentTimingChange={handleSegmentTimingChange}
              />
            </div>
          )}

          {/* Full-width: Caption Editor */}
          {segments.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Captions</CardTitle>
              </CardHeader>
              <CardContent>
                <CaptionEditor
                  captions={segments}
                  onUpdate={setSegments}
                  selectedIndex={selectedIndex}
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
