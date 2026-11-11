#!/usr/bin/env node
// vibehub-cursor install — merge VibeHub MCP server into ~/.cursor/mcp.json.

import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";

const TARGET = join(homedir(), ".cursor", "mcp.json");
const BACKUP = TARGET + ".vibehub.bak";

// `--token vbh_…` / `--token=vbh_…`, so Windows shells (which have no
// `export`) don't need an env var.
function tokenArg() {
  const argv = process.argv.slice(2);
  const i = argv.findIndex((a) => a === "--token" || a.startsWith("--token="));
  if (i < 0) return null;
  return argv[i].includes("=") ? argv[i].slice("--token=".length) : argv[i + 1] || null;
}

// npx is a .cmd shim on Windows; editors that spawn MCP servers without a
// shell fail with ENOENT unless it goes through cmd.
const NPX =
  process.platform === "win32"
    ? { command: "cmd", args: ["/c", "npx", "-y", "vibehub-mcp"] }
    : { command: "npx", args: ["-y", "vibehub-mcp"] };

const SERVER = {
  ...NPX,
  env: {
    VIBEHUB_API_URL: process.env.VIBEHUB_API_URL || "https://www.vibehub.co",
    VIBEHUB_TOKEN: tokenArg() || process.env.VIBEHUB_TOKEN || "vbh_REPLACE_ME",
  },
};

function load() {
  if (!existsSync(TARGET)) return {};
  try {
    return JSON.parse(readFileSync(TARGET, "utf8").replace(/^\uFEFF/, ""));
  } catch (e) {
    console.error(`Could not parse ${TARGET}: ${e.message}`);
    process.exit(1);
  }
}

function main() {
  const cfg = load();
  if (existsSync(TARGET)) copyFileSync(TARGET, BACKUP);
  if (!cfg.mcpServers || typeof cfg.mcpServers !== "object") cfg.mcpServers = {};
  const existed = !!cfg.mcpServers.vibehub;
  cfg.mcpServers.vibehub = SERVER;

  mkdirSync(dirname(TARGET), { recursive: true });
  writeFileSync(TARGET, JSON.stringify(cfg, null, 2) + "\n");

  console.log(`✓ ${existed ? "updated" : "added"} vibehub MCP server in ${TARGET}`);
  if (SERVER.env.VIBEHUB_TOKEN === "vbh_REPLACE_ME") {
    console.log(
      "\nRe-run with --token vbh_… (or set VIBEHUB_TOKEN), OR edit the file and replace vbh_REPLACE_ME.\n" +
        "Tokens live in the VibeHub dashboard → Settings → API tokens."
    );
  }
  console.log("Restart Cursor to load the new MCP server.");
}

main();
