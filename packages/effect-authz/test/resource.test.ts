import { expect, test } from "bun:test"

import {
  ANY_SEGMENT,
  REST_SEGMENT,
  appResource,
  configResource,
  formatResource,
  namespaceResource,
  parseResource,
  serverResource,
  serverToolResource,
  storeResource,
  toolResource,
  uiResource,
} from "../src/index.ts"

test("constructors reproduce the repo's existing addressing forms", () => {
  expect(namespaceResource("ops").raw).toBe("ops")
  expect(appResource("ops", "board").raw).toBe("ops::board")
  expect(toolResource("ops", "board", "view").raw).toBe("ops::board.view")
  expect(uiResource("ops", "board", "main").raw).toBe("ui://ops/board/main")
  expect(storeResource("ops", "board", "state").raw).toBe("store://ops/board/state")
  expect(configResource("ops", "board").raw).toBe("config://ops/board")
  expect(serverResource("github").raw).toBe("mcp://github")
  expect(serverToolResource("github", "create_issue").raw).toBe("mcp://github/create_issue")
})

test("parse splits scheme and segments", () => {
  expect(parseResource("ops")).toEqual({ scheme: "", segments: ["ops"] })
  expect(parseResource("ops::board")).toEqual({ scheme: "", segments: ["ops", "board"] })
  expect(parseResource("ops::board.view")).toEqual({ scheme: "", segments: ["ops", "board", "view"] })
  expect(parseResource("ui://ops/board/main")).toEqual({ scheme: "ui", segments: ["ops", "board", "main"] })
  expect(parseResource("mcp://github/create_issue")).toEqual({ scheme: "mcp", segments: ["github", "create_issue"] })
})

test("format inverts parse for every form", () => {
  const forms = [
    "ops",
    "ops::board",
    "ops::board.view",
    "ui://ops/board/main",
    "store://ops/board/state",
    "config://ops/board",
    "mcp://github",
    "mcp://github/create_issue",
  ]
  for (const raw of forms) expect(formatResource(parseResource(raw))).toBe(raw)
})

test("the wildcard tokens are the documented ones", () => {
  expect(ANY_SEGMENT).toBe("*")
  expect(REST_SEGMENT).toBe("**")
})
