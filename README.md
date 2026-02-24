<img width="1546" height="945" alt="image" src="https://github.com/user-attachments/assets/6b32a800-ebab-42ce-a78a-a7dbfcb92687" />

## Getting Started

Try: 

```bash
npm install 
# and
npm run dev
```

## MCP Server

ClipPost includes an MCP (Model Context Protocol) server that lets you trigger the autonomous clip pipeline from any MCP-compatible client (e.g. Claude Desktop).

### Setup

1. **Generate an API key** — Go to `/settings` and click "Generate API Key" in the API Key card. Copy the key.

2. **Set environment variables:**

```bash
export CLIPPOST_URL=http://localhost:3001   # your ClipPost server URL
export CLIPPOST_API_KEY=cpk_your-key-here
```

3. **Run the MCP server:**

```bash
npm run mcp
```

### Claude Desktop Configuration

Add this to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "clippost": {
      "command": "npx",
      "args": ["tsx", "/path/to/clippost/mcp-server.ts"],
      "env": {
        "CLIPPOST_URL": "http://localhost:3001",
        "CLIPPOST_API_KEY": "cpk_your-key-here"
      }
    }
  }
}
```

### Available Tools

| Tool | Description |
|------|-------------|
| `auto_trim` | Provide a YouTube URL (and optional purpose). AI downloads, transcribes, picks the best segment, generates a clip with captions, and auto-publishes based on your settings. |
| `get_settings` | Returns your current ClipPost preferences (language, format, frame, publishing toggles, autonomous mode). |

### Example Usage (from a chatbot)

> "Clip the funniest moment from https://youtube.com/watch?v=..."

The `auto_trim` tool will stream progress and return the clip filename, segment reason, and publish results.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
