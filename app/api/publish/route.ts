import { NextRequest, NextResponse } from "next/server";
import {
  createReelContainer,
  waitForContainerReady,
  publishReel,
} from "@/lib/instagram";
import { getAccountById, refreshTokenIfNeeded } from "@/lib/accounts";

export async function POST(request: NextRequest) {
  try {
    const { videoUrl, caption, accountId } = await request.json();

    if (!videoUrl) {
      return NextResponse.json(
        { error: "Missing videoUrl" },
        { status: 400 }
      );
    }

    if (!accountId) {
      return NextResponse.json(
        { error: "Missing accountId" },
        { status: 400 }
      );
    }

    const account = getAccountById(accountId);
    if (!account) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    const refreshedAccount = await refreshTokenIfNeeded(account);
    const credentials = {
      accessToken: refreshedAccount.accessToken,
      accountId: refreshedAccount.id,
    };

    // Step 1: Create media container
    const containerId = await createReelContainer(credentials, videoUrl, caption);

    // Step 2: Wait for processing
    await waitForContainerReady(credentials, containerId);

    // Step 3: Publish
    const mediaId = await publishReel(credentials, containerId);

    return NextResponse.json({
      success: true,
      mediaId,
      message: "Reel published successfully!",
    });
  } catch (error) {
    console.error("Publish error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to publish to Instagram",
      },
      { status: 500 }
    );
  }
}
