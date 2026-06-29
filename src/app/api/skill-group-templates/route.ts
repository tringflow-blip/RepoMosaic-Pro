import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { BUILTIN_TEMPLATES, BLANK_TEMPLATE } from "@/lib/analysis/skill-group-templates";
import type { SkillGroupTemplate } from "@/lib/analysis/skill-group-templates";

/** GET — list all templates (built-in + custom from DB) */
export async function GET() {
  try {
    const customRows = await db.skillGroupTemplate.findMany({
      orderBy: { createdAt: "desc" },
    });

    const customTemplates: SkillGroupTemplate[] = customRows.map((row) => ({
      ...JSON.parse(row.templateJson),
      id: row.id,
      isBuiltIn: false,
    }));

    return NextResponse.json({
      builtIn: BUILTIN_TEMPLATES,
      custom: customTemplates,
      blankTemplate: BLANK_TEMPLATE,
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to load templates: ${(err as Error).message}` },
      { status: 500 },
    );
  }
}

/** POST — create a custom template */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, description, groups } = body as Omit<SkillGroupTemplate, "id" | "isBuiltIn">;

    if (!name || !groups || !Array.isArray(groups) || groups.length === 0) {
      return NextResponse.json(
        { error: "Template must have a name and at least one group" },
        { status: 400 },
      );
    }

    // Validate groups
    for (const group of groups) {
      if (!group.name || !group.mappings || !Array.isArray(group.mappings)) {
        return NextResponse.json(
          { error: `Group "${group.name || "(unnamed)"}" must have a name and mappings array` },
          { status: 400 },
        );
      }
      for (const mapping of group.mappings) {
        if (!mapping.dimension || !mapping.pattern) {
          return NextResponse.json(
            { error: "Each mapping must have a dimension and pattern" },
            { status: 400 },
          );
        }
      }
    }

    const templateJson = JSON.stringify({ name, description, groups });
    const row = await db.skillGroupTemplate.create({
      data: { name, description: description || "", templateJson },
    });

    return NextResponse.json({
      ...JSON.parse(templateJson),
      id: row.id,
      isBuiltIn: false,
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to create template: ${(err as Error).message}` },
      { status: 500 },
    );
  }
}

/** DELETE — delete a custom template by id */
export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "Template id required" }, { status: 400 });
    }
    await db.skillGroupTemplate.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to delete template: ${(err as Error).message}` },
      { status: 500 },
    );
  }
}
