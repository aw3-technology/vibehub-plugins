// Branch tools — list and upsert the branches VibeHub tracks for a project.

import { asText, requireSdk } from "../shared.js";

export const branchTools = {
  vibehub_list_branches: {
    description: "List the branches VibeHub knows about for a project, with their head shas.",
    inputSchema: {
      type: "object",
      required: ["projectId"],
      properties: { projectId: { type: "string" } },
    },
    async handler(args) {
      const client = requireSdk();
      const r = await client.listBranches(args);
      return asText({ branches: r.branches });
    },
  },

  vibehub_upsert_branch: {
    description:
      "Create or update a tracked branch row. Pass `headSha` to advance the head, or `isDefault: true` to swap the project's default branch.",
    inputSchema: {
      type: "object",
      required: ["projectId", "name"],
      properties: {
        projectId: { type: "string" },
        name: { type: "string" },
        headSha: { type: "string" },
        isDefault: { type: "boolean" },
      },
    },
    async handler(args) {
      const client = requireSdk();
      const r = await client.upsertBranch(args);
      return asText(r);
    },
  },
};
