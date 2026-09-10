/// <reference lib="dom" />
import type { FormDocument } from "./types.ts"
import type { FormModel } from "./model.ts"
import type { FormRenderer } from "./render.ts"
import type { createFormParser } from "./parse.ts"

export function createFormMount(model: FormModel, renderer: FormRenderer, parser: ReturnType<typeof createFormParser>) {
  return (container: HTMLElement, form: FormDocument) => {
    const nodes = new Map<string, FormDocument["root"]>()
    const index = () => { nodes.clear(); model.visit(form.root, node => nodes.set(node.id, node)) }
    const sync = () => {
      container.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-node]").forEach(input => {
        const node = nodes.get(input.dataset.node!)!
        if (node.kind === "enum" || (node.kind === "boolean" && !node.required)) {
          node.value = input.value === "" ? undefined : (node.schema.enum ?? [true, false])[Number(input.value)]
        } else node.value = input.type === "checkbox" ? (input as HTMLInputElement).checked : input.value
      })
    }
    const draw = () => { index(); container.innerHTML = renderer.html(form) }
    const click = (event: Event) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>("[data-add],[data-remove]")
      if (!target) return
      sync()
      if (target.dataset.add) model.add(nodes.get(target.dataset.add)!)
      else model.remove(nodes.get(target.dataset.remove!)!, Number(target.dataset.index))
      draw()
    }
    container.addEventListener("click", click)
    draw()
    return {
      read: () => { sync(); return parser.parse(form) },
      dispose: () => { container.removeEventListener("click", click) },
    }
  }
}
