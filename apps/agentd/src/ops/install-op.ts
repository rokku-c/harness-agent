/**
 * Installing an agent on a machine, expressed as the work it is.
 *
 * The plan comes from the *machine*: `installs` is part of what it reported
 * about itself, so the center runs an argv the machine named rather than a
 * package name the center looked up. It goes through the launch queue, so the
 * install lands with a receipt like any other work instead of being a silent
 * side effect, and a machine that never reported is refused rather than guessed
 * at.
 */
import { OperationFault, operation, type Operation } from "@effect-agent/effect-interface"
import { z } from "@effect-agent/effect-config"
import type { AgentdSurfaces } from "./surfaces.ts"

/** One install plan, as the machine that reported it would run it. */
interface ReportedInstall {
  readonly kind?: unknown
  readonly manager?: unknown
  readonly argv?: unknown
}

const installsOf = (facts: unknown): readonly ReportedInstall[] => {
  if (typeof facts !== "object" || facts === null) return []
  const list = (facts as { installs?: unknown }).installs
  return Array.isArray(list) ? (list as ReportedInstall[]) : []
}

const asArgv = (plan: ReportedInstall): readonly string[] | undefined => {
  if (!Array.isArray(plan.argv) || plan.argv.length === 0) return undefined
  const argv = plan.argv.filter((word): word is string => typeof word === "string")
  return argv.length === plan.argv.length ? argv : undefined
}

export const installOperations = ({ facts, launches }: AgentdSurfaces): readonly Operation[] => [
  operation({
    name: "agentd_install",
    description: "Install an agent on a machine, using the install plan that machine reported for it",
    input: z.object({
      nodeId: z.string().min(1), machineId: z.string().min(1), kind: z.string().min(1),
      workdir: z.string().min(1), manager: z.string().min(1).optional(),
    }).strict(),
    handler: (input) => {
      const report = facts.get(input.machineId)
      if (report === undefined) {
        throw new OperationFault(404, `machine "${input.machineId}" has not reported; it must probe itself before anything is installed on it`)
      }
      const plans = installsOf(report.facts).filter((plan) => plan.kind === input.kind)
      const chosen = input.manager === undefined ? plans : plans.filter((plan) => plan.manager === input.manager)
      if (chosen.length === 0) {
        const known = [...new Set(installsOf(report.facts).map((plan) => String(plan.kind)))].join(", ")
        throw new OperationFault(404, `machine "${input.machineId}" reports no install plan for "${input.kind}"; it can install ${known || "nothing"}`)
      }
      const argv = asArgv(chosen[0] as ReportedInstall)
      if (argv === undefined) throw new OperationFault(400, `the install plan reported for "${input.kind}" has no command`)
      return {
        ok: true,
        launch: launches.enqueue({
          nodeId: input.nodeId, machineId: input.machineId, kind: "custom", workdir: input.workdir, prompt: "",
          command: argv[0] as string, args: argv.slice(1),
        }),
      }
    },
  }),
]
