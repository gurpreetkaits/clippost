import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { downloadVideo, getVideoPath } from "@/lib/youtube";
import { isValidYouTubeUrl } from "@/lib/youtube";
import { extractFullAudio, createClipWithCaptions, createClipNoCaptions, cleanup } from "@/lib/ffmpeg";
import { transcribeFullAudio } from "@/lib/whisper";
import { splitLongSegments } from "@/lib/whisper";
import { findBestSegment, filterCaptionsForRange } from "@/lib/ai";
import { NextResponse } from "next/server";

function sseEvent(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  const { userId } = authResult;

  let body: { url: string; purpose: string; generateCaptions: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { url, purpose, generateCaptions } = body;

  if (!url || !isValidYouTubeUrl(url)) {
    return NextResponse.json({ error: "Invalid YouTube URL" }, { status: 400 });
  }

  if (!purpose || purpose.trim().length === 0) {
    return NextResponse.json({ error: "Purpose is required" }, { status: 400 });
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

      let audioPath: string | null = null;

      try {
        // Step 1: Download video
        progress("downloading", "Downloading video...", 5);
        const metadata = await downloadVideo(userId, url);
        const videoPath = getVideoPath(userId, metadata.filename);
        progress("downloading", "Video downloaded", 20);

        // Step 2: Extract full audio
        progress("extracting_audio", "Extracting audio track...", 22);
        audioPath = await extractFullAudio(userId, videoPath);
        progress("extracting_audio", "Audio extracted", 35);

        // Step 3: Transcribe
        progress("transcribing", "Transcribing audio...", 37);
        const segments = await transcribeFullAudio(audioPath, (chunkPercent) => {
          const scaled = 35 + Math.round((chunkPercent / 100) * 30);
          progress("transcribing", "Transcribing audio...", scaled);
        });
        progress("transcribing", "Transcription complete", 65);

        // Step 4: Analyze with GPT
        progress("analyzing", "Finding best segment...", 67);
        const bestSegment = await findBestSegment(
          segments,
          purpose,
          metadata.duration
        );
        progress("analyzing", `Found segment: ${bestSegment.reason}`, 75);

        // Step 5: Generate clip
        progress("generating_clip", "Generating clip...", 77);

        let clipFilename: string;
        if (generateCaptions) {
          const captionsInRange = filterCaptionsForRange(
            segments,
            bestSegment.start,
            bestSegment.end
          );
          const shortCaptions = splitLongSegments(captionsInRange);
          clipFilename = await createClipWithCaptions(
            userId,
            videoPath,
            bestSegment.start,
            bestSegment.end,
            shortCaptions
          );
        } else {
          clipFilename = await createClipNoCaptions(
            userId,
            videoPath,
            bestSegment.start,
            bestSegment.end
          );
        }
        progress("generating_clip", "Clip generated", 95);

        // Step 6: Done
        send({
          type: "done",
          percent: 100,
          clipFilename,
          start: bestSegment.start,
          end: bestSegment.end,
          title: metadata.title,
          segmentReason: bestSegment.reason,
        });
      } catch (err) {
        send({
          type: "error",
          message: err instanceof Error ? err.message : "Auto-trim failed",
        });
      } finally {
        if (audioPath) cleanup(audioPath);
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
