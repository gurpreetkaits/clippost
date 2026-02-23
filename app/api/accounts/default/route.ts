import { NextRequest, NextResponse } from "next/server";
import { setDefaultAccount } from "@/lib/accounts";
import { requireAuth } from "@/lib/auth";

export async function PUT(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const { id } = await request.json();

  if (!id) {
    return NextResponse.json({ error: "Missing account id" }, { status: 400 });
  }

  try {
    setDefaultAccount(userId, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to set default" },
      { status: 404 }
    );
  }
}
