"use client";

import { useCallback, useRef } from "react";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuLabel,
} from "@/components/ui/context-menu";
import {
  Type,
  Copy,
  Trash2,
  Pencil,
} from "lucide-react";

interface CanvasContextMenuProps {
  children: React.ReactNode;
  /** Ref to the canvas wrapper — used for portal + position calculations */
  canvasRef: React.RefObject<HTMLDivElement | null>;
  onAddTextOverlay: (x: number, y: number) => void;
  onEditCaptionText?: (segmentIndex: number) => void;
  onDuplicateCaption?: (segmentIndex: number) => void;
  onDeleteCaption?: (segmentIndex: number) => void;
  onEditOverlayText?: (overlayId: string) => void;
  onDeleteOverlay?: (overlayId: string) => void;
  onSelectElement?: (type: "caption" | "overlay", id: string) => void;
}

/** Walk up DOM to find closest element with data-element-type */
function findElementData(
  target: EventTarget | null
): { type: "caption" | "overlay"; id: string } | null {
  let el = target as HTMLElement | null;
  while (el) {
    const type = el.dataset.elementType as "caption" | "overlay" | undefined;
    const id = el.dataset.elementId;
    if (type && id) return { type, id };
    el = el.parentElement;
  }
  return null;
}

export default function CanvasContextMenu({
  children,
  canvasRef,
  onAddTextOverlay,
  onEditCaptionText,
  onDuplicateCaption,
  onDeleteCaption,
  onEditOverlayText,
  onDeleteOverlay,
  onSelectElement,
}: CanvasContextMenuProps) {
  const contextTarget = useRef<{
    type: "caption" | "overlay";
    id: string;
  } | null>(null);
  const clickPos = useRef({ x: 50, y: 50 });

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      // Determine what was right-clicked
      contextTarget.current = findElementData(e.target);

      // Calculate click position as percentage of canvas
      if (canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        clickPos.current = {
          x: ((e.clientX - rect.left) / rect.width) * 100,
          y: ((e.clientY - rect.top) / rect.height) * 100,
        };
      }

      // Auto-select the right-clicked element
      if (contextTarget.current && onSelectElement) {
        onSelectElement(contextTarget.current.type, contextTarget.current.id);
      }
    },
    [canvasRef, onSelectElement]
  );

  const target = contextTarget.current;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild onContextMenu={handleContextMenu}>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent>
        {target?.type === "caption" && (
          <>
            <ContextMenuLabel>Caption</ContextMenuLabel>
            {onEditCaptionText && (
              <ContextMenuItem
                onClick={() => onEditCaptionText(Number(target.id))}
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit Text
              </ContextMenuItem>
            )}
            {onDuplicateCaption && (
              <ContextMenuItem
                onClick={() => onDuplicateCaption(Number(target.id))}
              >
                <Copy className="h-3.5 w-3.5" />
                Duplicate
              </ContextMenuItem>
            )}
            <ContextMenuSeparator />
            {onDeleteCaption && (
              <ContextMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => onDeleteCaption(Number(target.id))}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </ContextMenuItem>
            )}
          </>
        )}

        {target?.type === "overlay" && (
          <>
            <ContextMenuLabel>Text Overlay</ContextMenuLabel>
            {onEditOverlayText && (
              <ContextMenuItem
                onClick={() => onEditOverlayText(target.id)}
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit Text
              </ContextMenuItem>
            )}
            <ContextMenuSeparator />
            {onDeleteOverlay && (
              <ContextMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => onDeleteOverlay(target.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </ContextMenuItem>
            )}
          </>
        )}

        {!target && (
          <>
            <ContextMenuItem
              onClick={() =>
                onAddTextOverlay(clickPos.current.x, clickPos.current.y)
              }
            >
              <Type className="h-3.5 w-3.5" />
              Add Text Overlay
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
