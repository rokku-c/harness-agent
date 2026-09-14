import { toEffectTools, type EffectTool, type Operation } from "@effect-agent/effect-interface"
import { activityOperations } from "./activity.ts"
import { canvasOperations } from "./canvas.ts"
import { presentationOperations } from "./presentation.ts"
import { readOperations } from "./read.ts"
import type { UiSurfaces } from "./surfaces.ts"

export type { ExtensionSource, UiSurfaces } from "./surfaces.ts"

export const uiOperations = (surfaces: UiSurfaces): readonly Operation[] => [
  ...readOperations(surfaces),
  ...activityOperations(surfaces),
  ...canvasOperations(surfaces),
  ...presentationOperations(surfaces),
]

export const makeUiTools = (surfaces: UiSurfaces): readonly EffectTool[] => toEffectTools(uiOperations(surfaces))
