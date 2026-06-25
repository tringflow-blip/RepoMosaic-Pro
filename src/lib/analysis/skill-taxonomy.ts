/**
 * Advanced Skill Taxonomy
 * =======================
 *
 * Multi-dimensional skill model that replaces the original RepoMosaic-Pro's
 * 12 hardcoded regex capability strands with a richer, LLM-extensible taxonomy.
 *
 * Dimensions (per the user's request):
 *   1. Sector         — what industry / domain is being served
 *   2. Problem Type   — what kind of problem is being solved
 *   3. Tech Capability — specific technologies / frameworks / libraries
 *   4. Methodology    — engineering approach / process
 *   5. Role           — what role the author played in this chunk
 *
 * These are *seed* vocabularies. The GLM skill-extractor is free to return
 * tags outside this list — the aggregator will accept any string — but the
 * seeds give the model consistent terminology and the UI a known palette.
 */

export type SkillDimension =
  | "sector"
  | "problemType"
  | "tech"
  | "methodology"
  | "role";

export const SECTOR_SEEDS: string[] = [
  "DevTools",
  "AI/ML",
  "FinTech",
  "HealthTech",
  "E-commerce",
  "EduTech",
  "Infra/DevOps",
  "Security",
  "Data/Analytics",
  "Media/Content",
  "Productivity",
  "Communications",
  "Games",
  "Web3/Crypto",
  "IoT/Embedded",
  "Scientific/Research",
  "Government/Civic",
  "Real-estate/PropTech",
  "Logistics/Supply-chain",
  "Automotive/Mobility",
];

export const PROBLEM_TYPE_SEEDS: string[] = [
  "Authentication & Identity",
  "Authorization & Access Control",
  "Real-time Sync",
  "Data Ingestion & ETL",
  "Vector Search & RAG",
  "LLM Orchestration",
  "Image/Video Processing",
  "Natural Language Processing",
  "Caching & Performance",
  "Observability & Monitoring",
  "Distributed Systems",
  "API Design & Versioning",
  "Database Modeling",
  "Migration & Schema Evolution",
  "Testing & QA",
  "CI/CD & Release Engineering",
  "Infrastructure as Code",
  "UI/UX & Design Systems",
  "Accessibility",
  "Internationalization",
  "Payments & Billing",
  "Search & Discovery",
  "Recommendation",
  "Notification & Messaging",
  "Workflow Automation",
  "Document Processing",
  "Geospatial/Mapping",
  "Compliance & Audit",
  "Encryption & Crypto",
  "Concurrency & Async",
];

export const TECH_SEEDS: string[] = [
  "React",
  "Next.js",
  "Vue",
  "Svelte",
  "Angular",
  "TypeScript",
  "Node.js",
  "Bun",
  "Deno",
  "Python",
  "FastAPI",
  "Django",
  "Flask",
  "Go",
  "Rust",
  "Java",
  "Spring",
  "Kotlin",
  "Swift",
  "Ruby",
  "Rails",
  "PHP",
  "Laravel",
  "C#",
  ".NET",
  "TailwindCSS",
  "shadcn/ui",
  "Prisma",
  "Drizzle",
  "Postgres",
  "MySQL",
  "SQLite",
  "MongoDB",
  "Redis",
  "DynamoDB",
  "Cassandra",
  "Elasticsearch",
  "Pinecone",
  "Weaviate",
  "Qdrant",
  "Chroma",
  "pgvector",
  "LangChain",
  "LlamaIndex",
  "OpenAI SDK",
  "Anthropic SDK",
  "GLM SDK",
  "Hugging Face",
  "PyTorch",
  "TensorFlow",
  "ONNX",
  "Docker",
  "Kubernetes",
  "Helm",
  "Terraform",
  "Pulumi",
  "Ansible",
  "Packer",
  "GitHub Actions",
  "CircleCI",
  "Jenkins",
  "GitLab CI",
  "Vercel",
  "Cloudflare",
  "AWS",
  "GCP",
  "Azure",
  "Stripe",
  "Twilio",
  "SendGrid",
  "Socket.io",
  "WebSockets",
  "gRPC",
  "GraphQL",
  "tRPC",
  "REST",
  "OAuth2",
  "JWT",
  "Passport",
  "Clerk",
  "NextAuth",
  "Playwright",
  "Cypress",
  "Vitest",
  "Jest",
  "Pytest",
  "Kafka",
  "RabbitMQ",
  "Spark",
  "Airflow",
  "Dagster",
  "dbt",
  "Snowflake",
  "BigQuery",
  "D3.js",
  "ECharts",
  "Recharts",
  "Three.js",
  "WebGL",
  "Canvas API",
  "Electron",
  "React Native",
  "Flutter",
  "Expo",
  "Tauri",
  "WebAssembly",
];

export const METHODOLOGY_SEEDS: string[] = [
  "Test-Driven Development",
  "Behavior-Driven Development",
  "Monorepo",
  "Polyrepo",
  "Trunk-based Development",
  "Git Flow",
  "Microservices",
  "Modular Monolith",
  "Serverless",
  "Event-Driven Architecture",
  "Hexagonal Architecture",
  "Domain-Driven Design",
  "Functional Programming",
  "Object-Oriented Programming",
  "Reactive Programming",
  "Type-Driven Design",
  "Code Review",
  "Pair Programming",
  "Continuous Integration",
  "Continuous Deployment",
  "Feature Flags",
  "Canary Releases",
  "Blue/Green Deployment",
  "Infrastructure as Code",
  "GitOps",
  "Observability-Driven Development",
  "Documentation-First",
  "API-First Design",
  "SOLID Principles",
  "Clean Code",
];

export const ROLE_SEEDS: string[] = [
  "Architecture",
  "Implementation",
  "DevOps/Infra",
  "Testing & QA",
  "Documentation",
  "Code Review",
  "Refactoring",
  "Bug Fixing",
  "Feature Development",
  "Performance Optimization",
  "Security Hardening",
  "Data Modeling",
  "API Design",
  "UI/UX Implementation",
  "Tech Debt Reduction",
  "Release Management",
  "Mentoring",
  "Research & Prototyping",
];

/** A single skill tag emitted by the GLM skill extractor for one chunk. */
export type SkillTag = {
  dimension: SkillDimension;
  name: string;
  confidence: number; // 0..1
  evidence: string[]; // commit messages / file paths that justify this tag
};

/** The full skill payload emitted by GLM for a single chunk of commits. */
export type ChunkSkillExtraction = {
  chunkId: string;
  author: string;
  authorLogin: string | null;
  repo: string;
  tags: SkillTag[];
  /** One-sentence GLM summary of what this chunk accomplished. */
  summary: string;
  /** Optional GLM-inferred "primary sector" for this chunk — used to roll up
   *  per-person sector scores. */
  primarySector: string | null;
  /** ISO date strings (YYYY-MM-DD) of each commit in the chunk — used for the
   *  activity heatmap. Optional so old cached scans (without dates) still load. */
  dates?: string[];
};

/** Daily commit activity entry — used by the heatmap & activity timeline. */
export type ActivityPoint = {
  date: string; // YYYY-MM-DD
  count: number;
};

/** Aggregated per-person skill record. */
export type PersonSkillRecord = {
  login: string;
  name: string;
  avatarUrl: string;
  url: string;
  totalCommits: number;
  totalChunks: number;
  repos: string[];
  sectors: { name: string; score: number; commits: number; chunks: number }[];
  problemTypes: { name: string; score: number; commits: number; chunks: number }[];
  tech: { name: string; score: number; commits: number; chunks: number }[];
  methodologies: { name: string; score: number; commits: number; chunks: number }[];
  roles: { name: string; score: number; commits: number; chunks: number }[];
  /** Flat list of every tag with full evidence — for the detail panel. */
  allTags: (SkillTag & { repo: string; commits: number })[];
  ownership: { repo: string; share: number; commits: number }[];
  /** Daily commit activity for this person (sorted ascending by date). Empty
   *  for old cached scans that don't have commit dates. */
  activity: ActivityPoint[];
  /** First commit date for this person (ISO). */
  firstCommitDate: string | null;
  /** Last commit date for this person (ISO). */
  lastCommitDate: string | null;
};

export type AdvancedSkillMap = {
  org: string;
  generatedAt: string;
  model: string;
  provider: string;
  totalRepos: number;
  totalCommits: number;
  totalChunks: number;
  totalPeople: number;
  people: PersonSkillRecord[];
  /** Org-wide rollups. */
  orgSectors: { name: string; score: number; people: number; commits: number }[];
  orgProblemTypes: { name: string; score: number; people: number; commits: number }[];
  orgTech: { name: string; score: number; people: number; commits: number }[];
  orgMethodologies: { name: string; score: number; people: number; commits: number }[];
  orgRoles: { name: string; score: number; people: number; commits: number }[];
  /** Org-wide daily commit activity (sorted ascending by date). */
  activity: ActivityPoint[];
  /** Org-wide first/last commit dates (ISO). */
  firstCommitDate: string | null;
  lastCommitDate: string | null;
};

/** Convert an aggregated skill map into a force-graph structure for the UI.
 *  Nodes = people (sized by total commits) + skills (sized by score).
 *  Edges connect each person to every skill they have, weighted by score. */
export function skillMapToGraph(map: AdvancedSkillMap, dimension: SkillDimension = "sector") {
  type Node = {
    id: string;
    type: "person" | "skill";
    label: string;
    value: number;
    color: string;
    r: number;
    avatar?: string;
    dimension?: SkillDimension;
  };
  type Edge = { source: string; target: string; weight: number };

  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const skillColor: Record<SkillDimension, string> = {
    sector: "oklch(0.62 0.13 35)",
    problemType: "oklch(0.62 0.13 145)",
    tech: "oklch(0.62 0.13 250)",
    methodology: "oklch(0.62 0.13 305)",
    role: "oklch(0.62 0.13 90)",
  };

  // Person nodes
  for (const p of map.people) {
    nodes.push({
      id: `person:${p.login}`,
      type: "person",
      label: p.name || p.login,
      value: p.totalCommits,
      color: "oklch(0.55 0.10 200)",
      r: Math.max(10, Math.min(30, Math.sqrt(p.totalCommits) * 1.6)),
      avatar: p.avatarUrl,
    });
  }

  // Skill nodes for the chosen dimension
  const skillSet = new Set<string>();
  for (const p of map.people) {
    const list =
      dimension === "sector" ? p.sectors :
      dimension === "problemType" ? p.problemTypes :
      dimension === "tech" ? p.tech :
      dimension === "methodology" ? p.methodologies : p.roles;
    for (const s of list) skillSet.add(s.name);
  }

  for (const name of skillSet) {
    // Compute aggregate value across people
    let total = 0;
    let people = 0;
    for (const p of map.people) {
      const list =
        dimension === "sector" ? p.sectors :
        dimension === "problemType" ? p.problemTypes :
        dimension === "tech" ? p.tech :
        dimension === "methodology" ? p.methodologies : p.roles;
      const hit = list.find((s) => s.name === name);
      if (hit) {
        total += hit.commits;
        people += 1;
      }
    }
    nodes.push({
      id: `skill:${name}`,
      type: "skill",
      label: name,
      value: total,
      color: skillColor[dimension],
      r: Math.max(8, Math.min(26, Math.sqrt(total) * 1.2 + people * 1.5)),
      dimension,
    });
  }

  // Edges: person -> skill
  for (const p of map.people) {
    const list =
      dimension === "sector" ? p.sectors :
      dimension === "problemType" ? p.problemTypes :
      dimension === "tech" ? p.tech :
      dimension === "methodology" ? p.methodologies : p.roles;
    for (const s of list) {
      edges.push({
        source: `person:${p.login}`,
        target: `skill:${s.name}`,
        weight: Math.max(1, s.commits),
      });
    }
  }

  return { nodes, edges };
}
