import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Get a project
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;
  const { id } = await params;

  try {
    const project = await prisma.project.findFirst({
      where: { id, userId },
      include: {
        video: { select: { title: true, duration: true, filename: true, source: true } },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json(project);
  } catch (error) {
    console.error("Get project error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get project" },
      { status: 500 }
    );
  }
}

// Update a project (auto-save)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;
  const { id } = await params;

  try {
    // Verify ownership
    const existing = await prisma.project.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const body = await request.json();
    const updateData: Record<string, unknown> = {};

    if (body.title !== undefined) updateData.title = body.title;
    if (body.segments !== undefined) updateData.segments = JSON.parse(JSON.stringify(body.segments));
    if (body.captionStyle !== undefined) updateData.captionStyle = JSON.parse(JSON.stringify(body.captionStyle));
    if (body.layout !== undefined) updateData.layout = JSON.parse(JSON.stringify(body.layout));
    if (body.textOverlays !== undefined) updateData.textOverlays = JSON.parse(JSON.stringify(body.textOverlays));
    if (body.audioTracks !== undefined) updateData.audioTracks = JSON.parse(JSON.stringify(body.audioTracks));
    if (body.filters !== undefined) updateData.filters = JSON.parse(JSON.stringify(body.filters));
    if (body.status !== undefined) updateData.status = body.status;
    if (body.outputFilename !== undefined) updateData.outputFilename = body.outputFilename;

    const project = await prisma.project.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(project);
  } catch (error) {
    console.error("Update project error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update project" },
      { status: 500 }
    );
  }
}

// Delete a project
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;
  const { id } = await params;

  try {
    const existing = await prisma.project.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    await prisma.project.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete project error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete project" },
      { status: 500 }
    );
  }
}
