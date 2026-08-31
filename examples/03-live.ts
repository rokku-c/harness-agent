/**
 * Live: the same sentence, now driven by a real provider from config.toml +
 * .env (Providers resolve the model; EffectAgent loops). Requires:
 *   config.toml  -> [providers.default] (see config.toml.example)
 *   .env         -> LLM_API_KEY=...
 * Run: bun run examples 03 --live
 */
import { Effect, Schema } from "effect"
import { Agent, AgentContext, ConsoleHook, Harness, Until } from "@effect-agent/core"
import { Providers } from "@effect-agent/builtin"

const program = Effect.gen(function* () {
  const driver = yield* Providers.agent()
  const Assistant = Agent
    .define("assistant", (question: string) => AgentContext.text(question))
    .returns(Until.text)
    .implementedBy(Harness.withHooks(driver, ConsoleHook))
  return yield* Assistant.run("Say in one short sentence what effect-agent is.")
})

const answer = await Effect.runPromise(program.pipe(Effect.provide(Providers.layer())))
console.log("answer:", answer)

