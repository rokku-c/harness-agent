import type { UiActionSpec, UiSourceSpec } from "@effect-agent/effect-ui"
import type { ScreenPayload } from "./effect-ui-runtime-types.ts"

export interface ViewPayload {
  readonly id: string
  readonly screens: readonly ScreenPayload[]
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
