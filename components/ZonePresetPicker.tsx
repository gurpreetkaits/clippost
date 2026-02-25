"use client";

import { ZONE_PRESETS, ReelTemplate } from "@/lib/caption-template";
import { cn } from "@/lib/utils";

interface ZonePresetPickerProps {
  onSelect: (preset: ReelTemplate) => void;
  currentName?: string;
}

function PresetMiniPreview({ preset }: { preset: ReelTemplate }) {
  const zonePos: Record<string, string> = {
    "top-left": "items-start justify-start",
    "top-center": "items-start justify-center",
    "top-right": "items-start justify-end",
    "center-left": "items-center justify-start",
    center: "items-center justify-center",
    "center-right": "items-center justify-end",
    "bottom-left": "items-end justify-start",
    "bottom-center": "items-end justify-center",
    "bottom-right": "items-end justify-end",
  };

  return (
    <div
      className={cn(
        "w-8 h-14 bg-zinc-900 rounded-sm flex p-1 shrink-0",
        zonePos[preset.zone]
      )}
    >
      <div
        className="rounded-[1px] px-0.5"
        style={{
          backgroundColor:
            preset.borderStyle === "box" && preset.bgOpacity > 0
              ? preset.bgColor
              : "transparent",
          border:
            preset.borderStyle === "outline"
              ? `1px solid ${preset.shadowColor}`
              : "none",
        }}
      >
        <div
          className="text-[4px] font-bold leading-tight whitespace-nowrap"
          style={{
            color: preset.textColor,
            textTransform: preset.textTransform !== "none" ? preset.textTransform : undefined,
          }}
        >
          Abc
        </div>
      </div>
    </div>
  );
}

export default function ZonePresetPicker({
  onSelect,
  currentName,
}: ZonePresetPickerProps) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {ZONE_PRESETS.map((preset) => (
        <button
          key={preset.name}
          type="button"
          onClick={() => onSelect({ ...preset })}
          className={cn(
            "flex items-center gap-2 p-2 rounded-md border transition-all text-left",
            currentName === preset.name
              ? "border-primary bg-primary/5"
              : "border-border hover:border-muted-foreground/40"
          )}
        >
          <PresetMiniPreview preset={preset} />
          <span className="text-xs font-medium leading-tight">
            {preset.name}
          </span>
        </button>
      ))}
    </div>
  );
}
