import * as React from "react"
import "@radix-ui/themes/styles.css"
import "./console-shell.css"
import { createRoot } from "react-dom/client"
import { makeEffectUiRegistry } from "./effect-ui-catalog.tsx"
import { EffectUiRuntime } from "./effect-ui-runtime.tsx"
import type { EffectUiRuntimeSpec } from "./effect-ui-runtime-types.ts"
import { makeConfigMount } from "./config-react-mount.tsx"
import { configComponents } from "./config-fields.tsx"
import { createConfigApi } from "./config-api.ts"
import { createConsoleViews } from "./console-views.tsx"
import { ConsoleShell } from "./console-shell.tsx"
import { bootThemeMode } from "./theme-runtime.ts"
import type { ConsoleSurfaces } from "./console-surfaces.ts"

interface EffectUiApi {
  /** Mounts a view and returns the only way to take it down again. */
  mount(container: HTMLElement, runtime: EffectUiRuntimeSpec): () => void
}
declare global { interface Window { effectUi?: EffectUiApi } }

const registry = makeEffectUiRegistry()
window.effectUi = {
  mount: (container, runtime) => {
    container.replaceChildren()
    const root = createRoot(container)
    root.render(<EffectUiRuntime registry={registry} runtime={runtime} />)
    return () => { root.unmount() }
  },
}

const start = () => {
  let storage: Storage | undefined
  try { storage = window.localStorage } catch {}
  bootThemeMode(storage)
  const root = document.getElementById("console-root")
  if (root === null) return
  const surfaces: ConsoleSurfaces = {
    view: createConsoleViews(),
    config: { api: createConfigApi(window.fetch.bind(window)), mountConfig: makeConfigMount(makeEffectUiRegistry(configComponents)) },
  }
  createRoot(root).render(<ConsoleShell surfaces={surfaces} />)
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true }); else start()
