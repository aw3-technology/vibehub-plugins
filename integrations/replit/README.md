# vibehub-replit

Captures every Replit commit (and the Agent log when present) into VibeHub.

## Install

In the Replit shell:

```bash
# Add VIBEHUB_TOKEN under Tools → Secrets first.
curl -sSL https://www.vibehub.co/integrations/replit/setup.sh | bash
```

After that, every `git commit` (including ones the Replit Agent makes) is
mirrored to VibeHub. The commit appears under **Vibes** in the dashboard;
the conversation appears under **Runs**.

## What it captures

- The diff + stats (files changed, +/-)
- The commit message
- `.replit-agent.log` (or `.replit/agent.log`) if it exists — the last 50KB
- A new VibeHub project named after `REPL_SLUG` (or the git remote)

> Source: the served `setup.sh` and `post-commit.mjs` live in `public/integrations/replit/` (deployed to the URLs above).
