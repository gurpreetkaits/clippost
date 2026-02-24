import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      autoPostInstagram: true,
      autoPostYoutube: true,
      useAiCaptions: true,
    },
  });

  return NextResponse.json(user || {
    autoPostInstagram: false,
    autoPostYoutube: false,
    useAiCaptions: true,
  });
}

export async function PUT(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const body = await request.json();
  const data: Record<string, boolean> = {};

  if (typeof body.autoPostInstagram === "boolean")
    data.autoPostInstagram = body.autoPostInstagram;
  if (typeof body.autoPostYoutube === "boolean")
    data.autoPostYoutube = body.autoPostYoutube;
  if (typeof body.useAiCaptions === "boolean")
    data.useAiCaptions = body.useAiCaptions;

  const updated = await prisma.user.update({
    where: { id: userId },
    data,
    select: {
      autoPostInstagram: true,
      autoPostYoutube: true,
      useAiCaptions: true,
    },
  });

  return NextResponse.json(updated);
}
