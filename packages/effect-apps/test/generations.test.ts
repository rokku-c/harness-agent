import { expect, mock, test } from "bun:test"
import { defaultCompat } from "@effect-agent/effect-compat"
import { assessSurfaceChange, makeAppSlot, type AppToolSurface, type EffectAppDescriptor } from "../src/index.ts"
import { appHost, plane } from "./fixtures.ts"

type Host = ReturnType<typeof appHost>

const schemaV1 = { type: "object", properties: { text: { type: "string" } }, required: ["text"] }
const schemaV2 = { type: "object", properties: { text: { type: "string" }, loud: { type: "boolean" } }, required: ["text"] }

const tool = (name: string, schema: object, description = name + " it") => ({
  name,
  description,
  inputSchema: schema,
  handler: async (input: unknown) => input,
})

/** An app whose plugin contributes its tools (the withAppRuntime path). */
const app = (id: string, tools: ReturnType<typeof tool>[], stop?: () => void): EffectAppDescriptor => ({
  id,
  plugin: { id, load: async () => ({ ...plane(stop), tools }) },
})

const keys = (host: Host): string[] => host.registry.tools().map((entry) => entry.key).sort()
const parametersFor = (host: Host, key: string): unknown => host.registry.schemaFor(key)?.parameters

test("a compatible replacement advances the generation and retires the old one", async () => {
  const host = appHost()
  const slot = makeAppSlot(host, "board")
  const oldStop = mock(() => undefined)
  const newStop = mock(() => undefined)

  // same schema, new description → a `description`-level change (warn), not a break
  const first = await slot.install(app("board", [tool("echo", schemaV1, "echo text back")], oldStop))
  expect(first.ok).toBe(true)
  expect(slot.current()?.generation).toBe(1)
  expect(slot.previous()).toBeUndefined()

  const second = await slot.install(app("board", [tool("echo", schemaV1, "echo text back loudly")], newStop))
  expect(second.ok).toBe(true)
  expect(slot.current()?.generation).toBe(2)
  expect(slot.previous()?.generation).toBe(1)
  if (second.ok) expect(second.report.warnings.map((w) => w.level)).toEqual(["description"])

  expect(keys(host)).toEqual(["board.echo"])
  expect(oldStop).toHaveBeenCalledTimes(1) // retired at commit
  expect(newStop).not.toHaveBeenCalled()
})

test("a schema break is rejected and the previous generation keeps serving", async () => {
  const host = appHost()
  const slot = makeAppSlot(host, "board")
  const oldStop = mock(() => undefined)

  await slot.install(app("board", [tool("echo", schemaV1)], oldStop))
  const replacing = await slot.install(app("board", [tool("echo", schemaV2)], mock(() => undefined)))

  expect(replacing.ok).toBe(false)
  if (!replacing.ok) {
    expect(replacing.reason).toBe("rejected")
    expect(replacing.report.violations.map((v) => v.level)).toEqual(["schema"])
  }
  // the old generation is live again: same surface, still enabled
  expect(slot.current()?.generation).toBe(1)
  expect(parametersFor(host, "board.echo")).toEqual(schemaV1)
  expect(host.host.isEnabled("board")).toBe(true)
})

test("a policy that downgrades schema breaks lets the replacement through", async () => {
  const host = appHost()
  const slot = makeAppSlot(host, "board")
  await slot.install(app("board", [tool("echo", schemaV1)]))

  const replacing = await slot.install(app("board", [tool("echo", schemaV2)]), {
    policy: { ...defaultCompat, schema: "warn" },
  })

  expect(replacing.ok).toBe(true)
  if (replacing.ok) expect(replacing.report.warnings.map((w) => w.level)).toEqual(["schema"])
  expect(parametersFor(host, "board.echo")).toEqual(schemaV2)
})

test("an added tool is not a break; a removed one is", async () => {
  const host = appHost()
  const slot = makeAppSlot(host, "board")
  await slot.install(app("board", [tool("echo", schemaV1)]))

  const added = await slot.install(app("board", [tool("echo", schemaV1), tool("ping", schemaV1)]))
  expect(added.ok).toBe(true)
  expect(keys(host)).toEqual(["board.echo", "board.ping"])

  const removed = await slot.install(app("board", [tool("ping", schemaV1)]))
  expect(removed.ok).toBe(false)
  if (!removed.ok) expect(removed.report.violations[0].reason).toContain("echo")
  expect(keys(host)).toEqual(["board.echo", "board.ping"])
})

test("a failing health probe restores the previous generation", async () => {
  const host = appHost()
  const slot = makeAppSlot(host, "board")
  await slot.install(app("board", [tool("echo", schemaV1)]))

  const result = await slot.install(app("board", [tool("echo", schemaV1, "changed")]), {
    probe: () => {
      throw new Error("probe says no")
    },
  })

  expect(result.ok).toBe(false)
  if (!result.ok) expect(result.reason).toBe("failed")
  expect(slot.current()?.generation).toBe(1)
  expect(keys(host)).toEqual(["board.echo"])
  expect(host.host.isEnabled("board")).toBe(true)
})

test("a registration that throws leaves the previous generation serving", async () => {
  const host = appHost()
  const slot = makeAppSlot(host, "board")
  await slot.install(app("board", [tool("echo", schemaV1)]))

  const result = await slot.install({
    id: "board",
    plugin: {
      id: "board",
      load: async () => {
        throw new Error("entry blew up")
      },
    },
  })

  expect(result.ok).toBe(false)
  if (!result.ok) expect(result.reason).toBe("failed")
  expect(slot.current()?.generation).toBe(1)
  expect(keys(host)).toEqual(["board.echo"])
})

test("rollback is install run backwards", async () => {
  const host = appHost()
  const slot = makeAppSlot(host, "board")
  await slot.install(app("board", [tool("echo", schemaV1)]))
  await slot.install(app("board", [tool("echo", schemaV1, "v2 description")]))

  expect(slot.current()?.generation).toBe(2)
  const back = await slot.rollback()

  expect(back.ok).toBe(true)
  expect(slot.current()?.generation).toBe(3)
  expect(slot.previous()?.generation).toBe(2)
  expect(slot.current()?.surface[0].description).toBe("echo it")
  expect(slot.generations().map((g) => g.generation)).toEqual([1, 2, 3])
})

test("swapping one app leaves another app on the same host untouched", async () => {
  const host = appHost()
  const board = makeAppSlot(host, "board")
  const notes = makeAppSlot(host, "notes")
  const notesStop = mock(() => undefined)

  await board.install(app("board", [tool("echo", schemaV1)]))
  await notes.install(app("notes", [tool("ping", schemaV1)], notesStop))
  expect(keys(host)).toEqual(["board.echo", "notes.ping"])

  const swapped = await board.install(app("board", [tool("echo", schemaV1, "newer")]))
  expect(swapped.ok).toBe(true)

  expect(keys(host)).toEqual(["board.echo", "notes.ping"])
  expect(notes.current()?.generation).toBe(1)
  expect(notesStop).not.toHaveBeenCalled()
})

test("unload tears the app down without touching its neighbours", async () => {
  const host = appHost()
  const board = makeAppSlot(host, "board")
  const notes = makeAppSlot(host, "notes")
  await board.install(app("board", [tool("echo", schemaV1)]))
  await notes.install(app("notes", [tool("ping", schemaV1)]))

  await board.unload()

  expect(keys(host)).toEqual(["notes.ping"])
  expect(board.current()).toBeUndefined()
  expect(board.generations()).toEqual([])
})

test("a commit fires the change hook, a rejection does not", async () => {
  const host = appHost()
  const seen = mock(() => undefined)
  const slot = makeAppSlot(host, "board", { onChange: seen })

  await slot.install(app("board", [tool("echo", schemaV1)]))
  expect(seen).toHaveBeenCalledTimes(1)

  // rejected (schema break) — nothing changed, so nothing to announce
  await slot.install(app("board", [tool("echo", schemaV2)]))
  expect(seen).toHaveBeenCalledTimes(1)

  // rollback committed → announced again
  await slot.install(app("board", [tool("echo", schemaV1, "newer")]))
  expect(seen).toHaveBeenCalledTimes(2)
  await slot.rollback()
  expect(seen).toHaveBeenCalledTimes(3)
})

test("assessSurfaceChange judges pairs, additions and removals", () => {
  const surface = (tools: Array<[string, object, string]>): AppToolSurface[] =>
    tools.map(([name, input, description]) => ({ name, input, description }))

  const base = surface([["echo", schemaV1, "echoes"]])
  const same = surface([["echo", schemaV1, "echoes"]])
  const described = surface([["echo", schemaV1, "echoes loudly"]])

  expect(assessSurfaceChange(base, same, defaultCompat)).toEqual({ ok: true, violations: [], warnings: [] })
  expect(assessSurfaceChange(base, described, defaultCompat).warnings).toHaveLength(1)
  expect(assessSurfaceChange(base, surface([["echo", schemaV2, "echoes"]]), defaultCompat).ok).toBe(false)
  expect(assessSurfaceChange(base, surface([]), defaultCompat).violations[0].reason).toContain("removed")
  expect(assessSurfaceChange(base, [...base, ...surface([["ping", schemaV1, "pings"]])], defaultCompat).ok).toBe(true)
})
