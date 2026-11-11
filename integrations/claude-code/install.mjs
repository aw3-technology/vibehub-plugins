#!/usr/bin/env node
// vibehub-claude-code install
//
// Merges VibeHub hook entries into the user's ~/.claude/settings.json without
// clobbering existing hooks. Safe to re-run.

import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE_HOOK = resolve(HERE, "hook.mjs");
// Run via npx, HERE is npm's cache, which npm may clear; hooks pointing there
// would silently stop. Copy the hook somewhere stable and point at that.
const HOOK_PATH = join(homedir(), ".vibehub", "claude-code", "hook.mjs");

const SETTINGS_PATH = join(homedir(), ".claude", "settings.json");
const BACKUP_PATH = SETTINGS_PATH + ".vibehub.bak";

// Quote the path: install dirs can contain spaces (e.g. ~/My Projects/…),
// which would otherwise split into separate shell args and break the hook.
const HOOK_COMMAND = `node "${HOOK_PATH}"`;
const EVENTS = ["SessionStart", "UserPromptSubmit", "Stop", "SubagentStop", "PostToolUse", "SessionEnd"];

function loadSettings() {
  if (!existsSync(SETTINGS_PATH)) return {};
  try {
    return JSON.parse(readFileSync(SETTINGS_PATH, "utf8").replace(/^\uFEFF/, ""));
  } catch (e) {
    console.error(`Could not parse ${SETTINGS_PATH}: ${e.message}`);
    console.error("Fix it manually or delete it, then re-run.");
    process.exit(1);
  }
}

function backup() {
  if (!existsSync(SETTINGS_PATH)) return;
  copyFileSync(SETTINGS_PATH, BACKUP_PATH);
}

function ensureHookEntry(hooks, event) {
  if (!Array.isArray(hooks[event])) hooks[event] = [];
  // Each entry is {matcher?, hooks: [{type, command}]}. We use one matcher-less
  // entry per event so the hook fires unconditionally.
  // Match on the hook path, not the exact command string, so re-running after
  // an older (unquoted) install — or alongside the plugin form — doesn't append
  // a duplicate entry that would make every event fire twice.
  // Older installs pointed at the npx cache copy; repoint those in place.
  const ours = (c) =>
    typeof c === "string" && (c.includes(HOOK_PATH) || /vibehub-claude-code[\\/].*hook\.mjs/.test(c));
  for (const e of hooks[event]) {
    for (const h of Array.isArray(e?.hooks) ? e.hooks : []) {
      if (ours(h?.command)) {
        h.command = HOOK_COMMAND;
        return false;
      }
    }
  }
  hooks[event].push({
    hooks: [{ type: "command", command: HOOK_COMMAND }],
  });
  return true;
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log(
      `vibehub-claude-code install — wire VibeHub session capture into Claude Code.\n\n` +
        `Reads/writes ${SETTINGS_PATH}. A .vibehub.bak copy is saved before the first edit.\n\n` +
        `Then set environment variables in the same settings.json env block:\n` +
        `  VIBEHUB_API_URL  (default https://www.vibehub.co)\n` +
        `  VIBEHUB_TOKEN    (from Settings → API tokens in the dashboard)\n`
    );
    process.exit(0);
  }

  const settings = loadSettings();
  backup();
  mkdirSync(dirname(HOOK_PATH), { recursive: true });
  copyFileSync(SOURCE_HOOK, HOOK_PATH);

  if (!settings.hooks || typeof settings.hooks !== "object") settings.hooks = {};
  let added = 0;
  for (const event of EVENTS) {
    if (ensureHookEntry(settings.hooks, event)) added++;
  }

  mkdirSync(dirname(SETTINGS_PATH), { recursive: true });
  writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2) + "\n");

  console.log(`✓ installed the hook at ${HOOK_PATH}`);
  console.log(`✓ wrote ${SETTINGS_PATH}`);
  console.log(`✓ added ${added} new hook entr${added === 1 ? "y" : "ies"} (existing left untouched)`);
  if (!process.env.VIBEHUB_TOKEN) {
    console.log(
      "\nNext step: set VIBEHUB_TOKEN. Generate one in the VibeHub dashboard → Settings → API tokens,\n" +
        "then add it to the env block in settings.json (works in every shell, including Windows):\n" +
        '  "env": { "VIBEHUB_TOKEN": "vbh_…", "VIBEHUB_API_URL": "https://www.vibehub.co" }'
    );
  }
}

main();
