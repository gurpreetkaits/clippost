import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";

const TMP_DIR = path.join(process.cwd(), "tmp");

export async function GET(request: NextRequest) {
  const filename = request.nextUrl.searchParams.get("file");

  if (!filename) {
    return NextResponse.json({ error: "Missing file parameter" }, { status: 400 });
  }

  // Prevent path traversal
  const safeName = path.basename(filename);
  const filepath = path.join(TMP_DIR, safeName);

  if (!fs.existsSync(filepath)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const stat = fs.statSync(filepath);
  const rangeHeader = request.headers.get("range");

  if (rangeHeader) {
    const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
    if (match) {
      const start = parseInt(match[1], 10);
      const end = match[2] ? parseInt(match[2], 10) : stat.size - 1;
      const chunkSize = end - start + 1;

      const stream = fs.createReadStream(filepath, { start, end });
      const readable = new ReadableStream({
        start(controller) {
          stream.on("data", (chunk) => controller.enqueue(chunk));
          stream.on("end", () => controller.close());
          stream.on("error", (err) => controller.error(err));
        },
      });

      return new Response(readable, {
        status: 206,
        headers: {
          "Content-Range": `bytes ${start}-${end}/${stat.size}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunkSize.toString(),
          "Content-Type": "video/mp4",
        },
      });
    }
  }

  const stream = fs.createReadStream(filepath);
  const readable = new ReadableStream({
    start(controller) {
      stream.on("data", (chunk) => controller.enqueue(chunk));
      stream.on("end", () => controller.close());
      stream.on("error", (err) => controller.error(err));
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Length": stat.size.toString(),
      "Content-Type": "video/mp4",
      "Accept-Ranges": "bytes",
    },
  });
}
