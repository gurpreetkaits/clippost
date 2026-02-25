import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const TMP_DIR = path.join(process.cwd(), "tmp");
const MAX_AGE_DAYS = 7;
const MAX_AGE_MS = MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

export async function POST(request: NextRequest) {
  // Protect with a secret key
  const authHeader = request.headers.get("authorization");
  const secret = process.env.CLEANUP_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let filesDeleted = 0;
  let bytesFreed = 0;

  function clean(dirPath: string) {
    if (!fs.existsSync(dirPath)) return;
    const now = Date.now();
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      try {
        if (entry.isDirectory()) {
          clean(fullPath);
          const remaining = fs.readdirSync(fullPath);
          if (remaining.length === 0) fs.rmdirSync(fullPath);
        } else if (entry.isFile()) {
          const stat = fs.statSync(fullPath);
          if (now - stat.mtimeMs > MAX_AGE_MS) {
            bytesFreed += stat.size;
            fs.unlinkSync(fullPath);
            filesDeleted++;
          }
        }
      } catch {}
    }
  }

  clean(TMP_DIR);

  return NextResponse.json({
    filesDeleted,
    bytesFreed,
    bytesFreedFormatted: `${(bytesFreed / (1024 * 1024)).toFixed(1)} MB`,
  });
}
