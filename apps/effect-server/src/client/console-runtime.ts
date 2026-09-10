import { parseConsoleHash, planConsole, type ConsoleDockItem, type ConsoleEntry, type ConsoleSystemUi } from "./console-plan.ts"
import { renderHome, renderSettings, showError } from "./console-dom.ts"
import { roleItems, renderRole } from "./console-role-renderer.ts"
type OpenPanel = (panel: HTMLElement, id: string, current: () => boolean) => Promise<void>
type Target = "view" | "config" | "home" | "settings" | "settings-config" | "apps"
const glyph = (id: string, fallback: string): string => ({ home: "⌂", settings: "⚙", "platform-network": "⌁", board: "▦", "mcp-registry": "◇", "mcp-gateway": "⇄", mantis: "◉", "ai-gateway": "✦", agentd: "◌" }[id] ?? fallback)
export const clearActive = (rail: HTMLElement) => rail.querySelectorAll<HTMLElement>(".app-link").forEach((item) => { item.classList.remove("on"); item.removeAttribute("aria-current") })
export const makeButton = (label: string, id: string, kind: Target, open: (k: Target, id?: string, el?: HTMLElement) => void) => {
  const button = document.createElement("button"); button.type = "button"; button.className = "app-link"; button.dataset.surface = kind
  const icon = document.createElement("span"), title = document.createElement("span"); icon.className = "app-icon"; icon.dataset.uiRole = "app-icon"; icon.textContent = glyph(id, label.slice(0, 1).toUpperCase()); title.textContent = label
  button.dataset.appId = id; button.title = label; button.setAttribute("aria-label", label); button.append(icon, title); button.onclick = () => open(kind, id, button); return button
}
export const splitDockItems = (items: ConsoleDockItem[]) => {
  const firstTransient = items.findIndex((item) => !item.persistent)
  return firstTransient < 0 ? { persistent: items, transient: [] as ConsoleDockItem[] } : { persistent: items.slice(0, firstTransient), transient: items.slice(firstTransient) }
}
const dockItem = (entry: ConsoleEntry): ConsoleDockItem => ({ id: entry.id, title: entry.title, surface: entry.hasView ? "view" : "config", persistent: true })
const visibleDock = (items: ConsoleDockItem[]) => {
  const narrow = window.innerWidth <= 700, slot = narrow ? 72 : 86, gap = narrow ? 4 : 8, padding = narrow ? 12 : 28
  const capacity = Math.max(1, Math.floor((window.innerWidth - 20 - padding + gap) / (slot + gap)))
  return items.length > capacity ? { items: items.slice(0, Math.max(0, capacity - 1)), more: true } : { items, more: false }
}
const appendMore = (rail: HTMLElement, open: (k: Target, id?: string, el?: HTMLElement) => void) => {
  const button = makeButton("All Apps", "__apps", "apps", open); button.classList.add("more-link")
  const icon = button.querySelector<HTMLElement>(".app-icon"); if (icon) icon.textContent = "•••"
  rail.append(button)
}
export const renderRail = (rail: HTMLElement, plan: ConsoleEntry[], open: (k: Target, id?: string, el?: HTMLElement) => void, systemUi?: ConsoleSystemUi) => {
  const fallback = [...plan.map(dockItem), { id: "settings", title: "Settings", surface: "settings" as const, persistent: true }]
  const dock = roleItems(renderRole(systemUi, "Dock", { items: fallback }), "items") as ConsoleDockItem[]
  const limited = visibleDock(dock), groups = splitDockItems(limited.items); rail.replaceChildren(); rail.dataset.uiRole = "dock"
  groups.persistent.forEach((app) => rail.append(makeButton(app.title, app.id, app.surface, open)))
  if (groups.transient.length) { const divider = document.createElement("span"); divider.className = "dock-divider"; divider.setAttribute("role", "separator"); divider.setAttribute("aria-label", "Temporary applications"); rail.append(divider); groups.transient.forEach((app) => rail.append(makeButton(app.title, app.id, app.surface, open))) }
  if (limited.more) appendMore(rail, open)
}
export const runConsole = (config: OpenPanel, view: OpenPanel) => {
  const panel = document.getElementById("panel")!, rail = document.getElementById("rail")!
  const homeButton = document.querySelector?.<HTMLElement>(".status-home") ?? null
  const shellMenu = document.querySelector?.<HTMLElement>(".shell-menu") ?? null
  const statusTitle = document.querySelector?.<HTMLElement>(".status-title"), statusState = document.querySelector?.<HTMLElement>(".status-state")
  let generation = 0, plan: ConsoleEntry[] = [], systemUi: ConsoleSystemUi | undefined
  const error = (message: string) => showError(panel, message)
  const setView = (view: "home" | "app") => { document.body.dataset.shellView = view }
  const activate = (id?: string) => {
    document.querySelectorAll<HTMLElement>("[data-app-id]").forEach((item) => { const active = id === item.dataset.appId; item.classList.toggle("on", active); if (active) item.setAttribute("aria-current", "page"); else item.removeAttribute("aria-current") })
    homeButton?.classList.toggle("on", id === "home")
  }
  const clock = document.querySelector?.<HTMLElement>("[data-status-time]")
  const updateClock = () => { if (clock) clock.textContent = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date()) }
  updateClock(); setInterval(updateClock, 30_000)
  const open = (kind: Target, id?: string, highlight?: HTMLElement) => {
    const ticket = ++generation, desktop = kind === "home" || kind === "apps", activeId = kind === "home" ? "home" : kind === "apps" ? "apps" : kind === "settings" || kind === "settings-config" ? "settings" : id
    setView(desktop ? "home" : "app")
    activate(activeId); if (statusTitle) statusTitle.textContent = kind === "home" ? "effect-agent" : kind === "apps" ? "All Apps" : kind === "settings" || kind === "settings-config" ? "Settings" : plan.find((entry) => entry.id === id)?.title ?? id ?? "effect-agent"
    if (highlight) { clearActive(rail); highlight.classList.add("on"); highlight.setAttribute("aria-current", "page") }
    if (kind === "home" || kind === "apps" || kind === "settings" || kind === "settings-config") {
      const selected = kind === "settings-config" ? id : undefined; history.replaceState(null, "", kind === "home" ? "#" : kind === "apps" ? "#apps" : selected ? `#settings/config/${encodeURIComponent(selected)}` : "#settings")
      if (kind === "home" || kind === "apps") renderHome(panel, plan, (next, value) => open(next, value), systemUi, kind === "apps" ? "All Apps" : "Home")
      else renderSettings(panel, plan, (target) => open("settings-config", target), systemUi, selected)
      const role = kind === "settings" || kind === "settings-config" ? "settings-group" : "springboard"
      if (!panel.querySelector(`[data-ui-role="${role}"]`)) error(role === "springboard" ? "No apps discovered." : "No configurable apps.")
      if (selected) { const detail = panel.querySelector<HTMLElement>("[data-settings-detail]"); if (detail) void config(detail, selected, () => ticket === generation).catch((cause) => { if (ticket === generation) error(cause.message) }) }
      return
    }
    if (!id) return; history.replaceState(null, "", `#${kind}/${encodeURIComponent(id)}`); panel.innerHTML = '<div class="pad">Loading…</div>'
    void (kind === "config" ? config : view)(panel, id, () => ticket === generation).catch((cause) => { if (ticket === generation) error(cause.message) })
  }
  const boot = async () => {
    const response = await fetch("/-/apps", { cache: "no-store" }); if (!response.ok) throw new Error(`App catalogue request failed: HTTP ${response.status}`)
    const catalogue = await response.json(); const planes = await fetch("/-/planes", { cache: "no-store" }).then((result) => { if (!result.ok) throw new Error("status unavailable"); return result.json() }).catch(() => null)
    if (statusState) statusState.textContent = Array.isArray(planes) ? `${planes.filter((plane: { enabled?: boolean }) => plane.enabled).length} services active` : "Status unavailable"
    systemUi = catalogue.systemUi; plan = planConsole(catalogue); renderRail(rail, plan, open, systemUi)
    window.addEventListener("resize", () => renderRail(rail, plan, open, systemUi))
    if (homeButton) homeButton.onclick = () => open("home")
    if (shellMenu) shellMenu.onclick = () => open("home")
    const select = () => { const route = parseConsoleHash(location.hash, plan); open(route.kind, route.id) }
    window.addEventListener("hashchange", select); select()
  }
  void boot().catch((cause) => error(cause.message))
}
