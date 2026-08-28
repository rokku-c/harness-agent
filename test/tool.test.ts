import { describe, expect, test } from "bun:test"
import { Effect, Schema } from "effect"
import { bind, connection, namedShaped, notated, shaped } from "../src/index.ts"
import { make, shapeOf, toTool } from "../src/index.ts"
import { memoryNotationStore } from "../src/index.ts"

const LookupWeather = make({
  name: "lookup_weather",
  input: Schema.Struct({ city: Schema.String }),
  output: Schema.Struct({ city: Schema.String, temperature: Schema.Number, condition: Schema.String }),
  execute: ({ city }) => Effect.succeed({ city, temperature: 24, condition: "sunny" })
})

describe("typed tools", () => {
  test("toTool bridges to the wire: JSON Schema + decode/encode execute", async () => {
    const tool = toTool(LookupWeather)
    expect(tool.name).toBe("lookup_weather")
    const output = await Effect.runPromise(tool.execute({ city: "Shanghai", extra: 1 }))
    // the input is DECODED (extra dropped), the output ENCODED
    expect(output).toEqual({ city: "Shanghai", temperature: 24, condition: "sunny" })
  })

  test("typed execute rejects malformed input via the schema", () => {
    const tool = toTool(LookupWeather)
    expect(Effect.runPromise(tool.execute({ nope: true })).then(() => null, (e) => String(e)))
      .resolves.toMatch(/city/)
  })

  test("shapeOf feeds the shaped declaration; named+shaped verifies", () => {
    const conn = connection("weather", [toTool(LookupWeather)])
    const bound = bind(shaped(shapeOf([LookupWeather])), conn)
    expect(bound).toHaveLength(1)
    const bound2 = bind(namedShaped(["weather"], shapeOf([LookupWeather])), conn)
    expect(bound2).toHaveLength(1)
  })

  test("notation-injected description rides the typed tool", () => {
    const store = memoryNotationStore([{ target: "tool:lookup_weather", instructions: ["Look up the current weather for a city."] }])
    const described = make({ ...LookupWeather, description: undefined })
    const conn = connection("weather", [{ ...toTool(described), description: undefined }], store)
    const bound = bind(notated(), conn)
    expect(String(bound[0]?.description)).toBe("Look up the current weather for a city.")
    void described
  })
})
