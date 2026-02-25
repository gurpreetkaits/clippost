"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
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
  Underline,
  ArrowLeft,
  Save,
  Copy,
  Trash2,
  Loader2,
  RotateCcw,
} from "lucide-react";
import TemplatePreviewCanvas from "@/components/TemplatePreviewCanvas";
import ZonePicker from "@/components/ZonePicker";
import ZonePresetPicker from "@/components/ZonePresetPicker";
import {
  DEFAULT_REEL_TEMPLATE,
  configToTemplate,
  templateToConfig,
} from "@/lib/caption-template";
import type { ReelTemplate, Zone } from "@/lib/caption-template";

const FONTS = [
  "Helvetica Neue",
  "Arial Black",
  "Impact",
  "Georgia",
  "Courier New",
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

export default function DesignerPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}>
      <DesignerContent />
    </Suspense>
  );
}

function DesignerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("id");

  const [template, setTemplate] = useState<ReelTemplate>({
    ...DEFAULT_REEL_TEMPLATE,
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!editId);
  const [isDefault, setIsDefault] = useState(false);

  // Load existing template for editing
  useEffect(() => {
    if (!editId) return;
    fetch(`/api/templates/${editId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setTemplate(configToTemplate(data.name, data.config));
          setIsDefault(data.isDefault);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [editId]);

  const update = (patch: Partial<ReelTemplate>) =>
    setTemplate((prev) => ({ ...prev, ...patch }));

  const handleSave = async () => {
    if (!template.name.trim()) return;
    setSaving(true);

    const url = editId ? `/api/templates/${editId}` : "/api/templates";
    const method = editId ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...template, isDefault }),
    });

    if (res.ok) {
      router.push("/templates");
    }
    setSaving(false);
  };

  const handleSaveAsCopy = async () => {
    if (!template.name.trim()) return;
    setSaving(true);

    const res = await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...template,
        name: `${template.name} (Copy)`,
        isDefault: false,
      }),
    });

    if (res.ok) {
      router.push("/templates");
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!editId || !confirm("Delete this template?")) return;
    const res = await fetch(`/api/templates/${editId}`, { method: "DELETE" });
    if (res.ok) router.push("/templates");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/templates")}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <h1 className="text-lg font-bold">
          {editId ? "Edit Template" : "Create Template"}
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
        {/* Left: Preview (sticky) */}
        <div className="lg:sticky lg:top-6 lg:self-start space-y-3">
          <TemplatePreviewCanvas template={template} />
          {/* Name input */}
          <div className="space-y-1.5">
            <Label className="text-xs">Template Name</Label>
            <Input
              value={template.name}
              onChange={(e) => update({ name: e.target.value })}
              placeholder="My Template"
            />
          </div>
          {/* Save actions */}
          <div className="flex gap-2">
            <Button
              onClick={handleSave}
              disabled={saving || !template.name.trim()}
              className="flex-1"
              size="sm"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-1.5" />
              )}
              {editId ? "Save" : "Create"}
            </Button>
            {editId && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSaveAsCopy}
                  disabled={saving}
                  title="Save as copy"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDelete}
                  className="text-destructive hover:text-destructive"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="rounded"
            />
            Set as default template
          </label>
        </div>

        {/* Right: Controls (scrollable) */}
        <div className="space-y-4">
          {/* Presets */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Quick Presets</CardTitle>
            </CardHeader>
            <CardContent>
              <ZonePresetPicker
                onSelect={(preset) => setTemplate(preset)}
                currentName={template.name}
              />
            </CardContent>
          </Card>

          {/* Position */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Position</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-6">
                <div className="space-y-1.5">
                  <Label className="text-xs">Zone</Label>
                  <ZonePicker
                    value={template.zone}
                    onChange={(zone: Zone) =>
                      update({ zone, posX: null, posY: null })
                    }
                  />
                </div>
                <div className="flex-1 space-y-4">
                  {/* Fine-tune X */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">
                        X Position {template.posX !== null ? `(${template.posX}%)` : "(auto)"}
                      </Label>
                      {template.posX !== null && (
                        <button
                          type="button"
                          onClick={() => update({ posX: null })}
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          <RotateCcw className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    <Slider
                      value={[template.posX ?? 50]}
                      onValueChange={([v]) => update({ posX: v })}
                      min={0}
                      max={100}
                      step={1}
                    />
                  </div>
                  {/* Fine-tune Y */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">
                        Y Position {template.posY !== null ? `(${template.posY}%)` : "(auto)"}
                      </Label>
                      {template.posY !== null && (
                        <button
                          type="button"
                          onClick={() => update({ posY: null })}
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          <RotateCcw className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    <Slider
                      value={[template.posY ?? 50]}
                      onValueChange={([v]) => update({ posY: v })}
                      min={0}
                      max={100}
                      step={1}
                    />
                  </div>
                  {/* Max Width */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Max Width</Label>
                      <span className="text-xs font-mono text-muted-foreground">
                        {template.maxWidth}%
                      </span>
                    </div>
                    <Slider
                      value={[template.maxWidth]}
                      onValueChange={([v]) => update({ maxWidth: v })}
                      min={30}
                      max={95}
                      step={1}
                    />
                  </div>
                </div>
              </div>
              {/* Wrap Style */}
              <div className="space-y-1.5">
                <Label className="text-xs">Word Wrap</Label>
                <div className="flex gap-1">
                  {(["smart", "none"] as const).map((ws) => (
                    <Button
                      key={ws}
                      type="button"
                      size="sm"
                      variant={template.wrapStyle === ws ? "default" : "outline"}
                      className="flex-1 capitalize"
                      onClick={() => update({ wrapStyle: ws })}
                    >
                      {ws}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Typography */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Typography</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Font */}
              <div className="space-y-1.5">
                <Label className="text-xs">Font</Label>
                <Select
                  value={template.fontFamily}
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
              {/* Size + Bold/Italic/Underline */}
              <div className="flex items-end gap-3">
                <div className="space-y-1.5 flex-1">
                  <Label className="text-xs">Size (px)</Label>
                  <Input
                    type="number"
                    min={16}
                    max={120}
                    value={template.fontSize}
                    onChange={(e) =>
                      update({
                        fontSize: Math.max(
                          16,
                          Math.min(120, Number(e.target.value) || 48)
                        ),
                      })
                    }
                    className="w-full"
                  />
                </div>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={template.bold ? "default" : "outline"}
                    onClick={() => update({ bold: !template.bold })}
                    className="h-9 w-9 p-0"
                  >
                    <Bold className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={template.italic ? "default" : "outline"}
                    onClick={() => update({ italic: !template.italic })}
                    className="h-9 w-9 p-0"
                  >
                    <Italic className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={template.underline ? "default" : "outline"}
                    onClick={() => update({ underline: !template.underline })}
                    className="h-9 w-9 p-0"
                  >
                    <Underline className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {/* Text Transform */}
              <div className="space-y-1.5">
                <Label className="text-xs">Text Transform</Label>
                <div className="flex gap-1">
                  {(["none", "uppercase", "lowercase"] as const).map((tt) => (
                    <Button
                      key={tt}
                      type="button"
                      size="sm"
                      variant={
                        template.textTransform === tt ? "default" : "outline"
                      }
                      className="flex-1 capitalize"
                      onClick={() => update({ textTransform: tt })}
                    >
                      {tt}
                    </Button>
                  ))}
                </div>
              </div>
              {/* Letter Spacing */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Letter Spacing</Label>
                  <span className="text-xs font-mono text-muted-foreground">
                    {template.letterSpacing}
                  </span>
                </div>
                <Slider
                  value={[template.letterSpacing]}
                  onValueChange={([v]) => update({ letterSpacing: v })}
                  min={0}
                  max={20}
                  step={1}
                />
              </div>
              {/* Scale X */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Scale X</Label>
                  <span className="text-xs font-mono text-muted-foreground">
                    {template.scaleX}%
                  </span>
                </div>
                <Slider
                  value={[template.scaleX]}
                  onValueChange={([v]) => update({ scaleX: v })}
                  min={50}
                  max={200}
                  step={5}
                />
              </div>
            </CardContent>
          </Card>

          {/* Colors */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Colors</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Text Color</Label>
                <ColorPicker
                  value={template.textColor}
                  presets={TEXT_PRESETS}
                  onChange={(c) => update({ textColor: c })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Background Color</Label>
                <ColorPicker
                  value={template.bgColor}
                  presets={BG_PRESETS}
                  onChange={(c) => update({ bgColor: c })}
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Background Opacity</Label>
                  <span className="text-xs font-mono text-muted-foreground">
                    {template.bgOpacity}%
                  </span>
                </div>
                <Slider
                  value={[template.bgOpacity]}
                  onValueChange={([v]) => update({ bgOpacity: v })}
                  min={0}
                  max={100}
                  step={1}
                />
              </div>
            </CardContent>
          </Card>

          {/* Border & Shadow */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Border & Shadow</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Border Style</Label>
                <div className="flex gap-1">
                  {(["box", "outline"] as const).map((bs) => (
                    <Button
                      key={bs}
                      type="button"
                      size="sm"
                      variant={
                        template.borderStyle === bs ? "default" : "outline"
                      }
                      className="flex-1 capitalize"
                      onClick={() => update({ borderStyle: bs })}
                    >
                      {bs === "box" ? "Box Background" : "Text Outline"}
                    </Button>
                  ))}
                </div>
              </div>
              {template.borderStyle === "outline" && (
                <>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Outline Width</Label>
                      <span className="text-xs font-mono text-muted-foreground">
                        {template.outlineWidth}
                      </span>
                    </div>
                    <Slider
                      value={[template.outlineWidth]}
                      onValueChange={([v]) => update({ outlineWidth: v })}
                      min={0}
                      max={10}
                      step={1}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Shadow Distance</Label>
                      <span className="text-xs font-mono text-muted-foreground">
                        {template.shadowDistance}
                      </span>
                    </div>
                    <Slider
                      value={[template.shadowDistance]}
                      onValueChange={([v]) => update({ shadowDistance: v })}
                      min={0}
                      max={10}
                      step={1}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Shadow / Outline Color</Label>
                    <ColorPicker
                      value={template.shadowColor}
                      presets={["#000000", "#FFFFFF", "#1E293B", "#7C3AED"]}
                      onChange={(c) => update({ shadowColor: c })}
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
