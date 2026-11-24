// Session tools — start a live conversation session, stream messages into
// it, and attach it to a commit when the user lands one.

import { VERSION, asText, requireSdk, saveState, state } from "../shared.js";

export const sessionTools = {
  vibehub_start_session: {
    description:
      "Start a new VibeHub conversation session and remember it as the current session. Call this when a new chat begins.",
    inputSchema: {
      type: "object",
      required: ["source"],
      properties: {
        source: {
          type: "string",
          description:
            'Where the chat originated. Known values: "claude-code", "cursor", "windsurf", "claude-desktop", "aider", "codex", "sdk", "manual".',
        },
        model: { type: "string", description: "Model identifier, e.g. claude-opus-4." },
        projectId: { type: "string", description: "Optional VibeHub project id to scope this session." },
        externalId: { type: "string", description: "Idempotency key — replays return the same session." },
        summary: { type: "string", description: "Short human description of the chat." },
        kind: {
          type: "string",
          enum: ["commit", "live"],
          description:
            'Default "commit": the session closes when attached to a commit. "live": stays open across many commits (long-running terminals, agent mirrors).',
        },
      },
    },
    async handler(args) {
      const client = requireSdk();
      const session = await client.startSession({
        source: args.source,
        model: args.model,
        projectId: args.projectId,
        externalId: args.externalId,
        summary: args.summary,
        kind: args.kind,
        client: "vibehub-mcp/" + VERSION,
      });
      state.currentSessionId = session.id;
      saveState(state);
      return asText({ ok: true, sessionId: session.id, status: session.status, kind: session.kind });
    },
  },

  vibehub_append_message: {
    description:
      "Append a single message to the current (or specified) session. Call this after every user or assistant turn.",
    inputSchema: {
      type: "object",
      required: ["role", "content"],
      properties: {
        sessionId: { type: "string", description: "Defaults to the current session id." },
        role: { type: "string", enum: ["user", "assistant", "tool", "system"] },
        content: { type: "string" },
        toolName: { type: "string" },
        timestamp: { type: "string", description: "ISO timestamp; defaults to now." },
      },
    },
    async handler(args) {
      const client = requireSdk();
      const sessionId = args.sessionId || state.currentSessionId;
      if (!sessionId) throw new Error("no current session — call vibehub_start_session first");
      const r = await client.appendMessages(sessionId, [
        { role: args.role, content: args.content, toolName: args.toolName, timestamp: args.timestamp },
      ]);
      return asText({ ok: true, sessionId, ...r });
    },
  },

  vibehub_append_messages: {
    description:
      "Append a batch of messages to the current (or specified) session. Use for backfilling history.",
    inputSchema: {
      type: "object",
      required: ["messages"],
      properties: {
        sessionId: { type: "string" },
        messages: {
          type: "array",
          items: {
            type: "object",
            required: ["role", "content"],
            properties: {
              role: { type: "string" },
              content: { type: "string" },
              toolName: { type: "string" },
              timestamp: { type: "string" },
            },
          },
        },
      },
    },
    async handler(args) {
      const client = requireSdk();
      const sessionId = args.sessionId || state.currentSessionId;
      if (!sessionId) throw new Error("no current session — call vibehub_start_session first");
      const r = await client.appendMessages(sessionId, args.messages);
      return asText({ ok: true, sessionId, ...r });
    },
  },

  vibehub_attach_to_commit: {
    description:
      "Attach the current (or specified) session to a git commit by SHA. Call this right after the user commits. A normal session is closed by this; a live session stays open and keeps accepting messages for later commits.",
    inputSchema: {
      type: "object",
      required: ["sha"],
      properties: {
        sessionId: { type: "string" },
        sha: { type: "string" },
        projectId: { type: "string", description: "Required if session has no project." },
        message: { type: "string", description: "Commit message — required if the commit isn't already registered in VibeHub." },
        parentSha: { type: "string" },
        branch: { type: "string" },
        authorName: { type: "string" },
        authorEmail: { type: "string" },
        committedAt: { type: "string" },
        diffStat: { type: "string", description: "Output of `git show --stat`." },
        diff: { type: "string" },
        filesChanged: { type: "number" },
        insertions: { type: "number" },
        deletions: { type: "number" },
      },
    },
    async handler(args) {
      const client = requireSdk();
      const sessionId = args.sessionId || state.currentSessionId;
      if (!sessionId) throw new Error("no current session — call vibehub_start_session first");
      const { sessionId: _unused, ...rest } = args;
      const r = await client.attachToCommit(sessionId, rest);
      // Live sessions stay open server-side, so keep them as the default.
      if (!r.live && state.currentSessionId === sessionId) {
        delete state.currentSessionId;
        saveState(state);
      }
      return asText({ ok: true, sessionId, commitId: r.commitId, reused: r.reused, live: !!r.live });
    },
  },

  vibehub_current_session: {
    description: "Return the id of the currently active session (the last one started by this server).",
    inputSchema: { type: "object", properties: {} },
    async handler() {
      const id = state.currentSessionId || null;
      if (!id) return asText({ sessionId: null });
      const client = requireSdk();
      const { session } = await client.getSession(id, { includeMessages: false });
      return asText({ sessionId: id, status: session?.status, kind: session?.kind, messageCount: session?.messageCount });
    },
  },

  vibehub_list_sessions: {
    description:
      "List the user's recent conversation sessions (newest first). Filter by status (open, attached, orphaned) or project.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["open", "attached", "orphaned"] },
        projectId: { type: "string" },
        limit: { type: "number", description: "Default 50, max 200." },
      },
    },
    async handler(args) {
      const client = requireSdk();
      return asText(await client.listSessions(args));
    },
  },
};
