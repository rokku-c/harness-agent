import type { AgentKind } from "../kinds.ts"

export type PackageManager = "npm" | "bun"

export interface AgentInstallPlan {
  readonly kind: AgentKind
  readonly file: string
  readonly packageName: string
  readonly manager: PackageManager
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

export const describeInstall = (plan: AgentInstallPlan): string =>
  `${plan.argv.join(" ")}   # provides ${plan.file}`
