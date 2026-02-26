"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StickyNote, Trash2, Loader2, ExternalLink } from "lucide-react";

const ALL_TAGS = ["youtube", "insta", "auto", "manual", "published"] as const;
type Tag = (typeof ALL_TAGS)[number];

const TAG_COLORS: Record<Tag, string> = {
  youtube: "bg-red-500/10 text-red-600 border-red-200",
  insta: "bg-pink-500/10 text-pink-600 border-pink-200",
  auto: "bg-blue-500/10 text-blue-600 border-blue-200",
  manual: "bg-amber-500/10 text-amber-600 border-amber-200",
  published: "bg-green-500/10 text-green-600 border-green-200",
};

interface Note {
  id: string;
  url: string;
  tags: Tag[];
  createdAt: string;
}

export default function NotesPage() {
  const router = useRouter();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [url, setUrl] = useState("");
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);

  useEffect(() => {
    fetch("/api/notes")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        setNotes(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const toggleTag = (tag: Tag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setSaving(true);

    const res = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, tags: selectedTags }),
    });

    if (res.ok) {
      const note = await res.json();
      setNotes((prev) => [note, ...prev]);
      setUrl("");
      setSelectedTags([]);
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    const res = await fetch(`/api/notes/${id}`, { method: "DELETE" });
    if (res.ok) {
      setNotes((prev) => prev.filter((n) => n.id !== id));
    }
    setDeleting(null);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <StickyNote className="h-5 w-5" />
          Notes
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Save video URLs for later
        </p>
      </div>

      {/* Add URL form */}
      <form onSubmit={handleAdd} className="mb-6 space-y-3">
        <div className="flex gap-2">
          <Input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste a video URL..."
            required
            className="flex-1"
          />
          <Button type="submit" disabled={saving || !url.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
          </Button>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {ALL_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className={`px-2.5 py-0.5 text-xs rounded-full border transition-colors ${
                selectedTags.includes(tag)
                  ? TAG_COLORS[tag]
                  : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </form>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : notes.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <StickyNote className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p className="text-sm">No URLs saved yet</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">
                  URL
                </th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">
                  Tags
                </th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground w-24">
                  Date
                </th>
                <th className="w-20" />
              </tr>
            </thead>
            <tbody>
              {notes.map((note) => (
                <tr key={note.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2.5 max-w-xs">
                    <a
                      href={note.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-foreground hover:underline truncate block"
                      title={note.url}
                    >
                      {note.url.replace(/^https?:\/\/(www\.)?/, "").slice(0, 60)}
                      {note.url.replace(/^https?:\/\/(www\.)?/, "").length > 60 ? "..." : ""}
                    </a>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-1 flex-wrap">
                      {note.tags.map((tag) => (
                        <Badge
                          key={tag}
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 ${TAG_COLORS[tag as Tag] || ""}`}
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(note.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-1 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        title="Use this URL"
                        onClick={() =>
                          router.push(`/?url=${encodeURIComponent(note.url)}`)
                        }
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        title="Delete"
                        onClick={() => handleDelete(note.id)}
                        disabled={deleting === note.id}
                      >
                        {deleting === note.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
