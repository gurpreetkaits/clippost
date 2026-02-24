export interface CaptionStyle {
  fontFamily: string;
  fontSize: number;
  textColor: string;
  bgColor: string;
  bgOpacity: number;
  position: "top" | "center" | "bottom";
  bold: boolean;
  italic: boolean;
}

export const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  fontFamily: "Helvetica Neue",
  fontSize: 55,
  textColor: "#000000",
  bgColor: "#FFFFFF",
  bgOpacity: 100,
  position: "bottom",
  bold: true,
  italic: false,
};
