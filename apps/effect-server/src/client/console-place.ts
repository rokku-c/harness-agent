import type * as React from "react"
import type { GlyphName } from "./adapt/glyphs.ts"
import type { Address, ConsoleRoute } from "./console-route.ts"
import type { ConsoleEntry } from "./console-plan.ts"
import type { ConsoleSurfaces } from "./console-surfaces.ts"

export interface PlaceContext {
  readonly plan: readonly ConsoleEntry[]
  readonly surfaces: ConsoleSurfaces
  readonly status: string
  readonly catalogue: { readonly failure?: string; readonly retry: () => void }
}

export type Chrome = "page" | "fill"

export interface Surface {
  readonly kinds: readonly ConsoleRoute["kind"][]
  readonly chrome: Chrome
  readonly claim: (address: Address, plan: readonly ConsoleEntry[]) => ConsoleRoute | undefined
  readonly view: (route: ConsoleRoute, context: PlaceContext) => React.ReactNode
}

export interface Place extends Surface {
  readonly id: string
  readonly title: string
  readonly route: ConsoleRoute
  readonly mark: GlyphName
  readonly color: string
}
