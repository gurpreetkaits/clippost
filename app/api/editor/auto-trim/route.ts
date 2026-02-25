import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getVideoPath } from "@/lib/youtube";
import { extractFullAudio } from "@/lib/ffmpeg";
import { transcribeFullAudioSarvam } from "@/lib/sarvam";
import { findBestSegment } from "@/lib/ai";
import {
  getCachedTranscription,
  cacheTranscription,
} from "@/lib/transcription-cache";

function sseEvent(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  let body: { filename: string; duration: number; language: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { filename, duration, language } = body;
  if (!filename || !duration) {
    return NextResponse.json(
      { error: "Missing required fields: filename, duration" },
      { status: 400 }
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(data: Record<string, unknown>) {
        controller.enqueue(encoder.encode(sseEvent(data)));
      }

      function progress(step: string, message: string, percent: number) {
        send({ type: "progress", step, message, percent });
      }

      try {
        const videoPath = getVideoPath(userId, filename);
        const videoId = filename.replace(/\.[^.]+$/, "");
        const lang = language || "en-IN";

        // Check cache first
        let segments = getCachedTranscription(userId, videoId, lang);

        if (segments) {
          progress("transcribing", "Using cached transcription", 40);
        } else {
          // Extract audio
          progress("extracting", "Extracting audio...", 5);
          const audioPath = await extractFullAudio(userId, videoPath);

          // Transcribe
          progress("transcribing", "Transcribing audio...", 15);
          segments = await transcribeFullAudioSarvam(
            audioPath,
            lang,
            (pct) => {
              progress(
                "transcribing",
                "Transcribing audio...",
                15 + Math.round(pct * 0.35)
              );
            }
          );
          cacheTranscription(userId, videoId, lang, segments);
          progress("transcribing", "Transcription complete", 50);
        }

        // Find best segment using AI
        progress("analyzing", "Finding best segment...", 55);
        const result = await findBestSegment(
          segments,
          undefined,
          duration,
          lang
        );
        progress("analyzing", "Best segment found", 95);

        send({
          type: "done",
          percent: 100,
          start: result.start,
          end: result.end,
          reason: result.reason,
        });
      } catch (err) {
        send({
          type: "error",
          message:
            err instanceof Error ? err.message : "Auto-trim failed",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
