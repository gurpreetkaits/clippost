import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { downloadVideo, getVideoPath } from "@/lib/youtube";
import { isValidYouTubeUrl } from "@/lib/youtube";
import { extractFullAudio, createClipWithCaptions, createClipNoCaptions, cleanup, CaptionSegment } from "@/lib/ffmpeg";
import { transcribeFullAudioSarvam } from "@/lib/sarvam";
import { splitLongSegments } from "@/lib/whisper";
import { findBestSegment, filterCaptionsForRange } from "@/lib/ai";
import { getCachedTranscription, cacheTranscription } from "@/lib/transcription-cache";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkUsageLimit } from "@/lib/usage";

function sseEvent(data: Record<string, unknown>): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  const { userId } = authResult;

  let body: { url: string; purpose?: string; generateCaptions: boolean; language?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { url, purpose, generateCaptions, language } = body;

  if (!url || !isValidYouTubeUrl(url)) {
    return NextResponse.json({ error: "Invalid YouTube URL" }, { status: 400 });
  }

  const usageCheck = await checkUsageLimit(userId, "CLIP_CREATED");
  if (!usageCheck.allowed) {
    return NextResponse.json(
      { error: `Clip limit reached (${usageCheck.used}/${usageCheck.limit} this month). Upgrade to Pro for unlimited clips.` },
      { status: 403 }
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

      let audioPath: string | null = null;

      try {
        // Step 1: Download video
        progress("downloading", "Downloading video...", 5);
        const metadata = await downloadVideo(userId, url);
        const videoPath = getVideoPath(userId, metadata.filename);
        progress("downloading", "Video downloaded", 20);

        // Upsert video record
        const video = await prisma.video.upsert({
          where: { userId_youtubeId: { userId, youtubeId: metadata.id } },
          update: { title: metadata.title, filename: metadata.filename },
          create: {
            userId,
            youtubeId: metadata.id,
            title: metadata.title,
            duration: metadata.duration,
            filename: metadata.filename,
            sourceUrl: url,
          },
        });

        // Step 2: Check for cached transcription on disk
        const transcriptionLanguage = language || "en";
        let segments: CaptionSegment[];
        const cached = getCachedTranscription(userId, metadata.id, transcriptionLanguage);

        if (cached) {
          progress("transcribing", "Using cached transcription...", 37);
          segments = cached;
          progress("transcribing", "Transcription loaded from cache", 65);
        } else {
          // Need to transcribe
          progress("extracting_audio", "Extracting audio track...", 22);
          audioPath = await extractFullAudio(userId, videoPath);
          progress("extracting_audio", "Audio extracted", 35);

          progress("transcribing", "Transcribing audio with Sarvam AI...", 37);
          const transcribeProgress = (chunkPercent: number) => {
            const scaled = 35 + Math.round((chunkPercent / 100) * 30);
            progress("transcribing", "Transcribing audio with Sarvam AI...", scaled);
          };

          segments = await transcribeFullAudioSarvam(audioPath, transcriptionLanguage, transcribeProgress);
          progress("transcribing", "Transcription complete", 65);

          // Cache transcription to disk for reuse
          cacheTranscription(userId, metadata.id, transcriptionLanguage, segments);
        }

        // Step 4: Analyze with GPT
        progress("analyzing", "Finding best segment...", 67);
        const bestSegment = await findBestSegment(
          segments,
          purpose || undefined,
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

        // Track clip in DB
        await prisma.clip.create({
          data: {
            userId,
            videoId: video.id,
            filename: clipFilename,
            startTime: bestSegment.start,
            endTime: bestSegment.end,
            duration: bestSegment.end - bestSegment.start,
            hasCaptions: generateCaptions,
            method: "AUTO_TRIM",
          },
        });

        await prisma.usageRecord.create({
          data: {
            userId,
            action: "CLIP_CREATED",
            metadata: { filename: clipFilename, method: "AUTO_TRIM" },
          },
        });

        // Step 6: Done
        send({
          type: "done",
          percent: 100,
          clipFilename,
          start: bestSegment.start,
          end: bestSegment.end,
          title: metadata.title,
          segmentReason: bestSegment.reason,
          videoFilename: metadata.filename,
          duration: metadata.duration,
          segments,
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
