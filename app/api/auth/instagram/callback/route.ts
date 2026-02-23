import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { upsertAccount } from "@/lib/accounts";
import { requireAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) {
    // Not logged in — redirect to login
    const host = request.headers.get("host") || "localhost:3456";
    const protocol = host.startsWith("localhost") ? "http" : "https";
    return NextResponse.redirect(`${protocol}://${host}/login`);
  }
  const { userId } = authResult;

  const code = request.nextUrl.searchParams.get("code");
  const errorParam = request.nextUrl.searchParams.get("error");

  const host = request.headers.get("host") || "localhost:3456";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  const baseUrl = `${protocol}://${host}`;

  if (errorParam) {
    const errorDesc = request.nextUrl.searchParams.get("error_description") || "Unknown error";
    return NextResponse.redirect(
      `${baseUrl}/settings?error=${encodeURIComponent(errorDesc)}`
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${baseUrl}/settings?error=${encodeURIComponent("No authorization code received")}`
    );
  }

  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;

  if (!appId || !appSecret) {
    return NextResponse.redirect(
      `${baseUrl}/settings?error=${encodeURIComponent("Facebook app credentials not configured")}`
    );
  }

  const redirectUri = `${baseUrl}/api/auth/instagram/callback`;

  try {
    // Step 1: Exchange code for short-lived token
    const tokenResponse = await axios.get(
      "https://graph.facebook.com/v21.0/oauth/access_token",
      {
        params: {
          client_id: appId,
          client_secret: appSecret,
          redirect_uri: redirectUri,
          code,
        },
      }
    );

    const shortLivedToken = tokenResponse.data.access_token;

    // Step 2: Exchange for long-lived token
    const longLivedResponse = await axios.get(
      "https://graph.facebook.com/v21.0/oauth/access_token",
      {
        params: {
          grant_type: "fb_exchange_token",
          client_id: appId,
          client_secret: appSecret,
          fb_exchange_token: shortLivedToken,
        },
      }
    );

    const longLivedToken = longLivedResponse.data.access_token;
    const expiresIn = longLivedResponse.data.expires_in || 5184000; // Default 60 days

    // Step 3: Get Facebook Pages
    const pagesResponse = await axios.get(
      "https://graph.facebook.com/v21.0/me/accounts",
      {
        params: {
          access_token: longLivedToken,
          fields: "id,name,access_token,instagram_business_account",
        },
      }
    );

    const pages = pagesResponse.data.data || [];
    console.log("Facebook Pages response:", JSON.stringify(pages, null, 2));
    let connectedCount = 0;

    for (const page of pages) {
      if (!page.instagram_business_account) continue;

      const igAccountId = page.instagram_business_account.id;

      // Step 4: Fetch Instagram account details
      const igResponse = await axios.get(
        `https://graph.facebook.com/v21.0/${igAccountId}`,
        {
          params: {
            fields: "id,username,name,profile_picture_url",
            access_token: page.access_token,
          },
        }
      );

      const igData = igResponse.data;

      upsertAccount(userId, {
        id: igData.id,
        username: igData.username || "",
        name: igData.name || igData.username || "",
        profilePictureUrl: igData.profile_picture_url || "",
        accessToken: page.access_token,
        tokenExpiresAt: Date.now() + expiresIn * 1000,
        facebookPageId: page.id,
        connectedAt: new Date().toISOString(),
      });

      connectedCount++;
    }

    if (connectedCount === 0) {
      return NextResponse.redirect(
        `${baseUrl}/settings?error=${encodeURIComponent(
          "No Instagram Business accounts found. Make sure your Instagram account is a Business or Creator account connected to a Facebook Page."
        )}`
      );
    }

    return NextResponse.redirect(
      `${baseUrl}/settings?connected=${connectedCount}`
    );
  } catch (error) {
    console.error("OAuth callback error:", error);
    const message =
      error instanceof Error ? error.message : "OAuth failed";
    return NextResponse.redirect(
      `${baseUrl}/settings?error=${encodeURIComponent(message)}`
    );
  }
}
