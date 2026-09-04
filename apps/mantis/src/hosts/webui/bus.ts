/**
 * The web console's observability bus: every noteworthy event (session
 * activity, tool calls, messages, approvals, agent UI updates, replies) is
 * pushed here and streamed to open console pages over SSE, with a small ring
 * kept for late joiners / the state endpoint.
 */
export type BusEvent =
  | { readonly type: "message.in"; readonly conversationId: string; readonly text: string }
  | { readonly type: "reply"; readonly conversationId: string; readonly text: string }
  | { readonly type: "session.start"; readonly conversationId: string }
  | { readonly type: "session.stop"; readonly conversationId: string }
  | { readonly type: "tool"; readonly conversationId: string; readonly tool: string; readonly state: "call" | "ok" | "fail"; readonly detail?: string }
  | { readonly type: "approval.pending"; readonly callId: string; readonly tool: string; readonly input: unknown }
  | { readonly type: "approval.resolved"; readonly callId: string; readonly allow: boolean }
  | { readonly type: "ui.updated"; readonly version: number; readonly author: string }
  | { readonly type: "log"; readonly level: string; readonly scope: string; readonly message: string }
  | { readonly type: "conv.new"; readonly conversationId: string }

export type DatedBusEvent = BusEvent & { readonly ts: number }

export class Bus {
  readonly #ring: DatedBusEvent[] = []
  readonly #subscribers = new Set<(event: DatedBusEvent) => void>()
  readonly push = (event: BusEvent): void => {
    const dated: DatedBusEvent = { ...event, ts: Date.now() }
    this.#ring.push(dated)
    if (this.#ring.length > 200) this.#ring.shift()
    for (const subscriber of this.#subscribers) subscriber(dated)
  }
  /** recent events for a late-joining page */
  readonly history = (): ReadonlyArray<DatedBusEvent> => [...this.#ring]
  /** events strictly after a timestamp (MCP polling: no per-client state) */
  readonly after = (ts: number): ReadonlyArray<DatedBusEvent> => this.#ring.filter((event) => event.ts > ts)
  readonly subscribe = (onEvent: (event: DatedBusEvent) => void): (() => void) => {
    this.#subscribers.add(onEvent)
    return () => this.#subscribers.delete(onEvent)
  }
}