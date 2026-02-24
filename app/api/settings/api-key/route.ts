import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { apiKey: true },
  });

  if (!user?.apiKey) {
    return NextResponse.json({ hasKey: false });
  }

  const key = user.apiKey;
  const masked = key.slice(0, 8) + "..." + key.slice(-4);
  return NextResponse.json({ hasKey: true, maskedKey: masked });
}

export async function POST() {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const apiKey = `cpk_${crypto.randomUUID()}`;

  await prisma.user.update({
    where: { id: userId },
    data: { apiKey },
  });

  return NextResponse.json({ apiKey });
}

export async function DELETE() {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  await prisma.user.update({
    where: { id: userId },
    data: { apiKey: null },
  });

  return NextResponse.json({ success: true });
}
