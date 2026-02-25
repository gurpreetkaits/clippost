"use client";

import { useState, useCallback, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import EditorLayout from "@/components/editor/EditorLayout";
import VideoPreviewPanel from "@/components/editor/VideoPreviewPanel";
import ControlPanel from "@/components/editor/ControlPanel";
import CaptionTimeline from "@/components/CaptionTimeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Film, Sparkles } from "lucide-react";
import { CaptionStyle, DEFAULT_CAPTION_STYLE } from "@/lib/caption-style";
import { templateToCaptionStyle } from "@/lib/caption-template";
import type { ReelTemplate } from "@/lib/caption-template";
import { useUndo } from "@/lib/hooks/use-undo";

interface CaptionSegment {
  start: number;
  end: number;
  text: string;
  words?: { word: string; start: number; end: number }[];
}

interface VideoData {
  filename: string;
  title: string;
  duration: number;
}

interface LegacyEditorData {
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
  const searchParams = useSearchParams();
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";

  const [videoData, setVideoData] = useState<VideoData | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [segmentReason, setSegmentReason] = useState("");

  // Editor state
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(30);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const captionUndo = useUndo<CaptionSegment[]>([]);
  const captions = captionUndo.state;
  const setCaptions = captionUndo.set;
  const [captionStyle, setCaptionStyle] = useState<CaptionStyle>(DEFAULT_CAPTION_STYLE);
  const [activeTemplateId, setActiveTemplateId] = useState<string | undefined>();
  const [clipFilename, setClipFilename] = useState<string | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [language, setLanguage] = useState("en");

  // Fetch user language preference
  useEffect(() => {
    if (!isAuthenticated) return;
    fetch("/api/settings/preferences")
      .then((r) => (r.ok ? r.json() : null))
      .then((prefs) => {
        if (prefs?.defaultLanguage) setLanguage(prefs.defaultLanguage);
      })
      .catch(() => {});
  }, [isAuthenticated]);

  // Load video data from query params or sessionStorage
  useEffect(() => {
    const videoParam = searchParams.get("video");
    const titleParam = searchParams.get("title");
    const durationParam = searchParams.get("duration");
    const startParam = searchParams.get("start");
    const endParam = searchParams.get("end");

    if (videoParam) {
      // New flow: video filename in query params
      const duration = durationParam ? parseFloat(durationParam) : 0;
      setVideoData({
        filename: videoParam,
        title: titleParam || videoParam.replace(/\.[^.]+$/, "").replace(/[_-]/g, " "),
        duration,
      });
      if (startParam) setStart(parseFloat(startParam));
      if (endParam) setEnd(parseFloat(endParam));
      else if (duration > 0) setEnd(Math.min(30, duration));
      setLoaded(true);
      return;
    }

    // Legacy flow: sessionStorage from auto-trim
    const raw = sessionStorage.getItem("editorData");
    if (raw) {
      try {
        const data: LegacyEditorData = JSON.parse(raw);
        setVideoData({
          filename: data.videoFilename,
          title: data.title,
          duration: data.duration,
        });
        setStart(data.start);
        setEnd(data.end);
        if (data.segments?.length > 0) {
          captionUndo.reset(data.segments);
        }
        if (data.clipFilename) setClipFilename(data.clipFilename);
        if (data.segmentReason) setSegmentReason(data.segmentReason);
      } catch {}
      sessionStorage.removeItem("editorData");
    }
    setLoaded(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTranscribe = useCallback(async () => {
    if (!videoData) return;
    setTranscribing(true);
    setError("");

    try {
      const response = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: videoData.filename, start, end, language }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Transcription failed");

      setCaptions(data.segments);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transcription failed");
    } finally {
      setTranscribing(false);
    }
  }, [videoData, start, end, language, setCaptions]);

  const handleGenerateClip = useCallback(async () => {
    if (!videoData) return;
    setGenerating(true);
    setError("");

    try {
      let finalCaptions = captions;
      if (finalCaptions.length === 0) {
        const transcribeRes = await fetch("/api/transcribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: videoData.filename, start, end, language }),
        });
        const transcribeData = await transcribeRes.json();
        if (!transcribeRes.ok) throw new Error(transcribeData.error || "Transcription failed");
        finalCaptions = transcribeData.segments;
        setCaptions(finalCaptions);
      }

      const response = await fetch("/api/clip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: videoData.filename,
          start,
          end,
          captions: finalCaptions,
          style: captionStyle,
          templateId: activeTemplateId,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Clip generation failed");

      setClipFilename(data.clipFilename);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Clip generation failed");
    } finally {
      setGenerating(false);
    }
  }, [videoData, start, end, captions, captionStyle, language, activeTemplateId, setCaptions]);

  const handleSegmentTimingChange = useCallback(
    (index: number, edge: "start" | "end", newTime: number) => {
      setCaptions(
        captions.map((seg, i) =>
          i === index
            ? { ...seg, [edge]: newTime, words: undefined }
            : seg
        )
      );
    },
    [captions, setCaptions]
  );

  const handleTemplateSelect = useCallback(
    (template: ReelTemplate, id?: string) => {
      setCaptionStyle(templateToCaptionStyle(template));
      setActiveTemplateId(id);
    },
    []
  );

  const handleCaptionStyleChange = useCallback(
    (s: CaptionStyle) => {
      setCaptionStyle(s);
      setActiveTemplateId(undefined);
    },
    []
  );

  // No data loaded
  if (loaded && !videoData) {
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

  // Still loading
  if (!loaded || !videoData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const videoUrl = `/api/video?file=${encodeURIComponent(videoData.filename)}`;

  return (
    <EditorLayout
      title={videoData.title}
      onBack={() => router.push("/")}
      badge={
        segmentReason ? (
          <Badge variant="secondary" className="hidden sm:flex gap-1 shrink-0">
            <Sparkles className="h-3 w-3" />
            {segmentReason.length > 60 ? segmentReason.slice(0, 60) + "..." : segmentReason}
          </Badge>
        ) : undefined
      }
      preview={
        <VideoPreviewPanel
          videoUrl={videoUrl}
          videoFilename={videoData.filename}
          videoTitle={videoData.title}
          start={start}
          end={end}
          playing={playing}
          currentTime={currentTime}
          onPlayingChange={setPlaying}
          onProgress={setCurrentTime}
          captions={captions}
          captionStyle={captionStyle}
          clipFilename={clipFilename}
          generating={generating}
          language={language}
        />
      }
      controls={
        <ControlPanel
          duration={videoData.duration}
          start={start}
          end={end}
          currentTime={currentTime}
          onStartChange={setStart}
          onEndChange={setEnd}
          captions={captions}
          onCaptionsUpdate={setCaptions}
          onUndo={captionUndo.undo}
          onRedo={captionUndo.redo}
          canUndo={captionUndo.canUndo}
          canRedo={captionUndo.canRedo}
          captionStyle={captionStyle}
          onCaptionStyleChange={handleCaptionStyleChange}
          activeTemplateId={activeTemplateId}
          onTemplateSelect={handleTemplateSelect}
          language={language}
          onLanguageChange={setLanguage}
          onTranscribe={handleTranscribe}
          transcribing={transcribing}
          onGenerate={handleGenerateClip}
          generating={generating}
          error={error}
        />
      }
      timeline={
        captions.length > 0 ? (
          <CaptionTimeline
            segments={captions}
            clipStart={start}
            clipEnd={end}
            currentTime={currentTime}
            selectedIndex={selectedIndex}
            onSelectSegment={setSelectedIndex}
            onSegmentTimingChange={handleSegmentTimingChange}
          />
        ) : undefined
      }
    />
  );
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
