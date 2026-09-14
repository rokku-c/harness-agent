import * as React from "react"
import { VisuallyHidden } from "@radix-ui/themes"

export const SkipLink = ({ target }: { readonly target: React.RefObject<HTMLElement | null> }) =>
  <VisuallyHidden asChild>
    <button type="button" onClick={() => target.current?.focus({ preventScroll: true })}>Skip to content</button>
  </VisuallyHidden>
