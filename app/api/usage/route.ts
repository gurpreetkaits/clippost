import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getUsageSummary } from "@/lib/usage";

export async function GET() {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const summary = await getUsageSummary(userId);
  return NextResponse.json(summary);
}
