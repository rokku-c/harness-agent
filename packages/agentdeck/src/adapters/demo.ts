/**
 * agentdeck demo gateway - a scripted agent that demonstrates the three
 * unified surfaces WITHOUT any real model or CLI binary. Sends echo a prompt
 * and can raise consent asks via the "ask:<tool> <json>" marker, so the
 * product layer (and its tests) can exercise open -> send -> approve -> send
 * with no external dependency.
 */
import type {
  AgentKind, OpenSessionRequest, SendOutcome, SessionGateway,
  SessionStatus, SessionTurn, UnifiedAgentConfig
} from "../types.ts"

export interface DemoGatewayOptions {
  /** register an ask into the shared consent ledger; returns the call id */
  readonly ask: (sessionId: string, tool: string, input: unknown) => string
}

interface DemoBox {
  readonly sessionId: string
  readonly label: string
  status: SessionStatus["status"]
  detail?: string
  lastActivityAt?: number
  readonly asks: Array<string>
  readonly turns: Array<SessionTurn>
}

export const makeDemoGateway = (options: DemoGatewayOptions): SessionGateway => {
  const boxes = new Map<string, DemoBox>()
  let seq = 0

  const send = async (sessionId: string, text: string): Promise<SendOutcome> => {
    const box = boxes.get(sessionId)
    if (box === undefined) return { ok: false, detail: "unknown session " + sessionId }
    box.status = "running"
    box.lastActivityAt = Date.now()
    // demo dialect: "ask:<tool> <input>" raises a consent ask this turn
    const asks: Array<{ tool: string; input: unknown }> = []
    for (const line of text.split("\n")) {
      const m = /^ask:(\S+)\s+(.+)$/.exec(line.trim())
      if (m !== null) asks.push({ tool: m[1]!, input: JSON.parse(m[2]!) })
    }
    for (const a of asks) box.asks.push(options.ask(box.sessionId, a.tool, a.input))
    box.status = "idle"
    box.lastActivityAt = Date.now()
    const asked = asks.length > 0 ? " (+asked " + asks.length + " consent)" : ""
    const reply = "demo:" + box.label + " <- " + text.split("\n")[0]?.slice(0, 40) + asked
    box.turns.push({ role: "user", content: text, at: Date.now() }, { role: "agent", content: reply, at: Date.now() })
    return { ok: true, text: reply }
  }

  return {
    kind: "demo",
    open: async (request: OpenSessionRequest) => {
      const sessionId = request.sessionId ?? "demo-" + (++seq).toString(36)
      const label = request.config.label ?? request.config.kind
      boxes.set(sessionId, { sessionId, label, status: "idle", lastActivityAt: Date.now(), asks: [], turns: [] })
      return { sessionId, kind: "demo", status: "idle", lastActivityAt: Date.now() }
    },
    close: async (sessionId: string) => { boxes.delete(sessionId) },
    send,
    status: async (sessionId: string): Promise<SessionStatus> => {
      const box = boxes.get(sessionId)
      if (box === undefined) throw new Error("unknown session " + sessionId)
      return { sessionId, kind: "demo", status: box.status, lastActivityAt: box.lastActivityAt, detail: box.detail }
    },
    sessions: () =>
      [...boxes.entries()].map(([sessionId, box]) => ({ sessionId, kind: "demo" as AgentKind, status: box.status, lastActivityAt: box.lastActivityAt, detail: box.detail })),
    history: (sessionId: string) => boxes.get(sessionId)?.turns ?? []
  }
}
