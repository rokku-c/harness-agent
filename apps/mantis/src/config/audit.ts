/**
 * config/audit.ts - the LEGACY AUDIT.
 *
 * Concept: walk the raw document and collect warnings - never throws for
 * deprecated keys. Top-level unknown sections, unknown [dingtalk] keys and
 * unknown/known-but-unmapped [agent] keys each produce one readable line so
 * an old config migrates loudly but safely.
 */
import type { Toml } from "./discovery.ts"
import {
  AGENT_KNOWN_SECTION_KEYS, AGENT_LIVE_KEYS, DEPRECATED_TOP_SECTIONS,
  DINGTALK_FUTURE_KEYS, DINGTALK_IDENTITY_KEYS, DINGTALK_LIVE_KEYS
} from "./legacy.ts"

const warn = (warnings: string[], path: string, why: string): void => {
  warnings.push("[config] deprecated " + path + " - " + why + " (ignored; remove it to silence)")
}

export const auditTop = (cfg: Toml, warnings: string[]): void => {
  const knownTop = new Set(["dingtalk", "agent", ...DEPRECATED_TOP_SECTIONS])
  for (const [section, value] of Object.entries(cfg)) {
    if (section === "dingtalk" || section === "agent") continue
    if (value === null || typeof value !== "object") {
      warn(warnings, section, "unrecognized top-level key")
      continue
    }
    if (DEPRECATED_TOP_SECTIONS.includes(section)) {
      const sub = Object.keys(value as Toml)
      warn(warnings, "[" + section + "]", "original section with keys [" + sub.join(", ") + "] not part of the new engine")
    } else {
      warn(warnings, section, "unrecognized top-level section")
    }
  }
}

export const auditDingtalk = (dingtalk: Toml, warnings: string[]): void => {
  for (const key of Object.keys(dingtalk)) {
    if (DINGTALK_LIVE_KEYS.has(key) || DINGTALK_FUTURE_KEYS.has(key)) continue
    if (DINGTALK_IDENTITY_KEYS.has(key)) continue // dws identity may live here too
    warn(warnings, "[dingtalk].\"" + key + "\"", "unrecognized key")
  }
}

export const auditAgent = (agent: Toml, warnings: string[]): void => {
  for (const [key, value] of Object.entries(agent)) {
    if (AGENT_LIVE_KEYS.has(key)) continue
    if (typeof value === "object" && value !== null) {
      if (key === "reflection") {
        // max_passes maps to our reflect passes; the rest of the machinery differs
        const reflection = value as Toml
        for (const sub of Object.keys(reflection)) {
          if (sub !== "max_passes")
            warn(warnings, "[agent.reflection].\"" + sub + "\"", "reflection engine differs (observe_only only)")
        }
        continue
      }
      if (AGENT_KNOWN_SECTION_KEYS.has(key)) {
        warn(warnings, "[agent." + key + "]", "original sub-engine not part of the new agent")
        continue
      }
    }
    warn(warnings, "agent.\"" + key + "\"",
      AGENT_KNOWN_SECTION_KEYS.has(key) ? "original option not part of the new agent" : "unrecognized option")
  }
}
