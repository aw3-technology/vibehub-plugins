// vibehub-vscode — minimal VS Code extension that captures GitHub Copilot
// Chat into VibeHub.
//
// VS Code's chat API surfaces a `vscode.chat.onDidReceiveFeedback` / chat
// participant API but ALSO writes the rolling chat history to a JSON file
// under the workspace storage. We follow the simpler path here: register a
// command `vibehub.capture` that the user runs from the Copilot Chat panel
// to push the currently-open chat into VibeHub.
//
// This file is the extension entry point; package.json wires it as `main`.

const vscode = require("vscode");
const https = require("https");

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

function postJSON(apiUrl, path, token, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(apiUrl.replace(/\/$/, "") + path);
    const data = JSON.stringify(body);
    const req = https.request(
      {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data),
          Authorization: `Bearer ${token}`,
          "User-Agent": "vibehub-vscode/0.1.0",
        },
      },
      (res) => {
        let buf = "";
        res.on("data", (c) => (buf += c));
        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try { resolve(JSON.parse(buf)); } catch { resolve(buf); }
          } else {
            reject(new Error(`${res.statusCode}: ${buf.slice(0, 200)}`));
          }
        });
      }
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

async function captureCurrentChat() {
  const config = vscode.workspace.getConfiguration("vibehub");
  const apiUrl = canonicalApiUrl(config.get("apiUrl") || "https://www.vibehub.co");
  let token = config.get("token") || process.env.VIBEHUB_TOKEN;
  if (!token) {
    token = await vscode.window.showInputBox({
      prompt: "Paste your VibeHub token (Settings → API tokens)",
      ignoreFocusOut: true,
      password: true,
    });
    if (!token) return;
    await config.update("token", token, vscode.ConfigurationTarget.Global);
  }

  // VS Code's chat panel doesn't expose history programmatically yet, so we
  // ask the user to paste it. The bookmarklet pattern keeps parity with
  // v0/Lovable/Bolt. When the chat API surfaces real history we'll swap
  // this for a direct read.
  const pasted = await vscode.window.showInputBox({
    prompt: "Paste the Copilot Chat transcript (or leave blank to use clipboard)",
    ignoreFocusOut: true,
  });
  let transcript = pasted;
  if (!transcript) {
    transcript = await vscode.env.clipboard.readText();
  }
  if (!transcript || !transcript.trim()) {
    vscode.window.showWarningMessage("VibeHub: nothing to capture.");
    return;
  }

  const messages = transcript
    .split(/\n(?=\s*(?:You:|Copilot:|User:|Assistant:))/g)
    .map((chunk) => {
      const m = chunk.match(/^\s*(You|User|Copilot|Assistant):\s*([\s\S]*)$/i);
      if (!m) return { role: "user", content: chunk.trim() };
      const r = /copilot|assistant/i.test(m[1]) ? "assistant" : "user";
      return { role: r, content: m[2].trim() };
    })
    .filter((m) => m.content);

  try {
    const r = await postJSON(apiUrl, "/api/integrations/import", token, {
      source: "copilot",
      summary: vscode.workspace.name || "Copilot chat",
      messages,
    });
    vscode.window.showInformationMessage(`VibeHub: imported ${r.added || messages.length} turns.`);
  } catch (e) {
    vscode.window.showErrorMessage(`VibeHub: ${e.message}`);
  }
}

function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand("vibehub.capture", captureCurrentChat)
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
