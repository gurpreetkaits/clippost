"use client";

import { useSession, signIn } from "next-auth/react";
import ClipSelector from "@/components/ClipSelector";
import CaptionEditor from "@/components/CaptionEditor";
import CaptionStyleEditor from "@/components/CaptionStyleEditor";
import TemplatePicker from "@/components/TemplatePicker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Loader2,
  AlertCircle,
  Lock,
} from "lucide-react";
import { CaptionStyle } from "@/lib/caption-style";
import { templateToCaptionStyle } from "@/lib/caption-template";
import type { ReelTemplate } from "@/lib/caption-template";
import { LANGUAGES } from "@/lib/languages";

interface CaptionSegment {
  start: number;
  end: number;
  text: string;
}

function AuthGate({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  const { status } = useSession();
  if (status === "authenticated") return <>{children}</>;
  return (
    <>
      {fallback || (
        <Button
          onClick={() => signIn("google")}
          variant="outline"
          className="w-full"
        >
          <Lock className="h-4 w-4 mr-2" />
          Sign in to unlock
        </Button>
      )}
    </>
  );
}

interface ControlPanelProps {
  // Video info
  duration: number;
  start: number;
  end: number;
  currentTime: number;
  onStartChange: (v: number) => void;
  onEndChange: (v: number) => void;

  // Captions
  captions: CaptionSegment[];
  onCaptionsUpdate: (c: CaptionSegment[]) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;

  // Caption style
  captionStyle: CaptionStyle;
  onCaptionStyleChange: (s: CaptionStyle) => void;
  activeTemplateId: string | undefined;
  onTemplateSelect: (template: ReelTemplate, id?: string) => void;

  // Language
  language: string;
  onLanguageChange: (lang: string) => void;

  // Actions
  onTranscribe: () => void;
  transcribing: boolean;
  onGenerate: () => void;
  generating: boolean;
  error: string;
}

export default function ControlPanel({
  duration,
  start,
  end,
  currentTime,
  onStartChange,
  onEndChange,
  captions,
  onCaptionsUpdate,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  captionStyle,
  onCaptionStyleChange,
  activeTemplateId,
  onTemplateSelect,
  language,
  onLanguageChange,
  onTranscribe,
  transcribing,
  onGenerate,
  generating,
  error,
}: ControlPanelProps) {
  const previewBgAlpha = Math.round((captionStyle.bgOpacity / 100) * 255)
    .toString(16)
    .padStart(2, "0");
  const previewText = captions[0]?.text || "Your caption will appear here";

  return (
    <>
      {/* Step 1: Select Range */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">1</span>
          <span className="text-sm font-semibold text-foreground">Select Range</span>
        </div>
        <ClipSelector
          duration={duration}
          start={start}
          end={end}
          currentTime={currentTime}
          onStartChange={onStartChange}
          onEndChange={onEndChange}
        />
        <div className="space-y-2">
          <div className="flex gap-2">
            <AuthGate
              fallback={
                <Button size="sm" variant="outline" onClick={() => signIn("google")}>
                  <Lock className="h-4 w-4 mr-1" />
                  Sign in to transcribe
                </Button>
              }
            >
              <Button
                size="sm"
                onClick={onTranscribe}
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
            </AuthGate>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground shrink-0">Language</label>
            <select
              value={language}
              onChange={(e) => onLanguageChange(e.target.value)}
              className="rounded-md border border-input bg-background px-2 py-1 text-xs"
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="border-t border-border" />

      {/* Step 2: Captions & Style */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">2</span>
          <span className="text-sm font-semibold text-foreground">Captions & Style</span>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Captions</CardTitle>
          </CardHeader>
          <CardContent>
            <CaptionEditor
              captions={captions}
              onUpdate={onCaptionsUpdate}
              onUndo={onUndo}
              onRedo={onRedo}
              canUndo={canUndo}
              canRedo={canRedo}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-2">
            <TemplatePicker onSelect={onTemplateSelect} />
          </CardContent>
        </Card>
        <CaptionStyleEditor
          style={captionStyle}
          onChange={onCaptionStyleChange}
        />

        {/* Live Caption Preview */}
        <div className="rounded-lg border overflow-hidden">
          <p className="text-xs font-medium text-muted-foreground px-4 pt-3 pb-2">Preview</p>
          <div className="flex px-4 pb-4">
            <div
              className="w-full rounded-lg bg-neutral-900 relative p-6"
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: captionStyle.position === "top" ? "flex-start" : captionStyle.position === "center" ? "center" : "flex-end",
                minHeight: "120px",
              }}
            >
              <span
                className="rounded-md text-center leading-relaxed max-w-[90%]"
                style={{
                  fontFamily: captionStyle.fontFamily,
                  fontSize: `${Math.min(captionStyle.fontSize * 0.5, 28)}px`,
                  color: captionStyle.textColor,
                  backgroundColor: `${captionStyle.bgColor}${previewBgAlpha}`,
                  fontWeight: captionStyle.bold ? "bold" : "normal",
                  fontStyle: captionStyle.italic ? "italic" : "normal",
                  padding: "6px 14px",
                  wordBreak: "break-word",
                }}
              >
                {previewText}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-border" />

      {/* Step 3: Generate */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">3</span>
          <span className="text-sm font-semibold text-foreground">Generate</span>
        </div>
        <AuthGate>
          <Button
            onClick={onGenerate}
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
        </AuthGate>
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>
    </>
  );
}
