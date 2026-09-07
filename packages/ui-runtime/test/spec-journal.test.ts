import { expect, test } from "bun:test"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { makeSpecJournal, makeSpecStreamAdapter, restoreSpec } from "../src/index.ts"

test("persists and restores json-render stream patches", async () => {
  const file = join(tmpdir(), `spec-${crypto.randomUUID()}.jsonl`)
  const journal = makeSpecJournal(file)
  await journal.append({ op: "add", path: "/root", value: "main" })
  await journal.append({ op: "add", path: "/elements/main", value: { type: "Text", props: { value: "Hi" } } })
  const adapter = await restoreSpec(file, { root: "", elements: {} })
  expect(adapter.snapshot().elements.main?.props.value).toBe("Hi")
})

test("skips corrupt stream journal rows", async () => {
  const file = join(tmpdir(), `spec-bad-${crypto.randomUUID()}.jsonl`)
  const journal = makeSpecJournal(file)
  await journal.append({ op: "add", path: "/root", value: "main" })
  await Bun.write(file, (await Bun.file(file).text()) + "bad\n")
  expect((await journal.read())).toHaveLength(1)
})

test("marks an unfinished stream interrupted and retryable on recovery", async () => {
  const file = join(tmpdir(), `spec-interrupted-${crypto.randomUUID()}.jsonl`)
  const journal = makeSpecJournal(file)
  await journal.start("stream-1")
  await journal.append({ op: "add", path: "/root", value: "main" }, "stream-1")
  const adapter = makeSpecStreamAdapter({ root: "", elements: {} })
  expect(await journal.recover(adapter)).toEqual({ applied: 1, status: "interrupted", streamId: "stream-1", retryable: true })
})

test("marks a finished stream completed on recovery", async () => {
  const file = join(tmpdir(), `spec-completed-${crypto.randomUUID()}.jsonl`)
  const journal = makeSpecJournal(file)
  await journal.start("stream-1")
  await journal.append({ op: "add", path: "/root", value: "main" }, "stream-1")
  await journal.done("stream-1")
  const adapter = makeSpecStreamAdapter({ root: "", elements: {} })
  expect(await journal.recover(adapter)).toEqual({ applied: 1, status: "completed", streamId: "stream-1", retryable: false })
})
