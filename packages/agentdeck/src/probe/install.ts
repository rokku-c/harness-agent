/**
 * Installing an agent is a MUTATION on someone's machine, so this module only
 * ever DESCRIBES the operation: it returns the argv a caller may run. Actually
 * running it belongs to agentd's apply path, where it is an explicit,
 * verifiable operation with a receipt - describing and doing are never the same
 * endpoint.
 *
 * Every package name here was checked against the npm registry rather than
 * recalled; a name that is merely plausible installs somebody else's code.
 */
import type { AgentKind } from "../kinds.ts"

export type PackageManager = "npm" | "bun"

export interface AgentInstallPlan {
  readonly kind: AgentKind
  /** the executable the plan is expected to provide */
  readonly file: string
  readonly packageName: string
  /** the package manager this plan is rendered for */
  readonly manager: PackageManager
  /** the full command, ready to show a human before anything runs */
  readonly argv: ReadonlyArray<string>
}

interface Installable {
  readonly kind: AgentKind
  readonly file: string
  readonly packageName: string
}

const INSTALLABLE: ReadonlyArray<Installable> = [
  { kind: "claude-code", file: "claude", packageName: "@anthropic-ai/claude-code" },
  { kind: "codex", file: "codex", packageName: "@openai/codex" },
  { kind: "gemini", file: "gemini", packageName: "@google/gemini-cli" },
  { kind: "pi", file: "pi", packageName: "@mariozechner/pi-coding-agent" }
]

export const installableKinds: ReadonlyArray<AgentKind> = INSTALLABLE.map((entry) => entry.kind)

/** The plan for one kind under one package manager, or undefined when we have
 *  no verified package for it - an unknown agent is not guessed at. */
export const installPlan = (
  kind: AgentKind,
  manager: PackageManager = "npm"
): AgentInstallPlan | undefined => {
  const entry = INSTALLABLE.find((candidate) => candidate.kind === kind)
  if (entry === undefined) return undefined
  return {
    kind: entry.kind,
    file: entry.file,
    packageName: entry.packageName,
    manager,
    argv: [manager, "install", "--global", entry.packageName]
  }
}

export const installPlans = (manager: PackageManager = "npm"): ReadonlyArray<AgentInstallPlan> =>
  INSTALLABLE.map((entry) => installPlan(entry.kind, manager))
    .filter((plan): plan is AgentInstallPlan => plan !== undefined)

/** one line a caller can put in front of an operator for approval */
export const describeInstall = (plan: AgentInstallPlan): string =>
  `${plan.argv.join(" ")}   # provides ${plan.file}`
