# VibeHub plugins

Save your Claude Code, Cursor, and other AI coding agent sessions, with
prompts, tool calls, and agent output, and attach each conversation to the git
commit it produced.

This repo is the plugin marketplace and editor integrations for
[VibeHub](https://www.vibehub.co), version control for AI-written code. Each
VibeHub commit keeps the prompts, agent transcript, and model config next to
the diff, so reviewers can see why a change exists, not just what changed.

> Not to be confused with vibehub.io or `VW-ai/vibehub-plugin`, which are
> unrelated projects with the same name.

Just want to read a session? The free
[Claude Code transcript viewer](https://www.vibehub.co/tools/claude-code-transcript-viewer)
opens any `~/.claude/projects/*.jsonl` file in your browser and exports it
to Markdown or HTML. It needs no install or account.

## Claude Code

```bash
claude plugin marketplace add aw3-technology/vibehub-plugins
claude plugin install vibehub@vibehub
export VIBEHUB_TOKEN=vbh_…   # www.vibehub.co → Settings → API tokens
```

Open a new Claude Code session. The plugin's hooks stream every prompt, tool
call, and assistant turn into a VibeHub session, and the `/vibehub:capture`
skill attaches the conversation to a git commit. Capture is fail-open: if
VibeHub is unreachable, Claude Code keeps working.

Details: [integrations/claude-code](integrations/claude-code).

## Other tools

| Tool | How it connects | Setup |
| --- | --- | --- |
| Cursor | MCP server | [integrations/cursor](integrations/cursor) |
| Windsurf | MCP server | [integrations/windsurf](integrations/windsurf) |
| VS Code | Extension + MCP server | [integrations/vscode](integrations/vscode) |
| GitHub Copilot | VS Code extension | [integrations/copilot](integrations/copilot) |
| Zed | MCP context server | [integrations/zed](integrations/zed) |
| JetBrains IDEs | MCP server | [integrations/jetbrains](integrations/jetbrains) |
| Visual Studio | MCP server | [integrations/visual-studio](integrations/visual-studio) |
| Replit | Setup script | [integrations/replit](integrations/replit) |
| v0, Lovable, Bolt | Planned | [v0](integrations/v0) · [Lovable](integrations/lovable) · [Bolt](integrations/bolt) |

The MCP-based setups run the `vibehub-mcp` server, which isn't on npm yet.
Until it is, Claude Code is the supported path.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `VIBEHUB_TOKEN` | — | API token from Settings → API tokens (required) |
| `VIBEHUB_API_URL` | `https://www.vibehub.co` | Point at a self-hosted VibeHub |

## Links

- Docs: https://www.vibehub.co/docs
- Claude Code integration guide: https://www.vibehub.co/integrations/claude-code
- How VibeHub compares with similar tools: https://www.vibehub.co/compare
- Claude Code transcript viewer: https://www.vibehub.co/tools/claude-code-transcript-viewer

## License

MIT
