type OpenPanel = (panel: HTMLElement, id: string, current: () => boolean) => Promise<void>

export function bootConsole(config: OpenPanel, view: OpenPanel) {
  const panel = document.getElementById("panel")!, rail = document.getElementById("rail")!
  let generation = 0
  const error = (message: string) => {
    panel.replaceChildren()
    const block = document.createElement("p")
    block.className = "pad config-feedback"; block.dataset.tone = "error"; block.setAttribute("role", "alert")
    block.textContent = message; panel.append(block)
  }
  const boot = async () => {
    const response = await fetch("/-/apps", { cache: "no-store" })
    if (!response.ok) throw new Error(`应用列表读取失败：HTTP ${response.status}`)
    const catalogue = await response.json()
    const entries: { kind: string; id: string; button: HTMLButtonElement; open: () => void }[] = []
    const push = (label: string, id: string, kind: string, render: OpenPanel) => {
      const button = document.createElement("button")
      button.type = "button"; button.className = "app-link"
      const icon = document.createElement("span"), title = document.createElement("span")
      icon.className = "app-icon"; icon.textContent = label.slice(0, 1).toUpperCase()
      title.textContent = label; button.append(icon, title)
      const open = () => {
        const ticket = ++generation
        rail.querySelectorAll(".app-link").forEach(item => { item.classList.remove("on"); item.removeAttribute("aria-current") })
        button.classList.add("on"); button.setAttribute("aria-current", "page")
        history.replaceState(null, "", `#${kind}/${encodeURIComponent(id)}`)
        panel.innerHTML = '<div class="pad">正在加载…</div>'
        void render(panel, id, () => ticket === generation).catch(cause => { if (ticket === generation) error(cause.message) })
      }
      button.onclick = open; rail.append(button); entries.push({ kind, id, button, open })
    }
    const heading = (text: string) => { const h = document.createElement("h3"); h.textContent = text; rail.append(h) }
    heading("APPLICATIONS")
    ;(catalogue.ui ?? []).forEach((app: { title: string; interfaceId: string }) => push(app.title ?? app.interfaceId, app.interfaceId, "view", view))
    ;(catalogue.views ?? []).forEach((id: string) => {
      if (!entries.some(entry => entry.kind === "view" && entry.id === id)) push(id, id, "view", view)
    })
    heading("CONFIGURATION")
    ;(catalogue.config ?? []).forEach((app: { title: string; appId: string }) => push(app.title ?? app.appId, app.appId, "config", config))
    const select = () => {
      const match = location.hash.match(/^#(config|view)\/(.+)$/)
      let selected
      try { selected = match && entries.find(entry => entry.kind === match[1] && entry.id === decodeURIComponent(match[2])) } catch { /* invalid hash */ }
      ;(selected || entries.find(entry => entry.kind === "config") || entries[0])?.open()
    }
    window.addEventListener("hashchange", select)
    select()
  }
  void boot().catch(cause => error(cause.message))
}
