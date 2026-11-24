// Mirror tools — read/write the git mirror config (GitHub, GitLab or
// Bitbucket), check its token, and rotate/register the inbound webhook.

import { asText, config, requireSdk } from "../shared.js";

export const mirrorTools = {
  vibehub_get_mirror: {
    description:
      "Read the git mirror config for a project. Returns the provider (github, gitlab or bitbucket), owner/repo, default branch, last push/receive timestamps, and the most recent push error (if any).",
    inputSchema: {
      type: "object",
      required: ["projectId"],
      properties: { projectId: { type: "string" } },
    },
    async handler(args) {
      const client = requireSdk();
      const r = await client.getMirror(args);
      return asText(r);
    },
  },

  vibehub_set_mirror: {
    description:
      "Configure (or update) the git mirror on GitHub, GitLab or Bitbucket. Token is stored AES-256-GCM encrypted server-side. Omit token to keep the existing one (switching provider or host drops it).",
    inputSchema: {
      type: "object",
      required: ["projectId", "owner", "repo"],
      properties: {
        projectId: { type: "string" },
        provider: { type: "string", enum: ["github", "gitlab", "bitbucket"], default: "github" },
        host: { type: "string", description: "Self-managed GitLab host, e.g. gitlab.example.com." },
        username: {
          type: "string",
          description: "git-over-HTTPS username, only for Bitbucket app passwords or similar.",
        },
        owner: {
          type: "string",
          description: "GitHub owner, GitLab namespace (group/subgroup), or Bitbucket workspace.",
        },
        repo: { type: "string" },
        defaultBranch: { type: "string" },
        token: {
          type: "string",
          description:
            "Access token with repo write access (GitHub PAT, GitLab write_repository, Bitbucket repository:write).",
        },
      },
    },
    async handler(args) {
      const client = requireSdk();
      const r = await client.setMirror(args);
      return asText({ mirror: r.mirror });
    },
  },

  vibehub_rotate_mirror_webhook: {
    description:
      "Generate (or rotate) the inbound webhook secret for a project's mirror. Returns the plaintext secret exactly once — register it in the provider's webhook settings (settingsUrl) with the payload URL. Pass register: true to have VibeHub create the webhook through the provider's API (needs a token with webhook scope).",
    inputSchema: {
      type: "object",
      required: ["projectId"],
      properties: {
        projectId: { type: "string" },
        register: { type: "boolean", default: false },
      },
    },
    async handler(args) {
      const client = requireSdk();
      const r = await client.rotateMirrorWebhook(args);
      const webhookPath = `/api/cli/mirrors/webhook?project_id=${encodeURIComponent(args.projectId)}`;
      const url = r.payloadUrl || config.apiUrl.replace(/\/$/, "") + webhookPath;
      return asText({
        webhookSecret: r.webhookSecret,
        payloadUrl: url,
        contentType: "application/json",
        events: r.events || ["push", "pull_request"],
        settingsUrl: r.settingsUrl,
        registered: r.registered,
      });
    },
  },

  vibehub_verify_mirror: {
    description:
      "Check that the stored mirror token can reach the repo on its provider (GitHub, GitLab or Bitbucket) and, where the provider reports it, push to it.",
    inputSchema: {
      type: "object",
      required: ["projectId"],
      properties: { projectId: { type: "string" } },
    },
    async handler(args) {
      const client = requireSdk();
      return asText(await client.verifyMirror(args));
    },
  },
};
