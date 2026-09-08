/**
 * Parity core types — the machine-parity view of one app.
 *
 * A human gets EXACTLY what an agent sees: the same declarative UiDocument
 * (`view`), the same live `state`, and the same set of actions the agent can
 * take (parity: no extra actions, no fewer).
 */

/** One action an agent can take — name + JSON schema exactly as its tool uses. */
export interface ParityAction {
  readonly name: string
  readonly description?: string
  /** JSON schema the agent tool validates against (drives the human form). */
  readonly inputSchema?: unknown
}

/** Everything needed to re-present an app's perspective interactively. */
export interface ParityAppView {
  readonly ns: string
  readonly appId: string
  readonly view?: unknown /* UiDocument */
  readonly state?: unknown
  readonly actions: readonly ParityAction[]
}
