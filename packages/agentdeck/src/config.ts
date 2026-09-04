/**
 * agentdeck/config - the UNIFIED CONFIG MAP (ask 3).
 *
 * normalizeConfig(kind, raw) maps any agent's raw config object onto the
 * single UnifiedAgentConfig shape. Kind-level normalizers fill presets and
 * type-check their own declared fields; unknown keys flow into extra so the
 * mapping is lossless and declarative.
 */
import { KNOWN_KINDS, type AgentKind, type UnifiedAgentConfig } from "./types.ts"

/** pick a string or fail the mapping */
const str = (raw: Record<string, unknown>, key: string): string | undefined => {
  const v = raw[key]
  return typeof v === "string" && v.length > 0 ? v : undefined
}
const strList = (raw: Record<string, unknown>, key: string): ReadonlyArray<string> | undefined => {
  const v = raw[key]
  return Array.isArray(v) && v.every((x) => typeof x === "string") ? (v as string[]) : undefined
}
const num = (raw: Record<string, unknown>, key: string): number | undefined => {
  const v = raw[key]
  return typeof v === "number" && v >= 0 ? v : undefined
}

/** keys CONSUMED into unified fields (anything else stays lossless in extra) */
const DECLARED_KEYS = new Set([
  "kind", "label", "cwd", "model", "command", "args", "env", "turnTimeoutMs",
  "consent", "autoApproveTools", "defaultDecision", "allowedTools"
])

/** env objects arrive as objects or Maps - normalize to a Map */
const envOf = (raw: Record<string, unknown>, key: string): ReadonlyMap<string, string> => {
  const v = raw[key]
  if (v instanceof Map) return v as ReadonlyMap<string, string>
  if (typeof v === "object" && v !== null) {
    const out = new Map<string, string>()
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (typeof val === "string") out.set(k, val)
      else if (typeof val === "number" || typeof val === "boolean") out.set(k, String(val))
    }
    return out
  }
  return new Map()
}

const consentOf = (raw: Record<string, unknown>, kind: AgentKind): UnifiedAgentConfig["consent"] => {
  const block = (typeof raw.consent === "object" && raw.consent !== null ? raw.consent : raw) as Record<string, unknown>
  const explicitAllowed = strList(raw, "allowedTools")
  const auto = strList(block, "autoApproveTools")
  const merged = new Set<string>([...(auto ?? []), ...(kind === "claude-code" ? explicitAllowed ?? [] : [])])
  const decisionRaw = typeof block.defaultDecision === "string" ? block.defaultDecision : undefined
  return {
    autoApproveTools: merged.size > 0 ? [...merged] : undefined,
    defaultDecision: decisionRaw === "allow" || decisionRaw === "deny" ? decisionRaw : "ask"
  }
}

const extraOf = (raw: Record<string, unknown>): Record<string, unknown> => {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(raw)) if (!DECLARED_KEYS.has(k)) out[k] = v
  return out
}

/** raw -> unified mapping shared by every kind */
const mapCommon = (kind: AgentKind, raw: Record<string, unknown>): UnifiedAgentConfig => ({
  kind,
  label: str(raw, "label"),
  cwd: str(raw, "cwd") ?? process.cwd(),
  // dialect model fields resolve into the one unified model slot
  model: str(raw, "model") ?? str(raw, "codexModel") ?? str(raw, "geminiModel") ?? str(raw, "piModel"),
  command: str(raw, "command"),
  args: strList(raw, "args"),
  env: envOf(raw, "env"),
  turnTimeoutMs: num(raw, "turnTimeoutMs"),
  consent: consentOf(raw, kind),
  extra: extraOf(raw)
})

/** kind normalizers: fill declared dialect fields into the unified shape */
const NORMALIZERS: Record<string, (raw: Record<string, unknown>) => Record<string, unknown>> = {
  "claude-code": (raw) => ({ ...raw, permissionMode: str(raw, "permissionMode"), allowedTools: strList(raw, "allowedTools"), disallowedTools: strList(raw, "disallowedTools") }),
  codex: (raw) => ({ ...raw, codexModel: str(raw, "codexModel") ?? str(raw, "model"), codexApprovalMode: str(raw, "codexApprovalMode"), sandbox: str(raw, "sandbox") }),
  gemini: (raw) => ({ ...raw, geminiModel: str(raw, "geminiModel") ?? str(raw, "model") }),
  pi: (raw) => ({ ...raw, piModel: str(raw, "piModel") ?? str(raw, "model") }),
  effect: (raw) => ({ ...raw, systemPrompt: str(raw, "systemPrompt"), maxSteps: num(raw, "maxSteps"), decodeRetries: num(raw, "decodeRetries") }),
  custom: (raw) => raw
}

/** normalize one agent's raw config to the unified shape (lossless via extra) */
export const normalizeConfig = (kind: AgentKind, rawConfig: unknown): UnifiedAgentConfig => {
  const raw = (typeof rawConfig === "object" && rawConfig !== null ? rawConfig : {}) as Record<string, unknown>
  const declared = NORMALIZERS[kind] ?? NORMALIZERS.custom
  return mapCommon(kind, declared(raw))
}

/** every agent kind normalizes to the same shape */
export const unifiedKinds = (): ReadonlyArray<AgentKind> => [...KNOWN_KINDS]
