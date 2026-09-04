/**
 * tools/build/catalog.ts - the CATALOG + ENABLE ops.
 *
 * Concept: the context-economy pair. tools_catalog reports the current
 * surface (core always visible, extended listed with descriptions so the
 * model can decide what to enable); enable grows the surface for the rest
 * of the session and notifies the host (which persists the choice).
 */
import { Effect, Schema } from "effect"
import { Op, type Op as OpT } from "@effect-agent/core"
import { CatalogOut, EnableIn, EnableOut, manifestDescription } from "../schemas.ts"
import type { ToolSupply } from "../../supply.ts"

export const buildCatalogEnable = (
  supply: ToolSupply,
  onEnabled?: (name: string) => void
): ReadonlyArray<OpT<any, any, any>> => {
  const tools_catalog = Op.read({
    name: "tools_catalog",
    description: manifestDescription("tools_catalog"),
    input: Schema.Struct({}),
    output: CatalogOut,
    execute: () =>
      Effect.succeed({
        core: supply.visible().filter((name) => supply.catalog().every((t) => t.name !== name)),
        extended: supply.catalog()
      })
  })
  const enable = Op.read({
    name: "enable",
    description: manifestDescription("enable"),
    input: EnableIn,
    output: EnableOut,
    execute: ({ name }) => {
      const error = supply.enable(name)
      if (error === undefined) onEnabled?.(name)
      return Effect.succeed(error === undefined ? { ok: true, detail: name + " enabled" } : { ok: false, detail: error })
    }
  })
  return [tools_catalog, enable]
}
