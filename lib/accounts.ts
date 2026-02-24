import axios from "axios";
import { prisma } from "@/lib/db";

export interface InstagramAccount {
  id: string;
  username: string;
  name: string;
  profilePictureUrl: string;
  accessToken: string;
  tokenExpiresAt: number;
  facebookPageId: string;
  connectedAt: string;
}

export async function getAllAccounts(userId: string): Promise<InstagramAccount[]> {
  const accounts = await prisma.instagramAccount.findMany({
    where: { userId },
    orderBy: { connectedAt: "desc" },
  });
  return accounts.map(dbToAccount);
}

export async function getAccountById(
  userId: string,
  id: string
): Promise<InstagramAccount | undefined> {
  const account = await prisma.instagramAccount.findFirst({
    where: { userId, id },
  });
  return account ? dbToAccount(account) : undefined;
}

export async function getDefaultAccount(
  userId: string
): Promise<InstagramAccount | undefined> {
  let account = await prisma.instagramAccount.findFirst({
    where: { userId, isDefault: true },
  });
  if (!account) {
    account = await prisma.instagramAccount.findFirst({
      where: { userId },
      orderBy: { connectedAt: "asc" },
    });
  }
  return account ? dbToAccount(account) : undefined;
}

export async function upsertAccount(userId: string, account: InstagramAccount) {
  const count = await prisma.instagramAccount.count({ where: { userId } });
  const isFirst = count === 0;

  await prisma.instagramAccount.upsert({
    where: { id: account.id },
    update: {
      username: account.username,
      name: account.name,
      profilePictureUrl: account.profilePictureUrl,
      accessToken: account.accessToken,
      tokenExpiresAt: new Date(account.tokenExpiresAt),
      facebookPageId: account.facebookPageId,
    },
    create: {
      id: account.id,
      userId,
      username: account.username,
      name: account.name,
      profilePictureUrl: account.profilePictureUrl,
      accessToken: account.accessToken,
      tokenExpiresAt: new Date(account.tokenExpiresAt),
      facebookPageId: account.facebookPageId,
      isDefault: isFirst,
      connectedAt: new Date(account.connectedAt),
    },
  });
}

export async function removeAccount(userId: string, id: string) {
  const account = await prisma.instagramAccount.findFirst({
    where: { userId, id },
  });
  if (!account) return;

  await prisma.instagramAccount.delete({ where: { id } });

  if (account.isDefault) {
    const next = await prisma.instagramAccount.findFirst({
      where: { userId },
      orderBy: { connectedAt: "asc" },
    });
    if (next) {
      await prisma.instagramAccount.update({
        where: { id: next.id },
        data: { isDefault: true },
      });
    }
  }
}

export async function setDefaultAccount(userId: string, id: string) {
  const account = await prisma.instagramAccount.findFirst({
    where: { userId, id },
  });
  if (!account) {
    throw new Error(`Account ${id} not found`);
  }

  await prisma.$transaction([
    prisma.instagramAccount.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    }),
    prisma.instagramAccount.update({
      where: { id },
      data: { isDefault: true },
    }),
  ]);
}

export async function getDefaultAccountId(userId: string): Promise<string | null> {
  const account = await getDefaultAccount(userId);
  return account?.id ?? null;
}

export async function refreshTokenIfNeeded(
  userId: string,
  account: InstagramAccount
): Promise<InstagramAccount> {
  const now = Date.now();
  const expiresAt = account.tokenExpiresAt;

  // Refresh if token expires within 7 days
  if (expiresAt - now > 7 * 24 * 60 * 60 * 1000) {
    return account;
  }

  try {
    const response = await axios.get(
      "https://graph.facebook.com/v21.0/oauth/access_token",
      {
        params: {
          grant_type: "fb_exchange_token",
          client_id: process.env.FACEBOOK_APP_ID,
          client_secret: process.env.FACEBOOK_APP_SECRET,
          fb_exchange_token: account.accessToken,
        },
      }
    );

    const { access_token, expires_in } = response.data;
    account.accessToken = access_token;
    account.tokenExpiresAt = Date.now() + expires_in * 1000;
    await upsertAccount(userId, account);
    return account;
  } catch (error) {
    console.error("Failed to refresh token for account", account.id, error);
    return account;
  }
}

function dbToAccount(db: {
  id: string;
  username: string;
  name: string;
  profilePictureUrl: string;
  accessToken: string;
  tokenExpiresAt: Date;
  facebookPageId: string;
  connectedAt: Date;
}): InstagramAccount {
  return {
    id: db.id,
    username: db.username,
    name: db.name,
    profilePictureUrl: db.profilePictureUrl,
    accessToken: db.accessToken,
    tokenExpiresAt: db.tokenExpiresAt.getTime(),
    facebookPageId: db.facebookPageId,
    connectedAt: db.connectedAt.toISOString(),
  };
}
