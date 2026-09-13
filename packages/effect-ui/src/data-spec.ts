import type { UiActionParam } from "./value-spec.ts"

/**
 * A read-only source copied into view state by the host runtime.
 *
 * The body lands at `state` and *only* on success, so a source that fails
 * leaves the last rows it delivered where they are. How the read went is a
 * separate record the runtime keeps at `/_sources/<id>` — a reserved root, not
 * something a view declares. Read it through `sourceStates()` /
 * `sourceStatusPath()` (`source-status.ts`) rather than by spelling the path.
 */
export interface UiSourceSpec {
  readonly id: string
  readonly url: string
  /** JSON pointer in view state where the response body is stored. */
  readonly state: string
  readonly refreshMs?: number
}

/**
 * A declarative write/fetch action exposed by the app view.
 *
 * An action is a named behaviour, and a press that enters a screen is a
 * behaviour like any other: it says `opens` instead of, or as well as, `url`.
 * The two together are one press with two effects — read the thing, then show
 * it — which is what opening a record is; the fetch fills `result` and the
 * screen renders it.
 */
export interface UiActionSpec {
  readonly name: string
  readonly method?: "GET" | "POST" | "PATCH" | "DELETE"
  /** The address to call. An action has this, `opens`, or both. */
  readonly url?: string
  /**
   * A screen id to enter. The action's parameters become that screen's — read
   * them through `navParam` (screen.ts) rather than by spelling the path.
   */
  readonly opens?: string
  /** Request parameters. Action parameters supplied by a control take precedence. */
  readonly params?: Readonly<Record<string, UiActionParam>>
  /** JSON pointer where the response body or error is stored. */
  readonly result?: string
  /**
   * State paths to blank once the call succeeded — the draft the press
   * consumed. A form that keeps what it just submitted invites the same press
   * twice. A path the *answer* owns belongs to `result` instead: this one is
   * only ever emptied, never written.
   */
  readonly clear?: readonly string[]
  /** Source ids to reload after a successful action. */
  readonly refresh?: readonly string[]
}
