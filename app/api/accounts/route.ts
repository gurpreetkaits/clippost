import { NextRequest, NextResponse } from "next/server";
import {
  getAllAccounts,
  getDefaultAccountId,
  removeAccount,
} from "@/lib/accounts";

export async function GET() {
  const accounts = getAllAccounts();
  const defaultAccountId = getDefaultAccountId();

  // Mask tokens in response
  const masked = accounts.map(({ accessToken, ...rest }) => ({
    ...rest,
    hasToken: !!accessToken,
  }));

  return NextResponse.json({ accounts: masked, defaultAccountId });
}

export async function DELETE(request: NextRequest) {
  const { id } = await request.json();

  if (!id) {
    return NextResponse.json({ error: "Missing account id" }, { status: 400 });
  }

  removeAccount(id);
  return NextResponse.json({ success: true });
}
