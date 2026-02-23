import { auth } from "@/auth";
import { NextResponse } from "next/server";

export async function requireAuth(): Promise<
  { userId: string } | NextResponse
> {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return { userId: session.user.id };
}
