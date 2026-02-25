"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle, AlertCircle, Instagram, Youtube, Sparkles } from "lucide-react";
import AccountSelector from "@/components/AccountSelector";

interface PublishButtonProps {
  clipFilename: string | null;
  videoTitle?: string;
  clipDuration?: number;
  disabled?: boolean;
  /** Transcript text from captions for context-aware caption generation */
  transcript?: string;
  /** Language code of the video content (e.g. "en-IN", "hi-IN") */
  language?: string;
  /** Called before publishing to regenerate clip with layout. Returns final clipFilename. */
  prepareClip?: () => Promise<string>;
}

function friendlyError(error: string): string {
  const lower = error.toLowerCase();
  if (lower.includes("token") || lower.includes("expired") || lower.includes("oauth"))
    return "Your account token has expired. Please reconnect your account in Settings.";
  if (lower.includes("tmpfiles") || lower.includes("upload"))
    return "Upload service is temporarily unavailable. Please try again in a moment.";
  if (lower.includes("not found") || lower.includes("404"))
    return "Clip file not found. Please regenerate the clip and try again.";
  if (lower.includes("limit") || lower.includes("403"))
    return "You've reached your publish limit for this month. Upgrade to Pro for unlimited publishing.";
  if (lower.includes("network") || lower.includes("fetch"))
    return "Network error. Check your connection and try again.";
  return error;
}

export default function PublishButton({
  clipFilename,
  videoTitle,
  clipDuration,
  disabled,
  transcript,
  language,
  prepareClip,
}: PublishButtonProps) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<
    "idle" | "publishing" | "success" | "error"
  >("idle");
  const [caption, setCaption] = useState("");
  const [error, setError] = useState("");
  const [results, setResults] = useState<{ instagram?: string; youtube?: string }>({});
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [publishTo, setPublishTo] = useState<{ instagram: boolean; youtube: boolean }>({
    instagram: true,
    youtube: false,
  });
  const [ytChannels, setYtChannels] = useState<{ id: string; channelTitle: string }[]>([]);
  const [selectedYtChannel, setSelectedYtChannel] = useState("");
  const [generatingCaption, setGeneratingCaption] = useState(false);

  const handleOpen = async (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      // Reset state on open
      setStatus("idle");
      setError("");
      setResults({});

      // Fetch YouTube channels
      try {
        const res = await fetch("/api/youtube-channels");
        const data = await res.json();
        const channels = data.channels || [];
        setYtChannels(channels);
        if (channels.length > 0 && !selectedYtChannel) {
          setSelectedYtChannel(channels[0].id);
        }
        if (channels.length > 0) {
          setPublishTo((p) => ({ ...p, youtube: true }));
        }
      } catch {}

      // Auto-generate caption if none exists
      if (!caption && videoTitle) {
        handleGenerateCaption();
      }
    }
  };

  const handleGenerateCaption = async () => {
    if (!videoTitle) return;
    setGeneratingCaption(true);
    try {
      const res = await fetch("/api/generate-caption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: videoTitle,
          duration: clipDuration || 30,
          platform: publishTo.youtube ? "youtube" : "instagram",
          transcript,
          language,
        }),
      });
      const data = await res.json();
      if (data.caption) setCaption(data.caption);
    } catch {}
    setGeneratingCaption(false);
  };

  const handlePublish = async () => {
    if (!clipFilename) return;
    setStatus("publishing");
    setError("");
    setResults({});

    const newResults: { instagram?: string; youtube?: string } = {};

    try {
      // Regenerate clip with layout if prepareClip is provided
      const finalFilename = prepareClip ? await prepareClip() : clipFilename;

      // Publish to Instagram
      if (publishTo.instagram && selectedAccountId) {
        const res = await fetch("/api/publish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clipFilename: finalFilename,
            caption,
            accountId: selectedAccountId,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Instagram publish failed");
        newResults.instagram = data.mediaId;
      }

      // Publish to YouTube
      if (publishTo.youtube && selectedYtChannel) {
        const res = await fetch("/api/publish-youtube", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clipFilename: finalFilename,
            title: videoTitle || "New Short",
            description: caption,
            channelId: selectedYtChannel,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "YouTube publish failed");
        newResults.youtube = data.videoId;
      }

      setResults(newResults);
      setStatus("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to publish");
      setStatus("error");
    }
  };

  if (!clipFilename) return null;

  const canPublish =
    (publishTo.instagram && selectedAccountId) ||
    (publishTo.youtube && selectedYtChannel);

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button
          disabled={disabled}
          className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold"
          size="lg"
        >
          Publish
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Publish Clip</DialogTitle>
          <DialogDescription>
            Choose where to publish and add a caption.
          </DialogDescription>
        </DialogHeader>

        {/* Platform toggles */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Publish to</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={publishTo.instagram ? "default" : "outline"}
              onClick={() =>
                setPublishTo((p) => ({ ...p, instagram: !p.instagram }))
              }
            >
              <Instagram className="h-4 w-4 mr-1.5" />
              Instagram
            </Button>
            <Button
              type="button"
              size="sm"
              variant={publishTo.youtube ? "default" : "outline"}
              onClick={() =>
                setPublishTo((p) => ({ ...p, youtube: !p.youtube }))
              }
              disabled={ytChannels.length === 0}
            >
              <Youtube className="h-4 w-4 mr-1.5" />
              YouTube Shorts
            </Button>
          </div>
          {ytChannels.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Connect a YouTube channel in Settings to publish Shorts.
            </p>
          )}
        </div>

        {/* Instagram account selector */}
        {publishTo.instagram && (
          <AccountSelector
            value={selectedAccountId}
            onValueChange={setSelectedAccountId}
          />
        )}

        {/* YouTube channel selector */}
        {publishTo.youtube && ytChannels.length > 0 && (
          <div className="space-y-1.5">
            <Label className="text-sm">YouTube Channel</Label>
            <select
              value={selectedYtChannel}
              onChange={(e) => setSelectedYtChannel(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {ytChannels.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  {ch.channelTitle}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Caption */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Caption</Label>
            {videoTitle && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleGenerateCaption}
                disabled={generatingCaption}
                className="text-xs h-7"
              >
                {generatingCaption ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <Sparkles className="h-3 w-3 mr-1" />
                )}
                AI Generate
              </Button>
            )}
          </div>
          <Textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Write a caption..."
            rows={4}
          />
        </div>

        {status === "success" && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription className="space-y-2">
              <p className="font-medium">Published successfully!</p>
              <div className="flex flex-col gap-1.5">
                {results.instagram && (
                  <a
                    href={`https://www.instagram.com/reel/${results.instagram}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-pink-600 hover:text-pink-700 underline"
                  >
                    <Instagram className="h-3.5 w-3.5" />
                    View on Instagram
                  </a>
                )}
                {results.youtube && (
                  <a
                    href={`https://youtube.com/shorts/${results.youtube}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700 underline"
                  >
                    <Youtube className="h-3.5 w-3.5" />
                    View on YouTube
                  </a>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {status === "error" && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <p>{friendlyError(error)}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handlePublish}
                className="mt-2 text-xs"
              >
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {!caption && status === "idle" && (
          <p className="text-xs text-amber-600">
            No caption set. Your clip will be published without a description.
          </p>
        )}

        <DialogFooter>
          {status !== "success" && (
            <>
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={status === "publishing"}
              >
                Cancel
              </Button>
              <Button
                onClick={handlePublish}
                disabled={status === "publishing" || !canPublish}
                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
              >
                {status === "publishing" ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Publishing...
                  </>
                ) : (
                  "Publish"
                )}
              </Button>
            </>
          )}
          {status === "success" && (
            <Button onClick={() => setOpen(false)}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
