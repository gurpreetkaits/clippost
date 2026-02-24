-- AlterTable
ALTER TABLE "users" ADD COLUMN     "apiKey" TEXT,
ADD COLUMN     "autonomousMode" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "defaultFormat" TEXT NOT NULL DEFAULT 'original',
ADD COLUMN     "defaultFrame" TEXT NOT NULL DEFAULT 'cinema',
ADD COLUMN     "defaultLanguage" TEXT NOT NULL DEFAULT 'en';

-- CreateIndex
CREATE UNIQUE INDEX "users_apiKey_key" ON "users"("apiKey");
