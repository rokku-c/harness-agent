import type { AgentKind } from "../kinds.ts"
import type { SendOutcome, SessionGateway } from "../flow.ts"
import type { UnifiedAgentConfig } from "../config-types.ts"
import { cliInvocation, cliPresets, type CliPreset } from "./cli-preset.ts"
import { runTurn, type CliBox } from "./cli-turn.ts"
import { makeSessionTable } from "./session-table.ts"

export interface CliGatewayOptions {
  readonly presets?: Readonly<Record<string, CliPreset>>
}

export const makeCliGateway = (kind: AgentKind, options: CliGatewayOptions = {}): SessionGateway => {
  const presets = { ...cliPresets, ...(options.presets ?? {}) }

  const table = makeSessionTable<CliBox>({
    kind,
    prefix: kind,
    kindOf: (box) => box.kind,
    create: (sessionId, request) => ({
      sessionId,
      kind: request.config.kind,
      config: request.config,
      turns: [],
      status: "idle",
      lastActivityAt: Date.now()
    }),
    onClose: (box) => {
      box.closed = true
      const child = box.active
      if (child === undefined || child.pid === undefined) return
      const group = -child.pid
      try { process.kill(group, "SIGTERM") } catch { child.kill("SIGTERM") }
      setTimeout(() => { try { process.kill(group, "SIGKILL") } catch { child.kill("SIGKILL") } }, 400)
    }
  })

  const argvFor = (config: UnifiedAgentConfig, prompt: string) => cliInvocation(config, prompt, presets)

  const send = (sessionId: string, text: string): Promise<SendOutcome> =>
    table.run(sessionId, async (box) => {
      const at = Date.now()
      const outcome = await runTurn(box, argvFor(box.config, text))
      box.turns.push({ role: "user", content: text, at })
      if (outcome.ok && outcome.text !== undefined) box.turns.push({ role: "agent", content: outcome.text, at: Date.now() })
      return outcome
    })

  const boxOf = (sessionId: string): CliBox => {
    const box = table.get(sessionId)
    if (box === undefined) throw new Error("unknown session " + sessionId)
    return box
  }

  return {
    kind,
    open: table.open,
    close: table.close,
    send,
    history: async (sessionId: string) => boxOf(sessionId).turns,
    status: table.status,
    sessions: table.sessions
  }
}
