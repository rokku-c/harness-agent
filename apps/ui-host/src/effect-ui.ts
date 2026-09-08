import type { EffectUiView } from "@effect-agent/effect-ui"

/** UI Canvas as a declarative effect-ui view (renderer-agnostic). */
export const effectUiView: EffectUiView = {
  viewId: "ui-host-console",
  title: "UI Canvas",
  nodes: [
    { kind: "text", text: "ui-host" },
    { kind: "formField", label: "canvas", value: "root", placeholder: "canvas id" },
    { kind: "list", items: ["declared canvases", "renderers: web-html · json-react"] },
  ],
}
