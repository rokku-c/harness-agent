import type { FormControls } from "./controls.ts"
import type { FormDocument, FormNode } from "./types.ts"

export function createFormRenderer(controls: FormControls) {
  const { esc, input } = controls
  const badge = (node: FormNode): string => node.source ? `<span class="cfg-src">${esc(node.source)}</span>` : ""
  const render = (node: FormNode): string => {
    const label = esc(node.schema.title ?? node.key)
    const description = node.schema.description ? `<p class="cfg-help">${esc(node.schema.description)}</p>` : ""
    if (node.kind === "object") return `<fieldset class="cfg-object"><legend>${label}</legend>${node.fields.map(render).join("")}</fieldset>`
    if (node.kind === "array") {
      const blocks = node.rows.map((row, index) => {
        const heading = `<b>#${index + 1}</b><button type="button" data-remove="${node.id}" data-index="${index}">移除</button>`
        const content = row.kind === "object" ? row.fields.map(render).join("") : render(row)
        return `<div class="cfg-block"><div class="cfg-block-top">${heading}</div>` +
          `<fieldset class="cfg-block-fields">${content}</fieldset></div>`
      }).join("")
      const add = `<button type="button" data-add="${node.id}"${node.rows.length >= (node.schema.maxItems ?? Infinity) ? " disabled" : ""}>添加一项</button>`
      return `<section class="cfg-array" data-array="${node.id}"><div class="cfg-top"><h3>${label}</h3>${badge(node)}</div>${description}${blocks}${add}</section>`
    }
    return `<div class="cfg-field"><div class="cfg-top"><label for="${node.id}">${label}</label>${badge(node)}` +
      `<code>${node.required ? "required" : "optional"} · ${esc(node.kind)}</code></div>${input(node)}${description}</div>`
  }
  const html = (form: FormDocument): string => `<form class="cfg" data-config-app="${esc(form.appId)}" novalidate>` +
    (form.declared ? `<fieldset class="cfg-editor">${form.root.fields.map(render).join("")}</fieldset>` : '<p class="cfg-empty">未声明配置 schema</p>') +
    `<div class="cfg-actions"><button type="button" data-action="reload">重新读取</button>` +
    `<button type="submit" data-action="save" data-strategy="apply"${form.declared ? "" : " disabled"}>保存并应用</button>` +
    `<button type="submit" data-action="save" data-strategy="restart"${form.declared ? "" : " disabled"}>保存待重启</button></div></form>`
  return { html }
}
export type FormRenderer = ReturnType<typeof createFormRenderer>
