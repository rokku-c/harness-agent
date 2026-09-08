import { expect, test } from "bun:test"
import { readServerYaml } from "../src/yaml-manifest.ts"

test("listener configuration belongs to network, not the retired server.port field", () => {
  expect(() => readServerYaml("server:\n  port: 8080")).toThrow()
  expect(readServerYaml("network:\n  role: main\n  listeners: []").network).toEqual({ role: "main", listeners: [] })
})
