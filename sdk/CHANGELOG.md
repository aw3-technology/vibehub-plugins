# Changelog

All notable changes to `vibehub-sdk`. The package follows
[Semantic Versioning](https://semver.org/): while it is `0.x`, a minor bump
may break callers and a patch bump never does.

CI (`scripts/check-package-versions.mjs`) fails a change to `sdk/src/` that
doesn't bump `version` in `package.json` and add a matching `## <version>`
section here.

## Unreleased

- No changes yet.

## 0.3.1 — 2026-11-24

- Renamed from `@vibehub/sdk` to `vibehub-sdk`, the name it is first
  published under on npm. The `@vibehub` npm scope isn't ours. No API changes;
  the default user agent is now `vibehub-sdk/<version>`.

## 0.3.0 — 2026-11-12

- Mirrors on GitLab (gitlab.com or self-managed) and Bitbucket Cloud as well
  as GitHub: `setMirror` takes `provider`, `host` and `username`; `Mirror`
  carries `provider`, `host`, `username`, `webUrl` and (with `reveal`)
  `pushUrl`.
- `verifyMirror({ projectId })` checks the stored token can reach the repo.
- `rotateMirrorWebhook({ projectId, register: true })` also creates the
  webhook on the provider through its API; the result carries `payloadUrl`,
  `events`, `settingsUrl` and `registered`.
- Types: `PingResult` and `canonicalApiUrl` are now declared in `index.d.ts`
  (both already existed at runtime).
- Docs: `getBalance` notes that commit capture is free.

## 0.2.0 — 2026-11-08

- Default API URL is `https://www.vibehub.co`; `canonicalApiUrl` rewrites the
  `vibehub.co` apex, whose redirect dropped the `Authorization` header.
- `VibeHubError.code` carries the server's machine-readable error code
  (`missing_token`, `invalid_token`, `token_expired`, `insufficient_credits`, …).
- New methods for tokens, balance, and branch update/delete.
- Fix: `removeMirror` sends `projectId` in the body, where the server reads it.
- Types synced with the API.

## 0.1.0 — 2026-06-02

- First release: `createClient`, sessions (`startSession`, `appendMessages`,
  `attachToCommit`), one-shot `captureCommit`, projects and commits.
