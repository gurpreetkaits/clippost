/**
 * Migration script to update language codes from old format to new format
 * Run with: npx tsx scripts/migrate-language-codes.ts
 */

import { prisma } from "../lib/db";

async function main() {
  console.log("Starting language code migration...");

  // Update users with 'en' to 'en-IN'
  const usersUpdated = await prisma.user.updateMany({
    where: { defaultLanguage: "en" },
    data: { defaultLanguage: "en-IN" },
  });

  console.log(`Updated ${usersUpdated.count} users from 'en' to 'en-IN'`);

  // Update videos with 'en' language to 'en-IN'
  const videosUpdated = await prisma.video.updateMany({
    where: { language: "en" },
    data: { language: "en-IN" },
  });

  console.log(`Updated ${videosUpdated.count} videos from 'en' to 'en-IN'`);

  // Map other simple codes to Sarvam format
  const languageMappings = [
    { from: "hi", to: "hi-IN" },
    { from: "bn", to: "bn-IN" },
    { from: "kn", to: "kn-IN" },
    { from: "ml", to: "ml-IN" },
    { from: "mr", to: "mr-IN" },
    { from: "od", to: "od-IN" },
    { from: "or", to: "od-IN" },
    { from: "pa", to: "pa-IN" },
    { from: "ta", to: "ta-IN" },
    { from: "te", to: "te-IN" },
    { from: "gu", to: "gu-IN" },
  ];

  for (const mapping of languageMappings) {
    const updated = await prisma.video.updateMany({
      where: { language: mapping.from },
      data: { language: mapping.to },
    });

    if (updated.count > 0) {
      console.log(`Updated ${updated.count} videos from '${mapping.from}' to '${mapping.to}'`);
    }
  }

  console.log("Migration completed!");
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
