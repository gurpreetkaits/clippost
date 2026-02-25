import { prisma } from "@/lib/db";
import { Plan, UsageAction } from "@/lib/generated/prisma/client";

const LIMITS: Record<Plan, Record<UsageAction, number>> = {
  FREE: {
    CLIP_CREATED: 1,
    VIDEO_DOWNLOADED: 5,
    PUBLISH: 1,
  },
  PRO: {
    CLIP_CREATED: Infinity,
    VIDEO_DOWNLOADED: Infinity,
    PUBLISH: Infinity,
  },
};

function getMonthStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function getEffectivePlan(user: { plan: string; trialEndsAt?: Date | null; planExpiresAt?: Date | null } | null): Plan {
  if (!user) return "FREE";
  const plan = user.plan as Plan;
  // If user is on PRO via trial, check if trial has expired
  if (plan === "PRO" && user.trialEndsAt && !user.planExpiresAt) {
    // Trial-only user (no paid subscription)
    if (new Date() > new Date(user.trialEndsAt)) return "FREE";
  }
  if (plan === "PRO" && user.planExpiresAt) {
    if (new Date() > new Date(user.planExpiresAt)) return "FREE";
  }
  return plan;
}

export async function checkUsageLimit(
  userId: string,
  action: UsageAction
): Promise<{ allowed: boolean; used: number; limit: number }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const plan = getEffectivePlan(user);
  const limit = LIMITS[plan][action];

  if (limit === Infinity) {
    return { allowed: true, used: 0, limit };
  }

  const used = await prisma.usageRecord.count({
    where: {
      userId,
      action,
      createdAt: { gte: getMonthStart() },
    },
  });

  return { allowed: used < limit, used, limit };
}

export async function getUsageSummary(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const plan = getEffectivePlan(user);
  const monthStart = getMonthStart();

  const [clips, downloads, publishes] = await Promise.all([
    prisma.usageRecord.count({
      where: { userId, action: "CLIP_CREATED", createdAt: { gte: monthStart } },
    }),
    prisma.usageRecord.count({
      where: { userId, action: "VIDEO_DOWNLOADED", createdAt: { gte: monthStart } },
    }),
    prisma.usageRecord.count({
      where: { userId, action: "PUBLISH", createdAt: { gte: monthStart } },
    }),
  ]);

  const limits = LIMITS[plan];

  const isTrial = !!(user?.trialEndsAt && !user?.subscriptionId);
  const trialEndsAt = user?.trialEndsAt ? new Date(user.trialEndsAt).toISOString() : null;

  return {
    plan,
    isTrial,
    trialEndsAt,
    usage: {
      clips: { used: clips, limit: limits.CLIP_CREATED },
      downloads: { used: downloads, limit: limits.VIDEO_DOWNLOADED },
      publishes: { used: publishes, limit: limits.PUBLISH },
    },
  };
}
