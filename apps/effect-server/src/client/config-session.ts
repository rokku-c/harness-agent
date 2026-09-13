/**
 * One open config form: what it holds, what it saves, and when it is stale.
 *
 * The form itself is mounted outside React (it is a generated spec), so this
 * owns the parts React cannot see — the editor instance, the busy flag, and the
 * order of save, apply and reload. It reports every change through its hooks and
 * keeps no state of its own to disagree with them.
 */

import type { ConfigApi, ConfigFailure, ConfigState, SaveStrategy } from "./config-api.ts"
import type { ConfigMount, ConfigMountFactory } from "./config-spec.ts"
import { createConfigEdits } from "./config-edits.ts"

export interface ConfigSessionHooks {
  readonly onState: (state: ConfigState) => void
  readonly onNote: (message: string, error: boolean) => void
  readonly current: () => boolean
}

/** The generated form is not React's to disable, so a save locks it directly. */
export const lockForm = (container: HTMLElement, on: boolean): void => {
  container.querySelectorAll<HTMLElement>("input,select,textarea,button").forEach((control) => { (control as HTMLButtonElement).disabled = on })
  container.setAttribute("aria-busy", String(on))
}

export const makeConfigSession = (api: ConfigApi, id: string, hooks: ConfigSessionHooks) => {
  const edits = createConfigEdits()
  let editor: ConfigMount | undefined, busy = false, disposed = false
  const active = () => !disposed && hooks.current()
  const note = (message: string, error = false) => { if (active()) hooks.onNote(message, error) }
  const reload = async (container: HTMLElement, mountConfig: ConfigMountFactory) => {
    const data = await api.get(id)
    if (!active()) return
    editor?.dispose()
    editor = mountConfig(container, data.jsonSpec)
    edits.loaded(data.value)
    if (active()) hooks.onState(data)
  }
  const action = async (container: HTMLElement, mountConfig: ConfigMountFactory, strategy?: SaveStrategy, applySaved = false) => {
    if (busy || !active()) return
    busy = true
    lockForm(container, true)
    let saved = false
    try {
      if (strategy !== undefined || applySaved) {
        if (applySaved) { const result = await api.apply(id); saved = true; if (active()) hooks.onState(result) }
        else { const patch = edits.patch(editor!.read()); const result = await api.save(id, patch.override, strategy!, patch.unset); saved = true; if (active()) hooks.onState(result) }
        if (!active()) return
      }
      await reload(container, mountConfig)
      note(saved ? "Operation succeeded; saved server values were reloaded." : "Saved values were reloaded.")
    } catch (error) {
      const failure = error as ConfigFailure
      if (active() && failure.data?.pendingRestart !== undefined) hooks.onState({ appId: id, ...failure.data, ok: false } as ConfigState)
      note(`${saved ? "Operation succeeded, but reload failed: " : ""}${failure.message}`, true)
    } finally { busy = false; if (container.isConnected) lockForm(container, false) }
  }
  return {
    reload, action, note,
    read: () => editor?.read(),
    dispose: () => { disposed = true; editor?.dispose() },
  }
}
