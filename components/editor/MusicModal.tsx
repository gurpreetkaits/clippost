"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Upload,
  Search,
  Play,
  Pause,
  Star,
  Trash2,
  Loader2,
  Check,
  Volume2,
  Settings,
  Music2,
} from "lucide-react";

interface MusicTrack {
  id: string;
  filename: string;
  originalName: string;
  duration: number;
  isFavorite: boolean;
  isDefault: boolean;
}

interface MusicModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedTrackId: string | null;
  musicVolume: number;
  musicStartTime: number;
  musicEndTime: number | null;
  onSelectTrack: (track: { id: string; name: string; filename: string; duration: number } | null) => void;
  onVolumeChange: (volume: number) => void;
  onTrimChange: (startTime: number, endTime: number | null) => void;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function TrackList({
  tracks,
  loading,
  emptyMessage,
  selectedTrackId,
  playingId,
  onSelect,
  onTogglePlay,
  onToggleFavorite,
  onDelete,
}: {
  tracks: MusicTrack[];
  loading: boolean;
  emptyMessage: string;
  selectedTrackId: string | null;
  playingId: string | null;
  onSelect: (track: MusicTrack) => void;
  onTogglePlay: (track: MusicTrack) => void;
  onToggleFavorite?: (track: MusicTrack) => void;
  onDelete?: (track: MusicTrack) => void;
}) {
  return (
    <div className="max-h-52 overflow-y-auto space-y-1 rounded-md border p-1">
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : tracks.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          {emptyMessage}
        </p>
      ) : (
        tracks.map((track) => (
          <div
            key={track.id}
            className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors text-sm ${
              selectedTrackId === track.id
                ? "bg-blue-500/15 border border-blue-500/30"
                : "hover:bg-muted/50 border border-transparent"
            }`}
            onClick={() => onSelect(track)}
          >
            <button
              className="shrink-0 p-1 rounded hover:bg-muted"
              onClick={(e) => {
                e.stopPropagation();
                onTogglePlay(track);
              }}
            >
              {playingId === track.id ? (
                <Pause className="h-3.5 w-3.5" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
            </button>

            <span className="truncate flex-1 min-w-0">{track.originalName}</span>
            <span className="text-xs text-muted-foreground shrink-0">
              {formatDuration(track.duration)}
            </span>

            {selectedTrackId === track.id && (
              <Check className="h-3.5 w-3.5 text-blue-500 shrink-0" />
            )}

            {onToggleFavorite && (
              <button
                className="shrink-0 p-1 rounded hover:bg-muted"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite(track);
                }}
              >
                <Star
                  className={`h-3.5 w-3.5 ${
                    track.isFavorite ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"
                  }`}
                />
              </button>
            )}

            {onDelete && (
              <button
                className="shrink-0 p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(track);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))
      )}
    </div>
  );
}

function TrimControls({
  track,
  startTime,
  endTime,
  onTrimChange,
  onPreviewTrim,
  previewPlaying,
}: {
  track: MusicTrack;
  startTime: number;
  endTime: number | null;
  onTrimChange: (start: number, end: number | null) => void;
  onPreviewTrim: () => void;
  previewPlaying: boolean;
}) {
  const effectiveEnd = endTime ?? track.duration;
  const selectedDuration = effectiveEnd - startTime;

  return (
    <div className="rounded-md border p-3 space-y-3 bg-muted/30">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium">Trim: {track.originalName}</span>
        <span className="text-xs text-muted-foreground">
          Selected: {formatDuration(selectedDuration)} of {formatDuration(track.duration)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs text-muted-foreground">Start</label>
            <span className="text-xs font-mono">{formatDuration(startTime)}</span>
          </div>
          <Slider
            value={[startTime]}
            min={0}
            max={Math.max(0, effectiveEnd - 1)}
            step={0.5}
            onValueChange={([v]) => onTrimChange(v, endTime)}
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs text-muted-foreground">End</label>
            <span className="text-xs font-mono">{formatDuration(effectiveEnd)}</span>
          </div>
          <Slider
            value={[effectiveEnd]}
            min={startTime + 1}
            max={track.duration}
            step={0.5}
            onValueChange={([v]) => onTrimChange(startTime, v >= track.duration - 0.5 ? null : v)}
          />
        </div>
      </div>

      <Button
        variant="outline"
        size="sm"
        className="h-7 text-xs"
        onClick={onPreviewTrim}
      >
        {previewPlaying ? (
          <Pause className="h-3 w-3 mr-1" />
        ) : (
          <Play className="h-3 w-3 mr-1" />
        )}
        Preview trim
      </Button>
    </div>
  );
}

export default function MusicModal({
  open,
  onOpenChange,
  selectedTrackId,
  musicVolume,
  musicStartTime,
  musicEndTime,
  onSelectTrack,
  onVolumeChange,
  onTrimChange,
}: MusicModalProps) {
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [savingDefaults, setSavingDefaults] = useState(false);

  const fetchTracks = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/music");
      if (r.ok) setTracks(await r.json());
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (open) fetchTracks();
  }, [open, fetchTracks]);

  // Stop audio when modal closes
  useEffect(() => {
    if (!open && audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setPlayingId(null);
      setPreviewPlaying(false);
    }
  }, [open]);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingId(null);
    setPreviewPlaying(false);
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const r = await fetch("/api/music/upload", { method: "POST", body: formData });
      if (!r.ok) {
        const data = await r.json();
        alert(data.error || "Upload failed");
        return;
      }
      await fetchTracks();
    } catch {
      alert("Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const togglePlay = useCallback((track: MusicTrack) => {
    if (playingId === track.id) {
      stopAudio();
      return;
    }

    stopAudio();

    const audio = new Audio(`/api/music/stream?file=${encodeURIComponent(track.filename)}`);
    audio.onended = () => {
      setPlayingId(null);
      setPreviewPlaying(false);
    };
    audio.play();
    audioRef.current = audio;
    setPlayingId(track.id);
    setPreviewPlaying(false);
  }, [playingId, stopAudio]);

  const previewTrim = useCallback(() => {
    const selectedTrack = tracks.find((t) => t.id === selectedTrackId);
    if (!selectedTrack) return;

    if (previewPlaying) {
      stopAudio();
      return;
    }

    stopAudio();

    const audio = new Audio(`/api/music/stream?file=${encodeURIComponent(selectedTrack.filename)}`);
    const effectiveEnd = musicEndTime ?? selectedTrack.duration;

    audio.currentTime = musicStartTime;
    audio.onended = () => {
      setPreviewPlaying(false);
      setPlayingId(null);
    };
    audio.ontimeupdate = () => {
      if (audio.currentTime >= effectiveEnd) {
        audio.pause();
        setPreviewPlaying(false);
        setPlayingId(null);
      }
    };
    audio.play();
    audioRef.current = audio;
    setPlayingId(selectedTrack.id);
    setPreviewPlaying(true);
  }, [tracks, selectedTrackId, musicStartTime, musicEndTime, previewPlaying, stopAudio]);

  const toggleFavorite = async (track: MusicTrack) => {
    await fetch(`/api/music/${track.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isFavorite: !track.isFavorite }),
    });
    setTracks((prev) =>
      prev.map((t) => (t.id === track.id ? { ...t, isFavorite: !t.isFavorite } : t))
    );
  };

  const deleteTrack = async (track: MusicTrack) => {
    await fetch(`/api/music/${track.id}`, { method: "DELETE" });
    if (playingId === track.id) stopAudio();
    if (selectedTrackId === track.id) onSelectTrack(null);
    setTracks((prev) => prev.filter((t) => t.id !== track.id));
  };

  const selectTrack = useCallback((track: MusicTrack) => {
    if (selectedTrackId === track.id) {
      onSelectTrack(null);
      onTrimChange(0, null);
    } else {
      onSelectTrack({ id: track.id, name: track.originalName, filename: track.filename, duration: track.duration });
      onTrimChange(0, null);
    }
  }, [selectedTrackId, onSelectTrack, onTrimChange]);

  const handleSetDefault = async (track: MusicTrack) => {
    // Set as default track
    await fetch(`/api/music/${track.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDefault: true }),
    });
    setTracks((prev) =>
      prev.map((t) => ({
        ...t,
        isDefault: t.id === track.id,
      }))
    );
  };

  const handleSaveDefaultVolume = async () => {
    setSavingDefaults(true);
    try {
      await fetch("/api/settings/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultMusicVolume: musicVolume }),
      });
    } catch { /* ignore */ }
    setSavingDefaults(false);
  };

  const selectedTrack = tracks.find((t) => t.id === selectedTrackId);
  const filtered = tracks.filter((t) =>
    t.originalName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Music2 className="h-5 w-5" />
            Background Music
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="search" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="search" className="flex-1">
              <Search className="h-3.5 w-3.5 mr-1.5" />
              Search
            </TabsTrigger>
            <TabsTrigger value="uploaded" className="flex-1">
              <Upload className="h-3.5 w-3.5 mr-1.5" />
              Uploaded
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex-1">
              <Settings className="h-3.5 w-3.5 mr-1.5" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* Search Tab */}
          <TabsContent value="search" className="space-y-3 mt-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tracks..."
                className="pl-8 h-9"
              />
            </div>

            <TrackList
              tracks={filtered}
              loading={loading}
              emptyMessage={tracks.length === 0 ? "No music uploaded yet" : "No tracks match your search"}
              selectedTrackId={selectedTrackId}
              playingId={playingId}
              onSelect={selectTrack}
              onTogglePlay={togglePlay}
            />

            {selectedTrack && (
              <TrimControls
                track={selectedTrack}
                startTime={musicStartTime}
                endTime={musicEndTime}
                onTrimChange={onTrimChange}
                onPreviewTrim={previewTrim}
                previewPlaying={previewPlaying}
              />
            )}
          </TabsContent>

          {/* Uploaded Tab */}
          <TabsContent value="uploaded" className="space-y-3 mt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Upload className="h-4 w-4 mr-1" />
              )}
              Upload Track
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={handleUpload}
            />

            <TrackList
              tracks={tracks}
              loading={loading}
              emptyMessage="No music uploaded yet"
              selectedTrackId={selectedTrackId}
              playingId={playingId}
              onSelect={selectTrack}
              onTogglePlay={togglePlay}
              onToggleFavorite={toggleFavorite}
              onDelete={deleteTrack}
            />

            {selectedTrack && (
              <TrimControls
                track={selectedTrack}
                startTime={musicStartTime}
                endTime={musicEndTime}
                onTrimChange={onTrimChange}
                onPreviewTrim={previewTrim}
                previewPlaying={previewPlaying}
              />
            )}
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4 mt-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Default Track</label>
              <p className="text-xs text-muted-foreground">
                The default track will be pre-selected when you open the editor.
              </p>
              <div className="max-h-40 overflow-y-auto space-y-1 rounded-md border p-1">
                {tracks.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No tracks uploaded
                  </p>
                ) : (
                  tracks.map((track) => (
                    <div
                      key={track.id}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors text-sm ${
                        track.isDefault
                          ? "bg-blue-500/15 border border-blue-500/30"
                          : "hover:bg-muted/50 border border-transparent"
                      }`}
                      onClick={() => handleSetDefault(track)}
                    >
                      <span className="truncate flex-1">{track.originalName}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDuration(track.duration)}
                      </span>
                      {track.isDefault && (
                        <Check className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Default Volume</label>
                <span className="text-sm text-muted-foreground">{musicVolume}%</span>
              </div>
              <Slider
                value={[musicVolume]}
                min={0}
                max={100}
                step={1}
                onValueChange={([v]) => onVolumeChange(v)}
              />
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={handleSaveDefaultVolume}
                disabled={savingDefaults}
              >
                {savingDefaults ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <Check className="h-3 w-3 mr-1" />
                )}
                Save as default
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        {/* Bottom volume control — always visible */}
        <div className="border-t pt-3 space-y-2">
          <div className="flex items-center gap-2">
            <Volume2 className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium">Music Volume</span>
            <span className="ml-auto text-sm text-muted-foreground">{musicVolume}%</span>
          </div>
          <Slider
            value={[musicVolume]}
            min={0}
            max={100}
            step={1}
            onValueChange={([v]) => onVolumeChange(v)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
