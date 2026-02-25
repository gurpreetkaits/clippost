import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { templateToConfig } from "@/lib/caption-template";
import type { ReelTemplate } from "@/lib/caption-template";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;
  const { id } = await params;

  const template = await prisma.captionTemplate.findFirst({
    where: { id, userId },
  });

  if (!template) {
    return NextResponse.json(
      { error: "Template not found" },
      { status: 404 }
    );
  }

  return NextResponse.json(template);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;
  const { id } = await params;

  const existing = await prisma.captionTemplate.findFirst({
    where: { id, userId },
  });

  if (!existing) {
    return NextResponse.json(
      { error: "Template not found" },
      { status: 404 }
    );
  }

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
      where: { userId, isDefault: true, id: { not: id } },
      data: { isDefault: false },
    });
  }

  const template = await prisma.captionTemplate.update({
    where: { id },
    data: {
      name: body.name.trim(),
      config: JSON.parse(JSON.stringify(config)),
      isDefault: body.isDefault ?? existing.isDefault,
    },
  });

  return NextResponse.json(template);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;
  const { id } = await params;

  const existing = await prisma.captionTemplate.findFirst({
    where: { id, userId },
  });

  if (!existing) {
    return NextResponse.json(
      { error: "Template not found" },
      { status: 404 }
    );
  }

  await prisma.captionTemplate.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
