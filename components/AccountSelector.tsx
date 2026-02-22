"use client";

import { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";

interface AccountInfo {
  id: string;
  username: string;
  name: string;
  profilePictureUrl: string;
  hasToken: boolean;
}

interface AccountSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
}

export default function AccountSelector({
  value,
  onValueChange,
}: AccountSelectorProps) {
  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/accounts")
      .then((res) => res.json())
      .then((data) => {
        setAccounts(data.accounts || []);
        if (data.defaultAccountId && !value) {
          onValueChange(data.defaultAccountId);
        } else if (data.accounts?.length === 1 && !value) {
          onValueChange(data.accounts[0].id);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="text-sm text-muted-foreground">Loading accounts...</div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        No accounts connected.{" "}
        <Link href="/settings" className="text-blue-400 hover:text-blue-300">
          Connect an Instagram account
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">Account</label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select an account" />
        </SelectTrigger>
        <SelectContent>
          {accounts.map((account) => (
            <SelectItem key={account.id} value={account.id}>
              @{account.username}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
