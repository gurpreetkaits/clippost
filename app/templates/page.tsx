"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Loader2, Palette } from "lucide-react";
import TemplatePreviewCanvas from "@/components/TemplatePreviewCanvas";
import { configToTemplate } from "@/lib/caption-template";
import type { ReelTemplate } from "@/lib/caption-template";

interface SavedTemplate {
  id: string;
  name: string;
  config: Omit<ReelTemplate, "name">;
  isDefault: boolean;
  createdAt: string;
}

export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<SavedTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/templates")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        setTemplates(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this template?")) return;
    setDeleting(id);
    const res = await fetch(`/api/templates/${id}`, { method: "DELETE" });
    if (res.ok) {
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    }
    setDeleting(null);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Caption Templates
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Design reusable caption styles with precise positioning and effects
          </p>
        </div>
        <Button onClick={() => router.push("/templates/designer")} size="sm">
          <Plus className="h-4 w-4 mr-1.5" />
          Create Template
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : templates.length === 0 ? (
        <Card className="p-12 text-center">
          <Palette className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground mb-4">
            No templates yet. Create your first caption template to get started.
          </p>
          <Button
            onClick={() => router.push("/templates/designer")}
            size="sm"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Create Template
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {templates.map((t) => {
            const template = configToTemplate(t.name, t.config);
            return (
              <Card key={t.id} className="overflow-hidden group">
                <div className="p-3">
                  <div className="w-full max-w-[160px] mx-auto">
                    <TemplatePreviewCanvas template={template} />
                  </div>
                </div>
                <div className="px-3 pb-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate flex-1">
                      {t.name}
                    </span>
                    {t.isDefault && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        Default
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-7 text-xs"
                      onClick={() =>
                        router.push(`/templates/designer?id=${t.id}`)
                      }
                    >
                      <Pencil className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(t.id)}
                      disabled={deleting === t.id}
                    >
                      {deleting === t.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
