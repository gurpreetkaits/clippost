"use client";

import { useState, useEffect, Suspense } from "react";
import { useSession, signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import {
  CheckCircle,
  AlertCircle,
  Trash2,
  Star,
  Loader2,
  Crown,
  Youtube,
  Copy,
  Key,
  Bot,
} from "lucide-react";
import { LANGUAGES } from "@/lib/languages";

interface AccountInfo {
  id: string;
  username: string;
  name: string;
  profilePictureUrl: string;
  hasToken: boolean;
  tokenExpiresAt: number;
  connectedAt: string;
}

interface YouTubeChannelInfo {
  id: string;
  channelId: string;
  channelTitle: string;
  thumbnailUrl: string;
  isDefault: boolean;
  tokenExpiresAt: number;
  connectedAt: string;
}

interface UsageSummary {
  plan: "FREE" | "PRO";
  usage: {
    clips: { used: number; limit: number };
    downloads: { used: number; limit: number };
    publishes: { used: number; limit: number };
  };
}

interface Preferences {
  autoPostInstagram: boolean;
  autoPostYoutube: boolean;
  useAiCaptions: boolean;
  defaultLanguage: string;
  defaultFormat: string;
  defaultFrame: string;
  autonomousMode: boolean;
}

function UsageBar({ used, limit }: { used: number; limit: number }) {
  if (limit === null || !isFinite(limit)) {
    return <span className="text-xs text-muted-foreground">Unlimited</span>;
  }
  const percent = Math.min((used / limit) * 100, 100);
  const isNearLimit = percent >= 80;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span>
          {used} / {limit}
        </span>
      </div>
      <div className="w-full bg-muted rounded-full h-1.5">
        <div
          className={`h-full rounded-full transition-all ${
            isNearLimit ? "bg-destructive" : "bg-primary"
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
        checked ? "bg-primary" : "bg-muted"
      } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
          checked ? "translate-x-4.5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function SettingsContent() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const connectedParam = searchParams.get("connected");
  const connectedYoutubeParam = searchParams.get("connected_youtube");
  const errorParam = searchParams.get("error");
  const upgradedParam = searchParams.get("upgraded");

  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [defaultAccountId, setDefaultAccountId] = useState<string | null>(null);
  const [ytChannels, setYtChannels] = useState<YouTubeChannelInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [prefs, setPrefs] = useState<Preferences>({
    autoPostInstagram: false,
    autoPostYoutube: false,
    useAiCaptions: true,
    defaultLanguage: "en",
    defaultFormat: "original",
    defaultFrame: "cinema",
    autonomousMode: false,
  });
  const [apiKeyInfo, setApiKeyInfo] = useState<{
    hasKey: boolean;
    maskedKey?: string;
    fullKey?: string;
  }>({ hasKey: false });
  const [apiKeyLoading, setApiKeyLoading] = useState(false);

  const fetchAccounts = async () => {
    try {
      const res = await fetch("/api/accounts");
      const data = await res.json();
      setAccounts(data.accounts || []);
      setDefaultAccountId(data.defaultAccountId);
    } catch (err) {
      console.error("Failed to fetch accounts:", err);
    }
  };

  const fetchYtChannels = async () => {
    try {
      const res = await fetch("/api/youtube-channels");
      const data = await res.json();
      setYtChannels(data.channels || []);
    } catch (err) {
      console.error("Failed to fetch YouTube channels:", err);
    }
  };

  const fetchUsage = async () => {
    try {
      const res = await fetch("/api/usage");
      const data = await res.json();
      setUsage(data);
    } catch (err) {
      console.error("Failed to fetch usage:", err);
    }
  };

  const fetchPrefs = async () => {
    try {
      const res = await fetch("/api/settings/preferences");
      const data = await res.json();
      setPrefs(data);
    } catch (err) {
      console.error("Failed to fetch preferences:", err);
    }
  };

  const fetchApiKey = async () => {
    try {
      const res = await fetch("/api/settings/api-key");
      const data = await res.json();
      setApiKeyInfo(data);
    } catch (err) {
      console.error("Failed to fetch API key:", err);
    }
  };

  useEffect(() => {
    if (status !== "authenticated") {
      setLoading(false);
      return;
    }
    Promise.all([fetchAccounts(), fetchYtChannels(), fetchUsage(), fetchPrefs(), fetchApiKey()]).finally(
      () => setLoading(false)
    );
  }, [status]);

  const handleSetDefault = async (id: string) => {
    setActionLoading(id);
    try {
      await fetch("/api/accounts/default", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setDefaultAccountId(id);
    } catch (err) {
      console.error("Failed to set default:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemove = async (id: string) => {
    setActionLoading(id);
    try {
      await fetch("/api/accounts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      await fetchAccounts();
    } catch (err) {
      console.error("Failed to remove account:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemoveYt = async (id: string) => {
    setActionLoading(`yt-${id}`);
    try {
      await fetch("/api/youtube-channels", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      await fetchYtChannels();
    } catch (err) {
      console.error("Failed to remove YouTube channel:", err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpgrade = async () => {
    setUpgradeLoading(true);
    try {
      const res = await fetch("/api/checkout", { method: "POST" });
      const data = await res.json();
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    } catch (err) {
      console.error("Upgrade failed:", err);
    } finally {
      setUpgradeLoading(false);
    }
  };

  const updatePref = async (key: keyof Preferences, value: boolean | string) => {
    const prev = prefs[key];
    setPrefs((p) => ({ ...p, [key]: value }));
    try {
      await fetch("/api/settings/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
    } catch (err) {
      console.error("Failed to update preference:", err);
      setPrefs((p) => ({ ...p, [key]: prev }));
    }
  };

  const generateApiKey = async () => {
    setApiKeyLoading(true);
    try {
      const res = await fetch("/api/settings/api-key", { method: "POST" });
      const data = await res.json();
      setApiKeyInfo({ hasKey: true, maskedKey: undefined, fullKey: data.apiKey });
    } catch (err) {
      console.error("Failed to generate API key:", err);
    } finally {
      setApiKeyLoading(false);
    }
  };

  const revokeApiKey = async () => {
    setApiKeyLoading(true);
    try {
      await fetch("/api/settings/api-key", { method: "DELETE" });
      setApiKeyInfo({ hasKey: false });
    } catch (err) {
      console.error("Failed to revoke API key:", err);
    } finally {
      setApiKeyLoading(false);
    }
  };

  const getTokenStatus = (expiresAt: number) => {
    const now = Date.now();
    const daysLeft = Math.floor((expiresAt - now) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) return { label: "Expired", variant: "destructive" as const };
    if (daysLeft < 7) return { label: `${daysLeft}d left`, variant: "secondary" as const };
    return { label: "Active", variant: "default" as const };
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (status !== "authenticated") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <h1 className="text-xl font-semibold">Sign in to access Settings</h1>
          <p className="text-sm text-muted-foreground">
            You need to be logged in to manage your accounts and preferences.
          </p>
          <Button onClick={() => signIn("google", { callbackUrl: "/settings" })}>
            Sign in with Google
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-xl font-semibold text-foreground">Settings</h1>

        {connectedParam && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              Successfully connected {connectedParam} Instagram account
              {parseInt(connectedParam) !== 1 ? "s" : ""}.
            </AlertDescription>
          </Alert>
        )}

        {connectedYoutubeParam && (
          <Alert>
            <Youtube className="h-4 w-4" />
            <AlertDescription>
              YouTube channel connected successfully.
            </AlertDescription>
          </Alert>
        )}

        {upgradedParam && (
          <Alert>
            <Crown className="h-4 w-4" />
            <AlertDescription>
              Welcome to Pro! Your account has been upgraded.
            </AlertDescription>
          </Alert>
        )}

        {errorParam && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{errorParam}</AlertDescription>
          </Alert>
        )}

        {/* Subscription Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Subscription</CardTitle>
              <Badge variant={usage?.plan === "PRO" ? "default" : "secondary"}>
                {usage?.plan === "PRO" ? "Pro" : "Free"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {usage ? (
              <>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Clips</p>
                    <UsageBar
                      used={usage.usage.clips.used}
                      limit={usage.usage.clips.limit}
                    />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Downloads</p>
                    <UsageBar
                      used={usage.usage.downloads.used}
                      limit={usage.usage.downloads.limit}
                    />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Publishes</p>
                    <UsageBar
                      used={usage.usage.publishes.used}
                      limit={usage.usage.publishes.limit}
                    />
                  </div>
                </div>
                {usage.plan === "FREE" && (
                  <Button
                    onClick={handleUpgrade}
                    disabled={upgradeLoading}
                    className="w-full"
                  >
                    {upgradeLoading ? (
                      <>
                        <Loader2 className="animate-spin" />
                        Redirecting...
                      </>
                    ) : (
                      <>
                        <Crown className="h-4 w-4 mr-2" />
                        Upgrade to Pro — $9/mo
                      </>
                    )}
                  </Button>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Clip Defaults Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Clip Defaults</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm">Default Language</Label>
              <select
                value={prefs.defaultLanguage}
                onChange={(e) => updatePref("defaultLanguage", e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label className="text-sm">Default Format</Label>
              <div className="flex gap-2">
                {(["original", "9:16"] as const).map((fmt) => (
                  <button
                    key={fmt}
                    onClick={() => updatePref("defaultFormat", fmt)}
                    className={`flex-1 rounded-md border px-3 py-1.5 text-sm transition-colors ${
                      prefs.defaultFormat === fmt
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input hover:bg-muted"
                    }`}
                  >
                    {fmt === "original" ? "Original" : "9:16 Reel"}
                  </button>
                ))}
              </div>
            </div>
            {prefs.defaultFormat === "9:16" && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label className="text-sm">Default Frame</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {(["fill", "cinema", "compact", "floating"] as const).map((frame) => (
                      <button
                        key={frame}
                        onClick={() => updatePref("defaultFrame", frame)}
                        className={`rounded-md border px-2 py-1.5 text-xs capitalize transition-colors ${
                          prefs.defaultFrame === frame
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-input hover:bg-muted"
                        }`}
                      >
                        {frame}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Publishing Preferences Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Publishing Preferences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Auto-post to Instagram</Label>
              <Toggle
                checked={prefs.autoPostInstagram}
                onChange={(v) => updatePref("autoPostInstagram", v)}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <Label className="text-sm">Auto-post to YouTube Shorts</Label>
              <Toggle
                checked={prefs.autoPostYoutube}
                onChange={(v) => updatePref("autoPostYoutube", v)}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">AI-generated captions</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Auto-generate descriptions and hashtags when publishing
                </p>
              </div>
              <Toggle
                checked={prefs.useAiCaptions}
                onChange={(v) => updatePref("useAiCaptions", v)}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm flex items-center gap-1.5">
                  <Bot className="h-4 w-4" />
                  Autonomous Mode
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  AI handles everything: download, transcribe, pick segment, generate clip, and auto-publish
                </p>
              </div>
              <Toggle
                checked={prefs.autonomousMode}
                onChange={(v) => updatePref("autonomousMode", v)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Instagram Accounts Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Instagram Accounts</CardTitle>
              <a href="/api/auth/instagram">
                <Button size="sm">Connect Account</Button>
              </a>
            </div>
          </CardHeader>
          <CardContent>
            {accounts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No Instagram accounts connected.
              </p>
            ) : (
              <div className="space-y-3">
                {accounts.map((account, i) => {
                  const tokenStatus = getTokenStatus(account.tokenExpiresAt);
                  const isDefault = account.id === defaultAccountId;
                  const isLoading = actionLoading === account.id;

                  return (
                    <div key={account.id}>
                      {i > 0 && <Separator className="mb-3" />}
                      <div className="flex items-center gap-3">
                        <Avatar>
                          {account.profilePictureUrl ? (
                            <AvatarImage
                              src={account.profilePictureUrl}
                              alt={account.username}
                            />
                          ) : null}
                          <AvatarFallback>
                            {account.username.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">
                              @{account.username}
                            </span>
                            {isDefault && (
                              <Badge variant="secondary" className="text-xs">
                                Default
                              </Badge>
                            )}
                            <Badge variant={tokenStatus.variant} className="text-xs">
                              {tokenStatus.label}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Connected{" "}
                            {new Date(account.connectedAt).toLocaleDateString()}
                          </p>
                        </div>

                        <div className="flex gap-1">
                          {!isDefault && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSetDefault(account.id)}
                              disabled={isLoading}
                              title="Set as default"
                            >
                              <Star className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemove(account.id)}
                            disabled={isLoading}
                            className="text-destructive hover:text-destructive"
                            title="Remove account"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* YouTube Channels Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">YouTube Channels</CardTitle>
              <a href="/api/auth/youtube">
                <Button size="sm">
                  <Youtube className="h-4 w-4 mr-1.5" />
                  Connect Channel
                </Button>
              </a>
            </div>
          </CardHeader>
          <CardContent>
            {ytChannels.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No YouTube channels connected.
              </p>
            ) : (
              <div className="space-y-3">
                {ytChannels.map((ch, i) => {
                  const tokenStatus = getTokenStatus(ch.tokenExpiresAt);
                  const isLoading = actionLoading === `yt-${ch.id}`;

                  return (
                    <div key={ch.id}>
                      {i > 0 && <Separator className="mb-3" />}
                      <div className="flex items-center gap-3">
                        <Avatar>
                          {ch.thumbnailUrl ? (
                            <AvatarImage
                              src={ch.thumbnailUrl}
                              alt={ch.channelTitle}
                            />
                          ) : null}
                          <AvatarFallback>
                            <Youtube className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">
                              {ch.channelTitle}
                            </span>
                            <Badge variant={tokenStatus.variant} className="text-xs">
                              {tokenStatus.label}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Connected{" "}
                            {new Date(ch.connectedAt).toLocaleDateString()}
                          </p>
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveYt(ch.id)}
                          disabled={isLoading}
                          className="text-destructive hover:text-destructive"
                          title="Remove channel"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* API Key Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-1.5">
                <Key className="h-4 w-4" />
                API Key
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Use this key with the MCP server or chatbot integration.
            </p>
            {apiKeyInfo.fullKey ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded-md bg-muted px-3 py-2 text-xs font-mono break-all">
                    {apiKeyInfo.fullKey}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(apiKeyInfo.fullKey!);
                    }}
                    title="Copy to clipboard"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Copy this key now — it won&apos;t be shown again.
                </p>
              </div>
            ) : apiKeyInfo.hasKey ? (
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-md bg-muted px-3 py-2 text-xs font-mono">
                  {apiKeyInfo.maskedKey}
                </code>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={revokeApiKey}
                  disabled={apiKeyLoading}
                >
                  Revoke
                </Button>
              </div>
            ) : (
              <Button
                onClick={generateApiKey}
                disabled={apiKeyLoading}
                variant="outline"
                className="w-full"
              >
                {apiKeyLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Generate API Key"
                )}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <SettingsContent />
    </Suspense>
  );
}
