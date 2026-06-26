/**
 * LLM Provider Catalog
 * ====================
 *
 * A curated catalog of OpenAI-compatible LLM providers. Each provider has a
 * preset base URL (so the user never pastes one) and a list of recommended
 * models. The user only picks a provider + model + (optionally) pastes an
 * API key.
 *
 * Why a catalog instead of a free-form "base URL" field:
 *   - Pastening a base URL is error-prone (trailing slash, /v1 missing, etc.)
 *   - Users don't memorize model names; a dropdown per provider is friendlier
 *   - The provider's API is OpenAI-compatible in every case below, so the
 *     transport layer is identical — only the URL + auth header differ.
 *
 * "zai" is the sandbox-default provider: it uses the pre-authenticated
 * z-ai-web-dev-sdk and needs no API key. It is listed here so users can
 * explicitly select it, but it is also the implicit fallback when no key
 * is provided for any provider.
 */

export type ProviderKind =
  | "zai"
  | "openai"
  | "anthropic"
  | "google"
  | "mistral"
  | "deepseek"
  | "ollama"
  | "groq"
  | "together";

export type ProviderModel = {
  /** The model id sent to the API. */
  id: string;
  /** Human-readable label shown in the dropdown. */
  label: string;
  /** Short hint about the model (context size / strength). */
  hint?: string;
};

export type ProviderInfo = {
  /** Stable id used in config + persistence. */
  id: ProviderKind;
  /** Display name. */
  label: string;
  /** Preset OpenAI-compatible base URL (no trailing slash). */
  baseURL: string;
  /** Whether this provider is served by the sandbox SDK (no key needed). */
  sandboxDefault?: boolean;
  /** Whether an API key is required. Local servers (Ollama) don't need one. */
  requiresKey: boolean;
  /** Where the user gets a key. */
  keyUrl?: string;
  /** Auth header scheme. */
  authScheme: "bearer" | "x-api-key";
  /** Anthropic needs extra headers. */
  extraHeaders?: Record<string, string>;
  /** Recommended models for this provider. */
  models: ProviderModel[];
  /** Default model id when the user hasn't picked one. */
  defaultModel: string;
  /** Short tagline shown under the provider name. */
  tagline: string;
  /** Brand accent color (Tailwind class fragment, e.g. "emerald"). */
  accent: string;
};

export const PROVIDERS: ProviderInfo[] = [
  {
    id: "zai",
    label: "Z.ai",
    baseURL: "",
    sandboxDefault: true,
    requiresKey: false,
    authScheme: "bearer",
    tagline: "Sandbox default — no key needed",
    accent: "violet",
    defaultModel: "glm-4-plus",
    models: [
      { id: "glm-4-plus", label: "GLM-4 Plus", hint: "General purpose · recommended" },
      { id: "glm-4", label: "GLM-4", hint: "Balanced" },
      { id: "glm-4-air", label: "GLM-4 Air", hint: "Fast · lightweight" },
      { id: "glm-4-flash", label: "GLM-4 Flash", hint: "Fastest · cheapest" },
    ],
  },
  {
    id: "openai",
    label: "OpenAI",
    baseURL: "https://api.openai.com/v1",
    requiresKey: true,
    keyUrl: "https://platform.openai.com/api-keys",
    authScheme: "bearer",
    tagline: "GPT-4o family",
    accent: "emerald",
    defaultModel: "gpt-4o-mini",
    models: [
      { id: "gpt-4o", label: "GPT-4o", hint: "Most capable" },
      { id: "gpt-4o-mini", label: "GPT-4o mini", hint: "Fast · recommended" },
      { id: "gpt-4-turbo", label: "GPT-4 Turbo", hint: "Long context" },
      { id: "gpt-4.1", label: "GPT-4.1", hint: "Latest" },
      { id: "gpt-4.1-mini", label: "GPT-4.1 mini", hint: "Balanced" },
      { id: "o3-mini", label: "o3-mini", hint: "Reasoning" },
    ],
  },
  {
    id: "anthropic",
    label: "Anthropic",
    baseURL: "https://api.anthropic.com/v1",
    requiresKey: true,
    keyUrl: "https://console.anthropic.com/settings/keys",
    authScheme: "x-api-key",
    extraHeaders: { "anthropic-version": "2023-06-01" },
    tagline: "Claude family",
    accent: "amber",
    defaultModel: "claude-3-5-sonnet-latest",
    models: [
      { id: "claude-3-5-sonnet-latest", label: "Claude 3.5 Sonnet", hint: "Best · recommended" },
      { id: "claude-3-5-haiku-latest", label: "Claude 3.5 Haiku", hint: "Fast" },
      { id: "claude-3-opus-latest", label: "Claude 3 Opus", hint: "Deep reasoning" },
    ],
  },
  {
    id: "google",
    label: "Google",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
    requiresKey: true,
    keyUrl: "https://aistudio.google.com/app/apikey",
    authScheme: "bearer",
    tagline: "Gemini family",
    accent: "rose",
    defaultModel: "gemini-1.5-flash",
    models: [
      { id: "gemini-1.5-pro", label: "Gemini 1.5 Pro", hint: "Most capable" },
      { id: "gemini-1.5-flash", label: "Gemini 1.5 Flash", hint: "Fast · recommended" },
      { id: "gemini-1.5-flash-8b", label: "Gemini 1.5 Flash 8B", hint: "Lightest" },
      { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash", hint: "Latest" },
    ],
  },
  {
    id: "mistral",
    label: "Mistral",
    baseURL: "https://api.mistral.ai/v1",
    requiresKey: true,
    keyUrl: "https://console.mistral.ai/api-keys",
    authScheme: "bearer",
    tagline: "Mistral + Mixtral",
    accent: "orange",
    defaultModel: "mistral-small-latest",
    models: [
      { id: "mistral-large-latest", label: "Mistral Large", hint: "Most capable" },
      { id: "mistral-small-latest", label: "Mistral Small", hint: "Fast · recommended" },
      { id: "open-mistral-nemo", label: "Mistral Nemo", hint: "Open" },
      { id: "open-mixtral-8x22b", label: "Mixtral 8x22B", hint: "Open · MoE" },
    ],
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    baseURL: "https://api.deepseek.com/v1",
    requiresKey: true,
    keyUrl: "https://platform.deepseek.com/api_keys",
    authScheme: "bearer",
    tagline: "DeepSeek V3 / R1",
    accent: "blue",
    defaultModel: "deepseek-chat",
    models: [
      { id: "deepseek-chat", label: "DeepSeek V3", hint: "General · recommended" },
      { id: "deepseek-reasoner", label: "DeepSeek R1", hint: "Reasoning" },
    ],
  },
  {
    id: "groq",
    label: "Groq",
    baseURL: "https://api.groq.com/openai/v1",
    requiresKey: true,
    keyUrl: "https://console.groq.com/keys",
    authScheme: "bearer",
    tagline: "Ultra-fast inference",
    accent: "fuchsia",
    defaultModel: "llama-3.3-70b-versatile",
    models: [
      { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B", hint: "Capable · recommended" },
      { id: "llama-3.1-8b-instant", label: "Llama 3.1 8B Instant", hint: "Fastest" },
      { id: "mixtral-8x7b-32768", label: "Mixtral 8x7B", hint: "MoE" },
    ],
  },
  {
    id: "together",
    label: "Together",
    baseURL: "https://api.together.xyz/v1",
    requiresKey: true,
    keyUrl: "https://api.together.ai/settings/api-keys",
    authScheme: "bearer",
    tagline: "Open models hosted",
    accent: "teal",
    defaultModel: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    models: [
      { id: "meta-llama/Llama-3.3-70B-Instruct-Turbo", label: "Llama 3.3 70B Turbo", hint: "Recommended" },
      { id: "meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo", label: "Llama 3.1 405B", hint: "Largest" },
      { id: "Qwen/Qwen2.5-72B-Instruct-Turbo", label: "Qwen 2.5 72B", hint: "Code-strong" },
    ],
  },
  {
    id: "ollama",
    label: "Ollama (local)",
    baseURL: "http://localhost:11434/v1",
    requiresKey: false,
    authScheme: "bearer",
    tagline: "Run models locally — no key",
    accent: "slate",
    defaultModel: "llama3.1:8b",
    models: [
      { id: "llama3.1:8b", label: "Llama 3.1 8B", hint: "Recommended starter" },
      { id: "llama3.1:70b", label: "Llama 3.1 70B", hint: "Capable · needs GPU" },
      { id: "qwen2.5-coder:7b", label: "Qwen 2.5 Coder 7B", hint: "Code-tuned" },
      { id: "deepseek-r1:8b", label: "DeepSeek R1 8B", hint: "Reasoning" },
      { id: "mistral:7b", label: "Mistral 7B", hint: "Balanced" },
    ],
  },
];

export const PROVIDER_MAP: Record<ProviderKind, ProviderInfo> = PROVIDERS.reduce(
  (acc, p) => {
    acc[p.id] = p;
    return acc;
  },
  {} as Record<ProviderKind, ProviderInfo>
);

export const DEFAULT_PROVIDER: ProviderKind = "zai";

export function getProvider(id: string | undefined): ProviderInfo {
  if (id && id in PROVIDER_MAP) return PROVIDER_MAP[id as ProviderKind];
  return PROVIDER_MAP[DEFAULT_PROVIDER];
}

export function getModelsForProvider(id: string | undefined): ProviderModel[] {
  return getProvider(id).models;
}

/**
 * Normalize a possibly-legacy config into the new provider-based shape.
 * Older scans stored provider as "glm" or "openai-compatible"; we map those
 * forward so cached scans still load.
 */
export function normalizeProvider(legacy: string | undefined): ProviderKind {
  if (!legacy) return DEFAULT_PROVIDER;
  if (legacy === "glm") return "zai";
  if (legacy === "openai-compatible") return "openai";
  if (legacy in PROVIDER_MAP) return legacy as ProviderKind;
  return DEFAULT_PROVIDER;
}
