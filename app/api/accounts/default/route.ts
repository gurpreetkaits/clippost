import { NextRequest, NextResponse } from "next/server";
import { setDefaultAccount } from "@/lib/accounts";

export async function PUT(request: NextRequest) {
  const { id } = await request.json();

  if (!id) {
    return NextResponse.json({ error: "Missing account id" }, { status: 400 });
  }

  try {
    setDefaultAccount(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to set default" },
      { status: 404 }
    );
  }
}
