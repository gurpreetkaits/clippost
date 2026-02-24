import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

const isLocalhost = process.env.NODE_ENV === "development";

export async function requireAuth(): Promise<
  { userId: string } | NextResponse
> {
  const session = await auth();

  if (session?.user?.id) {
    return { userId: session.user.id };
  }

  // In dev, fall back to local-dev user when no session
  if (isLocalhost) {
    const user = await prisma.user.upsert({
      where: { googleId: "local-dev" },
      update: {},
      create: {
        googleId: "local-dev",
        email: "dev@localhost",
        name: "Local Dev",
      },
    });
    return { userId: user.id };
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function optionalAuth(): Promise<{
  userId: string;
  authenticated: boolean;
  anonId?: string;
}> {
  const session = await auth();

  if (session?.user?.id) {
    return { userId: session.user.id, authenticated: true };
  }

  // In dev, fall back to local-dev user when no session
  if (isLocalhost) {
    const user = await prisma.user.upsert({
      where: { googleId: "local-dev" },
      update: {},
      create: {
        googleId: "local-dev",
        email: "dev@localhost",
        name: "Local Dev",
      },
    });
    return { userId: user.id, authenticated: true };
  }

  const cookieStore = await cookies();
  const anonCookie = cookieStore.get("clippost-anon")?.value;
  const anonId = anonCookie || crypto.randomUUID();

  return { userId: `anon_${anonId}`, authenticated: false, anonId };
}
