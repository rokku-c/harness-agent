/**
 * Mounting the tool inspector.
 *
 * The view surface hands a panel to whichever surface the server named, and an
 * app with tools and no view names this one. Like a declarative view it owns a
 * React root, so it returns the same disposer: the shell unmounts it when the
 * reader moves on. A root of its own is also outside the shell's tree, which is
 * why it carries `ConsoleTheme` — a component that portals (`Select.Content`)
 * reads the theme through context, and a portal keeps the context of its own
 * tree, not of the page it lands in.
 */

import * as React from "react"
import { createRoot } from "react-dom/client"
import { ConsoleTheme } from "./console-theme.tsx"
import { Inspector } from "./inspector-panel.tsx"
import type { InspectorPayload } from "./inspector-types.ts"

export const mountInspector = (container: HTMLElement, payload: InspectorPayload): (() => void) => {
  const root = createRoot(container)
  root.render(<ConsoleTheme><Inspector {...payload} /></ConsoleTheme>)
  return () => { root.unmount() }
}
