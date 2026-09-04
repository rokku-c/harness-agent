/** The resource layer: workspace resources are DECLARED (workspace.ts) and the
 * session surface GENERATES from those declarations - op names, kinds, recall
 * filter, and append behavior. Adding a resource must require no hand-written
 * op code (proved by the fake-resource assertions at the end). */
import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import type { Model } from "@effect-agent/builtin"
import { makeMantis } from "../src/agent.ts"
import { assembleCapabilities, resourceAppendCapabilities, type CapabilityDecl } from "../src/capabilities.ts"
import { supplyFromCapabilities } from "../src/supply.ts"
import { WORKSPACE_RESOURCES } from "../src/workspace.ts"

type WireTool = { name: string }
const names = (tools?: ReadonlyArray<WireTool>) => (tools ?? []).map((tool) => tool.name)

const writeNames = (caps: ReadonlyArray<CapabilityDecl>) =>
  caps.filter((c) => c.impl === "resource.append").map((c) => c.name)

const fakeResource = {
  kind: "bookmark" as const,
  label: "bookmark",
  write: { name: "bookmark_write", tier: "extended" as const, description: "Record a bookmark in the workspace." }
}

describe("workspace resource declarations", () => {
  test("every declared resource yields exactly one append capability, kind + copy single-sourced", () => {
    const appends = resourceAppendCapabilities(WORKSPACE_RESOURCES)
    expect(writeNames(appends)).toEqual(["note_write", "set_reminder", "task_write"])
    for (const capability of appends) {
      const resource = WORKSPACE_RESOURCES.find((r) => r.kind === capability.kind)
      expect(resource).toBeDefined()
      expect(capability.description).toBe(resource!.write.description)
      expect(capability.name).toBe(resource!.write.name)
      expect(capability.tier).toBe(resource!.write.tier)
    }
  })
  test("a brand-new declared resource flows into manifest and supply automatically", () => {
    const extended = [...WORKSPACE_RESOURCES, fakeResource] as typeof WORKSPACE_RESOURCES
    const appends = resourceAppendCapabilities(extended)
    const manifest = assembleCapabilities(extended)
    expect(writeNames(appends)).toContain("bookmark_write")
    const entry = manifest.find((c) => c.name === "bookmark_write")
    expect(String(entry?.kind)).toBe("bookmark")
    expect(entry?.description).toBe(fakeResource.write.description)
    const supply = supplyFromCapabilities(manifest)
    expect(supply["bookmark_write"]?.tier).toBe("extended")
  })
})

describe("task resource end-to-end through the session agent", () => {
  test("task_write lands a task kind record; recall filters by kind across resources", async () => {
    type Script = Array<{ text: string; toolCalls?: Array<{ id: string; name: string; input: unknown }> }>
    const script: Script = [
      { text: "", toolCalls: [{ id: "e1", name: "enable", input: { name: "task_write" } }] },
      { text: "", toolCalls: [{ id: "e2", name: "enable", input: { name: "set_reminder" } }] },
      { text: "", toolCalls: [{ id: "w1", name: "task_write", input: { text: "ship resource layer" } }] },
      { text: "", toolCalls: [{ id: "w2", name: "set_reminder", input: { text: "review at 9am" } }] },
      { text: "", toolCalls: [{ id: "r1", name: "recall_notes", input: { query: "", kind: "task" } }] },
      { text: JSON.stringify({ reply: "recorded", tone: "plain", asksConfirmation: false }), toolCalls: [] }
    ]
    const queue = [...script]
    const model: any = {
      lastTools: [] as ReadonlyArray<WireTool>,
      generate: (_s: string, _m: unknown[], tools: ReadonlyArray<WireTool>) => {
        model.lastTools = tools
        return Effect.succeed(queue.shift() ?? { text: "done", toolCalls: [] })
      }
    }
    const mantis = makeMantis({ model })
    await Effect.runPromise(mantis.agent.run("add a task and a reminder"))
    expect(names(model.lastTools)).toContain("task_write")
    const taskEntries = mantis.notes.all().filter((e) => e.kind === "task")
    expect(taskEntries).toHaveLength(1)
    expect(taskEntries[0]!.text).toBe("ship resource layer")
    expect(mantis.notes.all().filter((e) => e.kind === "reminder")).toHaveLength(1)
    expect(mantis.notes.search("", "task").map((e) => e.text)).toEqual(["ship resource layer"])
    expect(mantis.notes.search("", "reminder").map((e) => e.text)).toEqual(["review at 9am"])
  })
})

describe("provenance is model-visible and filterable", () => {
  test("recall accepts a source filter and returns it on every entry", async () => {
    type Script = Array<{ text: string; toolCalls?: Array<{ id: string; name: string; input: unknown }> }>
    const queue = [
      { text: "", toolCalls: [{ id: "r1", name: "recall_notes", input: { query: "", source: "ui" } }] },
      { text: JSON.stringify({ reply: "done", tone: "plain", asksConfirmation: false }), toolCalls: [] }
    ]
    let recallInput: unknown
    let recallResult: unknown
    const model: any = {
      generate: (_s: string, _m: unknown[], tools: ReadonlyArray<{ name: string; input: { type: string; properties?: Record<string, unknown> } }>) => {
        const recall = tools.find((x) => x.name === "recall_notes")
        if (recall?.input) {
          const props = recall.input.properties ?? {}
          if ("source" in props) recallInput = props["source"]
        }
        return Effect.succeed(queue.shift() ?? { text: "done", toolCalls: [] })
      }
    }
    const mantis = makeMantis({ model })
    // seed: one operator-written and one agent-written record on the same store
    mantis.notes.add("task", "operator task", "ui")
    mantis.notes.add("task", "agent task")
    await Effect.runPromise(mantis.agent.run("list operator tasks"))
    expect(recallInput).toBeDefined() // the surface advertises the filter
    // store-level filter is authoritative
    expect(mantis.notes.search("", undefined, "ui").map((e) => e.text)).toEqual(["operator task"])
    expect(mantis.notes.search("", undefined, "agent").map((e) => e.text)).toEqual(["agent task"])
    expect(mantis.notes.search("task", "task", "ui")[0]!.source).toBe("ui")
  })
})
