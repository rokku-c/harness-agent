import type { ConfigApi, ConfigFailure, ConfigState, SaveStrategy } from "./config-api.ts"
import type { createConfigEdits } from "./config-edits.ts"
import type { describeConfigState } from "./config-state.ts"
import type { FormModel, createFormMount } from "@effect-agent/effect-ui"

type FormMount = ReturnType<typeof createFormMount>
export function createConfigPanel(api: ConfigApi, model: FormModel, mount: FormMount,
  describe: typeof describeConfigState, makeEdits: typeof createConfigEdits) {
  return async (panel: HTMLElement, id: string, current: () => boolean) => {
    panel.innerHTML = '<div class="bar"><b></b><span class="sub">CONFIG · SCHEMA DRIVEN</span></div>' +
      '<div class="pad config-page"><div class="config-heading"><h1>应用配置</h1><p>声明即表单，保存与运行状态分离。</p></div>' +
      '<div class="config-status"><strong></strong><span></span><small></small><button type="button" data-apply hidden>应用已保存配置</button></div>' +
      '<p class="config-feedback" role="status" aria-live="polite">正在读取配置…</p><div data-form></div></div>'
    panel.querySelector(".bar b")!.textContent = id
    const feedback = panel.querySelector<HTMLElement>(".config-feedback")!
    const status = panel.querySelector<HTMLElement>(".config-status")!
    const apply = panel.querySelector<HTMLButtonElement>("[data-apply]")!
    const container = panel.querySelector<HTMLElement>("[data-form]")!
    let editor: ReturnType<FormMount> | undefined, busy = false
    const edits = makeEdits()
    const note = (text: string, error = false) => {
      if (!current()) return
      feedback.textContent = text
      feedback.dataset.tone = error ? "error" : "info"
      feedback.setAttribute("role", error ? "alert" : "status")
    }
    const show = (state: ConfigState) => {
      const display = describe(state)
      status.dataset.tone = display.tone
      status.querySelector("strong")!.textContent = display.label
      status.querySelector("span")!.textContent = display.detail
      status.querySelector("small")!.textContent = display.revision
      apply.hidden = !display.canApply
    }
    const load = async () => {
      const data = await api.get(id)
      if (!current()) return
      editor?.dispose()
      editor = mount(container, model.create(id, data.schema, data.value, data.sources))
      edits.loaded(data.value)
      show(data)
    }
    const lock = (on: boolean) => {
      busy = on
      const fieldset = container.querySelector<HTMLFieldSetElement>(".cfg-editor")
      if (fieldset) fieldset.disabled = on
      container.querySelectorAll<HTMLButtonElement>(".cfg-actions button").forEach(button => { button.disabled = on })
      apply.disabled = on
      container.setAttribute("aria-busy", String(on))
    }
    const save = (strategy: SaveStrategy) => {
      const { override, unset } = edits.patch(editor!.read())
      return api.save(id, override, strategy, unset)
    }
    const action = async (strategy?: SaveStrategy, applySaved = false) => {
      if (busy || !current()) return
      lock(true)
      let saved = false
      try {
        if (strategy || applySaved) {
          const result = applySaved ? await api.apply(id) : await save(strategy!)
          saved = true
          if (!current()) return
          show(result)
        }
        await load()
        note(saved ? "操作成功，已重新读取服务端保存值。" : "已重新读取保存值。")
      } catch (error) {
        const failure = error as ConfigFailure
        if (current() && failure.data?.pendingRestart !== undefined) show({ appId: id, ...failure.data, ok: false } as ConfigState)
        note(`${saved ? "操作已成功，但重新读取失败：" : ""}${failure.message}`, true)
      } finally { if (current()) lock(false) }
    }
    container.addEventListener("input", () => { if (!busy) note("有未保存修改；请选择保存并应用或保存待重启。") })
    container.addEventListener("change", () => { if (!busy) note("有未保存修改；请选择保存并应用或保存待重启。") })
    container.addEventListener("submit", event => {
      event.preventDefault()
      const strategy = (event as SubmitEvent).submitter?.getAttribute("data-strategy") ?? "apply"
      if (strategy === "apply" || strategy === "restart") void action(strategy)
    })
    container.addEventListener("click", event => {
      const target = event.target as HTMLElement
      if (target.closest('[data-action="reload"]')) void action()
      else if (target.closest("[data-add],[data-remove]")) note("有未保存修改；请选择保存并应用或保存待重启。")
    })
    apply.onclick = () => { void action(undefined, true) }
    try { await load(); note("") } catch (error) {
      note((error as Error).message, true)
      const retry = document.createElement("button")
      retry.type = "button"; retry.textContent = "重新读取"; retry.onclick = () => { void action() }
      if (current()) container.replaceChildren(retry)
    }
  }
}
