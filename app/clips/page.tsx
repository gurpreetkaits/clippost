"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Download,
  Clock,
  Instagram,
  Youtube,
  Sparkles,
  Film,
  ArrowLeft,
  Trash2,
  Pencil,
} from "lucide-react";

interface ClipItem {
  id: string;
  filename: string;
  startTime: number;
  endTime: number;
  duration: number;
  hasCaptions: boolean;
  method: "MANUAL" | "AUTO_TRIM";
  publishedAt: string | null;
  instagramMediaId: string | null;
  youtubeVideoId: string | null;
  createdAt: string;
  video: {
    title: string;
    duration: number;
    youtubeId: string;
    sourceUrl: string;
    thumbnail: string;
  } | null;
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function ClipsPage() {
  const router = useRouter();
  const [clips, setClips] = useState<ClipItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<"FREE" | "PRO">("FREE");
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/clips").then((r) => r.json()),
      fetch("/api/usage").then((r) => r.json()),
    ])
      .then(([clipsData, usageData]) => {
        setClips(clipsData.clips || []);
        setPlan(usageData.plan || "FREE");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (clipId: string) => {
    if (!confirm("Delete this clip? This cannot be undone.")) return;
    setDeleting(clipId);
    try {
      const res = await fetch(`/api/clips/${clipId}`, { method: "DELETE" });
      if (res.ok) {
        setClips((prev) => prev.filter((c) => c.id !== clipId));
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete");
      }
    } catch {
      alert("Failed to delete clip");
    } finally {
      setDeleting(null);
    }
  };

  const handleEdit = (clip: ClipItem) => {
    router.push(`/editor?clip=${clip.id}`);
  };

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
          <h1 className="text-xl font-semibold text-foreground">My Clips</h1>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : clips.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <p className="text-muted-foreground">No clips yet.</p>
            <Link href="/">
              <Button variant="outline">Create your first clip</Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {clips.map((clip) => (
              <Card key={clip.id} className="overflow-hidden flex flex-col">
                {clip.video?.thumbnail && (
                  <div className="relative w-full aspect-video bg-muted">
                    <Image
                      src={clip.video.thumbnail}
                      alt={clip.video.title || "Video thumbnail"}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                )}
                <div className="p-4 flex flex-col flex-1 gap-2">
                  <p className="text-sm font-medium truncate">
                    {clip.video?.title || "Untitled"}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className="text-xs gap-1">
                      <Clock className="h-3 w-3" />
                      {formatTimestamp(clip.startTime)}&ndash;{formatTimestamp(clip.endTime)}
                    </Badge>
                    <Badge variant="secondary" className="text-xs gap-1">
                      {clip.method === "AUTO_TRIM" ? (
                        <><Sparkles className="h-3 w-3" /> Auto</>
                      ) : (
                        <><Film className="h-3 w-3" /> Manual</>
                      )}
                    </Badge>
                    {clip.hasCaptions && (
                      <Badge variant="outline" className="text-xs">
                        Captions
                      </Badge>
                    )}
                    {clip.publishedAt && clip.instagramMediaId && (
                      <a
                        href={`https://www.instagram.com/reel/${clip.instagramMediaId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Badge variant="default" className="text-xs gap-1 cursor-pointer hover:opacity-80">
                          <Instagram className="h-3 w-3" /> View Reel
                        </Badge>
                      </a>
                    )}
                    {clip.publishedAt && !clip.instagramMediaId && (
                      <Badge variant="default" className="text-xs gap-1">
                        <Instagram className="h-3 w-3" /> Published
                      </Badge>
                    )}
                    {clip.youtubeVideoId && (
                      <a
                        href={`https://youtube.com/shorts/${clip.youtubeVideoId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Badge variant="default" className="text-xs gap-1 cursor-pointer hover:opacity-80">
                          <Youtube className="h-3 w-3" /> View Short
                        </Badge>
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{new Date(clip.createdAt).toLocaleDateString()}</span>
                    <span>{Math.round(clip.duration)}s clip</span>
                  </div>
                  <div className="flex items-center gap-1 mt-auto pt-2 border-t border-border">
                    <a
                      href={`/api/video?file=${encodeURIComponent(clip.filename)}`}
                      download
                    >
                      <Button variant="ghost" size="sm" title="Download clip">
                        <Download className="h-4 w-4" />
                      </Button>
                    </a>
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Edit clip"
                      onClick={() => handleEdit(clip)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {clip.video && (
                      <a
                        href={clip.video.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button variant="ghost" size="sm" title="View source">
                          <Youtube className="h-4 w-4" />
                        </Button>
                      </a>
                    )}
                    <div className="ml-auto">
                      {plan === "PRO" ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Delete clip"
                          onClick={() => handleDelete(clip.id)}
                          disabled={deleting === clip.id}
                          className="text-destructive hover:text-destructive"
                        >
                          {deleting === clip.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Upgrade to Pro to delete clips"
                          className="text-muted-foreground"
                          asChild
                        >
                          <Link href="/pricing">
                            <Trash2 className="h-4 w-4" />
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
