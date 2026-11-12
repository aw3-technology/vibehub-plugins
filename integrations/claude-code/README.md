# vibehub-claude-code

Claude Code plugin that captures every session — prompts, tool calls, agent
output — into VibeHub, plus a `/vibehub:capture` skill for manual capture and
for attaching conversations to git commits.

## Install (plugin — recommended)

```bash
claude plugin marketplace add aw3-technology/vibehub-plugins
claude plugin install vibehub@vibehub
```

Then add your token (dashboard → Settings → API tokens) to the `env` block of
`~/.claude/settings.json` (`%USERPROFILE%\.claude\settings.json` on Windows):

```json
{
  "env": { "VIBEHUB_TOKEN": "vbh_…" }
}
```

This works on macOS, Linux and Windows, and in sessions started from an app
rather than a terminal. Exporting `VIBEHUB_TOKEN` in your shell profile also
works for terminal-launched sessions.

Open a new Claude Code session and it'll appear under **Runs** in the
dashboard. No further setup.

### What you get

- **Automatic transcript capture** via hooks (see table below). Every prompt,
  tool call, and assistant turn streams into a VibeHub session as you work.
- **`/vibehub:capture` skill** — ask Claude to "save this transcript to
  VibeHub", "attach this conversation to the last commit", or "store this
  output in VibeHub" and it knows the API: attach-to-commit, one-shot
  commit+transcript capture, ad-hoc output sessions, and project create/list.

## Install (legacy hooks, no plugin)

```bash
npx vibehub-claude-code install
export VIBEHUB_TOKEN=vbh_…
```

This merges hook entries into `~/.claude/settings.json` (a `.vibehub.bak`
backup is written first). Or merge [`settings.template.json`](./settings.template.json)
manually and replace the path placeholder.

## What the hooks capture

| Hook              | Stored as            |
| ----------------- | -------------------- |
| `SessionStart`    | new VibeHub session  |
| `UserPromptSubmit`| `role: user` message |
| `PostToolUse`     | `role: tool` message (input + output) |
| `Stop`            | assistant final turn |
| `SubagentStop`    | subagent assistant turn |
| `SessionEnd`      | session marked ended |

The hook keeps a map of Claude session ids → VibeHub session ids in
`~/.vibehub/claude-code/sessions.json`, so multiple parallel Claude Code
sessions don't collide.

## Configuration

| Env var           | Default               | Purpose            |
| ----------------- | --------------------- | ------------------ |
| `VIBEHUB_TOKEN`   | — (required)          | Bearer token       |
| `VIBEHUB_API_URL` | `https://www.vibehub.co` | Self-hosted target |

Capture is fail-open: if the token is missing or the API is unreachable, the
hook logs to stderr and exits 0 — it never blocks Claude Code.
