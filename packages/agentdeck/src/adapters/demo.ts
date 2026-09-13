/**
 * agentdeck demo gateway - a scripted agent that demonstrates the three
 * unified surfaces WITHOUT any real model or CLI binary. Sends echo a prompt
 * and can raise consent asks via the "ask:<tool> <json>" marker, so the
 * product layer (and its tests) can exercise open -> send -> approve -> send
 * with no external dependency.
 */
import type { SendOutcome, SessionGateway, SessionTurn } from "../flow.ts"
import { makeSessionTable, type SessionBox } from "./session-table.ts"

export interface DemoGatewayOptions {
  /** register an ask into the shared consent ledger; returns the call id */
  readonly ask: (sessionId: string, tool: string, input: unknown) => string
}

interface DemoBox extends SessionBox {
  readonly label: string
  readonly asks: Array<string>
  readonly turns: Array<SessionTurn>
}

export const makeDemoGateway = (options: DemoGatewayOptions): SessionGateway => {
  const table = makeSessionTable<DemoBox>({
    kind: "demo",
    prefix: "demo",
    create: (sessionId, request) => ({
      sessionId,
      label: request.config.label ?? request.config.kind,
      status: "idle",
      lastActivityAt: Date.now(),
      asks: [],
      turns: []
    })
  })

  const send = (sessionId: string, text: string): Promise<SendOutcome> =>
    table.run(sessionId, async (box) => {
      // demo dialect: "ask:<tool> <input>" raises a consent ask this turn
      const asks: Array<{ tool: string; input: unknown }> = []
      for (const line of text.split("\n")) {
        const m = /^ask:(\S+)\s+(.+)$/.exec(line.trim())
        if (m !== null) asks.push({ tool: m[1]!, input: JSON.parse(m[2]!) })
      }
      for (const a of asks) box.asks.push(options.ask(box.sessionId, a.tool, a.input))
      const asked = asks.length > 0 ? " (+asked " + asks.length + " consent)" : ""
      const reply = "demo:" + box.label + " <- " + text.split("\n")[0]?.slice(0, 40) + asked
      box.turns.push({ role: "user", content: text, at: Date.now() }, { role: "agent", content: reply, at: Date.now() })
      return { ok: true, text: reply }
    })

  return {
    kind: "demo",
    open: table.open,
    close: table.close,
    send,
    status: table.status,
    sessions: table.sessions,
    history: (sessionId: string) => table.get(sessionId)?.turns ?? []
  }
}
