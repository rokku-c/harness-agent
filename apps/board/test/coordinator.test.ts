/**
 * The builtin coordinator agent (layer ③): a scripted model plans a goal
 * into board subtasks by driving the real board ops, then replies through
 * Until.schema. Children land under parentId; events mark start/finish.
 */
import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { makeBoard, type BoardApi } from "../src/board.ts"
import { coordinate } from "../src/coordinator.ts"
import { scriptedModel, freshBoard } from "./helpers.ts"

const create = async (board: BoardApi, title: string): Promise<string> =>
  (await Effect.runPromise(board.createItem({ title }))).itemId

describe("board coordinator agent", () => {
  test("breaks a goal into children under parentId and replies", async () => {
    const board = await freshBoard()
    const goal = await create(board, "ship v2")
    const script = [
      { text: "", toolCalls: [{ id: "v", name: "board_view", input: {} }] },
      {
        text: "",
        toolCalls: [
          { id: "c1", name: "board_create_item", input: { title: "build installer", parentId: goal } },
          { id: "c2", name: "board_create_item", input: { title: "write release notes", parentId: goal } }
        ]
      },
      { text: JSON.stringify({ summary: "planned two subtasks", done: true, created: [] }), toolCalls: [] }
    ]
    const reply = await Effect.runPromise(coordinate(board, goal, { model: scriptedModel(script) }))
    expect(reply.ok).toBe(true)
    expect(reply.detail).toBe("planned two subtasks")
    const goalItem = await Effect.runPromise(board.getItem(goal))
    expect(goalItem?.children.length).toBe(2)
    for (const childId of goalItem?.children ?? []) {
      const child = await Effect.runPromise(board.getItem(childId))
      expect(child?.parentId).toBe(goal)
      expect(child?.state).toBe("todo")
    }
    // coordination start/finish were announced on the event stream
    const events = await Effect.runPromise(board.eventsAfter(0))
    expect(events.some((e) => e.type === "coordinator.started")).toBe(true)
    expect(events.some((e) => e.type === "coordinator.finished")).toBe(true)
  })

  test("a failing session surfaces as ok:false instead of crashing the board", async () => {
    const board = await freshBoard()
    const goal = await create(board, "doomed")
    const script = [
      { text: "", toolCalls: [{ id: "x", name: "board_view", input: {} }] },
      { text: "I give up", toolCalls: [] } // not valid CoordinatorReply JSON
    ]
    const reply = await Effect.runPromise(coordinate(board, goal, { model: scriptedModel(script) }))
    expect(reply.ok).toBe(false)
    // board remains fully usable
    expect((await Effect.runPromise(board.getItem(goal)))?.state).toBe("todo")
  })

  test("coordinate on a missing item reports no such item", async () => {
    const board = await freshBoard()
    const reply = await Effect.runPromise(coordinate(board, "nope", { model: scriptedModel([]) }))
    expect(reply.ok).toBe(false)
    expect(reply.detail).toBe("no such item")
  })
})
