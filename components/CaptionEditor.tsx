"use client";

import { CaptionSegment } from "@/lib/ffmpeg";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

interface CaptionEditorProps {
  captions: CaptionSegment[];
  onUpdate: (captions: CaptionSegment[]) => void;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(1);
  return `${mins}:${secs.padStart(4, "0")}`;
}

export default function CaptionEditor({
  captions,
  onUpdate,
}: CaptionEditorProps) {
  const handleTextChange = (index: number, text: string) => {
    const updated = [...captions];
    updated[index] = { ...updated[index], text, words: undefined };
    onUpdate(updated);
  };

  const handleDelete = (index: number) => {
    const updated = captions.filter((_, i) => i !== index);
    onUpdate(updated);
  };

  if (captions.length === 0) {
    return (
      <div className="text-muted-foreground text-sm text-center py-8">
        No captions yet. Click &quot;Transcribe&quot; to auto-generate captions.
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
      {captions.map((caption, index) => (
        <div
          key={index}
          className="flex gap-2 items-start rounded-lg p-3 bg-muted/50"
        >
          <Badge variant="outline" className="mt-1.5 font-mono text-xs whitespace-nowrap shrink-0">
            {formatTime(caption.start)} - {formatTime(caption.end)}
          </Badge>
          <Textarea
            value={caption.text}
            onChange={(e) => handleTextChange(index, e.target.value)}
            rows={2}
            className="flex-1 resize-none text-sm"
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleDelete(index)}
            className="shrink-0 text-muted-foreground hover:text-destructive"
            title="Remove caption"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}
