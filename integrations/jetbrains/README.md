# VibeHub for JetBrains IDEs

Connects the [VibeHub MCP server](../../mcp/README.md) to JetBrains **AI
Assistant** and **Junie** (IntelliJ IDEA, WebStorm, PyCharm, GoLand, etc.,
2025.1+), so the in-IDE agent can store conversation transcripts in VibeHub
and attach them to commits.

JetBrains configures MCP through the IDE UI rather than a well-known file, so
there's no CLI installer — it's a one-time paste:

## Setup

1. Generate a token in the VibeHub dashboard (**Settings → API tokens**).
2. In your IDE open **Settings → Tools → AI Assistant → Model Context
   Protocol (MCP)** (for Junie: **Settings → Tools → Junie → MCP Settings**).
3. Click **Add**, switch to **As JSON**, and paste
   [`mcp.template.json`](./mcp.template.json) with `vbh_REPLACE_ME` swapped
   for your token. The Claude-style `mcpServers` format is accepted as-is.
4. Apply. The `vibehub` server should show a green status with its tools.

## Use

In an AI Assistant or Junie chat, ask it to "save this conversation to
VibeHub" or "capture this commit with the transcript" — the agent calls the
`vibehub_*` tools (sessions, commits, branches, blame). The
[MCP server docs](../../mcp/README.md) list every tool.

Requires Node.js 18+ on your PATH (the server runs via `npx -y vibehub-mcp`).
