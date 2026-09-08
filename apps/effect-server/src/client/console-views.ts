/** Existing iframe / HTML / json-render view paths stay independent of config. */
export function createConsoleViews() {
  const mountSpec = (container: HTMLElement, spec: unknown) => {
    let attempts = 0
    const wait = () => {
      if (!container.isConnected) return
      const api = (window as Window & { effectUi?: { mount(element: HTMLElement, spec: unknown): void } }).effectUi
      if (api) {
        try { api.mount(container, spec) } catch (error) { container.textContent = `视图渲染失败：${(error as Error).message}` }
      } else if (++attempts < 100) setTimeout(wait, 60)
      else container.textContent = "视图客户端加载失败；请检查 /console-client.js 后重试。配置表单不依赖该文件。"
    }
    wait()
  }
  return async (panel: HTMLElement, id: string, current: () => boolean) => {
    const response = await fetch(`/console/api/view/${encodeURIComponent(id)}`, { cache: "no-store" })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error ?? data.detail ?? `HTTP ${response.status}`)
    if (!current()) return
    panel.innerHTML = '<div class="bar"><b></b><span class="sub"></span></div><div data-view></div>'
    panel.querySelector(".bar b")!.textContent = data.view?.title ?? id
    const content = panel.querySelector<HTMLElement>("[data-view]")!
    if (data.path || (!data.view && data.html !== undefined)) {
      panel.querySelector(".sub")!.textContent = data.path ? `LIVE · ${data.path}` : "HTML VIEW"
      content.className = "frame-wrap"
      const frame = document.createElement("iframe")
      frame.title = id
      if (data.path) frame.src = data.path
      else frame.srcdoc = data.html
      content.append(frame)
    } else if (data.view && data.jsonSpec) {
      panel.querySelector(".sub")!.textContent = "DECLARATIVE EFFECT-UI · JSON-RENDER"
      content.className = "pad"
      mountSpec(content, data.jsonSpec)
    } else content.textContent = data.detail ?? "此应用未提供可渲染视图。"
  }
}
