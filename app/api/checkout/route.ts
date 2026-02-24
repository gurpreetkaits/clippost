import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { polar } from "@/lib/polar";
import { prisma } from "@/lib/db";

export async function POST() {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (user.plan === "PRO") {
    return NextResponse.json({ error: "Already on Pro plan" }, { status: 400 });
  }

  const productId = process.env.POLAR_PRO_PRODUCT_ID;
  if (!productId) {
    return NextResponse.json(
      { error: "Billing not configured" },
      { status: 500 }
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3456";

  const checkout = await polar.checkouts.create({
    products: [productId],
    successUrl: `${appUrl}/settings?upgraded=true`,
    customerEmail: user.email || undefined,
    metadata: { userId: user.id },
  });

  return NextResponse.json({ checkoutUrl: checkout.url });
}
