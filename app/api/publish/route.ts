import { NextRequest, NextResponse } from "next/server";
import {
  createReelContainer,
  waitForContainerReady,
  publishReel,
} from "@/lib/instagram";
import { getAccountById, refreshTokenIfNeeded } from "@/lib/accounts";
import { getVideoPath } from "@/lib/youtube";
import fs from "fs";
import path from "path";
import axios from "axios";
import FormData from "form-data";

async function uploadToTmpFiles(filePath: string): Promise<string> {
  const form = new FormData();
  form.append("file", fs.createReadStream(filePath));

  const response = await axios.post("https://tmpfiles.org/api/v1/upload", form, {
    headers: form.getHeaders(),
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  });

  // tmpfiles.org returns a URL like https://tmpfiles.org/12345/file.mp4
  // We need the direct download URL: https://tmpfiles.org/dl/12345/file.mp4
  const url = response.data.data.url as string;
  return url.replace("tmpfiles.org/", "tmpfiles.org/dl/");
}

export async function POST(request: NextRequest) {
  try {
    const { clipFilename, caption, accountId } = await request.json();

    if (!clipFilename) {
      return NextResponse.json(
        { error: "Missing clipFilename" },
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

    // Step 1: Upload clip to temporary public hosting
    const clipPath = path.join(process.cwd(), "tmp", clipFilename);
    if (!fs.existsSync(clipPath)) {
      return NextResponse.json(
        { error: "Clip file not found" },
        { status: 404 }
      );
    }

    console.log("Uploading clip to temporary hosting...");
    const publicVideoUrl = await uploadToTmpFiles(clipPath);
    console.log("Public video URL:", publicVideoUrl);

    // Step 2: Create media container
    const containerId = await createReelContainer(credentials, publicVideoUrl, caption);

    // Step 3: Wait for processing
    await waitForContainerReady(credentials, containerId);

    // Step 4: Publish
    const mediaId = await publishReel(credentials, containerId);

    return NextResponse.json({
      success: true,
      mediaId,
      message: "Reel published successfully!",
    });
  } catch (error: unknown) {
    console.error("Publish error:", error);
    const axiosErr = error as { response?: { data?: unknown } };
    if (axiosErr.response?.data) {
      console.error("API response data:", JSON.stringify(axiosErr.response.data, null, 2));
    }
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
