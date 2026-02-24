-- AlterTable
ALTER TABLE "clips" ADD COLUMN     "youtubeVideoId" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "autoPostInstagram" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "autoPostYoutube" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "useAiCaptions" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "youtube_channels" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "channelTitle" TEXT NOT NULL,
    "thumbnailUrl" TEXT NOT NULL DEFAULT '',
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "youtube_channels_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "youtube_channels_userId_channelId_key" ON "youtube_channels"("userId", "channelId");

-- AddForeignKey
ALTER TABLE "youtube_channels" ADD CONSTRAINT "youtube_channels_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
