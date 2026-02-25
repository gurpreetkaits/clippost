"use client";

import { useState, useEffect } from "react";
import { useSession, signIn } from "next-auth/react";
import CaptionStyleEditor from "@/components/CaptionStyleEditor";
import TemplatePicker from "@/components/TemplatePicker";
import LayoutSelector from "@/components/editor/LayoutSelector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, Loader2, ChevronDown, Plus, Trash2, Type, Palette, X } from "lucide-react";
import { CaptionStyle } from "@/lib/caption-style";
import type { ReelTemplate } from "@/lib/caption-template";
import { VideoLayout } from "@/lib/video-layout";
import { LANGUAGES } from "@/lib/languages";
import type { CaptionSegment, TextOverlay, SelectedElement } from "@/lib/types/editor";

function Section({
  title,
  defaultOpen = true,
  forceOpen,
  children,
  action,
}: {
  title: string;
  defaultOpen?: boolean;
  forceOpen?: boolean;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  // Force open when forceOpen changes to true
  useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen]);

  return (
    <div className="border-b border-border last:border-b-0">
      <div className="flex items-center">
        <button
          onClick={() => setOpen(!open)}
          className="flex-1 flex items-center justify-between px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide hover:bg-muted/50 transition-colors"
        >
          {title}
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform ${open ? "" : "-rotate-90"}`}
          />
        </button>
        {action && <div className="pr-3">{action}</div>}
      </div>
      {open && <div className="px-4 pb-3">{children}</div>}
    </div>
  );
}

interface PropertiesPanelProps {
  captions: CaptionSegment[];
  captionStyle: CaptionStyle;
  onCaptionStyleChange: (s: CaptionStyle) => void;
  onTemplateSelect: (template: ReelTemplate, id?: string) => void;
  layout: VideoLayout;
  onLayoutChange: (layout: VideoLayout) => void;
  language: string;
  onLanguageChange: (lang: string) => void;
  onTranscribe: () => void;
  transcribing: boolean;
  clipDuration: number;
  textOverlays: TextOverlay[];
  onAddTextOverlay: () => void;
  onRemoveTextOverlay: (id: string) => void;
  onUpdateTextOverlay: (id: string, patch: Partial<TextOverlay>) => void;
  colorGradingEnabled: boolean;
  colorGradingLoading: boolean;
  colorGradingProgress: string;
  colorGradingCorrections: string[];
  onColorGrade: () => void;
  onRemoveColorGrading: () => void;
  selectedElement?: SelectedElement;
}

const TEXT_COLORS = ["#FFFFFF", "#000000", "#FACC15", "#22C55E", "#3B82F6", "#EF4444", "#A855F7"];

export default function PropertiesPanel({
  captions,
  captionStyle,
  onCaptionStyleChange,
  onTemplateSelect,
  layout,
  onLayoutChange,
  language,
  onLanguageChange,
  onTranscribe,
  transcribing,
  clipDuration,
  textOverlays,
  onAddTextOverlay,
  onRemoveTextOverlay,
  onUpdateTextOverlay,
  colorGradingEnabled,
  colorGradingLoading,
  colorGradingProgress,
  colorGradingCorrections,
  onColorGrade,
  onRemoveColorGrading,
  selectedElement,
}: PropertiesPanelProps) {
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";

  return (
    <div className="flex flex-col h-full">
      {/* Transcribe action */}
      <div className="px-4 py-3 border-b border-border space-y-2">
        <div className="flex items-center gap-2">
          <select
            value={language}
            onChange={(e) => onLanguageChange(e.target.value)}
            className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-xs"
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
          {isAuthenticated ? (
            <Button
              size="sm"
              onClick={onTranscribe}
              disabled={transcribing || clipDuration > 90}
              className="h-8 text-xs shrink-0"
            >
              {transcribing ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Transcribing...
                </>
              ) : (
                "Transcribe"
              )}
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => signIn("google")} className="h-8 text-xs shrink-0">
              <Lock className="h-3 w-3" />
              Sign in
            </Button>
          )}
        </div>
        {captions.length > 0 && (
          <p className="text-[10px] text-muted-foreground">
            {captions.length} caption{captions.length !== 1 ? "s" : ""} loaded
          </p>
        )}
      </div>

      {/* Scrollable sections */}
      <div className="flex-1 overflow-y-auto">
        <Section title="Template">
          <TemplatePicker onSelect={onTemplateSelect} />
        </Section>

        <Section title="Caption Style" defaultOpen={false} forceOpen={selectedElement?.type === "caption"}>
          <CaptionStyleEditor
            style={captionStyle}
            onChange={onCaptionStyleChange}
            compact
          />
        </Section>

        <Section title="Layout">
          <LayoutSelector layout={layout} onLayoutChange={onLayoutChange} />
        </Section>

        <Section title="Color Grading" defaultOpen={colorGradingEnabled || colorGradingLoading}>
          {colorGradingLoading ? (
            <div className="flex items-center gap-2 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
              <span className="text-xs text-muted-foreground">{colorGradingProgress || "Processing..."}</span>
            </div>
          ) : colorGradingEnabled ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-green-500">
                <Palette className="h-3.5 w-3.5" />
                Color grading applied
              </div>
              {colorGradingCorrections.length > 0 && (
                <ul className="text-[10px] text-muted-foreground space-y-0.5 pl-5 list-disc">
                  {colorGradingCorrections.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              )}
              <Button
                variant="outline"
                size="sm"
                className="w-full h-7 text-xs"
                onClick={onRemoveColorGrading}
              >
                <X className="h-3 w-3" />
                Remove grading
              </Button>
            </div>
          ) : isAuthenticated ? (
            <Button
              size="sm"
              variant="outline"
              className="w-full h-8 text-xs"
              onClick={onColorGrade}
            >
              <Palette className="h-3.5 w-3.5" />
              Auto Color Grade
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => signIn("google")}
              className="w-full h-8 text-xs"
            >
              <Lock className="h-3 w-3" />
              Sign in to color grade
            </Button>
          )}
        </Section>

        <Section
          title="Text Overlays"
          defaultOpen={textOverlays.length > 0}
          forceOpen={selectedElement?.type === "overlay"}
          action={
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={onAddTextOverlay}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          }
        >
          {textOverlays.length === 0 ? (
            <button
              onClick={onAddTextOverlay}
              className="w-full flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground hover:text-foreground border-2 border-dashed border-border rounded-lg transition-colors hover:border-muted-foreground/40"
            >
              <Type className="h-4 w-4" />
              Add text overlay
            </button>
          ) : (
            <div className="space-y-3">
              {textOverlays.map((overlay) => {
                const isSelected =
                  selectedElement?.type === "overlay" &&
                  selectedElement.overlayId === overlay.id;
                return (
                <div key={overlay.id} className={`space-y-2 p-2 rounded-lg border ${isSelected ? "border-blue-500 ring-1 ring-blue-500/30" : "border-border"}`}>
                  <div className="flex items-center gap-1">
                    <Input
                      value={overlay.text}
                      onChange={(e) => onUpdateTextOverlay(overlay.id, { text: e.target.value })}
                      className="h-7 text-xs flex-1"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => onRemoveTextOverlay(overlay.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={overlay.fontSize}
                      onChange={(e) => onUpdateTextOverlay(overlay.id, { fontSize: Math.max(8, Math.min(72, Number(e.target.value) || 24)) })}
                      className="h-7 text-xs w-16"
                      min={8}
                      max={72}
                    />
                    <span className="text-[10px] text-muted-foreground">px</span>
                    <div className="flex gap-1 ml-auto">
                      {TEXT_COLORS.map((color) => (
                        <button
                          key={color}
                          onClick={() => onUpdateTextOverlay(overlay.id, { color })}
                          className={`w-5 h-5 rounded-full border transition-all ${
                            overlay.color === color
                              ? "border-primary scale-110"
                              : "border-transparent hover:border-muted-foreground/40"
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Drag on canvas to position</p>
                </div>
                );
              })}
              <Button
                variant="outline"
                size="sm"
                className="w-full h-7 text-xs"
                onClick={onAddTextOverlay}
              >
                <Plus className="h-3 w-3" />
                Add another
              </Button>
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}
