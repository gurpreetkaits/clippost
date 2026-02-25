import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { templateToConfig } from "@/lib/caption-template";
import type { ReelTemplate } from "@/lib/caption-template";

export async function GET() {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const templates = await prisma.captionTemplate.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(templates);
}

export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const body: ReelTemplate & { isDefault?: boolean } = await request.json();

  if (!body.name?.trim()) {
    return NextResponse.json(
      { error: "Template name is required" },
      { status: 400 }
    );
  }

  const config = templateToConfig(body);

  // If setting as default, unset any existing default
  if (body.isDefault) {
    await prisma.captionTemplate.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    });
  }

  const template = await prisma.captionTemplate.create({
    data: {
      userId,
      name: body.name.trim(),
      config: JSON.parse(JSON.stringify(config)),
      isDefault: body.isDefault || false,
    },
  });

  return NextResponse.json(template, { status: 201 });
}
