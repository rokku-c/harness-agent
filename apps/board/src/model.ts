/**
 * Live model construction for real runs (board MCP / web hosts). Both
 * effect-agent providers are supported, chosen by BOARD_MODEL_API:
 *
 *   BOARD_MODEL_API=anthropic.messages|openai.chat   (default openai.chat)
 *   BOARD_MODEL=the model id                         (default gpt-4o)
 *   BOARD_MODEL_KEY / BOARD_MODEL_BASE
 */
import { anthropicModel, openaiModel } from "@effect-agent/model"
import type { Model } from "@effect-agent/builtin"

export const buildBoardModel = (): Model => {
  const api = process.env.BOARD_MODEL_API ?? "openai.chat"
  const model = process.env.BOARD_MODEL ?? (api === "anthropic.messages" ? "claude-sonnet-4-20250514" : "gpt-4o")
  const apiKey = process.env.BOARD_MODEL_KEY
  const baseURL = process.env.BOARD_MODEL_BASE
  return api === "anthropic.messages"
    ? anthropicModel({ api: "anthropic.messages", model, apiKey, baseURL: baseURL?.replace(/\/v1$/, "") })
    : openaiModel({ api: "openai.chat", model, apiKey, baseURL })
}
