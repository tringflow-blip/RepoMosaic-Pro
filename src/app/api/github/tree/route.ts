import { NextResponse } from "next/server";
import { listRepoTree } from "@/lib/github/client";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { token, owner, repo, branch } = (await req.json()) as {
      token?: string;
      owner?: string;
      repo?: string;
      branch?: string;
    };
    if (!token || !owner || !repo || !branch) {
      return NextResponse.json({ error: "token, owner, repo, branch required" }, { status: 400 });
    }
    const tree = await listRepoTree(token, owner, repo, branch);
    return NextResponse.json({ tree });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
