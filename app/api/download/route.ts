import { NextRequest, NextResponse } from "next/server";
import { downloadVideo, isValidYouTubeUrl } from "@/lib/youtube";
import { requireAuth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  try {
    const { url } = await request.json();

    if (!url || !isValidYouTubeUrl(url)) {
      return NextResponse.json(
        { error: "Invalid YouTube URL" },
        { status: 400 }
      );
    }

    const metadata = await downloadVideo(userId, url);

    return NextResponse.json({
      id: metadata.id,
      title: metadata.title,
      duration: metadata.duration,
      filename: metadata.filename,
    });
  } catch (error) {
    console.error("Download error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to download video",
      },
      { status: 500 }
    );
  }
}
