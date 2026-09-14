/**
 * One app's view, read on its own.
 *
 * This used to be the one call that decided which surface an app had: the server
 * answered either a declarative view or the tool inspector, so an app that
 * registered operations opened its inspector at the view address — and lost it
 * the moment it also drew anything (`flows.md` §1.6, verified in source). The two
 * are separate addresses now, so this read answers one question about one
 * surface: *does this app declare a view*, and if so, what screens does it have.
 *
 * A missing view is an answer, not an exception. It arrives as `missing` rather
 * than as a thrown error because it is an expected outcome of a legitimate
 * address — a link to an app that drew nothing, or to one that was unregistered
 * since the link was written — and a caller that has to catch to tell the two
 * apart would be a caller that reports the ordinary case as a failure.
 */

import type { UiActionSpec, UiSourceSpec } from "@effect-agent/effect-ui"
import type { ScreenPayload } from "./effect-ui-runtime-types.ts"

export interface ViewPayload {
  readonly id: string
  readonly screens: readonly ScreenPayload[]
  /** Whether the screens were read off the layout rather than declared. See `EffectUiRuntimeSpec`. */
  readonly menu: boolean
  readonly actions?: readonly UiActionSpec[]
  readonly sources?: readonly UiSourceSpec[]
}

export type ViewRead = ViewPayload | { readonly kind: "missing"; readonly detail: string }

interface Frame {
  readonly id?: string
  readonly screens?: readonly ScreenPayload[]
  readonly menu?: boolean
  readonly detail?: string
  readonly view?: { readonly actions?: readonly UiActionSpec[]; readonly sources?: readonly UiSourceSpec[] }
}

export const loadView = async (id: string): Promise<ViewRead> => {
  const response = await fetch(`/console/api/view/${encodeURIComponent(id)}`, { cache: "no-store" })
  const frame = await response.json() as Frame
  if (response.status === 404) return { kind: "missing", detail: frame.detail ?? `no view for ${id}` }
  if (!response.ok) throw new Error(frame.detail ?? `HTTP ${response.status}`)
  return {
    id: frame.id ?? id, screens: frame.screens ?? [], menu: frame.menu === true,
    ...(frame.view?.actions === undefined ? {} : { actions: frame.view.actions }),
    ...(frame.view?.sources === undefined ? {} : { sources: frame.view.sources }),
  }
}

export const isView = (read: ViewRead): read is ViewPayload => !("kind" in read)
