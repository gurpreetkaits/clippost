"use client";

import { useState, useCallback, useEffect, useRef, Suspense } from "react";
import { useRouter } from "next/navigation";
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
  Sparkles,
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

interface EditorData {
  clipFilename: string;
  videoFilename: string;
  title: string;
  duration: number;
  start: number;
  end: number;
  segments: CaptionSegment[];
  segmentReason: string;
}

function EditorContent() {
  const router = useRouter();

  const [editorData, setEditorData] = useState<EditorData | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Editor state
  const [clipFilename, setClipFilename] = useState("");
  const [segments, setSegments] = useState<CaptionSegment[]>([]);
  const [captionStyle, setCaptionStyle] = useState<CaptionStyle>(DEFAULT_CAPTION_STYLE);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  // Load data from sessionStorage on mount
  useEffect(() => {
    const raw = sessionStorage.getItem("editorData");
    if (raw) {
      try {
        const data: EditorData = JSON.parse(raw);
        setEditorData(data);
        setClipFilename(data.clipFilename);
        setSegments(data.segments || []);
      } catch {}
      sessionStorage.removeItem("editorData");
    }
    setLoaded(true);
  }, []);

  // Map clip currentTime (starts at 0) to original video time for caption matching
  const originalTime = editorData ? editorData.start + currentTime : currentTime;

  const handleRegenerateClip = useCallback(async () => {
    if (!editorData) return;
    setGenerating(true);
    setError("");

    try {
      const response = await fetch("/api/clip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: editorData.videoFilename,
          start: editorData.start,
          end: editorData.end,
          captions: segments,
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
  }, [editorData, segments, captionStyle]);

  const handleSegmentTimingChange = useCallback(
    (index: number, edge: "start" | "end", newTime: number) => {
      setSegments((prev) => {
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          [edge]: newTime,
          words: undefined, // clear word-level data when timing changes
        };
        return updated;
      });
    },
    []
  );

  // Fallback: no data
  if (loaded && !editorData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Film className="h-12 w-12 text-muted-foreground/40 mx-auto" />
          <p className="text-muted-foreground">No video loaded.</p>
          <Button variant="ghost" onClick={() => router.push("/")}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Go back
          </Button>
        </div>
      </div>
    );
  }

  // Loading state
  if (!loaded || !editorData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const clipUrl = `/api/video?file=${encodeURIComponent(clipFilename)}`;
  const clipDuration = editorData.end - editorData.start;

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 p-4 md:p-6">
        <div className="max-w-7xl mx-auto space-y-4">
          {/* Header */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/")}
              className="text-muted-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <h1 className="text-lg font-semibold text-foreground truncate flex-1">
              {editorData.title}
            </h1>
            {editorData.segmentReason && (
              <Badge variant="secondary" className="hidden sm:flex gap-1 shrink-0">
                <Sparkles className="h-3 w-3" />
                {editorData.segmentReason.length > 60
                  ? editorData.segmentReason.slice(0, 60) + "..."
                  : editorData.segmentReason}
              </Badge>
            )}
          </div>

          {/* Two-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* LEFT: Video player */}
            <div className="lg:sticky lg:top-4 lg:self-start space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Generated Clip
                  </p>
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                </div>
                <VideoPlayer
                  key={clipFilename}
                  url={clipUrl}
                  start={0}
                  end={clipDuration}
                  playing={playing}
                  onProgress={setCurrentTime}
                />
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
                  {formatTimestamp(editorData.start)} &ndash;{" "}
                  {formatTimestamp(editorData.end)} ({Math.round(clipDuration)}s)
                </span>
              </div>
            </div>

            {/* RIGHT: Captions + Style + Actions */}
            <div className="space-y-5">
              {/* Captions */}
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

              {/* Style */}
              <CaptionStyleEditor style={captionStyle} onChange={setCaptionStyle} />

              {/* Regenerate */}
              <Button
                onClick={handleRegenerateClip}
                disabled={generating}
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
                  download={`clip_${editorData.videoFilename}`}
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
                    videoTitle={editorData.title}
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
                clipStart={editorData.start}
                clipEnd={editorData.end}
                currentTime={originalTime}
                selectedIndex={selectedIndex}
                onSelectSegment={setSelectedIndex}
                onSegmentTimingChange={handleSegmentTimingChange}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function EditorPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <EditorContent />
    </Suspense>
  );
}
