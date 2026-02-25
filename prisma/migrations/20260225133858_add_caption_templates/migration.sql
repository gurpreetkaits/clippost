-- CreateTable
CREATE TABLE "caption_templates" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "caption_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "caption_templates_userId_idx" ON "caption_templates"("userId");

-- AddForeignKey
ALTER TABLE "caption_templates" ADD CONSTRAINT "caption_templates_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
