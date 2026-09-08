import { Effect, Schema } from "effect"
import { AgentContext, Op, notationText, type Access, type Until as UntilT } from "@effect-agent/core"
import { EffectAgent, type Model, type WireMessage, type WireTool } from "@effect-agent/builtin"

export const weatherOp = () => Op.read({
  name: "lookup",
  description: notationText("Look up the current weather for a city."),
  input: Schema.Struct({ city: Schema.String }),
  output: Schema.Struct({ temp: Schema.Number }),
  execute: ({ city }) => Effect.succeed({ temp: 24, city })
})

type Script = Array<{ text: string; toolCalls?: Array<{ id: string; name: string; input: unknown }> }>

export const scriptedModel = (script: Script): Model & { calls: number; lastTools?: ReadonlyArray<WireTool>; lastThread?: ReadonlyArray<WireMessage> } => {
  const queue = [...script]
  const model: any = {
    calls: 0,
    generate: (_s: string, messages: ReadonlyArray<WireMessage>, tools: ReadonlyArray<WireTool>) => {
      model.calls++
      model.lastTools = tools
      model.lastThread = [...messages]
      return Effect.succeed(queue.shift() ?? { text: "done", toolCalls: [] })
    }
  }
  return model
}

export const runAgent = (model: Model, until: UntilT<any>, access: ReadonlyArray<Access> = [], instructions?: string) => {
  const driver = EffectAgent.make({ model, instructions })
  return driver.run({ context: AgentContext.text("weather?"), until, access })
}

