import { expect, test } from "bun:test"
import { makeSpecStreamAdapter } from "../src/index.ts"

test("applies official json-render stream patches and audits each patch", () => {
  const seen: string[] = []
  const stream = makeSpecStreamAdapter({ root: "", elements: {} }, (patch) => seen.push(patch.op))
  stream.applyLine('{"op":"add","path":"/root","value":"main"}')
  stream.applyLine('{"op":"add","path":"/elements/main","value":{"type":"Text","props":{"value":"Hi"}}}')
  expect(stream.snapshot().elements.main?.props.value).toBe("Hi")
  expect(seen).toEqual(["add", "add"])
})

test("ignores malformed stream lines without changing the spec", () => {
  const stream = makeSpecStreamAdapter({ root: "", elements: {} })
  expect(stream.applyLine("not json")).toBeUndefined()
  expect(stream.snapshot()).toEqual({ root: "", elements: {} })
})
