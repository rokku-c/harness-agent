import { expect, test } from "bun:test"
import { makeBoard } from "../src/board.ts"
import { makeBoardWeb } from "../src/hosts/web/server.ts"

test("port-free HTTP facade exposes task artifacts and rejects removed control capabilities", async () => {
  const board = makeBoard(), handle = makeBoardWeb(board)
  const request = (path: string, method = "GET", body?: unknown) => handle(new Request(`http://any-port${path}`, {
    method, ...(body === undefined ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
  }))
  try {
    const created = await request("/api/tasks", "POST", { title: "work" })
    expect(created.status).toBe(201)
    const task = await created.json()
    const changed = await request(`/api/tasks/${task.id}`, "PATCH", { state: "done" })
    expect((await changed.json()).state).toBe("done")
    expect((await (await request("/api/state")).json()).counts.done).toBe(1)
    for (const path of ["/api/coordinate", "/api/claude/apply", "/api/resources", "/api/launch"]) {
      expect((await request(path, "POST", {})).status).toBe(404)
    }
    expect((await request("/api/tasks", "POST", { title: "", executorId: "old" })).status).toBe(400)
    expect((await request("/")).headers.get("content-type")?.split(";")[0]).toBe("text/html")
    expect((await request(`/api/tasks/${task.id}`, "DELETE")).status).toBe(200)
    expect((await request(`/api/tasks/${task.id}`)).status).toBe(404)
  } finally { board.close() }
})
