import type { StateStore } from "@json-render/core"
import type { UiActionSpec, UiSourceSpec } from "@effect-agent/effect-ui"
import { loadSource } from "./effect-ui-source-runtime.ts"
import { addressed, bodyOf, declared, init, refusal, requestUrl, type Params } from "./effect-ui-action-call.ts"

/** Enters the screen an action names, carrying the values the press was made with. */
export type OpenScreen = (screen: string, params: Params) => void

/**
 * One press, and what it leaves behind.
 *
 * A press reads the thing (`url`), enters a screen (`opens`), or does both. The
 * read is one call, and its answer is written where the press was (`result`), so
 * a refusal is read under the control that caused it rather than somewhere else.
 *
 * A read that cannot be addressed is not attempted: a `{name}` in the url is the
 * resource's own id, and a press that supplies none would send the request to a
 * path the declaration does not describe — `/tasks/` rather than the task —
 * whose answer is about something else, or about nothing. The press is not then
 * a dead one: the screen it names still opens, because the destination is the
 * part of the press that has no failure mode.
 *
 * What a successful read is followed by is the two things that make its result
 * add up: `clear` empties the drafts the press consumed, and `refresh` re-runs
 * the reads whose answer the write just changed. A refresh is a read and not a
 * press — it makes its call and writes its own answer, and does not consume a
 * draft or enter a screen — which is what leaves the answer the press just wrote
 * where the operator can read it (`Formal/Refresh.lean`).
 */
export const makeActionHandlers = (actions: readonly UiActionSpec[] = [], sources: readonly UiSourceSpec[] = [], store: StateStore, open: OpenScreen = () => {}, fetcher: typeof fetch = window.fetch.bind(window), baseUrl = window.location.origin) => {
  const declaredOf = (action: UiActionSpec, runtimeParams: Params): Params =>
    ({ ...declared(action.params, store), ...runtimeParams })

  /** The read half: the call and its answer, and nothing else. Answers whether it succeeded. */
  const call = async (action: UiActionSpec, params: Params): Promise<boolean> => {
    const url = action.url
    if (url === undefined || !addressed(url, params)) return false
    const method = action.method ?? "POST"
    try {
      const response = await fetcher(requestUrl(url, method, params, baseUrl), init(url, method, params))
      const parsed = bodyOf(await response.json().catch(() => undefined), response.status)
      if (action.result !== undefined) store.set(action.result, response.ok ? parsed : refusal(parsed, response.status))
      return response.ok
    } catch (error) {
      if (action.result !== undefined) store.set(action.result, { ok: false, error: error instanceof Error ? error.message : String(error) })
      return false
    }
  }

  return Object.fromEntries(actions.map((action) => [action.name, async (runtimeParams: Params = {}) => {
    const params = declaredOf(action, runtimeParams)
    const ran = action.url !== undefined && await call(action, params)
    // Only a press that succeeded empties the drafts it consumed: taking state away
    // is something a write earns, and a press that did nothing has not earned it.
    if (ran) for (const path of action.clear ?? []) store.set(path, "")
    // Its reads re-run when it made a call and the call worked, or when it had no
    // call to make at all — the retry, which is `refresh` and nothing else. That
    // second case is safe for the reason `Formal/Refresh.lean` gives: a re-run read
    // writes its own answer and can never blank a path, so there is nothing it can
    // erase from under the operator.
    if (ran || action.url === undefined) await Promise.all((action.refresh ?? []).map(async (id) => {
      const source = sources.find((candidate) => candidate.id === id)
      if (source !== undefined) return loadSource(source, store, fetcher)
      const read = actions.find((candidate) => candidate.name === id)
      if (read !== undefined) await call(read, declaredOf(read, {}))
    }))
    if (action.opens !== undefined) open(action.opens, params)
  }]))
}
