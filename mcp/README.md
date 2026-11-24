# vibehub-mcp

An MCP server that gives any agentic IDE the ability to capture LLM conversations into VibeHub and attach them to git commits.

Once added to an IDE that supports MCP (Cursor, Claude Desktop, Windsurf, Continue.dev, Zed, …), the agent gains 20 tools. The session-capture core:

| Tool | When to call it |
| --- | --- |
| `vibehub_whoami` | First, or whenever calls fail with 401: checks the token and shows when it expires. |
| `vibehub_start_session` | When a new chat begins. Remembers the session as "current". Pass `kind: "live"` for a session that spans many commits. |
| `vibehub_append_message` | After every user or assistant turn. |
| `vibehub_append_messages` | To backfill a batch of messages at once. |
| `vibehub_attach_to_commit` | Right after the user commits. Links the session to the SHA and closes it (live sessions stay open and current). |
| `vibehub_current_session` | To recover the current session id. |
| `vibehub_list_sessions` | Recent sessions, filterable by status or project. |
| `vibehub_list_projects` / `vibehub_create_project` | Project setup. |

Plus history, branch, and mirror tools so the agent can *read* what VibeHub knows about the repo:

| Tool | What it does |
| --- | --- |
| `vibehub_capture_commit` | One-shot commit + conversation capture (mirrors `vb commit`) when the whole transcript is already in hand. |
| `vibehub_list_commits` | Recent commits for a project, newest first, with stats. |
| `vibehub_get_commit` | One commit + its linked conversation. Accepts short SHA prefixes (≥ 4 hex chars). |
| `vibehub_get_commit_diff` | File list for a commit, or the per-file unified diff when `path` is passed. |
| `vibehub_blame` | Approximate per-line attribution for a file, replayed from stored diffs. |
| `vibehub_list_branches` | Branches VibeHub tracks for a project, with head SHAs. |
| `vibehub_upsert_branch` | Create or update a tracked branch (`headSha` to advance, `isDefault` to swap the default). |
| `vibehub_get_mirror` | Read the mirror config (GitHub, GitLab or Bitbucket) and last push/receive status. |
| `vibehub_set_mirror` | Configure the mirror (`provider`: github, gitlab or bitbucket; `host` for self-managed GitLab). The token is stored AES-256-GCM encrypted server-side; omit `token` to keep the existing one. |
| `vibehub_verify_mirror` | Check the stored token can reach the mirror repo. |
| `vibehub_rotate_mirror_webhook` | Generate/rotate the inbound webhook secret. The plaintext secret is returned **once**, with the payload URL and the provider's settings page; `register: true` creates the webhook through the provider's API. |

Every tool wraps a [`vibehub-sdk`](../sdk/README.md) method and the REST endpoints documented in [`docs/integrations.md`](../docs/integrations.md). Tools that take a `projectId` get it from `vibehub_list_projects`.

## Install

```bash
npm install -g vibehub-mcp
```

Or run directly without installing:

```bash
npx vibehub-mcp
```

## Configure

Generate a token in your VibeHub dashboard at **Settings → API tokens**, then add the server to your IDE's MCP config.

### Cursor (`~/.cursor/mcp.json`)

```json
{
  "mcpServers": {
    "vibehub": {
      "command": "npx",
      "args": ["-y", "vibehub-mcp"],
      "env": {
        "VIBEHUB_API_URL": "https://www.vibehub.co",
        "VIBEHUB_TOKEN": "vbh_…"
      }
    }
  }
}
```

### Claude Desktop

macOS `~/Library/Application Support/Claude/claude_desktop_config.json`, Windows `%APPDATA%\Claude\claude_desktop_config.json`, Linux `~/.config/Claude/claude_desktop_config.json`.

```json
{
  "mcpServers": {
    "vibehub": {
      "command": "npx",
      "args": ["-y", "vibehub-mcp"],
      "env": {
        "VIBEHUB_API_URL": "https://www.vibehub.co",
        "VIBEHUB_TOKEN": "vbh_…"
      }
    }
  }
}
```

### Windsurf / Continue.dev / Zed

Anywhere that accepts a stdio MCP server `command + args + env`, the same three lines work.

### Windows

`npx` is a `.cmd` script on Windows, and editors that start MCP servers without a shell (Claude Desktop, Zed) fail with `spawn npx ENOENT`. Wrap it in `cmd`:

```json
"command": "cmd",
"args": ["/c", "npx", "-y", "vibehub-mcp"]
```

The `npx vibehub-cursor|windsurf|zed install` installers write this form automatically on Windows.

## Get the agent to actually use the tools

MCP servers expose tools, but the agent has to decide to call them. The reliable pattern is to add an instruction to your IDE's system prompt or project rules file (`.cursorrules`, `AGENTS.md`, etc.):

> Use the `vibehub_*` tools to record this conversation. Call `vibehub_start_session` once at the beginning of the chat with source set to the IDE name. After every assistant response, call `vibehub_append_message` with role `assistant` and the response content. When the user commits, call `vibehub_attach_to_commit` with the SHA.

For zero-friction integration, point the IDE's commit flow at `vb commit --attach-session <id>` (the VibeHub CLI), which does the attach call for you.

## How sessions work

A session is an open conversation. It starts `open`, accumulates messages, and becomes `attached` when linked to a commit. Sessions without a commit can be cleaned up later as `orphaned`. A session started with `kind: "live"` is never closed by an attach: it links each commit and keeps accumulating messages, and stays the current session.

The current session id is persisted at `~/.vibehub/mcp-state.json` so a tool call like `vibehub_append_message` can omit `sessionId` and just use the most-recently-started one — which is what you want when the agent is calling the tools mid-conversation. The file is a small JSON object (`{ "currentSessionId": "<uuid>" }`); delete it to reset the server's notion of "current".

## Environment variables

| Var | Default | Description |
| --- | --- | --- |
| `VIBEHUB_API_URL` | `https://www.vibehub.co` | Base URL of your VibeHub instance. `https://vibehub.co` is rewritten to `www` (the apex redirect would drop the token). |
| `VIBEHUB_TOKEN` | *(required)* | CLI/SDK bearer token (`vbh_…`). |

## Errors & limits

- Tool failures come back as MCP tool errors of the form
  `error [code]: message`. `[token_expired]` / `[invalid_token]` mean the
  token needs replacing (tokens expire after 90 days — `vibehub_whoami` shows
  when); `[insufficient_credits]` means the account is out of credits (commit
  capture is free, so this only comes from credit-priced actions); a `404` usually means a `projectId` belonging to another
  account.
- Session creation, message appends and commit capture are rate-limited to
  **30 requests/min and 300/hour** per user. Batch with `vibehub_append_messages` instead of calling
  `vibehub_append_message` in a tight loop when backfilling.
- Message contents are capped server-side (200k chars per message, 500
  messages per append call); oversized payloads are truncated or rejected.

## Troubleshooting

- **"VIBEHUB_TOKEN not set" on stderr** — the server starts but every tool
  call fails locally with that message. Add the env var to your IDE's MCP
  config block.
- **`Missing bearer token` from the API** — something between you and the
  server dropped the header, usually a redirect. Use `https://www.vibehub.co`.
- **Agent never calls the tools** — that's an instruction problem, not a
  server problem; see "Get the agent to actually use the tools" above.
- **`sessionId` errors mid-chat** — the state file was cleared or another
  window started a newer session. Call `vibehub_current_session`, or
  `vibehub_start_session` again.
- The server speaks JSON-RPC over stdio and logs only to stderr; run
  `npx vibehub-mcp` in a terminal and paste an `initialize` request to smoke
  test it outside the IDE.

## License

MIT
