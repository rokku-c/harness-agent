/**
 * App-developer facade — author the UI the way you already do (what to show,
 * the data, what actions exist) and get lui/webui rules for free.
 *
 * The developer NEVER writes contracts, collapse/symbol rules, partial-refresh
 * targets or projection encodings. defineUi derives all of it from the view +
 * actions; weblui and agents consume the same bundle.
 */

import { makeRenderContract, type RenderContract } from "./contract.ts"
import { contractToCompact, contractToJson, contractToToml } from "./projector.ts"
import { contractToTokenized } from "./tokenizer.ts"
import type { EffectUiView } from "./spec.ts"

export interface DefineUiInput {
  readonly view: EffectUiView
  readonly actions?: ReadonlyArray<{ name: string; description?: string; inputSchema?: unknown }>
  readonly data?: unknown
}

export interface UiBundle {
  readonly contract: RenderContract
  /** derive every lui representation from the same contract (dev never writes these). */
  project(data?: unknown): {
    json: string
    toml: string
    compact: string
    token: string
  }
}

export const defineUi = (input: DefineUiInput): UiBundle => {
  const contract = makeRenderContract(input.view, input.actions)
  const base = input.data
  return {
    contract,
    project: (data?: unknown) => {
      const d = data ?? base
      return {
        json: contractToJson(contract, d),
        toml: contractToToml(contract, d),
        compact: contractToCompact(contract, d),
        token: contractToTokenized(contract, d),
      }
    },
  }
}
