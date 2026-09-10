import type { ConfigApi, ConfigFailure, ConfigState, SaveStrategy } from "./config-api.ts"
import type { createConfigEdits } from "./config-edits.ts"
import type { describeConfigState } from "./config-state.ts"
import type { ConfigMountFactory } from "./config-spec.ts"

export const configSurfaceMarkup = () => '<section class="config-surface"><div class="config-status" role="status" aria-live="polite"><strong></strong><span></span><small></small><button type="button" data-apply hidden>Apply saved configuration</button></div><p class="config-feedback" aria-live="polite">Loading configuration...</p><div class="config-form" data-form></div></section>'

type Session = { dispose: () => void }
export function createConfigPanel(api: ConfigApi, mountConfig: ConfigMountFactory,
  describe: typeof describeConfigState, makeEdits: typeof createConfigEdits) {
  const sessions = new WeakMap<HTMLElement, Session>()
  return async (panel: HTMLElement, id: string, current: () => boolean) => {
    sessions.get(panel)?.dispose(); panel.replaceChildren()
    let editor: ReturnType<ConfigMountFactory> | undefined, busy = false, disposed = false
    const active = () => !disposed && current()
    sessions.set(panel, { dispose: () => { disposed = true; editor?.dispose() } })
    panel.insertAdjacentHTML("afterbegin", configSurfaceMarkup())
    const feedback = panel.querySelector<HTMLElement>(".config-feedback")!, status = panel.querySelector<HTMLElement>(".config-status")!
    const apply = panel.querySelector<HTMLButtonElement>("[data-apply]")!, container = panel.querySelector<HTMLElement>("[data-form]")!
    const edits = makeEdits()
    const note = (message: string, error = false) => { if (!active()) return; feedback.textContent = message; feedback.dataset.tone = error ? "error" : "info"; feedback.setAttribute("role", error ? "alert" : "status") }
    const show = (state: ConfigState) => { if (!active()) return; const display = describe(state); status.dataset.tone = display.tone; status.querySelector("strong")!.textContent = display.label; status.querySelector("span")!.textContent = display.detail; status.querySelector("small")!.textContent = display.revision; apply.hidden = !display.canApply }
    const load = async () => { const data = await api.get(id); if (!active()) return; const next = mountConfig(container, data.jsonSpec); editor?.dispose(); editor = next; edits.loaded(data.value); show(data) }
    const lock = (on: boolean) => { busy = on; container.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>("input,select,button").forEach(control => { control.disabled = on }); apply.disabled = on; container.setAttribute("aria-busy", String(on)) }
    const save = (strategy: SaveStrategy) => { const { override, unset } = edits.patch(editor!.read()); return api.save(id, override, strategy, unset) }
    const action = async (strategy?: SaveStrategy, applySaved = false) => { if (busy || !active()) return; lock(true); let saved = false; try { if (strategy || applySaved) { const result = applySaved ? await api.apply(id) : await save(strategy!); saved = true; if (!active()) return; show(result) } await load(); note(saved ? "Operation succeeded; saved server values were reloaded." : "Saved values were reloaded.") } catch (error) { const failure = error as ConfigFailure; if (active() && failure.data?.pendingRestart !== undefined) show({ appId: id, ...failure.data, ok: false } as ConfigState); note(`${saved ? "Operation succeeded, but reload failed: " : ""}${failure.message}`, true) } finally { if (active()) lock(false) } }
    container.addEventListener("input", () => { if (!busy) note("Unsaved changes; choose Save and Apply or Save for Restart.") }); container.addEventListener("change", () => { if (!busy) note("Unsaved changes; choose Save and Apply or Save for Restart.") }); container.addEventListener("click", event => { const target = event.target as HTMLElement, strategy = target.closest<HTMLButtonElement>("[data-strategy]")?.dataset.strategy; if (strategy === "apply" || strategy === "restart") { event.preventDefault(); void action(strategy) } else if (target.closest('[data-action="reload"]')) void action() }); apply.onclick = () => { void action(undefined, true) }
    try { await load(); note("") } catch (error) { note((error as Error).message, true); const retry = document.createElement("button"); retry.type = "button"; retry.textContent = "Reload"; retry.onclick = () => { void action() }; if (active()) container.replaceChildren(retry) }
  }
}
