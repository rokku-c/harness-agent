/**
 * The one place an unrenderable component is reported.
 *
 * A view is drawn node by node, so a name the library does not have is a fact
 * about one node and not about the view. Throwing would take the whole screen
 * down — including the sibling nodes that would have drawn perfectly well — over
 * a node the reader never asked for and cannot fix from here. So the failure is
 * drawn where the node would have been: a callout naming it, inside the layout
 * that carries on around it.
 *
 * This used to be a callout written out at each of the three places that could
 * meet an unknown name, which is three chances to word the same report
 * differently. There is one now, and it is a file so that it stays one.
 */

import { Callout } from "@radix-ui/themes"
import type { ComponentRenderer } from "@json-render/react"

export const Unresolved: ComponentRenderer = ({ element }) => (
  <Callout.Root color="red">
    <Callout.Text>Unknown component: {element.type}</Callout.Text>
  </Callout.Root>
)
