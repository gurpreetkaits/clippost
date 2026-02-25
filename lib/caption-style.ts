export interface CaptionStyle {
  fontFamily: string;
  fontSize: number;
  textColor: string;
  bgColor: string;
  bgOpacity: number;
  position: "top" | "center" | "bottom" | "custom";
  bold: boolean;
  italic: boolean;
  customX?: number; // 0-100 percentage
  customY?: number; // 0-100 percentage
}

export const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  fontFamily: "Helvetica Neue",
  fontSize: 42,
  textColor: "#000000",
  bgColor: "#FFFFFF",
  bgOpacity: 100,
  position: "bottom",
  bold: true,
  italic: false,
};
