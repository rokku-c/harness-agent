import { findConfigPath, readDocument, candidateConfigPaths, type Toml } from "./discovery.ts"
import { mapToConfig } from "./map.ts"
import type { MantisConfig } from "./types.ts"

export const loadConfig = (): MantisConfig => {
  const configPath = findConfigPath()
  if (configPath === undefined)
    throw new Error(
      "no config.toml found. Looked at:\n  " + candidateConfigPaths().join("\n  ") +
      "\nCopy apps/mantis/config.example.toml to apps/mantis/config.toml, or set " +
      "MANTIS_CONFIG_FILE to a current Mantis config."
    )
  const cfg = readDocument(configPath)
  return mapToConfig(cfg, [])
}
