import { Context, Layer } from "effect"
import type { Model, ModelCapabilities } from "./types.ts"

export interface ModelService extends Model {}

export class ModelTag extends Context.Tag("effect-agent/Model")<ModelTag, ModelService>() {}

export const ModelLayer = {
  from: (impl: ModelService): Layer.Layer<ModelTag> => Layer.succeed(ModelTag, impl),
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
