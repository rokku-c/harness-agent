import { Effect } from "effect"
import type { Model } from "@effect-agent/builtin"
import { buildModelFromConfig } from "../../model.ts"

type Config = {
  readonly api: "openai.chat" | "anthropic.messages"
  readonly model: string
  readonly apiKey?: string
  readonly baseURL?: string
  readonly maxSteps: number
  readonly maxReflections: number
}

export const embeddedModel = (config: Config): Model => {
  const apiKey = config.apiKey
  if (apiKey !== undefined && apiKey !== "") return buildModelFromConfig({ ...config, apiKey })
  return {
    id: "mantis-unconfigured",
    capabilities: { streaming: false, thinking: false, multimodal: false, usage: false },
    generate: () => Effect.succeed({
      text: "",
      toolCalls: [{
        id: "final_answer",
        name: "final_answer",
        input: {
          reply: "Mantis is ready. Configure a model provider in Settings before starting a conversation.",
          tone: "plain",
          asksConfirmation: false,
        },
      }],
    }),
  }
}
