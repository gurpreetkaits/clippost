import fs from "fs";
import path from "path";
import axios from "axios";

const DATA_DIR = path.join(process.cwd(), "data");
const ACCOUNTS_FILE = path.join(DATA_DIR, "accounts.json");

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

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readStore(): AccountsStore {
  ensureDataDir();
  if (!fs.existsSync(ACCOUNTS_FILE)) {
    return { accounts: [], defaultAccountId: null };
  }
  const raw = fs.readFileSync(ACCOUNTS_FILE, "utf-8");
  return JSON.parse(raw);
}

function writeStore(store: AccountsStore) {
  ensureDataDir();
  fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(store, null, 2));
}

export function getAllAccounts(): InstagramAccount[] {
  return readStore().accounts;
}

export function getAccountById(id: string): InstagramAccount | undefined {
  const store = readStore();
  return store.accounts.find((a) => a.id === id);
}

export function getDefaultAccount(): InstagramAccount | undefined {
  const store = readStore();
  if (store.defaultAccountId) {
    return store.accounts.find((a) => a.id === store.defaultAccountId);
  }
  return store.accounts[0];
}

export function upsertAccount(account: InstagramAccount) {
  const store = readStore();
  const idx = store.accounts.findIndex((a) => a.id === account.id);
  if (idx >= 0) {
    store.accounts[idx] = account;
  } else {
    store.accounts.push(account);
  }
  if (!store.defaultAccountId && store.accounts.length === 1) {
    store.defaultAccountId = account.id;
  }
  writeStore(store);
}

export function removeAccount(id: string) {
  const store = readStore();
  store.accounts = store.accounts.filter((a) => a.id !== id);
  if (store.defaultAccountId === id) {
    store.defaultAccountId = store.accounts[0]?.id ?? null;
  }
  writeStore(store);
}

export function setDefaultAccount(id: string) {
  const store = readStore();
  const exists = store.accounts.some((a) => a.id === id);
  if (!exists) {
    throw new Error(`Account ${id} not found`);
  }
  store.defaultAccountId = id;
  writeStore(store);
}

export function getDefaultAccountId(): string | null {
  return readStore().defaultAccountId;
}

export async function refreshTokenIfNeeded(
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
    upsertAccount(account);
    return account;
  } catch (error) {
    console.error("Failed to refresh token for account", account.id, error);
    return account;
  }
}
