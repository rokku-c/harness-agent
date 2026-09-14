import type { DeclaredMachine } from "@effect-agent/agentd"
import {
  makeFactSource, makeLaunchRunner, ProbeFault, startProbe,
  type CycleOutcome, type LaunchReport, type RunningProbe,
} from "@effect-agent/agentd-probe"
import { ceiling, csv, fail, hostOf, number, parse } from "./lib/probe-flags.ts"

const message = (value: unknown): string => value instanceof Error ? value.message : String(value)

const line = (event: CycleOutcome | ProbeFault): string =>
  event instanceof ProbeFault ? `fault ${event.kind}: ${event.message}`
  : event.kind === "applied" ? `applied revision ${event.revision}: ${event.changes.join(", ") || "no changes"}`
  : event.kind === "apply-failed" ? `could not apply revision ${event.revision}: ${event.error}`
  : `revision ${event.revision} already applied`

const launched = (report: LaunchReport): string =>
  `${report.intent.intentId} ${report.state}: ${(report.result.ok ? report.result.output : report.result.detail ?? "no detail").slice(0, 200)}`

const shutdown = async (probe: RunningProbe, nodeId: string, code: number): Promise<void> => {
  try {
    await probe.stop()
    process.stderr.write(`probe ${nodeId} withdrew\n`)
    process.exit(code)
  } catch (error) {
    process.stderr.write(`probe ${nodeId} could not withdraw: ${message(error)}\n`)
    process.exit(1)
  }
}

const main = async (): Promise<void> => {
  const given = parse(process.argv.slice(2))
  const url = given.url ?? fail("--url is required")
  const nodeId = given.id ?? fail("--id is required")
  const intervalMs = number(given, "interval", 1500)!
  const capabilities = csv(given.capabilities)
  if (capabilities.length === 0) fail("--capabilities is required")
  const namespaces = csv(given.namespaces)
  if (namespaces.length === 0) fail("--namespaces is required")
  const maxApps = ceiling(given, "max-apps")
  const machine: DeclaredMachine = {
    machineId: nodeId, name: given.name ?? nodeId, status: "online", capabilities, namespaces,
    ...(maxApps === undefined ? {} : { maxApps }),
  }

  const hosts = csv(given.hosts).map(hostOf)
  const factsIntervalMs = number(given, "facts-interval"), sessionLimit = number(given, "session-limit")
  let probe: RunningProbe
  probe = startProbe({
    url, machine, intervalMs,
    ...(given.token === undefined ? {} : { token: given.token }),
    ...(given.stage === undefined ? {} : { stage: given.stage }),
    ...(factsIntervalMs === undefined ? {} : { factsIntervalMs }),
    ...(given["no-launch"] === undefined ? { launcher: makeLaunchRunner() } : {}),
    ...(given["no-collect"] === undefined
      ? { reporter: makeFactSource({ machineId: nodeId, ...(hosts.length === 0 ? {} : { hosts }), ...(sessionLimit === undefined ? {} : { limit: sessionLimit }) }) }
      : {}),
    onEvent: (event) => {
      process.stderr.write(`${line(event)}\n`)
      if (event instanceof ProbeFault && event.kind === "refused") void shutdown(probe, nodeId, 1)
    },
    onLaunch: (report) => process.stderr.write(`launch ${launched(report)}\n`),
  })
  process.stderr.write(`probe ${nodeId} → ${url} every ${intervalMs}ms\n`)
  process.on("SIGINT", () => void shutdown(probe, nodeId, 0))
  process.on("SIGTERM", () => void shutdown(probe, nodeId, 0))
}

await main()
