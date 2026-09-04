/**
 * config/discovery.ts - FINDING and PREPARING the raw document.
 *
 * Concept: where config.toml lives (explicit env override, this repo's
 * config.toml, then the sibling original clawyp repo) and how the document
 * is prepared before audit: every "$NAME" value is expanded from the
 * environment exactly like the original loader.
 */
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { parse } from "smol-toml"
import { envVar } from "../env.ts"

export type Toml = Record<string, unknown>

/** recursively expand "$NAME" strings from the environment (original loader semantics) */
export const expandEnv = (value: unknown): unknown => {
  if (typeof value === "string")
    return value.replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g, (_, name: string) => process.env[name] ?? "")
  if (Array.isArray(value)) return value.map(expandEnv)
  if (typeof value === "object" && value !== null)
    return Object.fromEntries(Object.entries(value as Toml).map(([k, v]) => [k, expandEnv(v)]))
  return value
}

export const candidateConfigPaths = (): string[] => [
  envVar("CONFIG_FILE") ?? "",
  resolve(import.meta.dir, "../../config.toml"),
  // sibling original clawyp repo (this monorepo lives next to repos/clawyp)
  resolve(import.meta.dir, "../../../../../clawyp/clawyp/config.toml"),
  resolve(import.meta.dir, "../../../../mantis/config.toml")
].filter((path) => path !== "")

/** find the first existing config file, or undefined */
export const findConfigPath = (): string | undefined =>
  candidateConfigPaths().find((path) => existsSync(path))

export const readDocument = (path: string): Toml =>
  expandEnv(parse(readFileSync(path, "utf-8"))) as Toml
