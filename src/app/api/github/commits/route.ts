import { NextResponse } from "next/server";
import { listCommits, getCommitDetail } from "@/lib/github/client";

export const runtime = "nodejs";

/** POST /api/github/commits
 *  body: { token, owner, repo, branch?, perPage?, withFiles? }
 *  Returns: CommitInfo[] (with file details if withFiles)
 */
export async function POST(req: Request) {
  try {
    const { token, owner, repo, branch, perPage, withFiles } = (await req.json()) as {
      token?: string;
      owner?: string;
      repo?: string;
      branch?: string;
      perPage?: number;
      withFiles?: boolean;
    };
    if (!token || !owner || !repo) {
      return NextResponse.json({ error: "token, owner, repo required" }, { status: 400 });
    }
    const commits = await listCommits(token, owner, repo, {
      branch,
      per_page: perPage ?? 30,
    });
    if (withFiles) {
      // Fetch file details for the first N commits to keep API usage sane
      const cap = Math.min(commits.length, perPage ?? 30, 30);
      const detailed = await Promise.all(
        commits.slice(0, cap).map((c) => getCommitDetail(token, owner, repo, c.sha))
      );
      // detailed already includes the message/author/date
      return NextResponse.json({ commits: detailed });
    }
    return NextResponse.json({ commits });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
