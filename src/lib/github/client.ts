import { Octokit } from "octokit";

export type TokenInfo = {
  login: string;
  name: string | null;
  avatarUrl: string;
  scopes: string[];
};

export function createOctokit(token: string) {
  if (!token) throw new Error("GitHub token is required");
  return new Octokit({ auth: token });
}

export async function getViewer(token: string): Promise<TokenInfo> {
  const octokit = createOctokit(token);
  const resp = await octokit.rest.users.getAuthenticated();
  const scopesHeader = (resp as unknown as { headers: Record<string, string> }).headers;
  return {
    login: resp.data.login,
    name: resp.data.name,
    avatarUrl: resp.data.avatar_url,
    scopes: scopesHeader?.["x-oauth-scopes"]
      ? scopesHeader["x-oauth-scopes"].split(",").map((s) => s.trim())
      : [],
  };
}

export type OrgInfo = {
  login: string;
  name: string | null;
  description: string | null;
  avatarUrl: string;
  url: string;
  publicRepos: number;
  followers: number;
};

export async function getOrg(token: string, org: string): Promise<OrgInfo> {
  const octokit = createOctokit(token);
  const { data } = await octokit.rest.orgs.get({ org });
  return {
    login: data.login,
    name: data.name,
    description: data.description,
    avatarUrl: data.avatar_url,
    url: data.html_url,
    publicRepos: data.public_repos,
    followers: data.followers,
  };
}

export async function getUser(token: string, username: string): Promise<OrgInfo> {
  const octokit = createOctokit(token);
  const { data } = await octokit.rest.users.getByUsername({ username });
  return {
    login: data.login,
    name: data.name,
    description: data.bio,
    avatarUrl: data.avatar_url,
    url: data.html_url,
    publicRepos: data.public_repos,
    followers: data.followers,
  };
}

export type RepoInfo = {
  id: number;
  name: string;
  fullName: string;
  description: string | null;
  language: string | null;
  languages: string[];
  stars: number;
  forks: number;
  updatedAt: string;
  defaultBranch: string;
  url: string;
  isArchived: boolean;
  isFork: boolean;
  size: number;
  topics: string[];
};

export async function listOrgRepos(token: string, org: string): Promise<RepoInfo[]> {
  const octokit = createOctokit(token);
  const repos: RepoInfo[] = [];
  let page = 1;
  while (true) {
    const { data } = await octokit.rest.repos.listForOrg({
      org,
      per_page: 100,
      page,
      type: "sources",
    });
    if (data.length === 0) break;
    for (const r of data) {
      repos.push({
        id: r.id,
        name: r.name,
        fullName: r.full_name,
        description: r.description,
        language: r.language,
        languages: r.language ? [r.language] : [],
        stars: r.stargazers_count,
        forks: r.forks_count,
        updatedAt: r.updated_at,
        defaultBranch: r.default_branch,
        url: r.html_url,
        isArchived: r.archived,
        isFork: r.fork,
        size: r.size,
        topics: r.topics ?? [],
      });
    }
    if (data.length < 100) break;
    page++;
    if (page > 20) break;
  }
  return repos;
}

export async function listUserRepos(token: string, username: string): Promise<RepoInfo[]> {
  const octokit = createOctokit(token);
  const repos: RepoInfo[] = [];
  let page = 1;
  while (true) {
    const { data } = await octokit.rest.repos.listForUser({
      username,
      per_page: 100,
      page,
      type: "owner",
    });
    if (data.length === 0) break;
    for (const r of data) {
      repos.push({
        id: r.id,
        name: r.name,
        fullName: r.full_name,
        description: r.description,
        language: r.language,
        languages: r.language ? [r.language] : [],
        stars: r.stargazers_count,
        forks: r.forks_count,
        updatedAt: r.updated_at,
        defaultBranch: r.default_branch,
        url: r.html_url,
        isArchived: r.archived,
        isFork: r.fork,
        size: r.size,
        topics: r.topics ?? [],
      });
    }
    if (data.length < 100) break;
    page++;
    if (page > 20) break;
  }
  return repos;
}

export async function listRepoBranches(
  token: string,
  owner: string,
  repo: string
): Promise<{ name: string; sha: string; protected: boolean }[]> {
  const octokit = createOctokit(token);
  const { data } = await octokit.rest.repos.listBranches({
    owner,
    repo,
    per_page: 100,
  });
  return data.map((b) => ({
    name: b.name,
    sha: b.commit.sha,
    protected: !!b.protected,
  }));
}

export type CommitInfo = {
  sha: string;
  message: string;
  author: string;
  authorLogin: string | null;
  authorAvatar: string | null;
  date: string;
  additions: number;
  deletions: number;
  files: { filename: string; status: string; additions: number; deletions: number; changes: number }[];
};

export async function listCommits(
  token: string,
  owner: string,
  repo: string,
  opts: { branch?: string; since?: string; per_page?: number; page?: number } = {}
): Promise<CommitInfo[]> {
  const octokit = createOctokit(token);
  const { data } = await octokit.rest.repos.listCommits({
    owner,
    repo,
    sha: opts.branch,
    since: opts.since,
    per_page: opts.per_page ?? 100,
    page: opts.page ?? 1,
  });
  return data.map((c) => ({
    sha: c.sha,
    message: c.commit.message,
    author: c.commit.author?.name ?? "unknown",
    authorLogin: c.author?.login ?? c.committer?.login ?? null,
    authorAvatar: c.author?.avatar_url ?? null,
    date: c.commit.author?.date ?? c.commit.committer?.date ?? "",
    additions: 0,
    deletions: 0,
    files: [],
  }));
}

export async function getCommitDetail(
  token: string,
  owner: string,
  repo: string,
  sha: string
): Promise<CommitInfo> {
  const octokit = createOctokit(token);
  const { data } = await octokit.rest.repos.getCommit({ owner, repo, ref: sha });
  return {
    sha: data.sha,
    message: data.commit.message,
    author: data.commit.author?.name ?? "unknown",
    authorLogin: data.author?.login ?? data.committer?.login ?? null,
    authorAvatar: data.author?.avatar_url ?? null,
    date: data.commit.author?.date ?? data.commit.committer?.date ?? "",
    additions: data.stats?.additions ?? 0,
    deletions: data.stats?.deletions ?? 0,
    files: (data.files ?? []).map((f) => ({
      filename: f.filename,
      status: f.status ?? "modified",
      additions: f.additions ?? 0,
      deletions: f.deletions ?? 0,
      changes: f.changes ?? 0,
    })),
  };
}

export type Contributor = {
  login: string;
  name: string | null;
  avatarUrl: string;
  contributions: number;
  url: string;
};

export async function listContributors(
  token: string,
  owner: string,
  repo: string
): Promise<Contributor[]> {
  const octokit = createOctokit(token);
  const { data } = await octokit.rest.repos.listContributors({
    owner,
    repo,
    per_page: 100,
    anon: "1",
  });
  return data
    .filter((c) => c && c.login)
    .map((c) => ({
      login: c.login!,
      name: null,
      avatarUrl: c.avatar_url ?? "",
      contributions: c.contributions ?? 0,
      url: c.html_url ?? "",
    }));
}

export type FileNode = {
  path: string;
  type: "file" | "dir";
  size: number;
  sha: string;
};

export async function listRepoTree(
  token: string,
  owner: string,
  repo: string,
  branch: string
): Promise<FileNode[]> {
  const octokit = createOctokit(token);
  const { data } = await octokit.rest.git.getTree({
    owner,
    repo,
    tree_sha: branch,
    recursive: "1",
  });
  return (data.tree ?? [])
    .filter((n) => n.type === "blob" || n.type === "tree")
    .map((n) => ({
      path: n.path ?? "",
      type: n.type === "tree" ? "dir" : "file",
      size: n.size ?? 0,
      sha: n.sha ?? "",
    }));
}

export async function getFileContent(
  token: string,
  owner: string,
  repo: string,
  path: string,
  branch: string
): Promise<string> {
  const octokit = createOctokit(token);
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path,
      ref: branch,
    });
    if (Array.isArray(data)) return "";
    if (data.type === "file" && data.encoding === "base64") {
      return Buffer.from(data.content, "base64").toString("utf-8");
    }
    return "";
  } catch {
    return "";
  }
}

/**
 * Parse a GitHub URL or org/user identifier.
 */
export function parseGithubIdentifier(input: string): { owner: string; repo?: string } {
  let s = input.trim();
  s = s.replace(/^https?:\/\/github\.com\//, "");
  s = s.replace(/^github\.com\//, "");
  s = s.replace(/\/+$/, "");
  s = s.replace(/^@/, "");
  const parts = s.split("/").filter(Boolean);
  if (parts.length === 0) return { owner: "" };
  if (parts.length === 1) return { owner: parts[0] };
  return { owner: parts[0], repo: parts[1] };
}

/** Detect whether the identifier is an org or a user. */
export async function resolveOwner(
  token: string,
  owner: string
): Promise<{ kind: "org" | "user"; info: OrgInfo }> {
  try {
    const info = await getOrg(token, owner);
    return { kind: "org", info };
  } catch {
    // fall through to user
  }
  const info = await getUser(token, owner);
  return { kind: "user", info };
}
