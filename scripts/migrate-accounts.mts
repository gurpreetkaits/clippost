/**
 * Migration script: Reads file-based Instagram accounts from data/users/
 * and inserts them into the PostgreSQL database.
 *
 * Usage: npx tsx scripts/migrate-accounts.mts
 */

import "dotenv/config";
import fs from "fs";
import path from "path";
import { PrismaClient } from "../lib/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

interface FileAccount {
  id: string;
  username: string;
  name: string;
  profilePictureUrl: string;
  accessToken: string;
  tokenExpiresAt: number;
  facebookPageId: string;
  connectedAt: string;
}

interface FileStore {
  accounts: FileAccount[];
  defaultAccountId: string | null;
}

async function main() {
  const dataDir = path.join(process.cwd(), "data", "users");

  if (!fs.existsSync(dataDir)) {
    console.log("No data/users directory found. Nothing to migrate.");
    return;
  }

  const userDirs = fs.readdirSync(dataDir);
  console.log(`Found ${userDirs.length} user directories`);

  for (const userDir of userDirs) {
    const filePath = path.join(dataDir, userDir, "accounts.json");
    if (!fs.existsSync(filePath)) continue;

    const raw = fs.readFileSync(filePath, "utf-8");
    const store: FileStore = JSON.parse(raw);

    if (store.accounts.length === 0) continue;

    // Create or find user (filesystem userId becomes googleId)
    const user = await prisma.user.upsert({
      where: { googleId: userDir },
      update: {},
      create: {
        googleId: userDir,
        email: null,
        name: null,
      },
    });

    console.log(`User ${userDir} -> DB id ${user.id}`);

    for (const account of store.accounts) {
      await prisma.instagramAccount.upsert({
        where: { id: account.id },
        update: {
          username: account.username,
          name: account.name,
          profilePictureUrl: account.profilePictureUrl,
          accessToken: account.accessToken,
          tokenExpiresAt: new Date(account.tokenExpiresAt),
          facebookPageId: account.facebookPageId,
        },
        create: {
          id: account.id,
          userId: user.id,
          username: account.username,
          name: account.name,
          profilePictureUrl: account.profilePictureUrl,
          accessToken: account.accessToken,
          tokenExpiresAt: new Date(account.tokenExpiresAt),
          facebookPageId: account.facebookPageId,
          isDefault: account.id === store.defaultAccountId,
          connectedAt: new Date(account.connectedAt),
        },
      });

      console.log(`  Account @${account.username} (${account.id})`);
    }
  }

  console.log("Migration complete!");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("Migration failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
