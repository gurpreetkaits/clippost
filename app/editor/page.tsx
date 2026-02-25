"use client";

import { useState, useCallback, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import EditorLayout from "@/components/editor/EditorLayout";
import EditorHeader from "@/components/editor/EditorHeader";
import VideoPreviewPanel from "@/components/editor/VideoPreviewPanel";
import ActionBar from "@/components/editor/ActionBar";
import CaptionStyleModal from "@/components/editor/CaptionStyleModal";
import ClipSelector from "@/components/ClipSelector";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Film } from "lucide-react";
import { CaptionStyle, DEFAULT_CAPTION_STYLE } from "@/lib/caption-style";
import { DEFAULT_LAYOUT } from "@/lib/video-layout";
import { templateToCaptionStyle } from "@/lib/caption-template";
import type { ReelTemplate } from "@/lib/caption-template";
import { useUndo } from "@/lib/hooks/use-undo";
import type { ColorGradingParams, ColorGradingState } from "@/lib/color-grading";
import type { CaptionSegment } from "@/lib/types/editor";

interface VideoData {
  filename: string;
  title: string;
  duration: number;
}

const DEFAULT_COLOR_GRADING: ColorGradingState = {
  enabled: false,
  params: null,
  gradedFilename: null,
};

function EditorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";

  const [videoData, setVideoData] = useState<VideoData | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Editor state
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(30);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const captionUndo = useUndo<CaptionSegment[]>([]);
  const captions = captionUndo.state;
  const setCaptions = captionUndo.set;
  const styleUndo = useUndo<CaptionStyle>(DEFAULT_CAPTION_STYLE);
  const captionStyle = styleUndo.state;
  const [activeTemplateId, setActiveTemplateId] = useState<string | undefined>();
  const [clipFilename, setClipFilename] = useState<string | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [language, setLanguage] = useState("en-IN");

  // Enhance state
  const [enhanceEnabled, setEnhanceEnabled] = useState(false);
  const [enhanceLoading, setEnhanceLoading] = useState(false);
  const [enhanceProgress, setEnhanceProgress] = useState("");
  const [enhancedFilename, setEnhancedFilename] = useState<string | null>(null);

  // Color grading state
  const [colorGrading, setColorGrading] = useState(DEFAULT_COLOR_GRADING);
  const [colorGradingLoading, setColorGradingLoading] = useState(false);
  const [colorGradingProgress, setColorGradingProgress] = useState("");
  const [colorGradingCorrections, setColorGradingCorrections] = useState<string[]>([]);

  // Auto trim state
  const [autoTrimLoading, setAutoTrimLoading] = useState(false);
  const [autoTrimProgress, setAutoTrimProgress] = useState("");
  const [autoTrimReason, setAutoTrimReason] = useState("");

  // Caption style modal
  const [captionStyleModalOpen, setCaptionStyleModalOpen] = useState(false);

  // Clear stale previews when start/end changes
  useEffect(() => {
    setColorGrading((prev) => prev.gradedFilename ? { ...prev, gradedFilename: null } : prev);
    setEnhancedFilename(null);
    setClipFilename(null);
  }, [start, end]);

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

  // Load video data
  useEffect(() => {
    const videoParam = searchParams.get("video");
    const clipParam = searchParams.get("clip");
    const titleParam = searchParams.get("title");
    const durationParam = searchParams.get("duration");
    const startParam = searchParams.get("start");
    const endParam = searchParams.get("end");

    if (clipParam) {
      (async () => {
        try {
          const r = await fetch(`/api/clips/${clipParam}`);
          if (!r.ok) throw new Error("Clip not found");
          const clip = await r.json();

          const video = clip.video;
          if (video) {
            setVideoData({
              filename: video.filename,
              title: video.title || "Untitled",
              duration: video.duration || 0,
            });
          }

          setStart(clip.startTime);
          setEnd(clip.endTime);
          setClipFilename(clip.filename);
          if (clip.captionStyle) {
            styleUndo.set(clip.captionStyle as CaptionStyle);
          }
        } catch {
          // show empty state
        }
        setLoaded(true);
      })();
      return;
    }

    if (videoParam) {
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

    const raw = sessionStorage.getItem("editorData");
    if (raw) {
      try {
        const data = JSON.parse(raw);
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
      } catch {}
      sessionStorage.removeItem("editorData");
    }
    setLoaded(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- SSE helper ---
  const consumeSSE = useCallback(
    async (
      url: string,
      body: Record<string, unknown>,
      onProgress: (msg: string) => void,
      onDone: (event: Record<string, unknown>) => void,
      onError: (msg: string) => void
    ) => {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Request failed");
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const dataLine = line.replace(/^data: /, "").trim();
          if (!dataLine) continue;
          try {
            const event = JSON.parse(dataLine);
            if (event.type === "progress") {
              onProgress(event.message);
            } else if (event.type === "done") {
              onDone(event);
            } else if (event.type === "error") {
              onError(event.message);
            }
          } catch (e) {
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
      }
    },
    []
  );

  // --- Handlers ---

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

  const handleEnhance = useCallback(async () => {
    if (!videoData) return;
    setEnhanceLoading(true);
    setEnhanceProgress("Starting...");
    setError("");

    try {
      await consumeSSE(
        "/api/enhance",
        { filename: videoData.filename, start, end },
        (msg) => setEnhanceProgress(msg),
        (event) => {
          setEnhancedFilename(event.enhancedFilename as string);
          setEnhanceEnabled(true);
        },
        (msg) => { throw new Error(msg); }
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enhancement failed");
    } finally {
      setEnhanceLoading(false);
      setEnhanceProgress("");
    }
  }, [videoData, start, end, consumeSSE]);

  const handleRemoveEnhance = useCallback(() => {
    setEnhanceEnabled(false);
    setEnhancedFilename(null);
  }, []);

  const handleColorGrade = useCallback(async () => {
    if (!videoData) return;
    setColorGradingLoading(true);
    setColorGradingProgress("Starting...");
    setError("");

    try {
      await consumeSSE(
        "/api/color-grade",
        { filename: videoData.filename, start, end },
        (msg) => setColorGradingProgress(msg),
        (event) => {
          setColorGrading({
            enabled: true,
            params: event.params as ColorGradingParams,
            gradedFilename: event.gradedFilename as string,
          });
          setColorGradingCorrections((event.corrections as string[]) || []);
        },
        (msg) => { throw new Error(msg); }
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Color grading failed");
    } finally {
      setColorGradingLoading(false);
      setColorGradingProgress("");
    }
  }, [videoData, start, end, consumeSSE]);

  const handleRemoveColorGrading = useCallback(() => {
    setColorGrading(DEFAULT_COLOR_GRADING);
    setColorGradingCorrections([]);
  }, []);

  const handleAutoTrim = useCallback(async () => {
    if (!videoData) return;
    setAutoTrimLoading(true);
    setAutoTrimProgress("Starting...");
    setAutoTrimReason("");
    setError("");

    try {
      await consumeSSE(
        "/api/editor/auto-trim",
        { filename: videoData.filename, duration: videoData.duration, language },
        (msg) => setAutoTrimProgress(msg),
        (event) => {
          setStart(event.start as number);
          setEnd(event.end as number);
          setAutoTrimReason(event.reason as string);
        },
        (msg) => { throw new Error(msg); }
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Auto-trim failed");
    } finally {
      setAutoTrimLoading(false);
      setAutoTrimProgress("");
    }
  }, [videoData, language, consumeSSE]);

  const doGenerate = useCallback(async (): Promise<string | null> => {
    if (!videoData) return null;
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
          layout: DEFAULT_LAYOUT,
          colorGrading: colorGrading.enabled ? colorGrading.params : undefined,
          enhance: enhanceEnabled,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Clip generation failed");

      setClipFilename(data.clipFilename);
      return data.clipFilename;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Clip generation failed");
      return null;
    } finally {
      setGenerating(false);
    }
  }, [videoData, start, end, captions, captionStyle, language, activeTemplateId, colorGrading, enhanceEnabled, setCaptions]);

  const handleGenerateClip = useCallback(async () => {
    await doGenerate();
  }, [doGenerate]);

  const handleExport = useCallback(async () => {
    const filename = await doGenerate();
    if (filename && videoData) {
      const url = `/api/video?file=${encodeURIComponent(filename)}`;
      const a = document.createElement("a");
      a.href = url;
      a.download = `${videoData.title.replace(/[^a-zA-Z0-9_-]/g, "_")}_export.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  }, [doGenerate, videoData]);

  const handleTemplateSelect = useCallback(
    (template: ReelTemplate, id?: string) => {
      styleUndo.set(templateToCaptionStyle(template));
      setActiveTemplateId(id);
    },
    [styleUndo]
  );

  const handleCaptionStyleChange = useCallback(
    (s: CaptionStyle) => {
      styleUndo.set(s);
      setActiveTemplateId(undefined);
    },
    [styleUndo]
  );

  const handleResetCaptionStyle = useCallback(() => {
    styleUndo.set(DEFAULT_CAPTION_STYLE);
    setActiveTemplateId(undefined);
  }, [styleUndo]);

  if (loaded && !videoData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-950">
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

  if (!loaded || !videoData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-950">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const videoUrl = `/api/video?file=${encodeURIComponent(videoData.filename)}`;

  return (
    <>
      <EditorLayout
        header={
          <EditorHeader
            onBack={() => router.push("/")}
            videoTitle={videoData.title}
            clipFilename={clipFilename}
            clipDuration={end - start}
            language={language}
            generating={generating}
            captions={captions}
            onGenerate={handleGenerateClip}
            onExport={handleExport}
          />
        }
        preview={
          <VideoPreviewPanel
            videoUrl={videoUrl}
            start={start}
            end={end}
            playing={playing}
            currentTime={currentTime}
            onPlayingChange={setPlaying}
            onProgress={setCurrentTime}
            captions={captions}
            captionStyle={captionStyle}
            clipFilename={clipFilename}
            enhancedFilename={enhancedFilename}
            gradedFilename={colorGrading.gradedFilename}
            generating={generating}
          />
        }
        rightPanel={
          <ActionBar
            language={language}
            onLanguageChange={setLanguage}
            captionCount={captions.length}
            captionsLoading={transcribing}
            onGenerateCaptions={handleTranscribe}
            enhanceEnabled={enhanceEnabled}
            enhanceLoading={enhanceLoading}
            enhanceProgress={enhanceProgress}
            onEnhance={handleEnhance}
            onRemoveEnhance={handleRemoveEnhance}
            colorGradingEnabled={colorGrading.enabled}
            colorGradingLoading={colorGradingLoading}
            colorGradingProgress={colorGradingProgress}
            colorGradingCorrections={colorGradingCorrections}
            onColorGrade={handleColorGrade}
            onRemoveColorGrading={handleRemoveColorGrading}
            autoTrimLoading={autoTrimLoading}
            autoTrimProgress={autoTrimProgress}
            autoTrimReason={autoTrimReason}
            onAutoTrim={handleAutoTrim}
            onOpenCaptionStyle={() => setCaptionStyleModalOpen(true)}
          />
        }
        bottomBar={
          <div className="px-4 py-3">
            <ClipSelector
              duration={videoData.duration}
              start={start}
              end={end}
              currentTime={currentTime}
              onStartChange={setStart}
              onEndChange={setEnd}
            />
          </div>
        }
      />

      {/* Error toast */}
      {error && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-destructive text-destructive-foreground px-4 py-2 rounded-lg text-sm shadow-lg max-w-md">
          {error}
          <button
            className="ml-3 underline text-xs"
            onClick={() => setError("")}
          >
            dismiss
          </button>
        </div>
      )}

      <CaptionStyleModal
        open={captionStyleModalOpen}
        onOpenChange={setCaptionStyleModalOpen}
        captionStyle={captionStyle}
        onCaptionStyleChange={handleCaptionStyleChange}
        onTemplateSelect={handleTemplateSelect}
        onUndo={styleUndo.undo}
        onReset={handleResetCaptionStyle}
        canUndo={styleUndo.canUndo}
      />
    </>
  );
}

export default function EditorPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-neutral-950">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <EditorContent />
    </Suspense>
  );
}
