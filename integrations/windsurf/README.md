# vibehub-windsurf

Wires `vibehub-mcp` into Windsurf's Cascade MCP config.

## Install

```bash
export VIBEHUB_TOKEN=vbh_…
npx vibehub-windsurf install
```

On Windows, pass the token as a flag (PowerShell and cmd have no `export`): `npx vibehub-windsurf install --token vbh_…`. The installer writes `"command": "cmd", "args": ["/c", "npx", …]` there, because editors that start MCP servers without a shell can't run `npx.cmd` directly.


Restart Windsurf and refresh MCP in Cascade. Cascade now has `vibehub_*` tools
to start sessions, append messages, and attach them to commits.
