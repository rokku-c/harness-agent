import { configApps, homeApps, type ConsoleEntry, type ConsoleSystemUi } from "./console-plan.ts"
import { renderRole } from "./console-role-renderer.ts"
import { renderConsoleRole, type ConsoleRoleProps } from "./console-role-dom.ts"
export type Navigate = (kind: "view" | "config", id: string) => void
export const text = (tag: string, className: string, value: string) => { const node = document.createElement(tag); node.className = className; node.textContent = value; return node }
const roleProps = (spec: ConsoleSystemUi | undefined, type: string, fallback: ConsoleRoleProps): ConsoleRoleProps => renderRole(spec, type, fallback).props
export const renderHome = (panel: HTMLElement, plan: ConsoleEntry[], open: Navigate, systemUi?: ConsoleSystemUi, title = "Home") => renderConsoleRole(panel, "Springboard", { ...roleProps(systemUi, "Springboard", { apps: homeApps(plan), title }), title }, { plan, open, navigate: () => {} })
export const renderSettings = (panel: HTMLElement, plan: ConsoleEntry[], openConfig: (id: string, row?: HTMLElement) => void, systemUi?: ConsoleSystemUi, selected?: string) => renderConsoleRole(panel, "SettingsGroup", roleProps(systemUi, "SettingsGroup", { items: configApps(plan), title: "Settings" }), { plan, open: () => {}, navigate: () => {}, openConfig, selected })
export const showError = (panel: HTMLElement, message: string) => { panel.replaceChildren(); const block = text("p", "pad config-feedback", message); block.dataset.tone = "error"; block.setAttribute("role", "alert"); panel.append(block) }
