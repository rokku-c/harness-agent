/**
 * What the herdr console reads and moves, and where the server it reads is.
 *
 * Herdr's own answer shapes, narrowed to the fields this app reads rather than
 * re-declared: an answer that grows a field is not a change to this plane, and a
 * field that disappears is caught by the console rendering it as blank.
 */
import type { HerdrClient } from "../herdr-client.ts"

export interface HerdrSurfaces {
  readonly client: HerdrClient
  /** Where the server was found, so the console can say what it is talking to. */
  readonly socketPath: string
}

export interface HerdrWorkspace {
  readonly workspace_id: string
  readonly number: number
  readonly label: string
  readonly focused: boolean
  readonly pane_count: number
  readonly tab_count: number
  readonly active_tab_id: string
  /** The loudest lifecycle among its agents: idle, working, blocked or unknown. */
  readonly agent_status: string
}

/**
 * A recognized agent. Herdr names one only at `agent.start`, and `agent.list`
 * does not report that name — so a listing identifies an agent by the pane
 * holding it, which is always a valid target, and by the title it is running
 * under, which is what an operator recognizes it by.
 */
export interface HerdrAgent {
  readonly agent: string
  readonly terminal_title_stripped: string
  readonly agent_status: string
  readonly workspace_id: string
  readonly tab_id: string
  readonly pane_id: string
  readonly focused: boolean
  readonly foreground_cwd: string
  readonly revision: number
}

/**
 * What an agent last printed, folded into the listing.
 *
 * The console cannot poll one agent's output: a view source is a fixed URL, so a
 * source naming an agent would name whichever agent was selected when the page
 * loaded and never another. Reading a tail into the listing is what makes the
 * fleet itself live. `truncated` is carried for the reason it is carried on a
 * lone read — part of an answer must not be shown as the whole of one.
 */
export interface HerdrAgentTail {
  readonly text: string
  readonly truncated: boolean
}

/** An agent as a listing reports it: the agent, and its tail when one was asked for. */
export interface HerdrAgentWithTail extends HerdrAgent {
  readonly tail?: HerdrAgentTail
}

export interface HerdrPane {
  readonly pane_id: string
  readonly workspace_id: string
  readonly tab_id: string
  /** The kind of agent in this pane, or null when it is a free shell. */
  readonly agent: string | null
  readonly cwd: string
  readonly terminal_title_stripped: string
  readonly agent_status: string
}

/**
 * What one read of an agent came back with. `truncated` is the field that
 * matters: Herdr answers with the tail when a screen holds more than was asked
 * for, so a console that showed the text without it would be presenting part of
 * an answer as the whole of one.
 */
export interface HerdrRead {
  readonly pane_id: string
  readonly text: string
  readonly format: string
  readonly revision: number
  readonly truncated: boolean
}

/**
 * Where the wire and the shapes above meet.
 *
 * Herdr's socket carries JSON and no types, so every handler narrows an answer
 * by hand. Naming the cast once keeps it to a single word in each handler, in
 * one file, beside the shapes it is narrowing to.
 */
export const typed = <T>(value: unknown): T => value as T
