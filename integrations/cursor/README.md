# vibehub-cursor

Adds the `vibehub-mcp` server to Cursor so the Cursor agent can capture chats
into VibeHub via MCP tools (`vibehub_start_session`, `vibehub_append_message`,
`vibehub_attach_to_commit`, …).

## Install

```bash
export VIBEHUB_TOKEN=vbh_…
npx vibehub-cursor install
```

Restart Cursor. The new MCP server appears in **Cursor Settings → MCP**.
Then tell the Cursor agent: *"start a vibehub session for this chat"* — or
add a Cursor rule that runs `vibehub_start_session` on chat start.

## Manual install

Copy [`mcp.template.json`](./mcp.template.json) into `~/.cursor/mcp.json`
(merging with anything already there).
