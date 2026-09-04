/**
 * console/turn-runner.ts - TURN LAUNCH + BUSY EXCLUSION.
 *
 * Concept: one conversation drives one turn at a time (#inflight rejects
 * overlap); each launch runs in its own AsyncLocalStorage context so events
 * attribute right when turns interleave; begin/end record onto ledger + bus.
 */
import { AsyncLocalStorage } from "node:async_hooks"
import type { Bus } from "../bus.ts"
import type { MantisHost } from "../../dingtalk/host.ts"
import type { TimelineLedger } from "./ledger.ts"
import { MAX_CHAT_TEXT } from "./types.ts"

interface TurnReply { text: string }

export class TurnRunner {
  readonly #inflight = new Set<string>()
  readonly #runCtx = new AsyncLocalStorage<string>()

  constructor(
    private readonly bus: Bus,
    private readonly ledger: TimelineLedger,
    private readonly host: MantisHost
  ) {}

  /** conversation currently driving a turn (session event attribution) */
  readonly current = (): string | undefined => this.#runCtx.getStore()

  #guard(conversationId: string, text: string): string | undefined {
    if (text.trim() === "") return "empty message"
    if (text.length > MAX_CHAT_TEXT) return "message too long (" + text.length + " chars, max " + MAX_CHAT_TEXT + ")"
    if (this.#inflight.has(conversationId)) return "conversation busy - a turn is still running"
    return undefined
  }
  #beginTurn(conversationId: string, text: string): void {
    this.ledger.begin(conversationId)
    const ts = Date.now()
    this.bus.push({ type: "message.in", conversationId, text })
    this.ledger.recordMessage(conversationId, "user", text, ts)
  }

  #endTurn(conversationId: string, reply: string): void {
    const ts = Date.now()
    this.bus.push({ type: "reply", conversationId, text: reply })
    this.ledger.recordMessage(conversationId, "assistant", reply, ts)
  }
  #runTurn(prefix: string, senderId: string, conversationId: string, text: string): Promise<TurnReply | undefined> {
    return this.#runCtx.run(conversationId, () => this.host.handle({
      id: prefix + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8),
      text,
      conversationId,
      conversationType: "single",
      senderId,
      addressed: true,
      ts: Date.now()
    }))
  }
  /** start (or continue) a conversation turn from the web */
  readonly handleMessage = async (conversationId: string, text: string): Promise<{ accepted: boolean; detail?: string }> => {
    const error = this.#guard(conversationId, text)
    if (error !== undefined) return { accepted: false, detail: error }
    this.#inflight.add(conversationId)
    this.#beginTurn(conversationId, text)
    const turn = this.#runTurn("web", "operator", conversationId, text)
    void turn.then((reply) => { if (reply !== undefined) this.#endTurn(conversationId, reply.text) })
      .catch((error) => { this.bus.push({ type: "log", level: "error", scope: "mantis.session", message: "turn failed: " + String(error) }) })
      .finally(() => this.#inflight.delete(conversationId))
    return { accepted: true }
  }

  /** fire a turn and AWAIT its reply (MCP host: a chat tool returns the answer) */
  readonly chatSync = async (conversationId: string, text: string): Promise<{ ok: boolean; reply?: string; detail?: string }> => {
    const error = this.#guard(conversationId, text)
    if (error !== undefined) return { ok: false, detail: error }
    this.#inflight.add(conversationId)
    this.#beginTurn(conversationId, text)
    const turn = this.#runTurn("mcp", "mcp", conversationId, text)
    try {
      const reply = await turn
      if (reply !== undefined) { this.#endTurn(conversationId, reply.text); return { ok: true, reply: reply.text } }
      return { ok: true }
    } catch (error) {
      return { ok: false, detail: error instanceof Error ? error.message : String(error) }
    } finally {
      this.#inflight.delete(conversationId)
    }
  }
  readonly chatFire = (conversationId: string, text: string): { ok: boolean; detail?: string } => {
    const error = this.#guard(conversationId, text)
    if (error !== undefined) return { ok: false, detail: error }
    this.#inflight.add(conversationId)
    this.#beginTurn(conversationId, text)
    const turn = this.#runTurn("web", "operator", conversationId, text)
    void turn.then((reply) => { if (reply !== undefined) this.#endTurn(conversationId, reply.text) })
      .catch((error) => { this.bus.push({ type: "log", level: "error", scope: "mantis.session", message: "turn failed: " + String(error) }) })
      .finally(() => this.#inflight.delete(conversationId))
    return { ok: true }
  }
}
