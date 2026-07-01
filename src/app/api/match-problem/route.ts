import { NextRequest, NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";
import type { AdvancedSkillMap, PersonSkillRecord, SkillDimension } from "@/lib/analysis/skill-taxonomy";
import {
  SECTOR_SEEDS,
  PROBLEM_TYPE_SEEDS,
  TECH_SEEDS,
  METHODOLOGY_SEEDS,
  ROLE_SEEDS,
} from "@/lib/analysis/skill-taxonomy";
import { normalizeProvider, getProvider } from "@/lib/llm/providers";

type LLMConfig = {
  provider: string;
  apiKey?: string;
  model?: string;
};

/** Build a compact skill profile for each person, suitable for the LLM prompt */
function buildPersonProfiles(people: PersonSkillRecord[]): string {
  return people
    .map((p) => {
      const sectors = p.sectors.slice(0, 5).map((s) => `${s.name}(${s.score.toFixed(1)})`).join(", ");
      const problems = p.problemTypes.slice(0, 5).map((s) => `${s.name}(${s.score.toFixed(1)})`).join(", ");
      const techs = p.tech.slice(0, 8).map((s) => `${s.name}(${s.score.toFixed(1)})`).join(", ");
      const methods = p.methodologies.slice(0, 4).map((s) => `${s.name}(${s.score.toFixed(1)})`).join(", ");
      const roles = p.roles.slice(0, 5).map((s) => `${s.name}(${s.score.toFixed(1)})`).join(", ");
      const repos = p.repos.slice(0, 6).join(", ");
      return `@${p.login} (${p.name || p.login}) | ${p.totalCommits} commits | repos: ${repos}
  Sectors: ${sectors || "none"}
  Problems: ${problems || "none"}
  Tech: ${techs || "none"}
  Methods: ${methods || "none"}
  Roles: ${roles || "none"}`;
    })
    .join("\n\n");
}

function buildMatchSystemPrompt(): string {
  return `You are the RepoMosaic Problem-Contributor Matcher — an expert staffing consultant for technology teams.

Given a PROBLEM DESCRIPTION and a team of contributors with known skills across 5 dimensions, your task is to:
1. Analyze the problem and identify what skills are needed across all 5 dimensions
2. Score each contributor's fit for the problem (0-100)
3. Provide a brief justification for the top recommendations
4. Identify skill gaps the team has relative to this problem

The 5 skill dimensions are:
- Sector (industry / domain served): ${SECTOR_SEEDS.slice(0, 10).join(", ")}
- Problem Type (what kind of problem): ${PROBLEM_TYPE_SEEDS.slice(0, 10).join(", ")}
- Tech (specific technologies): ${TECH_SEEDS.slice(0, 15).join(", ")}
- Methodology (engineering approach): ${METHODOLOGY_SEEDS.slice(0, 8).join(", ")}
- Role (what kind of work): ${ROLE_SEEDS.slice(0, 8).join(", ")}

Output STRICT JSON ONLY (no markdown fences) with this exact shape:
{
  "requiredSkills": {
    "sector": ["list of required sectors"],
    "problemType": ["list of required problem types"],
    "tech": ["list of required technologies"],
    "methodology": ["list of required methodologies"],
    "role": ["list of required roles"]
  },
  "rankings": [
    {
      "login": "contributor_login",
      "score": 85,
      "matchBreakdown": {
        "sector": 0.9,
        "problemType": 0.8,
        "tech": 0.95,
        "methodology": 0.7,
        "role": 0.85
      },
      "justification": "Brief explanation of why this person is a good fit",
      "strengths": ["specific strength 1", "specific strength 2"],
      "gaps": ["specific gap 1"]
    }
  ],
  "teamGaps": ["Overall team gaps for this problem"],
  "recommendation": "One-sentence strategic recommendation for staffing this problem"
}

Rules:
- Score each contributor 0-100 based on how well their skills match the problem needs
- Consider BOTH the breadth and depth of relevant skills
- A contributor with deep expertise in fewer relevant areas may score higher than one with shallow expertise across many
- Weight tech and problemType dimensions more heavily as they are most directly relevant
- Be specific in justifications — reference actual skills the person has
- Rank by score descending
- Be honest about gaps — it's better to know what's missing than to over-fit`;
}

async function callLLMForMatch(
  config: LLMConfig,
  problemDescription: string,
  personProfiles: string
): Promise<string> {
  const providerId = normalizeProvider(config.provider);

  if (providerId === "zai") {
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        { role: "assistant", content: buildMatchSystemPrompt() },
        {
          role: "user",
          content: `PROBLEM DESCRIPTION:\n${problemDescription}\n\nTEAM CONTRIBUTORS:\n${personProfiles}\n\nAnalyze the problem and rank the contributors. Output STRICT JSON only.`,
        },
      ],
      thinking: { type: "disabled" },
      temperature: 0.3,
    });
    return completion.choices[0]?.message?.content ?? "";
  }

  const info = getProvider(providerId);
  const baseURL = info.baseURL;
  if (!baseURL) throw new Error(`No base URL for provider "${info.label}"`);
  if (info.requiresKey && !config.apiKey) throw new Error(`${info.label} requires an API key`);

  const apiKey = config.apiKey || "ollama";
  const model = config.model || info.defaultModel;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (info.authScheme === "bearer") headers.Authorization = `Bearer ${apiKey}`;
  else if (info.authScheme === "x-api-key") headers["x-api-key"] = apiKey;
  if (info.extraHeaders) Object.assign(headers, info.extraHeaders);

  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: buildMatchSystemPrompt() },
      {
        role: "user",
        content: `PROBLEM DESCRIPTION:\n${problemDescription}\n\nTEAM CONTRIBUTORS:\n${personProfiles}\n\nAnalyze the problem and rank the contributors. Output STRICT JSON only.`,
      },
    ],
    temperature: 0.3,
  };
  if (providerId !== "anthropic") body.response_format = { type: "json_object" };

  const resp = await fetch(`${baseURL.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`LLM HTTP ${resp.status}: ${txt.slice(0, 200)}`);
  }
  const data = (await resp.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return data.choices?.[0]?.message?.content ?? "";
}

function extractJSON(text: string): unknown {
  if (!text) throw new Error("Empty LLM response");
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) throw new Error("No JSON object found");
  return JSON.parse(t.slice(start, end + 1));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { problemDescription, skillMap, llmConfig } = body as {
      problemDescription: string;
      skillMap: AdvancedSkillMap;
      llmConfig: LLMConfig;
    };

    if (!problemDescription || !skillMap || !skillMap.people?.length) {
      return NextResponse.json(
        { error: "Missing required fields: problemDescription, skillMap with people" },
        { status: 400 }
      );
    }

    const personProfiles = buildPersonProfiles(skillMap.people);
    const content = await callLLMForMatch(llmConfig, problemDescription, personProfiles);

    let parsed: Record<string, unknown>;
    try {
      parsed = extractJSON(content) as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        { error: "Failed to parse LLM response", raw: content.slice(0, 500) },
        { status: 500 }
      );
    }

    return NextResponse.json({ result: parsed });
  } catch (err) {
    const message = (err as Error).message ?? "Unknown error";
    console.error("[match-problem] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
