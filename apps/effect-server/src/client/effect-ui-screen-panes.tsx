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
import { Unresolved } from "./adapt/unresolved.tsx"
import type { ScreenPayload } from "./effect-ui-runtime-types.ts"

/**
 * The way back, iOS's navigation bar: it belongs to the screen that was entered,
 * not to the surface, so it sits above that screen's own content and a screen
 * laid out in a pane gets a pane's height rather than a page's.
 *
 * What the press does is the host's answer, not this file's — a screen that was
 * walked to goes back through the history it walked, and one that was pasted in
 * goes up to its parent (console-stack.ts). It is drawn only where there is a
 * screen to go back to; at the first screen the only way out is Home.
 *
 * The label is the destination's own title, never the word "Back" (§2.H5): a
 * control that says where it goes needs no second sentence to explain it, and
 * "Back" was the word two different controls shared.
 */
const ScreenBar = ({ label, title, onBack }: { readonly label: string; readonly title: string; readonly onBack: () => void }) =>
  <div className="screen-bar">
    <Button variant="soft" size="2" onClick={onBack}>{`‹ ${label}`}</Button>
    <Text size="2" weight="medium" className="screen-bar-title">{title}</Text>
  </div>

/**
 * A screen's own spec, drawn by the engine. The registry is the one the runtime
 * built for the whole view; the fallback is the single report for a name that
 * registry does not carry, which no screen should reach and none may be dropped
 * by — a node that cannot be drawn is named in place, not left out.
 */
const Pane = ({ screen, registry }: { readonly screen: ScreenPayload; readonly registry: ComponentRegistry }) =>
  <div className="screen-body"><Renderer spec={screen.spec} registry={registry} fallback={Unresolved} /></div>

export const ScreenPanes = ({ chain, registry, menu, onBack, returnLabel }: {
  readonly chain: readonly ScreenPayload[]
  readonly registry: ComponentRegistry
  /** Where the return control above the current screen goes. */
  readonly onBack: () => void
  /** That destination's own title, when there is one: at the first screen there is nothing to go back to. */
  readonly returnLabel?: string
  /** What the first screen offers below itself, when the host had to read the screens off the layout. */
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
