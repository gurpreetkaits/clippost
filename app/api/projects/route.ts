import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Create a new project
export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  try {
    const { videoId, title, segments, captionStyle, layout } = await request.json();

    const project = await prisma.project.create({
      data: {
        userId,
        videoId: videoId || undefined,
        title: title || "Untitled Project",
        segments: segments ? JSON.parse(JSON.stringify(segments)) : undefined,
        captionStyle: captionStyle ? JSON.parse(JSON.stringify(captionStyle)) : undefined,
        layout: layout ? JSON.parse(JSON.stringify(layout)) : undefined,
      },
    });

    return NextResponse.json(project);
  } catch (error) {
    console.error("Create project error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create project" },
      { status: 500 }
    );
  }
}

// List user's projects
export async function GET() {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  try {
    const projects = await prisma.project.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: 20,
      include: {
        video: { select: { title: true, duration: true, filename: true, source: true } },
      },
    });

    return NextResponse.json({ projects });
  } catch (error) {
    console.error("List projects error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list projects" },
      { status: 500 }
    );
  }
}
