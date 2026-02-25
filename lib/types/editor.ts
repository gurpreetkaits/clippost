export interface CaptionSegment {
  start: number;
  end: number;
  text: string;
  words?: { word: string; start: number; end: number }[];
}

export interface TextOverlay {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
}

export type SelectedElement =
  | { type: "caption"; segmentIndex: number }
  | { type: "overlay"; overlayId: string }
  | null;
