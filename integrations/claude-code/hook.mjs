#!/usr/bin/env node
// VibeHub hook for Claude Code.
//
// Claude Code invokes hooks with a JSON event on stdin. This script:
//   - SessionStart  → starts (or reuses) a VibeHub session keyed by Claude's session id
//   - UserPromptSubmit → appends a `user` message
//   - Stop          → appends the assistant's final response
//   - PostToolUse   → (optional) appends a `tool` message
//   - SessionEnd    → marks the VibeHub session ended
//
// Wire it up by installing the plugin (`claude plugin install vibehub@vibehub`),
// via `npx vibehub-claude-code install`, or by adding the entries in
// `settings.template.json` to `~/.claude/settings.json` manually.
//
// All requests go through the @vibehub/sdk so transport/auth/retries are shared
// with every other integration.

import { readFileSync, mkdirSync, writeFileSync, renameSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";

const STATE_DIR = join(homedir(), ".vibehub", "claude-code");
const STATE_PATH = join(STATE_DIR, "sessions.json");

function readStdinSync() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function loadState() {
  try {
    return JSON.parse(readFileSync(STATE_PATH, "utf8"));
  } catch {
    return { sessions: {} };
  }
}

function saveState(state) {
  // Hooks fire as separate concurrent processes (parallel PostToolUse, etc.).
  // Write to a per-process temp file then atomically rename, so a half-written
  // file is never observed. Last writer still wins, but the server keys
  // sessions on externalId, so a clobbered mapping just re-resolves to the same
  // session id on the next call — no duplicates, no corruption.
  mkdirSync(STATE_DIR, { recursive: true });
  const tmp = `${STATE_PATH}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(state, null, 2) + "\n", { mode: 0o600 });
  renameSync(tmp, STATE_PATH);
}

function log(msg) {
  // Claude Code shows hook stderr in the trace pane. Keep it short.
  process.stderr.write(`[vibehub] ${msg}\n`);
}

// The bare domain 308-redirects to www, and fetch drops the Authorization
// header on that cross-origin hop, so configs saved with "https://vibehub.co"
// would 401 on every call. Map it (and a trailing-dot form) to www.
function canonicalApiUrl(url) {
  const trimmed = String(url).replace(/\/+$/, "");
  try {
    const host = new URL(trimmed).hostname.replace(/\.$/, "");
    if (host === "vibehub.co" || host === "www.vibehub.co") return "https://www.vibehub.co";
  } catch {
    // not a URL; leave it for the caller's own error handling
  }
  return trimmed;
}

function envConfig() {
  const apiUrl = canonicalApiUrl(process.env.VIBEHUB_API_URL || "https://www.vibehub.co");
  const token = process.env.VIBEHUB_TOKEN;
  return { apiUrl, token };
}

async function post(path, body) {
  const { apiUrl, token } = envConfig();
  if (!token) {
    log("VIBEHUB_TOKEN not set — skipping. Run `vibehub-claude-code install` to configure.");
    return null;
  }
  // Bound every call so a hung endpoint can't stall Claude Code on its hook
  // timeout. On abort/network error we log and return null — capture is
  // best-effort and must never block the session.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  let r;
  try {
    r = await fetch(apiUrl.replace(/\/$/, "") + path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "User-Agent": "vibehub-claude-code/0.2.0",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    log(`POST ${path} failed: ${e?.message || e}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    log(`POST ${path} → ${r.status}: ${t.slice(0, 200)}`);
    return null;
  }
  return r.json().catch(() => null);
}

function pickSessionId(event) {
  // Return null (not a sentinel) when no id is present, so unrelated events
  // don't get merged into one shared "unknown" VibeHub session.
  return event.session_id || event.sessionId || event.id || null;
}

async function ensureSession(claudeSessionId, event) {
  const state = loadState();
  const existing = state.sessions[claudeSessionId];
  if (existing?.id) return existing.id;

  const summary = (event.transcript_path || event.cwd || "")
    .toString()
    .slice(0, 200);

  const result = await post("/api/integrations/claude-code/hook", {
    type: "session_start",
    claudeSessionId,
    model: event.model || process.env.ANTHROPIC_MODEL || null,
    summary,
    cwd: event.cwd || null,
  });
  if (!result?.session?.id) return null;

  state.sessions[claudeSessionId] = { id: result.session.id, startedAt: Date.now() };
  saveState(state);
  return result.session.id;
}

function clip(s, max = 200_000) {
  if (s == null) return "";
  const str = String(s);
  return str.length > max ? str.slice(0, max) : str;
}

async function handle(event) {
  const hook = event.hook_event_name || event.hookEventName || event.event;
  const claudeSessionId = pickSessionId(event);
  if (!hook) return;
  if (!claudeSessionId) {
    log(`event ${hook} had no session id — skipping`);
    return;
  }

  if (hook === "SessionStart") {
    await ensureSession(claudeSessionId, event);
    return;
  }

  if (hook === "SessionEnd") {
    // Only close a session we actually registered — never create one here.
    const state = loadState();
    const mapped = state.sessions?.[claudeSessionId]?.id;
    if (mapped) {
      await post("/api/integrations/claude-code/hook", { type: "session_end", sessionId: mapped });
      delete state.sessions[claudeSessionId];
      saveState(state);
    }
    return;
  }

  const sessionId = await ensureSession(claudeSessionId, event);
  if (!sessionId) return;

  if (hook === "UserPromptSubmit") {
    await post("/api/integrations/claude-code/hook", {
      type: "message",
      sessionId,
      role: "user",
      content: clip(event.prompt || event.user_prompt || ""),
    });
    return;
  }

  if (hook === "PostToolUse") {
    const toolName = event.tool_name || event.tool || "tool";
    const input = event.tool_input ? JSON.stringify(event.tool_input).slice(0, 5_000) : "";
    const output = event.tool_response ? JSON.stringify(event.tool_response).slice(0, 50_000) : "";
    await post("/api/integrations/claude-code/hook", {
      type: "message",
      sessionId,
      role: "tool",
      toolName: String(toolName).slice(0, 100),
      content: clip(`input: ${input}\noutput: ${output}`),
    });
    return;
  }

  if (hook === "Stop" || hook === "SubagentStop") {
    let assistant = "";
    if (event.transcript_path && existsSync(event.transcript_path)) {
      try {
        const lines = readFileSync(event.transcript_path, "utf8")
          .split(/\r?\n/)
          .filter(Boolean);
        // Lock onto the LAST assistant message and use it. A final turn made up
        // only of tool_use/thinking blocks has no text — don't walk past it to
        // an earlier text turn (that would post stale content); instead
        // summarize the tools it invoked.
        for (let i = lines.length - 1; i >= 0; i--) {
          const j = JSON.parse(lines[i]);
          if (j.type === "assistant" || j.role === "assistant" || j.message?.role === "assistant") {
            const content = j.message?.content || j.content;
            if (typeof content === "string") {
              assistant = content;
            } else if (Array.isArray(content)) {
              const text = content.map((c) => c.text || "").filter(Boolean).join("\n");
              if (text) {
                assistant = text;
              } else {
                const tools = content
                  .filter((c) => c.type === "tool_use" && c.name)
                  .map((c) => c.name);
                if (tools.length) assistant = `(tool calls: ${tools.join(", ")})`;
              }
            }
            break;
          }
        }
      } catch (e) {
        log(`transcript parse failed: ${e.message}`);
      }
    }
    await post("/api/integrations/claude-code/hook", {
      type: "message",
      sessionId,
      role: "assistant",
      content: clip(assistant || "(no assistant turn captured)"),
    });
  }
}

(async () => {
  const raw = readStdinSync();
  if (!raw) {
    log("no stdin payload (Claude Code hooks pass JSON on stdin).");
    process.exit(0);
  }
  let event;
  try {
    event = JSON.parse(raw);
  } catch (e) {
    log(`invalid JSON: ${e.message}`);
    process.exit(0);
  }
  try {
    await handle(event);
  } catch (e) {
    log(`handler error: ${e.message}`);
  }
  // Always exit 0 — never block Claude Code on a capture failure.
  process.exit(0);
})();
