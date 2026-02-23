import { NextRequest, NextResponse } from "next/server";
import { extractAudio, cleanup } from "@/lib/ffmpeg";
import { transcribeAudio } from "@/lib/whisper";
import { getVideoPath } from "@/lib/youtube";
import { requireAuth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  let audioPath: string | null = null;

  try {
    const { filename, start, end } = await request.json();

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

    const segments = await transcribeAudio(audioPath);

    // Offset timestamps relative to clip start
    const offsetSegments = segments.map((seg) => ({
      start: seg.start + start,
      end: seg.end + start,
      text: seg.text,
    }));

    return NextResponse.json({ segments: offsetSegments });
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
