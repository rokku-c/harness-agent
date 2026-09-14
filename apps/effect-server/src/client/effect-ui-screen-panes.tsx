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
import { Button, Heading } from "@radix-ui/themes"
import { Renderer, type ComponentRegistry } from "@json-render/react"
import { Unresolved } from "./adapt/unresolved.tsx"
import { Glyph } from "./console-glyph.tsx"
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
 * §10.2.4 fixes what it reads: `Back to <the destination's own title>`, at the
 * chrome's own size and weight, so a reader about to press it knows where it
 * lands. Naming the destination is what makes it one control rather than two
 * that both say "back"; the arrow is `CaretLeft` and not a `‹` character, because
 * §8 rule 2 leaves no textual stand-in anywhere in the console.
 *
 * The screen's title is the route's heading when the route declares one, which
 * is why it is a real `h1` and not a span: §10.3 moves focus to it on every route
 * change, and only a focusable heading can be the thing that is focused.
 */
const ScreenBar = ({ label, title, onBack }: { readonly label: string; readonly title: string; readonly onBack: () => void }) =>
  <div className="screen-bar">
    <Button variant="ghost" size="1" onClick={onBack}><Glyph name="CaretLeft" />{`Back to ${label}`}</Button>
    <Heading as="h1" size="2" weight="medium" tabIndex={-1} data-route-heading className="screen-bar-title">{title}</Heading>
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
