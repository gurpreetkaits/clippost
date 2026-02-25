"use client";

import ClipSelector from "@/components/ClipSelector";
import CaptionTimeline from "@/components/CaptionTimeline";
import CaptionEditor from "@/components/CaptionEditor";
import { useState } from "react";
import { ChevronDown } from "lucide-react";

interface CaptionSegment {
  start: number;
  end: number;
  text: string;
  words?: { word: string; start: number; end: number }[];
}

interface BottomToolbarProps {
  // Range
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
  selectedIndex: number | null;
  onSelectSegment: (index: number | null) => void;
  onSegmentTimingChange: (index: number, edge: "start" | "end", newTime: number) => void;
}

type Tab = "range" | "captions" | "timeline";

export default function BottomToolbar({
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
  selectedIndex,
  onSelectSegment,
  onSegmentTimingChange,
}: BottomToolbarProps) {
  const [activeTab, setActiveTab] = useState<Tab>("timeline");
  const [collapsed, setCollapsed] = useState(false);

  const tabs: { id: Tab; label: string }[] = [
    { id: "timeline", label: "Timeline" },
    { id: "range", label: "Range" },
    { id: "captions", label: `Captions${captions.length > 0 ? ` (${captions.length})` : ""}` },
  ];

  return (
    <div>
      {/* Tab bar */}
      <div className="flex items-center border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              setCollapsed(false);
            }}
            className={`px-4 py-2 text-xs font-medium transition-colors ${
              activeTab === tab.id && !collapsed
                ? "text-foreground border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="px-3 py-2 text-muted-foreground hover:text-foreground"
        >
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform ${collapsed ? "-rotate-180" : ""}`}
          />
        </button>
      </div>

      {/* Tab content */}
      {!collapsed && (
        <div className="p-3" style={{ maxHeight: "200px", overflowY: "auto" }}>
          {activeTab === "timeline" && (
            <CaptionTimeline
              segments={captions}
              clipStart={start}
              clipEnd={end}
              currentTime={currentTime}
              selectedIndex={selectedIndex}
              onSelectSegment={onSelectSegment}
              onSegmentTimingChange={onSegmentTimingChange}
            />
          )}

          {activeTab === "range" && (
            <div className="max-w-lg">
              <ClipSelector
                duration={duration}
                start={start}
                end={end}
                currentTime={currentTime}
                onStartChange={onStartChange}
                onEndChange={onEndChange}
              />
            </div>
          )}

          {activeTab === "captions" && (
            <CaptionEditor
              captions={captions}
              onUpdate={onCaptionsUpdate}
              onUndo={onUndo}
              onRedo={onRedo}
              canUndo={canUndo}
              canRedo={canRedo}
            />
          )}
        </div>
      )}
    </div>
  );
}
