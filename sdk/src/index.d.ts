export type Role = "user" | "assistant" | "tool" | "system";

export interface Message {
  /** Present on messages read back from the server. */
  id?: string;
  /** Server-assigned order within the session. */
  sequence?: number;
  role: Role | string;
  content: string;
  toolName?: string | null;
  timestamp?: string | Date | null;
}

export interface Session {
  id: string;
  userId: string;
  projectId: string | null;
  commitId: string | null;
  source: string;
  client: string | null;
  externalId: string | null;
  status: "open" | "attached" | "orphaned";
  /** "live" sessions stay open across commits; everything else closes on attach. */
  kind: "commit" | "merge" | "rewrite" | "live";
  model: string | null;
  startedAt: string | null;
  endedAt: string | null;
  messageCount: number;
  summary: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Row shape returned by listSessions (a subset of Session). */
export type SessionSummary = Omit<Session, "userId" | "summary">;

export interface PingResult {
  ok: true;
  user: { id: string; name: string | null; username: string | null; plan: string | null };
  /** The calling token; expiresAt null means it never expires. */
  token: { prefix: string | null; expiresAt: string | null };
  server: { version: string; time: string };
}

export interface ApiToken {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt?: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface Balance {
  enabled: boolean;
  balance: number;
  cached: boolean;
  at?: string | null;
  /** True when the billing provider was unreachable and this is the last known value. */
  stale?: boolean;
}

export interface Project {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  visibility: string;
  createdAt: string;
}

export interface StartSessionInput {
  /** Required: where the conversation originated (e.g. "cursor", "claude-code", "windsurf"). */
  source: string;
  /** Optional: VibeHub project (repo) this session is scoped to. */
  projectId?: string;
  /** Optional: model identifier (e.g. "claude-opus-4"). */
  model?: string;
  /** Optional idempotency key — call again with the same value to get the same session. */
  externalId?: string;
  /** Optional human-readable summary. */
  summary?: string;
  /** Optional client identifier (defaults to the SDK user-agent). */
  client?: string;
  /** Optional ISO timestamp; defaults to now. */
  startedAt?: string | Date;
  /** "live" keeps the session open across attachToCommit calls. Default "commit". */
  kind?: "commit" | "merge" | "rewrite" | "live";
}

export interface AppendMessagesResult {
  added: number;
  total: number;
}

export interface AttachToCommitInput {
  sha: string;
  projectId?: string;
  parentSha?: string | null;
  message?: string;
  authorName?: string | null;
  authorEmail?: string | null;
  branch?: string | null;
  committedAt?: string | Date;
  diffStat?: string;
  diff?: string;
  filesChanged?: number;
  insertions?: number;
  deletions?: number;
}

export interface AttachToCommitResult {
  session: Session;
  commitId: string;
  reused: boolean;
  /** True for live sessions, which stay open after attaching. */
  live?: boolean;
}

export interface CaptureCommitInput {
  projectId: string;
  sha: string;
  parentSha?: string | null;
  message: string;
  authorName?: string | null;
  authorEmail?: string | null;
  branch?: string | null;
  committedAt: string | Date;
  diffStat?: string;
  diff?: string;
  filesChanged?: number;
  insertions?: number;
  deletions?: number;
  /**
   * Refresh the commit row + drop & re-insert the conversation if the commit
   * already exists. Used by `vb capture --kind rewrite` after amend/rebase.
   */
  replace?: boolean;
  conversation?: {
    source: string;
    /** commit (default), merge, rewrite, or live (open SDK session). */
    kind?: "commit" | "merge" | "rewrite" | "live";
    client?: string;
    externalId?: string;
    model?: string | null;
    summary?: string | null;
    startedAt?: string | null;
    endedAt?: string | null;
    messages: Message[];
  };
}

export interface CommitSummary {
  id: string;
  sha: string;
  message: string;
  committedAt: string;
  filesChanged: number;
  insertions: number;
  deletions: number;
  messageCount: number;
}

export interface Commit {
  id: string;
  projectId: string;
  sha: string;
  parentSha: string | null;
  message: string;
  authorName: string | null;
  authorEmail: string | null;
  branch: string | null;
  committedAt: string;
  diffStat: string | null;
  diff: string | null;
  filesChanged: number;
  insertions: number;
  deletions: number;
  createdAt: string;
}

export interface CommitConversation {
  id: string;
  commitId: string;
  source: string;
  client: string | null;
  status: "open" | "attached" | "orphaned";
  kind: "commit" | "merge" | "rewrite" | "live";
  model: string | null;
  startedAt: string | null;
  endedAt: string | null;
  messageCount: number;
  summary: string | null;
  blobUrl: string | null;
  blobBytes: number | null;
  messages: Message[];
}

export interface Branch {
  id: string;
  projectId: string;
  name: string;
  headSha: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export type MirrorProvider = "github" | "gitlab" | "bitbucket";

export interface Mirror {
  id: string;
  projectId: string;
  provider: MirrorProvider;
  /** Self-managed GitLab host; null for the provider's SaaS host. */
  host: string | null;
  /** git-over-HTTPS username; null means the provider default. */
  username: string | null;
  /** GitHub owner, GitLab namespace (may contain "/"), or Bitbucket workspace. */
  owner: string;
  repo: string;
  webUrl: string;
  defaultBranch: string;
  tokenPrefix: string | null;
  hasToken: boolean;
  token?: string;
  /** Authenticated push remote; only with `reveal=1`. */
  pushUrl?: string;
  hasWebhook: boolean;
  webhookSecret?: string;
  lastPushedSha: string | null;
  lastPushedAt: string | null;
  lastReceivedAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MirrorWebhookResult {
  mirror: Mirror;
  webhookSecret: string;
  payloadUrl: string;
  events: string[];
  /** The provider's webhook settings page, for manual registration. */
  settingsUrl: string;
  /** Present when `register: true` was passed. */
  registered?: { ok: boolean; id?: string | number | null; error?: string };
}

export interface MirrorAccessResult {
  provider: MirrorProvider;
  ok: boolean;
  /** null when the provider's API doesn't report push permission (Bitbucket). */
  canPush?: boolean | null;
  defaultBranch?: string | null;
  webUrl?: string;
  error?: string;
}

export interface BlameLine {
  lineNumber: number;
  text: string;
  sha: string | null;
  committedAt: string | null;
  authorName: string | null;
}

export interface CreateClientOptions {
  apiUrl: string;
  token: string;
  fetch?: typeof fetch;
  userAgent?: string;
  timeoutMs?: number;
}

export interface PingResult {
  ok: true;
  user: { id: string; name: string | null; username: string | null; plan: string | null };
  server: { version: string; time: string };
}

export interface VibeHubClient {
  /** Identity + health probe; throws VibeHubError on a missing or invalid token. */
  ping(): Promise<PingResult>;
  startSession(input: StartSessionInput): Promise<Session>;
  appendMessages(sessionId: string, messages: Message[]): Promise<AppendMessagesResult>;
  getSession(sessionId: string, opts?: { includeMessages?: boolean }): Promise<{ session: Session; messages: Message[] }>;
  listSessions(opts?: { status?: string; projectId?: string; limit?: number }): Promise<{ sessions: SessionSummary[] }>;
  updateSession(
    sessionId: string,
    patch: { summary?: string; endedAt?: string | Date; status?: "open" | "attached" | "orphaned" }
  ): Promise<{ session: Session }>;
  attachToCommit(sessionId: string, params: AttachToCommitInput): Promise<AttachToCommitResult>;
  /** On a repeat call for an existing sha (without `replace`) the server returns `reused: true` and no conversationId. */
  captureCommit(
    params: CaptureCommitInput
  ): Promise<{ commit: { id: string; sha: string }; conversationId?: string | null; reused?: boolean }>;
  createProject(input: { name: string; description?: string; visibility?: string }): Promise<{ project: Project; reused: boolean }>;
  listProjects(): Promise<{ projects: Project[] }>;

  /* commits & history */
  listCommits(opts: { projectId: string; limit?: number }): Promise<{ commits: CommitSummary[] }>;
  getCommit(opts: { sha: string; projectId: string }): Promise<{
    project: Project;
    commit: Commit;
    conversation: CommitConversation | null;
  }>;
  getCommitDiff(opts: { sha: string; projectId: string; path?: string }): Promise<
    | { sha: string; file: { aPath: string; bPath: string; diff: string } }
    | { sha: string; files: Array<{ aPath: string; bPath: string }> }
  >;
  getBlame(opts: { projectId: string; path: string; branch?: string }): Promise<{
    path: string;
    lines: BlameLine[];
    commits: Array<{ sha: string; committedAt: string; authorName: string | null }>;
  }>;

  /* branches */
  listBranches(opts: { projectId: string }): Promise<{ branches: Branch[] }>;
  upsertBranch(opts: {
    projectId: string;
    name: string;
    headSha?: string | null;
    isDefault?: boolean;
  }): Promise<{ branch: Branch; reused: boolean }>;
  updateBranch(
    branchId: string,
    patch: { name?: string; headSha?: string; isDefault?: boolean }
  ): Promise<{ branch: Branch }>;
  deleteBranch(branchId: string): Promise<{ ok: true }>;

  /* Git mirror (GitHub, GitLab, Bitbucket) */
  getMirror(opts: { projectId: string; revealWebhook?: boolean }): Promise<{ mirror: Mirror | null }>;
  setMirror(opts: {
    projectId: string;
    provider?: MirrorProvider;
    host?: string;
    username?: string;
    owner: string;
    repo: string;
    defaultBranch?: string;
    token?: string;
  }): Promise<{ mirror: Mirror }>;
  removeMirror(opts: { projectId: string }): Promise<{ ok: true }>;
  rotateMirrorWebhook(opts: { projectId: string; register?: boolean }): Promise<MirrorWebhookResult>;
  verifyMirror(opts: { projectId: string }): Promise<MirrorAccessResult>;

  /* tokens & billing */
  listTokens(): Promise<{ tokens: ApiToken[] }>;
  /** A token-authenticated call mints a child that never outlives the parent. */
  createToken(input: { name: string }): Promise<{ token: ApiToken; plaintext: string }>;
  revokeToken(tokenId: string): Promise<{ ok: true }>;
  getBalance(opts?: { fresh?: boolean }): Promise<Balance>;
}

export class VibeHubError extends Error {
  status?: number;
  body?: unknown;
  /** API error code, e.g. "token_expired", "invalid_token", "insufficient_credits", "not_found". */
  code?: string;
  constructor(message: string, opts?: { status?: number; body?: unknown });
}

export function createClient(opts: CreateClientOptions): VibeHubClient;
/** Trim trailing slashes and map vibehub.co (any scheme, trailing dot) to https://www.vibehub.co — the apex redirect drops the token. */
export function canonicalApiUrl(url: string): string;
export function createClientFromEnv(env?: Record<string, string | undefined>): VibeHubClient;
