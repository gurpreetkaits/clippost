import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getVideoPath } from "@/lib/youtube";
import {
  analyzeVideoColors,
  computeGradingParams,
  applyColorGrading,
  describeCorrections,
} from "@/lib/color-grading";

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

        // Step 1: Analyze colors (0-30%)
        progress("analyzing", "Analyzing video colors...", 5);
        const analysis = await analyzeVideoColors(videoPath, start, end);
        progress("analyzing", "Color analysis complete", 30);

        // Step 2: Compute corrections (30-40%)
        progress("computing", "Computing corrections...", 35);
        const params = computeGradingParams(analysis);
        const corrections = describeCorrections(params);
        progress("computing", corrections.join(", "), 40);

        // Step 3: Apply grading (40-95%)
        progress("grading", "Applying color corrections...", 45);
        const gradedFilename = await applyColorGrading(
          userId,
          videoPath,
          start,
          end,
          params
        );
        progress("grading", "Color grading applied", 95);

        // Done
        send({
          type: "done",
          percent: 100,
          gradedFilename,
          params,
          corrections,
        });
      } catch (err) {
        send({
          type: "error",
          message:
            err instanceof Error ? err.message : "Color grading failed",
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
