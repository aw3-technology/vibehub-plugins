# Changelog

All notable changes to `vibehub-mcp`. The package follows
[Semantic Versioning](https://semver.org/): while it is `0.x`, a minor bump
may break callers and a patch bump never does. Tool names are part of the
public surface — renaming or removing a tool is a breaking change.

CI (`scripts/check-package-versions.mjs`) fails a change to `mcp/src/` that
doesn't bump `version` in `package.json` (and the matching versions in
`server.json`) and add a `## <version>` section here.

## Unreleased

- No changes yet.

## 0.3.1 — 2026-11-24

- Depends on `vibehub-sdk` `^0.3.1`, the SDK's published name (it was
  `@vibehub/sdk`, which was never published). No tool changes.

## 0.3.0 — 2026-11-12

- Mirrors on GitLab and Bitbucket as well as GitHub: `vibehub_set_mirror`
  takes `provider`, `host` and `username`.
- New tool `vibehub_verify_mirror`.
- `vibehub_rotate_mirror_webhook` takes `register` and returns the provider's
  events and settings URL.
- Requires `@vibehub/sdk` `^0.3.0`.

## 0.2.0 — 2026-11-08

- New tools: `vibehub_whoami`, `vibehub_list_sessions`.
- Live sessions stay current after attaching to a commit.
- Server error codes are surfaced in tool errors.
- Depends on `@vibehub/sdk` `^0.2.0` from npm instead of `file:../sdk`, so the
  package can be published.

## 0.1.0 — 2026-06-02

- First release: session, commit and project tools over stdio.
