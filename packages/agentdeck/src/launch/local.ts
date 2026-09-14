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
        const config = configFor(request, options.presets)
        const gateway = gatewayFor(config.kind)
        const opened = await gateway.open({ config })
        try {
          return outcomeOf(await gateway.send(opened.sessionId, request.prompt), startedAt)
        } finally {
          await gateway.close(opened.sessionId)
        }
      } catch (error) {
        return { ok: false, output: "", detail: error instanceof Error ? error.message : String(error), durationMs: Date.now() - startedAt }
      }
    },
  }
}
