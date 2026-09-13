import { makeCliGateway, type CliGatewayOptions } from "../adapters/cli.ts"
import type { AgentKind } from "../kinds.ts"
import type { SendOutcome, SessionGateway } from "../flow.ts"
import { configFor, launchCommand } from "./command.ts"
import type { LaunchOutcome, LaunchRequest, Launcher } from "./types.ts"

const outcomeOf = (result: SendOutcome, startedAt: number): LaunchOutcome => {
  const output = result.text?.trim() ?? ""
  const durationMs = Date.now() - startedAt
  return result.ok
    ? { ok: true, output, durationMs }
    : { ok: false, output, detail: result.detail ?? "the agent produced no answer", durationMs }
}

/**
 * A launch on this host. The work is done by the CLI gateway rather than by a
 * second `spawn` written here: process-group teardown, the timeout, and the
 * argv dialect are the gateway's, and a parallel implementation would be a
 * second set of answers to questions already answered.
 */
export const makeLocalLauncher = (options: CliGatewayOptions = {}): Launcher => {
  const gateways = new Map<AgentKind, SessionGateway>()
  const gatewayFor = (kind: AgentKind): SessionGateway => {
    const existing = gateways.get(kind)
    if (existing !== undefined) return existing
    const created = makeCliGateway(kind, options)
    gateways.set(kind, created)
    return created
  }
  return {
    command: (request: LaunchRequest) => launchCommand(request, options.presets),
    run: async (request: LaunchRequest): Promise<LaunchOutcome> => {
      const startedAt = Date.now()
      try {
        // the config is resolved first: it is what refuses a kind this machine
        // has no dialect for, and no gateway should be built for one it refuses
        const config = configFor(request, options.presets)
        const gateway = gatewayFor(config.kind)
        const opened = await gateway.open({ config })
        try {
          return outcomeOf(await gateway.send(opened.sessionId, request.prompt), startedAt)
        } finally {
          await gateway.close(opened.sessionId)
        }
      } catch (error) {
        // a binary that is not installed never becomes a turn at all
        return { ok: false, output: "", detail: error instanceof Error ? error.message : String(error), durationMs: Date.now() - startedAt }
      }
    },
  }
}
