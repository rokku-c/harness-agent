/**
 * The Model service Tag (M1: service-as-seam). Programs take the Model from
 * the context; swapping the provider = providing a different Layer.
 */
import { Context, Layer } from "effect"
import type { Model, ModelCapabilities } from "./types.ts"

/** The service shape: same as the wire contract. */
export interface ModelService extends Model {}

/** Tag (named ModelTag to avoid clashing with the Model contract type). */
export class ModelTag extends Context.Tag("effect-agent/Model")<ModelTag, ModelService>() {}

export const ModelLayer = {
  /** Provide any Model implementation directly. */
  from: (impl: ModelService): Layer.Layer<ModelTag> => Layer.succeed(ModelTag, impl),
  /**
   * Capability check helper: fail loud before a loop starts (M3).
   * An absent capabilities declaration is treated as "no capability" -
   * a bare fake model fails any require, which is the safe direction.
   */
  require: (model: ModelService, need: Partial<ModelCapabilities>): string | null => {
    const cap = model.capabilities ?? { streaming: false, thinking: false, multimodal: false, usage: false }
    if (need.thinking && !cap.thinking) return "model " + (model.id ?? "<bare>") + " does not support thinking"
    if (need.streaming && !cap.streaming) return "model " + (model.id ?? "<bare>") + " does not support streaming"
    if (need.multimodal && !cap.multimodal) return "model " + (model.id ?? "<bare>") + " does not support multimodal"
    if (need.usage && !cap.usage) return "model " + (model.id ?? "<bare>") + " does not report usage"
    return null
  }
}

export type { ModelCapabilities }
