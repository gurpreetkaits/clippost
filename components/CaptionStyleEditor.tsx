"use client";

import { CaptionStyle } from "@/lib/caption-style";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bold,
  Italic,
  AlignVerticalDistributeStart,
  AlignVerticalDistributeCenter,
  AlignVerticalDistributeEnd,
  Move,
} from "lucide-react";

const FONTS = [
  "Helvetica Neue",
  "Arial Black",
  "Impact",
  "Georgia",
  "Courier New",
];

const POSITIONS: {
  value: CaptionStyle["position"];
  icon: typeof AlignVerticalDistributeStart;
  label: string;
}[] = [
  { value: "top", icon: AlignVerticalDistributeStart, label: "Top" },
  { value: "center", icon: AlignVerticalDistributeCenter, label: "Center" },
  { value: "bottom", icon: AlignVerticalDistributeEnd, label: "Bottom" },
  { value: "custom", icon: Move, label: "Custom" },
];

const TEXT_PRESETS = [
  "#FFFFFF",
  "#000000",
  "#FACC15",
  "#22C55E",
  "#3B82F6",
  "#EF4444",
  "#A855F7",
  "#F97316",
];

const BG_PRESETS = [
  "#000000",
  "#FFFFFF",
  "#1E293B",
  "#7C3AED",
  "#DC2626",
  "#059669",
  "#2563EB",
  "#D97706",
];

interface CaptionStyleEditorProps {
  style: CaptionStyle;
  onChange: (style: CaptionStyle) => void;
  compact?: boolean;
}

function ColorPicker({
  value,
  presets,
  onChange,
}: {
  value: string;
  presets: string[];
  onChange: (color: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {presets.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          className={`w-6 h-6 rounded-full border-2 transition-all ${
            value.toLowerCase() === color.toLowerCase()
              ? "border-primary scale-110"
              : "border-transparent hover:border-muted-foreground/40"
          }`}
          style={{ backgroundColor: color }}
          title={color}
        />
      ))}
      <div className="relative">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <div
          className="w-6 h-6 rounded-full border-2 border-dashed border-muted-foreground/40 flex items-center justify-center text-muted-foreground text-xs cursor-pointer"
          style={{ backgroundColor: value }}
          title="Custom color"
        >
          +
        </div>
      </div>
    </div>
  );
}

export default function CaptionStyleEditor({
  style,
  onChange,
  compact,
}: CaptionStyleEditorProps) {
  const update = (patch: Partial<CaptionStyle>) =>
    onChange({ ...style, ...patch });

  const content = (
    <div className="space-y-4">
        {/* Font */}
        <div className="space-y-1.5">
          <Label className="text-xs">Font</Label>
          <Select
            value={style.fontFamily}
            onValueChange={(v) => update({ fontFamily: v })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FONTS.map((f) => (
                <SelectItem key={f} value={f}>
                  {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Size + Bold/Italic row */}
        <div className="flex items-end gap-3">
          <div className="space-y-1.5 flex-1">
            <Label className="text-xs">Size (px)</Label>
            <Input
              type="number"
              min={16}
              max={120}
              value={style.fontSize}
              onChange={(e) =>
                update({ fontSize: Math.max(16, Math.min(120, Number(e.target.value) || 48)) })
              }
              className="w-full"
            />
          </div>
          <div className="flex gap-1">
            <Button
              type="button"
              size="sm"
              variant={style.bold ? "default" : "outline"}
              onClick={() => update({ bold: !style.bold })}
              className="h-9 w-9 p-0"
            >
              <Bold className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant={style.italic ? "default" : "outline"}
              onClick={() => update({ italic: !style.italic })}
              className="h-9 w-9 p-0"
            >
              <Italic className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Position */}
        <div className="space-y-1.5">
          <Label className="text-xs">Position</Label>
          <div className="flex gap-1">
            {POSITIONS.map(({ value, icon: Icon, label }) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={style.position === value ? "default" : "outline"}
                className="flex-1 gap-1.5"
                onClick={() => {
                  if (value === "custom") {
                    // Only switch to custom — actual coordinates come from dragging
                    update({ position: "custom" });
                  } else {
                    // Reset to preset, clear custom coordinates
                    update({ position: value, customX: undefined, customY: undefined });
                  }
                }}
                title={label}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Button>
            ))}
          </div>
          {style.position === "custom" && style.customX != null && style.customY != null && (
            <p className="text-[10px] text-muted-foreground mt-1">
              Position: {Math.round(style.customX)}%, {Math.round(style.customY)}% — drag on canvas to reposition
            </p>
          )}
        </div>

        {/* Text Color */}
        <div className="space-y-1.5">
          <Label className="text-xs">Text Color</Label>
          <ColorPicker
            value={style.textColor}
            presets={TEXT_PRESETS}
            onChange={(c) => update({ textColor: c })}
          />
        </div>

        {/* Background Color */}
        <div className="space-y-1.5">
          <Label className="text-xs">Background Color</Label>
          <ColorPicker
            value={style.bgColor}
            presets={BG_PRESETS}
            onChange={(c) => update({ bgColor: c })}
          />
        </div>

        {/* Background Opacity */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Background Opacity</Label>
            <span className="text-xs font-mono text-muted-foreground">
              {style.bgOpacity}%
            </span>
          </div>
          <Slider
            value={[style.bgOpacity]}
            onValueChange={([v]) => update({ bgOpacity: v })}
            min={0}
            max={100}
            step={1}
          />
        </div>
    </div>
  );

  if (compact) return content;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Caption Style</CardTitle>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}
