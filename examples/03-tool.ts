import { Effect, Schema } from "effect"
import { Agent, AgentContext, Op, Providers, Until, Uri, type Binding } from "../src/index.js"

const Weather = Op.read({
  name: "lookup_weather",
  description: "查询指定城市的当前天气",
  input: Schema.Struct({ city: Schema.String }),
  output: Schema.Struct({ city: Schema.String, temperature: Schema.Number, condition: Schema.String }),
  execute: ({ city }) => Effect.succeed({ city, temperature: 24, condition: "晴" })
})

const WeatherService: Binding<any> = {
  uri: Uri.make("local", "service", "weather"),
  ops: [Weather]
}

const program = Effect.gen(function*() {
  const driver = yield* Providers.agent()

  const Assistant = Agent
    .define<string>("WeatherAssistant", AgentContext.text)
    .returns(Until.stop)
    .uses(WeatherService)
    .implementedBy(driver)

  return yield* Assistant.run("请查询上海天气，并给我一句出行建议。不要猜测天气。")
})

const answer = await Effect.runPromise(
  program.pipe(Effect.provide(Providers.layer({ path: "config.toml" })))
)

console.log(answer)
