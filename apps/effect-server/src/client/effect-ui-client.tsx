import * as React from "react"
import { createRoot } from "react-dom/client"
import { JSONUIProvider, Renderer } from "@json-render/react"
import { makeEffectUiRegistry } from "./effect-ui-catalog.tsx"
import { makeConfigMount } from "./config-react-mount.tsx"
import { injectStyleLayers, roleStyleCss } from "@effect-agent/effect-ui"
import { consoleStyle } from "../console-browser-style.ts"
import { consoleThemeCss } from "../console/theme.ts"
import { consoleStylePlatform } from "../console-style-layer.ts"
import { createConfigApi } from "./config-api.ts"
import { createConfigEdits } from "./config-edits.ts"
import { describeConfigState } from "./config-state.ts"
import { createConfigPanel } from "./config-panel.ts"
import { createConsoleViews } from "./console-views.ts"
import { installThemeRuntime } from "./theme-runtime.ts"
import { bootConsole } from "./console-navigation.ts"

interface EffectUiApi { mount(container: HTMLElement, spec: unknown): void; mountConfig(container: HTMLElement, spec: unknown): ReturnType<ReturnType<typeof makeConfigMount>> }
declare global { interface Window { effectUi?: EffectUiApi } }
const registry = makeEffectUiRegistry()
const mountConfigSpec = makeConfigMount(registry)
const render = (container: HTMLElement, spec: unknown) => createRoot(container).render(<JSONUIProvider registry={registry}><Renderer spec={spec as never} registry={registry} /></JSONUIProvider>)
window.effectUi = { mount: (container, spec) => { container.replaceChildren(); render(container, spec) }, mountConfig: mountConfigSpec }
const installStyleLayers = () => injectStyleLayers(document, [{ id: "theme", cssText: consoleThemeCss(), order: -100 }, { id: "ui-roles", cssText: roleStyleCss(), order: 0 }, { id: "console", cssText: consoleStyle, order: 10 }, { id: "console-platform", cssText: consoleStylePlatform, order: 20 }])
const start = () => {
  let storage: Storage | undefined
  try { storage = window.localStorage } catch {}
  installThemeRuntime(document.documentElement, document.querySelector<HTMLButtonElement>(".status-theme"), storage)
  installStyleLayers()
  const config = createConfigPanel(createConfigApi(window.fetch.bind(window)), mountConfigSpec, describeConfigState, createConfigEdits)
  bootConsole(config, createConsoleViews())
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true }); else start()
