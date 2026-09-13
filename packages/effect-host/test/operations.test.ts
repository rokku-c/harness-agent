import { expect, test } from "bun:test"
import { HOST_OPERATIONS, matchHostOperation, runHostOperation } from "../src/index.ts"
import { makePluginHost } from "../src/index.ts"
import { plane, request } from "./fixtures.ts"

test("the control surface executes exactly the declared operations", async () => {
  const host = makePluginHost({ control: true })
  await host.register({ id: "app", priority: 7, enabled: false, load: async () => plane() })

  const listed = await host.handle(request("/-/planes"))
  expect(await listed.json()).toEqual([{ id: "app", enabled: false, priority: 7 }])

  expect(await (await host.handle(request("/-/planes/app/enable", "POST"))).json())
    .toEqual({ ok: true, id: "app", enabled: true })
  expect(await (await host.handle(request("/-/planes/app/disable", "POST"))).json())
    .toEqual({ ok: true, id: "app", enabled: false })
  expect(await (await host.handle(request("/-/planes/app", "DELETE"))).json()).toEqual({ ok: true })
  expect(await (await host.handle(request("/-/planes/app", "DELETE"))).json()).toEqual({ ok: false })

  await host.close()
})

test("the declaration is the single source of the control paths", () => {
  expect(HOST_OPERATIONS.map((operation) => [operation.method, operation.path])).toEqual([
    ["GET", "/-/planes"],
    ["POST", "/-/planes/:id/enable"],
    ["POST", "/-/planes/:id/disable"],
    ["POST", "/-/planes/:id/reload"],
    ["DELETE", "/-/planes/:id"],
  ])
  // Every operation is addressed on the host's one privileged plane.
  expect(new Set(HOST_OPERATIONS.map((operation) => operation.plane))).toEqual(new Set(["lifecycle"]))
})

test("declared template params and declared input schemas agree", () => {
  for (const operation of HOST_OPERATIONS) {
    const names = [...operation.path.matchAll(/:([A-Za-z_][A-Za-z0-9_]*)/g)].map((match) => match[1])
    expect(Object.keys(operation.inputSchema.properties ?? {})).toEqual(names)
    expect(operation.inputSchema.required ?? []).toEqual(names)
    // "含 schema": an operation with no schema is not addressable in the table.
    expect(operation.outputSchema).toBeDefined()
  }
})

test("only declared method+path pairs are control requests", () => {
  expect(matchHostOperation("GET", "/-/planes")).toBeDefined()
  // a declared path with an undeclared method is not a control request
  expect(matchHostOperation("GET", "/-/planes/app/enable")).toBeUndefined()
  expect(matchHostOperation("POST", "/-/planes/app")).toBeUndefined()
  // unknown paths, and paths that would need :id to span a slash
  expect(matchHostOperation("DELETE", "/-/planes")).toBeUndefined()
  expect(matchHostOperation("DELETE", "/-/planes/a/b")).toBeUndefined()
  expect(matchHostOperation("GET", "/-/other")).toBeUndefined()
})

test("template params are captured and url-decoded", () => {
  expect(matchHostOperation("POST", "/-/planes/board/enable")).toEqual({
    operation: HOST_OPERATIONS[1],
    params: { id: "board" },
  })
  expect(matchHostOperation("DELETE", "/-/planes/a%20b")?.params).toEqual({ id: "a b" })
})

test("runHostOperation reports the lifecycle's answer, not its own", async () => {
  const host = makePluginHost({ control: false })
  await host.register({ id: "app", enabled: false, load: async () => plane() })

  const [, enable] = HOST_OPERATIONS
  expect(await runHostOperation(enable, { id: "app" }, host)).toEqual({ ok: true, id: "app", enabled: true })
  // unknown id: ok false, and `enabled` reflects reality rather than the request
  expect(await runHostOperation(enable, { id: "ghost" }, host)).toEqual({ ok: false, id: "ghost", enabled: false })

  await host.close()
})
