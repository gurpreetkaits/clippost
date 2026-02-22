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
import { Loader2, CheckCircle, AlertCircle } from "lucide-react";
import AccountSelector from "@/components/AccountSelector";

interface PublishButtonProps {
  clipFilename: string | null;
  disabled?: boolean;
}

export default function PublishButton({
  clipFilename,
  disabled,
}: PublishButtonProps) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<
    "idle" | "publishing" | "success" | "error"
  >("idle");
  const [caption, setCaption] = useState("");
  const [error, setError] = useState("");
  const [mediaId, setMediaId] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState("");

  const handlePublish = async () => {
    if (!clipFilename || !selectedAccountId) return;

    setStatus("publishing");
    setError("");

    try {
      const videoUrl = `${window.location.origin}/api/video?file=${clipFilename}`;

      const response = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoUrl,
          caption,
          accountId: selectedAccountId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to publish");
      }

      setMediaId(data.mediaId);
      setStatus("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to publish");
      setStatus("error");
    }
  };

  if (!clipFilename) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          disabled={disabled}
          className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold"
          size="lg"
        >
          Post to Instagram
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Post to Instagram</DialogTitle>
          <DialogDescription>
            Select an account, add a caption, and publish your Reel.
          </DialogDescription>
        </DialogHeader>

        <AccountSelector
          value={selectedAccountId}
          onValueChange={setSelectedAccountId}
        />

        <Textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Write a caption for your Reel..."
          rows={4}
        />

        {status === "success" && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              Published successfully! Media ID: {mediaId}
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
                disabled={status === "publishing" || !selectedAccountId}
                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
              >
                {status === "publishing" ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Publishing...
                  </>
                ) : (
                  "Publish Reel"
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
