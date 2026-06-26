import { NextResponse } from "next/server";

export const runtime = "nodejs";

type ScanJob = {
  id: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  cancelRequested: boolean;
  finishedAt: number | null;
};

const globalForScan = globalThis as unknown as { __scanJobs?: Map<string, ScanJob> };

/** POST /api/scan/cancel
 *  body: { id: string }
 *
 * Sets the `cancelRequested` flag on a running scan. The scan loop polls
 * this flag between chunks and aborts gracefully — partial results are
 * still aggregated and surfaced to the user, but the job is marked as
 * "cancelled" rather than "completed".
 *
 * Returns:
 *   200 { ok: true, id, previousStatus } — flag was set
 *   200 { ok: true, id, alreadyDone: true, status } — job already finished
 *   404 { error: "job not found" }
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { id?: string };
    const id = body.id;
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
    const job = globalForScan.__scanJobs?.get(id);
    if (!job) {
      return NextResponse.json({ error: "job not found" }, { status: 404 });
    }
    // If the job has already finished (completed / failed / cancelled),
    // there's nothing to cancel — tell the client so the UI can recover.
    if (job.status === "completed" || job.status === "failed" || job.status === "cancelled") {
      return NextResponse.json({ ok: true, id, alreadyDone: true, status: job.status });
    }
    const previousStatus = job.status;
    job.cancelRequested = true;
    return NextResponse.json({ ok: true, id, previousStatus });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
