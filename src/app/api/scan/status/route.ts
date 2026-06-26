import { NextResponse } from "next/server";

export const runtime = "nodejs";

const globalForScan = globalThis as unknown as { __scanJobs?: Map<string, unknown> };

/** GET /api/scan/status?id=... */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const job = globalForScan.__scanJobs?.get(id);
  if (!job) return NextResponse.json({ error: "job not found" }, { status: 404 });
  return NextResponse.json(job);
}
