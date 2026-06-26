import { NextResponse } from "next/server";
import { listContributors } from "@/lib/github/client";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { token, owner, repo } = (await req.json()) as {
      token?: string;
      owner?: string;
      repo?: string;
    };
    if (!token || !owner || !repo) {
      return NextResponse.json({ error: "token, owner, repo required" }, { status: 400 });
    }
    const contributors = await listContributors(token, owner, repo);
    return NextResponse.json({ contributors });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
