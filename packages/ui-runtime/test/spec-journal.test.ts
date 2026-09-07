import { expect, test } from "bun:test"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { makeSpecJournal, restoreSpec } from "../src/index.ts"

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
