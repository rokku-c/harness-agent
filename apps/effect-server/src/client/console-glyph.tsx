/**
 * A glyph, resolved by name.
 *
 * §8 pins one family and one closed vocabulary (`adapt/glyphs.ts`), and it fixes
 * the chrome's own size and weight: 16 px, `regular`. So a control that wants a
 * glyph names a concept and gets the right drawing, in the right weight, without
 * deciding either — which is what keeps two controls that are the same kind of
 * thing from disagreeing about how big it is.
 *
 * A name the table does not carry draws nothing rather than a stand-in character:
 * the vocabulary is closed on purpose, and an empty slot says "a mark I do not
 * know" where an invented letter says something nothing chose.
 */

import * as React from "react"
import type { ComponentType } from "react"
import { glyphs } from "./adapt/glyphs.ts"

export const Glyph = ({ name }: { readonly name: string }) => {
  const Icon = glyphs[name] as ComponentType<{ weight: string; size: number }> | undefined
  return Icon === undefined ? null : <Icon weight="regular" size={16} />
}
