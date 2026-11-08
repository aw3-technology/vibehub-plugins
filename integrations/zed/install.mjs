#!/usr/bin/env node
// vibehub-zed install — merge the VibeHub MCP server into Zed's settings.json
// as a context server.

import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join, dirname } from "node:path";

const CONFIG_DIR =
  platform() === "win32"
    ? join(process.env.APPDATA || join(homedir(), "AppData", "Roaming"), "Zed")
    : join(homedir(), ".config", "zed");
const TARGET = join(CONFIG_DIR, "settings.json");
const BACKUP = TARGET + ".vibehub.bak";

const SERVER = {
  source: "custom",
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
    // Zed settings allow comments; a commented file won't JSON.parse. Tell
    // the user to merge manually rather than risk destroying their config.
    return JSON.parse(readFileSync(TARGET, "utf8"));
  } catch (e) {
    console.error(`Could not parse ${TARGET}: ${e.message}`);
    console.error(
      "Your Zed settings likely contain comments. Merge settings.template.json manually instead."
    );
    process.exit(1);
  }
}

function main() {
  const cfg = load();
  // Back up only once, so a second run can't overwrite the pristine original
  // with an already-modified copy.
  if (existsSync(TARGET) && !existsSync(BACKUP)) copyFileSync(TARGET, BACKUP);
  if (!cfg.context_servers || typeof cfg.context_servers !== "object") cfg.context_servers = {};
  const prior = cfg.context_servers.vibehub;
  const existed = !!prior;

  // Don't reset a working token back to the placeholder. If the shell has no
  // VIBEHUB_TOKEN but the user previously hand-edited a real one into the file,
  // keep theirs.
  const server = { ...SERVER, env: { ...SERVER.env } };
  const priorToken = prior?.env?.VIBEHUB_TOKEN;
  if (server.env.VIBEHUB_TOKEN === "vbh_REPLACE_ME" && priorToken && priorToken !== "vbh_REPLACE_ME") {
    server.env.VIBEHUB_TOKEN = priorToken;
  }
  cfg.context_servers.vibehub = server;

  mkdirSync(dirname(TARGET), { recursive: true });
  writeFileSync(TARGET, JSON.stringify(cfg, null, 2) + "\n");

  console.log(`✓ ${existed ? "updated" : "added"} vibehub context server in ${TARGET}`);
  if (server.env.VIBEHUB_TOKEN === "vbh_REPLACE_ME") {
    console.log(
      "\nSet VIBEHUB_TOKEN in your shell before re-running, OR edit the file and replace vbh_REPLACE_ME.\n" +
        "Tokens live in the VibeHub dashboard → Settings → API tokens."
    );
  }
  console.log("Restart Zed (or run `zed: reload`) to load the new context server.");
}

main();
