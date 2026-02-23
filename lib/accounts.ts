import fs from "fs";
import path from "path";
import axios from "axios";

const DATA_DIR = path.join(process.cwd(), "data");

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

export interface AccountsStore {
  accounts: InstagramAccount[];
  defaultAccountId: string | null;
}

function getUserFile(userId: string): string {
  // Sanitize userId to prevent path traversal
  const safeId = userId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const userDir = path.join(DATA_DIR, "users", safeId);
  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true });
  }
  return path.join(userDir, "accounts.json");
}

function readStore(userId: string): AccountsStore {
  const file = getUserFile(userId);
  if (!fs.existsSync(file)) {
    return { accounts: [], defaultAccountId: null };
  }
  const raw = fs.readFileSync(file, "utf-8");
  return JSON.parse(raw);
}

function writeStore(userId: string, store: AccountsStore) {
  const file = getUserFile(userId);
  fs.writeFileSync(file, JSON.stringify(store, null, 2));
}

export function getAllAccounts(userId: string): InstagramAccount[] {
  return readStore(userId).accounts;
}

export function getAccountById(
  userId: string,
  id: string
): InstagramAccount | undefined {
  const store = readStore(userId);
  return store.accounts.find((a) => a.id === id);
}

export function getDefaultAccount(
  userId: string
): InstagramAccount | undefined {
  const store = readStore(userId);
  if (store.defaultAccountId) {
    return store.accounts.find((a) => a.id === store.defaultAccountId);
  }
  return store.accounts[0];
}

export function upsertAccount(userId: string, account: InstagramAccount) {
  const store = readStore(userId);
  const idx = store.accounts.findIndex((a) => a.id === account.id);
  if (idx >= 0) {
    store.accounts[idx] = account;
  } else {
    store.accounts.push(account);
  }
  if (!store.defaultAccountId && store.accounts.length === 1) {
    store.defaultAccountId = account.id;
  }
  writeStore(userId, store);
}

export function removeAccount(userId: string, id: string) {
  const store = readStore(userId);
  store.accounts = store.accounts.filter((a) => a.id !== id);
  if (store.defaultAccountId === id) {
    store.defaultAccountId = store.accounts[0]?.id ?? null;
  }
  writeStore(userId, store);
}

export function setDefaultAccount(userId: string, id: string) {
  const store = readStore(userId);
  const exists = store.accounts.some((a) => a.id === id);
  if (!exists) {
    throw new Error(`Account ${id} not found`);
  }
  store.defaultAccountId = id;
  writeStore(userId, store);
}

export function getDefaultAccountId(userId: string): string | null {
  return readStore(userId).defaultAccountId;
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
    upsertAccount(userId, account);
    return account;
  } catch (error) {
    console.error("Failed to refresh token for account", account.id, error);
    return account;
  }
}
