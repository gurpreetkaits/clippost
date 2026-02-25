"use client";

import {
  VideoLayout,
  OUTPUT_FORMATS,
  FRAME_TEMPLATES,
} from "@/lib/video-layout";

interface LayoutSelectorProps {
  layout: VideoLayout;
  onLayoutChange: (layout: VideoLayout) => void;
}

export default function LayoutSelector({
  layout,
  onLayoutChange,
}: LayoutSelectorProps) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs text-muted-foreground mb-1.5">Format</p>
        <div className="flex gap-1.5">
          {OUTPUT_FORMATS.map((f) => (
            <button
              key={f.id}
              onClick={() => onLayoutChange({ ...layout, format: f.id })}
              className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                layout.format === f.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      {layout.format === "9:16" && (
        <div>
          <p className="text-xs text-muted-foreground mb-1.5">Frame</p>
          <div className="flex flex-wrap gap-1.5">
            {FRAME_TEMPLATES.map((t) => (
              <button
                key={t.id}
                onClick={() => onLayoutChange({ ...layout, frame: t.id })}
                className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                  layout.frame === t.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
                }`}
                title={t.desc}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
