-- CreateEnum
CREATE TYPE "VideoSource" AS ENUM ('YOUTUBE', 'UPLOAD');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'RENDERING', 'COMPLETE');

-- AlterTable
ALTER TABLE "videos" ADD COLUMN     "source" "VideoSource" NOT NULL DEFAULT 'YOUTUBE',
ALTER COLUMN "youtubeId" DROP NOT NULL,
ALTER COLUMN "sourceUrl" DROP NOT NULL;

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "videoId" TEXT,
    "title" TEXT NOT NULL DEFAULT 'Untitled Project',
    "segments" JSONB,
    "captionStyle" JSONB,
    "layout" JSONB,
    "textOverlays" JSONB,
    "audioTracks" JSONB,
    "filters" JSONB,
    "status" "ProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "outputFilename" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "projects_userId_updatedAt_idx" ON "projects"("userId", "updatedAt");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "videos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
