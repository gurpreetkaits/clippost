"use client";

import { Zone } from "@/lib/caption-template";
import { cn } from "@/lib/utils";

const ZONES: Zone[] = [
  "top-left",
  "top-center",
  "top-right",
  "center-left",
  "center",
  "center-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
];

const ZONE_LABELS: Record<Zone, string> = {
  "top-left": "TL",
  "top-center": "TC",
  "top-right": "TR",
  "center-left": "CL",
  center: "C",
  "center-right": "CR",
  "bottom-left": "BL",
  "bottom-center": "BC",
  "bottom-right": "BR",
};

interface ZonePickerProps {
  value: Zone;
  onChange: (zone: Zone) => void;
}

export default function ZonePicker({ value, onChange }: ZonePickerProps) {
  return (
    <div className="grid grid-cols-3 gap-1 w-fit">
      {ZONES.map((zone) => (
        <button
          key={zone}
          type="button"
          onClick={() => onChange(zone)}
          className={cn(
            "w-10 h-10 rounded text-xs font-medium transition-all",
            value === zone
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          )}
        >
          {ZONE_LABELS[zone]}
        </button>
      ))}
    </div>
  );
}
