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
  MessageSquarePlus,
} from "lucide-react";
import { CaptionStyle, DEFAULT_CAPTION_STYLE } from "@/lib/caption-style";
import {
  VideoLayout,
  DEFAULT_LAYOUT,
  OUTPUT_FORMATS,
  FRAME_TEMPLATES,
  getFrameConfig,
} from "@/lib/video-layout";
import { LANGUAGES } from "@/lib/languages";

interface CaptionSegment {
  start: number;
  end: number;
  text: string;
  words?: { word: string; start: number; end: number }[];
}

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
  const [language, setLanguage] = useState("en");
  const [captions, setCaptions] = useState<CaptionSegment[]>([]);
  const [transcribing, setTranscribing] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);

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

  const handleGenerateCaptions = useCallback(async () => {
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
          language,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Transcription failed");
      setCaptions(data.segments);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transcription failed");
    } finally {
      setTranscribing(false);
    }
  }, [clip, language]);

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
          captions,
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
  }, [clip, captions, captionStyle, layout]);

  // Regenerate clip and return the new filename (used by download + publish)
  const prepareClip = useCallback(async (): Promise<string> => {
    if (!clip?.video) throw new Error("No video data");

    const response = await fetch("/api/clip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: clip.video.filename,
        start: clip.startTime,
        end: clip.endTime,
        captions,
        style: captionStyle,
        layout,
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Clip generation failed");
    setClipFilename(data.clipFilename);
    return data.clipFilename;
  }, [clip, captions, captionStyle, layout]);

  const handleDownload = useCallback(async () => {
    setDownloading(true);
    setError("");
    try {
      const filename = await prepareClip();
      const link = document.createElement("a");
      link.href = `/api/video?file=${encodeURIComponent(filename)}`;
      link.download = `clip_${clip?.video?.filename || clip?.filename || "video"}`;
      link.click();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  }, [prepareClip, clip]);

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
                  className={`relative ${layout.format === "9:16" ? "mx-auto bg-black" : ""}`}
                  style={
                    layout.format === "9:16"
                      ? {
                          aspectRatio: "9/16",
                          maxHeight: "65vh",
                          overflow: "hidden",
                          ...(layout.frame !== "fill"
                            ? { display: "flex", alignItems: "center", justifyContent: "center" }
                            : {}),
                        }
                      : {}
                  }
                >
                  {layout.format === "9:16" && layout.frame !== "fill" ? (
                    <div
                      style={{
                        width: `${getFrameConfig(layout.frame).videoWidthPct}%`,
                        borderRadius: `${getFrameConfig(layout.frame).radiusPct}%`,
                        overflow: "hidden",
                      }}
                    >
                      <VideoPlayer
                        key={clipFilename}
                        url={clipUrl}
                        start={0}
                        end={clipDuration}
                        playing={playing}
                        onProgress={setCurrentTime}
                      />
                    </div>
                  ) : (
                    <VideoPlayer
                      key={clipFilename}
                      url={clipUrl}
                      start={0}
                      end={clipDuration}
                      playing={playing}
                      onProgress={setCurrentTime}
                      fill={layout.format === "9:16"}
                    />
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
                    <p className="text-xs text-muted-foreground mb-2">Format</p>
                    <div className="flex gap-1.5">
                      {OUTPUT_FORMATS.map((f) => (
                        <button
                          key={f.id}
                          onClick={() => setLayout((l) => ({ ...l, format: f.id }))}
                          className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                            layout.format === f.id
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {layout.format === "9:16" && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Frame</p>
                      <div className="flex flex-wrap gap-1.5">
                        {FRAME_TEMPLATES.map((t) => (
                          <button
                            key={t.id}
                            onClick={() => setLayout((l) => ({ ...l, frame: t.id }))}
                            className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                              layout.frame === t.id
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
                            }`}
                            title={t.desc}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Captions */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Captions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      disabled={transcribing}
                      className="flex-1 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs"
                    >
                      {LANGUAGES.map((l) => (
                        <option key={l.code} value={l.code}>{l.label}</option>
                      ))}
                    </select>
                    <Button
                      size="sm"
                      onClick={handleGenerateCaptions}
                      disabled={transcribing || !clip.video?.fileExists}
                    >
                      {transcribing ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <MessageSquarePlus className="h-3.5 w-3.5" />
                          Generate Captions
                        </>
                      )}
                    </Button>
                  </div>
                  {captions.length > 0 && (
                    <div className="text-xs text-muted-foreground space-y-1 max-h-40 overflow-y-auto rounded border p-2">
                      {captions.map((seg, i) => (
                        <div key={i} className="flex gap-2">
                          <span className="text-muted-foreground/60 shrink-0 tabular-nums">
                            {formatTimestamp(seg.start)}
                          </span>
                          <span>{seg.text}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {captions.length > 0 && (
                    <button
                      onClick={() => setCaptions([])}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Clear captions
                    </button>
                  )}
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
                <div className="flex-1">
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full"
                    onClick={handleDownload}
                    disabled={downloading || !clip.video?.fileExists}
                  >
                    {downloading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        Preparing...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4 mr-1" />
                        Download
                      </>
                    )}
                  </Button>
                </div>
                <div className="flex-1">
                  <PublishButton
                    clipFilename={clipFilename}
                    videoTitle={videoTitle}
                    clipDuration={clipDuration}
                    language={language}
                    prepareClip={prepareClip}
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
