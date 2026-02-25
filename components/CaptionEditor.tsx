"use client";

import { useRef, useEffect, useCallback } from "react";

interface CaptionSegment {
  start: number;
  end: number;
  text: string;
  words?: { word: string; start: number; end: number }[];
  confidence?: "high" | "medium" | "low";
}
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Undo2, Redo2 } from "lucide-react";

interface CaptionEditorProps {
  captions: CaptionSegment[];
  onUpdate: (captions: CaptionSegment[]) => void;
  selectedIndex?: number | null;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(1);
  return `${mins}:${secs.padStart(4, "0")}`;
}

export default function CaptionEditor({
  captions,
  onUpdate,
  selectedIndex,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: CaptionEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Auto-scroll selected caption into view
  useEffect(() => {
    if (selectedIndex == null) return;
    const el = rowRefs.current.get(selectedIndex);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selectedIndex]);

  const handleTextChange = (index: number, text: string) => {
    const updated = [...captions];
    updated[index] = { ...updated[index], text, words: undefined };
    onUpdate(updated);
  };

  const handleDelete = (index: number) => {
    const updated = captions.filter((_, i) => i !== index);
    onUpdate(updated);
  };

  // Keyboard shortcut for undo/redo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          onRedo?.();
        } else {
          onUndo?.();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onUndo, onRedo]);

  if (captions.length === 0) {
    return (
      <div className="text-muted-foreground text-sm text-center py-8">
        No captions yet. Click &quot;Transcribe&quot; to auto-generate captions.
      </div>
    );
  }

  return (
    <div>
      {(onUndo || onRedo) && (
        <div className="flex gap-1 mb-2 justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={onUndo}
            disabled={!canUndo}
            className="h-7 w-7 p-0"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRedo}
            disabled={!canRedo}
            className="h-7 w-7 p-0"
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    <div ref={containerRef} className="space-y-2 max-h-80 overflow-y-auto pr-2">
      {captions.map((caption, index) => (
        <div
          key={index}
          ref={(el) => {
            if (el) rowRefs.current.set(index, el);
            else rowRefs.current.delete(index);
          }}
          className={`flex gap-2 items-start rounded-lg p-3 transition-colors ${
            selectedIndex === index
              ? "bg-primary/15 ring-1 ring-primary/40"
              : "bg-muted/50"
          }`}
        >
          <div className="flex flex-col gap-1 shrink-0 mt-1.5">
            <Badge variant="outline" className="font-mono text-xs whitespace-nowrap">
              {formatTime(caption.start)} - {formatTime(caption.end)}
            </Badge>
            {caption.confidence && caption.confidence !== "high" && (
              <Badge
                variant="outline"
                className={`text-[10px] whitespace-nowrap ${
                  caption.confidence === "low"
                    ? "border-amber-500/50 text-amber-600"
                    : "border-yellow-500/50 text-yellow-600"
                }`}
              >
                {caption.confidence === "low" ? "Low conf." : "Est. timing"}
              </Badge>
            )}
          </div>
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
    </div>
  );
}
