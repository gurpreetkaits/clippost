"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, Settings } from "lucide-react";
import Link from "next/link";

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

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

      // Extract t= (start time) parameter from the YouTube URL
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
  };

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
                />
                <Button type="submit" disabled={loading || !url}>
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin" />
                      Downloading...
                    </>
                  ) : (
                    "Load Video"
                  )}
                </Button>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </form>
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
