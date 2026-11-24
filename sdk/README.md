# vibehub-sdk

Capture LLM conversations from agentic IDEs (Cursor, Windsurf, Continue.dev, Zed, custom agents) and attach them to git commits in VibeHub.

```bash
npm install vibehub-sdk
```

## Quick start

```ts
import { createClient } from "vibehub-sdk";

const vb = createClient({
  apiUrl: "https://www.vibehub.co", // or your self-hosted instance
  token: process.env.VIBEHUB_TOKEN, // create in dashboard → Settings → API tokens
});

// 1. Start a session when the user opens a chat in your IDE
const session = await vb.startSession({
  source: "cursor",
  model: "claude-opus-4",
  externalId: "cursor-chat-123", // idempotency key
});

// 2. Append messages as the conversation happens
await vb.appendMessages(session.id, [
  { role: "user", content: "fix the foo bug" },
  { role: "assistant", content: "Looking at src/foo.ts…" },
]);

// 3. When the user commits, attach the session to the resulting SHA
await vb.attachToCommit(session.id, {
  sha: "1a2b3c4d…",
  projectId: "<project-id>",
  message: "fix: foo bug",
});
```

## One-shot capture

If you don't want to manage a live session, post the whole commit + conversation in a single call:

```ts
await vb.captureCommit({
  projectId,
  sha,
  message: "feat: thing",
  committedAt: new Date(),
  diff: gitDiff,
  filesChanged: 3,
  insertions: 42,
  deletions: 7,
  conversation: {
    source: "windsurf",
    messages: [
      { role: "user", content: "..." },
      { role: "assistant", content: "..." },
    ],
  },
});
```

## API

All methods throw `VibeHubError` on non-2xx responses. The error carries `.status`, the parsed `.body`, and `.code` — the API's machine-readable code, e.g. `token_expired`, `invalid_token`, `insufficient_credits`, `not_found`. The client has a per-request timeout (default 30s) but doesn't retry.

### `createClient({ apiUrl, token, fetch?, userAgent?, timeoutMs? })`

Constructs a client. `fetch` defaults to the global; pass a polyfill for Node <18. An `apiUrl` of `https://vibehub.co` is rewritten to `https://www.vibehub.co`: the apex redirects there, and HTTP clients drop the `Authorization` header on that redirect.

`createClientFromEnv()` reads `VIBEHUB_TOKEN` (required) and `VIBEHUB_API_URL` (default `https://www.vibehub.co`).

### Sessions

| Method | Description |
| --- | --- |
| `ping()` | Check the token. Returns `{ user, token: { prefix, expiresAt }, server }`. |
| `startSession(input)` | Create (or reuse via `externalId`) an open session. Pass `kind: "live"` for terminals and agent mirrors that span many commits. |
| `appendMessages(id, msgs)` | Add messages (max 500 per call); sequence is server-assigned. |
| `getSession(id, { includeMessages? })` | Fetch the session and its messages. |
| `listSessions({ status?, projectId?, limit? })` | List the authenticated user's sessions (newest first, max 200). |
| `updateSession(id, patch)` | Patch `summary`, `endedAt`, or `status`. |
| `attachToCommit(id, { sha, projectId?, … })` | Link the session to a commit, creating the commit row if needed. Closes the session unless it's `live`; the result has `live: true` then. |

### Commits & projects

| Method | Description |
| --- | --- |
| `captureCommit(input)` | One-shot: commit + conversation in one POST. Free. A repeat call for a known sha returns `reused: true` (pass `replace: true` after an amend/rebase). |
| `createProject({ name, description?, visibility? })` | Create a project, or reuse yours with the same name. Defaults to private. |
| `listProjects()` | List the authenticated user's projects. |
| `listCommits({ projectId, limit? })` | Recent commits, newest first, with stats and conversation message counts. |
| `getCommit({ sha, projectId })` | One commit + its linked conversation. Short sha prefixes (≥4 hex) work. |
| `getCommitDiff({ sha, projectId, path? })` | Files touched, or one file's unified diff. |
| `getBlame({ projectId, path, branch? })` | Approximate per-line blame, replayed from stored diffs. |

### Branches & git mirror (GitHub, GitLab, Bitbucket)

| Method | Description |
| --- | --- |
| `listBranches({ projectId })` | Branches VibeHub tracks, with head SHAs. |
| `upsertBranch({ projectId, name, headSha?, isDefault? })` | Create or advance a branch; `isDefault: true` swaps the default. |
| `updateBranch(branchId, { name?, headSha?, isDefault? })` | Rename, move, or re-default a branch. |
| `deleteBranch(branchId)` | Stop tracking a branch (its commits stay). |
| `getMirror({ projectId, revealWebhook? })` | The mirror config and last push/receive status. |
| `setMirror({ projectId, provider?, host?, username?, owner, repo, defaultBranch?, token? })` | Link the mirror. `provider` is `github` (default), `gitlab` or `bitbucket`; `host` is for self-managed GitLab. The token is stored encrypted; omit `token` to keep the current one (changing provider or host drops it). |
| `verifyMirror({ projectId })` | Check the stored token can reach the repo. |
| `removeMirror({ projectId })` | Unlink the mirror. |
| `rotateMirrorWebhook({ projectId, register? })` | New inbound webhook secret, returned once, with the payload URL and the provider's settings page. `register: true` creates the webhook through the provider's API. |

### Tokens & credits

| Method | Description |
| --- | --- |
| `listTokens()` | Your API tokens (metadata only: name, prefix, lastUsedAt, expiresAt). |
| `createToken({ name })` | Mint a token. The plaintext is returned once; a token minted with a token never outlives its parent. |
| `revokeToken(tokenId)` | Revoke a token. |
| `getBalance({ fresh? })` | Your credit balance (cached 60s; `fresh: true` re-reads it). |

## Auth

Tokens are created in the VibeHub dashboard at **Settings → API tokens**. They start with `vbh_` and are passed as a bearer header. Treat them like API keys — only the sha256 hash is stored server-side and the plaintext is only shown once.

New tokens expire after 90 days. After that every call fails with `401` and `error.code === "token_expired"`; `ping()` returns `token.expiresAt` so you can warn before it happens. Tokens created before expiry shipped have `expiresAt: null` and never expire.

## Errors & limits

- `401` — `missing_token`, `invalid_token`, or `token_expired`.
- `402` — `insufficient_credits`: commit capture and git pushes spend prepaid credits.
- `429` — session creation, message appends and commit capture are limited to 30/min and 300/hour per user. Honour `Retry-After`.

## Concepts

- **Project** — a git repo registered with VibeHub.
- **Session** — an LLM conversation, optionally tied to a project. Starts `open`; becomes `attached` when linked to a commit (unless it's `live`, which stays open).
- **Commit** — a git commit captured into VibeHub. Carries the diff + stats.
- **Message** — a single turn in a session (`user` / `assistant` / `tool` / `system`).

All ids are UUIDs.

## License

MIT
