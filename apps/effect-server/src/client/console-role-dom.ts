import type { ConsoleEntry, ConsoleSurface } from "./console-plan.ts"
export type ConsoleRoleProps = Record<string, unknown>
export type ConsoleRoleContext = { plan: ConsoleEntry[]; open: (kind: "view" | "config", id: string) => void; navigate: (kind: "home" | "settings", id?: string) => void; openConfig?: (id: string, row?: HTMLElement) => void; selected?: string }
const label = (tag: string, className: string, value: string) => { const node = document.createElement(tag); node.className = className; node.textContent = value; return node }
const list = (props: ConsoleRoleProps) => Array.isArray(props.items) ? props.items as Array<{ id: string; title: string; surface?: ConsoleSurface }> : []
const glyph = (id: string, fallback: string): string => ({ board: "▦", "mcp-registry": "◇", "mcp-gateway": "⇄", mantis: "◉", "ai-gateway": "✦", agentd: "◌", "platform-network": "⌁" }[id] ?? fallback)
const appKind = (context: ConsoleRoleContext, id: string): "view" | "config" => context.plan.find((item) => item.id === id)?.hasView ? "view" : "config"
export const renderConsoleRole = (container: HTMLElement, type: string, props: ConsoleRoleProps, context: ConsoleRoleContext): boolean => {
  container.replaceChildren()
  if (type === "Springboard") {
    const apps = Array.isArray(props.apps) ? props.apps as Array<{ id: string; title: string }> : []; if (!apps.length) return false
    const wrap = label("div", "pad home ui-role-springboard", ""); wrap.dataset.uiRole = "springboard"; wrap.append(label("h1", "home-title", String(props.title ?? "Home"))); const widgets = Array.isArray(props.widgets) ? props.widgets as Array<{ id: string; label: string; value: string }> : []; if (widgets.length) { const row = label("div", "home-widgets", ""); widgets.forEach((widget) => { const card = label("div", "home-widget", ""); card.append(label("span", "home-widget-label", widget.label), label("strong", "home-widget-value", widget.value)); row.append(card) }); wrap.append(row) } const grid = label("div", "home-grid", ""); wrap.append(grid)
    apps.forEach((app) => { const button = document.createElement("button"); button.type = "button"; button.className = "home-app"; button.dataset.appId = app.id; button.setAttribute("aria-label", app.title); button.append(label("span", "home-ico", glyph(app.id, app.title.slice(0, 1).toUpperCase())), label("span", "home-label", app.title)); button.onclick = () => context.open(appKind(context, app.id), app.id); grid.append(button) }); container.append(wrap); return true
  }
  if (type === "SettingsGroup") {
    const apps = list(props); if (!apps.length) return false
    const wrap = label("div", "pad settings ui-role-settings", ""); wrap.dataset.uiRole = "settings-group"; const split = label("div", "settings-split", ""), rows = label("div", "settings-list", ""), detail = label("div", "settings-detail", "Select an app"); detail.dataset.settingsDetail = "true"; wrap.append(label("h1", "settings-title", String(props.title ?? "Settings")), split); split.append(rows, detail)
    apps.forEach((app) => { const button = document.createElement("button"); button.type = "button"; button.className = "settings-row"; if (context.selected === app.id) button.classList.add("on"); button.append(label("span", "settings-ico", glyph(app.id, app.title.slice(0, 1).toUpperCase())), label("span", "settings-name", app.title), label("span", "settings-chev", "›")); button.onclick = () => context.openConfig?.(app.id, button); rows.append(button) }); container.append(wrap); return true
  }
  if (type === "BottomTab") { const tabs = list(props); container.replaceChildren(); tabs.forEach((tab) => { const button = document.createElement("button"); button.type = "button"; button.dataset.uiRole = "bottom-tab-item"; button.dataset.appId = tab.id; button.dataset.surface = tab.surface ?? (tab.id === "home" ? "home" : tab.id === "settings" ? "settings" : "view"); if (context.selected === tab.id) { button.classList.add("on"); button.setAttribute("aria-current", "page") } button.textContent = tab.title; button.onclick = () => { if (tab.id === "home" || tab.id === "settings") context.navigate(tab.id); else context.open(tab.surface === "config" ? "config" : "view", tab.id) }; container.append(button) }); return true }
  return false
}
