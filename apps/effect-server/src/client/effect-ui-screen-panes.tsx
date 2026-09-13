/**
 * The panes an app's screens are shown in.
 *
 * Two panes wide, one pane narrow, and the breakpoint is CSS's rather than
 * JavaScript's — the same rule the shell uses to decide what an app surface is
 * as tall as. So there is no `matchMedia`, no resize listener, and nothing to
 * keep in step with the layout: the layout decides.
 *
 * What the wide form shows is the screen the current one came from, which is
 * `UISplitViewController`'s secondary column and not a second navigation area of
 * its own. What the narrow form shows is the current screen alone — the pane
 * beneath it is hidden, and the bar above it is the way back, which is
 * `UISplitViewController` collapsing on a compact size class.
 *
 * A screen is rendered by the same renderer every other view is. Nothing here
 * knows what a screen holds.
 */

import * as React from "react"
import { Button, Text } from "@radix-ui/themes"
import { Renderer, type ComponentRegistry } from "@json-render/react"
import type { ScreenPayload } from "./effect-ui-runtime-types.ts"

/**
 * The way back, iOS's navigation bar: it belongs to the screen that was entered,
 * not to the surface, so it sits above that screen's own content and a screen
 * laid out in a pane gets a pane's height rather than a page's.
 *
 * The press is the browser's own history, because every entry into a screen
 * wrote one — which is what makes the back button on the browser and the control
 * here the same gesture. A link that arrived cold has no entry behind it, and
 * this is then the browser's answer to that too: the page the reader came from.
 */
const ScreenBar = ({ depth, title }: { readonly depth: number; readonly title: string }) =>
  depth < 2 ? null : <div className="screen-bar">
    <Button variant="soft" size="2" onClick={() => window.history.back()}>‹ Back</Button>
    <Text size="2" weight="medium" className="screen-bar-title">{title}</Text>
  </div>

const Pane = ({ screen, registry }: { readonly screen: ScreenPayload; readonly registry: ComponentRegistry }) =>
  <div className="screen-body"><Renderer spec={screen.spec} registry={registry} /></div>

export const ScreenPanes = ({ chain, registry, menu }: {
  readonly chain: readonly ScreenPayload[]
  readonly registry: ComponentRegistry
  /** What the first screen offers below itself, when the host had to read the screens off the layout. */
  readonly menu?: React.ReactNode
}) => {
  const current = chain[chain.length - 1]!
  const parent = chain.length < 2 ? undefined : chain[chain.length - 2]!
  return <div className="screen-panes" data-split={parent === undefined ? "off" : "on"}>
    {parent === undefined ? null : <div className="screen-parent"><Pane screen={parent} registry={registry} /></div>}
    <div className="screen-pane">
      <ScreenBar depth={chain.length} title={current.title} />
      <Pane screen={current} registry={registry} />
      {menu}
    </div>
  </div>
}
