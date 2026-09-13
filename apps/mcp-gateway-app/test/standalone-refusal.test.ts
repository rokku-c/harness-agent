import { expect, test } from "bun:test"
import { startStandaloneApp } from "@effect-agent/effect-standalone"
import { effectApp } from "../src/effect-app.ts"

test("the gateway is refused alone, naming the app it depends on", async () => {
  const started = startStandaloneApp({ app: effectApp, port: 0 })
  const error = await started.then(() => undefined, (cause: Error) => cause)
  // The gateway reads the shared registry's *contents*, which the mcp-registry
  // app's plugin is what fills. Hosting the gateway alone would answer with an
  // empty topology for a reason nobody could see, so it must not start at all.
  expect(error?.message).toContain("mcp-gateway")
  expect(error?.message).toContain("mcp-registry")
})
