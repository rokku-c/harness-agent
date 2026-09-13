/**
 * agentdeck/adapters/cli - generic NON-INTERACTIVE CLI agent gateway
 * (claude-code -p, codex exec, gemini cli, pi, custom commands).
 *
 * Config mapping is the point: a UnifiedAgentConfig renders to the exact spawn
 * argv for the kind (ask 3) — that render is `cli-preset.ts`, the turn is
 * `cli-turn.ts`, and this file is the session lifecycle over them.
 */
import type { AgentKind } from "../kinds.ts"
import type { SendOutcome, SessionGateway } from "../flow.ts"
import type { UnifiedAgentConfig } from "../config-types.ts"
import { cliInvocation, cliPresets, type CliPreset } from "./cli-preset.ts"
import { runTurn, type CliBox } from "./cli-turn.ts"
import { makeSessionTable } from "./session-table.ts"

export interface CliGatewayOptions {
  /** override/add CLI dialects (e.g. a "*claw"-like agent) */
  readonly presets?: Readonly<Record<string, CliPreset>>
}

export const makeCliGateway = (kind: AgentKind, options: CliGatewayOptions = {}): SessionGateway => {
  const presets = { ...cliPresets, ...(options.presets ?? {}) }

  const table = makeSessionTable<CliBox>({
    kind,
    prefix: kind,
    // a CLI session is labelled with the kind its config asked for, which is the
    // dialect actually spawned — not the kind this gateway was constructed with.
    kindOf: (box) => box.kind,
    create: (sessionId, request) => ({
      sessionId,
      kind: request.config.kind,
      config: request.config,
      turns: [],
      status: "idle",
      lastActivityAt: Date.now()
    }),
    // a turn may be holding a process group; the box is the only place it is known
    onClose: (box) => {
      box.closed = true
      const child = box.active
      if (child === undefined || child.pid === undefined) return
      const group = -child.pid
      try { process.kill(group, "SIGTERM") } catch { child.kill("SIGTERM") }
      setTimeout(() => { try { process.kill(group, "SIGKILL") } catch { child.kill("SIGKILL") } }, 400)
    }
  })

  /** unified config -> { file, argv } for one turn (ask 3, lossless) */
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
