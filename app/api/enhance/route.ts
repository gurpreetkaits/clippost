import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getVideoPath } from "@/lib/youtube";
import { applyEnhancement } from "@/lib/enhance";

function sseEvent(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  let body: { filename: string; start: number; end: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { filename, start, end } = body;
  if (!filename || start === undefined || end === undefined) {
    return NextResponse.json(
      { error: "Missing required fields: filename, start, end" },
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

        progress("enhancing", "Sharpening & denoising...", 10);
        const enhancedFilename = await applyEnhancement(
          userId,
          videoPath,
          start,
          end
        );
        progress("enhancing", "Enhancement applied", 95);

        send({
          type: "done",
          percent: 100,
          enhancedFilename,
        });
      } catch (err) {
        send({
          type: "error",
          message:
            err instanceof Error ? err.message : "Enhancement failed",
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
