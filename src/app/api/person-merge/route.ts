import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { PersonMergeRule } from "@/lib/analysis/person-merge";

/** GET — list all merge rules for an org */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const org = searchParams.get("org");
    if (!org) {
      return NextResponse.json({ error: "org parameter required" }, { status: 400 });
    }

    const rows = await db.personMerge.findMany({
      where: { org },
      orderBy: { createdAt: "desc" },
    });

    const rules: PersonMergeRule[] = rows.map((row) => ({
      id: row.id,
      org: row.org,
      primaryLogin: row.primaryLogin,
      mergedLogins: JSON.parse(row.mergedLogins),
      createdAt: row.createdAt.toISOString(),
    }));

    return NextResponse.json({ rules });
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to load merge rules: ${(err as Error).message}` },
      { status: 500 },
    );
  }
}

/** POST — create a merge rule */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { org, primaryLogin, mergedLogins } = body as {
      org: string;
      primaryLogin: string;
      mergedLogins: string[];
    };

    if (!org || !primaryLogin || !mergedLogins || !Array.isArray(mergedLogins) || mergedLogins.length < 2) {
      return NextResponse.json(
        { error: "Must provide org, primaryLogin, and at least 2 mergedLogins" },
        { status: 400 },
      );
    }

    if (!mergedLogins.includes(primaryLogin)) {
      return NextResponse.json(
        { error: "primaryLogin must be one of the mergedLogins" },
        { status: 400 },
      );
    }

    // Check for conflicts: any of the logins already in another merge?
    const existingMerges = await db.personMerge.findMany({ where: { org } });
    for (const existing of existingMerges) {
      const existingLogins: string[] = JSON.parse(existing.mergedLogins);
      const overlap = mergedLogins.find((l) => existingLogins.includes(l));
      if (overlap) {
        return NextResponse.json(
          { error: `Login "${overlap}" is already in another merge rule (primary: ${existing.primaryLogin}). Delete that rule first.` },
          { status: 409 },
        );
      }
    }

    const row = await db.personMerge.create({
      data: {
        org,
        primaryLogin,
        mergedLogins: JSON.stringify(mergedLogins),
      },
    });

    const rule: PersonMergeRule = {
      id: row.id,
      org: row.org,
      primaryLogin: row.primaryLogin,
      mergedLogins: JSON.parse(row.mergedLogins),
      createdAt: row.createdAt.toISOString(),
    };

    return NextResponse.json({ rule });
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to create merge: ${(err as Error).message}` },
      { status: 500 },
    );
  }
}

/** PUT — update a merge rule (change primary login or add/remove logins) */
export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, primaryLogin, mergedLogins } = body as {
      id: string;
      primaryLogin?: string;
      mergedLogins?: string[];
    };

    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    const existing = await db.personMerge.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Merge rule not found" }, { status: 404 });
    }

    const updates: Record<string, string> = {};
    if (primaryLogin) updates.primaryLogin = primaryLogin;
    if (mergedLogins) {
      if (mergedLogins.length < 2) {
        return NextResponse.json(
          { error: "Must have at least 2 mergedLogins. To undo a merge, delete the rule." },
          { status: 400 },
        );
      }
      if (primaryLogin && !mergedLogins.includes(primaryLogin)) {
        return NextResponse.json(
          { error: "primaryLogin must be one of the mergedLogins" },
          { status: 400 },
        );
      }
      updates.mergedLogins = JSON.stringify(mergedLogins);
    }

    const row = await db.personMerge.update({
      where: { id },
      data: updates,
    });

    const rule: PersonMergeRule = {
      id: row.id,
      org: row.org,
      primaryLogin: row.primaryLogin,
      mergedLogins: JSON.parse(row.mergedLogins),
      createdAt: row.createdAt.toISOString(),
    };

    return NextResponse.json({ rule });
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to update merge: ${(err as Error).message}` },
      { status: 500 },
    );
  }
}

/** DELETE — delete a merge rule */
export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
    await db.personMerge.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to delete merge: ${(err as Error).message}` },
      { status: 500 },
    );
  }
}
