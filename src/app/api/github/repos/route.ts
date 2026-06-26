import { NextResponse } from "next/server";
import { resolveOwner, listOrgRepos, listUserRepos } from "@/lib/github/client";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { token, owner } = (await req.json()) as { token?: string; owner?: string };
    if (!token || !owner) {
      return NextResponse.json({ error: "token and owner required" }, { status: 400 });
    }
    const { kind, info, parsedOwner } = await resolveOwner(token, owner);
    const repos = kind === "org" ? await listOrgRepos(token, parsedOwner) : await listUserRepos(token, parsedOwner);
    return NextResponse.json({ kind, info, repos });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
