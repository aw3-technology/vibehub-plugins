# vibehub for v0 (planned)

Capturing v0 chats into VibeHub is planned, not available yet.

The first version was a bookmarklet that scraped the chat and POSTed it to
the VibeHub API. It couldn't work: v0.dev blocks requests to other sites
(v0 and Lovable restrict `connect-src` in their Content-Security-Policy, and
Lovable only runs scripts that carry its nonce), and Lovable and Bolt set
`Cross-Origin-Opener-Policy: same-origin`, which rules out a popup handoff.
It also asked you to paste your VibeHub token into the v0 page, where any
script on that page could read it.

The planned design is a self-contained bookmarklet that submits the scraped
chat to a new VibeHub tab, where you review it and import it with your
VibeHub login. Your token never touches the v0 page.

Until then, use the [Claude Code plugin](../claude-code) or the `vb` CLI for
work you do outside v0.
