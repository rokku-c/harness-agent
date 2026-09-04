/**
 * catalog/resolve.ts - CONFIG VALUE RESOLUTION.
 *
 * Concept: a config tree may reference the environment two ways - a bare
 * `env:NAME` value, or `${NAME}` interpolation inside any string. Resolution
 * walks the parsed TOML tree and substitutes from a merged env (file env <
 * process env < explicit options). Missing variables fail with a readable
 * ProviderConfigError at the offending path.
 */
import type { ProviderConfigError } from "./contract.ts"

const ENV_REFERENCE = /\$\{([A-Z_][A-Z0-9_]*)\}/g

export const parseEnv = (source: string): Record<string, string> => {
  const values: Record<string, string> = {}
  for (const raw of source.split(/\r?\n/)) {
    const line = raw.trim().replace(/^export\s+/, "")
    if (!line || line.startsWith("#")) continue
    const split = line.indexOf("=")
    if (split < 1) continue
    const key = line.slice(0, split).trim()
    let value = line.slice(split + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
      value = value.slice(1, -1)
    values[key] = value
  }
  return values
}

export const resolveTree = (
  value: unknown,
  env: Readonly<Record<string, string | undefined>>,
  path: string,
  ErrorTag: new (args: { path: string; message: string }) => ProviderConfigError
): unknown => {
  if (typeof value === "string") {
    const direct = value.match(/^env:([A-Z_][A-Z0-9_]*)$/)?.[1]
    if (direct) {
      const found = env[direct]
      if (found === undefined)
        throw new ErrorTag({ path, message: "Environment variable " + direct + " is not defined" })
      return found
    }
    return value.replace(ENV_REFERENCE, (_match, key: string) => {
      const found = env[key]
      if (found === undefined)
        throw new ErrorTag({ path, message: "Environment variable " + key + " is not defined" })
      return found
    })
  }
  if (Array.isArray(value)) return value.map((item) => resolveTree(item, env, path, ErrorTag))
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, resolveTree(item, env, path + "." + key, ErrorTag)])
    )
  return value
}
