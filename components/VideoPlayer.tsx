"use client";

import { useRef, useEffect, useCallback } from "react";

interface VideoPlayerProps {
  url: string;
  start: number;
  end: number;
  playing?: boolean;
  onProgress?: (seconds: number) => void;
  onDuration?: (duration: number) => void;
  style?: React.CSSProperties;
}

export default function VideoPlayer({
  url,
  start,
  end,
  playing = false,
  onProgress,
  onDuration,
  style,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      onProgress?.(video.currentTime);
      if (video.currentTime >= end) {
        video.currentTime = start;
      }
    };

    const handleLoadedMetadata = () => {
      onDuration?.(video.duration);
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("loadedmetadata", handleLoadedMetadata);

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
    };
  }, [start, end, onProgress, onDuration]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (playing) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [playing]);

  const handleSeekToStart = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = start;
    }
  }, [start]);

  useEffect(() => {
    handleSeekToStart();
  }, [handleSeekToStart]);

  return (
    <div
      className="relative w-full bg-black rounded-lg overflow-hidden"
      style={style ? { width: "100%", height: "100%" } : { aspectRatio: "16/9" }}
    >
      <video
        ref={videoRef}
        src={url}
        controls
        className="w-full h-full"
        style={style ?? { objectFit: "contain" }}
        preload="auto"
      />
    </div>
  );
}
