import { expect, mock, test } from "bun:test"
import { makePluginHost } from "../src/index.ts"
import { plane, request } from "./fixtures.ts"

test.each(["disable", "unregister", "register"] as const)("%s propagates stop failures and detaches the failed plane", async (op) => {
  const host = makePluginHost()
  const error = new Error("stop failed")
  const stop = mock(async () => { throw error })
  const nextLoad = mock(async () => plane())
  await host.register({ id: "app", load: async () => plane(stop) })
  const mutation = op === "register" ? host.register({ id: "app", load: nextLoad }) : host[op]("app")
  await expect(mutation).rejects.toBe(error)
  expect(stop).toHaveBeenCalledTimes(1)
  expect(nextLoad).not.toHaveBeenCalled()
  expect(host.isEnabled("app")).toBe(false)
  expect((await host.handle(request())).status).toBe(404)
  // Cleanup and future calls cannot stop the failed generation again.
  await host.close()
  expect(stop).toHaveBeenCalledTimes(1)
  expect(host.list()).toEqual([])
})

test("close cleans every plugin, aggregates stop failures, and shares its completion", async () => {
  const host = makePluginHost()
  const errors = [new Error("first failed"), new Error("last failed")]
  const stops = [mock(() => { throw errors[0] }), mock(() => undefined), mock(async () => { throw errors[1] })]
  for (const [index, stop] of stops.entries()) {
    await host.register({ id: String(index), load: async () => plane(stop) })
  }
  const completion = host.close()
  const error = await completion.catch((error: unknown) => error)
  expect(error).toBeInstanceOf(AggregateError)
  expect((error as AggregateError).errors).toEqual(errors)
  expect(host.close()).toBe(completion)
  for (const stop of stops) expect(stop).toHaveBeenCalledTimes(1)
  expect(host.list()).toEqual([])
  expect((await host.handle(request())).status).toBe(404)
})
