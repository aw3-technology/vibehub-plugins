#!/usr/bin/env node
// vibehub-windsurf install — merge VibeHub MCP into ~/.codeium/windsurf/mcp_config.json.

import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";

const TARGET = join(homedir(), ".codeium", "windsurf", "mcp_config.json");
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
  console.log("Restart Windsurf, then refresh MCP in Cascade.");
}

main();
