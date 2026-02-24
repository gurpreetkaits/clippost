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
}

export default function PublishButton({
  clipFilename,
  videoTitle,
  clipDuration,
  disabled,
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
      // Publish to Instagram
      if (publishTo.instagram && selectedAccountId) {
        const res = await fetch("/api/publish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clipFilename,
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
            clipFilename,
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
            <AlertDescription>
              Published successfully!
              {results.instagram && ` Instagram: ${results.instagram}`}
              {results.youtube && (
                <>
                  {" "}
                  <a
                    href={`https://youtube.com/shorts/${results.youtube}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    View on YouTube
                  </a>
                </>
              )}
            </AlertDescription>
          </Alert>
        )}

        {status === "error" && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
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
