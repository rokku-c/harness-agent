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
    // Not a clean exit, and it is not reported as one: nobody received the goodbye,
    // so the node stays listed as up until its lease happens to lapse.
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
  // The announcement is what the push side adjudicates every placement against:
  // a machine that declares nothing gets everything refused, with no hint as to
  // why. Refused here, at startup, rather than per plan.
  if (capabilities.length === 0) fail("--capabilities is required")
  // Same reasoning for the allowlist (§8.3), and it is the *sharper* case: an
  // empty namespace set is a valid declaration of "carries nothing", so a typo'd
  // flag would be indistinguishable from a deliberate drain at plan time.
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
    // Both of these are the point of a machine's agentd, so both are on unless
    // turned off: a machine that only holds a lease is present but of no use.
    ...(given["no-launch"] === undefined ? { launcher: makeLaunchRunner() } : {}),
    ...(given["no-collect"] === undefined
      ? { reporter: makeFactSource({ machineId: nodeId, ...(hosts.length === 0 ? {} : { hosts }), ...(sessionLimit === undefined ? {} : { limit: sessionLimit }) }) }
      : {}),
    onEvent: (event) => {
      process.stderr.write(`${line(event)}\n`)
      // A refusal stops the loop for good, so staying up would be a process that
      // looks like a running probe and is not one: it goes down and says why.
      if (event instanceof ProbeFault && event.kind === "refused") void shutdown(probe, nodeId, 1)
    },
    onLaunch: (report) => process.stderr.write(`launch ${launched(report)}\n`),
  })
  process.stderr.write(`probe ${nodeId} → ${url} every ${intervalMs}ms\n`)
  process.on("SIGINT", () => void shutdown(probe, nodeId, 0))
  process.on("SIGTERM", () => void shutdown(probe, nodeId, 0))
}

await main()
