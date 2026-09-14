import * as React from "react"
import type { ComponentType } from "react"
import { glyphs } from "./adapt/glyphs.ts"

export const Glyph = ({ name }: { readonly name: string }) => {
  const Icon = glyphs[name] as ComponentType<{ weight: string; size: number }> | undefined
  return Icon === undefined ? null : <Icon weight="regular" size={16} />
}
