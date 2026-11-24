// Commit tools — one-shot capture, listing, fetching, diffs, and blame.

import { asText, requireSdk } from "../shared.js";

export const commitTools = {
  vibehub_capture_commit: {
    description:
      "One-shot commit + conversation capture. Use when you have the commit metadata + transcript already in hand and don't want to maintain a live session. Mirrors `vb commit`.",
    inputSchema: {
      type: "object",
      required: ["projectId", "sha", "message", "committedAt"],
      properties: {
        projectId: { type: "string" },
        sha: { type: "string" },
        parentSha: { type: "string" },
        message: { type: "string" },
        authorName: { type: "string" },
        authorEmail: { type: "string" },
        branch: { type: "string" },
        committedAt: { type: "string", description: "ISO timestamp." },
        diffStat: { type: "string" },
        diff: { type: "string" },
        filesChanged: { type: "number" },
        insertions: { type: "number" },
        deletions: { type: "number" },
        replace: {
          type: "boolean",
          description: "Refresh the commit row + re-link the conversation. Use after git amend/rebase.",
        },
        conversation: {
          type: "object",
          required: ["source", "messages"],
          properties: {
            source: { type: "string" },
            client: { type: "string", description: "Client identifier, e.g. cursor/1.2." },
            externalId: { type: "string", description: "Idempotency key for the conversation." },
            kind: { type: "string", enum: ["commit", "merge", "rewrite", "live"] },
            model: { type: "string" },
            summary: { type: "string" },
            startedAt: { type: "string" },
            endedAt: { type: "string" },
            messages: { type: "array" },
          },
        },
      },
    },
    async handler(args) {
      const client = requireSdk();
      const r = await client.captureCommit(args);
      return asText({
        ok: true,
        commitId: r.commit?.id,
        sha: r.commit?.sha,
        conversationId: r.conversationId ?? null,
        reused: !!r.reused,
      });
    },
  },

  vibehub_list_commits: {
    description:
      "List recent commits for a project (newest first). Each entry includes filesChanged/insertions/deletions and the number of conversation messages linked to it.",
    inputSchema: {
      type: "object",
      required: ["projectId"],
      properties: {
        projectId: { type: "string" },
        limit: { type: "number", description: "Default 20, max 100." },
      },
    },
    async handler(args) {
      const client = requireSdk();
      const r = await client.listCommits(args);
      return asText({ commits: r.commits });
    },
  },

  vibehub_get_commit: {
    description:
      "Fetch a single commit and its linked conversation. Accepts short sha prefixes (≥4 hex chars).",
    inputSchema: {
      type: "object",
      required: ["projectId", "sha"],
      properties: {
        projectId: { type: "string" },
        sha: { type: "string" },
      },
    },
    async handler(args) {
      const client = requireSdk();
      const r = await client.getCommit(args);
      return asText(r);
    },
  },

  vibehub_get_commit_diff: {
    description:
      "Diff for a commit. Omit `path` to receive the list of files changed; pass `path` to receive the per-file unified diff. Reads from the server-stored diff — no local git objects required.",
    inputSchema: {
      type: "object",
      required: ["projectId", "sha"],
      properties: {
        projectId: { type: "string" },
        sha: { type: "string" },
        path: { type: "string" },
      },
    },
    async handler(args) {
      const client = requireSdk();
      const r = await client.getCommitDiff(args);
      return asText(r);
    },
  },

  vibehub_blame: {
    description:
      "Approximate blame for a file. Replays every stored diff that touched the path and attributes each surviving line to the commit that last inserted (or touched) it. Filter by branch with `branch`.",
    inputSchema: {
      type: "object",
      required: ["projectId", "path"],
      properties: {
        projectId: { type: "string" },
        path: { type: "string" },
        branch: { type: "string" },
      },
    },
    async handler(args) {
      const client = requireSdk();
      const r = await client.getBlame(args);
      return asText(r);
    },
  },
};
