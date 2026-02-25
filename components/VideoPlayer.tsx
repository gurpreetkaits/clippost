"use client";

import { useRef, useEffect, useCallback } from "react";

export interface VideoPlayerHandle {
  seek: (time: number) => void;
  setVolume: (v: number) => void;
  setMuted: (m: boolean) => void;
  setPlaybackRate: (r: number) => void;
}

interface VideoPlayerProps {
  url: string;
  start: number;
  end: number;
  playing?: boolean;
  onProgress?: (seconds: number) => void;
  onDuration?: (duration: number) => void;
  onClickVideo?: () => void;
  /** When provided, the wrapper fills its parent (no own aspect ratio). */
  fill?: boolean;
  /** Imperative handle for seeking, volume, speed */
  playerRef?: React.MutableRefObject<VideoPlayerHandle | null>;
}

export default function VideoPlayer({
  url,
  start,
  end,
  playing = false,
  onProgress,
  onDuration,
  onClickVideo,
  fill,
  playerRef,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Expose imperative handle
  useEffect(() => {
    if (!playerRef) return;
    playerRef.current = {
      seek(time: number) {
        if (videoRef.current) videoRef.current.currentTime = time;
      },
      setVolume(v: number) {
        if (videoRef.current) videoRef.current.volume = v;
      },
      setMuted(m: boolean) {
        if (videoRef.current) videoRef.current.muted = m;
      },
      setPlaybackRate(r: number) {
        if (videoRef.current) videoRef.current.playbackRate = r;
      },
    };
    return () => {
      if (playerRef) playerRef.current = null;
    };
  }, [playerRef]);

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
    if (playing) video.play().catch(() => {});
    else video.pause();
  }, [playing]);

  const handleSeekToStart = useCallback(() => {
    if (videoRef.current) videoRef.current.currentTime = start;
  }, [start]);

  useEffect(() => {
    handleSeekToStart();
  }, [handleSeekToStart]);

  return (
    <div
      className="relative w-full bg-black rounded-lg overflow-hidden"
      style={fill ? { width: "100%", height: "100%" } : { aspectRatio: "16/9" }}
      onClick={onClickVideo}
    >
      <video
        ref={videoRef}
        src={url}
        className="w-full h-full pointer-events-none"
        style={{ objectFit: fill ? "cover" : "contain" }}
        preload="auto"
      />
    </div>
  );
}
