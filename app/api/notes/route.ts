import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const VALID_TAGS = ["youtube", "insta", "auto", "manual", "published"];

export async function GET() {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const notes = await prisma.note.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(notes);
}

export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const body = await request.json();
  const url = body.url?.trim();

  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  const tags = Array.isArray(body.tags)
    ? body.tags.filter((t: string) => VALID_TAGS.includes(t))
    : [];

  const note = await prisma.note.create({
    data: { userId, url, tags },
  });

  return NextResponse.json(note, { status: 201 });
}
