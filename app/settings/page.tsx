"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Trash2,
  Star,
  Loader2,
} from "lucide-react";

interface AccountInfo {
  id: string;
  username: string;
  name: string;
  profilePictureUrl: string;
  hasToken: boolean;
  tokenExpiresAt: number;
  connectedAt: string;
}

function SettingsContent() {
  const searchParams = useSearchParams();
  const connectedParam = searchParams.get("connected");
  const errorParam = searchParams.get("error");

  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [defaultAccountId, setDefaultAccountId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchAccounts = async () => {
    try {
      const res = await fetch("/api/accounts");
      const data = await res.json();
      setAccounts(data.accounts || []);
      setDefaultAccountId(data.defaultAccountId);
    } catch (err) {
      console.error("Failed to fetch accounts:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

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

  const getTokenStatus = (expiresAt: number) => {
    const now = Date.now();
    const daysLeft = Math.floor((expiresAt - now) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) return { label: "Expired", variant: "destructive" as const };
    if (daysLeft < 7) return { label: `${daysLeft}d left`, variant: "secondary" as const };
    return { label: "Active", variant: "default" as const };
  };

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <Link href="/">
            <Button
              variant="ghost"
              size="sm"
              className="mb-1 text-muted-foreground"
            >
              <ArrowLeft />
              Back
            </Button>
          </Link>
          <h1 className="text-xl font-semibold text-foreground">Settings</h1>
        </div>

        {connectedParam && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              Successfully connected {connectedParam} Instagram account
              {parseInt(connectedParam) !== 1 ? "s" : ""}.
            </AlertDescription>
          </Alert>
        )}

        {errorParam && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{errorParam}</AlertDescription>
          </Alert>
        )}

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
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : accounts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No Instagram accounts connected. Click &quot;Connect Account&quot; to
                get started.
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
