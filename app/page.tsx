"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
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
  Settings,
  Download,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import PublishButton from "@/components/PublishButton";

interface AutoTrimResult {
  clipFilename: string;
  start: number;
  end: number;
  title: string;
  segmentReason: string;
}

interface ProgressState {
  step: string;
  message: string;
  percent: number;
}

const STEPS = [
  { key: "downloading", label: "Download" },
  { key: "extracting_audio", label: "Audio" },
  { key: "transcribing", label: "Transcribe" },
  { key: "analyzing", label: "Analyze" },
  { key: "generating_clip", label: "Generate" },
] as const;

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [autoTrim, setAutoTrim] = useState(false);
  const [purpose, setPurpose] = useState("");
  const [generateCaptions, setGenerateCaptions] = useState(true);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [result, setResult] = useState<AutoTrimResult | null>(null);
  const router = useRouter();
  const abortRef = useRef<AbortController | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setResult(null);
    setProgress(null);
    setLoading(true);

    if (!autoTrim) {
      // Existing flow: download and navigate to editor
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

        const params = new URLSearchParams({
          filename: data.filename,
          title: data.title,
          duration: data.duration.toString(),
          ...(startTime > 0 && { startTime: startTime.toString() }),
        });
        router.push(`/editor?${params.toString()}`);
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
        body: JSON.stringify({ url, purpose, generateCaptions }),
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
            setResult({
              clipFilename: json.clipFilename,
              start: json.start,
              end: json.end,
              title: json.title,
              segmentReason: json.segmentReason,
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

  const isAutoTrimReady = !autoTrim || purpose.trim().length > 0;

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-xl space-y-8">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-4xl font-bold tracking-tight">
              ClipPost
            </CardTitle>
            <CardDescription>
              Turn YouTube videos into captioned Instagram Reels
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
                    setResult(null);
                    setProgress(null);
                  }}
                  disabled={loading}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <span className="text-sm font-medium">
                  Auto Trim — AI picks the best clip
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
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${progress.percent}%` }}
                    />
                  </div>
                  <div className="flex justify-between">
                    {STEPS.map((s) => {
                      const stepIdx = STEPS.findIndex(
                        (x) => x.key === s.key
                      );
                      const currentIdx = STEPS.findIndex(
                        (x) => x.key === progress.step
                      );
                      const isDone = stepIdx < currentIdx;
                      const isCurrent = s.key === progress.step;
                      return (
                        <span
                          key={s.key}
                          className={`text-xs ${
                            isDone
                              ? "text-primary font-medium"
                              : isCurrent
                              ? "text-foreground font-semibold"
                              : "text-muted-foreground"
                          }`}
                        >
                          {isDone ? (
                            <CheckCircle2 className="inline h-3 w-3 mr-0.5" />
                          ) : null}
                          {s.label}
                        </span>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    {progress.message}
                  </p>
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

            {/* Result Card */}
            {result && (
              <div className="mt-6 space-y-4 border-t pt-4">
                <div className="space-y-2">
                  <h3 className="font-semibold text-lg">{result.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {result.segmentReason}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Clip: {formatTimestamp(result.start)} -{" "}
                    {formatTimestamp(result.end)} (
                    {Math.round(result.end - result.start)}s)
                  </p>
                </div>

                <video
                  src={`/api/video?file=${encodeURIComponent(result.clipFilename)}`}
                  controls
                  className="w-full rounded-lg"
                />

                <div className="flex gap-2">
                  <a
                    href={`/api/video?file=${encodeURIComponent(result.clipFilename)}`}
                    download
                    className="flex-1"
                  >
                    <Button variant="outline" className="w-full">
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  </a>
                  <div className="flex-1">
                    <PublishButton clipFilename={result.clipFilename} />
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="text-center text-muted-foreground text-xs space-y-2">
          <p>Supports YouTube videos, shorts, and links</p>
          <p>Requires yt-dlp and ffmpeg installed on the server</p>
          <Link
            href="/settings"
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Settings className="h-3 w-3" />
            Manage Instagram accounts
          </Link>
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
