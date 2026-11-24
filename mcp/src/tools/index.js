// The full tool registry, merged from the per-domain modules.
// Each tool: { name, description, inputSchema, handler(args) -> result }
// `result` becomes the `content` array on tools/call responses.
//
// Merge order matters: it determines the order tools appear in tools/list.

import { sessionTools } from "./session.js";
import { projectTools } from "./projects.js";
import { commitTools } from "./commits.js";
import { branchTools } from "./branches.js";
import { mirrorTools } from "./mirror.js";

export const TOOLS = {
  ...sessionTools,
  ...projectTools,
  ...commitTools,
  ...branchTools,
  ...mirrorTools,
};
