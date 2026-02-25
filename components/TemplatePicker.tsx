"use client";

import { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ZONE_PRESETS, configToTemplate } from "@/lib/caption-template";
import type { ReelTemplate } from "@/lib/caption-template";

interface SavedTemplate {
  id: string;
  name: string;
  config: Omit<ReelTemplate, "name">;
  isDefault: boolean;
}

interface TemplatePickerProps {
  onSelect: (template: ReelTemplate, id?: string) => void;
}

export default function TemplatePicker({ onSelect }: TemplatePickerProps) {
  const [saved, setSaved] = useState<SavedTemplate[]>([]);
  const [value, setValue] = useState("");

  useEffect(() => {
    fetch("/api/templates")
      .then((r) => (r.ok ? r.json() : []))
      .then(setSaved)
      .catch(() => {});
  }, []);

  const handleChange = (val: string) => {
    setValue(val);

    // Check presets first
    if (val.startsWith("preset:")) {
      const presetName = val.slice(7);
      const preset = ZONE_PRESETS.find((p) => p.name === presetName);
      if (preset) onSelect({ ...preset });
      return;
    }

    // Check saved templates
    const template = saved.find((t) => t.id === val);
    if (template) {
      onSelect(configToTemplate(template.name, template.config), template.id);
    }
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">Load Template</Label>
      <Select value={value} onValueChange={handleChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Choose a template..." />
        </SelectTrigger>
        <SelectContent>
          {ZONE_PRESETS.map((p) => (
            <SelectItem key={`preset:${p.name}`} value={`preset:${p.name}`}>
              {p.name}
            </SelectItem>
          ))}
          {saved.length > 0 && (
            <>
              <div className="px-2 py-1 text-xs text-muted-foreground border-t mt-1 pt-1">
                Saved Templates
              </div>
              {saved.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                  {t.isDefault ? " (Default)" : ""}
                </SelectItem>
              ))}
            </>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
