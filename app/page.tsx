"use client";

import { useState, useRef, useCallback, useEffect, Suspense } from "react";
import { useSession, signIn } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import ClipSelector from "@/components/ClipSelector";
import CaptionEditor from "@/components/CaptionEditor";

import CaptionStyleEditor from "@/components/CaptionStyleEditor";
import TemplatePicker from "@/components/TemplatePicker";
import { useUndo } from "@/lib/hooks/use-undo";
import { useDraft } from "@/lib/hooks/use-draft";
import PublishButton from "@/components/PublishButton";
import DemoVideo from "@/components/DemoVideo";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Loader2,
  AlertCircle,
  Download,
  CheckCircle2,
  Play,
  Pause,
  Lock,
  ArrowLeft,
  Clock,
  Instagram,
  Sparkles,
  Film,
  ChevronDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CaptionStyle, DEFAULT_CAPTION_STYLE } from "@/lib/caption-style";
import { templateToCaptionStyle } from "@/lib/caption-template";
import type { ReelTemplate } from "@/lib/caption-template";
import {
  VideoLayout,
  DEFAULT_LAYOUT,
  OUTPUT_FORMATS,
  FRAME_TEMPLATES,
  getFrameConfig,
} from "@/lib/video-layout";
import { LANGUAGES } from "@/lib/languages";

const VideoPlayer = dynamic(() => import("@/components/VideoPlayer"), {
  ssr: false,
});

interface AutoTrimResult {
  clipFilename: string;
  start: number;
  end: number;
  title: string;
  segmentReason: string;
  videoFilename: string;
  duration: number;
  segments: { start: number; end: number; text: string; words?: { word: string; start: number; end: number }[] }[];
}

interface ProgressState {
  step: string;
  message: string;
  percent: number;
}

interface VideoData {
  filename: string;
  title: string;
  duration: number;
}

interface CaptionSegment {
  start: number;
  end: number;
  text: string;
}

const FUN_WORDS = [
  "Philosophizing...",
  "Contemplating...",
  "Manifesting...",
  "Ruminating...",
  "Brainstorming...",
  "Hallucinating...",
  "Pondering...",
  "Daydreaming...",
  "Extrapolating...",
  "Vibing...",
  "Theorizing...",
  "Imagining...",
  "Synthesizing...",
  "Channeling...",
  "Conjuring...",
  "Calibrating...",
  "Meditating...",
  "Percolating...",
  "Harmonizing...",
  "Decoding...",
];

function AuthGate({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  const { status } = useSession();
  if (status === "authenticated") return <>{children}</>;
  return (
    <>
      {fallback || (
        <Button
          onClick={() => signIn("google")}
          variant="outline"
          className="w-full"
        >
          <Lock className="h-4 w-4 mr-2" />
          Sign in to unlock
        </Button>
      )}
    </>
  );
}

interface ClipItem {
  id: string;
  filename: string;
  startTime: number;
  endTime: number;
  duration: number;
  hasCaptions: boolean;
  method: "MANUAL" | "AUTO_TRIM";
  publishedAt: string | null;
  createdAt: string;
  video: {
    title: string;
    duration: number;
    youtubeId: string;
    sourceUrl: string;
    thumbnail: string;
  } | null;
}

function MyClips() {
  const { status } = useSession();
  const [clips, setClips] = useState<ClipItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status !== "authenticated") {
      setLoading(false);
      return;
    }
    fetch("/api/clips?limit=3")
      .then((r) => r.json())
      .then((data) => setClips(data.clips || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [status]);

  if (status !== "authenticated") return null;
  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (clips.length === 0) return null;

  return (
    <div className="w-full max-w-xl space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Recent Clips</h2>
        <Link href="/clips" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          View all
        </Link>
      </div>
      <div className="space-y-2">
        {clips.map((clip) => (
          <Card key={clip.id} className="overflow-hidden">
            <div className="flex gap-3 p-3">
              {clip.video?.thumbnail && (
                <div className="relative w-28 h-16 rounded overflow-hidden bg-muted flex-shrink-0">
                  <Image
                    src={clip.video.thumbnail}
                    alt={clip.video.title || "Video thumbnail"}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
              )}
              <div className="flex-1 min-w-0 space-y-1">
                <p className="text-sm font-medium truncate">
                  {clip.video?.title || "Untitled"}
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline" className="text-xs gap-1">
                    <Clock className="h-3 w-3" />
                    {formatTimestamp(clip.startTime)}–{formatTimestamp(clip.endTime)}
                  </Badge>
                  <Badge variant="secondary" className="text-xs gap-1">
                    {clip.method === "AUTO_TRIM" ? (
                      <><Sparkles className="h-3 w-3" /> Auto</>
                    ) : (
                      <><Film className="h-3 w-3" /> Manual</>
                    )}
                  </Badge>
                  {clip.publishedAt && (
                    <Badge variant="default" className="text-xs gap-1">
                      <Instagram className="h-3 w-3" /> Published
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{new Date(clip.createdAt).toLocaleDateString()}</span>
                  {clip.video && (
                    <span>Source: {formatTimestamp(clip.video.duration)}</span>
                  )}
                </div>
              </div>
              <a
                href={`/api/video?file=${encodeURIComponent(clip.filename)}`}
                download
                className="flex-shrink-0 self-center"
              >
                <Button variant="ghost" size="sm" title="Download clip">
                  <Download className="h-4 w-4" />
                </Button>
              </a>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  );
}

function HomeContent() {
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";
  const searchParams = useSearchParams();

  // URL input state
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [autoTrim, setAutoTrim] = useState(false);
  const [purpose, setPurpose] = useState("");
  const [generateCaptions, setGenerateCaptions] = useState(true);

  // Language
  const [language, setLanguage] = useState("en");

  // Fetch user preferences on mount and apply as defaults
  useEffect(() => {
    if (!isAuthenticated) return;
    fetch("/api/settings/preferences")
      .then((r) => (r.ok ? r.json() : null))
      .then((prefs) => {
        if (!prefs) return;
        if (prefs.defaultLanguage) setLanguage(prefs.defaultLanguage);
        if (prefs.autonomousMode) setAutoTrim(true);
      })
      .catch(() => {});
  }, [isAuthenticated]);

  // Auto-trim state
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [autoTrimResult, setAutoTrimResult] = useState<AutoTrimResult | null>(null);
  const [autoTrimLayout, setAutoTrimLayout] = useState<VideoLayout>(DEFAULT_LAYOUT);
  const [downloadingWithLayout, setDownloadingWithLayout] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Rotating fun word for progress bar
  const [funWord, setFunWord] = useState(() => FUN_WORDS[Math.floor(Math.random() * FUN_WORDS.length)]);
  useEffect(() => {
    if (!loading || !progress) return;
    const interval = setInterval(() => {
      setFunWord(FUN_WORDS[Math.floor(Math.random() * FUN_WORDS.length)]);
    }, 2000);
    return () => clearInterval(interval);
  }, [loading, progress]);

  // Inline editor state (manual mode)
  const [videoData, setVideoData] = useState<VideoData | null>(null);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(30);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const captionUndo = useUndo<CaptionSegment[]>([]);
  const captions = captionUndo.state;
  const setCaptions = captionUndo.set;
  const { saveDraft, loadDraft, clearDraft } = useDraft();
  const [clipFilename, setClipFilename] = useState<string | null>(null);
  const [captionStyle, setCaptionStyle] = useState<CaptionStyle>(DEFAULT_CAPTION_STYLE);
  const [activeTemplateId, setActiveTemplateId] = useState<string | undefined>();
  const [transcribing, setTranscribing] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Auto-save draft when editor state changes
  useEffect(() => {
    if (!videoData || captions.length === 0) return;
    saveDraft({
      url: url || "",
      start,
      end,
      language,
      captions,
      captionStyle,
    });
  }, [captions, captionStyle, start, end, saveDraft, videoData, url, language]);

  // Clear draft on successful clip generation
  useEffect(() => {
    if (clipFilename) clearDraft();
  }, [clipFilename, clearDraft]);

  // Load clip for editing from query param
  useEffect(() => {
    const editClipId = searchParams.get("editClipId");
    if (!editClipId || !isAuthenticated) return;

    fetch(`/api/clips/${editClipId}`)
      .then((r) => r.json())
      .then((clip) => {
        if (clip.error) return;
        if (clip.video?.fileExists && clip.video?.filename) {
          setVideoData({
            filename: clip.video.filename,
            title: clip.video.title || "Untitled",
            duration: clip.video.duration || 0,
          });
          setStart(clip.startTime || 0);
          setEnd(clip.endTime || 30);
          // Clear query param without full reload
          window.history.replaceState({}, "", "/");
        }
      })
      .catch(() => {});
  }, [searchParams, isAuthenticated]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setAutoTrimResult(null);
    setProgress(null);
    setLoading(true);

    if (!autoTrim) {
      // Manual flow: download and show inline editor
      try {
        const response = await fetch("/api/download", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to download video");
        }

        let startTime = 0;
        try {
          const parsed = new URL(url);
          const tParam = parsed.searchParams.get("t");
          if (tParam) {
            startTime = parseInt(tParam.replace("s", ""), 10) || 0;
          }
        } catch {}

        setVideoData({
          filename: data.filename,
          title: data.title,
          duration: data.duration,
        });
        setStart(Math.min(startTime, data.duration));
        setEnd(Math.min(startTime + 30, data.duration));
        setCaptions([]);
        setClipFilename(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
      return;
    }

    // Auto-trim flow: SSE stream
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/auto-trim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, purpose, generateCaptions, language }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Auto-trim failed");
      }

      const reader = response.body?.getReader();
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
          const dataLine = line
            .split("\n")
            .find((l) => l.startsWith("data: "));
          if (!dataLine) continue;

          const json = JSON.parse(dataLine.slice(6));

          if (json.type === "progress") {
            setProgress({
              step: json.step,
              message: json.message,
              percent: json.percent,
            });
          } else if (json.type === "done") {
            setAutoTrimResult({
              clipFilename: json.clipFilename,
              start: json.start,
              end: json.end,
              title: json.title,
              segmentReason: json.segmentReason,
              videoFilename: json.videoFilename,
              duration: json.duration,
              segments: json.segments || [],
            });
            setProgress({ step: "done", message: "Complete!", percent: 100 });
          } else if (json.type === "error") {
            throw new Error(json.message);
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  const handleCancel = () => {
    abortRef.current?.abort();
    setLoading(false);
    setProgress(null);
  };

  const handleBackToInput = () => {
    setVideoData(null);
    setCaptions([]);
    setClipFilename(null);
    setAutoTrimResult(null);
    setProgress(null);
    setError("");
  };

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

      if (!response.ok) {
        throw new Error(data.error || "Transcription failed");
      }

      setCaptions(data.segments);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transcription failed");
    } finally {
      setTranscribing(false);
    }
  }, [videoData, start, end, language]);

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

        if (!transcribeRes.ok) {
          throw new Error(transcribeData.error || "Transcription failed");
        }

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

      if (!response.ok) {
        throw new Error(data.error || "Clip generation failed");
      }

      setClipFilename(data.clipFilename);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Clip generation failed");
    } finally {
      setGenerating(false);
    }
  }, [videoData, start, end, captions, captionStyle, language, activeTemplateId]);

  const router = useRouter();

  // Regenerate auto-trim clip with layout applied
  const regenerateWithLayout = useCallback(async (): Promise<string> => {
    if (!autoTrimResult) throw new Error("No auto-trim result");
    if (autoTrimLayout.format === "original") return autoTrimResult.clipFilename;

    const response = await fetch("/api/clip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: autoTrimResult.videoFilename,
        start: autoTrimResult.start,
        end: autoTrimResult.end,
        captions: autoTrimResult.segments || [],
        layout: autoTrimLayout,
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Clip generation failed");
    return data.clipFilename;
  }, [autoTrimResult, autoTrimLayout]);

  const handleDownloadWithLayout = useCallback(async () => {
    if (!autoTrimResult) return;
    setDownloadingWithLayout(true);
    setError("");
    try {
      const filename = await regenerateWithLayout();
      const link = document.createElement("a");
      link.href = `/api/video?file=${encodeURIComponent(filename)}`;
      link.download = `clip_${autoTrimResult.videoFilename}`;
      link.click();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloadingWithLayout(false);
    }
  }, [autoTrimResult, regenerateWithLayout]);

  // Auto-trim edit: store data and navigate to /editor
  const handleEditAutoTrim = () => {
    if (!autoTrimResult) return;
    sessionStorage.setItem(
      "editorData",
      JSON.stringify({
        clipFilename: autoTrimResult.clipFilename,
        videoFilename: autoTrimResult.videoFilename,
        title: autoTrimResult.title,
        duration: autoTrimResult.duration,
        start: autoTrimResult.start,
        end: autoTrimResult.end,
        segments: autoTrimResult.segments,
        segmentReason: autoTrimResult.segmentReason,
      })
    );
    router.push("/editor");
  };

  const isAutoTrimReady = !autoTrim || purpose.trim().length > 0;

  // Fetch existing clips for this video
  const [videoClips, setVideoClips] = useState<ClipItem[]>([]);
  const [loadingVideoClips, setLoadingVideoClips] = useState(false);
  const [showPreviousClips, setShowPreviousClips] = useState(false);
  const generatedClipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!videoData || !isAuthenticated) {
      setVideoClips([]);
      return;
    }
    setLoadingVideoClips(true);
    fetch(`/api/clips?videoFilename=${encodeURIComponent(videoData.filename)}&limit=10`)
      .then((r) => r.json())
      .then((data) => setVideoClips(data.clips || []))
      .catch(() => {})
      .finally(() => setLoadingVideoClips(false));
  }, [videoData, isAuthenticated, clipFilename]);

  // Auto-scroll to generated clip when ready
  useEffect(() => {
    if (clipFilename && generatedClipRef.current) {
      generatedClipRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [clipFilename]);

  // ─── Inline Editor View ───
  if (videoData) {
    const videoUrl = `/api/video?file=${videoData.filename}`;
    const clipUrl = clipFilename ? `/api/video?file=${clipFilename}` : null;

    // Caption preview style computation
    const previewBgAlpha = Math.round((captionStyle.bgOpacity / 100) * 255)
      .toString(16)
      .padStart(2, "0");
    const previewText = captions[0]?.text || "Your caption will appear here";

    return (
      <div className="min-h-screen p-4 md:p-6">
        <div className="max-w-7xl mx-auto space-y-4">
          {/* Header */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBackToInput}
              className="text-muted-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <h1 className="text-lg font-semibold text-foreground truncate">
              {videoData.title}
            </h1>
          </div>

          {/* Existing clips banner - full width above the editor */}
          {videoClips.length > 0 && (
            <div className="rounded-lg border bg-muted/50 overflow-hidden">
              <button
                type="button"
                onClick={() => setShowPreviousClips(!showPreviousClips)}
                className="flex items-center justify-between w-full p-3 text-left hover:bg-muted/80 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Film className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    You have {videoClips.length} clip{videoClips.length !== 1 ? "s" : ""} from this video
                  </span>
                </div>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${showPreviousClips ? "rotate-180" : ""}`} />
              </button>
              {showPreviousClips && (
                <div className="px-3 pb-3">
                  {loadingVideoClips ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {videoClips.map((clip) => (
                        <Card key={clip.id} className="overflow-hidden">
                          <CardContent className="p-3 space-y-2">
                            <video
                              src={`/api/video?file=${encodeURIComponent(clip.filename)}`}
                              controls
                              className="w-full rounded bg-black aspect-video"
                            />
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>{formatTimestamp(clip.startTime)} - {formatTimestamp(clip.endTime)}</span>
                              <span>{new Date(clip.createdAt).toLocaleDateString()}</span>
                            </div>
                            <div className="flex gap-2">
                              <a href={`/api/video?file=${encodeURIComponent(clip.filename)}`} download className="flex-1">
                                <Button variant="outline" size="sm" className="w-full">
                                  <Download className="h-3 w-3 mr-1" /> Download
                                </Button>
                              </a>
                              <div className="flex-1">
                                <PublishButton clipFilename={clip.filename} videoTitle={videoData.title} clipDuration={clip.duration} language={language} />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ═══ Two-column editor layout ═══ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* ─── LEFT: Videos (sticky on desktop) ─── */}
            <div className="lg:sticky lg:top-4 lg:self-start space-y-4">
              {/* Original Video */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Original</p>
                <VideoPlayer
                  url={videoUrl}
                  start={start}
                  end={end}
                  playing={playing}
                  onProgress={setCurrentTime}
                />
              </div>

              {/* Generated Clip (or placeholder) */}
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
                        download={`clip_${videoData.filename}`}
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
                          videoTitle={videoData.title}
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
            </div>

            {/* ─── RIGHT: Controls (scrollable) ─── */}
            <div className="space-y-5">

              {/* Step 1: Select Range */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">1</span>
                  <span className="text-sm font-semibold text-foreground">Select Range</span>
                </div>
                <ClipSelector
                  duration={videoData.duration}
                  start={start}
                  end={end}
                  currentTime={currentTime}
                  onStartChange={setStart}
                  onEndChange={setEnd}
                />
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setPlaying(!playing)}
                    >
                      {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      {playing ? "Pause" : "Play Clip"}
                    </Button>
                    <AuthGate
                      fallback={
                        <Button size="sm" variant="outline" onClick={() => signIn("google")}>
                          <Lock className="h-4 w-4 mr-1" />
                          Sign in to transcribe
                        </Button>
                      }
                    >
                      <Button
                        size="sm"
                        onClick={handleTranscribe}
                        disabled={transcribing || end - start > 90}
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
                    </AuthGate>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-muted-foreground shrink-0">Language</label>
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                    >
                      {LANGUAGES.map((l) => (
                        <option key={l.code} value={l.code}>{l.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="border-t border-border" />

              {/* Step 2: Captions & Style */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">2</span>
                  <span className="text-sm font-semibold text-foreground">Captions & Style</span>
                </div>

                {/* Captions */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Captions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CaptionEditor
                      captions={captions}
                      onUpdate={setCaptions}
                      onUndo={captionUndo.undo}
                      onRedo={captionUndo.redo}
                      canUndo={captionUndo.canUndo}
                      canRedo={captionUndo.canRedo}
                    />
                  </CardContent>
                </Card>

                {/* Template Picker + Style */}
                <Card>
                  <CardContent className="pt-4 pb-2">
                    <TemplatePicker
                      onSelect={(template: ReelTemplate, id?: string) => {
                        setCaptionStyle(templateToCaptionStyle(template));
                        setActiveTemplateId(id);
                      }}
                    />
                  </CardContent>
                </Card>
                <CaptionStyleEditor style={captionStyle} onChange={(s) => {
                  setCaptionStyle(s);
                  setActiveTemplateId(undefined);
                }} />

                {/* Live Caption Preview */}
                <div className="rounded-lg border overflow-hidden">
                  <p className="text-xs font-medium text-muted-foreground px-4 pt-3 pb-2">Preview</p>
                  <div className="flex px-4 pb-4">
                    <div
                      className="w-full rounded-lg bg-neutral-900 relative p-6"
                      style={{
                        display: "flex",
                        justifyContent: captionStyle.position === "bottom" || captionStyle.position === "top" ? "center" : "center",
                        alignItems: captionStyle.position === "top" ? "flex-start" : captionStyle.position === "center" ? "center" : "flex-end",
                        minHeight: "120px",
                      }}
                    >
                      <span
                        className="rounded-md text-center leading-relaxed max-w-[90%]"
                        style={{
                          fontFamily: captionStyle.fontFamily,
                          fontSize: `${Math.min(captionStyle.fontSize * 0.5, 28)}px`,
                          color: captionStyle.textColor,
                          backgroundColor: `${captionStyle.bgColor}${previewBgAlpha}`,
                          fontWeight: captionStyle.bold ? "bold" : "normal",
                          fontStyle: captionStyle.italic ? "italic" : "normal",
                          padding: "6px 14px",
                          wordBreak: "break-word",
                        }}
                      >
                        {previewText}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-border" />

              {/* Step 3: Generate */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">3</span>
                  <span className="text-sm font-semibold text-foreground">Generate</span>
                </div>
                <AuthGate>
                  <Button
                    onClick={handleGenerateClip}
                    disabled={generating || end - start > 90}
                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                    size="lg"
                  >
                    {generating ? (
                      <>
                        <Loader2 className="animate-spin" />
                        Generating Clip...
                      </>
                    ) : (
                      "Generate Final Clip"
                    )}
                  </Button>
                </AuthGate>
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

  // ─── Landing Page (unauthenticated) ───
  if (!isAuthenticated && !videoData && !autoTrimResult) {
    return (
      <div className="min-h-screen">
        {/* Section 1: Hero */}
        <section className="px-4 py-16 md:py-24">
          <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Text + CTA */}
            <div className="space-y-6">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight">
                YouTube to Reels &amp; Shorts in seconds
              </h1>
              <p className="text-lg text-muted-foreground max-w-lg">
                Paste a link, pick a clip, add karaoke captions, and publish
                straight to Instagram and YouTube. All from one tool.
              </p>

              <Button
                onClick={() => signIn("google")}
                variant="outline"
                size="lg"
                className="gap-2"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Sign in with Google
              </Button>
            </div>

            {/* Right: Demo video */}
            <DemoVideo />
          </div>
        </section>

        {/* Section 2: Features */}
        <section className="border-t border-border bg-muted/30 px-4 py-20">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-center mb-12">
              Everything you need to repurpose content
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card>
                <CardContent className="pt-6 space-y-2">
                  <Sparkles className="h-8 w-8 text-primary" />
                  <h3 className="font-semibold">AI Auto-Trim</h3>
                  <p className="text-sm text-muted-foreground">
                    Tell the AI what you want and it picks the best segment
                    automatically. No scrubbing required.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 space-y-2">
                  <Film className="h-8 w-8 text-primary" />
                  <h3 className="font-semibold">Karaoke Captions</h3>
                  <p className="text-sm text-muted-foreground">
                    Word-by-word animated captions that highlight as
                    the speaker talks. Fully customisable style.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 space-y-2">
                  <Instagram className="h-8 w-8 text-primary" />
                  <h3 className="font-semibold">One-Click Publish</h3>
                  <p className="text-sm text-muted-foreground">
                    Post to Instagram Reels and YouTube Shorts directly
                    from ClipPost with AI-generated captions.
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="mt-12 text-center">
              <p className="text-sm text-muted-foreground mb-4">
                Free plan includes 1 clip and 1 publish per month.
                Upgrade to Pro for unlimited.
              </p>
              <Link href="/pricing">
                <Button variant="outline">View Pricing</Button>
              </Link>
            </div>
          </div>
        </section>
      </div>
    );
  }

  // ─── App View (authenticated or active session) ───
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-xl space-y-8">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-4xl font-bold tracking-tight">
              ClipPost
            </CardTitle>
            <CardDescription>
              Turn YouTube videos into captioned Reels & Shorts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex gap-2">
                <Input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Paste a YouTube URL..."
                  required
                  className="flex-1"
                  disabled={loading}
                />
                {!autoTrim && (
                  <Button
                    type="submit"
                    disabled={loading || !url}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="animate-spin" />
                        Downloading...
                      </>
                    ) : (
                      "Load Video"
                    )}
                  </Button>
                )}
              </div>

              {/* Auto Trim Toggle */}
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoTrim}
                  onChange={(e) => {
                    setAutoTrim(e.target.checked);
                    setAutoTrimResult(null);
                    setProgress(null);
                  }}
                  disabled={loading}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <span className="text-sm font-medium">
                  Auto Trim (AI picks the best clip)
                </span>
              </label>

              {/* Auto Trim Options */}
              {autoTrim && (
                <div className="space-y-3 pl-6 border-l-2 border-muted">
                  <Input
                    type="text"
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    placeholder='e.g. "best motivational part", "funniest moment"'
                    disabled={loading}
                  />
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={generateCaptions}
                      onChange={(e) =>
                        setGenerateCaptions(e.target.checked)
                      }
                      disabled={loading}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <span className="text-sm">
                      Burn in karaoke captions
                    </span>
                  </label>
                  <div className="space-y-1">
                    <label className="text-sm text-muted-foreground">Language</label>
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      disabled={loading}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      {LANGUAGES.map((l) => (
                        <option key={l.code} value={l.code}>{l.label}</option>
                      ))}
                    </select>
                  </div>
                  <Button
                    type="submit"
                    disabled={loading || !url || !isAutoTrimReady}
                    className="w-full"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="animate-spin" />
                        Processing...
                      </>
                    ) : (
                      "Auto Trim & Generate"
                    )}
                  </Button>
                </div>
              )}

              {/* Progress Bar */}
              {progress && loading && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-muted-foreground animate-pulse">
                      {funWord}
                    </span>
                    <span className="text-sm font-mono font-medium text-foreground">
                      {Math.round(progress.percent)}%
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-700 ease-out"
                      style={{ width: `${progress.percent}%` }}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCancel}
                    className="w-full"
                  >
                    Cancel
                  </Button>
                </div>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </form>

            {/* Auto-Trim Result Card */}
            {autoTrimResult && (
              <div className="mt-6 space-y-4 border-t pt-4">
                <div className="space-y-2">
                  <h3 className="font-semibold text-lg">{autoTrimResult.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {autoTrimResult.segmentReason}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Clip: {formatTimestamp(autoTrimResult.start)} -{" "}
                    {formatTimestamp(autoTrimResult.end)} (
                    {Math.round(autoTrimResult.end - autoTrimResult.start)}s)
                  </p>
                </div>

                {/* Video preview */}
                <div
                  className={`relative ${autoTrimLayout.format === "9:16" ? "mx-auto bg-black rounded-lg overflow-hidden" : ""}`}
                  style={
                    autoTrimLayout.format === "9:16"
                      ? {
                          aspectRatio: "9/16",
                          maxHeight: "50vh",
                          ...(autoTrimLayout.frame !== "fill"
                            ? { display: "flex", alignItems: "center", justifyContent: "center" }
                            : {}),
                        }
                      : {}
                  }
                >
                  {autoTrimLayout.format === "9:16" && autoTrimLayout.frame !== "fill" ? (
                    <div
                      style={{
                        width: `${getFrameConfig(autoTrimLayout.frame).videoWidthPct}%`,
                        borderRadius: `${getFrameConfig(autoTrimLayout.frame).radiusPct}%`,
                        overflow: "hidden",
                      }}
                    >
                      <video
                        src={`/api/video?file=${encodeURIComponent(autoTrimResult.clipFilename)}`}
                        controls
                        className="w-full rounded-lg"
                      />
                    </div>
                  ) : (
                    <video
                      src={`/api/video?file=${encodeURIComponent(autoTrimResult.clipFilename)}`}
                      controls
                      className="w-full rounded-lg"
                      style={autoTrimLayout.format === "9:16" ? { objectFit: "cover", height: "100%" } : {}}
                    />
                  )}
                </div>

                {/* Layout selector */}
                <div className="space-y-3 rounded-lg border p-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Layout</p>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">Format</p>
                    <div className="flex gap-1.5">
                      {OUTPUT_FORMATS.map((f) => (
                        <button
                          key={f.id}
                          onClick={() => setAutoTrimLayout((l) => ({ ...l, format: f.id }))}
                          className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                            autoTrimLayout.format === f.id
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {autoTrimLayout.format === "9:16" && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1.5">Frame</p>
                      <div className="flex flex-wrap gap-1.5">
                        {FRAME_TEMPLATES.map((t) => (
                          <button
                            key={t.id}
                            onClick={() => setAutoTrimLayout((l) => ({ ...l, frame: t.id }))}
                            className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                              autoTrimLayout.frame === t.id
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
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={handleDownloadWithLayout}
                    disabled={downloadingWithLayout}
                  >
                    {downloadingWithLayout ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Preparing...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={handleEditAutoTrim}
                  >
                    Edit
                  </Button>
                  <div className="flex-1">
                    <PublishButton
                      clipFilename={autoTrimResult.clipFilename}
                      videoTitle={autoTrimResult.title}
                      clipDuration={autoTrimResult.end - autoTrimResult.start}
                      language={language}
                      prepareClip={autoTrimLayout.format !== "original" ? regenerateWithLayout : undefined}
                    />
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <MyClips />

        <p className="text-center text-muted-foreground text-xs">
          Supports YouTube videos, shorts, and links
        </p>
      </div>
    </div>
  );
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
