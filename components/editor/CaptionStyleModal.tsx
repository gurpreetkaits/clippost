"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import CaptionStyleEditor from "@/components/CaptionStyleEditor";
import { CaptionStyle } from "@/lib/caption-style";
import { ZONE_PRESETS, configToTemplate, templateToCaptionStyle } from "@/lib/caption-template";
import type { ReelTemplate } from "@/lib/caption-template";
import { Undo2, RotateCcw, Settings, LayoutGrid, Check, GripHorizontal } from "lucide-react";

interface CaptionStyleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  captionStyle: CaptionStyle;
  onCaptionStyleChange: (style: CaptionStyle) => void;
  onTemplateSelect: (template: ReelTemplate, id?: string) => void;
  onUndo: () => void;
  onReset: () => void;
  canUndo: boolean;
}

/* ---------- Reel frame preview with Instagram-like UI ---------- */

const PREVIEW_SAMPLE_TEXT = "This is how your caption looks";

const POSITION_CONFIG: Record<string, { anchor: "top" | "bottom" | "center"; pct: number }> = {
  top:     { anchor: "top",    pct: 6 },
  center:  { anchor: "center", pct: 50 },
  bottom:  { anchor: "bottom", pct: 22 },
  custom:  { anchor: "bottom", pct: 22 },
};

function ReelPreview({ style, height = 320 }: { style: CaptionStyle; height?: number }) {
  const config = POSITION_CONFIG[style.position] ?? POSITION_CONFIG.bottom;
  const width = Math.round(height * (9 / 16));

  const bgAlpha = Math.round((style.bgOpacity / 100) * 255)
    .toString(16)
    .padStart(2, "0");

  const previewScale = height / 1920;
  const fontSize = Math.max(8, Math.round(style.fontSize * previewScale));
  const boxPad = Math.max(2, Math.round(style.fontSize * 0.5 * previewScale));

  const posStyle: React.CSSProperties = { maxWidth: "85%" };
  if (config.anchor === "bottom") {
    posStyle.bottom = `${config.pct}%`;
    posStyle.left = "50%";
    posStyle.transform = "translateX(-50%)";
  } else if (config.anchor === "top") {
    posStyle.top = `${config.pct}%`;
    posStyle.left = "50%";
    posStyle.transform = "translateX(-50%)";
  } else {
    posStyle.top = "50%";
    posStyle.left = "50%";
    posStyle.transform = "translate(-50%, -50%)";
  }

  return (
    <div
      className="relative rounded-xl overflow-hidden bg-gradient-to-br from-neutral-800 via-neutral-900 to-black border border-border shrink-0"
      style={{ width, height }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-neutral-700/30 via-transparent to-neutral-900/50" />

      {/* Instagram top bar */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center gap-1.5 px-2.5 pt-3 pb-1">
        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-pink-500 to-yellow-400" />
        <span className="text-[8px] text-white font-semibold">username</span>
        <span className="text-[7px] text-white/50 ml-auto">Follow</span>
      </div>

      {/* Instagram right side icons */}
      <div className="absolute right-2 bottom-[52px] z-20 flex flex-col items-center gap-3">
        <div className="w-4 h-4 flex items-center justify-center">
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" className="w-3.5 h-3.5">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </div>
        <div className="w-4 h-4 flex items-center justify-center">
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" className="w-3.5 h-3.5">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <div className="w-4 h-4 flex items-center justify-center">
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" className="w-3.5 h-3.5">
            <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </div>
      </div>

      {/* Instagram bottom bar */}
      <div className="absolute bottom-0 left-0 right-0 z-20 px-2.5 pb-2.5 pt-6 bg-gradient-to-t from-black/70 to-transparent">
        <p className="text-[7px] text-white/90 leading-tight mb-1">
          <span className="font-semibold">username</span>{" "}
          <span className="text-white/60">Amazing video! #reels</span>
        </p>
        <p className="text-[6px] text-white/50 flex items-center gap-1">
          <span>&#9835;</span> Original Audio
        </p>
      </div>

      {/* Caption */}
      <div className="absolute z-10 pointer-events-none" style={posStyle}>
        <div
          className="text-center whitespace-nowrap"
          style={{
            fontFamily: style.fontFamily,
            fontSize: `${fontSize}px`,
            padding: `${boxPad}px`,
            color: style.textColor,
            backgroundColor: `${style.bgColor}${bgAlpha}`,
            fontWeight: style.bold ? "bold" : "normal",
            fontStyle: style.italic ? "italic" : "normal",
            borderRadius: `${Math.max(1, Math.round(boxPad * 0.3))}px`,
          }}
        >
          {PREVIEW_SAMPLE_TEXT}
        </div>
      </div>

      {/* Safe zone */}
      <div
        className="absolute left-0 right-0 border-t border-dashed border-red-500/30 z-5"
        style={{ bottom: "18%" }}
      />
      <span
        className="absolute text-[5px] text-red-400/50 z-5"
        style={{ bottom: "18.5%", right: 4 }}
      >
        IG UI
      </span>
    </div>
  );
}

/* ---------- Template card with mini preview ---------- */

interface SavedTemplate {
  id: string;
  name: string;
  config: Omit<ReelTemplate, "name">;
  isDefault: boolean;
}

function TemplateCard({
  name,
  style,
  active,
  onClick,
}: {
  name: string;
  style: CaptionStyle;
  active: boolean;
  onClick: () => void;
}) {
  const config = POSITION_CONFIG[style.position] ?? POSITION_CONFIG.bottom;
  const previewHeight = 160;
  const previewWidth = Math.round(previewHeight * (9 / 16));

  const bgAlpha = Math.round((style.bgOpacity / 100) * 255)
    .toString(16)
    .padStart(2, "0");

  const previewScale = previewHeight / 1920;
  const fontSize = Math.max(6, Math.round(style.fontSize * previewScale));
  const boxPad = Math.max(1, Math.round(style.fontSize * 0.5 * previewScale));

  const posStyle: React.CSSProperties = { maxWidth: "90%" };
  if (config.anchor === "bottom") {
    posStyle.bottom = `${config.pct}%`;
    posStyle.left = "50%";
    posStyle.transform = "translateX(-50%)";
  } else if (config.anchor === "top") {
    posStyle.top = `${config.pct}%`;
    posStyle.left = "50%";
    posStyle.transform = "translateX(-50%)";
  } else {
    posStyle.top = "50%";
    posStyle.left = "50%";
    posStyle.transform = "translate(-50%, -50%)";
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex flex-col items-center gap-1.5 p-2 rounded-lg border transition-all ${
        active
          ? "border-blue-500 bg-blue-500/10"
          : "border-border hover:border-muted-foreground/40 hover:bg-muted/30"
      }`}
    >
      {active && (
        <div className="absolute top-1.5 right-1.5 z-30">
          <Check className="h-3.5 w-3.5 text-blue-500" />
        </div>
      )}

      {/* Mini reel preview */}
      <div
        className="relative rounded-lg overflow-hidden bg-gradient-to-br from-neutral-800 via-neutral-900 to-black"
        style={{ width: previewWidth, height: previewHeight }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-neutral-700/20 via-transparent to-neutral-900/40" />
        <div className="absolute z-10 pointer-events-none" style={posStyle}>
          <div
            className="text-center whitespace-nowrap"
            style={{
              fontFamily: style.fontFamily,
              fontSize: `${fontSize}px`,
              padding: `${boxPad}px`,
              color: style.textColor,
              backgroundColor: `${style.bgColor}${bgAlpha}`,
              fontWeight: style.bold ? "bold" : "normal",
              fontStyle: style.italic ? "italic" : "normal",
              borderRadius: `${Math.max(1, Math.round(boxPad * 0.2))}px`,
            }}
          >
            Sample text
          </div>
        </div>
      </div>

      <span className="text-[11px] font-medium truncate max-w-full">{name}</span>
    </button>
  );
}

/* ---------- Main modal ---------- */

export default function CaptionStyleModal({
  open,
  onOpenChange,
  captionStyle,
  onCaptionStyleChange,
  onTemplateSelect,
  onUndo,
  onReset,
  canUndo,
}: CaptionStyleModalProps) {
  const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>([]);
  const [activePresetName, setActivePresetName] = useState<string | null>(null);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);

  // --- Drag state ---
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  // Reset position when modal opens
  useEffect(() => {
    if (open) {
      setDragOffset({ x: 0, y: 0 });
    }
  }, [open]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    // Only drag from the header area, ignore buttons/inputs
    if ((e.target as HTMLElement).closest("button, input, select")) return;
    dragging.current = true;
    dragStart.current = { x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [dragOffset]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    setDragOffset({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y,
    });
  }, []);

  const onPointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  useEffect(() => {
    if (open) {
      fetch("/api/templates")
        .then((r) => (r.ok ? r.json() : []))
        .then(setSavedTemplates)
        .catch(() => {});
    }
  }, [open]);

  const handlePresetSelect = (preset: ReelTemplate) => {
    setActivePresetName(preset.name);
    setActiveTemplateId(null);
    onTemplateSelect({ ...preset });
  };

  const handleSavedSelect = (t: SavedTemplate) => {
    setActiveTemplateId(t.id);
    setActivePresetName(null);
    onTemplateSelect(configToTemplate(t.name, t.config), t.id);
  };

  const handleStyleChange = (s: CaptionStyle) => {
    setActivePresetName(null);
    setActiveTemplateId(null);
    onCaptionStyleChange(s);
  };

  const handleReset = () => {
    setActivePresetName(null);
    setActiveTemplateId(null);
    onReset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-4xl max-h-[90vh] overflow-y-auto"
        style={{
          transform: `translate(calc(-50% + ${dragOffset.x}px), calc(-50% + ${dragOffset.y}px))`,
        }}
      >
        {/* Draggable header */}
        <div
          className="flex items-center justify-between cursor-grab active:cursor-grabbing select-none -mx-6 -mt-6 px-6 pt-5 pb-3 border-b"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          <div className="flex items-center gap-2">
            <GripHorizontal className="h-4 w-4 text-muted-foreground/50" />
            <DialogTitle>Caption Style</DialogTitle>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onUndo}
              disabled={!canUndo}
              title="Undo style change"
            >
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1 text-xs"
              onClick={handleReset}
              title="Reset to default style"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </Button>
          </div>
        </div>

        <Tabs defaultValue="settings" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="settings" className="flex-1">
              <Settings className="h-3.5 w-3.5 mr-1.5" />
              Settings
            </TabsTrigger>
            <TabsTrigger value="templates" className="flex-1">
              <LayoutGrid className="h-3.5 w-3.5 mr-1.5" />
              Templates
            </TabsTrigger>
          </TabsList>

          {/* Settings Tab */}
          <TabsContent value="settings" className="mt-3">
            <div className="flex gap-5">
              {/* Left: Reel preview */}
              <div className="shrink-0 flex flex-col items-center gap-2">
                <ReelPreview style={captionStyle} />
                <p className="text-[10px] text-muted-foreground text-center leading-tight">
                  Live preview
                </p>
              </div>

              {/* Right: controls */}
              <div className="flex-1 min-w-0">
                <CaptionStyleEditor
                  style={captionStyle}
                  onChange={handleStyleChange}
                  compact
                />
              </div>
            </div>
          </TabsContent>

          {/* Templates Tab */}
          <TabsContent value="templates" className="mt-3">
            <div className="flex gap-5">
              {/* Left: live preview of current style */}
              <div className="shrink-0 flex flex-col items-center gap-2">
                <ReelPreview style={captionStyle} />
                <p className="text-[10px] text-muted-foreground text-center leading-tight">
                  Current style
                </p>
              </div>

              {/* Right: template grid */}
              <div className="flex-1 min-w-0 space-y-4">
                {/* Presets */}
                <div className="space-y-2">
                  <h3 className="text-xs font-medium text-muted-foreground">Presets</h3>
                  <div className="grid grid-cols-3 gap-2">
                    {ZONE_PRESETS.map((preset) => (
                      <TemplateCard
                        key={preset.name}
                        name={preset.name}
                        style={templateToCaptionStyle(preset)}
                        active={activePresetName === preset.name}
                        onClick={() => handlePresetSelect(preset)}
                      />
                    ))}
                  </div>
                </div>

                {/* Saved templates */}
                {savedTemplates.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-medium text-muted-foreground">Saved Templates</h3>
                    <div className="grid grid-cols-3 gap-2">
                      {savedTemplates.map((t) => (
                        <TemplateCard
                          key={t.id}
                          name={`${t.name}${t.isDefault ? " *" : ""}`}
                          style={templateToCaptionStyle(configToTemplate(t.name, t.config))}
                          active={activeTemplateId === t.id}
                          onClick={() => handleSavedSelect(t)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
