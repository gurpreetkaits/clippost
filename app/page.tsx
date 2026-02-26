"use client";

import { useState, useRef, useCallback, useEffect, Suspense } from "react";
import { useSession, signIn } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import DemoVideo from "@/components/DemoVideo";
import PublishButton from "@/components/PublishButton";
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
  Lock,
  Clock,
  Instagram,
  Sparkles,
  Film,
  ChevronDown,
  Upload,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  VideoLayout,
  DEFAULT_LAYOUT,
  OUTPUT_FORMATS,
  FRAME_TEMPLATES,
  getFrameConfig,
} from "@/lib/video-layout";
import { LANGUAGES } from "@/lib/languages";

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

interface DownloadResult {
  filename: string;
  title: string;
  duration: number;
  id: string;
}

interface ProgressState {
  step: string;
  message: string;
  percent: number;
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

const FUN_WORDS = [
  "Philosophizing...", "Contemplating...", "Manifesting...", "Ruminating...",
  "Brainstorming...", "Hallucinating...", "Pondering...", "Daydreaming...",
  "Extrapolating...", "Vibing...", "Theorizing...", "Imagining...",
  "Synthesizing...", "Channeling...", "Conjuring...", "Calibrating...",
  "Meditating...", "Percolating...", "Harmonizing...", "Decoding...",
];

function MyClips() {
  const { status } = useSession();
  const [clips, setClips] = useState<ClipItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status !== "authenticated") { setLoading(false); return; }
    fetch("/api/clips?limit=3")
      .then((r) => r.json())
      .then((data) => setClips(data.clips || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [status]);

  if (status !== "authenticated") return null;
  if (loading) return (
    <div className="flex justify-center py-8">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );
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
                <p className="text-sm font-medium truncate">{clip.video?.title || "Untitled"}</p>
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
                  {clip.video && <span>Source: {formatTimestamp(clip.video.duration)}</span>}
                </div>
              </div>
              <a href={`/api/video?file=${encodeURIComponent(clip.filename)}`} download className="flex-shrink-0 self-center">
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
  const router = useRouter();
  const searchParams = useSearchParams();

  // Input mode: "youtube" or "upload"
  const [inputMode, setInputMode] = useState<"youtube" | "upload">("youtube");

  // YouTube input state
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [autoTrim, setAutoTrim] = useState(false);
  const [purpose, setPurpose] = useState("");
  const [generateCaptions, setGenerateCaptions] = useState(true);
  const [language, setLanguage] = useState("en");

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Download result (non-auto-trim)
  const [downloadResult, setDownloadResult] = useState<DownloadResult | null>(null);

  // Auto-trim state
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [autoTrimResult, setAutoTrimResult] = useState<AutoTrimResult | null>(null);
  const [autoTrimLayout, setAutoTrimLayout] = useState<VideoLayout>(DEFAULT_LAYOUT);
  const [downloadingWithLayout, setDownloadingWithLayout] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Fun word rotation
  const [funWord, setFunWord] = useState(() => FUN_WORDS[Math.floor(Math.random() * FUN_WORDS.length)]);
  useEffect(() => {
    if (!loading || !progress) return;
    const interval = setInterval(() => {
      setFunWord(FUN_WORDS[Math.floor(Math.random() * FUN_WORDS.length)]);
    }, 2000);
    return () => clearInterval(interval);
  }, [loading, progress]);

  // Pre-fill URL from query param (e.g. from Notes page)
  useEffect(() => {
    const prefillUrl = searchParams.get("url");
    if (prefillUrl) {
      setUrl(prefillUrl);
      setInputMode("youtube");
    }
  }, [searchParams]);

  // Fetch user preferences
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

  // Navigate to editor with video data
  const goToEditor = useCallback((filename: string, title: string, duration: number, startTime?: number) => {
    const params = new URLSearchParams({
      video: filename,
      title,
      duration: duration.toString(),
    });
    if (startTime) params.set("start", startTime.toString());
    params.set("end", Math.min((startTime || 0) + 30, duration).toString());
    router.push(`/editor?${params.toString()}`);
  }, [router]);

  // Handle file upload
  const handleFileUpload = useCallback(async (file: File) => {
    setUploading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Upload failed");

      goToEditor(data.filename, data.title, data.duration);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }, [goToEditor]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  }, [handleFileUpload]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
  }, [handleFileUpload]);

  // Handle YouTube URL submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setDownloadResult(null);
    setAutoTrimResult(null);
    setProgress(null);
    setLoading(true);

    if (!autoTrim) {
      // Manual flow: download then show result with action buttons
      try {
        const response = await fetch("/api/download", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to download video");

        setDownloadResult({
          filename: data.filename,
          title: data.title,
          duration: data.duration,
          id: data.id,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
      return;
    }

    // Auto-trim flow: SSE stream (stays on this page)
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
          const dataLine = line.split("\n").find((l) => l.startsWith("data: "));
          if (!dataLine) continue;
          const json = JSON.parse(dataLine.slice(6));

          if (json.type === "progress") {
            setProgress({ step: json.step, message: json.message, percent: json.percent });
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

  // Auto-trim result actions
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

  const handleEditDownload = () => {
    if (!downloadResult) return;
    let startTime = 0;
    try {
      const parsed = new URL(url);
      const tParam = parsed.searchParams.get("t");
      if (tParam) startTime = parseInt(tParam.replace("s", ""), 10) || 0;
    } catch {}
    goToEditor(downloadResult.filename, downloadResult.title, downloadResult.duration, startTime);
  };

  const isAutoTrimReady = !autoTrim || purpose.trim().length > 0;

  // ─── Landing Page (unauthenticated, no active session) ───
  if (!isAuthenticated && !autoTrimResult) {
    return (
      <div className="min-h-screen">
        <section className="px-4 py-16 md:py-24">
          <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight">
                YouTube to Reels &amp; Shorts in seconds
              </h1>
              <p className="text-lg text-muted-foreground max-w-lg">
                Paste a YouTube or Instagram link, upload a video, pick a clip,
                add karaoke captions, and publish straight to Instagram and YouTube.
              </p>
              <Button onClick={() => signIn("google")} variant="outline" size="lg" className="gap-2">
                <svg viewBox="0 0 24 24" className="h-5 w-5">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Sign in with Google
              </Button>
            </div>
            <DemoVideo />
          </div>
        </section>

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
                    Tell the AI what you want and it picks the best segment automatically. No scrubbing required.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 space-y-2">
                  <Film className="h-8 w-8 text-primary" />
                  <h3 className="font-semibold">Karaoke Captions</h3>
                  <p className="text-sm text-muted-foreground">
                    Word-by-word animated captions that highlight as the speaker talks. Fully customisable style.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 space-y-2">
                  <Upload className="h-8 w-8 text-primary" />
                  <h3 className="font-semibold">Upload &amp; Edit</h3>
                  <p className="text-sm text-muted-foreground">
                    Upload your own video files directly. Trim, add captions, and export. No YouTube required.
                  </p>
                </CardContent>
              </Card>
            </div>
            <div className="mt-12 text-center">
              <p className="text-sm text-muted-foreground mb-4">
                Free plan includes 1 clip and 1 publish per month. Upgrade to Pro for unlimited.
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
              Turn videos into captioned Reels &amp; Shorts
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Input Mode Tabs */}
            <div className="flex mb-4 rounded-lg border overflow-hidden">
              <button
                type="button"
                onClick={() => setInputMode("youtube")}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  inputMode === "youtube"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                }`}
              >
                Paste URL
              </button>
              <button
                type="button"
                onClick={() => setInputMode("upload")}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  inputMode === "upload"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                }`}
              >
                Upload File
              </button>
            </div>

            {inputMode === "youtube" ? (
              /* ─── YouTube URL Input ─── */
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="Paste a YouTube or Instagram Reel URL..."
                    required
                    className="flex-1"
                    disabled={loading}
                  />
                  {!autoTrim && (
                    <Button type="submit" disabled={loading || !url}>
                      {loading ? (
                        <><Loader2 className="animate-spin" /> Loading...</>
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
                  <span className="text-sm font-medium">Auto Trim (AI picks the best clip)</span>
                </label>

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
                        onChange={(e) => setGenerateCaptions(e.target.checked)}
                        disabled={loading}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <span className="text-sm">Burn in karaoke captions</span>
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
                    <Button type="submit" disabled={loading || !url || !isAutoTrimReady} className="w-full">
                      {loading ? (
                        <><Loader2 className="animate-spin" /> Processing...</>
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
                      <span className="text-sm text-muted-foreground animate-pulse">{funWord}</span>
                      <span className="text-sm font-mono font-medium text-foreground">{Math.round(progress.percent)}%</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-700 ease-out"
                        style={{ width: `${progress.percent}%` }}
                      />
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={handleCancel} className="w-full">
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
            ) : (
              /* ─── File Upload Input ─── */
              <div className="space-y-4">
                <div
                  className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                    dragOver
                      ? "border-primary bg-primary/5"
                      : "border-muted-foreground/25 hover:border-muted-foreground/50"
                  }`}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/mp4,video/quicktime,video/webm,video/x-matroska,.mp4,.mov,.webm,.mkv"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  {uploading ? (
                    <div className="space-y-2">
                      <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                      <p className="text-sm text-muted-foreground">Uploading & processing...</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="h-8 w-8 text-muted-foreground/50 mx-auto" />
                      <p className="text-sm font-medium">
                        Drop a video file here, or click to browse
                      </p>
                      <p className="text-xs text-muted-foreground">
                        MP4, MOV, WebM, MKV &bull; Max 500MB (2GB for Pro)
                      </p>
                    </div>
                  )}
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {/* Download Result Card */}
            {downloadResult && (
              <div className="mt-6 space-y-4 border-t pt-4">
                <div className="space-y-2">
                  <h3 className="font-semibold text-lg">{downloadResult.title}</h3>
                  <p className="text-xs text-muted-foreground">
                    Duration: {formatTimestamp(downloadResult.duration)}
                  </p>
                </div>

                <video
                  src={`/api/video?file=${encodeURIComponent(downloadResult.filename)}`}
                  controls
                  className="w-full rounded-lg"
                />

                <div className="flex gap-2">
                  <a
                    href={`/api/video?file=${encodeURIComponent(downloadResult.filename)}`}
                    download={`${downloadResult.title}.mp4`}
                    className="flex-1"
                  >
                    <Button variant="outline" className="w-full">
                      <Download className="h-4 w-4 mr-2" /> Download
                    </Button>
                  </a>
                  <Button variant="outline" className="flex-1" onClick={handleEditDownload}>
                    <Film className="h-4 w-4 mr-2" /> Edit
                  </Button>
                  <div className="flex-1">
                    <PublishButton
                      clipFilename={downloadResult.filename}
                      videoTitle={downloadResult.title}
                      clipDuration={downloadResult.duration}
                      language={language}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Auto-Trim Result Card */}
            {autoTrimResult && (
              <div className="mt-6 space-y-4 border-t pt-4">
                <div className="space-y-2">
                  <h3 className="font-semibold text-lg">{autoTrimResult.title}</h3>
                  <p className="text-sm text-muted-foreground">{autoTrimResult.segmentReason}</p>
                  <p className="text-xs text-muted-foreground">
                    Clip: {formatTimestamp(autoTrimResult.start)} - {formatTimestamp(autoTrimResult.end)} ({Math.round(autoTrimResult.end - autoTrimResult.start)}s)
                  </p>
                </div>

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
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Preparing...</>
                    ) : (
                      <><Download className="h-4 w-4 mr-2" /> Download</>
                    )}
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={handleEditAutoTrim}>
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
          Supports YouTube, Instagram Reels, and file uploads
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
