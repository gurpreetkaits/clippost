import { NextRequest, NextResponse } from "next/server";
import { requireAuth, authenticateApiKey } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  let userId: string;
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) {
    const apiKeyAuth = await authenticateApiKey(request);
    if (!apiKeyAuth) return authResult;
    userId = apiKeyAuth.userId;
  } else {
    userId = authResult.userId;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      autoPostInstagram: true,
      autoPostYoutube: true,
      useAiCaptions: true,
      defaultLanguage: true,
      defaultFormat: true,
      defaultFrame: true,
      autonomousMode: true,
      defaultMusicVolume: true,
    },
  });

  return NextResponse.json(user || {
    autoPostInstagram: false,
    autoPostYoutube: false,
    useAiCaptions: true,
    defaultLanguage: "en",
    defaultFormat: "original",
    defaultFrame: "cinema",
    autonomousMode: false,
    defaultMusicVolume: 30,
  });
}

export async function PUT(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const body = await request.json();
  const data: Record<string, boolean | string | number> = {};

  if (typeof body.autoPostInstagram === "boolean")
    data.autoPostInstagram = body.autoPostInstagram;
  if (typeof body.autoPostYoutube === "boolean")
    data.autoPostYoutube = body.autoPostYoutube;
  if (typeof body.useAiCaptions === "boolean")
    data.useAiCaptions = body.useAiCaptions;
  if (typeof body.defaultLanguage === "string")
    data.defaultLanguage = body.defaultLanguage;
  if (typeof body.defaultFormat === "string")
    data.defaultFormat = body.defaultFormat;
  if (typeof body.defaultFrame === "string")
    data.defaultFrame = body.defaultFrame;
  if (typeof body.autonomousMode === "boolean")
    data.autonomousMode = body.autonomousMode;
  if (typeof body.defaultMusicVolume === "number")
    data.defaultMusicVolume = body.defaultMusicVolume;

  const updated = await prisma.user.update({
    where: { id: userId },
    data,
    select: {
      autoPostInstagram: true,
      autoPostYoutube: true,
      useAiCaptions: true,
      defaultLanguage: true,
      defaultFormat: true,
      defaultFrame: true,
      autonomousMode: true,
      defaultMusicVolume: true,
    },
  });

  return NextResponse.json(updated);
}
