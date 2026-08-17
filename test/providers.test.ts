import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { loadProviders, Providers } from "../src/index.js"

const options = {
  path: "test/fixtures/providers.toml",
  envFile: false as const,
  env: { TEST_OPENAI_KEY: "secret", TEST_BASE_URL: "https://example.test" }
}

describe("TOML providers", () => {
  test("API, rather than vendor, identifies the model endpoint", async () => {
    const providers = await Effect.runPromise(loadProviders(options))
    expect(providers.config().api).toBe("openai.responses")
    expect(providers.config("chat").api).toBe("openai.chat")
    expect(providers.config("chat").baseURL).toBe("https://example.test/v1")
    expect(providers.agent("chat").capabilities.provider).toEqual({ _tag: "Fixed", api: "openai.chat" })
  })

  test("can be injected as an Effect Layer", async () => {
    const api = await Effect.runPromise(
      Effect.map(Providers, (providers) => providers.config().api).pipe(
        Effect.provide(Providers.layer(options))
      )
    )
    expect(api).toBe("openai.responses")
  })

  test("fails before creating a model when an env reference is missing", async () => {
    const exit = await Effect.runPromiseExit(loadProviders({
      path: options.path,
      envFile: false,
      env: { TEST_OPENAI_KEY: "secret" }
    }))
    expect(exit._tag).toBe("Failure")
  })
})
