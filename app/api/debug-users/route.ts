import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const users = await prisma.user.findMany({
    include: { instagramAccounts: true }
  });
  
  const result = users.map(u => ({
    id: u.id,
    email: u.email,
    googleId: u.googleId,
    hasApiKey: !!u.apiKey,
    apiKeyPrefix: u.apiKey?.substring(0, 10),
    instagramAccounts: u.instagramAccounts.map(acc => ({
      username: acc.username,
      isDefault: acc.isDefault
    }))
  }));
  
  return NextResponse.json(result);
}
