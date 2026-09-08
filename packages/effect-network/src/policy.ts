import { EgressError, type EgressOptions, type EgressPolicy } from "./types.ts"

export const policies: readonly EgressPolicy[] = ["local-first", "main-first", "local-only", "main-only"]
/** Availability selection happens before sending. There is intentionally no retry path. */
export const chooseExit = (options: EgressOptions, policy: EgressPolicy): "local" | "main" => {
  const local = options.localAvailable !== false
  const main = options.role === "main" ? local : options.main !== undefined
  const candidates = policy === "local-only" ? ["local"] : policy === "main-only" ? ["main"]
    : policy === "local-first" ? ["local", "main"] : ["main", "local"]
  const selected = candidates.find((exit) => exit === "local" ? local : main)
  if (!selected) throw new EgressError(503, `No available egress for policy ${policy}`)
  return selected === "main" && options.role === "peer" ? "main" : "local"
}
