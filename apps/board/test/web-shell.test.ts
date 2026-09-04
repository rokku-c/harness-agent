/**
 * The web shell's own contract (regression for the /api/coordinate bug found
 * while dogfooding: a model-less board must answer clean JSON, never leak
 * SDK parse noise). Static assets must serve; list fields (requires etc.)
 * given as ARRAYS by UI code must be accepted by the shell.
 */
import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { makeBoard } from "../src/board.ts"
import { makeBoardMcp } from "../src/hosts/mcp/board-mcp.ts"
import { serveBoardWeb } from "../src/hosts/web/server.ts"

const boot = async () => {
  const board = await Effect.runPromise(makeBoard({ dataFile: undefined }))
  // no model -> board_coordinate is NOT registered (the exact path that broke)
  const server = makeBoardMcp({ board })
  const started = await serveBoardWeb({ server, host: "127.0.0.1", port: 0 })
  const json = async (path: string, body?: unknown) => {
    const res = await fetch(started.url + path, body === undefined ? {} : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
    return { status: res.status, text: await res.text() }
  }
  return { board, started, json }
}

describe("board web shell", () => {
  test("model-less /api/coordinate answers stable JSON (no SDK parse noise)", async () => {
    const { board, started, json } = await boot()
    const item = await Effect.runPromise(board.createItem({ title: "coord target" }))
    const r = await json("/api/coordinate", { itemId: item.itemId })
    expect(r.status).toBe(200)
    const body = JSON.parse(r.text) as { ok: boolean; detail?: string }
    expect(body.ok).toBe(false)
    expect(body.detail).toContain("coordinator unavailable")
    started.stop()
  })

  test("static assets are served from the built public dir", async () => {
    const { started, json } = await boot()
    for (const path of ["/", "/app.js", "/app.css", "/style.css"]) {
      const r = await json(path)
      expect(r.status).toBe(200)
    }
    started.stop()
  })

  test("create with ARRAY requires/dependencies is accepted and stored", async () => {
    const { board, started, json } = await boot()
    await Effect.runPromise(board.createResource({ resourceId: "sl", kind: "slot", name: "sl", capacity: 1, concurrency: "shared" }))
    const dep = await Effect.runPromise(board.createItem({ title: "dep" }))
    const r = await json("/api/item", { title: "shell item", requires: [{ resourceId: "sl" }], dependencies: [dep.itemId] })
    expect(r.status).toBe(200)
    const body = JSON.parse(r.text) as { ok: boolean; itemId?: string }
    expect(body.ok).toBe(true)
    const got = await Effect.runPromise(board.getItem(body.itemId!))
    expect(got?.requires?.length).toBe(1)
    expect(got?.dependencies).toEqual([dep.itemId])
    started.stop()
  })
})
