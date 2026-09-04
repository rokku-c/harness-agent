/**
 * Record mutations (R20): update + delete on the shared workspace, generated
 * as declarative capabilities (update_record / delete_record in the manifest)
 * over a generic record id - no per-kind op code.
 *
 * The durable store replays mutation op-lines (update/delete) so a restarted
 * host sees exactly the same records as the live one.
 */
import { describe, expect, test } from "bun:test"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { NotesStore } from "../src/tools.ts"
import { MANTIS_CAPABILITIES } from "../src/capabilities.ts"
import { makeMantisOps } from "../src/tools.ts"
import { mantisSupply } from "../src/agent.ts"
import { ToolSupply } from "../src/supply.ts"
import { noApproval } from "../src/approval.ts"

const dir = mkdtempSync(join(tmpdir(), "mantis-mutation-"))

describe("record update", () => {
  test("update replaces text on the SAME id and stamps a new ts (source preserved)", () => {
    const store = new NotesStore()
    const added = store.add("task", "old plan", "agent")
    const updated = store.update(added.id, "new plan")
    expect(updated).toBeDefined()
    expect(updated!.id).toBe(added.id)
    expect(updated!.text).toBe("new plan")
    expect(updated!.source).toBe("agent")
    expect(updated!.ts).toBeGreaterThanOrEqual(added.ts)
    expect(store.all().map((e) => e.text)).toEqual(["new plan"])
  })

  test("update of an unknown id returns undefined", () => {
    const store = new NotesStore()
    expect(store.update("e999", "x")).toBeUndefined()
    expect(store.all()).toHaveLength(0)
  })

  test("update survives a durable reload (op line replays onto the record)", () => {
    const file = join(dir, "update.jsonl")
    const first = new NotesStore({ file })
    const added = first.add("note", "before", "ui")
    first.update(added.id, "after")
    const reloaded = new NotesStore({ file })
    expect(reloaded.all().map((e) => e.text)).toEqual(["after"])
    expect(reloaded.all()[0]!.source).toBe("ui")
  })
})

describe("record delete", () => {
  test("delete removes the record from search and all", () => {
    const store = new NotesStore()
    const a = store.add("note", "keep me")
    const gone = store.add("reminder", "drop me")
    const kept = store.add("task", "also keep")
    expect(store.remove(gone.id)).toBe(true)
    expect(store.all().map((e) => e.id).sort()).toEqual([a.id, kept.id].sort())
    expect(store.search("drop")).toHaveLength(0)
    expect(store.remove("e424242")).toBe(false)
  })

  test("delete survives a durable reload (tombstone op line)", () => {
    const file = join(dir, "delete.jsonl")
    const first = new NotesStore({ file })
    const a = first.add("task", "survivor")
    const gone = first.add("task", "victim")
    first.remove(gone.id)
    const reloaded = new NotesStore({ file })
    expect(reloaded.all().map((e) => e.text)).toEqual(["survivor"])
    expect(reloaded.search("victim")).toHaveLength(0)
    void a
  })

  test("update after delete fails (record is gone)", () => {
    const store = new NotesStore()
    const gone = store.add("note", "temp")
    store.remove(gone.id)
    expect(store.update(gone.id, "back?")).toBeUndefined()
  })
})

describe("declarative surface", () => {
  test("update_record + delete_record are manifest entries with generated impls", () => {
    const names = MANTIS_CAPABILITIES.map((c) => c.name)
    expect(names).toContain("update_record")
    expect(names).toContain("delete_record")
    const u = MANTIS_CAPABILITIES.find((c) => c.name === "update_record")
    expect(u!.impl).toBe("resource.update")
    expect(u!.tier).toBe("extended")
    const d = MANTIS_CAPABILITIES.find((c) => c.name === "delete_record")
    expect(d!.impl).toBe("resource.delete")
  })

  test("the session op surface matches the manifest exactly (incl. the new ops)", () => {
    const notes = new NotesStore()
    notes.add("task", "seed")
    const ops = makeMantisOps({ supply: new ToolSupply(mantisSupply), notes, approvals: noApproval })
    expect(ops.map((o) => o.name)).toEqual(MANTIS_CAPABILITIES.map((c) => c.name))
  })
})
