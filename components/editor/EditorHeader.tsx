"use client";

import { useSession, signIn } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import PublishButton from "@/components/PublishButton";
import { ArrowLeft, FileDown, Loader2, Lock, Scissors } from "lucide-react";

interface EditorHeaderProps {
  onBack: () => void;
  videoTitle: string;
  clipFilename: string | null;
  clipDuration: number;
  language: string;
  generating: boolean;
  captions: { text: string }[];
  onGenerate: () => void;
  onExport: () => void;
  transcribing: boolean;
}

export default function EditorHeader({
  onBack,
  videoTitle,
  clipFilename,
  clipDuration,
  language,
  generating,
  captions,
  onGenerate,
  onExport,
  transcribing,
}: EditorHeaderProps) {
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";

  return (
    <div className="flex items-center gap-2 h-10">
      {/* Left: back + brand + title */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onBack}
        className="h-8 w-8 shrink-0 text-muted-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
      </Button>
      <Link
        href="/"
        className="hidden sm:inline-flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground shrink-0"
      >
        <Scissors className="h-3.5 w-3.5" />
        ClipPost
      </Link>
      <div className="hidden sm:block w-px h-5 bg-border shrink-0" />
      <h1 className="text-sm font-medium text-foreground truncate flex-1 min-w-0">
        {videoTitle}
      </h1>

      {/* Status badges */}
      {(generating || transcribing) && (
        <Badge variant="secondary" className="gap-1 text-xs shrink-0 hidden sm:flex">
          <Loader2 className="h-3 w-3 animate-spin" />
          {generating ? "Generating..." : "Transcribing..."}
        </Badge>
      )}

      {/* Action buttons - all same height h-9 */}
      <div className="flex items-center gap-1.5 shrink-0">
        {isAuthenticated ? (
          <Button
            size="sm"
            onClick={onGenerate}
            disabled={generating || clipDuration > 90}
            className="bg-green-600 hover:bg-green-700 text-white h-9 px-4 text-xs font-medium"
          >
            {generating ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span className="hidden sm:inline">Generating...</span>
              </>
            ) : (
              "Generate"
            )}
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={() => signIn("google")} className="h-9 px-4 text-xs">
            <Lock className="h-3.5 w-3.5" />
            Sign in
          </Button>
        )}

        {isAuthenticated ? (
          <Button
            variant="outline"
            size="sm"
            className="h-9 px-4 text-xs font-medium"
            onClick={onExport}
            disabled={generating || clipDuration > 90}
          >
            {generating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileDown className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">Export</span>
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="h-9 px-4 text-xs font-medium" disabled>
            <FileDown className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Export</span>
          </Button>
        )}

        <div className="[&_button]:h-9 [&_button]:px-4 [&_button]:text-xs [&_button]:font-medium">
          <PublishButton
            clipFilename={clipFilename}
            videoTitle={videoTitle}
            clipDuration={clipDuration}
            transcript={captions.map((c) => c.text).join(" ")}
            language={language}
          />
        </div>
      </div>
    </div>
  );
}
