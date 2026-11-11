# vibehub-zed

Wires the [VibeHub MCP server](../../mcp/README.md) into Zed as a context
server, so the Zed agent can start sessions, append transcript turns, and
attach them to commits.

## Install

```bash
export VIBEHUB_TOKEN=vbh_…   # Settings → API tokens in the dashboard
npx vibehub-zed
```

On Windows, pass the token as a flag (PowerShell and cmd have no `export`): `npx vibehub-zed --token vbh_…`. The installer writes `"command": "cmd", "args": ["/c", "npx", …]` there, because editors that start MCP servers without a shell can't run `npx.cmd` directly.


This merges a `context_servers.vibehub` entry into Zed's `settings.json`
(`~/.config/zed/settings.json`; a `.vibehub.bak` backup is written first).
If your settings file contains comments, merge
[`settings.template.json`](./settings.template.json) manually instead — the
installer refuses to rewrite a commented file.

Restart Zed, then check **Agent Panel → Settings** — the `vibehub` server
should be listed with its tools.

## Use

Ask the agent to "log this conversation to VibeHub" or "capture this commit
with our chat" — the `vibehub_*` tools handle sessions, commits, branches,
and blame. See the [MCP server docs](../../mcp/README.md) for the tool list.
