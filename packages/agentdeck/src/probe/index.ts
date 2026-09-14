import { homedir } from "node:os"
import { claudeFacts } from "./claude.ts"
import { codexFacts } from "./codex.ts"
import { which, version } from "./executables.ts"
import { settingsAgentFacts } from "./settings-json.ts"
import type { AgentFacts, AgentKind, MachineFacts, ProbeOptions } from "./types.ts"

export * from "./types.ts"
export { which, version } from "./executables.ts"
export { installPlan, installPlans, installableKinds, describeInstall } from "./install.ts"
export type { AgentInstallPlan, PackageManager } from "./install.ts"

interface AgentSpec {
  readonly kind: AgentKind
  readonly file: string
  readonly facts: (home: string, cwd?: string) => Promise<Partial<AgentFacts>>
}

const AGENTS: ReadonlyArray<AgentSpec> = [
  { kind: "claude-code", file: "claude", facts: claudeFacts },
  { kind: "codex", file: "codex", facts: (home) => codexFacts(home) },
  { kind: "gemini", file: "gemini", facts: (home) => settingsAgentFacts("gemini", home) },
  { kind: "pi", file: "pi", facts: (home) => settingsAgentFacts("pi", home) }
]

const probeOne = async (spec: AgentSpec, options: ProbeOptions, home: string): Promise<AgentFacts> => {
  const path = await which(spec.file)
  const facts = await spec.facts(home, options.cwd)
  const release = path === undefined || options.skipVersion === true
    ? undefined
    : await version(path).catch(() => undefined)
  return {
    kind: spec.kind,
    installed: path !== undefined,
    mcpServers: [],
    sources: [],
    ...facts,
    ...(path !== undefined ? { path } : {}),
    ...(release !== undefined ? { version: release } : {}),
    ...(path === undefined
      ? { notes: [...(facts.notes ?? []), "not on PATH; configuration not read"], sources: [] }
      : {})
  }
}

export const probeMachine = async (options: ProbeOptions = {}): Promise<MachineFacts> => {
  const home = options.home ?? homedir()
  const wanted = options.kinds
  const chosen = wanted === undefined ? AGENTS : AGENTS.filter((spec) => wanted.includes(spec.kind))
  const agents = await Promise.all(chosen.map((spec) => probeOne(spec, options, home)))
  return { home, at: Date.now(), agents }
}
