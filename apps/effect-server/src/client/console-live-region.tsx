import * as React from "react"
import { VisuallyHidden } from "@radix-ui/themes"
import { useLiveSentence } from "./console-live.ts"

export const ConsoleLiveRegion = () => {
  const sentence = useLiveSentence()
  return <VisuallyHidden><div role="status" aria-live="polite" aria-atomic="true">{sentence}</div></VisuallyHidden>
}
