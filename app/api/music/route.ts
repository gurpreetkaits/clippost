import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const search = request.nextUrl.searchParams.get("search") || "";
  const favoriteOnly = request.nextUrl.searchParams.get("favorite") === "true";
  const defaultOnly = request.nextUrl.searchParams.get("default") === "true";

  const where: Record<string, unknown> = { userId };
  if (search) {
    where.originalName = { contains: search, mode: "insensitive" };
  }
  if (favoriteOnly) {
    where.isFavorite = true;
  }
  if (defaultOnly) {
    where.isDefault = true;
  }

  const tracks = await prisma.musicTrack.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(tracks);
}
