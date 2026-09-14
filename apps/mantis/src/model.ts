import { openaiModel, anthropicModel } from "@effect-agent/model"
import type { Model } from "@effect-agent/model"
import type { MantisConfig } from "./config.ts"

export const buildModelFromConfig = (model: MantisConfig["model"]): Model =>
  model.api === "anthropic.messages"
    ? anthropicModel({
        api: "anthropic.messages",
        model: model.model,
        apiKey: model.apiKey,
        baseURL: model.baseURL?.replace(/\/v1$/, "")
      })
    : openaiModel({
        api: "openai.chat",
        model: model.model,
        apiKey: model.apiKey,
        baseURL: model.baseURL
      })
