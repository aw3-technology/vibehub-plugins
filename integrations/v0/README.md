# vibehub for v0

v0.dev runs server-side and doesn't ship a local SDK — so we capture from
the page itself with a bookmarklet.

## Install the bookmarklet

Drag this link into your bookmarks bar:

```
javascript:(async()=>{await import('https://www.vibehub.co/integrations/v0/bookmarklet.js')})();
```

On a v0 chat page, click it. First run will prompt you for a VibeHub token
(stored in `localStorage` per-origin). Subsequent clicks just import.

## What gets captured

- Every visible user/assistant turn on the page
- The page title as the run summary
- The v0 chat id (URL path tail) as the idempotency key — re-running on
  the same chat updates the same VibeHub run rather than duplicating

> Source: the served bookmarklet lives at `public/integrations/v0/bookmarklet.js` (deployed to the URL above).
