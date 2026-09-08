import { expect, test } from "bun:test"
import { disposeAll } from "../src/boot/dispose.ts"
import { createObservationStore } from "@effect-agent/effect-observe"

test("shutdown closes remaining resources even when an earlier disposer fails", async () => {
  const stopped: string[] = []
  await expect(disposeAll([
    () => { stopped.push("plugin"); throw new Error("stop failed") },
    () => { stopped.push("host") }, () => { stopped.push("sqlite") },
  ])).rejects.toThrow("effect-server shutdown failed")
  expect(stopped).toEqual(["plugin", "host", "sqlite"])
})
test("monitor SQLite store can be closed idempotently", () => {
  const store = createObservationStore(":memory:")
  store.close()
  store.close()
  expect(() => store.count()).toThrow()
})
