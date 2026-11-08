// VibeHub for VS Code (also works in Cursor, Windsurf, and other forks).
//
// Two capture paths:
//   1. Commits — a watcher on .git/logs/HEAD pushes every new commit
//      (message, diff, stats) to VibeHub automatically. Also available
//      on-demand via "VibeHub: Capture Last Commit".
//   2. Chats — "VibeHub: Capture Chat Transcript" imports a pasted or
//      clipboard transcript (Copilot Chat, Cursor chat, etc.) as a session.
//
// No dependencies: uses the editor's Node runtime (child_process for git,
// global fetch for HTTP, SecretStorage for the token).

const vscode = require("vscode");
const { execFile } = require("child_process");
const path = require("path");

const USER_AGENT = "vibehub-vscode/0.2.0";
const MAX_DIFF = 1_400_000; // server clamps at 1.5MB; stay under it
const TOKEN_KEY = "vibehub.token";

let statusItem;
let extContext;

/* ------------------------------- helpers ------------------------------- */

function config() {
  return vscode.workspace.getConfiguration("vibehub");
}

// The bare domain 308-redirects to www, and fetch drops the Authorization
// header on that cross-origin hop, so configs saved with "https://vibehub.co"
// would 401 on every call. Map it (and a trailing-dot form) to www.
function canonicalApiUrl(url) {
  const trimmed = String(url).replace(/\/+$/, "");
  try {
    const host = new URL(trimmed).hostname.replace(/\.$/, "");
    if (host === "vibehub.co" || host === "www.vibehub.co") return "https://www.vibehub.co";
  } catch {
    // not a URL; leave it for the caller's own error handling
  }
  return trimmed;
}

function apiUrl() {
  return canonicalApiUrl(config().get("apiUrl") || "https://www.vibehub.co");
}

async function getToken({ promptIfMissing = false } = {}) {
  let token = await extContext.secrets.get(TOKEN_KEY);
  if (!token) token = config().get("token") || process.env.VIBEHUB_TOKEN || "";
  if (!token && promptIfMissing) token = await setTokenCommand();
  return token || "";
}

async function setTokenCommand() {
  const token = await vscode.window.showInputBox({
    prompt: "Paste your VibeHub API token (dashboard → Settings → API tokens)",
    placeHolder: "vbh_…",
    ignoreFocusOut: true,
    password: true,
  });
  if (!token) return "";
  await extContext.secrets.store(TOKEN_KEY, token.trim());
  vscode.window.showInformationMessage("VibeHub: token saved to secret storage.");
  updateStatus();
  return token.trim();
}

async function api(method, apiPath, body) {
  const token = await getToken({ promptIfMissing: true });
  if (!token) throw new Error("no VibeHub token configured");
  const res = await fetch(apiUrl() + apiPath, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "User-Agent": USER_AGENT,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {}
  if (!res.ok) {
    const msg = (json && json.error) || text.slice(0, 200) || `HTTP ${res.status}`;
    throw new Error(`${method} ${apiPath} → ${res.status}: ${msg}`);
  }
  return json;
}

function git(repoRoot, args, maxBuffer = 16 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    execFile("git", args, { cwd: repoRoot, maxBuffer }, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout);
    });
  });
}

// From a changed `<root>/.git/logs/HEAD` path, recover the directory that
// contains `.git`. Handles nested repos/submodules in a monorepo; `git
// rev-parse` in captureCommit then normalizes it to the true toplevel.
function repoDirFromGitFile(fsPath) {
  const needle = `${path.sep}.git${path.sep}`;
  const idx = fsPath.lastIndexOf(needle);
  return idx === -1 ? null : fsPath.slice(0, idx);
}

/* ------------------------------ projects ------------------------------- */

// Project ids are cached per repo root in workspaceState; creation is
// idempotent server-side on (owner, slug) so re-resolving is always safe.
async function resolveProjectId(repoRoot) {
  const cacheKey = `vibehub.projectId:${repoRoot}`;
  const cached = extContext.workspaceState.get(cacheKey);
  if (cached) return cached;

  const name = config().get("projectName") || path.basename(repoRoot);
  const r = await api("POST", "/api/cli/projects", { name });
  const id = r?.project?.id || r?.id;
  if (!id) throw new Error("could not resolve VibeHub project id");
  await extContext.workspaceState.update(cacheKey, id);
  return id;
}

/* ------------------------------- commits ------------------------------- */

async function captureCommit(dir, { notify } = {}) {
  // Normalize whatever directory we were handed to the real repo toplevel.
  // This also fails cleanly (rejects) for a dir that isn't inside a repo, or
  // a repo with no commits yet (rev-parse HEAD throws on an unborn branch).
  let repoRoot;
  try {
    repoRoot = (await git(dir, ["rev-parse", "--show-toplevel"])).trim();
  } catch {
    repoRoot = dir;
  }
  const sha = (await git(repoRoot, ["rev-parse", "HEAD"])).trim();
  const lastKey = `vibehub.lastSha:${repoRoot}`;
  if (!notify && extContext.workspaceState.get(lastKey) === sha) return null;

  const message = (await git(repoRoot, ["log", "-1", "--format=%B"])).trim();
  const committedAt = (await git(repoRoot, ["log", "-1", "--format=%cI"])).trim();
  const branch = (await git(repoRoot, ["branch", "--show-current"])).trim() || undefined;
  const parentSha =
    (await git(repoRoot, ["log", "-1", "--format=%P"])).trim().split(/\s+/)[0] || undefined;

  // `-m --first-parent` is the key bit: plain `git show` emits an EMPTY patch
  // for merge commits, which would silently upload a merge with no diff. This
  // shows the diff against the first parent for merges and behaves normally for
  // ordinary commits. Guarded so an over-large/odd commit still captures
  // metadata + stats instead of failing the whole push.
  let diff = "";
  try {
    diff = await git(repoRoot, ["show", "--format=", "--patch", "-m", "--first-parent", sha]);
    if (diff.length > MAX_DIFF) diff = diff.slice(0, MAX_DIFF) + "\n… (truncated by vibehub-vscode)";
  } catch (e) {
    diff = `… (diff omitted: ${e.message})`;
  }
  const shortstat = await git(repoRoot, ["show", "--format=", "--shortstat", "-m", "--first-parent", sha]);
  const stat = (re) => {
    const m = shortstat.match(re);
    return m ? parseInt(m[1], 10) : 0;
  };

  const projectId = await resolveProjectId(repoRoot);
  const r = await api("POST", "/api/cli/commits", {
    projectId,
    sha,
    message,
    committedAt,
    branch,
    parentSha,
    diff,
    filesChanged: stat(/(\d+) files? changed/),
    insertions: stat(/(\d+) insertions?/),
    deletions: stat(/(\d+) deletions?/),
  });
  await extContext.workspaceState.update(lastKey, sha);
  if (notify) {
    vscode.window.showInformationMessage(`VibeHub: captured ${sha.slice(0, 7)} — ${message.split("\n")[0]}`);
  }
  return r;
}

function repoRootOfWorkspace() {
  const folder = vscode.workspace.workspaceFolders?.[0];
  return folder ? folder.uri.fsPath : null;
}

async function captureLastCommitCommand() {
  const repoRoot = repoRootOfWorkspace();
  if (!repoRoot) {
    vscode.window.showWarningMessage("VibeHub: open a folder with a git repo first.");
    return;
  }
  try {
    await captureCommit(repoRoot, { notify: true });
  } catch (e) {
    vscode.window.showErrorMessage(`VibeHub: ${e.message}`);
  }
}

function watchCommits(context) {
  // .git/logs/HEAD is appended on every commit, merge, and checkout — cheap
  // to watch and fork-agnostic (no dependency on the bundled git extension).
  const watcher = vscode.workspace.createFileSystemWatcher("**/.git/logs/HEAD");
  const onChange = async (uri) => {
    if (!config().get("autoCaptureCommits")) return;
    const token = await getToken();
    if (!token) return; // never prompt from a background watcher
    const repoDir = repoDirFromGitFile(uri.fsPath);
    if (!repoDir) return;
    try {
      const r = await captureCommit(repoDir);
      if (r) updateStatus("captured");
    } catch (e) {
      console.error(`[vibehub] auto-capture failed: ${e.message}`);
    }
  };
  watcher.onDidChange(onChange);
  watcher.onDidCreate(onChange);
  context.subscriptions.push(watcher);
}

/* -------------------------------- chats -------------------------------- */

function detectSource() {
  const app = (vscode.env.appName || "").toLowerCase();
  if (app.includes("cursor")) return "cursor";
  if (app.includes("windsurf")) return "windsurf";
  return "copilot";
}

async function captureChatCommand() {
  // Editors don't expose chat history programmatically yet, so we import a
  // pasted (or copied) transcript. "You:/Assistant:" style prefixes are split
  // into turns; anything else becomes a single user message.
  const pasted = await vscode.window.showInputBox({
    prompt: "Paste the chat transcript (leave blank to use clipboard)",
    ignoreFocusOut: true,
  });
  let transcript = pasted || (await vscode.env.clipboard.readText());
  if (!transcript || !transcript.trim()) {
    vscode.window.showWarningMessage("VibeHub: nothing to capture.");
    return;
  }

  const messages = transcript
    .split(/\n(?=\s*(?:You:|User:|Me:|Copilot:|Cursor:|Assistant:|AI:))/g)
    .map((chunk) => {
      const m = chunk.match(/^\s*(You|User|Me|Copilot|Cursor|Assistant|AI):\s*([\s\S]*)$/i);
      if (!m) return { role: "user", content: chunk.trim() };
      const role = /copilot|cursor|assistant|ai/i.test(m[1]) ? "assistant" : "user";
      return { role, content: m[2].trim() };
    })
    .filter((m) => m.content);

  try {
    const r = await api("POST", "/api/integrations/import", {
      source: detectSource(),
      summary: vscode.workspace.name || "IDE chat",
      messages,
    });
    vscode.window.showInformationMessage(`VibeHub: imported ${r?.added || messages.length} turns.`);
  } catch (e) {
    vscode.window.showErrorMessage(`VibeHub: ${e.message}`);
  }
}

/* ------------------------------ misc cmds ------------------------------ */

async function testConnectionCommand() {
  try {
    const r = await api("GET", "/api/sdk/ping");
    const who = r?.user?.username || r?.user?.email || "ok";
    vscode.window.showInformationMessage(`VibeHub: connected as ${who}.`);
  } catch (e) {
    vscode.window.showErrorMessage(`VibeHub: ${e.message}`);
  }
}

function openDashboardCommand() {
  vscode.env.openExternal(vscode.Uri.parse(apiUrl() + "/dashboard"));
}

async function updateStatus(event) {
  if (!statusItem) return;
  if (event === "captured") {
    statusItem.text = "$(check) VibeHub";
    statusItem.tooltip = "VibeHub: commit captured";
    statusItem.show();
    setTimeout(() => updateStatus(), 4000);
    return;
  }
  // Surface the "no token → silently capturing nothing" state instead of
  // looking healthy while dropping every commit.
  const hasToken = !!(await getToken());
  statusItem.text = hasToken ? "$(cloud-upload) VibeHub" : "$(warning) VibeHub";
  statusItem.tooltip = hasToken
    ? "VibeHub: capturing commits and chats — click to test connection"
    : "VibeHub: no API token set — click to add one (capture is disabled)";
  statusItem.command = hasToken ? "vibehub.testConnection" : "vibehub.setToken";
  statusItem.show();
}

/* ------------------------------ lifecycle ------------------------------ */

function activate(context) {
  extContext = context;

  statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 80);
  statusItem.command = "vibehub.testConnection";
  updateStatus();
  context.subscriptions.push(statusItem);

  context.subscriptions.push(
    vscode.commands.registerCommand("vibehub.setToken", setTokenCommand),
    vscode.commands.registerCommand("vibehub.testConnection", testConnectionCommand),
    vscode.commands.registerCommand("vibehub.captureLastCommit", captureLastCommitCommand),
    vscode.commands.registerCommand("vibehub.captureChat", captureChatCommand),
    vscode.commands.registerCommand("vibehub.openDashboard", openDashboardCommand),
    // Back-compat with the old Copilot-only extension id.
    vscode.commands.registerCommand("vibehub.capture", captureChatCommand)
  );

  watchCommits(context);
}

function deactivate() {}

module.exports = { activate, deactivate };
