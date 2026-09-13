/**
 * The UI runtime's whole surface, declared once.
 *
 * These declarations are served twice - as the MCP tools an agent drives the
 * canvas with, and as the routes the console's browser reads it from - so the
 * two cannot accept different arguments or answer differently. The canvas moves
 * are the exception in one direction only: they are tools, and the browser
 * reaches the same runtime calls through the host's own `POST /api/command`
 * envelope, which is a different thing from a named call.
 */
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

/** The same list as tools: what an agent reaches over MCP. */
export const makeUiTools = (surfaces: UiSurfaces): readonly EffectTool[] => toEffectTools(uiOperations(surfaces))
