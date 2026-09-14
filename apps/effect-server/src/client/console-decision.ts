export type DecisionClass = "call.foreground" | "call.background" | "write.protected" | "channel.startup"
export type DecisionState = "waiting" | "answered" | "expired" | "withdrawn" | "already-answered-elsewhere"

export interface Decision {
  readonly id: string
  readonly class: DecisionClass
  readonly raisedBy: string
  readonly raisedFor: string
  readonly subject: string
  readonly reasons: readonly string[]
  readonly deadline: number
  readonly state: DecisionState
  readonly verdict?: "allow" | "deny"
  readonly answeredBy?: string
  readonly answeredAt?: number
  readonly answerSource?: string
  readonly recovery?: string
}

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
