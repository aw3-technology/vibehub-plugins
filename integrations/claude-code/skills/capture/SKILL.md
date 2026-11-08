---
name: capture
description: Store the current conversation transcript, agent output, or a git commit in VibeHub, and attach conversations to commits. Use when the user asks to save/capture/upload this session, transcript, or agent output to VibeHub, attach a conversation to a commit, or list/create VibeHub projects.
---

# VibeHub capture

VibeHub stores LLM conversation transcripts alongside the git commits they
produced. This skill is the manual capture path; the plugin's hooks already
stream every turn automatically when `VIBEHUB_TOKEN` is set.

## Setup check

All calls need two environment variables:

- `VIBEHUB_TOKEN` — bearer token (`vbh_…`), generated in the dashboard under
  **Settings → API tokens**.
- `VIBEHUB_API_URL` — optional, defaults to `https://www.vibehub.co`.

Verify before doing anything else:

```bash
curl -sf -H "Authorization: Bearer $VIBEHUB_TOKEN" "${VIBEHUB_API_URL:-https://www.vibehub.co}/api/sdk/ping"
```

If this fails, tell the user to generate a token in the VibeHub dashboard
(Settings → API tokens) and export it as `VIBEHUB_TOKEN`, then stop.

## Find this session's VibeHub id

The hooks register every Claude Code session with
`externalId = claude-code:<session_id>`. The local map lives at
`~/.vibehub/claude-code/sessions.json` keyed by Claude session id. Read it to
find the VibeHub session id for the current session. If the file or entry is
missing, create a session first (see "Store output without the hooks").

## Attach this conversation to a commit

Use after committing, so the transcript shows up on the commit page:

```bash
curl -sf -X POST -H "Authorization: Bearer $VIBEHUB_TOKEN" -H "Content-Type: application/json" \
  "${VIBEHUB_API_URL:-https://www.vibehub.co}/api/sdk/sessions/<SESSION_ID>/attach" \
  -d "{\"sha\": \"$(git rev-parse HEAD)\", \"message\": $(git log -1 --pretty=%s | jq -Rs .), \"branch\": \"$(git branch --show-current)\"}"
```

Pass `projectId` too when known. Attaching closes the session; later turns in
the same Claude session will be captured into a fresh one by the hooks.

## One-shot: store a commit + transcript together

When there is no live session (or the user asks to capture a specific commit),
post commit metadata, diff, and conversation in one call:

```bash
curl -sf -X POST -H "Authorization: Bearer $VIBEHUB_TOKEN" -H "Content-Type: application/json" \
  "${VIBEHUB_API_URL:-https://www.vibehub.co}/api/cli/commits" -d @payload.json
```

`payload.json` shape (build it with git + jq; keep `diff` under 1.5 MB):

```json
{
  "projectId": "<uuid>",
  "sha": "<full sha>",
  "message": "<commit subject>",
  "committedAt": "<ISO timestamp>",
  "diff": "<git show output>",
  "filesChanged": 3, "insertions": 42, "deletions": 7,
  "conversation": {
    "source": "claude-code",
    "model": "<model id if known>",
    "messages": [
      { "role": "user", "content": "..." },
      { "role": "assistant", "content": "..." },
      { "role": "tool", "toolName": "Edit", "content": "..." }
    ]
  }
}
```

Roles must be `user | assistant | tool | system`; each message's `content` is
capped at 200k chars; max 500 messages per call. To reconstruct the full
transcript, read this session's JSONL transcript file and map assistant
`tool_use` blocks to `role: "tool"` messages with `toolName` set.

## Store agent output without the hooks

For ad-hoc output (a report, a build log, subagent results) not tied to a
commit, create a session and append messages:

```bash
# 1. create (idempotent on externalId)
curl -sf -X POST -H "Authorization: Bearer $VIBEHUB_TOKEN" -H "Content-Type: application/json" \
  "${VIBEHUB_API_URL:-https://www.vibehub.co}/api/sdk/sessions" \
  -d '{"source": "claude-code", "summary": "<what this output is>", "kind": "live"}'

# 2. append (repeat as needed)
curl -sf -X POST -H "Authorization: Bearer $VIBEHUB_TOKEN" -H "Content-Type: application/json" \
  "${VIBEHUB_API_URL:-https://www.vibehub.co}/api/sdk/sessions/<SESSION_ID>/messages" \
  -d '{"messages": [{"role": "assistant", "content": "<the output>"}]}'
```

## Projects

- List: `GET /api/cli/projects`
- Create (idempotent by slug): `POST /api/cli/projects` with
  `{"name": "<repo name>"}` — use the repo directory name unless the user says
  otherwise, and reuse the returned `id` as `projectId` in later calls.

## Reporting back

After a capture, give the user the session/commit id returned by the API and
the dashboard URL (`${VIBEHUB_API_URL}/dashboard`). On any 4xx, show the
response body — it contains a precise validation message. Never print the
token itself.
