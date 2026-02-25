"use client";

import { useState, useCallback, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import EditorLayout from "@/components/editor/EditorLayout";
import EditorHeader from "@/components/editor/EditorHeader";
import VideoPreviewPanel from "@/components/editor/VideoPreviewPanel";
import PropertiesPanel from "@/components/editor/PropertiesPanel";
import BottomToolbar from "@/components/editor/BottomToolbar";
import ClipBrowserSidebar, {
  type SidebarClip,
} from "@/components/editor/ClipBrowserSidebar";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Film } from "lucide-react";
import { CaptionStyle, DEFAULT_CAPTION_STYLE } from "@/lib/caption-style";
import { VideoLayout, DEFAULT_LAYOUT } from "@/lib/video-layout";
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

interface TextOverlay {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
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
  const [layout, setLayout] = useState<VideoLayout>(DEFAULT_LAYOUT);

  // Text overlays (draggable on canvas)
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([]);

  // Clip browser state
  const [sidebarClips, setSidebarClips] = useState<SidebarClip[]>([]);
  const [sidebarLoading, setSidebarLoading] = useState(false);
  const [activeClipId, setActiveClipId] = useState<string | null>(null);

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

  // Fetch sibling clips for sidebar
  const fetchSidebarClips = useCallback(
    async (videoFilename: string) => {
      if (!isAuthenticated) return;
      setSidebarLoading(true);
      try {
        const res = await fetch(
          `/api/clips?videoFilename=${encodeURIComponent(videoFilename)}`
        );
        if (res.ok) {
          const data = await res.json();
          setSidebarClips(data.clips || []);
        }
      } catch {
        // sidebar is non-critical
      } finally {
        setSidebarLoading(false);
      }
    },
    [isAuthenticated]
  );

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
            fetchSidebarClips(video.filename);
          }

          setStart(clip.startTime);
          setEnd(clip.endTime);
          setClipFilename(clip.filename);
          setActiveClipId(clip.id);
          if (clip.captionStyle) {
            setCaptionStyle(clip.captionStyle as CaptionStyle);
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
      fetchSidebarClips(videoParam);
      setLoaded(true);
      return;
    }

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
        fetchSidebarClips(data.videoFilename);
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
          layout,
          textOverlays,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Clip generation failed");

      setClipFilename(data.clipFilename);
      fetchSidebarClips(videoData.filename);
      return data.clipFilename;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Clip generation failed");
      return null;
    } finally {
      setGenerating(false);
    }
  }, [videoData, start, end, captions, captionStyle, language, activeTemplateId, layout, textOverlays, setCaptions, fetchSidebarClips]);

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

  const handleSegmentTimingChange = useCallback(
    (index: number, edge: "start" | "end", newTime: number) => {
      setCaptions(
        captions.map((seg, i) =>
          i === index ? { ...seg, [edge]: newTime, words: undefined } : seg
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

  const handleTextOverlayMove = useCallback((id: string, x: number, y: number) => {
    setTextOverlays((prev) =>
      prev.map((o) => (o.id === id ? { ...o, x, y } : o))
    );
  }, []);

  const handleAddTextOverlay = useCallback(() => {
    setTextOverlays((prev) => [
      ...prev,
      {
        id: `text_${Date.now()}`,
        text: "New Text",
        x: 30,
        y: 40,
        fontSize: 24,
        color: "#FFFFFF",
      },
    ]);
  }, []);

  const handleRemoveTextOverlay = useCallback((id: string) => {
    setTextOverlays((prev) => prev.filter((o) => o.id !== id));
  }, []);

  const handleUpdateTextOverlay = useCallback((id: string, patch: Partial<TextOverlay>) => {
    setTextOverlays((prev) =>
      prev.map((o) => (o.id === id ? { ...o, ...patch } : o))
    );
  }, []);

  const handleSelectClip = useCallback(
    async (clip: SidebarClip) => {
      setActiveClipId(clip.id);
      setStart(clip.startTime);
      setEnd(clip.endTime);
      setClipFilename(clip.filename);
      setPlaying(false);
      setError("");
      captionUndo.reset([]);
      try {
        const r = await fetch(`/api/clips/${clip.id}`);
        if (r.ok) {
          const data = await r.json();
          if (data.captionStyle) {
            setCaptionStyle(data.captionStyle as CaptionStyle);
          }
        }
      } catch {}
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const handleNewClip = useCallback(() => {
    setActiveClipId(null);
    setStart(0);
    setEnd(videoData ? Math.min(30, videoData.duration) : 30);
    setClipFilename(null);
    setCaptionStyle(DEFAULT_CAPTION_STYLE);
    setActiveTemplateId(undefined);
    setLayout(DEFAULT_LAYOUT);
    setPlaying(false);
    setError("");
    setTextOverlays([]);
    captionUndo.reset([]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoData]);

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
          transcribing={transcribing}
        />
      }
      leftPanel={
        <ClipBrowserSidebar
          clips={sidebarClips}
          loading={sidebarLoading}
          activeClipId={activeClipId}
          onSelectClip={handleSelectClip}
          onNewClip={handleNewClip}
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
          generating={generating}
          layout={layout}
          textOverlays={textOverlays}
          onTextOverlayMove={handleTextOverlayMove}
        />
      }
      rightPanel={
        <PropertiesPanel
          captions={captions}
          captionStyle={captionStyle}
          onCaptionStyleChange={handleCaptionStyleChange}
          onTemplateSelect={handleTemplateSelect}
          layout={layout}
          onLayoutChange={setLayout}
          language={language}
          onLanguageChange={setLanguage}
          onTranscribe={handleTranscribe}
          transcribing={transcribing}
          clipDuration={end - start}
          textOverlays={textOverlays}
          onAddTextOverlay={handleAddTextOverlay}
          onRemoveTextOverlay={handleRemoveTextOverlay}
          onUpdateTextOverlay={handleUpdateTextOverlay}
        />
      }
      bottomBar={
        <BottomToolbar
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
          selectedIndex={selectedIndex}
          onSelectSegment={setSelectedIndex}
          onSegmentTimingChange={handleSegmentTimingChange}
        />
      }
    />
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
