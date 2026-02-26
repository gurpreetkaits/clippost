import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { requireAuth } from "@/lib/auth";

const TMP_DIR = path.join(process.cwd(), "tmp");

const MIME_MAP: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".ogg": "audio/ogg",
};

function nodeStreamToWeb(stream: fs.ReadStream): ReadableStream {
  let closed = false;
  return new ReadableStream({
    start(controller) {
      stream.on("data", (chunk) => {
        if (!closed) controller.enqueue(chunk);
      });
      stream.on("end", () => {
        if (!closed) { closed = true; controller.close(); }
      });
      stream.on("error", (err) => {
        if (!closed) { closed = true; controller.error(err); }
      });
    },
    cancel() {
      closed = true;
      stream.destroy();
    },
  });
}

export async function GET(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const filename = request.nextUrl.searchParams.get("file");
  if (!filename) {
    return NextResponse.json({ error: "Missing file parameter" }, { status: 400 });
  }

  const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeName = path.basename(filename);
  const musicDir = path.join(TMP_DIR, safeUserId, "music");
  const filePath = path.join(musicDir, safeName);

  if (!filePath.startsWith(musicDir)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const stat = fs.statSync(filePath);
  const ext = path.extname(safeName).toLowerCase();
  const contentType = MIME_MAP[ext] || "audio/mpeg";

  const rangeHeader = request.headers.get("range");

  if (rangeHeader) {
    const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
    if (match) {
      const start = parseInt(match[1], 10);
      const end = match[2] ? parseInt(match[2], 10) : stat.size - 1;
      const chunkSize = end - start + 1;
      const stream = fs.createReadStream(filePath, { start, end });

      return new Response(nodeStreamToWeb(stream), {
        status: 206,
        headers: {
          "Content-Range": `bytes ${start}-${end}/${stat.size}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunkSize.toString(),
          "Content-Type": contentType,
        },
      });
    }
  }

  const stream = fs.createReadStream(filePath);

  return new Response(nodeStreamToWeb(stream), {
    headers: {
      "Content-Length": stat.size.toString(),
      "Content-Type": contentType,
      "Accept-Ranges": "bytes",
    },
  });
}
