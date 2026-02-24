import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const channels = await prisma.youTubeChannel.findMany({
    where: { userId },
    select: {
      id: true,
      channelId: true,
      channelTitle: true,
      thumbnailUrl: true,
      isDefault: true,
      tokenExpiresAt: true,
      connectedAt: true,
    },
    orderBy: { connectedAt: "desc" },
  });

  const defaultId = channels.find((c) => c.isDefault)?.id || channels[0]?.id || null;

  return NextResponse.json({
    channels: channels.map((c) => ({
      ...c,
      tokenExpiresAt: c.tokenExpiresAt.getTime(),
      connectedAt: c.connectedAt.toISOString(),
    })),
    defaultChannelId: defaultId,
  });
}

export async function DELETE(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const { id } = await request.json();
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  await prisma.youTubeChannel.deleteMany({
    where: { id, userId },
  });

  return NextResponse.json({ success: true });
}
