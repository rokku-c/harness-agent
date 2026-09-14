import * as React from "react"
import "@radix-ui/themes/styles.css"
import "./console-shell.css"
import { createRoot } from "react-dom/client"
import type { ComponentRegistry } from "@json-render/react"
import { EffectUiRuntime } from "./effect-ui-runtime.tsx"
import type { EffectUiRuntimeSpec } from "./effect-ui-runtime-types.ts"
import { makeConfigMount } from "./config-react-mount.tsx"
import { configComponents } from "./adapt/config-fields.tsx"
import { Preview } from "./adapt/preview.tsx"
import { createConfigApi } from "./config-api.ts"
import { ConsoleShell } from "./console-shell.tsx"
import { bootThemeMode } from "./theme-runtime.ts"
import type { ConsoleSurfaces } from "./console-surfaces.ts"

interface EffectUiApi {
  /** Mounts a view and returns the only way to take it down again. */
  mount(container: HTMLElement, runtime: EffectUiRuntimeSpec): () => void
}
declare global { interface Window { effectUi?: EffectUiApi } }

/**
 * What a view may name that the design system does not have. It is a constant
 * rather than a fresh object per mount because `@json-render` keys its own
 * per-registry metadata on the registry's identity: a new object is a new
 * registry, and everything under it is rebuilt from nothing.
 */
const own: ComponentRegistry = { Preview }

window.effectUi = {
  mount: (container, runtime) => {
    container.replaceChildren()
    const root = createRoot(container)
    root.render(<EffectUiRuntime ours={own} runtime={runtime} />)
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
    config: { api: createConfigApi(window.fetch.bind(window)), mountConfig: makeConfigMount(configComponents) },
  }
  createRoot(root).render(<ConsoleShell surfaces={surfaces} />)
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true }); else start()
