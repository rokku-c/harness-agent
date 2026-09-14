/**
 * The reads this console declares, and the press that repeats each one.
 *
 * A read's id is also where its verdict is kept, so a view names the read and
 * gets back the §9 failure for that read — sentence, reason in mono, and the
 * press that re-runs it. No view names a retry action, which is what leaves a
 * source's failure unable to offer a press that repeats a different read.
 *
 * The retry makes no call of its own and writes no answer: `refresh` is the whole
 * of it, so the verdict at `/_sources/<id>` stays the runtime's to write and the
 * failed tone clears itself. Nothing is emptied either — `clear` still needs a
 * call to have succeeded, and a press that wrote nothing has not earned that
 * (`Formal/Refresh.lean`).
 *
 * The sources are declared here rather than in the view because this list and the
 * retries over it are one fact: a press declared for an id no source carries is a
 * press with nothing to re-run.
 */
import { sourceStatusPath, type UiActionSpec, type UiNodeSpec, type UiSourceSpec } from "@effect-agent/effect-ui"
import { refused, retry } from "./effect-ui-refusal.ts"

export const uiHostSources = [
  { id: "runtime", url: "/ui/api/runtime", state: "/runtime", refreshMs: 5000 },
  { id: "canvases", url: "/ui/api/canvases", state: "/canvases", refreshMs: 5000 },
  { id: "components", url: "/ui/api/components", state: "/components" },
  { id: "extensions", url: "/ui/api/extensions", state: "/extensions" },
  { id: "activity", url: "/ui/api/activity", state: "/activity", refreshMs: 5000 },
] as const satisfies readonly UiSourceSpec[]

/** A read this view declares, named by the id its verdict is kept under. */
export type UiHostSource = (typeof uiHostSources)[number]["id"]

/** One refresh-only press per read: each names its own read and no other. */
export const readRetries: Record<UiHostSource, UiActionSpec> = {
  runtime: { name: "uiHost.retryRuntime", refresh: ["runtime"] },
  canvases: { name: "uiHost.retryCanvases", refresh: ["canvases"] },
  components: { name: "uiHost.retryComponents", refresh: ["components"] },
  extensions: { name: "uiHost.retryExtensions", refresh: ["extensions"] },
  activity: { name: "uiHost.retryActivity", refresh: ["activity"] },
}

/** What one read's failure looks like: the sentence, its reason, the press that reads it again. */
export const readFailed = (id: UiHostSource, sentence: string): UiNodeSpec =>
  refused(sentence, `${sourceStatusPath(id)}/error`, retry(readRetries[id].name))
