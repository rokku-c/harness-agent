/**
 * effect-ui's renderer contract.
 *
 * An `EffectUiView` renders to a string through a `UiRenderer`. This package
 * ships one — `htmlRenderer` — and `document.ts` calls it. A caller that needs
 * to choose among renderers by id registers one with `@effect-agent/ui-renderer`,
 * which is the registry the ui-host path uses.
 */

import type { EffectUiView } from "./spec.ts"

export interface UiRenderer {
  readonly id: string
  render(view: EffectUiView): string
}
