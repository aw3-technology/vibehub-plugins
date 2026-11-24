#!/usr/bin/env node
// vibehub-mcp — MCP server that exposes VibeHub session capture as tools.
// Speaks JSON-RPC 2.0 over stdio (newline-delimited JSON), as per the
// Model Context Protocol spec.
//
// IDEs that support MCP (Cursor, Claude Desktop, Windsurf, Continue, Zed)
// add this server to their config and gain `vibehub_*` tools the agent can
// call to start sessions, stream messages, and attach them to commits.
//
// Config, persisted state, and SDK helpers live in shared.js; the tool
// definitions live in tools/. This file owns JSON-RPC I/O, dispatch, and
// the stdin main loop.

import { createInterface } from "node:readline";
import { VERSION, config, log } from "./shared.js";
import { TOOLS } from "./tools/index.js";

/* ---------------------------- JSON-RPC I/O ---------------------------- */

function send(message) {
  process.stdout.write(JSON.stringify(message) + "\n");
}

function reply(id, result) {
  send({ jsonrpc: "2.0", id, result });
}

function replyError(id, code, message, data) {
  send({ jsonrpc: "2.0", id, error: { code, message, data } });
}

/* ------------------------------ dispatch ----------------------------- */

async function handleRequest(req) {
  const { id, method, params } = req;
  try {
    switch (method) {
      case "initialize":
        return reply(id, {
          protocolVersion: params?.protocolVersion || "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "vibehub-mcp", version: VERSION },
        });

      case "notifications/initialized":
        // Notification — no response.
        return;

      case "tools/list":
        return reply(id, {
          tools: Object.entries(TOOLS).map(([name, t]) => ({
            name,
            description: t.description,
            inputSchema: t.inputSchema,
          })),
        });

      case "tools/call": {
        const name = params?.name;
        const args = params?.arguments || {};
        const tool = TOOLS[name];
        if (!tool) {
          return replyError(id, -32601, `Unknown tool: ${name}`);
        }
        try {
          const content = await tool.handler(args);
          return reply(id, { content });
        } catch (e) {
          // Surface the API's machine-readable code (token_expired,
          // insufficient_credits, …) so the calling agent can react to it.
          const code = e?.code ? ` [${e.code}]` : "";
          const hint =
            e?.code === "token_expired" || e?.code === "invalid_token"
              ? " Create a new token in VibeHub Settings → API tokens and update VIBEHUB_TOKEN."
              : "";
          return reply(id, {
            isError: true,
            content: [{ type: "text", text: `error${code}: ${e.message || e}${hint}` }],
          });
        }
      }

      case "ping":
        return reply(id, {});

      case "shutdown":
        reply(id, null);
        setTimeout(() => process.exit(0), 50);
        return;

      default:
        if (id !== undefined) {
          return replyError(id, -32601, `Unknown method: ${method}`);
        }
        // Unknown notification — ignore silently.
    }
  } catch (e) {
    log("error", `unhandled: ${e.stack || e.message || e}`);
    if (id !== undefined) replyError(id, -32603, String(e.message || e));
  }
}

/* ------------------------------ main loop ---------------------------- */

const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on("line", (line) => {
  if (!line.trim()) return;
  let msg;
  try {
    msg = JSON.parse(line);
  } catch (e) {
    log("error", `bad JSON: ${e.message}`);
    return;
  }
  handleRequest(msg);
});

rl.on("close", () => process.exit(0));
process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));

log("info", `vibehub-mcp v${VERSION} ready (apiUrl=${config.apiUrl})`);
