import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const CLIPPOST_URL = process.env.CLIPPOST_URL || "http://localhost:3001";
const CLIPPOST_API_KEY = process.env.CLIPPOST_API_KEY;

if (!CLIPPOST_API_KEY) {
  console.error("CLIPPOST_API_KEY environment variable is required");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${CLIPPOST_API_KEY}`,
  "Content-Type": "application/json",
};

const server = new McpServer({
  name: "clippost",
  version: "1.0.0",
});

server.tool(
  "auto_trim",
  "Create a clip from a YouTube video. AI downloads the video, transcribes it, picks the best segment, generates the clip with captions, and optionally auto-publishes to Instagram/YouTube based on user settings.",
  {
    url: z.string().describe("YouTube video URL"),
    purpose: z.string().optional().describe("Optional purpose/context for segment selection (e.g. 'funniest moment', 'key insight'). If omitted, AI picks the most viral-worthy segment."),
  },
  async ({ url, purpose }) => {
    const body: Record<string, string> = { url };
    if (purpose) body.purpose = purpose;

    const response = await fetch(`${CLIPPOST_URL}/api/autonomous`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.json();
      return {
        content: [
          {
            type: "text" as const,
            text: `Error: ${err.error || response.statusText}`,
          },
        ],
        isError: true,
      };
    }

    const reader = response.body?.getReader();
    if (!reader) {
      return {
        content: [{ type: "text" as const, text: "Error: No response stream" }],
        isError: true,
      };
    }

    const decoder = new TextDecoder();
    let lastResult = "";
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const data = JSON.parse(line.slice(6));
          if (data.type === "done") {
            const parts = [`Clip created: ${data.clipFilename}`];
            parts.push(`Segment: ${data.start?.toFixed(1)}s - ${data.end?.toFixed(1)}s`);
            if (data.segmentReason) parts.push(`Reason: ${data.segmentReason}`);
            if (data.title) parts.push(`Source: ${data.title}`);
            if (data.instagram?.success) parts.push(`Instagram: Published (${data.instagram.mediaId})`);
            if (data.instagram && !data.instagram.success) parts.push(`Instagram: ${data.instagram.reason}`);
            if (data.youtube?.success) parts.push(`YouTube: ${data.youtube.url}`);
            if (data.youtube && !data.youtube.success) parts.push(`YouTube: ${data.youtube.reason}`);
            lastResult = parts.join("\n");
          } else if (data.type === "error") {
            lastResult = `Error: ${data.message}`;
          }
        } catch {
          // skip malformed SSE lines
        }
      }
    }

    return {
      content: [
        {
          type: "text" as const,
          text: lastResult || "Pipeline completed but no result received.",
        },
      ],
      isError: lastResult.startsWith("Error:"),
    };
  }
);

server.tool(
  "get_settings",
  "Get the current ClipPost user settings including language, format, frame, publishing preferences, and autonomous mode.",
  async () => {
    const response = await fetch(`${CLIPPOST_URL}/api/settings/preferences`, {
      headers,
    });

    if (!response.ok) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error fetching settings: ${response.statusText}`,
          },
        ],
        isError: true,
      };
    }

    const settings = await response.json();
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(settings, null, 2),
        },
      ],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("MCP server error:", err);
  process.exit(1);
});
