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

  // Debug: verify required webhook headers are present
  const hasWebhookHeaders =
    headers["webhook-id"] && headers["webhook-timestamp"] && headers["webhook-signature"];
  if (!hasWebhookHeaders) {
    console.error("Missing standard webhook headers. Got:", Object.keys(headers).filter(k => k.startsWith("webhook")).join(", ") || "none");
    return NextResponse.json({ error: "Missing webhook headers" }, { status: 400 });
  }

  let event;
  try {
    event = validateEvent(body, headers, secret);
  } catch (error) {
    if (error instanceof WebhookVerificationError) {
      console.error("Webhook verification failed:", error.message);
      console.error("webhook-id:", headers["webhook-id"]);
      console.error("webhook-timestamp:", headers["webhook-timestamp"]);
      console.error("Secret starts with:", secret.slice(0, 6) + "...");
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
    }
    throw error;
  }

  try {
    // Resolve user for billing record
    let userId: string | null = null;
    const customerId = (event.data as { customerId?: string }).customerId ?? null;
    const eventMeta = (event.data as { metadata?: Record<string, string> }).metadata;

    if (eventMeta?.userId) {
      userId = eventMeta.userId;
    } else if (customerId) {
      const user = await prisma.user.findUnique({
        where: { polarCustomerId: customerId },
        select: { id: true },
      });
      userId = user?.id ?? null;
    }

    // Record billing event
    const eventData = event.data as Record<string, unknown>;
    await prisma.billingEvent.create({
      data: {
        userId,
        polarCustomerId: customerId,
        eventType: event.type,
        amount: (eventData.amount as number) ?? (eventData.recurringPrice as number) ?? null,
        currency: (eventData.currency as string) ?? null,
        status: (eventData.status as string) ?? null,
        subscriptionId: (eventData.id as string) ?? null,
        productId: (eventData.productId as string) ?? null,
        metadata: JSON.parse(JSON.stringify(eventData)),
      },
    });

    // Process event
    switch (event.type) {
      case "checkout.updated": {
        if (event.data.status === "succeeded") {
          const checkoutUserId = (event.data.metadata as Record<string, string>)?.userId;
          const checkoutCustomerId = event.data.customerId;
          if (checkoutUserId && checkoutCustomerId) {
            await prisma.user.update({
              where: { id: checkoutUserId },
              data: { polarCustomerId: checkoutCustomerId },
            });
          }
        }
        break;
      }

      case "subscription.created":
      case "subscription.updated":
      case "subscription.active": {
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
