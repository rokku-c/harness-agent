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
   * A screen id to enter. The action's parameters become that screen's, under
   * the reserved root `/_nav` (screen.ts) — a screen reads them as state.
   */
  readonly opens?: string
  /** Request parameters. Action parameters supplied by a control take precedence. */
  readonly params?: Readonly<Record<string, UiActionParam>>
  /** JSON pointer where the response body or error is stored. */
  readonly result?: string
  /**
   * State paths to blank once the call succeeded — the state the press
   * consumed: the draft it submitted, or the record it just removed, which
   * cannot stay on screen as though it were still there. A form that keeps what
   * it just submitted invites the same press twice. A path the *answer* owns
   * belongs to `result` instead: this one is only ever emptied, never written.
   */
  readonly clear?: readonly string[]
  /**
   * The reads to run again — a source id, or the name of a declared action. A
   * refresh is a read and not a press: it makes its call and writes its own
   * answer, and it consumes no draft and enters no screen. That is what lets the
   * answer this action just wrote stay where the operator can read it, while the
   * list beside it catches up.
   *
   * An action with no `url` is the retry: it has no call to make, so `refresh` is
   * the whole of the press — `{ name, refresh: [source] }` is a "Try again" for a
   * list that failed to load. `clear` still needs a call to have succeeded, since
   * emptying a draft is something only a write earns; re-reading is not, because a
   * read puts the world back and cannot take anything away.
   */
  readonly refresh?: readonly string[]
}
