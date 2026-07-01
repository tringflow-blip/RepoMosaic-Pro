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

/**
 * Fetch ALL commits on a branch by paginating through every page.
 * The user explicitly asked for "all commits, even though it takes time".
 *
 * - `maxCommits` is a safety cap (default 5000) to prevent runaway scans on
 *   pathological repos. Set to 0 or Infinity for truly unlimited.
 * - `perPage` defaults to 100 (GitHub's max page size) to minimize round-trips.
 * - `onProgress` is called after each page so callers can report progress.
 */
export async function listAllCommits(
  token: string,
  owner: string,
  repo: string,
  opts: {
    branch?: string;
    since?: string;
    perPage?: number;
    maxCommits?: number;
    onProgress?: (fetched: number, totalPages: number | null) => void;
  } = {}
): Promise<CommitInfo[]> {
  const octokit = createOctokit(token);
  const perPage = opts.perPage ?? 100;
  const maxCommits = opts.maxCommits && opts.maxCommits > 0 ? opts.maxCommits : 5_000;
  const all: CommitInfo[] = [];
  let page = 1;
  // Hard safety cap on pages (5000 commits / 100 per page = 50 pages).
  const maxPages = Math.ceil(maxCommits / perPage);

  while (page <= maxPages) {
    let data: Awaited<ReturnType<typeof octokit.rest.repos.listCommits>>["data"];
    try {
      const resp = await octokit.rest.repos.listCommits({
        owner,
        repo,
        sha: opts.branch,
        since: opts.since,
        per_page: perPage,
        page,
      });
      data = resp.data;
    } catch (err) {
      // If we hit a 409 (empty repo) or 422, treat as no commits.
      if ((err as { status?: number }).status === 409 || (err as { status?: number }).status === 422) {
        break;
      }
      throw err;
    }
    if (!data || data.length === 0) break;

    for (const c of data) {
      all.push({
        sha: c.sha,
        message: c.commit.message,
        author: c.commit.author?.name ?? "unknown",
        authorLogin: c.author?.login ?? c.committer?.login ?? null,
        authorAvatar: c.author?.avatar_url ?? null,
        date: c.commit.author?.date ?? c.commit.committer?.date ?? "",
        additions: 0,
        deletions: 0,
        files: [],
      });
      if (all.length >= maxCommits) break;
    }

    opts.onProgress?.(all.length, null);

    if (data.length < perPage) break; // last page
    page++;
  }
  return all;
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

/**
 * Enrich contributor profiles by fetching real display names and avatar URLs
 * from the GitHub Users API. Processes logins in batches of 5 with a small
 * delay between batches to avoid rate limiting.
 */
export async function enrichContributorProfiles(
  token: string,
  logins: string[]
): Promise<Map<string, { name: string; avatarUrl: string; url: string }>> {
  const octokit = createOctokit(token);
  const result = new Map<string, { name: string; avatarUrl: string; url: string }>();
  // Process in batches of 5 to avoid rate limiting
  for (let i = 0; i < logins.length; i += 5) {
    const batch = logins.slice(i, i + 5);
    const promises = batch.map(async (login) => {
      try {
        const { data } = await octokit.rest.users.getByUsername({ username: login });
        result.set(login, {
          name: data.name ?? login,
          avatarUrl: data.avatar_url ?? "",
          url: data.html_url ?? "",
        });
      } catch {
        result.set(login, { name: login, avatarUrl: "", url: `https://github.com/${login}` });
      }
    });
    await Promise.all(promises);
    // Small delay between batches to be gentle on rate limits
    if (i + 5 < logins.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  return result;
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
): Promise<{ kind: "org" | "user"; info: OrgInfo; parsedOwner: string }> {
  // Always parse first — user may have pasted a full URL like
  // "https://github.com/Gaia-Recipe" or "@Gaia-Recipe".
  const { owner: parsed } = parseGithubIdentifier(owner);
  const cleanOwner = parsed || owner;
  try {
    const info = await getOrg(token, cleanOwner);
    return { kind: "org", info, parsedOwner: cleanOwner };
  } catch {
    // fall through to user
  }
  const info = await getUser(token, cleanOwner);
  return { kind: "user", info, parsedOwner: cleanOwner };
}
