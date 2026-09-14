import * as React from "react"
import { Button, Heading } from "@radix-ui/themes"
import { Renderer, type ComponentRegistry } from "@json-render/react"
import { Unresolved } from "./adapt/unresolved.tsx"
import { Glyph } from "./console-glyph.tsx"
import type { ScreenPayload } from "./effect-ui-runtime-types.ts"

const ScreenBar = ({ label, title, onBack }: { readonly label: string; readonly title: string; readonly onBack: () => void }) =>
  <div className="screen-bar">
    <Button variant="ghost" size="1" onClick={onBack}><Glyph name="CaretLeft" />{`Back to ${label}`}</Button>
    <Heading as="h1" size="2" weight="medium" tabIndex={-1} data-route-heading className="screen-bar-title">{title}</Heading>
  </div>

const Pane = ({ screen, registry }: { readonly screen: ScreenPayload; readonly registry: ComponentRegistry }) =>
  <div className="screen-body"><Renderer spec={screen.spec} registry={registry} fallback={Unresolved} /></div>

export const ScreenPanes = ({ chain, registry, menu, onBack, returnLabel }: {
  readonly chain: readonly ScreenPayload[]
  readonly registry: ComponentRegistry
  readonly onBack: () => void
  readonly returnLabel?: string
  readonly menu?: React.ReactNode
}) => {
  const current = chain[chain.length - 1]!
  const parent = chain.length < 2 ? undefined : chain[chain.length - 2]!
  return <div className="screen-panes" data-split={parent === undefined ? "off" : "on"}>
    {parent === undefined ? null : <div className="screen-parent"><Pane screen={parent} registry={registry} /></div>}
    <div className="screen-pane">
      {returnLabel === undefined ? null : <ScreenBar label={returnLabel} title={current.title} onBack={onBack} />}
      <Pane screen={current} registry={registry} />
      {menu}
    </div>
  </div>
}
