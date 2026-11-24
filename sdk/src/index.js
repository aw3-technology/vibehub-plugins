// vibehub-sdk — push LLM conversations from agentic IDEs into VibeHub.
//
// Usage:
//   import { createClient } from "vibehub-sdk";
//   const vb = createClient({ apiUrl: "https://www.vibehub.co", token: process.env.VIBEHUB_TOKEN });
//   const session = await vb.startSession({ source: "cursor", model: "claude-opus-4" });
//   await vb.appendMessages(session.id, [{ role: "user", content: "..." }]);
//   await vb.attachToCommit(session.id, { sha, projectId, message });
//
// All methods throw on non-2xx with a structured error.

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_USER_AGENT = "vibehub-sdk/0.3.1";

export class VibeHubError extends Error {
  constructor(message, { status, body } = {}) {
    super(message);
    this.name = "VibeHubError";
    this.status = status;
    this.body = body;
    // Machine-readable error code from the API body, e.g. "token_expired",
    // "invalid_token", "insufficient_credits", "not_found".
    this.code = (body && typeof body === "object" && body.code) || undefined;
  }
}

// The bare domain 308-redirects to www, and fetch drops the Authorization
// header on that cross-origin hop, so configs saved with "https://vibehub.co"
// would 401 on every call. Map it (and a trailing-dot form) to www.
// Exported for clients that build URLs themselves (e.g. webhook payload URLs,
// which GitHub won't follow through the redirect).
export function canonicalApiUrl(url) {
  const trimmed = String(url).replace(/\/+$/, "");
  try {
    const host = new URL(trimmed).hostname.replace(/\.$/, "");
    if (host === "vibehub.co" || host === "www.vibehub.co") return "https://www.vibehub.co";
  } catch {
    // not a URL; leave it for the caller's own error handling
  }
  return trimmed;
}

/**
 * Create a VibeHub client bound to an API URL and a CLI token.
 * Returns an object with start/append/attach/capture methods.
 *
 * @param {{ apiUrl: string, token: string, fetch?: typeof fetch, userAgent?: string, timeoutMs?: number }} opts
 */
export function createClient(opts) {
  if (!opts || !opts.apiUrl) throw new Error("createClient: apiUrl required");
  if (!opts.token) throw new Error("createClient: token required");

  const apiUrl = canonicalApiUrl(opts.apiUrl);
  const token = opts.token;
  const fetchImpl = opts.fetch || globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw new Error("createClient: no fetch available (Node 18+ or pass opts.fetch)");
  }
  const userAgent = opts.userAgent || DEFAULT_USER_AGENT;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  async function request(method, path, body) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    let res;
    try {
      res = await fetchImpl(apiUrl + path, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "User-Agent": userAgent,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (e) {
      throw new VibeHubError(`${method} ${path} failed: ${e.message || e}`, {});
    } finally {
      clearTimeout(t);
    }
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      /* keep text */
    }
    if (!res.ok) {
      const msg = (json && json.error) || text || `HTTP ${res.status}`;
      throw new VibeHubError(`${method} ${path} → ${res.status}: ${msg}`, {
        status: res.status,
        body: json || text,
      });
    }
    return json;
  }

  return {
    /**
     * Identity + health probe. Use this as the canonical Test Connection
     * target. Returns `{ ok, user, server }`. Throws VibeHubError on a
     * missing/invalid token.
     */
    async ping() {
      return request("GET", "/api/sdk/ping");
    },

    /**
     * Start a new live session. Returns the session row including its `id`.
     * Pass an `externalId` to make this idempotent — replaying the same call
     * returns the existing session. Pass `kind: 'live'` for long-running
     * sessions (terminals, agent mirrors) that should accept appends after
     * `attachToCommit` instead of being closed by it.
     */
    async startSession({ source, projectId, model, externalId, summary, client, startedAt, kind }) {
      if (!source) throw new Error("startSession: source required");
      const r = await request("POST", "/api/sdk/sessions", {
        source,
        projectId,
        model,
        externalId,
        summary,
        client: client || userAgent,
        startedAt,
        kind,
      });
      return r.session;
    },

    /**
     * Append messages to a session. Sequence is server-assigned starting from
     * the current message_count, so concurrent appenders won't collide.
     */
    async appendMessages(sessionId, messages) {
      if (!sessionId) throw new Error("appendMessages: sessionId required");
      if (!Array.isArray(messages) || !messages.length) {
        throw new Error("appendMessages: non-empty messages array required");
      }
      return request("POST", `/api/sdk/sessions/${sessionId}/messages`, { messages });
    },

    /** Fetch a session by id, optionally with all its messages. */
    async getSession(sessionId, { includeMessages = true } = {}) {
      const qs = includeMessages ? "" : "?messages=0";
      return request("GET", `/api/sdk/sessions/${sessionId}${qs}`);
    },

    /** List sessions for the authenticated user. */
    async listSessions({ status, projectId, limit } = {}) {
      const qs = new URLSearchParams();
      if (status) qs.set("status", status);
      if (projectId) qs.set("project_id", projectId);
      if (limit) qs.set("limit", String(limit));
      const path = `/api/sdk/sessions${qs.toString() ? `?${qs}` : ""}`;
      return request("GET", path);
    },

    /** Update session metadata (summary, endedAt, status). */
    async updateSession(sessionId, patch) {
      return request("PATCH", `/api/sdk/sessions/${sessionId}`, patch);
    },

    /**
     * Close a session and link it to a commit. The commit can already exist
     * in VibeHub (registered by `vb commit`) or be created on the fly here.
     */
    async attachToCommit(sessionId, params) {
      if (!sessionId) throw new Error("attachToCommit: sessionId required");
      if (!params || !params.sha) throw new Error("attachToCommit: sha required");
      return request("POST", `/api/sdk/sessions/${sessionId}/attach`, params);
    },

    /**
     * One-shot bulk capture: post a commit + full conversation in a single
     * call. Mirrors the CLI ingest path; ideal for simple integrations that
     * don't want to maintain a live session.
     */
    async captureCommit(params) {
      if (!params || !params.projectId || !params.sha) {
        throw new Error("captureCommit: projectId and sha required");
      }
      return request("POST", "/api/cli/commits", params);
    },

    /** Create or reuse a project (repo) by name. */
    async createProject({ name, description, visibility } = {}) {
      if (!name) throw new Error("createProject: name required");
      return request("POST", "/api/cli/projects", { name, description, visibility });
    },

    /** List the authenticated user's projects. */
    async listProjects() {
      return request("GET", "/api/cli/projects");
    },

    /* ----------------------- commits & history ---------------------- */
    /** List recent commits for a project. */
    async listCommits({ projectId, limit = 20 } = {}) {
      if (!projectId) throw new Error("listCommits: projectId required");
      const qs = new URLSearchParams({ project_id: projectId, limit: String(limit) });
      return request("GET", `/api/cli/commits?${qs}`);
    },

    /**
     * Fetch a single commit, including the linked conversation. The server
     * accepts short sha prefixes (≥4 hex chars), so this mirrors `vb show`.
     */
    async getCommit({ sha, projectId }) {
      if (!sha) throw new Error("getCommit: sha required");
      if (!projectId) throw new Error("getCommit: projectId required");
      const qs = new URLSearchParams({ project_id: projectId });
      return request("GET", `/api/cli/commits/${encodeURIComponent(sha)}?${qs}`);
    },

    /**
     * Per-file diff for a commit. Omit `path` to receive the list of files
     * touched. Reads from the stored diff text — no local git objects.
     */
    async getCommitDiff({ sha, projectId, path } = {}) {
      if (!sha) throw new Error("getCommitDiff: sha required");
      if (!projectId) throw new Error("getCommitDiff: projectId required");
      const qs = new URLSearchParams({ project_id: projectId });
      if (path) qs.set("path", path);
      return request("GET", `/api/cli/commits/${encodeURIComponent(sha)}/diff?${qs}`);
    },

    /**
     * Approximate blame for a file: replays every stored diff that touched it,
     * in committed_at order, and returns per-line attribution.
     */
    async getBlame({ projectId, path, branch } = {}) {
      if (!projectId) throw new Error("getBlame: projectId required");
      if (!path) throw new Error("getBlame: path required");
      const qs = new URLSearchParams({ project_id: projectId, path });
      if (branch) qs.set("branch", branch);
      return request("GET", `/api/cli/blame?${qs}`);
    },

    /* ----------------------------- branches ------------------------- */
    /** List branches tracked by VibeHub for a project. */
    async listBranches({ projectId } = {}) {
      if (!projectId) throw new Error("listBranches: projectId required");
      const qs = new URLSearchParams({ project_id: projectId });
      return request("GET", `/api/cli/branches?${qs}`);
    },

    /**
     * Create or upsert a branch row. Pass `headSha` to advance the head;
     * passing `isDefault: true` swaps the project's default branch.
     */
    async upsertBranch({ projectId, name, headSha, isDefault } = {}) {
      if (!projectId) throw new Error("upsertBranch: projectId required");
      if (!name) throw new Error("upsertBranch: name required");
      return request("POST", `/api/cli/branches`, {
        projectId,
        name,
        headSha,
        isDefault,
      });
    },

    /** Rename a branch, move its head, or make it the default. */
    async updateBranch(branchId, { name, headSha, isDefault } = {}) {
      if (!branchId) throw new Error("updateBranch: branchId required");
      return request("PATCH", `/api/cli/branches/${encodeURIComponent(branchId)}`, {
        name,
        headSha,
        isDefault,
      });
    },

    /** Delete a branch row. Commits on it are kept. */
    async deleteBranch(branchId) {
      if (!branchId) throw new Error("deleteBranch: branchId required");
      return request("DELETE", `/api/cli/branches/${encodeURIComponent(branchId)}`);
    },

    /* ----------------------------- mirror --------------------------- */
    /**
     * Read the project's mirror config (GitHub, GitLab or Bitbucket). Pass `revealWebhook: true` to
     * also receive the webhook secret (one-time display after rotation).
     */
    async getMirror({ projectId, revealWebhook = false } = {}) {
      if (!projectId) throw new Error("getMirror: projectId required");
      const qs = new URLSearchParams({ project_id: projectId });
      if (revealWebhook) qs.set("reveal_webhook", "1");
      return request("GET", `/api/cli/mirrors?${qs}`);
    },

    /**
     * Set (or update) the mirror target. `provider` is "github" (default),
     * "gitlab" or "bitbucket"; `host` is for self-managed GitLab; `username`
     * overrides the git-over-HTTPS username paired with the token. Token
     * stored encrypted; changing provider or host without a new token drops
     * the old one.
     */
    async setMirror({
      projectId,
      provider,
      host,
      username,
      owner,
      repo,
      defaultBranch,
      token,
    } = {}) {
      if (!projectId) throw new Error("setMirror: projectId required");
      if (!owner || !repo) throw new Error("setMirror: owner and repo required");
      return request("PUT", `/api/cli/mirrors`, {
        projectId,
        provider,
        host,
        username,
        owner,
        repo,
        defaultBranch,
        token,
      });
    },

    /** Remove the configured mirror. */
    async removeMirror({ projectId } = {}) {
      if (!projectId) throw new Error("removeMirror: projectId required");
      await request("DELETE", `/api/cli/mirrors`, { projectId });
      return { ok: true };
    },

    /**
     * Generate (or rotate) the inbound webhook secret. The plaintext secret is
     * returned only on this call; persist it immediately, since the server
     * stores only the secret you must hand to the provider. With
     * `register: true` the server also creates the webhook on the provider
     * through its API (result in `registered`).
     */
    async rotateMirrorWebhook({ projectId, register = false } = {}) {
      if (!projectId) throw new Error("rotateMirrorWebhook: projectId required");
      const action = register ? "register-webhook" : "rotate-webhook";
      return request("POST", `/api/cli/mirrors?action=${action}`, {
        projectId,
      });
    },

    /** Check the stored mirror token can reach the repo on the provider. */
    async verifyMirror({ projectId } = {}) {
      if (!projectId) throw new Error("verifyMirror: projectId required");
      return request("POST", `/api/cli/mirrors?action=verify`, { projectId });
    },

    /* ------------------------- tokens & billing --------------------- */
    /** List the user's API tokens (metadata only, never the secret). */
    async listTokens() {
      return request("GET", "/api/cli/tokens");
    },

    /**
     * Mint a new API token. When called with a token, the child never
     * outlives its parent's expiry. The plaintext is returned only here.
     */
    async createToken({ name } = {}) {
      if (!name) throw new Error("createToken: name required");
      return request("POST", "/api/cli/tokens", { name });
    },

    /** Revoke an API token by id. */
    async revokeToken(tokenId) {
      if (!tokenId) throw new Error("revokeToken: tokenId required");
      return request("DELETE", `/api/cli/tokens/${encodeURIComponent(tokenId)}`);
    },

    /**
     * Current credit balance. Commit capture is free; agent chat and
     * vibehub-remote pushes spend credits and fail with 402
     * (`code: "insufficient_credits"`) when the balance runs out.
     */
    async getBalance({ fresh = false } = {}) {
      return request("GET", `/api/billing/balance${fresh ? "?fresh=1" : ""}`);
    },
  };
}

/**
 * Convenience: build a client from environment variables.
 *   VIBEHUB_API_URL  (default: https://www.vibehub.co)
 *   VIBEHUB_TOKEN    (required)
 */
export function createClientFromEnv(env = globalThis.process?.env || {}) {
  const apiUrl = env.VIBEHUB_API_URL || "https://www.vibehub.co";
  const token = env.VIBEHUB_TOKEN;
  if (!token) throw new Error("VIBEHUB_TOKEN not set");
  return createClient({ apiUrl, token });
}
