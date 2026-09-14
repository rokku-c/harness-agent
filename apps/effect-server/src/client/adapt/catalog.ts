import * as RadixThemes from "@radix-ui/themes"
import type { ComponentType } from "react"
import { glyphs } from "./glyphs.ts"

const library = RadixThemes as unknown as Record<string, unknown>

const isComponent = (node: unknown): boolean =>
  typeof node === "function" || (typeof node === "object" && node !== null && "$$typeof" in node)

const walk = (name: string): unknown => {
  let node: unknown = library
  for (const segment of name.split(".")) {
    if (segment === "" || typeof node !== "object" || node === null) return undefined
    node = (node as Record<string, unknown>)[segment]
  }
  return node
}

export const libraryComponent = (name: string): ComponentType<never> | undefined => {
  const node = walk(name)
  if (isComponent(node)) return node as ComponentType<never>
  return glyphs[name]
}
