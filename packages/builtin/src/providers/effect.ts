import { render, renderSystem } from "../render.js"
import { Config, Effect, Layer, Redacted } from "effect"
import { FetchHttpClient } from "@effect/platform"
import { LanguageModel } from "@effect/ai"
import { AnthropicClient, AnthropicLanguageModel } from "@effect/ai-anthropic"
import { OpenAiClient, OpenAiLanguageModel } from "@effect/ai-openai"
import { AgentFailure, type AgentError, type Driver, materialize, requireSubagents, requireUntil, type DriverContext, type DriverSession, type StepEvent } from "@effect-agent/core"
import { MaxOutputTokens, type MaxOutputTokensConfig } from "@effect-agent/core"

export interface EffectProviderOptions {
  /** "anthropic" | "openai". */
  readonly api: string
  readonly model: string
  readonly apiKey?: string
  readonly baseURL?: string
  /** Max-output-tokens escalation policy. Default {@link MaxOutputTokens}. */
  readonly maxOutputTokens?: MaxOutputTokensConfig
}

/**
 * A provider driver built on Effect's official `@effect/ai` packages
 * (`@effect/ai-anthropic` / `@effect/ai-openai`). Everything is expressed as
 * Effect: the model is a `LanguageModel` service supplied via `Layer`, text /
 * structured output go through `LanguageModel.generateText`.
 *
 * The provider client+model Layer assembly is the one place we bridge provider
 * union types; everything else is Effect-native.
 */
export const EffectAgent = {
  make: (options: EffectProviderOptions): Driver => {
    const driver: Driver = {
      id: "effect",
      capabilities: {
        provider: { _tag: "Fixed", api: options.api },
        granularity: "event", thinking: false,
        cancel: true, pause: false, resume: false, fork: "node",
        tools: "native", toolCalls: "observe", structuredOutput: "native", sandbox: "delegated", subagents: false
      },
      start: (request: DriverContext): Effect.Effect<DriverSession, AgentError, never> => Effect.gen(function*() {
        yield* requireUntil(driver.id, driver.capabilities, request.context.until)
        yield* requireSubagents(driver.id, driver.capabilities, request.context.subagents)
        request = yield* materialize(request)
        const until = request.context.until

        // 装配 provider client + model 的 Layer（provider 联合类型在此桥接）。
        const apiKey = options.apiKey ? Redacted.make(options.apiKey) : undefined
        const isAnthropic = options.api.startsWith("anthropic")
        // 两个 provider 都用 apiUrl（@effect/ai 的字段名）。
        const clientConfig = {
          ...(apiKey ? { apiKey: Config.succeed(apiKey) } : {}),
          ...(options.baseURL ? { apiUrl: Config.succeed(options.baseURL) } : {})
        }
        const modelLayer = (isAnthropic
          ? AnthropicLanguageModel.layer({
              model: options.model,
              // 禁用 extended thinking：deepseek 网关返回的 thinking 块格式不被
              // @effect/ai-anthropic 的 BetaMessage schema 接受（signature 非标准），
              // 禁用后网关不返回 thinking 块，响应可正常解析。
              config: { thinking: { type: "disabled" } } as any
            }).pipe(
              Layer.provide(AnthropicClient.layerConfig(clientConfig as any))
            )
          : OpenAiLanguageModel.layer({ model: options.model }).pipe(
              Layer.provide(OpenAiClient.layerConfig(clientConfig as any))
            )
        ).pipe(Layer.provide(FetchHttpClient.layer)) as unknown as Layer.Layer<LanguageModel.LanguageModel, never, never>

        // 简单实现：generateText 返回文本。
        const makeStep = Effect.gen(function*() {
          const model = yield* LanguageModel.LanguageModel
          const response = yield* model.generateText({
            prompt: render(request.context)
          })
          return { _tag: "Result", value: response.text } as StepEvent
        }).pipe(Effect.provide(modelLayer))
        return { step: makeStep }
      }) as unknown as Effect.Effect<DriverSession, AgentError, never>
    }
    return driver
  }
}
