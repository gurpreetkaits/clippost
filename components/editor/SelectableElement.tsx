"use client";

import { useRef, useCallback, useEffect, useState } from "react";

interface SelectableElementProps {
  /** Unique identifier for hit-testing */
  elementId: string;
  /** "caption" | "overlay" for data attributes */
  elementType: "caption" | "overlay";
  /** Whether this element is currently selected */
  selected: boolean;
  /** Position as percentage (0-100) */
  x: number;
  y: number;
  /** Called when user clicks to select */
  onSelect: () => void;
  /** Called when user drags to reposition */
  onMove: (x: number, y: number) => void;
  /** Called when user resizes (corner drag changes fontSize) */
  onResize?: (fontSize: number) => void;
  /** Reference to the canvas container for coordinate math */
  canvasRef: React.RefObject<HTMLDivElement | null>;
  /** Current font size (used for resize calculations) */
  fontSize?: number;
  /** Additional CSS classes */
  className?: string;
  /** Additional inline styles */
  style?: React.CSSProperties;
  children: React.ReactNode;
}

type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

const HANDLE_CURSORS: Record<ResizeHandle, string> = {
  nw: "nwse-resize",
  n: "ns-resize",
  ne: "nesw-resize",
  e: "ew-resize",
  se: "nwse-resize",
  s: "ns-resize",
  sw: "nesw-resize",
  w: "ew-resize",
};

export default function SelectableElement({
  elementId,
  elementType,
  selected,
  x,
  y,
  onSelect,
  onMove,
  onResize,
  canvasRef,
  fontSize,
  className = "",
  style,
  children,
}: SelectableElementProps) {
  const elRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const resizing = useRef<ResizeHandle | null>(null);
  const offset = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ clientY: 0, fontSize: 0 });

  // Track if we actually moved (to distinguish click from drag)
  const didMove = useRef(false);

  /* ---------- Drag ---------- */

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Don't start drag if clicking a resize handle
      if ((e.target as HTMLElement).dataset.resizeHandle) return;

      e.preventDefault();
      e.stopPropagation();
      dragging.current = true;
      didMove.current = false;

      const el = elRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      offset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    []
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (resizing.current) return; // handled by resize logic

      if (!dragging.current || !canvasRef.current) return;
      didMove.current = true;
      const canvas = canvasRef.current.getBoundingClientRect();
      const newX =
        ((e.clientX - canvas.left - offset.current.x) / canvas.width) * 100;
      const newY =
        ((e.clientY - canvas.top - offset.current.y) / canvas.height) * 100;
      onMove(
        Math.max(0, Math.min(90, newX)),
        Math.max(0, Math.min(90, newY))
      );
    },
    [canvasRef, onMove]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (dragging.current && !didMove.current) {
        // It was a click, not a drag
        onSelect();
      }
      dragging.current = false;
      didMove.current = false;

      // Also clean up resize if active
      if (resizing.current) {
        resizing.current = null;
      }
    },
    [onSelect]
  );

  /* ---------- Resize ---------- */

  const handleResizePointerDown = useCallback(
    (handle: ResizeHandle, e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      resizing.current = handle;
      resizeStart.current = {
        clientY: e.clientY,
        fontSize: fontSize || 24,
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [fontSize]
  );

  const handleResizePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!resizing.current || !onResize) return;

      const handle = resizing.current;
      const deltaY = e.clientY - resizeStart.current.clientY;

      // For corner and vertical edge handles, dragging down = bigger
      const isGrowDown = ["s", "se", "sw"].includes(handle);
      const isGrowUp = ["n", "ne", "nw"].includes(handle);

      let delta = 0;
      if (isGrowDown) delta = deltaY * 0.5;
      else if (isGrowUp) delta = -deltaY * 0.5;
      else {
        // east/west - use deltaY anyway for simplicity
        delta = deltaY * 0.5;
      }

      const newSize = Math.max(10, Math.min(120, resizeStart.current.fontSize + delta));
      onResize(Math.round(newSize));
    },
    [onResize]
  );

  const handleResizePointerUp = useCallback(() => {
    resizing.current = null;
  }, []);

  /* ---------- Click outside deselection is handled by parent ---------- */

  const handles: ResizeHandle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

  const handlePositions: Record<ResizeHandle, React.CSSProperties> = {
    nw: { top: -3, left: -3 },
    n: { top: -3, left: "50%", transform: "translateX(-50%)" },
    ne: { top: -3, right: -3 },
    e: { top: "50%", right: -3, transform: "translateY(-50%)" },
    se: { bottom: -3, right: -3 },
    s: { bottom: -3, left: "50%", transform: "translateX(-50%)" },
    sw: { bottom: -3, left: -3 },
    w: { top: "50%", left: -3, transform: "translateY(-50%)" },
  };

  return (
    <div
      ref={elRef}
      data-element-type={elementType}
      data-element-id={elementId}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className={`absolute select-none touch-none z-20 ${
        selected
          ? "ring-2 ring-blue-500 ring-offset-1"
          : "hover:ring-2 hover:ring-blue-400/50"
      } rounded cursor-grab active:cursor-grabbing ${className}`}
      style={{
        left: `${x}%`,
        top: `${y}%`,
        ...style,
      }}
    >
      {children}

      {/* Resize handles — only when selected */}
      {selected &&
        handles.map((handle) => (
          <div
            key={handle}
            data-resize-handle={handle}
            onPointerDown={(e) => handleResizePointerDown(handle, e)}
            onPointerMove={handleResizePointerMove}
            onPointerUp={handleResizePointerUp}
            className="absolute w-[7px] h-[7px] bg-blue-500 border border-white rounded-[1px] z-30"
            style={{
              ...handlePositions[handle],
              cursor: HANDLE_CURSORS[handle],
            }}
          />
        ))}
    </div>
  );
}
