import { NextRequest, NextResponse } from "next/server";
import {
  validateEvent,
  WebhookVerificationError,
} from "@polar-sh/sdk/webhooks";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  const secret = process.env.POLAR_WEBHOOK_SECRET;
  if (!secret) {
    console.error("POLAR_WEBHOOK_SECRET not configured");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  const body = await request.text();
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });

  let event;
  try {
    event = validateEvent(body, headers, secret);
  } catch (error) {
    if (error instanceof WebhookVerificationError) {
      console.error("Webhook verification failed:", error.message);
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
    }
    throw error;
  }

  try {
    switch (event.type) {
      case "checkout.updated": {
        if (event.data.status === "succeeded") {
          const userId = (event.data.metadata as Record<string, string>)?.userId;
          const customerId = event.data.customerId;
          if (userId && customerId) {
            await prisma.user.update({
              where: { id: userId },
              data: { polarCustomerId: customerId },
            });
          }
        }
        break;
      }

      case "subscription.created":
      case "subscription.updated":
      case "subscription.active": {
        const customerId = event.data.customerId;
        if (customerId) {
          const user = await prisma.user.findUnique({
            where: { polarCustomerId: customerId },
          });
          if (user) {
            await prisma.user.update({
              where: { id: user.id },
              data: {
                plan: "PRO",
                subscriptionId: event.data.id,
                planExpiresAt: event.data.currentPeriodEnd
                  ? new Date(event.data.currentPeriodEnd)
                  : null,
              },
            });
          }
        }
        break;
      }

      case "subscription.canceled":
      case "subscription.revoked": {
        const customerId = event.data.customerId;
        if (customerId) {
          const user = await prisma.user.findUnique({
            where: { polarCustomerId: customerId },
          });
          if (user) {
            await prisma.user.update({
              where: { id: user.id },
              data: {
                plan: "FREE",
                subscriptionId: null,
                planExpiresAt: null,
              },
            });
          }
        }
        break;
      }
    }
  } catch (error) {
    console.error("Webhook processing error:", error);
    return NextResponse.json(
      { error: "Processing failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}
