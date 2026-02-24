import { prisma } from "@/lib/db";
import fs from "fs";

const GOOGLE_CLIENT_ID = process.env.AUTH_GOOGLE_ID!;
const GOOGLE_CLIENT_SECRET = process.env.AUTH_GOOGLE_SECRET!;

export function getYouTubeAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: [
      "https://www.googleapis.com/auth/youtube.upload",
      "https://www.googleapis.com/auth/youtube.readonly",
    ].join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string
): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error_description || "Token exchange failed");
  }
  return res.json();
}

export async function refreshAccessToken(
  refreshToken: string
): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error_description || "Token refresh failed");
  }
  return res.json();
}

export async function getChannelInfo(accessToken: string): Promise<{
  channelId: string;
  channelTitle: string;
  thumbnailUrl: string;
}> {
  const res = await fetch(
    "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error("Failed to fetch channel info");
  const data = await res.json();
  const ch = data.items?.[0];
  if (!ch) throw new Error("No YouTube channel found for this account");
  return {
    channelId: ch.id,
    channelTitle: ch.snippet.title,
    thumbnailUrl: ch.snippet.thumbnails?.default?.url || "",
  };
}

export async function ensureFreshToken(
  userId: string,
  channelId: string
): Promise<string> {
  const channel = await prisma.youTubeChannel.findFirst({
    where: { userId, id: channelId },
  });
  if (!channel) throw new Error("YouTube channel not found");

  // Refresh if token expires in less than 5 minutes
  if (channel.tokenExpiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
    const refreshed = await refreshAccessToken(channel.refreshToken);
    await prisma.youTubeChannel.update({
      where: { id: channel.id },
      data: {
        accessToken: refreshed.access_token,
        tokenExpiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
      },
    });
    return refreshed.access_token;
  }

  return channel.accessToken;
}

export async function uploadToYouTubeShorts(
  accessToken: string,
  filePath: string,
  title: string,
  description: string
): Promise<string> {
  // Step 1: Initialize resumable upload
  const metadata = {
    snippet: {
      title: title.length > 100 ? title.slice(0, 97) + "..." : title,
      description,
      tags: ["Shorts"],
      categoryId: "22", // People & Blogs
    },
    status: {
      privacyStatus: "public",
      selfDeclaredMadeForKids: false,
    },
  };

  const initRes = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(metadata),
    }
  );

  if (!initRes.ok) {
    const err = await initRes.json();
    throw new Error(
      err.error?.message || "Failed to initialize YouTube upload"
    );
  }

  const uploadUrl = initRes.headers.get("location");
  if (!uploadUrl) throw new Error("No upload URL returned from YouTube");

  // Step 2: Upload the video file
  const fileBuffer = fs.readFileSync(filePath);

  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": fileBuffer.length.toString(),
    },
    body: fileBuffer,
  });

  if (!uploadRes.ok) {
    const err = await uploadRes.json();
    throw new Error(err.error?.message || "YouTube upload failed");
  }

  const result = await uploadRes.json();
  return result.id; // YouTube video ID
}
