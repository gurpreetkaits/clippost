import axios from "axios";

const GRAPH_API_BASE = "https://graph.instagram.com/v21.0";

export interface InstagramCredentials {
  accessToken: string;
  accountId: string;
}

interface MediaContainerResponse {
  id: string;
}

interface PublishResponse {
  id: string;
}

interface StatusResponse {
  status_code: string;
  status: string;
}

export async function createReelContainer(
  credentials: InstagramCredentials,
  videoUrl: string,
  caption?: string
): Promise<string> {
  const params: Record<string, string> = {
    media_type: "REELS",
    video_url: videoUrl,
    access_token: credentials.accessToken,
  };

  if (caption) {
    params.caption = caption;
  }

  const response = await axios.post<MediaContainerResponse>(
    `${GRAPH_API_BASE}/${credentials.accountId}/media`,
    null,
    { params }
  );

  return response.data.id;
}

export async function checkContainerStatus(
  credentials: InstagramCredentials,
  containerId: string
): Promise<StatusResponse> {
  const response = await axios.get<StatusResponse>(
    `${GRAPH_API_BASE}/${containerId}`,
    {
      params: {
        fields: "status_code,status",
        access_token: credentials.accessToken,
      },
    }
  );

  return response.data;
}

export async function publishReel(
  credentials: InstagramCredentials,
  containerId: string
): Promise<string> {
  const response = await axios.post<PublishResponse>(
    `${GRAPH_API_BASE}/${credentials.accountId}/media_publish`,
    null,
    {
      params: {
        creation_id: containerId,
        access_token: credentials.accessToken,
      },
    }
  );

  return response.data.id;
}

export async function waitForContainerReady(
  credentials: InstagramCredentials,
  containerId: string,
  maxWaitMs = 120000
): Promise<void> {
  const startTime = Date.now();
  const pollInterval = 3000;

  while (Date.now() - startTime < maxWaitMs) {
    const status = await checkContainerStatus(credentials, containerId);

    if (status.status_code === "FINISHED") {
      return;
    }

    if (status.status_code === "ERROR") {
      throw new Error(`Container processing failed: ${status.status}`);
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  throw new Error("Timed out waiting for container to be ready");
}
