"use client";

import { useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import ClipSelector from "@/components/ClipSelector";
import CaptionEditor from "@/components/CaptionEditor";
import CaptionPreview from "@/components/CaptionPreview";
import PublishButton from "@/components/PublishButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, ArrowLeft, Play, Pause, AlertCircle, Settings } from "lucide-react";
import Link from "next/link";

const VideoPlayer = dynamic(() => import("@/components/VideoPlayer"), {
  ssr: false,
});

interface CaptionSegment {
  start: number;
  end: number;
  text: string;
}

function EditorContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const filename = searchParams.get("filename") || "";
  const title = searchParams.get("title") || "";
  const totalDuration = parseFloat(searchParams.get("duration") || "0");
  const startTime = parseFloat(searchParams.get("startTime") || "0");

  const [start, setStart] = useState(Math.min(startTime, totalDuration));
  const [end, setEnd] = useState(Math.min(startTime + 30, totalDuration));
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [captions, setCaptions] = useState<CaptionSegment[]>([]);
  const [clipFilename, setClipFilename] = useState<string | null>(null);

  const [transcribing, setTranscribing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const videoUrl = `/api/video?file=${filename}`;
  const clipUrl = clipFilename
    ? `/api/video?file=${clipFilename}`
    : null;

  const handleTranscribe = useCallback(async () => {
    setTranscribing(true);
    setError("");

    try {
      const response = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename, start, end }),
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
  }, [filename, start, end]);

  const handleGenerateClip = useCallback(async () => {
    setGenerating(true);
    setError("");

    try {
      const response = await fetch("/api/clip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename, start, end, captions }),
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
  }, [filename, start, end, captions]);

  if (!filename) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">No video loaded.</p>
          <Button variant="ghost" onClick={() => router.push("/")}>
            <ArrowLeft />
            Go back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/")}
              className="mb-1 text-muted-foreground"
            >
              <ArrowLeft />
              Back
            </Button>
            <h1 className="text-xl font-semibold text-foreground truncate max-w-lg">
              {title}
            </h1>
          </div>
          <Link href="/settings">
            <Button variant="ghost" size="sm" title="Settings">
              <Settings className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left column: Video + Clip Selector */}
          <div className="space-y-4">
            <div className="relative">
              <VideoPlayer
                url={videoUrl}
                start={start}
                end={end}
                playing={playing}
                onProgress={setCurrentTime}
              />
              <CaptionPreview captions={captions} currentTime={currentTime} />
            </div>

            <ClipSelector
              duration={totalDuration}
              start={start}
              end={end}
              currentTime={currentTime}
              onStartChange={setStart}
              onEndChange={setEnd}
            />

            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPlaying(!playing)}
              >
                {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {playing ? "Pause" : "Play Clip"}
              </Button>
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
            </div>
          </div>

          {/* Right column: Captions + Generate + Publish */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Captions</CardTitle>
              </CardHeader>
              <CardContent>
                <CaptionEditor captions={captions} onUpdate={setCaptions} />
              </CardContent>
            </Card>

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

            {/* Final clip preview */}
            {clipUrl && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Final Clip Preview</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <video
                    src={clipUrl}
                    controls
                    className="w-full rounded-lg bg-black"
                  />
                  <a
                    href={clipUrl}
                    download={`clip_${filename}`}
                    className="block text-center text-blue-400 hover:text-blue-300 text-sm transition-colors"
                  >
                    Download Clip
                  </a>
                </CardContent>
              </Card>
            )}

            <PublishButton clipFilename={clipFilename} />

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
