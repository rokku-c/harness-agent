/** Existing iframe / HTML / json-render view paths stay independent of config. */
export const viewSurfaceMarkup = () => '<div data-view class="view-surface"></div>'

type ViewClient = { mount(element: HTMLElement, spec: unknown): void }
const viewClient = () => (window as Window & { effectUi?: ViewClient }).effectUi

export function createConsoleViews() {
  const controllers = new WeakMap<HTMLElement, AbortController>()
  const mountSpec = (container: HTMLElement, spec: unknown) => {
    let attempts = 0
    const wait = () => {
      if (!container.isConnected) return
      const api = viewClient()
      if (api) try { api.mount(container, spec) } catch (error) {
        container.textContent = `View rendering failed: ${(error as Error).message}`
      }
      else if (++attempts < 100) setTimeout(wait, 60)
      else container.textContent = "View client failed to load; check /console-client.js and retry. Configuration forms do not depend on it."
    }
    wait()
  }
  return async (panel: HTMLElement, id: string, current: () => boolean) => {
    controllers.get(panel)?.abort()
    const controller = new AbortController(); controllers.set(panel, controller)
    const response = await fetch(`/console/api/view/${encodeURIComponent(id)}`, { cache: "no-store", signal: controller.signal })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error ?? data.detail ?? `HTTP ${response.status}`)
    if (controller.signal.aborted || !current()) return
    panel.replaceChildren()
    const content = document.createElement("div")
    content.dataset.view = ""; content.className = "view-surface"; panel.append(content)
    if (data.path || (!data.view && data.html !== undefined)) {
      content.className += " view-embed"
      const frame = document.createElement("iframe")
      frame.title = id; frame.loading = "eager"; frame.referrerPolicy = "no-referrer"
      if (data.path) frame.src = data.path; else frame.srcdoc = data.html
      content.append(frame)
    } else if (data.view && data.jsonSpec) {
      content.className += " view-spec"; mountSpec(content, data.jsonSpec)
    } else content.textContent = data.detail ?? "This app has no renderable view."
  }
}
