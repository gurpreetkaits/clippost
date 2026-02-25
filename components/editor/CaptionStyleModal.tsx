"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import TemplatePicker from "@/components/TemplatePicker";
import CaptionStyleEditor from "@/components/CaptionStyleEditor";
import { CaptionStyle } from "@/lib/caption-style";
import type { ReelTemplate } from "@/lib/caption-template";

interface CaptionStyleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  captionStyle: CaptionStyle;
  onCaptionStyleChange: (style: CaptionStyle) => void;
  onTemplateSelect: (template: ReelTemplate, id?: string) => void;
}

export default function CaptionStyleModal({
  open,
  onOpenChange,
  captionStyle,
  onCaptionStyleChange,
  onTemplateSelect,
}: CaptionStyleModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Caption Style</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Template picker */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Template
            </label>
            <TemplatePicker onSelect={onTemplateSelect} />
          </div>

          <div className="h-px bg-border" />

          {/* Manual style editor */}
          <CaptionStyleEditor
            style={captionStyle}
            onChange={onCaptionStyleChange}
            compact
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
