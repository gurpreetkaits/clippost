import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/auth";
import { getDefaultAccount } from "@/lib/accounts";

export async function GET(request: NextRequest) {
  const apiKeyAuth = await authenticateApiKey(request);
  if (!apiKeyAuth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  const { userId } = apiKeyAuth;
  const igAccount = await getDefaultAccount(userId);
  
  return NextResponse.json({
    userId,
    hasInstagram: !!igAccount,
    username: igAccount?.username || null
  });
}
