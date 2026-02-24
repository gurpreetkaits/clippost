import "dotenv/config";
import { PrismaClient } from "../lib/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.user.upsert({
    where: { googleId: "local-dev" },
    update: {},
    create: {
      googleId: "local-dev",
      email: "dev@localhost",
      name: "Local Dev",
    },
  });
  console.log("Seeded local-dev user");

  // Grant permanent Pro plan to gurpreetkait
  const updated = await prisma.user.updateMany({
    where: { email: "gurpreetkait.codes@gmail.com" },
    data: {
      plan: "PRO",
      planExpiresAt: new Date("2099-12-31T23:59:59Z"),
    },
  });
  if (updated.count > 0) {
    console.log("Granted permanent Pro plan to gurpreetkait.codes@gmail.com");
  } else {
    console.log("User gurpreetkait.codes@gmail.com not found yet — will be upgraded on next seed run after sign-in");
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
