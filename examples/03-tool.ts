import { Effect, Schema } from "effect"
import { Agent, Op, Providers, Until, Uri, type Binding } from "effect-agent"

const Weather = Op.read({
  name: "lookup_weather",
  description: "查询指定城市的当前天气",
  input: Schema.Struct({ city: Schema.String }),
  output: Schema.Struct({ city: Schema.String, temperature: Schema.Number, condition: Schema.String }),
  execute: ({ city }) => Effect.succeed({ city, temperature: 24, condition: "晴" })
})

const WeatherService: Binding = {
  uri: Uri.make("local", "service", "weather"),
  ops: [Weather]
}

const program = Effect.gen(function*() {
  const driver = yield* Providers.agent()

  const Assistant = Agent
    .define<string>()
    .returns(Until.stop)
    .uses(WeatherService)
    .implementedBy(driver)

  return yield* Assistant.run("上海")
})

const result = await Effect.runPromise(
  program.pipe(Effect.provide(Providers.layer({ path: "config.toml" })))
)

console.log(result.output)
