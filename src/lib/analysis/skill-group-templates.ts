/**
 * Skill Group Templates
 * =====================
 *
 * Defines reusable "skill group maps" that re-project the 5-dimensional
 * skill taxonomy (sector, problemType, tech, methodology, role) into
 * organisation-specific perspectives.
 *
 * For example, a "Data Scientist" template groups the raw skills into
 * buckets like "Data Engineering", "Machine Learning", "Statistics",
 * "Visualization", etc.
 *
 * Users can:
 *   1. Pick a built-in template from a dropdown
 *   2. Create a custom template in the UI
 *   3. Upload a JSON template file
 *   4. Download a blank template as a starting point
 */

import type { SkillDimension } from "./skill-taxonomy";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

/** A single mapping rule: "skills in dimension X matching pattern P
 *  contribute to this group with weight W." */
export type SkillMapping = {
  /** Which of the 5 dimensions to match against */
  dimension: SkillDimension;
  /** Substring match (case-insensitive). Use "*" to match everything in that dimension. */
  pattern: string;
  /** How strongly this mapping contributes (0..1). Default 1. */
  weight: number;
};

/** A group within a template — e.g. "Data Engineering" */
export type SkillGroup = {
  name: string;
  description: string;
  /** Logo-palette colour key: sector | problem | tech | methodology | role | people */
  colorKey: string;
  /** Mapping rules that feed into this group */
  mappings: SkillMapping[];
};

/** A complete template */
export type SkillGroupTemplate = {
  id: string;
  name: string;
  description: string;
  /** Whether this is a built-in template (not editable) */
  isBuiltIn: boolean;
  /** The groups that make up this template */
  groups: SkillGroup[];
};

/** Result of applying a template to a person's skill record */
export type PersonGroupScore = {
  login: string;
  name: string;
  avatarUrl: string;
  totalCommits: number;
  groups: {
    name: string;
    colorKey: string;
    score: number;
    /** Which raw skills contributed and how much */
    contributions: { skillName: string; dimension: SkillDimension; weight: number; rawScore: number }[];
  }[];
  /** Overall fitness score for this template (0-100) */
  fitnessScore: number;
};

/* ------------------------------------------------------------------ */
/*  Built-in Templates                                                  */
/* ------------------------------------------------------------------ */

const LOGO_COLORS = ["sector", "problem", "tech", "methodology", "role", "people"] as const;

export const BUILTIN_TEMPLATES: SkillGroupTemplate[] = [
  {
    id: "data-scientist",
    name: "Data Scientist",
    description: "Maps skills through the lens of a Data Scientist role — data engineering, ML/AI, statistics, visualization, and domain expertise.",
    isBuiltIn: true,
    groups: [
      {
        name: "Data Engineering",
        description: "ETL pipelines, data warehousing, data modeling",
        colorKey: "sector",
        mappings: [
          { dimension: "problemType", pattern: "Data Ingestion & ETL", weight: 1 },
          { dimension: "problemType", pattern: "Database Modeling", weight: 0.8 },
          { dimension: "problemType", pattern: "Migration & Schema", weight: 0.6 },
          { dimension: "tech", pattern: "Spark", weight: 1 },
          { dimension: "tech", pattern: "Airflow", weight: 1 },
          { dimension: "tech", pattern: "Dagster", weight: 1 },
          { dimension: "tech", pattern: "dbt", weight: 1 },
          { dimension: "tech", pattern: "Snowflake", weight: 0.9 },
          { dimension: "tech", pattern: "BigQuery", weight: 0.9 },
          { dimension: "tech", pattern: "Kafka", weight: 0.8 },
          { dimension: "tech", pattern: "Postgres", weight: 0.5 },
          { dimension: "tech", pattern: "MongoDB", weight: 0.5 },
          { dimension: "tech", pattern: "Elasticsearch", weight: 0.6 },
          { dimension: "sector", pattern: "Data", weight: 0.9 },
          { dimension: "role", pattern: "Data Modeling", weight: 1 },
        ],
      },
      {
        name: "Machine Learning & AI",
        description: "Model training, inference, MLOps, LLM integration",
        colorKey: "tech",
        mappings: [
          { dimension: "tech", pattern: "PyTorch", weight: 1 },
          { dimension: "tech", pattern: "TensorFlow", weight: 1 },
          { dimension: "tech", pattern: "ONNX", weight: 0.8 },
          { dimension: "tech", pattern: "Hugging Face", weight: 1 },
          { dimension: "tech", pattern: "LangChain", weight: 0.9 },
          { dimension: "tech", pattern: "LlamaIndex", weight: 0.9 },
          { dimension: "tech", pattern: "OpenAI SDK", weight: 0.9 },
          { dimension: "tech", pattern: "Anthropic SDK", weight: 0.9 },
          { dimension: "tech", pattern: "Pinecone", weight: 0.8 },
          { dimension: "tech", pattern: "Weaviate", weight: 0.8 },
          { dimension: "tech", pattern: "Chroma", weight: 0.8 },
          { dimension: "tech", pattern: "Qdrant", weight: 0.8 },
          { dimension: "tech", pattern: "pgvector", weight: 0.7 },
          { dimension: "problemType", pattern: "Vector Search", weight: 1 },
          { dimension: "problemType", pattern: "LLM Orchestration", weight: 1 },
          { dimension: "problemType", pattern: "Natural Language", weight: 0.9 },
          { dimension: "problemType", pattern: "Image/Video", weight: 0.7 },
          { dimension: "problemType", pattern: "Recommendation", weight: 0.8 },
          { dimension: "sector", pattern: "AI/ML", weight: 1 },
          { dimension: "role", pattern: "Research", weight: 0.8 },
        ],
      },
      {
        name: "Statistical Analysis",
        description: "Python, R, statistical methods, experimentation",
        colorKey: "methodology",
        mappings: [
          { dimension: "tech", pattern: "Python", weight: 0.8 },
          { dimension: "tech", pattern: "Jupyter", weight: 0.9 },
          { dimension: "tech", pattern: "Pandas", weight: 0.9 },
          { dimension: "tech", pattern: "NumPy", weight: 0.9 },
          { dimension: "tech", pattern: "SciPy", weight: 0.9 },
          { dimension: "methodology", pattern: "Test-Driven", weight: 0.5 },
          { dimension: "methodology", pattern: "Feature Flags", weight: 0.6 },
          { dimension: "problemType", pattern: "Testing & QA", weight: 0.5 },
          { dimension: "role", pattern: "Research", weight: 1 },
          { dimension: "sector", pattern: "Scientific", weight: 0.9 },
        ],
      },
      {
        name: "Data Visualization",
        description: "Charts, dashboards, visual storytelling",
        colorKey: "problem",
        mappings: [
          { dimension: "tech", pattern: "D3.js", weight: 1 },
          { dimension: "tech", pattern: "ECharts", weight: 1 },
          { dimension: "tech", pattern: "Recharts", weight: 0.9 },
          { dimension: "tech", pattern: "Three.js", weight: 0.6 },
          { dimension: "tech", pattern: "Canvas API", weight: 0.5 },
          { dimension: "problemType", pattern: "UI/UX", weight: 0.6 },
          { dimension: "problemType", pattern: "Search & Discovery", weight: 0.5 },
          { dimension: "role", pattern: "UI/UX Implementation", weight: 0.5 },
        ],
      },
      {
        name: "Domain Expertise",
        description: "Sector knowledge, consulting, stakeholder communication",
        colorKey: "role",
        mappings: [
          { dimension: "sector", pattern: "*", weight: 0.4 },
          { dimension: "role", pattern: "Architecture", weight: 0.6 },
          { dimension: "role", pattern: "Mentoring", weight: 0.7 },
          { dimension: "role", pattern: "Documentation", weight: 0.6 },
          { dimension: "methodology", pattern: "Documentation-First", weight: 0.7 },
          { dimension: "methodology", pattern: "Domain-Driven", weight: 0.8 },
        ],
      },
    ],
  },
  {
    id: "ai-engineer",
    name: "AI Engineer",
    description: "Focuses on AI/ML engineering skills — model deployment, RAG systems, prompt engineering, MLOps, and AI infrastructure.",
    isBuiltIn: true,
    groups: [
      {
        name: "Model Development",
        description: "Training, fine-tuning, evaluation of AI models",
        colorKey: "tech",
        mappings: [
          { dimension: "tech", pattern: "PyTorch", weight: 1 },
          { dimension: "tech", pattern: "TensorFlow", weight: 1 },
          { dimension: "tech", pattern: "ONNX", weight: 0.8 },
          { dimension: "tech", pattern: "Hugging Face", weight: 1 },
          { dimension: "problemType", pattern: "Natural Language", weight: 0.9 },
          { dimension: "problemType", pattern: "Image/Video", weight: 0.8 },
          { dimension: "problemType", pattern: "Recommendation", weight: 0.7 },
          { dimension: "role", pattern: "Research", weight: 0.9 },
          { dimension: "sector", pattern: "AI/ML", weight: 1 },
        ],
      },
      {
        name: "LLM & RAG Systems",
        description: "Large language models, retrieval-augmented generation, prompt engineering",
        colorKey: "methodology",
        mappings: [
          { dimension: "tech", pattern: "LangChain", weight: 1 },
          { dimension: "tech", pattern: "LlamaIndex", weight: 1 },
          { dimension: "tech", pattern: "OpenAI SDK", weight: 1 },
          { dimension: "tech", pattern: "Anthropic SDK", weight: 1 },
          { dimension: "tech", pattern: "GLM SDK", weight: 1 },
          { dimension: "tech", pattern: "Z.ai SDK", weight: 1 },
          { dimension: "tech", pattern: "Pinecone", weight: 0.9 },
          { dimension: "tech", pattern: "Weaviate", weight: 0.9 },
          { dimension: "tech", pattern: "Chroma", weight: 0.9 },
          { dimension: "tech", pattern: "Qdrant", weight: 0.9 },
          { dimension: "tech", pattern: "pgvector", weight: 0.8 },
          { dimension: "problemType", pattern: "Vector Search", weight: 1 },
          { dimension: "problemType", pattern: "LLM Orchestration", weight: 1 },
        ],
      },
      {
        name: "MLOps & Deployment",
        description: "Model serving, monitoring, CI/CD for ML, infrastructure",
        colorKey: "sector",
        mappings: [
          { dimension: "tech", pattern: "Docker", weight: 0.8 },
          { dimension: "tech", pattern: "Kubernetes", weight: 0.8 },
          { dimension: "tech", pattern: "Terraform", weight: 0.7 },
          { dimension: "tech", pattern: "AWS", weight: 0.7 },
          { dimension: "tech", pattern: "GCP", weight: 0.7 },
          { dimension: "tech", pattern: "Azure", weight: 0.7 },
          { dimension: "tech", pattern: "Vercel", weight: 0.5 },
          { dimension: "problemType", pattern: "Observability", weight: 0.8 },
          { dimension: "problemType", pattern: "CI/CD", weight: 0.8 },
          { dimension: "methodology", pattern: "Feature Flags", weight: 0.7 },
          { dimension: "methodology", pattern: "Canary", weight: 0.7 },
          { dimension: "role", pattern: "DevOps", weight: 0.9 },
        ],
      },
      {
        name: "Data Pipeline",
        description: "Data ingestion, preprocessing, feature engineering",
        colorKey: "problem",
        mappings: [
          { dimension: "problemType", pattern: "Data Ingestion", weight: 1 },
          { dimension: "problemType", pattern: "Database Modeling", weight: 0.7 },
          { dimension: "tech", pattern: "Spark", weight: 1 },
          { dimension: "tech", pattern: "Airflow", weight: 1 },
          { dimension: "tech", pattern: "Kafka", weight: 0.8 },
          { dimension: "tech", pattern: "Redis", weight: 0.5 },
          { dimension: "role", pattern: "Data Modeling", weight: 1 },
        ],
      },
      {
        name: "AI Product Skills",
        description: "API design, user experience, prompt UX, product thinking",
        colorKey: "role",
        mappings: [
          { dimension: "problemType", pattern: "API Design", weight: 0.8 },
          { dimension: "problemType", pattern: "UI/UX", weight: 0.6 },
          { dimension: "problemType", pattern: "Search & Discovery", weight: 0.7 },
          { dimension: "problemType", pattern: "Notification", weight: 0.5 },
          { dimension: "methodology", pattern: "API-First", weight: 0.9 },
          { dimension: "methodology", pattern: "Documentation-First", weight: 0.7 },
          { dimension: "role", pattern: "Architecture", weight: 0.7 },
          { dimension: "role", pattern: "Feature Development", weight: 0.6 },
        ],
      },
    ],
  },
  {
    id: "frontend-engineer",
    name: "Front End Engineer",
    description: "Maps skills for front-end development — UI frameworks, styling, state management, performance, and accessibility.",
    isBuiltIn: true,
    groups: [
      {
        name: "UI Frameworks",
        description: "React, Vue, Angular, Svelte and their ecosystems",
        colorKey: "tech",
        mappings: [
          { dimension: "tech", pattern: "React", weight: 1 },
          { dimension: "tech", pattern: "Next.js", weight: 1 },
          { dimension: "tech", pattern: "Vue", weight: 1 },
          { dimension: "tech", pattern: "Svelte", weight: 1 },
          { dimension: "tech", pattern: "Angular", weight: 1 },
          { dimension: "tech", pattern: "Expo", weight: 0.8 },
          { dimension: "tech", pattern: "React Native", weight: 0.8 },
          { dimension: "tech", pattern: "Flutter", weight: 0.7 },
          { dimension: "tech", pattern: "Electron", weight: 0.7 },
          { dimension: "tech", pattern: "Tauri", weight: 0.7 },
        ],
      },
      {
        name: "Styling & Design",
        description: "CSS frameworks, design systems, responsive design",
        colorKey: "methodology",
        mappings: [
          { dimension: "tech", pattern: "TailwindCSS", weight: 1 },
          { dimension: "tech", pattern: "shadcn/ui", weight: 1 },
          { dimension: "problemType", pattern: "UI/UX", weight: 1 },
          { dimension: "problemType", pattern: "Accessibility", weight: 0.9 },
          { dimension: "problemType", pattern: "Internationalization", weight: 0.7 },
          { dimension: "role", pattern: "UI/UX Implementation", weight: 1 },
        ],
      },
      {
        name: "State & Data Layer",
        description: "API integration, state management, data fetching",
        colorKey: "problem",
        mappings: [
          { dimension: "tech", pattern: "GraphQL", weight: 0.9 },
          { dimension: "tech", pattern: "tRPC", weight: 0.9 },
          { dimension: "tech", pattern: "REST", weight: 0.7 },
          { dimension: "tech", pattern: "Socket.io", weight: 0.8 },
          { dimension: "tech", pattern: "WebSockets", weight: 0.8 },
          { dimension: "problemType", pattern: "Real-time Sync", weight: 0.9 },
          { dimension: "problemType", pattern: "Caching", weight: 0.8 },
          { dimension: "problemType", pattern: "Authentication", weight: 0.7 },
          { dimension: "problemType", pattern: "API Design", weight: 0.6 },
        ],
      },
      {
        name: "Testing & Quality",
        description: "Unit testing, E2E testing, performance monitoring",
        colorKey: "sector",
        mappings: [
          { dimension: "tech", pattern: "Playwright", weight: 1 },
          { dimension: "tech", pattern: "Cypress", weight: 1 },
          { dimension: "tech", pattern: "Vitest", weight: 1 },
          { dimension: "tech", pattern: "Jest", weight: 1 },
          { dimension: "problemType", pattern: "Testing & QA", weight: 1 },
          { dimension: "problemType", pattern: "Performance", weight: 0.8 },
          { dimension: "methodology", pattern: "Test-Driven", weight: 0.9 },
          { dimension: "methodology", pattern: "Behavior-Driven", weight: 0.8 },
          { dimension: "role", pattern: "Testing & QA", weight: 1 },
        ],
      },
      {
        name: "Build & DevOps",
        description: "Bundlers, CI/CD, deployment, performance optimization",
        colorKey: "role",
        mappings: [
          { dimension: "tech", pattern: "Vercel", weight: 0.8 },
          { dimension: "tech", pattern: "Cloudflare", weight: 0.7 },
          { dimension: "tech", pattern: "GitHub Actions", weight: 0.7 },
          { dimension: "tech", pattern: "Docker", weight: 0.6 },
          { dimension: "problemType", pattern: "CI/CD", weight: 0.7 },
          { dimension: "problemType", pattern: "Performance", weight: 0.8 },
          { dimension: "role", pattern: "Performance Optimization", weight: 1 },
          { dimension: "methodology", pattern: "Continuous Integration", weight: 0.7 },
        ],
      },
    ],
  },
  {
    id: "backend-engineer",
    name: "Back End Engineer",
    description: "Maps skills for backend development — APIs, databases, infrastructure, security, and system design.",
    isBuiltIn: true,
    groups: [
      {
        name: "API & Service Design",
        description: "REST, GraphQL, gRPC, microservices",
        colorKey: "tech",
        mappings: [
          { dimension: "tech", pattern: "REST", weight: 1 },
          { dimension: "tech", pattern: "GraphQL", weight: 1 },
          { dimension: "tech", pattern: "gRPC", weight: 1 },
          { dimension: "tech", pattern: "tRPC", weight: 0.9 },
          { dimension: "tech", pattern: "FastAPI", weight: 1 },
          { dimension: "tech", pattern: "Django", weight: 0.9 },
          { dimension: "tech", pattern: "Flask", weight: 0.8 },
          { dimension: "tech", pattern: "Spring", weight: 1 },
          { dimension: "tech", pattern: "Express", weight: 0.9 },
          { dimension: "problemType", pattern: "API Design", weight: 1 },
          { dimension: "methodology", pattern: "Microservices", weight: 0.9 },
          { dimension: "methodology", pattern: "API-First", weight: 1 },
          { dimension: "role", pattern: "API Design", weight: 1 },
        ],
      },
      {
        name: "Database & Storage",
        description: "SQL, NoSQL, ORM, caching",
        colorKey: "sector",
        mappings: [
          { dimension: "tech", pattern: "Postgres", weight: 1 },
          { dimension: "tech", pattern: "MySQL", weight: 1 },
          { dimension: "tech", pattern: "SQLite", weight: 0.7 },
          { dimension: "tech", pattern: "MongoDB", weight: 1 },
          { dimension: "tech", pattern: "Redis", weight: 1 },
          { dimension: "tech", pattern: "DynamoDB", weight: 0.9 },
          { dimension: "tech", pattern: "Prisma", weight: 0.9 },
          { dimension: "tech", pattern: "Drizzle", weight: 0.9 },
          { dimension: "problemType", pattern: "Database Modeling", weight: 1 },
          { dimension: "problemType", pattern: "Migration", weight: 0.8 },
          { dimension: "problemType", pattern: "Caching", weight: 0.9 },
          { dimension: "role", pattern: "Data Modeling", weight: 1 },
        ],
      },
      {
        name: "Auth & Security",
        description: "Authentication, authorization, encryption",
        colorKey: "problem",
        mappings: [
          { dimension: "tech", pattern: "OAuth2", weight: 1 },
          { dimension: "tech", pattern: "JWT", weight: 1 },
          { dimension: "tech", pattern: "Passport", weight: 0.9 },
          { dimension: "tech", pattern: "Clerk", weight: 0.8 },
          { dimension: "tech", pattern: "NextAuth", weight: 0.8 },
          { dimension: "problemType", pattern: "Authentication", weight: 1 },
          { dimension: "problemType", pattern: "Authorization", weight: 1 },
          { dimension: "problemType", pattern: "Encryption", weight: 1 },
          { dimension: "problemType", pattern: "Compliance", weight: 0.8 },
          { dimension: "role", pattern: "Security Hardening", weight: 1 },
          { dimension: "sector", pattern: "Security", weight: 0.9 },
        ],
      },
      {
        name: "Infrastructure & DevOps",
        description: "Cloud, containers, CI/CD, IaC",
        colorKey: "methodology",
        mappings: [
          { dimension: "tech", pattern: "Docker", weight: 1 },
          { dimension: "tech", pattern: "Kubernetes", weight: 1 },
          { dimension: "tech", pattern: "Terraform", weight: 1 },
          { dimension: "tech", pattern: "Pulumi", weight: 0.9 },
          { dimension: "tech", pattern: "Ansible", weight: 0.8 },
          { dimension: "tech", pattern: "AWS", weight: 1 },
          { dimension: "tech", pattern: "GCP", weight: 1 },
          { dimension: "tech", pattern: "Azure", weight: 1 },
          { dimension: "tech", pattern: "Helm", weight: 0.9 },
          { dimension: "problemType", pattern: "CI/CD", weight: 1 },
          { dimension: "problemType", pattern: "Infrastructure as Code", weight: 1 },
          { dimension: "problemType", pattern: "Distributed Systems", weight: 0.8 },
          { dimension: "problemType", pattern: "Observability", weight: 0.8 },
          { dimension: "role", pattern: "DevOps", weight: 1 },
          { dimension: "methodology", pattern: "GitOps", weight: 0.9 },
        ],
      },
      {
        name: "Messaging & Events",
        description: "Event-driven architecture, queues, real-time",
        colorKey: "role",
        mappings: [
          { dimension: "tech", pattern: "Kafka", weight: 1 },
          { dimension: "tech", pattern: "RabbitMQ", weight: 1 },
          { dimension: "tech", pattern: "Socket.io", weight: 0.8 },
          { dimension: "tech", pattern: "WebSockets", weight: 0.8 },
          { dimension: "problemType", pattern: "Real-time Sync", weight: 1 },
          { dimension: "problemType", pattern: "Notification", weight: 0.8 },
          { dimension: "problemType", pattern: "Workflow Automation", weight: 0.7 },
          { dimension: "methodology", pattern: "Event-Driven", weight: 1 },
        ],
      },
    ],
  },
  {
    id: "devops-engineer",
    name: "DevOps Engineer",
    description: "Maps skills for DevOps/SRE — infrastructure, CI/CD, monitoring, security, and automation.",
    isBuiltIn: true,
    groups: [
      {
        name: "Container & Orchestration",
        description: "Docker, Kubernetes, Helm, service mesh",
        colorKey: "tech",
        mappings: [
          { dimension: "tech", pattern: "Docker", weight: 1 },
          { dimension: "tech", pattern: "Kubernetes", weight: 1 },
          { dimension: "tech", pattern: "Helm", weight: 1 },
          { dimension: "tech", pattern: "Packer", weight: 0.7 },
          { dimension: "problemType", pattern: "Distributed Systems", weight: 0.8 },
          { dimension: "methodology", pattern: "Microservices", weight: 0.7 },
        ],
      },
      {
        name: "CI/CD & Automation",
        description: "Build pipelines, release engineering, GitOps",
        colorKey: "sector",
        mappings: [
          { dimension: "tech", pattern: "GitHub Actions", weight: 1 },
          { dimension: "tech", pattern: "CircleCI", weight: 1 },
          { dimension: "tech", pattern: "Jenkins", weight: 1 },
          { dimension: "tech", pattern: "GitLab CI", weight: 1 },
          { dimension: "problemType", pattern: "CI/CD", weight: 1 },
          { dimension: "methodology", pattern: "Continuous Integration", weight: 1 },
          { dimension: "methodology", pattern: "Continuous Deployment", weight: 1 },
          { dimension: "methodology", pattern: "GitOps", weight: 1 },
          { dimension: "methodology", pattern: "Trunk-based", weight: 0.7 },
          { dimension: "role", pattern: "Release Management", weight: 1 },
        ],
      },
      {
        name: "Infrastructure as Code",
        description: "Terraform, Pulumi, Ansible, cloud provisioning",
        colorKey: "methodology",
        mappings: [
          { dimension: "tech", pattern: "Terraform", weight: 1 },
          { dimension: "tech", pattern: "Pulumi", weight: 1 },
          { dimension: "tech", pattern: "Ansible", weight: 1 },
          { dimension: "problemType", pattern: "Infrastructure as Code", weight: 1 },
          { dimension: "tech", pattern: "AWS", weight: 0.8 },
          { dimension: "tech", pattern: "GCP", weight: 0.8 },
          { dimension: "tech", pattern: "Azure", weight: 0.8 },
          { dimension: "methodology", pattern: "Infrastructure as Code", weight: 1 },
        ],
      },
      {
        name: "Monitoring & Observability",
        description: "Logging, metrics, tracing, alerting",
        colorKey: "problem",
        mappings: [
          { dimension: "problemType", pattern: "Observability", weight: 1 },
          { dimension: "problemType", pattern: "Performance", weight: 0.8 },
          { dimension: "methodology", pattern: "Observability-Driven", weight: 1 },
          { dimension: "role", pattern: "Performance Optimization", weight: 0.7 },
        ],
      },
      {
        name: "Security & Compliance",
        description: "Hardening, compliance, encryption, access control",
        colorKey: "role",
        mappings: [
          { dimension: "problemType", pattern: "Authorization", weight: 1 },
          { dimension: "problemType", pattern: "Encryption", weight: 1 },
          { dimension: "problemType", pattern: "Compliance", weight: 1 },
          { dimension: "role", pattern: "Security Hardening", weight: 1 },
          { dimension: "sector", pattern: "Security", weight: 1 },
        ],
      },
    ],
  },
  {
    id: "consultant",
    name: "Consultant",
    description: "Maps skills for consulting roles — domain expertise, stakeholder communication, analytical thinking, and cross-functional collaboration.",
    isBuiltIn: true,
    groups: [
      {
        name: "Domain & Sector Knowledge",
        description: "Deep understanding of industry verticals",
        colorKey: "sector",
        mappings: [
          { dimension: "sector", pattern: "*", weight: 0.6 },
          { dimension: "role", pattern: "Architecture", weight: 0.7 },
          { dimension: "methodology", pattern: "Domain-Driven", weight: 0.9 },
        ],
      },
      {
        name: "Analytical & Research",
        description: "Problem analysis, research, prototyping",
        colorKey: "tech",
        mappings: [
          { dimension: "role", pattern: "Research & Prototyping", weight: 1 },
          { dimension: "problemType", pattern: "Data Ingestion & ETL", weight: 0.6 },
          { dimension: "problemType", pattern: "Search & Discovery", weight: 0.7 },
          { dimension: "problemType", pattern: "Recommendation", weight: 0.6 },
          { dimension: "methodology", pattern: "Documentation-First", weight: 0.8 },
        ],
      },
      {
        name: "Communication & Documentation",
        description: "Writing, presenting, knowledge transfer",
        colorKey: "methodology",
        mappings: [
          { dimension: "role", pattern: "Documentation", weight: 1 },
          { dimension: "role", pattern: "Mentoring", weight: 1 },
          { dimension: "role", pattern: "Code Review", weight: 0.7 },
          { dimension: "methodology", pattern: "Documentation-First", weight: 1 },
          { dimension: "methodology", pattern: "API-First", weight: 0.7 },
        ],
      },
      {
        name: "Solution Design",
        description: "Architecture, system design, strategy",
        colorKey: "problem",
        mappings: [
          { dimension: "role", pattern: "Architecture", weight: 1 },
          { dimension: "role", pattern: "API Design", weight: 0.8 },
          { dimension: "problemType", pattern: "API Design", weight: 0.8 },
          { dimension: "methodology", pattern: "Hexagonal", weight: 0.8 },
          { dimension: "methodology", pattern: "Domain-Driven", weight: 0.9 },
          { dimension: "methodology", pattern: "SOLID", weight: 0.7 },
          { dimension: "methodology", pattern: "Clean Code", weight: 0.7 },
        ],
      },
      {
        name: "Delivery & Execution",
        description: "Implementation, testing, project delivery",
        colorKey: "role",
        mappings: [
          { dimension: "role", pattern: "Implementation", weight: 0.7 },
          { dimension: "role", pattern: "Feature Development", weight: 0.7 },
          { dimension: "role", pattern: "Testing & QA", weight: 0.6 },
          { dimension: "role", pattern: "Bug Fixing", weight: 0.5 },
          { dimension: "problemType", pattern: "Testing & QA", weight: 0.6 },
          { dimension: "methodology", pattern: "Test-Driven", weight: 0.6 },
          { dimension: "methodology", pattern: "Agile", weight: 0.7 },
        ],
      },
    ],
  },
  {
    id: "simulation-engineer",
    name: "Simulation Engineer",
    description: "Maps skills for simulation and modeling — scientific computing, numerical methods, HPC, visualization, and domain modeling.",
    isBuiltIn: true,
    groups: [
      {
        name: "Scientific Computing",
        description: "Numerical methods, HPC, parallel computing",
        colorKey: "tech",
        mappings: [
          { dimension: "tech", pattern: "Python", weight: 0.9 },
          { dimension: "tech", pattern: "Go", weight: 0.5 },
          { dimension: "tech", pattern: "Rust", weight: 0.7 },
          { dimension: "tech", pattern: "C#", weight: 0.5 },
          { dimension: "tech", pattern: "WebAssembly", weight: 0.8 },
          { dimension: "tech", pattern: "PyTorch", weight: 0.6 },
          { dimension: "tech", pattern: "TensorFlow", weight: 0.6 },
          { dimension: "sector", pattern: "Scientific", weight: 1 },
          { dimension: "problemType", pattern: "Concurrency", weight: 0.9 },
          { dimension: "problemType", pattern: "Distributed Systems", weight: 0.7 },
        ],
      },
      {
        name: "Modeling & Abstraction",
        description: "Domain modeling, simulation design, system representation",
        colorKey: "methodology",
        mappings: [
          { dimension: "methodology", pattern: "Domain-Driven", weight: 1 },
          { dimension: "methodology", pattern: "Hexagonal", weight: 0.8 },
          { dimension: "methodology", pattern: "Object-Oriented", weight: 0.8 },
          { dimension: "methodology", pattern: "Functional Programming", weight: 0.7 },
          { dimension: "methodology", pattern: "Type-Driven", weight: 0.9 },
          { dimension: "role", pattern: "Architecture", weight: 0.8 },
          { dimension: "role", pattern: "Data Modeling", weight: 1 },
          { dimension: "problemType", pattern: "Database Modeling", weight: 0.7 },
        ],
      },
      {
        name: "Visualization & Output",
        description: "3D rendering, charts, data visualization",
        colorKey: "problem",
        mappings: [
          { dimension: "tech", pattern: "Three.js", weight: 1 },
          { dimension: "tech", pattern: "WebGL", weight: 1 },
          { dimension: "tech", pattern: "D3.js", weight: 0.9 },
          { dimension: "tech", pattern: "ECharts", weight: 0.8 },
          { dimension: "tech", pattern: "Canvas API", weight: 0.8 },
          { dimension: "problemType", pattern: "UI/UX", weight: 0.6 },
          { dimension: "problemType", pattern: "Geospatial", weight: 0.9 },
        ],
      },
      {
        name: "Performance & Optimization",
        description: "HPC, optimization, profiling, benchmarking",
        colorKey: "sector",
        mappings: [
          { dimension: "role", pattern: "Performance Optimization", weight: 1 },
          { dimension: "problemType", pattern: "Caching", weight: 0.8 },
          { dimension: "problemType", pattern: "Concurrency", weight: 1 },
          { dimension: "methodology", pattern: "Observability-Driven", weight: 0.7 },
        ],
      },
      {
        name: "Validation & Verification",
        description: "Testing, benchmarking, quality assurance",
        colorKey: "role",
        mappings: [
          { dimension: "problemType", pattern: "Testing & QA", weight: 1 },
          { dimension: "role", pattern: "Testing & QA", weight: 1 },
          { dimension: "methodology", pattern: "Test-Driven", weight: 0.9 },
          { dimension: "methodology", pattern: "Behavior-Driven", weight: 0.8 },
          { dimension: "role", pattern: "Code Review", weight: 0.7 },
        ],
      },
    ],
  },
  {
    id: "fullstack-developer",
    name: "Full Stack Developer",
    description: "Maps skills for full-stack development — frontend, backend, database, DevOps, and product thinking.",
    isBuiltIn: true,
    groups: [
      {
        name: "Frontend",
        description: "UI frameworks, styling, user experience",
        colorKey: "tech",
        mappings: [
          { dimension: "tech", pattern: "React", weight: 1 },
          { dimension: "tech", pattern: "Next.js", weight: 1 },
          { dimension: "tech", pattern: "Vue", weight: 1 },
          { dimension: "tech", pattern: "Svelte", weight: 1 },
          { dimension: "tech", pattern: "Angular", weight: 1 },
          { dimension: "tech", pattern: "TailwindCSS", weight: 0.9 },
          { dimension: "tech", pattern: "shadcn/ui", weight: 0.9 },
          { dimension: "tech", pattern: "TypeScript", weight: 0.8 },
          { dimension: "problemType", pattern: "UI/UX", weight: 1 },
          { dimension: "problemType", pattern: "Accessibility", weight: 0.9 },
          { dimension: "role", pattern: "UI/UX Implementation", weight: 1 },
        ],
      },
      {
        name: "Backend",
        description: "APIs, business logic, server-side frameworks",
        colorKey: "sector",
        mappings: [
          { dimension: "tech", pattern: "Node.js", weight: 1 },
          { dimension: "tech", pattern: "Python", weight: 0.8 },
          { dimension: "tech", pattern: "Go", weight: 0.7 },
          { dimension: "tech", pattern: "FastAPI", weight: 0.9 },
          { dimension: "tech", pattern: "Django", weight: 0.8 },
          { dimension: "tech", pattern: "Spring", weight: 0.8 },
          { dimension: "tech", pattern: "GraphQL", weight: 0.9 },
          { dimension: "tech", pattern: "tRPC", weight: 0.9 },
          { dimension: "tech", pattern: "REST", weight: 0.8 },
          { dimension: "problemType", pattern: "API Design", weight: 1 },
          { dimension: "role", pattern: "API Design", weight: 1 },
        ],
      },
      {
        name: "Database & ORM",
        description: "Database design, ORM, query optimization",
        colorKey: "problem",
        mappings: [
          { dimension: "tech", pattern: "Prisma", weight: 1 },
          { dimension: "tech", pattern: "Drizzle", weight: 1 },
          { dimension: "tech", pattern: "Postgres", weight: 1 },
          { dimension: "tech", pattern: "MySQL", weight: 0.9 },
          { dimension: "tech", pattern: "MongoDB", weight: 0.9 },
          { dimension: "tech", pattern: "Redis", weight: 0.8 },
          { dimension: "problemType", pattern: "Database Modeling", weight: 1 },
          { dimension: "role", pattern: "Data Modeling", weight: 1 },
        ],
      },
      {
        name: "DevOps & Deployment",
        description: "CI/CD, hosting, monitoring",
        colorKey: "methodology",
        mappings: [
          { dimension: "tech", pattern: "Docker", weight: 0.9 },
          { dimension: "tech", pattern: "Vercel", weight: 0.8 },
          { dimension: "tech", pattern: "AWS", weight: 0.7 },
          { dimension: "tech", pattern: "GitHub Actions", weight: 0.8 },
          { dimension: "problemType", pattern: "CI/CD", weight: 0.8 },
          { dimension: "role", pattern: "DevOps", weight: 1 },
        ],
      },
      {
        name: "Product & Collaboration",
        description: "Feature development, code review, mentoring",
        colorKey: "role",
        mappings: [
          { dimension: "role", pattern: "Feature Development", weight: 1 },
          { dimension: "role", pattern: "Code Review", weight: 0.8 },
          { dimension: "role", pattern: "Mentoring", weight: 0.7 },
          { dimension: "role", pattern: "Bug Fixing", weight: 0.6 },
          { dimension: "role", pattern: "Refactoring", weight: 0.7 },
          { dimension: "methodology", pattern: "Code Review", weight: 0.9 },
          { dimension: "methodology", pattern: "Pair Programming", weight: 0.8 },
        ],
      },
    ],
  },
  {
    id: "security-engineer",
    name: "Security Engineer",
    description: "Maps skills for security engineering — authentication, encryption, compliance, vulnerability management, and secure architecture.",
    isBuiltIn: true,
    groups: [
      {
        name: "Auth & Identity",
        description: "OAuth, JWT, SSO, identity management",
        colorKey: "tech",
        mappings: [
          { dimension: "tech", pattern: "OAuth2", weight: 1 },
          { dimension: "tech", pattern: "JWT", weight: 1 },
          { dimension: "tech", pattern: "Passport", weight: 0.9 },
          { dimension: "tech", pattern: "Clerk", weight: 0.8 },
          { dimension: "tech", pattern: "NextAuth", weight: 0.8 },
          { dimension: "problemType", pattern: "Authentication", weight: 1 },
          { dimension: "problemType", pattern: "Authorization", weight: 1 },
        ],
      },
      {
        name: "Encryption & Crypto",
        description: "Cryptographic protocols, key management, data protection",
        colorKey: "methodology",
        mappings: [
          { dimension: "problemType", pattern: "Encryption", weight: 1 },
          { dimension: "sector", pattern: "Web3", weight: 0.7 },
          { dimension: "role", pattern: "Security Hardening", weight: 1 },
        ],
      },
      {
        name: "Compliance & Audit",
        description: "Regulatory compliance, audit trails, governance",
        colorKey: "sector",
        mappings: [
          { dimension: "problemType", pattern: "Compliance", weight: 1 },
          { dimension: "sector", pattern: "Security", weight: 1 },
          { dimension: "problemType", pattern: "Authorization", weight: 0.7 },
          { dimension: "methodology", pattern: "Observability-Driven", weight: 0.6 },
        ],
      },
      {
        name: "Secure Architecture",
        description: "Threat modeling, secure design patterns, access control",
        colorKey: "problem",
        mappings: [
          { dimension: "role", pattern: "Architecture", weight: 0.8 },
          { dimension: "methodology", pattern: "Domain-Driven", weight: 0.6 },
          { dimension: "methodology", pattern: "SOLID", weight: 0.7 },
          { dimension: "problemType", pattern: "Distributed Systems", weight: 0.6 },
        ],
      },
      {
        name: "Testing & Verification",
        description: "Security testing, penetration testing, vulnerability scanning",
        colorKey: "role",
        mappings: [
          { dimension: "problemType", pattern: "Testing & QA", weight: 0.8 },
          { dimension: "role", pattern: "Testing & QA", weight: 0.8 },
          { dimension: "tech", pattern: "Playwright", weight: 0.5 },
          { dimension: "tech", pattern: "Cypress", weight: 0.5 },
          { dimension: "methodology", pattern: "Test-Driven", weight: 0.7 },
        ],
      },
    ],
  },
  {
    id: "product-engineer",
    name: "Product Engineer",
    description: "Maps skills for product-focused engineering — feature development, UX, analytics, experimentation, and stakeholder collaboration.",
    isBuiltIn: true,
    groups: [
      {
        name: "Feature Development",
        description: "Building user-facing features, rapid iteration",
        colorKey: "tech",
        mappings: [
          { dimension: "role", pattern: "Feature Development", weight: 1 },
          { dimension: "role", pattern: "Implementation", weight: 0.8 },
          { dimension: "role", pattern: "UI/UX Implementation", weight: 0.9 },
          { dimension: "tech", pattern: "React", weight: 0.7 },
          { dimension: "tech", pattern: "Next.js", weight: 0.7 },
          { dimension: "tech", pattern: "TypeScript", weight: 0.6 },
        ],
      },
      {
        name: "UX & Design Thinking",
        description: "User research, design systems, accessibility",
        colorKey: "methodology",
        mappings: [
          { dimension: "problemType", pattern: "UI/UX", weight: 1 },
          { dimension: "problemType", pattern: "Accessibility", weight: 1 },
          { dimension: "problemType", pattern: "Internationalization", weight: 0.8 },
          { dimension: "tech", pattern: "TailwindCSS", weight: 0.7 },
          { dimension: "tech", pattern: "shadcn/ui", weight: 0.7 },
        ],
      },
      {
        name: "Analytics & Experimentation",
        description: "A/B testing, metrics, data-driven decisions",
        colorKey: "problem",
        mappings: [
          { dimension: "problemType", pattern: "Search & Discovery", weight: 0.7 },
          { dimension: "problemType", pattern: "Recommendation", weight: 0.7 },
          { dimension: "problemType", pattern: "Caching", weight: 0.5 },
          { dimension: "methodology", pattern: "Feature Flags", weight: 1 },
          { dimension: "methodology", pattern: "Canary", weight: 0.9 },
          { dimension: "methodology", pattern: "A/B", weight: 1 },
        ],
      },
      {
        name: "API & Integration",
        description: "Third-party integrations, payments, notifications",
        colorKey: "sector",
        mappings: [
          { dimension: "tech", pattern: "Stripe", weight: 1 },
          { dimension: "tech", pattern: "Twilio", weight: 1 },
          { dimension: "tech", pattern: "SendGrid", weight: 1 },
          { dimension: "problemType", pattern: "Payments", weight: 1 },
          { dimension: "problemType", pattern: "Notification", weight: 1 },
          { dimension: "problemType", pattern: "API Design", weight: 0.8 },
          { dimension: "problemType", pattern: "Workflow Automation", weight: 0.8 },
        ],
      },
      {
        name: "Communication & Collaboration",
        description: "Documentation, mentoring, cross-team work",
        colorKey: "role",
        mappings: [
          { dimension: "role", pattern: "Documentation", weight: 1 },
          { dimension: "role", pattern: "Mentoring", weight: 1 },
          { dimension: "role", pattern: "Code Review", weight: 0.8 },
          { dimension: "role", pattern: "Architecture", weight: 0.6 },
          { dimension: "methodology", pattern: "Pair Programming", weight: 0.9 },
          { dimension: "methodology", pattern: "Code Review", weight: 0.8 },
        ],
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Blank template for download                                        */
/* ------------------------------------------------------------------ */

export const BLANK_TEMPLATE: Omit<SkillGroupTemplate, "id" | "isBuiltIn"> = {
  name: "My Custom Template",
  description: "Describe what perspective this template maps skills through.",
  groups: [
    {
      name: "Group 1",
      description: "Describe this skill group",
      colorKey: "sector",
      mappings: [
        { dimension: "tech", pattern: "React", weight: 1 },
        { dimension: "problemType", pattern: "UI/UX", weight: 0.8 },
      ],
    },
    {
      name: "Group 2",
      description: "Describe this skill group",
      colorKey: "tech",
      mappings: [
        { dimension: "tech", pattern: "Python", weight: 1 },
        { dimension: "sector", pattern: "AI/ML", weight: 0.9 },
      ],
    },
    {
      name: "Group 3",
      description: "Describe this skill group",
      colorKey: "methodology",
      mappings: [
        { dimension: "methodology", pattern: "Test-Driven", weight: 1 },
        { dimension: "role", pattern: "Testing & QA", weight: 0.8 },
      ],
    },
    {
      name: "Group 4",
      description: "Describe this skill group",
      colorKey: "problem",
      mappings: [
        { dimension: "problemType", pattern: "Authentication", weight: 1 },
        { dimension: "role", pattern: "Security Hardening", weight: 0.9 },
      ],
    },
    {
      name: "Group 5",
      description: "Describe this skill group",
      colorKey: "role",
      mappings: [
        { dimension: "role", pattern: "Architecture", weight: 1 },
        { dimension: "methodology", pattern: "Domain-Driven", weight: 0.8 },
      ],
    },
  ],
};

/* ------------------------------------------------------------------ */
/*  Re-aggregation Logic                                                */
/* ------------------------------------------------------------------ */

import type { AdvancedSkillMap, PersonSkillRecord } from "./skill-taxonomy";

/** Get skills list for a dimension from a person record */
function getSkillsForDimension(person: PersonSkillRecord, dim: SkillDimension) {
  switch (dim) {
    case "sector": return person.sectors;
    case "problemType": return person.problemTypes;
    case "tech": return person.tech;
    case "methodology": return person.methodologies;
    case "role": return person.roles;
  }
}

/** Check if a skill name matches a pattern (case-insensitive substring, or "*" for all) */
function matchesPattern(skillName: string, pattern: string): boolean {
  if (pattern === "*") return true;
  return skillName.toLowerCase().includes(pattern.toLowerCase());
}

/** Apply a template to the full skill map and get per-person group scores */
export function applyTemplate(
  template: SkillGroupTemplate,
  skillMap: AdvancedSkillMap,
): PersonGroupScore[] {
  return skillMap.people.map((person) => {
    const groupScores = template.groups.map((group) => {
      const contributions: PersonGroupScore["groups"][number]["contributions"] = [];
      let totalScore = 0;

      for (const mapping of group.mappings) {
        const skills = getSkillsForDimension(person, mapping.dimension);
        for (const skill of skills) {
          if (matchesPattern(skill.name, mapping.pattern)) {
            const weighted = skill.score * mapping.weight;
            totalScore += weighted;
            contributions.push({
              skillName: skill.name,
              dimension: mapping.dimension,
              weight: mapping.weight,
              rawScore: skill.score,
            });
          }
        }
      }

      return {
        name: group.name,
        colorKey: group.colorKey,
        score: Math.round(totalScore * 100) / 100,
        contributions,
      };
    });

    // Fitness score: average of group scores, normalized to 0-100
    const maxPossibleScore = groupScores.length * 10; // rough ceiling
    const totalGroupScore = groupScores.reduce((sum, g) => sum + g.score, 0);
    const fitnessScore = Math.min(100, Math.round((totalGroupScore / Math.max(maxPossibleScore, 1)) * 100));

    return {
      login: person.login,
      name: person.name,
      avatarUrl: person.avatarUrl,
      totalCommits: person.totalCommits,
      groups: groupScores,
      fitnessScore,
    };
  });
}

/** Get org-level group scores by aggregating all people */
export function applyTemplateOrg(
  template: SkillGroupTemplate,
  skillMap: AdvancedSkillMap,
): { name: string; colorKey: string; totalScore: number; peopleCount: number; avgScore: number }[] {
  const personScores = applyTemplate(template, skillMap);

  return template.groups.map((group) => {
    let totalScore = 0;
    let peopleCount = 0;
    for (const person of personScores) {
      const g = person.groups.find((pg) => pg.name === group.name);
      if (g && g.score > 0) {
        totalScore += g.score;
        peopleCount++;
      }
    }
    return {
      name: group.name,
      colorKey: group.colorKey,
      totalScore: Math.round(totalScore * 100) / 100,
      peopleCount,
      avgScore: peopleCount > 0 ? Math.round((totalScore / peopleCount) * 100) / 100 : 0,
    };
  });
}
