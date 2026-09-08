import * as React from "react"
import { createRoot } from "react-dom/client"
import { Renderer } from "@json-render/react"
import { registry } from "./effect-ui-catalog.tsx"

interface EffectUiApi {
  mount(container: HTMLElement, spec: unknown): void
}

declare global {
  interface Window {
    effectUi?: EffectUiApi
  }
}

const api: EffectUiApi = {
  mount(container, spec) {
    container.replaceChildren()
    createRoot(container).render(<Renderer spec={spec as never} registry={registry} />)
  },
}

window.effectUi = api
