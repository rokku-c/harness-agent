import { Callout } from "@radix-ui/themes"
import type { ComponentRenderer } from "@json-render/react"

export const Unresolved: ComponentRenderer = ({ element }) => (
  <Callout.Root color="red">
    <Callout.Text>Unknown component: {element.type}</Callout.Text>
  </Callout.Root>
)
