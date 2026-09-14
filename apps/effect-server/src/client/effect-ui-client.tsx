import * as React from "react"
import "@radix-ui/themes/styles.css"
import "./console-shell.css"
import { createRoot } from "react-dom/client"
import { makeConfigMount } from "./config-react-mount.tsx"
import { configComponents } from "./adapt/config-fields.tsx"
import { createConfigApi } from "./config-api.ts"
import { ConsoleShell } from "./console-shell.tsx"
import { bootThemeMode } from "./theme-runtime.ts"
import type { ConsoleSurfaces } from "./console-surfaces.ts"

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
