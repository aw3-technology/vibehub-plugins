#!/usr/bin/env node
// vibehub-cursor install — merge VibeHub MCP server into ~/.cursor/mcp.json.

import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";

const TARGET = join(homedir(), ".cursor", "mcp.json");
const BACKUP = TARGET + ".vibehub.bak";

const SERVER = {
  command: "npx",
  args: ["-y", "vibehub-mcp"],
  env: {
    VIBEHUB_API_URL: process.env.VIBEHUB_API_URL || "https://www.vibehub.co",
    VIBEHUB_TOKEN: process.env.VIBEHUB_TOKEN || "vbh_REPLACE_ME",
  },
};

function load() {
  if (!existsSync(TARGET)) return {};
  try {
    return JSON.parse(readFileSync(TARGET, "utf8"));
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
      "\nSet VIBEHUB_TOKEN in your shell before re-running, OR edit the file and replace vbh_REPLACE_ME.\n" +
        "Tokens live in the VibeHub dashboard → Settings → API tokens."
    );
  }
  console.log("Restart Cursor to load the new MCP server.");
}

main();
