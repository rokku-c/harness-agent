/**
 * agentdeck/adapters/cli - generic NON-INTERACTIVE CLI agent gateway
 * (claude-code -p, codex exec, gemini cli, pi, custom commands).
 *
 * Config mapping is the point: a UnifiedAgentConfig renders to the exact spawn
 * argv for the kind (ask 3) — that render is `cli-preset.ts`, the turn is
 * `cli-turn.ts`, and this file is the session lifecycle over them.
 */
import type { AgentKind } from "../kinds.ts"
import type { OpenSessionRequest, SendOutcome, SessionGateway, SessionStatus } from "../flow.ts"
import type { UnifiedAgentConfig } from "../config-types.ts"
import { cliInvocation, cliPresets, type CliPreset } from "./cli-preset.ts"
import { runTurn, type CliBox } from "./cli-turn.ts"

export interface CliGatewayOptions {
  /** override/add CLI dialects (e.g. a "*claw"-like agent) */
  readonly presets?: Readonly<Record<string, CliPreset>>
}

export const makeCliGateway = (kind: AgentKind, options: CliGatewayOptions = {}): SessionGateway => {
  const presets = { ...cliPresets, ...(options.presets ?? {}) }
  const boxes = new Map<string, CliBox>()
  let seq = 0

  /** unified config -> { file, argv } for one turn (ask 3, lossless) */
  const argvFor = (config: UnifiedAgentConfig, prompt: string) => cliInvocation(config, prompt, presets)

  return {
    kind,
    open: async (request: OpenSessionRequest) => {
      const sessionId = request.sessionId ?? kind + "-" + (++seq).toString(36)
      const box: CliBox = { sessionId, kind: request.config.kind, config: request.config, turns: [], status: "idle", lastActivityAt: Date.now() }
      boxes.set(sessionId, box)
      return { sessionId, kind: request.config.kind, status: "idle", lastActivityAt: box.lastActivityAt }
    },
    close: async (sessionId: string) => {
      const box = boxes.get(sessionId)
      if (box !== undefined) {
        box.closed = true
        const child = box.active
        if (child !== undefined && child.pid !== undefined) {
          const group = -child.pid
          try { process.kill(group, "SIGTERM") } catch { child.kill("SIGTERM") }
          setTimeout(() => { try { process.kill(group, "SIGKILL") } catch { child.kill("SIGKILL") } }, 400)
        }
      }
      boxes.delete(sessionId)
    },
    send: async (sessionId: string, text: string): Promise<SendOutcome> => {
      const box = boxes.get(sessionId)
      if (box === undefined) return { ok: false, detail: "unknown session " + sessionId }
      if (box.status === "running") return { ok: false, detail: "session busy: a turn is already running" }
      const at = Date.now()
      const outcome = await runTurn(box, argvFor(box.config, text))
      box.turns.push({ role: "user", content: text, at })
      if (outcome.ok && outcome.text !== undefined) box.turns.push({ role: "agent", content: outcome.text, at: Date.now() })
      return outcome
    },
    history: async (sessionId: string) => {
      const box = boxes.get(sessionId)
      if (box === undefined) throw new Error("unknown session " + sessionId)
      return box.turns
    },
    status: async (sessionId: string): Promise<SessionStatus> => {
      const box = boxes.get(sessionId)
      if (box === undefined) throw new Error("unknown session " + sessionId)
      return { sessionId, kind: box.kind, status: box.status, lastActivityAt: box.lastActivityAt, detail: box.detail }
    },
    sessions: () => [...boxes.values()].map((b) => ({ sessionId: b.sessionId, kind: b.kind, status: b.status, lastActivityAt: b.lastActivityAt, detail: b.detail }))
  }
}
