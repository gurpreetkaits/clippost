import { NextRequest, NextResponse } from "next/server";
import { createClipWithCaptions, CaptionSegment } from "@/lib/ffmpeg";
import { getVideoPath } from "@/lib/youtube";

export async function POST(request: NextRequest) {
  try {
    const {
      filename,
      start,
      end,
      captions,
    }: {
      filename: string;
      start: number;
      end: number;
      captions: CaptionSegment[];
    } = await request.json();

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

    const videoPath = getVideoPath(filename);
    const clipFilename = await createClipWithCaptions(
      videoPath,
      start,
      end,
      captions || []
    );

    return NextResponse.json({ clipFilename });
  } catch (error) {
    console.error("Clip creation error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create clip",
      },
      { status: 500 }
    );
  }
}
