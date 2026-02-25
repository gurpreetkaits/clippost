import { NextRequest, NextResponse } from "next/server";
import { extractAudio, cleanup } from "@/lib/ffmpeg";
import { transcribeAudioSarvam, detectLanguage } from "@/lib/sarvam";
import { splitLongSegments } from "@/lib/whisper";
import { getVideoPath } from "@/lib/youtube";
import { requireAuth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  let audioPath: string | null = null;

  try {
    const { filename, start, end, language } = await request.json();

    if (!filename || start === undefined || end === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: filename, start, end" },
        { status: 400 }
      );
    }

    if (end - start > 90) {
      return NextResponse.json(
        { error: "Clip duration cannot exceed 90 seconds" },
        { status: 400 }
      );
    }

    const videoPath = getVideoPath(userId, filename);
    audioPath = await extractAudio(userId, videoPath, start, end);

    // Auto-detect language if set to "auto" or not provided
    let transcriptionLanguage = language || "en";
    let detectedLanguage: string | null = null;
    if (transcriptionLanguage === "auto") {
      detectedLanguage = await detectLanguage(audioPath);
      transcriptionLanguage = detectedLanguage || "en";
    }

    const segments = await transcribeAudioSarvam(audioPath, transcriptionLanguage);

    // Offset timestamps relative to clip start (including word-level)
    const offsetSegments = segments.map((seg) => ({
      ...seg,
      start: seg.start + start,
      end: seg.end + start,
      words: seg.words?.map((w) => ({
        ...w,
        start: w.start + start,
        end: w.end + start,
      })),
    }));

    // Split sentence-level segments into short display segments for captions
    const displaySegments = splitLongSegments(offsetSegments);

    return NextResponse.json({
      segments: displaySegments,
      detectedLanguage,
    });
  } catch (error) {
    console.error("Transcription error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to transcribe audio",
      },
      { status: 500 }
    );
  } finally {
    if (audioPath) cleanup(audioPath);
  }
}
