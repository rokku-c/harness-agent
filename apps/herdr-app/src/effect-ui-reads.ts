/**
 * The reads this console makes: their urls, how often they run, and how much of
 * an agent's output they ask for.
 *
 * A source is a fixed url (`schema-parts.ts:25`) fetched verbatim, so how many
 * lines come back is a fact about the address and not something a screen can
 * choose at runtime. Writing it once means the fleet's source and the press that
 * retries the fleet ask for the same thing — a retry that asked for a different
 * number of lines would answer a question the failure was not about.
 *
 * The cadence is here for the same reason. A terminal that never moves is a
 * terminal an operator has to get up and look at, which is the whole thing this
 * console replaces.
 */
import type { UiNodeSpec } from "@effect-agent/effect-ui"

/** The glance at each agent that rides along with the fleet listing. */
export const FLEET_TAIL = 12
/** What an agent's own screen asks for when an operator wants to read back. */
export const SCROLLBACK_LINES = 200
export const AGENTS_REFRESH_MS = 5_000
export const WORKSPACES_REFRESH_MS = 30_000

export const FLEET_URL = `/herdr/agents?tail=${FLEET_TAIL}`
export const WORKSPACES_URL = "/herdr/workspaces"

/**
 * Terminal output, shown as it was printed.
 *
 * `pre-wrap` is the whole of it, and it is not cosmetic: the line breaks *are*
 * the output. A terminal read reflowed into prose runs a compiler's error list
 * into one paragraph and turns a table into a guess. The box is left unbounded
 * on purpose — the region around it is the one thing that scrolls, and a second
 * scrollbar inside the first is two places to look for the same text.
 */
export const terminal = (read: { readonly bind: string } | { readonly item: string }): UiNodeSpec =>
  ({ component: "Code", props: { size: "1", style: { whiteSpace: "pre-wrap", display: "block" } }, ...read })
