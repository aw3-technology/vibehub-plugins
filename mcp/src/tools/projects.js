// Project tools — list and create VibeHub projects (repos).

import { asText, requireSdk } from "../shared.js";

export const projectTools = {
  vibehub_whoami: {
    description:
      "Check the connection: confirms the API token works and returns the signed-in user plus when the token expires. Call this first if other tools fail with 401.",
    inputSchema: { type: "object", properties: {} },
    async handler() {
      const client = requireSdk();
      const r = await client.ping();
      return asText({ user: r.user, token: r.token, server: r.server });
    },
  },

  vibehub_list_projects: {
    description: "List the authenticated user's VibeHub projects (repos).",
    inputSchema: { type: "object", properties: {} },
    async handler() {
      const client = requireSdk();
      const { projects } = await client.listProjects();
      return asText({
        projects: projects.map((p) => ({ id: p.id, slug: p.slug, name: p.name })),
      });
    },
  },

  vibehub_create_project: {
    description: "Create (or reuse) a VibeHub project by name.",
    inputSchema: {
      type: "object",
      required: ["name"],
      properties: {
        name: { type: "string" },
        description: { type: "string" },
        visibility: { type: "string", enum: ["public", "private"] },
      },
    },
    async handler(args) {
      const client = requireSdk();
      const r = await client.createProject(args);
      return asText({ projectId: r.project.id, slug: r.project.slug, reused: r.reused });
    },
  },
};
