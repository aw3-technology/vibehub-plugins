# VibeHub for VS Code

One extension, three editors: works unchanged in **VS Code**, **Cursor**, and
**Windsurf** (and other VS Code forks).

## What it does

- **Auto-captures commits** — every commit you make is pushed to VibeHub with
  its message, full diff, and stats. The project is created (idempotently)
  from the workspace folder name on first capture.
- **Imports chat transcripts** — `VibeHub: Capture Chat Transcript` turns a
  pasted/copied Copilot, Cursor, or Windsurf chat into a VibeHub session.
- **Secret-storage token** — the API token lives in the editor's secret
  storage, not in synced settings.

For *automatic* conversation capture in Cursor/Windsurf, pair this extension
with the [VibeHub MCP server](../cursor/README.md) — MCP captures the chats,
the extension captures the commits, and VibeHub links them.

## Install

From a published VSIX / marketplace:

```bash
code --install-extension vibehub.vibehub-vscode        # VS Code
cursor --install-extension vibehub.vibehub-vscode      # Cursor
windsurf --install-extension vibehub.vibehub-vscode    # Windsurf
```

From source:

```bash
cd integrations/vscode
npx -y @vscode/vsce package          # produces vibehub-vscode-0.2.0.vsix
code --install-extension vibehub-vscode-0.2.0.vsix
```

Then run **`VibeHub: Set API Token`** from the command palette and paste a
token from the dashboard (Settings → API tokens). `VibeHub: Test Connection`
confirms it works.

## Commands

| Command                          | Action                                          |
| -------------------------------- | ----------------------------------------------- |
| `VibeHub: Set API Token`         | Store the `vbh_…` token in secret storage       |
| `VibeHub: Test Connection`       | Ping the API and show who you're signed in as   |
| `VibeHub: Capture Last Commit`   | Push HEAD (message + diff + stats) immediately  |
| `VibeHub: Capture Chat Transcript` | Import a pasted/clipboard chat as a session   |
| `VibeHub: Open Dashboard`        | Open the VibeHub dashboard in your browser      |

## Settings

| Setting                      | Default               | Purpose                              |
| ---------------------------- | --------------------- | ------------------------------------ |
| `vibehub.apiUrl`             | `https://www.vibehub.co` | Self-hosted target                   |
| `vibehub.autoCaptureCommits` | `true`                | Push commits as they happen          |
| `vibehub.projectName`        | workspace folder name | Override the VibeHub project mapping |

## MCP in VS Code (Copilot agent mode)

VS Code 1.102+ can also talk to VibeHub directly from Copilot agent mode.
Copy [`mcp.template.json`](./mcp.template.json) to `.vscode/mcp.json` in your
workspace (or add it via **MCP: Add Server**) and replace the token.
