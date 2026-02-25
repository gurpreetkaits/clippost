"use client";

import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

interface EditorLayoutProps {
  title: string;
  onBack: () => void;
  badge?: ReactNode;
  preview: ReactNode;
  controls: ReactNode;
  timeline?: ReactNode;
}

export default function EditorLayout({
  title,
  onBack,
  badge,
  preview,
  controls,
  timeline,
}: EditorLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 p-4 md:p-6">
        <div className="max-w-7xl mx-auto space-y-4">
          {/* Header */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="text-muted-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <h1 className="text-lg font-semibold text-foreground truncate flex-1">
              {title}
            </h1>
            {badge}
          </div>

          {/* Two-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* LEFT: Video preview */}
            <div className="lg:sticky lg:top-4 lg:self-start space-y-4">
              {preview}
            </div>

            {/* RIGHT: Controls */}
            <div className="space-y-5">
              {controls}
            </div>
          </div>

          {/* Full-width timeline below */}
          {timeline && (
            <div className="mt-2">
              {timeline}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
