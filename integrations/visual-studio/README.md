# VibeHub for Visual Studio

Connects the [VibeHub MCP server](../../mcp/README.md) to **Visual Studio
2022 (17.14+) Copilot agent mode**, so the agent can store conversation
transcripts in VibeHub and attach them to commits.

## Setup

1. Generate a token in the VibeHub dashboard (**Settings → API tokens**).
2. Copy [`mcp.template.json`](./mcp.template.json) to one of:
   - `<solution dir>\.mcp.json` — per-solution (recommended; commit it
     without the token and let each dev fill in `VIBEHUB_TOKEN`), or
   - `%USERPROFILE%\.mcp.json` — global, all solutions.
3. Replace `vbh_REPLACE_ME` with your token.
4. Open the solution, switch Copilot Chat to **Agent** mode, and approve the
   `vibehub` server when prompted. Its tools appear under the tools picker.

## Use

Ask the agent to "save this conversation to VibeHub" or "capture this commit
with the transcript" — it calls the `vibehub_*` tools (sessions, commits,
branches, blame). The [MCP server docs](../../mcp/README.md) list every tool.

Requires Node.js 18+ on your PATH (the server runs via `npx -y vibehub-mcp`).
