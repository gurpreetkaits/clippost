"use client";

import { ReactNode, useState } from "react";
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EditorLayoutProps {
  header: ReactNode;
  preview: ReactNode;
  rightPanel?: ReactNode;
  bottomBar?: ReactNode;
}

export default function EditorLayout({
  header,
  preview,
  rightPanel,
  bottomBar,
}: EditorLayoutProps) {
  const [rightOpen, setRightOpen] = useState(true);

  return (
    <div className="h-screen flex flex-col bg-neutral-950 overflow-hidden">
      {/* Top bar */}
      <div className="shrink-0 bg-background border-b border-border px-3 py-1.5 flex items-center gap-1">
        <div className="flex-1 min-w-0">{header}</div>
        {/* Right panel toggle */}
        {rightPanel && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground hidden lg:flex"
            onClick={() => setRightOpen(!rightOpen)}
          >
            {rightOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
          </Button>
        )}
      </div>

      {/* Main area */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Center - canvas/preview area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="flex-1 flex items-center justify-center min-h-0 overflow-hidden">
            {preview}
          </div>
        </div>

        {/* Right panel */}
        {rightPanel && rightOpen && (
          <div className="hidden lg:flex w-[220px] shrink-0 border-l border-border bg-background flex-col overflow-y-auto">
            {rightPanel}
          </div>
        )}
      </div>

      {/* Bottom bar */}
      {bottomBar && (
        <div className="shrink-0 border-t border-border bg-background">
          {bottomBar}
        </div>
      )}
    </div>
  );
}
