import { auth } from "@/auth";
import { NextResponse } from "next/server";

const LOCAL_USER_ID = "local-dev";
const isLocalhost = process.env.NODE_ENV === "development";

export async function requireAuth(): Promise<
  { userId: string } | NextResponse
> {
  // Skip auth on localhost — use a fixed local user
  if (isLocalhost) {
    return { userId: LOCAL_USER_ID };
  }

  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return { userId: session.user.id };
}
