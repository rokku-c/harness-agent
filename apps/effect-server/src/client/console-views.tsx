/** Declarative app views stay independent of config. */
import type { OpenPanel } from "./console-surfaces.ts"
import { mountInspector } from "./console-tools.tsx"
import type { InspectorPayload } from "./inspector-types.ts"
import type { EffectUiRuntimeSpec } from "./effect-ui-runtime-types.ts"

type ViewClient = { mount(element: HTMLElement, runtime: EffectUiRuntimeSpec): () => void }
const viewClient = () => (window as Window & { effectUi?: ViewClient }).effectUi

export function createConsoleViews(): OpenPanel {
  const controllers = new WeakMap<HTMLElement, AbortController>()
  return async (panel: HTMLElement, id: string, current: () => boolean) => {
    controllers.get(panel)?.abort()
    const controller = new AbortController(); controllers.set(panel, controller)
    const response = await fetch(`/console/api/view/${encodeURIComponent(id)}`, { cache: "no-store", signal: controller.signal })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error ?? data.detail ?? `HTTP ${response.status}`)
    if (controller.signal.aborted || !current()) return () => {}
    const content = document.createElement("div")
    // A link in the screen chain, not a spare wrapper: a surface is mounted into
    // this element, so the height it is given is the height its view can lay
    // itself out against. Inert on a document route (see console-shell.css).
    content.className = "view-fill"
    panel.replaceChildren(content)
    // The server decides which surface an app has — its own view, or the tool
    // inspector for an app that only registers MCP — so a mount is one decision
    // made in one place rather than a guess the client makes about the app.
    if (data.kind === "tools") return mountInspector(content, data as InspectorPayload)
    const api = viewClient()
    if (data.view && data.screens && api) {
      return api.mount(content, { appId: data.id, screens: data.screens, menu: data.menu === true, actions: data.view.actions, sources: data.view.sources })
    }
    content.textContent = api ? data.detail ?? "This app has no renderable view." : "View client failed to load; check /console-client.js and retry."
    return () => {}
  }
}
