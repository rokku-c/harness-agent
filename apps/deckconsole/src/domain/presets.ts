import { cliPresets as builtin } from "@effect-agent/agentdeck"

export const makePresets = () => {
  const dynamic = new Map<string, { file: string; args: ReadonlyArray<string> }>()
  return {
    dynamic, builtin,
    known: (kind: string) => ["custom", "demo", "effect", "effect-ops", "claude-cc", ...Object.keys(builtin), ...dynamic.keys()].includes(kind),
    invocable: () => ["custom", ...Object.keys(builtin).filter(k => k !== "custom"), ...dynamic.keys()],
    all: () => {
      const merged = { ...builtin }
      for (const [kind, p] of dynamic) merged[kind] = { file: p.file, argv: () => p.args }
      return merged
    },
  }
}
