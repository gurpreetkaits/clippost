import { NextRequest, NextResponse } from "next/server";
import {
  getAllAccounts,
  getDefaultAccountId,
  removeAccount,
} from "@/lib/accounts";
import { requireAuth } from "@/lib/auth";

export async function GET() {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const accounts = getAllAccounts(userId);
  const defaultAccountId = getDefaultAccountId(userId);

  // Mask tokens in response
  const masked = accounts.map(({ accessToken, ...rest }) => ({
    ...rest,
    hasToken: !!accessToken,
  }));

  return NextResponse.json({ accounts: masked, defaultAccountId });
}

export async function DELETE(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  const { id } = await request.json();

  if (!id) {
    return NextResponse.json({ error: "Missing account id" }, { status: 400 });
  }

  removeAccount(userId, id);
  return NextResponse.json({ success: true });
}
