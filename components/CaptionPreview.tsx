"use client";

import { CaptionSegment } from "@/lib/ffmpeg";

interface CaptionPreviewProps {
  captions: CaptionSegment[];
  currentTime: number;
}

export default function CaptionPreview({
  captions,
  currentTime,
}: CaptionPreviewProps) {
  const activeCaption = captions.find(
    (c) => currentTime >= c.start && currentTime <= c.end
  );

  if (!activeCaption) return null;

  return (
    <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
      <div className="bg-black/65 text-white text-lg font-semibold px-5 py-2.5 rounded-lg text-center max-w-[80%] mx-auto">
        {activeCaption.text}
      </div>
    </div>
  );
}
