// Shared config, persisted state, and helpers used by server.js and the
// tool modules. Lives in its own module so the tool files don't have to
// import server.js (which would be a circular import).

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { createClient } from "vibehub-sdk";

export const VERSION = "0.3.1";
const STATE_PATH = join(homedir(), ".vibehub", "mcp-state.json");

export function log(level, msg) {
  // MCP servers MUST NOT write non-protocol output to stdout. Use stderr.
  process.stderr.write(`[vibehub-mcp][${level}] ${msg}\n`);
}

/* ------------------------------- config ------------------------------- */

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

function loadEnvConfig() {
  const apiUrl = canonicalApiUrl(process.env.VIBEHUB_API_URL || "https://www.vibehub.co");
  const token = process.env.VIBEHUB_TOKEN;
  if (!token) {
    log("warn", "VIBEHUB_TOKEN not set — server will start but every tool call will fail.");
  }
  return { apiUrl, token };
}

function loadState() {
  try {
    return JSON.parse(readFileSync(STATE_PATH, "utf8"));
  } catch {
    return {};
  }
}

export function saveState(state) {
  // Best-effort: a read-only home dir (sandboxed IDE) must not turn a
  // successful tool call into an error — session tracking just won't persist.
  try {
    mkdirSync(dirname(STATE_PATH), { recursive: true });
    writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + "\n", { mode: 0o600 });
  } catch (e) {
    log("warn", `could not persist state to ${STATE_PATH}: ${e?.message || e}`);
  }
}

export const config = loadEnvConfig();
export const sdk = config.token ? createClient({ ...config, userAgent: "vibehub-mcp/" + VERSION }) : null;
export const state = loadState();

/* ------------------------------ helpers ------------------------------- */

export function asText(obj) {
  return [{ type: "text", text: typeof obj === "string" ? obj : JSON.stringify(obj, null, 2) }];
}

export function requireSdk() {
  if (!sdk) throw new Error("VIBEHUB_TOKEN not set in environment");
  return sdk;
}
