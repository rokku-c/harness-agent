/**
 * config/load.ts - the LOAD PIPELINE.
 *
 * Concept: find the document, read + env-expand it, audit every legacy key
 * into warnings, then map what is still honored. A missing file throws with
 * the searched paths so operators can fix it fast.
 */
import { findConfigPath, readDocument, candidateConfigPaths, type Toml } from "./discovery.ts"
import { auditAgent, auditDingtalk, auditTop } from "./audit.ts"
import { mapToConfig } from "./map.ts"
import type { MantisConfig } from "./types.ts"

export const loadConfig = (): MantisConfig => {
  const configPath = findConfigPath()
  if (configPath === undefined)
    throw new Error(
      "no config.toml found. Looked at:\n  " + candidateConfigPaths().join("\n  ") +
      "\nCopy apps/mantis/config.example.toml to apps/mantis/config.toml, or point " +
      "MANTIS_CONFIG_FILE at your original clawyp config."
    )
  const cfg = readDocument(configPath)
  const warnings: string[] = []
  auditTop(cfg, warnings)
  auditDingtalk((cfg.dingtalk ?? {}) as Toml, warnings)
  auditAgent((cfg.agent ?? {}) as Toml, warnings)
  return mapToConfig(cfg, warnings)
}
