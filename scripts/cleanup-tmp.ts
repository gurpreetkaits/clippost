/**
 * Cleanup script for tmp directory.
 * Deletes files older than MAX_AGE_DAYS.
 *
 * Run manually: npx tsx scripts/cleanup-tmp.ts
 * Or schedule via cron/PM2: pm2 start scripts/cleanup-tmp.ts --cron "0 3 * * *"
 */

import fs from "fs";
import path from "path";

const TMP_DIR = path.join(process.cwd(), "tmp");
const MAX_AGE_DAYS = 7;
const MAX_AGE_MS = MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

interface CleanupStats {
  filesDeleted: number;
  bytesFreed: number;
  dirsDeleted: number;
  errors: number;
}

function cleanDirectory(dirPath: string, stats: CleanupStats): void {
  if (!fs.existsSync(dirPath)) return;

  const now = Date.now();
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    try {
      if (entry.isDirectory()) {
        // Recurse into user directories
        cleanDirectory(fullPath, stats);

        // Remove empty directories
        const remaining = fs.readdirSync(fullPath);
        if (remaining.length === 0) {
          fs.rmdirSync(fullPath);
          stats.dirsDeleted++;
        }
      } else if (entry.isFile()) {
        const stat = fs.statSync(fullPath);
        const age = now - stat.mtimeMs;

        if (age > MAX_AGE_MS) {
          stats.bytesFreed += stat.size;
          fs.unlinkSync(fullPath);
          stats.filesDeleted++;
        }
      }
    } catch (err) {
      console.error(`Error processing ${fullPath}:`, err);
      stats.errors++;
    }
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function main() {
  console.log(`Cleaning tmp directory: ${TMP_DIR}`);
  console.log(`Removing files older than ${MAX_AGE_DAYS} days`);
  console.log("---");

  const stats: CleanupStats = {
    filesDeleted: 0,
    bytesFreed: 0,
    dirsDeleted: 0,
    errors: 0,
  };

  cleanDirectory(TMP_DIR, stats);

  console.log(`Files deleted: ${stats.filesDeleted}`);
  console.log(`Space freed: ${formatBytes(stats.bytesFreed)}`);
  console.log(`Empty dirs removed: ${stats.dirsDeleted}`);
  if (stats.errors > 0) {
    console.log(`Errors: ${stats.errors}`);
  }
  console.log("Done.");
}

main();
