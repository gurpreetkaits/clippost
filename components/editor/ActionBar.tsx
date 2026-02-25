"use client";

import { useSession, signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sparkles,
  Wand2,
  Palette,
  Scissors,
  Type,
  Loader2,
  Check,
  X,
  Lock,
} from "lucide-react";
import { LANGUAGES } from "@/lib/languages";

interface ActionBarProps {
  language: string;
  onLanguageChange: (lang: string) => void;
  // Captions
  captionCount: number;
  captionsLoading: boolean;
  onGenerateCaptions: () => void;
  // Enhance
  enhanceEnabled: boolean;
  enhanceLoading: boolean;
  enhanceProgress: string;
  onEnhance: () => void;
  onRemoveEnhance: () => void;
  // Color Grading
  colorGradingEnabled: boolean;
  colorGradingLoading: boolean;
  colorGradingProgress: string;
  colorGradingCorrections: string[];
  onColorGrade: () => void;
  onRemoveColorGrading: () => void;
  // Auto Trim
  autoTrimLoading: boolean;
  autoTrimProgress: string;
  autoTrimReason: string;
  onAutoTrim: () => void;
  // Caption Style
  onOpenCaptionStyle: () => void;
}

export default function ActionBar({
  language,
  onLanguageChange,
  captionCount,
  captionsLoading,
  onGenerateCaptions,
  enhanceEnabled,
  enhanceLoading,
  enhanceProgress,
  onEnhance,
  onRemoveEnhance,
  colorGradingEnabled,
  colorGradingLoading,
  colorGradingProgress,
  colorGradingCorrections,
  onColorGrade,
  onRemoveColorGrading,
  autoTrimLoading,
  autoTrimProgress,
  autoTrimReason,
  onAutoTrim,
  onOpenCaptionStyle,
}: ActionBarProps) {
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";

  const requiresAuth = (action: () => void) => {
    if (isAuthenticated) {
      action();
    } else {
      signIn("google");
    }
  };

  return (
    <div className="flex flex-col gap-3 p-3">
      {/* Language selector */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          Language
        </label>
        <Select value={language} onValueChange={onLanguageChange}>
          <SelectTrigger className="w-full h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGES.map((l) => (
              <SelectItem key={l.code} value={l.code}>
                {l.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="h-px bg-border" />

      {/* 1. Generate Captions */}
      <ActionButton
        icon={Sparkles}
        label="Generate Captions"
        loading={captionsLoading}
        loadingText="Transcribing..."
        done={captionCount > 0}
        doneBadge={`${captionCount} captions`}
        locked={!isAuthenticated}
        onClick={() => requiresAuth(onGenerateCaptions)}
      />

      {/* 2. Enhance Quality */}
      <ActionButton
        icon={Wand2}
        label="Enhance Quality"
        loading={enhanceLoading}
        loadingText={enhanceProgress || "Enhancing..."}
        done={enhanceEnabled}
        doneBadge="Enhanced"
        locked={!isAuthenticated}
        onClick={() => requiresAuth(onEnhance)}
        onRemove={enhanceEnabled ? onRemoveEnhance : undefined}
      />

      {/* 3. Color Grading */}
      <ActionButton
        icon={Palette}
        label="Color Grading"
        loading={colorGradingLoading}
        loadingText={colorGradingProgress || "Grading..."}
        done={colorGradingEnabled}
        doneBadge={colorGradingCorrections.length > 0 ? colorGradingCorrections[0] : "Graded"}
        locked={!isAuthenticated}
        onClick={() => requiresAuth(onColorGrade)}
        onRemove={colorGradingEnabled ? onRemoveColorGrading : undefined}
      />

      {/* 4. Auto Trim */}
      <ActionButton
        icon={Scissors}
        label="Auto Trim"
        loading={autoTrimLoading}
        loadingText={autoTrimProgress || "Finding best segment..."}
        done={!!autoTrimReason}
        doneBadge={autoTrimReason}
        locked={!isAuthenticated}
        onClick={() => requiresAuth(onAutoTrim)}
      />

      {/* 5. Caption Style */}
      <ActionButton
        icon={Type}
        label="Caption Style"
        loading={false}
        loadingText=""
        done={false}
        locked={false}
        onClick={onOpenCaptionStyle}
      />
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  loading,
  loadingText,
  done,
  doneBadge,
  locked,
  onClick,
  onRemove,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  loading: boolean;
  loadingText: string;
  done: boolean;
  doneBadge?: string;
  locked: boolean;
  onClick: () => void;
  onRemove?: () => void;
}) {
  return (
    <div className="space-y-1">
      <Button
        variant={done ? "secondary" : "outline"}
        className="w-full justify-start gap-2 h-10 text-sm"
        onClick={onClick}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
        ) : done ? (
          <Check className="h-4 w-4 text-green-500 shrink-0" />
        ) : locked ? (
          <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <Icon className="h-4 w-4 shrink-0" />
        )}
        <span className="truncate">{label}</span>
        {done && onRemove && (
          <button
            className="ml-auto p-0.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </Button>
      {loading && loadingText && (
        <p className="text-[11px] text-muted-foreground px-1 truncate">
          {loadingText}
        </p>
      )}
      {!loading && done && doneBadge && (
        <p className="text-[11px] text-green-600 dark:text-green-400 px-1 truncate">
          {doneBadge}
        </p>
      )}
    </div>
  );
}
