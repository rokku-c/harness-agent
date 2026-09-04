/**
 * Shared live-model construction: both live hosts (dingtalk robot/dws and the
 * web console) build their Model from the same config.toml [agent] block.
 */
import { openaiModel, anthropicModel } from "@effect-agent/model"
import type { Model } from "@effect-agent/builtin"
import type { MantisConfig } from "./config.ts"

export const buildModelFromConfig = (model: MantisConfig["model"]): Model =>
  model.api === "anthropic.messages"
    ? anthropicModel({
        api: "anthropic.messages",
        model: model.model,
        apiKey: model.apiKey,
        // anthropicModel appends /v1/messages; strip a trailing /v1 from the
        // original config so "https://.../anthropic/v1" joins cleanly
        baseURL: model.baseURL?.replace(/\/v1$/, "")
      })
    : openaiModel({
        api: "openai.chat",
        model: model.model,
        apiKey: model.apiKey,
        baseURL: model.baseURL
      })
