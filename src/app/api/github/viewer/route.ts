import { NextResponse } from "next/server";
import { getViewer } from "@/lib/github/client";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { token } = (await req.json()) as { token?: string };
    if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });
    const info = await getViewer(token);
    return NextResponse.json(info);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
