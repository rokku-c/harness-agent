/**
 * The decision, and the action item beside it: the Inbox's two kinds.
 *
 * `flows.md` §1.5 makes the decision a first-class object because the product's
 * weakest join is that one approval arrives in four unrelated places — mantis's
 * screen, the deck's consent table, a DingTalk card, an MCP tool — and a human
 * looking at the wrong one cannot answer while the agent stays stuck. The fields
 * below are that table, and this file only reads them: the console owns what a
 * decision is shown as, never what it is.
 *
 * The store behind this read is host work and does not exist yet — §9.1's durable
 * decision store and §9.2's action-item kind. So the read is written against the
 * shape §1.5 defines, and `/console/api/inbox` answers 404 today. That is
 * reported as the failure it is (§2.H12) rather than papered over with an empty
 * queue: a queue that reads as empty when the truth is that nobody asked would
 * tell an operator nothing is waiting on them, which is the one answer this
 * surface must never invent.
 */

export type DecisionClass = "call.foreground" | "call.background" | "write.protected" | "channel.startup"
export type DecisionState = "waiting" | "answered" | "expired" | "withdrawn" | "already-answered-elsewhere"

export interface Decision {
  /** Stable and linkable for the life of the host's record: it is the address `#inbox/<id>`. */
  readonly id: string
  /** The class decides the deadline and the routing. */
  readonly class: DecisionClass
  /** The app or `platform` that asked for the gate. */
  readonly raisedBy: string
  /** The principal whose call is blocked. */
  readonly raisedFor: string
  /** The operation and its arguments, in full, readable by a human. */
  readonly subject: string
  readonly reasons: readonly string[]
  /** An absolute time. */
  readonly deadline: number
  readonly state: DecisionState
  readonly verdict?: "allow" | "deny"
  readonly answeredBy?: string
  readonly answeredAt?: number
  /** Console, channel or agent: where the one verdict came from. */
  readonly answerSource?: string
  /** The one action that fixes it when the answer is deny. */
  readonly recovery?: string
}

/** Not a decision: it has no verdict and only one recovering action. */
export interface ActionItem {
  readonly id: string
  readonly app?: string
  readonly title: string
  readonly detail?: string
  readonly action: string
}

export interface InboxSnapshot {
  readonly decisions: readonly Decision[]
  readonly actionItems: readonly ActionItem[]
}

export const loadInbox = async (): Promise<InboxSnapshot> => {
  const response = await fetch("/console/api/inbox", { cache: "no-store" })
  if (!response.ok) throw new Error(`/console/api/inbox: HTTP ${response.status}`)
  const data = await response.json() as Partial<InboxSnapshot>
  return { decisions: data.decisions ?? [], actionItems: data.actionItems ?? [] }
}
